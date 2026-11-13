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
        val payloadObj =
            op.payload?.takeIf { it.isNotBlank() }?.let {
                runCatching { json.parseToJsonElement(it).jsonObject }.getOrNull()
            }

        return when (op.operation) {
            PendingOperationDao.OP_RENAME -> {
                val newName = payloadObj?.get("newName")?.jsonPrimitive?.content.orEmpty()
                if (targetFileId == null || newName.isBlank()) {
                    kotlin.Result.failure(IllegalArgumentException("Missing rename arguments"))
                } else {
                    provider.rename(localAccountId, targetFileId, newName).map { }
                }
            }
            PendingOperationDao.OP_MOVE -> {
                val destId = payloadObj?.get("targetParentId")?.jsonPrimitive?.content?.let(::ProviderFileId)
                if (targetFileId == null) {
                    kotlin.Result.failure(IllegalArgumentException("Missing fileId for move"))
                } else {
                    provider.move(localAccountId, targetFileId, destId).map { }
                }
            }
            PendingOperationDao.OP_COPY -> {
                val destId = payloadObj?.get("targetParentId")?.jsonPrimitive?.content?.let(::ProviderFileId)
                if (targetFileId == null) {
                    kotlin.Result.failure(IllegalArgumentException("Missing fileId for copy"))
                } else {
                    provider.copy(localAccountId, targetFileId, destId).map { }
                }
            }
            PendingOperationDao.OP_TRASH ->
                if (targetFileId == null) {
                    kotlin.Result.failure(IllegalArgumentException("Missing fileId for trash"))
                } else {
                    provider.trash(localAccountId, targetFileId)
                }
            PendingOperationDao.OP_RESTORE ->
                if (targetFileId == null) {
                    kotlin.Result.failure(IllegalArgumentException("Missing fileId for restore"))
                } else {
                    provider.restore(localAccountId, targetFileId)
                }
            PendingOperationDao.OP_DELETE_PERMANENTLY ->
                if (targetFileId == null) {
                    kotlin.Result.failure(IllegalArgumentException("Missing fileId for delete"))
                } else {
                    provider.deletePermanently(localAccountId, targetFileId)
                }
            PendingOperationDao.OP_CREATE_FOLDER -> {
                val name = payloadObj?.get("name")?.jsonPrimitive?.content.orEmpty()
                if (name.isBlank()) {
                    kotlin.Result.failure(IllegalArgumentException("Missing folder name"))
                } else {
                    provider.createFolder(localAccountId, targetFileId, name).map { }
                }
            }
            else -> kotlin.Result.failure(IllegalStateException("Unsupported background operation ${op.operation}"))
        }
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
