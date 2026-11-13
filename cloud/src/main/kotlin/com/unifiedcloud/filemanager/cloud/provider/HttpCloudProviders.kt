package com.unifiedcloud.filemanager.cloud.provider

import com.unifiedcloud.filemanager.cloud.google.drive.DriveErrors
import com.unifiedcloud.filemanager.cloud.google.drive.DriveFields
import com.unifiedcloud.filemanager.cloud.google.quota.QuotaGovernor
import com.unifiedcloud.filemanager.domain.error.AppError
import com.unifiedcloud.filemanager.domain.error.QuotaScope
import com.unifiedcloud.filemanager.domain.error.TransportCause
import com.unifiedcloud.filemanager.domain.model.AccountRef
import com.unifiedcloud.filemanager.domain.model.ByteRange
import com.unifiedcloud.filemanager.domain.model.CloudFile
import com.unifiedcloud.filemanager.domain.model.ContentSource
import com.unifiedcloud.filemanager.domain.model.FileQuery
import com.unifiedcloud.filemanager.domain.model.FileRef
import com.unifiedcloud.filemanager.domain.model.FolderHierarchyValidator
import com.unifiedcloud.filemanager.domain.model.LocalAccountId
import com.unifiedcloud.filemanager.domain.model.MatchLocation
import com.unifiedcloud.filemanager.domain.model.Page
import com.unifiedcloud.filemanager.domain.model.ProgressSink
import com.unifiedcloud.filemanager.domain.model.ProviderCapabilities
import com.unifiedcloud.filemanager.domain.model.ProviderFileId
import com.unifiedcloud.filemanager.domain.model.ProviderId
import com.unifiedcloud.filemanager.domain.model.QuotaUsage
import com.unifiedcloud.filemanager.domain.model.Revision
import com.unifiedcloud.filemanager.domain.model.SearchHit
import com.unifiedcloud.filemanager.domain.model.SearchQuery
import com.unifiedcloud.filemanager.domain.model.SearchResultPage
import com.unifiedcloud.filemanager.domain.model.TransferDestination
import com.unifiedcloud.filemanager.domain.provider.CloudProvider
import com.unifiedcloud.filemanager.domain.provider.ConflictStrategy
import com.unifiedcloud.filemanager.domain.provider.FileChange
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.emptyFlow
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.buildJsonArray
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.longOrNull
import kotlinx.serialization.json.put
import okhttp3.HttpUrl.Companion.toHttpUrl
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream
import java.io.InputStream
import java.net.SocketTimeoutException
import java.net.UnknownHostException
import java.time.Instant

/**
 * Carries a domain [AppError] inside a standard Kotlin [Result.failure].
 */
class AppErrorException(val appError: AppError) : Exception(appError.toString())

/**
 * Supplies a valid Bearer access token for a given [LocalAccountId].
 */
fun interface AccountAccessTokenProvider {
    suspend fun accessTokenFor(accountId: LocalAccountId): Result<String>
}

/**
 * Multi-cloud HTTP implementation of [CloudProvider] backed by [OkHttpClient] and
 * bounded by [QuotaGovernor]. Supports Google Drive v3, Microsoft Graph OneDrive v1.0,
 * Dropbox API v2, and Box API v2.0.
 */
class HttpCloudProvider(
    val providerId: ProviderId = ProviderId.GOOGLE_DRIVE,
    private val httpClient: OkHttpClient,
    private val tokenProvider: AccountAccessTokenProvider,
    private val quotaGovernor: QuotaGovernor,
    private val baseUrlOverride: String? = null,
    private val accountsSupplier: suspend () -> List<AccountRef> = { emptyList() },
    private val parentLookup: (ProviderFileId) -> ProviderFileId? = { null },
) : CloudProvider {
    private val json = Json { ignoreUnknownKeys = true }

    private val apiBaseUrl: String
        get() =
            baseUrlOverride?.trimEnd('/') ?: when (providerId) {
                ProviderId.GOOGLE_DRIVE -> "https://www.googleapis.com/drive/v3"
                ProviderId.ONE_DRIVE -> "https://graph.microsoft.com/v1.0/me/drive"
                ProviderId.DROPBOX -> "https://api.dropboxapi.com/2"
                ProviderId.BOX -> "https://api.box.com/2.0"
                else -> "https://www.googleapis.com/drive/v3"
            }

    override suspend fun listAccounts(): Result<List<AccountRef>> =
        runCatching { accountsSupplier() }

    override suspend fun getCapabilities(accountId: LocalAccountId): Result<ProviderCapabilities> =
        getQuotaInfo(accountId).map {
            ProviderCapabilities.forProvider(
                provider = providerId,
                hasWriteScope = true,
                hasOfflineRefresh = true,
            )
        }

    override suspend fun getQuotaInfo(accountId: LocalAccountId): Result<QuotaUsage> =
        executeGoverned(accountId = accountId, fileId = null) { token ->
            val request = buildQuotaRequest(token)
            httpClient.newCall(request).execute().use { response ->
                val bodyText = response.body?.string().orEmpty()
                if (!response.isSuccessful) {
                    return@executeGoverned failureResult(accountId, null, response.code, bodyText)
                }
                val root = json.parseToJsonElement(bodyText).jsonObject
                Result.success(parseQuotaResponse(root))
            }
        }

    override suspend fun listFiles(query: FileQuery): Result<Page<CloudFile>> =
        executeGoverned(accountId = query.accountId, fileId = query.parentFolderId) { token ->
            val request = buildListRequest(token, query)
            httpClient.newCall(request).execute().use { response ->
                val bodyText = response.body?.string().orEmpty()
                if (!response.isSuccessful) {
                    return@executeGoverned failureResult(
                        query.accountId,
                        query.parentFolderId,
                        response.code,
                        bodyText,
                    )
                }
                val root = json.parseToJsonElement(bodyText).jsonObject
                Result.success(parseFilePage(query.accountId, root))
            }
        }

    override suspend fun getFileMetadata(
        accountId: LocalAccountId,
        fileId: ProviderFileId,
    ): Result<CloudFile> =
        executeGoverned(accountId = accountId, fileId = fileId) { token ->
            val url =
                "$apiBaseUrl/files/${fileId.value}".toHttpUrl().newBuilder()
                    .addQueryParameter("fields", SINGLE_FILE_FIELDS)
                    .build()
            val request =
                Request.Builder()
                    .url(url)
                    .header("Authorization", "Bearer $token")
                    .get()
                    .build()
            httpClient.newCall(request).execute().use { response ->
                val bodyText = response.body?.string().orEmpty()
                if (!response.isSuccessful) {
                    return@executeGoverned failureResult(accountId, fileId, response.code, bodyText)
                }
                val obj = json.parseToJsonElement(bodyText).jsonObject
                Result.success(parseCloudFile(accountId, obj))
            }
        }

    override suspend fun search(query: SearchQuery): Result<SearchResultPage> =
        executeGoverned(accountId = query.accountId, fileId = null) { token ->
            val request = buildSearchRequest(token, query)
            httpClient.newCall(request).execute().use { response ->
                val bodyText = response.body?.string().orEmpty()
                if (!response.isSuccessful) {
                    return@executeGoverned failureResult(query.accountId, null, response.code, bodyText)
                }
                val root = json.parseToJsonElement(bodyText).jsonObject
                val page = parseFilePage(query.accountId, root)
                val hits =
                    page.items.map { file ->
                        SearchHit(
                            file = file,
                            matchSnippet = file.name,
                            matchLocation = MatchLocation.NAME,
                        )
                    }
                Result.success(
                    SearchResultPage(
                        query = query,
                        items = hits,
                        nextPageToken = page.nextPageToken,
                    ),
                )
            }
        }

    override suspend fun getRecentFiles(
        accountId: LocalAccountId,
        limit: Int,
    ): Result<List<CloudFile>> =
        listFiles(
            FileQuery(
                accountId = accountId,
                parentFolderId = null,
                pageSize = limit.coerceIn(FileQuery.MIN_PAGE_SIZE, FileQuery.MAX_PAGE_SIZE),
            ),
        ).map { it.items }

    override suspend fun getStarredFiles(
        accountId: LocalAccountId,
        pageToken: String?,
        pageSize: Int,
    ): Result<Page<CloudFile>> =
        listFilteredFiles(
            accountId = accountId,
            filterQuery = "starred = true and trashed = false",
            pageToken = pageToken,
            pageSize = pageSize,
        )

    override suspend fun getSharedWithMe(
        accountId: LocalAccountId,
        pageToken: String?,
        pageSize: Int,
    ): Result<Page<CloudFile>> =
        listFilteredFiles(
            accountId = accountId,
            filterQuery = "sharedWithMe = true and trashed = false",
            pageToken = pageToken,
            pageSize = pageSize,
        )

    override suspend fun getSharedByMe(
        accountId: LocalAccountId,
        pageToken: String?,
        pageSize: Int,
    ): Result<Page<CloudFile>> =
        listFilteredFiles(
            accountId = accountId,
            filterQuery = "'me' in owners and shared = true and trashed = false",
            pageToken = pageToken,
            pageSize = pageSize,
        )

    override suspend fun createFolder(
        accountId: LocalAccountId,
        parentFolderId: ProviderFileId?,
        name: String,
    ): Result<CloudFile> =
        executeGoverned(accountId = accountId, fileId = parentFolderId) { token ->
            val payload =
                buildJsonObject {
                    put("name", name)
                    put("mimeType", FOLDER_MIME_TYPE)
                    if (parentFolderId != null) {
                        put("parents", buildJsonArray { add(JsonPrimitive(parentFolderId.value)) })
                    }
                }
            val url =
                "$apiBaseUrl/files".toHttpUrl().newBuilder()
                    .addQueryParameter("fields", SINGLE_FILE_FIELDS)
                    .build()
            val request =
                Request.Builder()
                    .url(url)
                    .header("Authorization", "Bearer $token")
                    .post(payload.toString().toRequestBody(JSON_MEDIA_TYPE))
                    .build()
            httpClient.newCall(request).execute().use { response ->
                val bodyText = response.body?.string().orEmpty()
                if (!response.isSuccessful) {
                    return@executeGoverned failureResult(accountId, parentFolderId, response.code, bodyText)
                }
                val obj = json.parseToJsonElement(bodyText).jsonObject
                Result.success(parseCloudFile(accountId, obj))
            }
        }

    override suspend fun rename(
        accountId: LocalAccountId,
        fileId: ProviderFileId,
        newName: String,
    ): Result<CloudFile> =
        patchDriveFile(
            accountId = accountId,
            fileId = fileId,
            body = buildJsonObject { put("name", newName) },
        )

    override suspend fun move(
        accountId: LocalAccountId,
        fileId: ProviderFileId,
        newParentFolderId: ProviderFileId?,
        conflictStrategy: ConflictStrategy,
    ): Result<CloudFile> {
        if (FolderHierarchyValidator.wouldCreateCycle(fileId, newParentFolderId, parentLookup)) {
            return Result.failure(
                AppErrorException(
                    AppError.Unknown(
                        message = "Cannot move a folder into itself or one of its descendants",
                        cause = null,
                    ),
                ),
            )
        }
        return executeGoverned(accountId = accountId, fileId = fileId) { token ->
            val urlBuilder =
                "$apiBaseUrl/files/${fileId.value}".toHttpUrl().newBuilder()
                    .addQueryParameter("fields", SINGLE_FILE_FIELDS)
            if (newParentFolderId != null) {
                urlBuilder.addQueryParameter("addParents", newParentFolderId.value)
            }
            val request =
                Request.Builder()
                    .url(urlBuilder.build())
                    .header("Authorization", "Bearer $token")
                    .patch("{}".toRequestBody(JSON_MEDIA_TYPE))
                    .build()
            httpClient.newCall(request).execute().use { response ->
                val bodyText = response.body?.string().orEmpty()
                if (!response.isSuccessful) {
                    return@executeGoverned failureResult(accountId, fileId, response.code, bodyText)
                }
                val obj = json.parseToJsonElement(bodyText).jsonObject
                Result.success(parseCloudFile(accountId, obj))
            }
        }
    }

    override suspend fun copy(
        accountId: LocalAccountId,
        fileId: ProviderFileId,
        newParentFolderId: ProviderFileId?,
        conflictStrategy: ConflictStrategy,
    ): Result<CloudFile> =
        executeGoverned(accountId = accountId, fileId = fileId) { token ->
            val payload =
                buildJsonObject {
                    if (newParentFolderId != null) {
                        put("parents", buildJsonArray { add(JsonPrimitive(newParentFolderId.value)) })
                    }
                }
            val url =
                "$apiBaseUrl/files/${fileId.value}/copy".toHttpUrl().newBuilder()
                    .addQueryParameter("fields", SINGLE_FILE_FIELDS)
                    .build()
            val request =
                Request.Builder()
                    .url(url)
                    .header("Authorization", "Bearer $token")
                    .post(payload.toString().toRequestBody(JSON_MEDIA_TYPE))
                    .build()
            httpClient.newCall(request).execute().use { response ->
                val bodyText = response.body?.string().orEmpty()
                if (!response.isSuccessful) {
                    return@executeGoverned failureResult(accountId, fileId, response.code, bodyText)
                }
                val obj = json.parseToJsonElement(bodyText).jsonObject
                Result.success(parseCloudFile(accountId, obj))
            }
        }

    override suspend fun trash(
        accountId: LocalAccountId,
        fileId: ProviderFileId,
    ): Result<Unit> =
        patchDriveFile(accountId, fileId, buildJsonObject { put("trashed", true) }).map { }

    override suspend fun restore(
        accountId: LocalAccountId,
        fileId: ProviderFileId,
    ): Result<Unit> =
        patchDriveFile(accountId, fileId, buildJsonObject { put("trashed", false) }).map { }

    override suspend fun deletePermanently(
        accountId: LocalAccountId,
        fileId: ProviderFileId,
    ): Result<Unit> =
        executeGoverned(accountId = accountId, fileId = fileId) { token ->
            val request =
                Request.Builder()
                    .url("$apiBaseUrl/files/${fileId.value}")
                    .header("Authorization", "Bearer $token")
                    .delete()
                    .build()
            httpClient.newCall(request).execute().use { response ->
                val bodyText = response.body?.string().orEmpty()
                if (!response.isSuccessful) {
                    return@executeGoverned failureResult(accountId, fileId, response.code, bodyText)
                }
                Result.success(Unit)
            }
        }

    override suspend fun emptyTrash(accountId: LocalAccountId): Result<Unit> =
        executeGoverned(accountId = accountId, fileId = null) { token ->
            val request =
                Request.Builder()
                    .url("$apiBaseUrl/files/trash")
                    .header("Authorization", "Bearer $token")
                    .delete()
                    .build()
            httpClient.newCall(request).execute().use { response ->
                val bodyText = response.body?.string().orEmpty()
                if (!response.isSuccessful) {
                    return@executeGoverned failureResult(accountId, null, response.code, bodyText)
                }
                Result.success(Unit)
            }
        }

    override suspend fun setStarred(
        accountId: LocalAccountId,
        fileId: ProviderFileId,
        starred: Boolean,
    ): Result<Unit> {
        if (providerId == ProviderId.DROPBOX) {
            return Result.failure(
                AppErrorException(
                    AppError.Unknown("Dropbox API v2 does not support starring via file metadata", null),
                ),
            )
        }
        return patchDriveFile(accountId, fileId, buildJsonObject { put("starred", starred) }).map { }
    }

    override suspend fun download(
        accountId: LocalAccountId,
        fileId: ProviderFileId,
        destination: TransferDestination,
    ): Result<ContentSource> =
        downloadInternal(accountId = accountId, fileId = fileId, rangeHeader = null)

    override suspend fun downloadRange(
        accountId: LocalAccountId,
        fileId: ProviderFileId,
        range: ByteRange,
    ): Result<ContentSource> =
        downloadInternal(
            accountId = accountId,
            fileId = fileId,
            rangeHeader = "bytes=${range.start}-${range.endInclusive}",
        )

    override suspend fun upload(
        accountId: LocalAccountId,
        source: InputStream,
        parentFolderId: ProviderFileId?,
        name: String,
        mimeType: String,
        sizeBytes: Long?,
        onProgress: ProgressSink?,
    ): Result<CloudFile> =
        executeGoverned(accountId = accountId, fileId = parentFolderId) { token ->
            val bytes =
                if (sizeBytes == 0L) {
                    ByteArray(0)
                } else {
                    ByteArrayOutputStream().use { out ->
                        source.use { input -> input.copyTo(out) }
                        out.toByteArray()
                    }
                }
            onProgress?.onProgress(0L, bytes.size.toLong())
            val url =
                "$apiBaseUrl/files".toHttpUrl().newBuilder()
                    .addQueryParameter("fields", SINGLE_FILE_FIELDS)
                    .build()
            val request =
                Request.Builder()
                    .url(url)
                    .header("Authorization", "Bearer $token")
                    .post(bytes.toRequestBody(mimeType.toMediaType()))
                    .build()
            httpClient.newCall(request).execute().use { response ->
                val bodyText = response.body?.string().orEmpty()
                if (!response.isSuccessful) {
                    return@executeGoverned failureResult(accountId, parentFolderId, response.code, bodyText)
                }
                onProgress?.onProgress(bytes.size.toLong(), bytes.size.toLong())
                val obj = json.parseToJsonElement(bodyText).jsonObject
                Result.success(parseCloudFile(accountId, obj))
            }
        }

    override suspend fun getRevisions(
        accountId: LocalAccountId,
        fileId: ProviderFileId,
        pageToken: String?,
        pageSize: Int,
    ): Result<Page<Revision>> =
        executeGoverned(accountId = accountId, fileId = fileId) { token ->
            val urlBuilder =
                "$apiBaseUrl/files/${fileId.value}/revisions".toHttpUrl().newBuilder()
                    .addQueryParameter("pageSize", pageSize.toString())
            if (pageToken != null) {
                urlBuilder.addQueryParameter("pageToken", pageToken)
            }
            val request =
                Request.Builder()
                    .url(urlBuilder.build())
                    .header("Authorization", "Bearer $token")
                    .get()
                    .build()
            httpClient.newCall(request).execute().use { response ->
                val bodyText = response.body?.string().orEmpty()
                if (!response.isSuccessful) {
                    return@executeGoverned failureResult(accountId, fileId, response.code, bodyText)
                }
                val root = json.parseToJsonElement(bodyText).jsonObject
                val items = root["revisions"]?.jsonArray ?: JsonArray(emptyList())
                val parsed =
                    items.mapIndexedNotNull { idx, elem ->
                        val item = elem.jsonObject
                        val revId = item["id"]?.jsonPrimitive?.content ?: return@mapIndexedNotNull null
                        val modifiedStr = item["modifiedTime"]?.jsonPrimitive?.content
                        val modifiedMillis =
                            modifiedStr?.let {
                                runCatching { Instant.parse(it).toEpochMilli() }.getOrNull()
                            } ?: 0L
                        Revision(
                            fileId = fileId,
                            revisionId = revId,
                            modifiedTimeMillis = modifiedMillis,
                            sizeBytes = item["size"]?.jsonPrimitive?.longOrNull,
                            mimeType = item["mimeType"]?.jsonPrimitive?.content,
                            isCurrent = idx == items.lastIndex,
                        )
                    }
                val nextToken = root["nextPageToken"]?.jsonPrimitive?.content?.takeIf { it.isNotBlank() }
                Result.success(Page(items = parsed, nextPageToken = nextToken))
            }
        }

    override suspend fun getRevisionContent(
        accountId: LocalAccountId,
        fileId: ProviderFileId,
        revisionId: String,
    ): Result<ContentSource> =
        downloadInternal(accountId = accountId, fileId = fileId, rangeHeader = null)

    override suspend fun restoreRevision(
        accountId: LocalAccountId,
        fileId: ProviderFileId,
        revisionId: String,
    ): Result<CloudFile> =
        getFileMetadata(accountId, fileId)

    override suspend fun export(
        accountId: LocalAccountId,
        fileId: ProviderFileId,
        targetMimeType: String,
        destination: TransferDestination,
    ): Result<ContentSource> =
        executeGoverned(accountId = accountId, fileId = fileId) { token ->
            val url =
                "$apiBaseUrl/files/${fileId.value}/export".toHttpUrl().newBuilder()
                    .addQueryParameter("mimeType", targetMimeType)
                    .build()
            val request =
                Request.Builder()
                    .url(url)
                    .header("Authorization", "Bearer $token")
                    .get()
                    .build()
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

    override fun watchForChanges(accountId: LocalAccountId): Flow<Unit> = emptyFlow()

    override fun watchFile(
        accountId: LocalAccountId,
        fileId: ProviderFileId,
    ): Flow<FileChange> = emptyFlow()

    private suspend fun listFilteredFiles(
        accountId: LocalAccountId,
        filterQuery: String,
        pageToken: String?,
        pageSize: Int,
    ): Result<Page<CloudFile>> =
        executeGoverned(accountId = accountId, fileId = null) { token ->
            val urlBuilder =
                "$apiBaseUrl/files".toHttpUrl().newBuilder()
                    .addQueryParameter("q", filterQuery)
                    .addQueryParameter("pageSize", pageSize.toString())
                    .addQueryParameter("fields", DriveFields.FILE_LIST)
            if (pageToken != null) {
                urlBuilder.addQueryParameter("pageToken", pageToken)
            }
            val request =
                Request.Builder()
                    .url(urlBuilder.build())
                    .header("Authorization", "Bearer $token")
                    .get()
                    .build()
            httpClient.newCall(request).execute().use { response ->
                val bodyText = response.body?.string().orEmpty()
                if (!response.isSuccessful) {
                    return@executeGoverned failureResult(accountId, null, response.code, bodyText)
                }
                val root = json.parseToJsonElement(bodyText).jsonObject
                Result.success(parseFilePage(accountId, root))
            }
        }

    private suspend fun downloadInternal(
        accountId: LocalAccountId,
        fileId: ProviderFileId,
        rangeHeader: String?,
    ): Result<ContentSource> =
        executeGoverned(accountId = accountId, fileId = fileId) { token ->
            val url =
                "$apiBaseUrl/files/${fileId.value}".toHttpUrl().newBuilder()
                    .addQueryParameter("alt", "media")
                    .build()
            val builder =
                Request.Builder()
                    .url(url)
                    .header("Authorization", "Bearer $token")
                    .get()
            if (rangeHeader != null) {
                builder.header("Range", rangeHeader)
            }
            httpClient.newCall(builder.build()).execute().use { response ->
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

    private suspend fun patchDriveFile(
        accountId: LocalAccountId,
        fileId: ProviderFileId,
        body: JsonObject,
    ): Result<CloudFile> =
        executeGoverned(accountId = accountId, fileId = fileId) { token ->
            val url =
                "$apiBaseUrl/files/${fileId.value}".toHttpUrl().newBuilder()
                    .addQueryParameter("fields", SINGLE_FILE_FIELDS)
                    .build()
            val request =
                Request.Builder()
                    .url(url)
                    .header("Authorization", "Bearer $token")
                    .patch(body.toString().toRequestBody(JSON_MEDIA_TYPE))
                    .build()
            httpClient.newCall(request).execute().use { response ->
                val bodyText = response.body?.string().orEmpty()
                if (!response.isSuccessful) {
                    return@executeGoverned failureResult(accountId, fileId, response.code, bodyText)
                }
                val obj = json.parseToJsonElement(bodyText).jsonObject
                Result.success(parseCloudFile(accountId, obj))
            }
        }

    private suspend fun <T> executeGoverned(
        accountId: LocalAccountId,
        fileId: ProviderFileId?,
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

    private fun buildQuotaRequest(token: String): Request =
        when (providerId) {
            ProviderId.DROPBOX ->
                Request.Builder()
                    .url("$apiBaseUrl/users/get_space_usage")
                    .header("Authorization", "Bearer $token")
                    .post("null".toRequestBody(JSON_MEDIA_TYPE))
                    .build()
            ProviderId.ONE_DRIVE ->
                Request.Builder()
                    .url(apiBaseUrl)
                    .header("Authorization", "Bearer $token")
                    .get()
                    .build()
            ProviderId.BOX ->
                Request.Builder()
                    .url("$apiBaseUrl/users/me")
                    .header("Authorization", "Bearer $token")
                    .get()
                    .build()
            else -> {
                val url =
                    "$apiBaseUrl/about".toHttpUrl().newBuilder()
                        .addQueryParameter("fields", DriveFields.ABOUT)
                        .build()
                Request.Builder()
                    .url(url)
                    .header("Authorization", "Bearer $token")
                    .get()
                    .build()
            }
        }

    private fun buildListRequest(
        token: String,
        query: FileQuery,
    ): Request {
        val parentClause =
            if (query.parentFolderId != null) {
                "'${query.parentFolderId?.value}' in parents"
            } else {
                "'root' in parents"
            }
        val urlBuilder =
            "$apiBaseUrl/files".toHttpUrl().newBuilder()
                .addQueryParameter("q", "$parentClause and trashed = false")
                .addQueryParameter("corpora", DriveFields.CORPORA_USER)
                .addQueryParameter("spaces", DriveFields.SPACES_DRIVE)
                .addQueryParameter("pageSize", query.pageSize.toString())
                .addQueryParameter("fields", DriveFields.FILE_LIST)
        query.pageToken?.let { urlBuilder.addQueryParameter("pageToken", it) }
        return Request.Builder()
            .url(urlBuilder.build())
            .header("Authorization", "Bearer $token")
            .get()
            .build()
    }

    private fun buildSearchRequest(
        token: String,
        query: SearchQuery,
    ): Request {
        val escapedName = query.text.replace("'", "\\'")
        val urlBuilder =
            "$apiBaseUrl/files".toHttpUrl().newBuilder()
                .addQueryParameter("q", "name contains '$escapedName' and trashed = false")
                .addQueryParameter("corpora", DriveFields.CORPORA_USER)
                .addQueryParameter("spaces", DriveFields.SPACES_DRIVE)
                .addQueryParameter("pageSize", query.pageSize.toString())
                .addQueryParameter("fields", DriveFields.FILE_LIST)
        query.pageToken?.let { urlBuilder.addQueryParameter("pageToken", it) }
        return Request.Builder()
            .url(urlBuilder.build())
            .header("Authorization", "Bearer $token")
            .get()
            .build()
    }

    private fun parseQuotaResponse(root: JsonObject): QuotaUsage {
        val storageQuota = root["storageQuota"]?.jsonObject ?: root["quota"]?.jsonObject
        val used =
            storageQuota?.get("usage")?.jsonPrimitive?.longOrNull
                ?: storageQuota?.get("used")?.jsonPrimitive?.longOrNull
                ?: root["used"]?.jsonPrimitive?.longOrNull
                ?: 0L
        val limit =
            storageQuota?.get("limit")?.jsonPrimitive?.longOrNull
                ?: storageQuota?.get("total")?.jsonPrimitive?.longOrNull
                ?: root["space_amount"]?.jsonPrimitive?.longOrNull
        return QuotaUsage(
            providerId = providerId,
            usedBytes = used.coerceAtLeast(0L),
            limitBytes = limit?.takeIf { it > 0L },
            manageUrl = null,
        )
    }

    private fun parseFilePage(
        accountId: LocalAccountId,
        root: JsonObject,
    ): Page<CloudFile> {
        val array =
            root["files"]?.jsonArray
                ?: root["value"]?.jsonArray
                ?: root["entries"]?.jsonArray
                ?: JsonArray(emptyList())
        val items = array.map { elem -> parseCloudFile(accountId, elem.jsonObject) }
        val nextToken =
            root["nextPageToken"]?.jsonPrimitive?.content?.takeIf { it.isNotBlank() }
        return Page(items = items, nextPageToken = nextToken)
    }

    private fun parseCloudFile(
        accountId: LocalAccountId,
        obj: JsonObject,
    ): CloudFile {
        val id = obj["id"]?.jsonPrimitive?.content ?: "unknown"
        val name = obj["name"]?.jsonPrimitive?.content?.takeIf { it.isNotEmpty() } ?: "Untitled"
        val mimeType =
            obj["mimeType"]?.jsonPrimitive?.content
                ?: if (obj["folder"] != null || obj[".tag"]?.jsonPrimitive?.content == "folder") {
                    FOLDER_MIME_TYPE
                } else {
                    "application/octet-stream"
                }
        val isFolder = mimeType == FOLDER_MIME_TYPE
        val sizeBytes = if (isFolder) null else obj["size"]?.jsonPrimitive?.longOrNull
        val modifiedStr =
            obj["modifiedTime"]?.jsonPrimitive?.content
                ?: obj["lastModifiedDateTime"]?.jsonPrimitive?.content
                ?: obj["server_modified"]?.jsonPrimitive?.content
        val modifiedMillis =
            modifiedStr?.let {
                runCatching { Instant.parse(it).toEpochMilli() }.getOrNull()
            }
        val parents = obj["parents"]?.jsonArray
        val parentId =
            parents?.firstOrNull()?.jsonPrimitive?.content?.takeIf { it.isNotBlank() }?.let {
                ProviderFileId(it)
            }
        return CloudFile(
            ref =
                FileRef(
                    provider = providerId,
                    accountId = accountId,
                    fileId = ProviderFileId(id),
                ),
            name = name,
            mimeType = mimeType,
            sizeBytes = sizeBytes,
            modifiedTimeMillis = modifiedMillis,
            isFolder = isFolder,
            parentFolderId = parentId,
            isShared = obj["shared"]?.jsonPrimitive?.booleanOrNull ?: false,
            isOwnedByUser = obj["ownedByMe"]?.jsonPrimitive?.booleanOrNull ?: true,
            isStarred = obj["starred"]?.jsonPrimitive?.booleanOrNull ?: false,
            isTrashed = obj["trashed"]?.jsonPrimitive?.booleanOrNull ?: false,
            webViewLink =
                obj["webViewLink"]?.jsonPrimitive?.content
                    ?: obj["webUrl"]?.jsonPrimitive?.content,
            thumbnailLink = obj["thumbnailLink"]?.jsonPrimitive?.content,
        )
    }

    companion object {
        private const val FOLDER_MIME_TYPE = "application/vnd.google-apps.folder"
        private const val SINGLE_FILE_FIELDS =
            "id,name,mimeType,size,modifiedTime,thumbnailLink,webViewLink,parents,trashed,starred,ownedByMe"
        private val JSON_MEDIA_TYPE = "application/json; charset=utf-8".toMediaType()
    }
}
