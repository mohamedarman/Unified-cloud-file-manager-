package com.unifiedcloud.filemanager

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.util.Base64
import android.webkit.JavascriptInterface
import com.unifiedcloud.filemanager.data.security.DecryptedTokenPayload
import com.unifiedcloud.filemanager.data.security.KeystoreTokenVault
import com.unifiedcloud.filemanager.domain.model.LocalAccountId
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import java.io.File
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.atomic.AtomicReference

/**
 * Typed JavaScript bridge (`window.UnifiedCloudBridge`) restricted to the app's
 * `https://appassets.androidplatform.net` asset origin.
 *
 * Provides native Android Keystore token encryption, external OAuth 2.0 + PKCE browser
 * launch (never WebView), real file-system offline pinning cache with byte accounting,
 * and account disconnect cleanup.
 */
class NativeCloudBridge(
    private val context: Context,
    private val tokenVault: KeystoreTokenVault = KeystoreTokenVault(),
) {
    private val encryptedTokens = ConcurrentHashMap<Long, com.unifiedcloud.filemanager.data.db.entity.TokenSetEntity>()
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
        return runCatching {
            val intent =
                Intent(Intent.ACTION_VIEW, parsed).apply {
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }
            context.startActivity(intent)
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
    fun storeEncryptedToken(
        accountId: Long,
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
        return true
    }

    @JavascriptInterface
    fun revokeAndPurgeAccount(accountId: Long): Boolean {
        if (accountId <= 0L) return false
        encryptedTokens.remove(accountId)
        tokenVault.removeAccountMutex(LocalAccountId(accountId))
        val prefix = "acct_${accountId}_"
        offlineDir.listFiles()?.forEach { file ->
            if (file.name.startsWith(prefix)) {
                file.delete()
            }
        }
        return true
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

    private fun sanitizeCacheFileName(
        accountId: Long,
        fileId: String,
    ): String {
        val cleaned = fileId.replace(Regex("[^A-Za-z0-9._-]"), "_")
        return "acct_${accountId}_$cleaned.bin"
    }

    companion object {
        const val JS_INTERFACE_NAME = "UnifiedCloudBridge"
        private const val OFFLINE_CACHE_DIR_NAME = "offline_pin_cache"
        private const val OAUTH_REDIRECT_URI = "com.unifiedcloud.filemanager:/oauth2redirect"
    }
}
