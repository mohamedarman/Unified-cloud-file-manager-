package com.unifiedcloud.filemanager

import android.content.ContentValues
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.provider.MediaStore
import android.util.Base64
import android.util.Log
import android.webkit.JavascriptInterface
import androidx.browser.customtabs.CustomTabsIntent
import androidx.work.Constraints
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import com.unifiedcloud.filemanager.data.db.AppDatabase
import com.unifiedcloud.filemanager.data.db.dao.PendingOperationDao
import com.unifiedcloud.filemanager.data.db.entity.ConnectedAccountEntity
import com.unifiedcloud.filemanager.data.db.entity.PendingOperationEntity
import com.unifiedcloud.filemanager.data.db.entity.TokenSetEntity
import com.unifiedcloud.filemanager.data.security.DecryptedTokenPayload
import com.unifiedcloud.filemanager.data.security.KeystoreTokenVault
import com.unifiedcloud.filemanager.domain.model.LocalAccountId
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.runBlocking
import kotlinx.serialization.json.buildJsonArray
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import java.io.File
import java.io.FileOutputStream
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.atomic.AtomicReference

/**
 * Typed JavaScript bridge (`window.UnifiedCloudBridge`) restricted to the app's
 * `https://appassets.androidplatform.net` asset origin.
 *
 * Provides Android Keystore + Room encrypted token persistence, Chrome Custom Tabs
 * OAuth 2.0 + PKCE flow, WorkManager background sync queue backed by Room, MediaStore
 * downloads, and offline byte pinning cache with byte accounting.
 */
@Suppress("TooManyFunctions")
class NativeCloudBridge(
    private val context: Context,
    private val tokenVault: KeystoreTokenVault = KeystoreTokenVault(),
) {
    private val database by lazy { AppDatabase.getInstance(context) }
    private val oauthClient by lazy { NativeOAuthClient() }
    private val encryptedTokens = ConcurrentHashMap<Long, TokenSetEntity>()
    private val pendingOAuthRedirectUri = AtomicReference<String?>(null)
    private val offlineDir: File
        get() = File(context.filesDir, OFFLINE_CACHE_DIR_NAME).apply { mkdirs() }

    fun recordOAuthRedirect(uri: Uri) {
        pendingOAuthRedirectUri.set(uri.toString())
    }

    @JavascriptInterface
    fun getBridgeCapabilitiesJson(): String =
        buildJsonObject {
            put("bridgeActive", true)
            put("platform", "android-native")
            put("versionName", BuildConfig.VERSION_NAME)
            put("oauthRedirectUri", OAUTH_REDIRECT_URI)
            put("googleClientIdConfigured", BuildConfig.GOOGLE_OAUTH_CLIENT_ID.isNotBlank())
            put("oneDriveClientIdConfigured", BuildConfig.ONEDRIVE_CLIENT_ID.isNotBlank())
            put("dropboxClientIdConfigured", BuildConfig.DROPBOX_CLIENT_ID.isNotBlank())
            put("boxClientIdConfigured", BuildConfig.BOX_CLIENT_ID.isNotBlank())
            put("keystoreAvailable", true)
        }.toString()

    @JavascriptInterface
    fun startExternalOAuthFlow(authorizationUrl: String): Boolean {
        val parsed = runCatching { Uri.parse(authorizationUrl) }.getOrNull() ?: return false
        if (parsed.scheme != "https") return false
        val customTabsWorked =
            runCatching {
                val tabsIntent = CustomTabsIntent.Builder().setShowTitle(true).build()
                tabsIntent.intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                tabsIntent.launchUrl(context, parsed)
                true
            }.getOrDefault(false)
        if (customTabsWorked) return true
        return runCatching {
            val fallback =
                Intent(Intent.ACTION_VIEW, parsed).apply {
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }
            context.startActivity(fallback)
            true
        }.getOrDefault(false)
    }

    @JavascriptInterface
    fun consumePendingOAuthCallbackJson(): String {
        val redirect = pendingOAuthRedirectUri.getAndSet(null)
        return buildJsonObject {
            put("hasCallback", redirect != null)
            if (redirect != null) {
                put("callbackUrl", redirect)
            }
        }.toString()
    }

    @JavascriptInterface
    fun exchangeOAuthCodeJson(
        provider: String,
        code: String,
        codeVerifier: String,
        redirectUri: String,
    ): String = oauthClient.exchangeCode(provider, code, codeVerifier, redirectUri)

    @JavascriptInterface
    fun refreshOAuthTokenJson(
        provider: String,
        refreshToken: String,
    ): String = oauthClient.refreshToken(provider, refreshToken)

    @JavascriptInterface
    fun storeEncryptedToken(
        accountId: Long,
        accessToken: String,
        refreshToken: String?,
        expiresAtMillis: Long,
        scopesCsv: String,
    ): Boolean =
        storeAccountToken(
            accountId = accountId,
            provider = "GOOGLE_DRIVE",
            providerAccountId = "acct_$accountId",
            displayEmail = null,
            accessToken = accessToken,
            refreshToken = refreshToken,
            expiresAtMillis = expiresAtMillis,
            scopesCsv = scopesCsv,
        )

    @JavascriptInterface
    fun storeAccountToken(
        accountId: Long,
        provider: String,
        providerAccountId: String,
        displayEmail: String?,
        accessToken: String,
        refreshToken: String?,
        expiresAtMillis: Long,
        scopesCsv: String,
    ): Boolean {
        if (accountId <= 0L || accessToken.isBlank()) return false
        val localId = LocalAccountId(accountId)
        val scopes =
            scopesCsv
                .split(',')
                .map { it.trim() }
                .filter { it.isNotEmpty() }
                .toSet()
        val payload =
            DecryptedTokenPayload(
                accessToken = accessToken,
                refreshToken = refreshToken?.takeIf { it.isNotBlank() },
                expiresAtEpochMillis = expiresAtMillis.takeIf { it > 0L },
                grantedScopes = scopes,
            )
        val encrypted =
            tokenVault.encrypt(
                accountId = localId,
                payload = payload,
                updatedAtMillis = System.currentTimeMillis(),
            )
        encryptedTokens[accountId] = encrypted
        runBlocking(Dispatchers.IO) {
            runCatching {
                ensureRoomAccountRow(accountId, provider, providerAccountId, displayEmail)
                database.accountDao().rotateToken(encrypted)
            }.onFailure { err ->
                Log.w(TAG, "Room token persistence skipped: ${err.message}")
            }
        }
        return true
    }

    @JavascriptInterface
    fun getStoredTokenStatusJson(accountId: Long): String {
        if (accountId <= 0L) {
            return buildJsonObject { put("hasToken", false) }.toString()
        }
        val cached =
            encryptedTokens[accountId] ?: runBlocking(Dispatchers.IO) {
                runCatching { database.accountDao().findCurrentToken(accountId) }.getOrNull()
            }
        if (cached == null) {
            return buildJsonObject { put("hasToken", false) }.toString()
        }
        val decrypted = runCatching { tokenVault.decrypt(cached) }.getOrNull()
        return buildJsonObject {
            put("hasToken", decrypted != null)
            if (decrypted != null) {
                put("expiresAtMillis", decrypted.expiresAtEpochMillis ?: 0L)
                put("hasRefreshToken", !decrypted.refreshToken.isNullOrBlank())
            }
        }.toString()
    }

    @JavascriptInterface
    fun revokeAndPurgeAccount(accountId: Long): Boolean {
        if (accountId <= 0L) return false
        encryptedTokens.remove(accountId)
        tokenVault.removeAccountMutex(LocalAccountId(accountId))
        runBlocking(Dispatchers.IO) {
            runCatching {
                database.accountDao().deleteAllTokens(accountId)
                database.accountDao().deleteById(accountId)
            }.onFailure { err ->
                Log.w(TAG, "Room account purge warning: ${err.message}")
            }
        }
        val prefix = "acct_${accountId}_"
        offlineDir.listFiles()?.forEach { file ->
            if (file.name.startsWith(prefix)) {
                file.delete()
            }
        }
        return true
    }

    @JavascriptInterface
    fun enqueuePendingOperationJson(
        accountId: Long,
        provider: String,
        operation: String,
        fileId: String?,
        payloadJson: String?,
    ): Long {
        if (accountId <= 0L || operation.isBlank()) return -1L
        val insertedId =
            runBlocking(Dispatchers.IO) {
                runCatching {
                    ensureRoomAccountRow(accountId, provider, "acct_$accountId", null)
                    database.pendingOperationDao().insert(
                        PendingOperationEntity(
                            accountId = accountId,
                            operation = operation,
                            fileId = fileId?.takeIf { it.isNotBlank() },
                            payload = payloadJson?.takeIf { it.isNotBlank() },
                            state = PendingOperationDao.STATE_PENDING,
                            createdAt = System.currentTimeMillis(),
                            lastAttemptAt = null,
                        ),
                    )
                }.getOrDefault(-1L)
            }
        enqueueSyncWork(accountId)
        return insertedId
    }

    @JavascriptInterface
    fun getPendingOperationsJson(accountId: Long): String {
        if (accountId <= 0L) return "[]"
        val rows =
            runBlocking(Dispatchers.IO) {
                runCatching { database.pendingOperationDao().observeOutstanding(accountId).first() }
                    .getOrDefault(emptyList())
            }
        return buildJsonArray {
            rows.forEach { op ->
                add(
                    buildJsonObject {
                        put("id", op.id)
                        put("accountId", op.accountId)
                        put("operation", op.operation)
                        put("fileId", op.fileId.orEmpty())
                        put("payload", op.payload.orEmpty())
                        put("state", op.state)
                        put("createdAt", op.createdAt)
                        put("attemptCount", op.attemptCount)
                    },
                )
            }
        }.toString()
    }

    @JavascriptInterface
    fun markPendingOperationState(
        operationId: Long,
        state: String,
    ): Boolean {
        if (operationId <= 0L || state.isBlank()) return false
        return runBlocking(Dispatchers.IO) {
            runCatching {
                database.pendingOperationDao().recordAttempt(operationId, state, System.currentTimeMillis())
                true
            }.getOrDefault(false)
        }
    }

    @JavascriptInterface
    fun enqueueSyncWork(accountId: Long): Boolean =
        runCatching {
            val constraints =
                Constraints.Builder()
                    .setRequiredNetworkType(NetworkType.CONNECTED)
                    .build()
            val work =
                OneTimeWorkRequestBuilder<CloudSyncWorker>()
                    .setConstraints(constraints)
                    .build()
            WorkManager.getInstance(context).enqueueUniqueWork(
                "cloud_sync_$accountId",
                ExistingWorkPolicy.REPLACE,
                work,
            )
            true
        }.getOrDefault(false)

    @JavascriptInterface
    fun saveDownloadedFileBase64(
        fileName: String,
        mimeType: String,
        base64Content: String,
    ): Boolean {
        if (fileName.isBlank()) return false
        return runCatching {
            val cleanPayload = base64Content.substringAfter("base64,", base64Content)
            val bytes = Base64.decode(cleanPayload, Base64.DEFAULT)
            writeBytesToDownloads(fileName, mimeType.ifBlank { "application/octet-stream" }, bytes)
        }.getOrDefault(false)
    }

    @JavascriptInterface
    fun pinFileBytesBase64(
        accountId: Long,
        fileId: String,
        base64Content: String,
    ): Long {
        if (accountId <= 0L || fileId.isBlank()) return -1L
        return runCatching {
            val decoded = Base64.decode(base64Content, Base64.DEFAULT)
            val safeName = sanitizeCacheFileName(accountId, fileId)
            val target = File(offlineDir, safeName)
            target.writeBytes(decoded)
            target.length()
        }.getOrDefault(-1L)
    }

    @JavascriptInterface
    fun unpinFileBytes(
        accountId: Long,
        fileId: String,
    ): Boolean {
        if (accountId <= 0L || fileId.isBlank()) return false
        val safeName = sanitizeCacheFileName(accountId, fileId)
        val target = File(offlineDir, safeName)
        return !target.exists() || target.delete()
    }

    @JavascriptInterface
    fun clearOfflineCache(): Boolean =
        runCatching {
            offlineDir.listFiles()?.forEach { it.delete() }
            true
        }.getOrDefault(false)

    @JavascriptInterface
    fun getOfflineCacheStatsJson(): String {
        val files = offlineDir.listFiles().orEmpty().filter { it.isFile }
        val totalBytes = files.sumOf { it.length() }
        return buildJsonObject {
            put("pinnedCount", files.size)
            put("totalBytes", totalBytes)
        }.toString()
    }

    private suspend fun ensureRoomAccountRow(
        accountId: Long,
        provider: String,
        providerAccountId: String,
        displayEmail: String?,
    ) {
        val existing = database.accountDao().findById(accountId)
        if (existing == null) {
            database.accountDao().upsert(
                ConnectedAccountEntity(
                    localId = accountId,
                    provider = provider,
                    providerAccountId = providerAccountId,
                    displayEmail = displayEmail,
                    isActive = true,
                    connectedAt = System.currentTimeMillis(),
                ),
            )
        }
    }

    @Suppress("DEPRECATION")
    private fun writeBytesToDownloads(
        fileName: String,
        mimeType: String,
        bytes: ByteArray,
    ): Boolean {
        val safeName = fileName.replace(Regex("[/\\\\]"), "_")
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            val values =
                ContentValues().apply {
                    put(MediaStore.Downloads.DISPLAY_NAME, safeName)
                    put(MediaStore.Downloads.MIME_TYPE, mimeType)
                    put(MediaStore.Downloads.IS_PENDING, 1)
                }
            val resolver = context.contentResolver
            val uri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values) ?: return false
            resolver.openOutputStream(uri)?.use { out -> out.write(bytes) }
            values.clear()
            values.put(MediaStore.Downloads.IS_PENDING, 0)
            resolver.update(uri, values, null, null)
            true
        } else {
            val downloadsDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS)
            downloadsDir.mkdirs()
            FileOutputStream(File(downloadsDir, safeName)).use { out -> out.write(bytes) }
            true
        }
    }

    private fun sanitizeCacheFileName(
        accountId: Long,
        fileId: String,
    ): String {
        val cleaned = fileId.replace(Regex("[^A-Za-z0-9._-]"), "_")
        return "acct_${accountId}_$cleaned.bin"
    }

    companion object {
        const val JS_INTERFACE_NAME = "UnifiedCloudBridge"
        private const val TAG = "NativeCloudBridge"
        private const val OFFLINE_CACHE_DIR_NAME = "offline_pin_cache"
        private const val OAUTH_REDIRECT_URI = "com.unifiedcloud.filemanager:/oauth2redirect"
    }
}
