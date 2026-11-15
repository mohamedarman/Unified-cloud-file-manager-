package com.unifiedcloud.filemanager

import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.content.pm.ServiceInfo
import android.os.Build
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.work.CoroutineWorker
import androidx.work.ForegroundInfo
import androidx.work.WorkerParameters
import com.unifiedcloud.filemanager.cloud.google.quota.QuotaGovernor
import com.unifiedcloud.filemanager.cloud.provider.HttpCloudProvider
import com.unifiedcloud.filemanager.data.db.AppDatabase
import com.unifiedcloud.filemanager.data.db.dao.PendingOperationDao
import com.unifiedcloud.filemanager.data.db.entity.PendingOperationEntity
import com.unifiedcloud.filemanager.data.security.KeystoreTokenVault
import com.unifiedcloud.filemanager.domain.model.LocalAccountId
import com.unifiedcloud.filemanager.domain.model.ProviderFileId
import com.unifiedcloud.filemanager.domain.model.ProviderId
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import okhttp3.OkHttpClient

/**
 * WorkManager foreground worker that drains queued mutations stored in Room's
 * `pending_operation` table using real multi-cloud provider calls and Keystore-encrypted
 * account credentials.
 */
class CloudSyncWorker(
    appContext: Context,
    workerParams: WorkerParameters,
) : CoroutineWorker(appContext, workerParams) {
    private val database by lazy { AppDatabase.getInstance(applicationContext) }
    private val tokenVault by lazy { KeystoreTokenVault() }
    private val httpClient by lazy { OkHttpClient() }
    private val quotaGovernor by lazy { QuotaGovernor() }
    private val json = Json { ignoreUnknownKeys = true }

    override suspend fun getForegroundInfo(): ForegroundInfo = createForegroundInfo()

    override suspend fun doWork(): Result {
        runCatching { setForeground(createForegroundInfo()) }
            .onFailure { err -> Log.w(TAG, "Foreground promo unavailable: ${err.message}") }

        val pendingDao = database.pendingOperationDao()
        val pendingOps = pendingDao.findByState(PendingOperationDao.STATE_PENDING)
        if (pendingOps.isEmpty()) {
            return Result.success()
        }

        var hadRetryableFailure = false
        for (op in pendingOps) {
            val outcome = executePendingOperation(op)
            if (outcome.isSuccess) {
                pendingDao.recordAttempt(
                    id = op.id,
                    state = PendingOperationDao.STATE_COMPLETED,
                    at = System.currentTimeMillis(),
                )
            } else {
                pendingDao.recordAttempt(
                    id = op.id,
                    state = PendingOperationDao.STATE_FAILED,
                    at = System.currentTimeMillis(),
                )
                hadRetryableFailure = true
            }
        }
        return if (hadRetryableFailure) Result.retry() else Result.success()
    }

    private suspend fun executePendingOperation(op: PendingOperationEntity): kotlin.Result<Unit> {
        val account =
            database.accountDao().findById(op.accountId)
                ?: return kotlin.Result.failure(IllegalStateException("Account missing"))
        val tokenRow =
            database.accountDao().findCurrentToken(op.accountId)
                ?: return kotlin.Result.failure(IllegalStateException("Token missing"))
        val decrypted =
            runCatching { tokenVault.decrypt(tokenRow) }
                .getOrElse { err -> return kotlin.Result.failure(err) }

        val providerId =
            runCatching { ProviderId(account.provider) }
                .getOrDefault(ProviderId.GOOGLE_DRIVE)
        val cloudProvider =
            HttpCloudProvider(
                providerId = providerId,
                httpClient = httpClient,
                tokenProvider = { kotlin.Result.success(decrypted.accessToken) },
                quotaGovernor = quotaGovernor,
            )
        return dispatchOperation(cloudProvider, op)
    }

    private suspend fun dispatchOperation(
        provider: HttpCloudProvider,
        op: PendingOperationEntity,
    ): kotlin.Result<Unit> {
        val localAccountId = LocalAccountId(op.accountId)
        val targetFileId = op.fileId?.takeIf { it.isNotBlank() }?.let(::ProviderFileId)
        val payloadObj = parsePayloadObject(op.payload)

        return when (op.operation) {
            PendingOperationDao.OP_RENAME ->
                dispatchRename(provider, localAccountId, targetFileId, payloadObj)
            PendingOperationDao.OP_MOVE ->
                dispatchMoveOrCopy(provider, localAccountId, targetFileId, payloadObj, isMove = true)
            PendingOperationDao.OP_COPY ->
                dispatchMoveOrCopy(provider, localAccountId, targetFileId, payloadObj, isMove = false)
            PendingOperationDao.OP_TRASH ->
                requireTargetFile(targetFileId, "trash") { provider.trash(localAccountId, it) }
            PendingOperationDao.OP_RESTORE ->
                requireTargetFile(targetFileId, "restore") { provider.restore(localAccountId, it) }
            PendingOperationDao.OP_DELETE_PERMANENTLY ->
                requireTargetFile(targetFileId, "delete") {
                    provider.deletePermanently(localAccountId, it)
                }
            PendingOperationDao.OP_CREATE_FOLDER ->
                dispatchCreateFolder(provider, localAccountId, targetFileId, payloadObj)
            else ->
                kotlin.Result.failure(
                    IllegalStateException("Unsupported background operation ${op.operation}"),
                )
        }
    }

    private fun parsePayloadObject(rawPayload: String?) =
        rawPayload?.takeIf { it.isNotBlank() }?.let {
            runCatching { json.parseToJsonElement(it).jsonObject }.getOrNull()
        }

    private suspend fun dispatchRename(
        provider: HttpCloudProvider,
        accountId: LocalAccountId,
        targetFileId: ProviderFileId?,
        payloadObj: JsonObject?,
    ): kotlin.Result<Unit> {
        val newName = payloadObj?.get("newName")?.jsonPrimitive?.content.orEmpty()
        if (targetFileId == null || newName.isBlank()) {
            return kotlin.Result.failure(IllegalArgumentException("Missing rename arguments"))
        }
        return provider.rename(accountId, targetFileId, newName).map { }
    }

    private suspend fun dispatchMoveOrCopy(
        provider: HttpCloudProvider,
        accountId: LocalAccountId,
        targetFileId: ProviderFileId?,
        payloadObj: JsonObject?,
        isMove: Boolean,
    ): kotlin.Result<Unit> {
        if (targetFileId == null) {
            val action = if (isMove) "move" else "copy"
            return kotlin.Result.failure(IllegalArgumentException("Missing fileId for $action"))
        }
        val destId = payloadObj?.get("targetParentId")?.jsonPrimitive?.content?.let(::ProviderFileId)
        val result =
            if (isMove) {
                provider.move(accountId, targetFileId, destId)
            } else {
                provider.copy(accountId, targetFileId, destId)
            }
        return result.map { }
    }

    private suspend fun dispatchCreateFolder(
        provider: HttpCloudProvider,
        accountId: LocalAccountId,
        parentFolderId: ProviderFileId?,
        payloadObj: JsonObject?,
    ): kotlin.Result<Unit> {
        val name = payloadObj?.get("name")?.jsonPrimitive?.content.orEmpty()
        if (name.isBlank()) {
            return kotlin.Result.failure(IllegalArgumentException("Missing folder name"))
        }
        return provider.createFolder(accountId, parentFolderId, name).map { }
    }

    private inline fun requireTargetFile(
        targetFileId: ProviderFileId?,
        action: String,
        block: (ProviderFileId) -> kotlin.Result<Unit>,
    ): kotlin.Result<Unit> =
        if (targetFileId == null) {
            kotlin.Result.failure(IllegalArgumentException("Missing fileId for $action"))
        } else {
            block(targetFileId)
        }

    private fun createForegroundInfo(): ForegroundInfo {
        ensureNotificationChannel()
        val notification =
            NotificationCompat.Builder(applicationContext, CHANNEL_ID)
                .setSmallIcon(android.R.drawable.stat_sys_upload)
                .setContentTitle("Unified Cloud File Manager")
                .setContentText("Synchronizing queued cloud operations")
                .setOngoing(true)
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .build()
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            ForegroundInfo(
                NOTIFICATION_ID,
                notification,
                ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC,
            )
        } else {
            ForegroundInfo(NOTIFICATION_ID, notification)
        }
    }

    private fun ensureNotificationChannel() {
        val manager =
            applicationContext.getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager
                ?: return
        val existing = manager.getNotificationChannel(CHANNEL_ID)
        if (existing == null) {
            val channel =
                NotificationChannel(
                    CHANNEL_ID,
                    "Cloud Synchronization",
                    NotificationManager.IMPORTANCE_LOW,
                )
            manager.createNotificationChannel(channel)
        }
    }

    companion object {
        private const val TAG = "CloudSyncWorker"
        private const val CHANNEL_ID = "ucfm_sync_channel"
        private const val NOTIFICATION_ID = 4001
    }
}
