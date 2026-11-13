package com.unifiedcloud.filemanager.cloud.provider

import com.unifiedcloud.filemanager.cloud.google.drive.DriveErrors
import com.unifiedcloud.filemanager.cloud.google.drive.DriveFields
import com.unifiedcloud.filemanager.cloud.google.quota.QuotaGovernor
import com.unifiedcloud.filemanager.domain.error.AppError
import com.unifiedcloud.filemanager.domain.error.QuotaScope
import com.unifiedcloud.filemanager.domain.error.TransportCause
import com.unifiedcloud.filemanager.domain.model.CloudFile
import com.unifiedcloud.filemanager.domain.model.ContentSource
import com.unifiedcloud.filemanager.domain.model.FileRef
import com.unifiedcloud.filemanager.domain.model.LocalAccountId
import com.unifiedcloud.filemanager.domain.model.Page
import com.unifiedcloud.filemanager.domain.model.ProviderFileId
import com.unifiedcloud.filemanager.domain.model.ProviderId
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.jsonObject
import okhttp3.HttpUrl.Companion.toHttpUrl
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.io.ByteArrayInputStream
import java.net.SocketTimeoutException
import java.net.UnknownHostException

/**
 * Executes rate-governed OkHttp calls and maps transport or provider HTTP errors
 * into domain [AppErrorException] results for [HttpCloudProvider].
 */
internal class MultiCloudHttpExecutor(
    private val providerId: ProviderId,
    private val endpoints: ProviderEndpoints,
    private val httpClient: OkHttpClient,
    private val tokenProvider: AccountAccessTokenProvider,
    private val quotaGovernor: QuotaGovernor,
) {
    private val json = Json { ignoreUnknownKeys = true }

    suspend fun listFilteredDriveFiles(
        accountId: LocalAccountId,
        filterQuery: String,
        pageToken: String?,
        pageSize: Int,
    ): Result<Page<CloudFile>> =
        executeJsonObject(accountId = accountId, fileId = null) { token ->
            val urlBuilder =
                "${endpoints.apiBaseUrl}/files".toHttpUrl().newBuilder()
                    .addQueryParameter("q", filterQuery)
                    .addQueryParameter("pageSize", pageSize.toString())
                    .addQueryParameter("fields", DriveFields.FILE_LIST)
            if (pageToken != null) {
                urlBuilder.addQueryParameter("pageToken", pageToken)
            }
            Request.Builder()
                .url(urlBuilder.build())
                .header("Authorization", "Bearer $token")
                .get()
                .build()
        }.map { root -> MultiCloudResponseParser.parseFilePage(providerId, accountId, root) }

    suspend fun downloadBytes(
        accountId: LocalAccountId,
        fileId: ProviderFileId,
        requestBuilder: (String) -> Request,
    ): Result<ContentSource> =
        executeGoverned(accountId = accountId) { token ->
            val request = requestBuilder(token)
            httpClient.newCall(request).execute().use { response ->
                if (!response.isSuccessful) {
                    val err = response.body?.string().orEmpty()
                    return@executeGoverned failureResult(accountId, fileId, response.code, err)
                }
                val bytes = response.body?.bytes() ?: ByteArray(0)
                val ref = FileRef(provider = providerId, accountId = accountId, fileId = fileId)
                Result.success(
                    ContentSource(
                        ref = ref,
                        lengthBytes = bytes.size.toLong(),
                        stream = ByteArrayInputStream(bytes),
                    ),
                )
            }
        }

    suspend fun copyFile(
        accountId: LocalAccountId,
        fileId: ProviderFileId,
        newParentFolderId: ProviderFileId?,
    ): Result<CloudFile> =
        executeGoverned(accountId = accountId) { token ->
            val request =
                MultiCloudRequestBuilder.copy(
                    providerId = providerId,
                    apiBaseUrl = endpoints.apiBaseUrl,
                    token = token,
                    fileId = fileId,
                    newParentFolderId = newParentFolderId,
                )
            httpClient.newCall(request).execute().use { response ->
                val bodyText = response.body?.string().orEmpty()
                if (!response.isSuccessful) {
                    return@executeGoverned failureResult(accountId, fileId, response.code, bodyText)
                }
                val parsed =
                    if (bodyText.isNotBlank()) {
                        MultiCloudResponseParser.parseCloudFile(
                            providerId,
                            accountId,
                            json.parseToJsonElement(bodyText).jsonObject,
                        )
                    } else {
                        CloudFile(
                            ref = FileRef(provider = providerId, accountId = accountId, fileId = fileId),
                            name = fileId.value.substringAfterLast('/'),
                            mimeType = "application/octet-stream",
                            sizeBytes = null,
                            modifiedTimeMillis = null,
                            isFolder = false,
                            parentFolderId = newParentFolderId,
                            isShared = false,
                            isOwnedByUser = true,
                        )
                    }
                Result.success(parsed)
            }
        }

    suspend fun patchDriveFile(
        accountId: LocalAccountId,
        fileId: ProviderFileId,
        body: JsonObject,
    ): Result<CloudFile> =
        executeJsonObject(accountId = accountId, fileId = fileId) { token ->
            val url =
                "${endpoints.apiBaseUrl}/files/${fileId.value}".toHttpUrl().newBuilder()
                    .addQueryParameter("fields", MultiCloudRequestBuilder.SINGLE_FILE_FIELDS)
                    .build()
            Request.Builder()
                .url(url)
                .header("Authorization", "Bearer $token")
                .patch(body.toString().toRequestBody(MultiCloudRequestBuilder.JSON_MEDIA_TYPE))
                .build()
        }.map { obj -> MultiCloudResponseParser.parseCloudFile(providerId, accountId, obj) }

    suspend fun executeJsonObject(
        accountId: LocalAccountId,
        fileId: ProviderFileId?,
        requestBuilder: (String) -> Request,
    ): Result<JsonObject> =
        executeGoverned(accountId = accountId) { token ->
            httpClient.newCall(requestBuilder(token)).execute().use { response ->
                val bodyText = response.body?.string().orEmpty()
                if (!response.isSuccessful) {
                    return@executeGoverned failureResult(accountId, fileId, response.code, bodyText)
                }
                Result.success(json.parseToJsonElement(bodyText).jsonObject)
            }
        }

    suspend fun executeUnit(
        accountId: LocalAccountId,
        fileId: ProviderFileId?,
        requestBuilder: (String) -> Request,
    ): Result<Unit> =
        executeGoverned(accountId = accountId) { token ->
            httpClient.newCall(requestBuilder(token)).execute().use { response ->
                val bodyText = response.body?.string().orEmpty()
                if (!response.isSuccessful) {
                    return@executeGoverned failureResult(accountId, fileId, response.code, bodyText)
                }
                Result.success(Unit)
            }
        }

    private suspend fun <T> executeGoverned(
        accountId: LocalAccountId,
        block: suspend (String) -> Result<T>,
    ): Result<T> =
        withContext(Dispatchers.IO) {
            val tokenResult = tokenProvider.accessTokenFor(accountId)
            val token =
                tokenResult.getOrElse { err ->
                    return@withContext Result.failure(err)
                }
            val governed =
                quotaGovernor.withQueuedPermit(accountId) {
                    runCatching { block(token) }.getOrElse { error ->
                        val cause =
                            when (error) {
                                is SocketTimeoutException -> TransportCause.TIMEOUT
                                is UnknownHostException -> TransportCause.DNS_FAILURE
                                else -> TransportCause.UNKNOWN
                            }
                        Result.failure(
                            AppErrorException(DriveErrors.network(cause = cause, retryable = true)),
                        )
                    }
                }
            governed ?: Result.failure(
                AppErrorException(
                    AppError.QuotaExceeded(
                        providerId = providerId,
                        scope = QuotaScope.REQUEST_RATE,
                        limitBytes = null,
                        usedBytes = null,
                    ),
                ),
            )
        }

    private fun <T> failureResult(
        accountId: LocalAccountId,
        fileId: ProviderFileId?,
        httpStatus: Int,
        bodyText: String,
    ): Result<T> {
        val mapped =
            DriveErrors.map(
                failure =
                    DriveErrors.DriveHttpFailure(
                        httpStatus = httpStatus,
                        reason = DriveErrors.reasonOf(bodyText),
                        retryAfterMillis = null,
                    ),
                context =
                    DriveErrors.DriveOperationContext(
                        accountId = accountId,
                        fileId = fileId,
                        grantedScopesSuffice = true,
                    ),
            )
        return Result.failure(AppErrorException(mapped))
    }

    fun <T> unsupported(message: String): Result<T> =
        Result.failure(AppErrorException(AppError.Unknown(message = message, cause = null)))
}
