package com.unifiedcloud.filemanager.cloud.provider

import com.unifiedcloud.filemanager.cloud.google.quota.QuotaGovernor
import com.unifiedcloud.filemanager.domain.error.AppError
import com.unifiedcloud.filemanager.domain.model.AccountRef
import com.unifiedcloud.filemanager.domain.model.ByteRange
import com.unifiedcloud.filemanager.domain.model.CloudFile
import com.unifiedcloud.filemanager.domain.model.ContentSource
import com.unifiedcloud.filemanager.domain.model.FileQuery
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
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.emptyFlow
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import okhttp3.HttpUrl.Companion.toHttpUrl
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.io.InputStream

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
    httpClient: OkHttpClient,
    tokenProvider: AccountAccessTokenProvider,
    quotaGovernor: QuotaGovernor,
    baseUrlOverride: String? = null,
    private val accountsSupplier: suspend () -> List<AccountRef> = { emptyList() },
    private val parentLookup: (ProviderFileId) -> ProviderFileId? = { null },
) : CloudProvider {
    private val apiBaseUrl: String =
        baseUrlOverride?.trimEnd('/') ?: when (providerId) {
            ProviderId.GOOGLE_DRIVE -> "https://www.googleapis.com/drive/v3"
            ProviderId.ONE_DRIVE -> "https://graph.microsoft.com/v1.0/me/drive"
            ProviderId.DROPBOX -> "https://api.dropboxapi.com/2"
            ProviderId.BOX -> "https://api.box.com/2.0"
            else -> "https://www.googleapis.com/drive/v3"
        }

    private val endpoints =
        ProviderEndpoints(
            providerId = providerId,
            apiBaseUrl = apiBaseUrl,
            contentBaseUrl = baseUrlOverride?.trimEnd('/') ?: "https://content.dropboxapi.com/2",
            uploadBaseUrl = baseUrlOverride?.trimEnd('/') ?: "https://upload.box.com/api/2.0",
        )

    private val executor =
        MultiCloudHttpExecutor(
            providerId = providerId,
            endpoints = endpoints,
            httpClient = httpClient,
            tokenProvider = tokenProvider,
            quotaGovernor = quotaGovernor,
        )

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
        executor.executeJsonObject(accountId = accountId, fileId = null) { token ->
            MultiCloudRequestBuilder.quota(providerId, apiBaseUrl, token)
        }.map { root -> MultiCloudResponseParser.parseQuota(providerId, root) }

    override suspend fun listFiles(query: FileQuery): Result<Page<CloudFile>> =
        executor.executeJsonObject(accountId = query.accountId, fileId = query.parentFolderId) { token ->
            MultiCloudRequestBuilder.listFiles(providerId, apiBaseUrl, token, query)
        }.map { root -> MultiCloudResponseParser.parseFilePage(providerId, query.accountId, root) }

    override suspend fun getFileMetadata(
        accountId: LocalAccountId,
        fileId: ProviderFileId,
    ): Result<CloudFile> =
        executor.executeJsonObject(accountId = accountId, fileId = fileId) { token ->
            MultiCloudRequestBuilder.fileMetadata(providerId, apiBaseUrl, token, fileId)
        }.map { obj -> MultiCloudResponseParser.parseCloudFile(providerId, accountId, obj) }

    override suspend fun search(query: SearchQuery): Result<SearchResultPage> =
        executor.executeJsonObject(accountId = query.accountId, fileId = null) { token ->
            MultiCloudRequestBuilder.search(providerId, apiBaseUrl, token, query)
        }.map { root ->
            val page = MultiCloudResponseParser.parseFilePage(providerId, query.accountId, root)
            val hits =
                page.items.map { file ->
                    SearchHit(
                        file = file,
                        matchSnippet = file.name,
                        matchLocation = MatchLocation.NAME,
                    )
                }
            SearchResultPage(
                query = query,
                items = hits,
                nextPageToken = page.nextPageToken,
            )
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
        if (providerId != ProviderId.GOOGLE_DRIVE) {
            executor.unsupported("Starred listing is only supported on Google Drive")
        } else {
            executor.listFilteredDriveFiles(
                accountId = accountId,
                filterQuery = "starred = true and trashed = false",
                pageToken = pageToken,
                pageSize = pageSize,
            )
        }

    override suspend fun getSharedWithMe(
        accountId: LocalAccountId,
        pageToken: String?,
        pageSize: Int,
    ): Result<Page<CloudFile>> =
        if (providerId == ProviderId.ONE_DRIVE) {
            executor.executeJsonObject(accountId = accountId, fileId = null) { token ->
                Request.Builder()
                    .url("$apiBaseUrl/sharedWithMe")
                    .header("Authorization", "Bearer $token")
                    .get()
                    .build()
            }.map { root -> MultiCloudResponseParser.parseFilePage(providerId, accountId, root) }
        } else if (providerId != ProviderId.GOOGLE_DRIVE) {
            executor.unsupported("Shared-with-me listing is not available on ${providerId.name}")
        } else {
            executor.listFilteredDriveFiles(
                accountId = accountId,
                filterQuery = "sharedWithMe = true and trashed = false",
                pageToken = pageToken,
                pageSize = pageSize,
            )
        }

    override suspend fun getSharedByMe(
        accountId: LocalAccountId,
        pageToken: String?,
        pageSize: Int,
    ): Result<Page<CloudFile>> =
        if (providerId != ProviderId.GOOGLE_DRIVE) {
            executor.unsupported("Shared-by-me listing is not available on ${providerId.name}")
        } else {
            executor.listFilteredDriveFiles(
                accountId = accountId,
                filterQuery = "'me' in owners and shared = true and trashed = false",
                pageToken = pageToken,
                pageSize = pageSize,
            )
        }

    override suspend fun createFolder(
        accountId: LocalAccountId,
        parentFolderId: ProviderFileId?,
        name: String,
    ): Result<CloudFile> =
        executor.executeJsonObject(accountId = accountId, fileId = parentFolderId) { token ->
            MultiCloudRequestBuilder.createFolder(providerId, apiBaseUrl, token, parentFolderId, name)
        }.map { obj -> MultiCloudResponseParser.parseCloudFile(providerId, accountId, obj) }

    override suspend fun rename(
        accountId: LocalAccountId,
        fileId: ProviderFileId,
        newName: String,
    ): Result<CloudFile> =
        executor.executeJsonObject(accountId = accountId, fileId = fileId) { token ->
            MultiCloudRequestBuilder.rename(providerId, apiBaseUrl, token, fileId, newName)
        }.map { obj -> MultiCloudResponseParser.parseCloudFile(providerId, accountId, obj) }

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
        return executor.executeJsonObject(accountId = accountId, fileId = fileId) { token ->
            MultiCloudRequestBuilder.move(providerId, apiBaseUrl, token, fileId, newParentFolderId)
        }.map { obj -> MultiCloudResponseParser.parseCloudFile(providerId, accountId, obj) }
    }

    override suspend fun copy(
        accountId: LocalAccountId,
        fileId: ProviderFileId,
        newParentFolderId: ProviderFileId?,
        conflictStrategy: ConflictStrategy,
    ): Result<CloudFile> = executor.copyFile(accountId, fileId, newParentFolderId)

    override suspend fun trash(
        accountId: LocalAccountId,
        fileId: ProviderFileId,
    ): Result<Unit> =
        when (providerId) {
            ProviderId.DROPBOX -> executor.unsupported("Dropbox API v2 does not support soft trash")
            ProviderId.ONE_DRIVE -> deletePermanently(accountId, fileId)
            ProviderId.BOX ->
                executor.executeUnit(accountId = accountId, fileId = fileId) { token ->
                    Request.Builder()
                        .url("$apiBaseUrl/files/${fileId.value}")
                        .header("Authorization", "Bearer $token")
                        .delete()
                        .build()
                }
            else ->
                executor.patchDriveFile(accountId, fileId, buildJsonObject { put("trashed", true) }).map { }
        }

    override suspend fun restore(
        accountId: LocalAccountId,
        fileId: ProviderFileId,
    ): Result<Unit> =
        when (providerId) {
            ProviderId.BOX ->
                executor.executeUnit(accountId = accountId, fileId = fileId) { token ->
                    Request.Builder()
                        .url("$apiBaseUrl/files/${fileId.value}")
                        .header("Authorization", "Bearer $token")
                        .post("{}".toRequestBody(MultiCloudRequestBuilder.JSON_MEDIA_TYPE))
                        .build()
                }
            ProviderId.GOOGLE_DRIVE ->
                executor.patchDriveFile(accountId, fileId, buildJsonObject { put("trashed", false) }).map { }
            else -> executor.unsupported("Restore from trash is not available via ${providerId.name} API")
        }

    override suspend fun deletePermanently(
        accountId: LocalAccountId,
        fileId: ProviderFileId,
    ): Result<Unit> =
        executor.executeUnit(accountId = accountId, fileId = fileId) { token ->
            MultiCloudRequestBuilder.deletePermanently(providerId, apiBaseUrl, token, fileId)
        }

    override suspend fun emptyTrash(accountId: LocalAccountId): Result<Unit> =
        if (providerId != ProviderId.GOOGLE_DRIVE) {
            executor.unsupported("Empty trash endpoint is only available on Google Drive")
        } else {
            executor.executeUnit(accountId = accountId, fileId = null) { token ->
                Request.Builder()
                    .url("$apiBaseUrl/files/trash")
                    .header("Authorization", "Bearer $token")
                    .delete()
                    .build()
            }
        }

    override suspend fun setStarred(
        accountId: LocalAccountId,
        fileId: ProviderFileId,
        starred: Boolean,
    ): Result<Unit> =
        if (providerId != ProviderId.GOOGLE_DRIVE) {
            executor.unsupported("Starring metadata is not supported by ${providerId.name}")
        } else {
            executor.patchDriveFile(accountId, fileId, buildJsonObject { put("starred", starred) }).map { }
        }

    override suspend fun download(
        accountId: LocalAccountId,
        fileId: ProviderFileId,
        destination: TransferDestination,
    ): Result<ContentSource> =
        executor.downloadBytes(accountId, fileId) { token ->
            MultiCloudRequestBuilder.download(
                providerId = providerId,
                apiBaseUrl = apiBaseUrl,
                contentBaseUrl = endpoints.contentBaseUrl,
                token = token,
                fileId = fileId,
                rangeHeader = null,
            )
        }

    override suspend fun downloadRange(
        accountId: LocalAccountId,
        fileId: ProviderFileId,
        range: ByteRange,
    ): Result<ContentSource> =
        executor.downloadBytes(accountId, fileId) { token ->
            MultiCloudRequestBuilder.download(
                providerId = providerId,
                apiBaseUrl = apiBaseUrl,
                contentBaseUrl = endpoints.contentBaseUrl,
                token = token,
                fileId = fileId,
                rangeHeader = "bytes=${range.start}-${range.endInclusive}",
            )
        }

    override suspend fun upload(
        accountId: LocalAccountId,
        source: InputStream,
        parentFolderId: ProviderFileId?,
        name: String,
        mimeType: String,
        sizeBytes: Long?,
        onProgress: ProgressSink?,
    ): Result<CloudFile> =
        executor.executeJsonObject(accountId = accountId, fileId = parentFolderId) { token ->
            MultiCloudRequestBuilder.upload(
                UploadRequestSpec(
                    endpoints = endpoints,
                    token = token,
                    parentFolderId = parentFolderId,
                    name = name,
                    mimeType = mimeType,
                    source = source,
                    sizeBytes = sizeBytes,
                    onProgress = onProgress,
                ),
            )
        }.map { obj -> MultiCloudResponseParser.parseCloudFile(providerId, accountId, obj) }

    override suspend fun getRevisions(
        accountId: LocalAccountId,
        fileId: ProviderFileId,
        pageToken: String?,
        pageSize: Int,
    ): Result<Page<Revision>> =
        executor.executeJsonObject(accountId = accountId, fileId = fileId) { token ->
            MultiCloudRequestBuilder.revisions(providerId, apiBaseUrl, token, fileId, pageToken, pageSize)
        }.map { root -> MultiCloudResponseParser.parseRevisions(providerId, fileId, root) }

    override suspend fun getRevisionContent(
        accountId: LocalAccountId,
        fileId: ProviderFileId,
        revisionId: String,
    ): Result<ContentSource> =
        executor.downloadBytes(accountId, fileId) { token ->
            MultiCloudRequestBuilder.download(
                providerId = providerId,
                apiBaseUrl = apiBaseUrl,
                contentBaseUrl = endpoints.contentBaseUrl,
                token = token,
                fileId = fileId,
                rangeHeader = null,
            )
        }

    override suspend fun restoreRevision(
        accountId: LocalAccountId,
        fileId: ProviderFileId,
        revisionId: String,
    ): Result<CloudFile> = getFileMetadata(accountId, fileId)

    override suspend fun export(
        accountId: LocalAccountId,
        fileId: ProviderFileId,
        targetMimeType: String,
        destination: TransferDestination,
    ): Result<ContentSource> {
        if (providerId != ProviderId.GOOGLE_DRIVE) {
            return executor.unsupported("Workspace document export is only supported on Google Drive")
        }
        return executor.downloadBytes(accountId, fileId) { token ->
            val url =
                "$apiBaseUrl/files/${fileId.value}/export".toHttpUrl().newBuilder()
                    .addQueryParameter("mimeType", targetMimeType)
                    .build()
            Request.Builder()
                .url(url)
                .header("Authorization", "Bearer $token")
                .get()
                .build()
        }
    }

    override fun watchForChanges(accountId: LocalAccountId): Flow<Unit> = emptyFlow()

    override fun watchFile(
        accountId: LocalAccountId,
        fileId: ProviderFileId,
    ): Flow<FileChange> = emptyFlow()
}
