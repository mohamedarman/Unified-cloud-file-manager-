package com.unifiedcloud.filemanager.domain.provider

import com.unifiedcloud.filemanager.domain.model.AccountRef
import com.unifiedcloud.filemanager.domain.model.ByteRange
import com.unifiedcloud.filemanager.domain.model.CloudFile
import com.unifiedcloud.filemanager.domain.model.ContentSource
import com.unifiedcloud.filemanager.domain.model.FileQuery
import com.unifiedcloud.filemanager.domain.model.LocalAccountId
import com.unifiedcloud.filemanager.domain.model.Page
import com.unifiedcloud.filemanager.domain.model.ProgressSink
import com.unifiedcloud.filemanager.domain.model.ProviderCapabilities
import com.unifiedcloud.filemanager.domain.model.ProviderFileId
import com.unifiedcloud.filemanager.domain.model.QuotaUsage
import com.unifiedcloud.filemanager.domain.model.Revision
import com.unifiedcloud.filemanager.domain.model.SearchQuery
import com.unifiedcloud.filemanager.domain.model.SearchResultPage
import com.unifiedcloud.filemanager.domain.model.TransferDestination
import kotlinx.coroutines.flow.Flow

/**
 * The entire provider surface. There is exactly one implementation, Google
 * Drive (Architecture.md §6.1, Rules.md §33).
 *
 * No second provider may be stubbed, faked, or anticipated (FP-1). The interface
 * exists so the app depends on an abstraction rather than on Google's SDK - not
 * as an invitation to add providers later.
 *
 * ## Why every method takes an [LocalAccountId]
 *
 * There is no ambient current account anywhere in this interface, and there
 * cannot be one: every operation that touches a file names the account it
 * belongs to. This is the primary defence against the failure this product is
 * most likely to ship - data from account A appearing under account B's session
 * (I-1, I-2). It is enforced by the shape of the signature rather than by
 * convention, so no call site can forget it.
 *
 * The account id is *ours*, assigned at connect time. It is never a Google
 * account id or an email address (FI-06).
 *
 * ## Failure
 *
 * Every method returns `Result` and every failure is an `AppError`. No
 * provider-specific exception type escapes this interface, so the UI never
 * imports anything from `:cloud` and a change in Google's error surface does not
 * ripple outward. (`AppError` is named here in prose rather than imported,
 * because this interface mentions it in documentation only, and an import used
 * solely by KDoc is a warning under `allWarningsAsErrors`.)
 *
 * ## Cancellation
 *
 * All methods are `suspend` and must be cancellation-cooperative. A cancelled
 * operation returns `Result.failure(AppError.Cancelled)` or throws
 * `CancellationException`; it must not leave a partial state visible as success.
 */
interface CloudProvider {

    // -----------------------------------------------------------------------
    // Account and capability discovery
    // -----------------------------------------------------------------------

    /**
     * Accounts currently connected on this device.
     *
     * Local state, not a provider call. Present so the UI can render an account
     * switcher without reaching into `:data`.
     */
    suspend fun listAccounts(): Result<List<AccountRef>>

    /**
     * Feature support for this account's credential.
     *
     * Called after connect and after any scope change, and consulted by the UI
     * before showing any capability-dependent affordance. Callers should treat
     * [ProviderCapabilities.UNKNOWN] as "not yet known" and re-query rather than
     * assuming either answer (PC-1, PC-4).
     */
    suspend fun getCapabilities(accountId: LocalAccountId): Result<ProviderCapabilities>

    /**
     * The account's own provider storage usage.
     *
     * This reports the quota Google assigns to the account. It is displayed as
     * the account's Drive usage and must never be presented as capacity this app
     * grants, extends, or sells (Rules.md §1, PS-1).
     */
    suspend fun getQuotaInfo(accountId: LocalAccountId): Result<QuotaUsage>

    // -----------------------------------------------------------------------
    // Read
    // -----------------------------------------------------------------------

    suspend fun listFiles(query: FileQuery): Result<Page<CloudFile>>

    suspend fun getFileMetadata(accountId: LocalAccountId, fileId: ProviderFileId): Result<CloudFile>

    suspend fun search(query: SearchQuery): Result<SearchResultPage>

    /** Recently modified files across the whole account, not one folder. */
    suspend fun getRecentFiles(
        accountId: LocalAccountId,
        limit: Int = 50,
    ): Result<List<CloudFile>>

    suspend fun getStarredFiles(
        accountId: LocalAccountId,
        pageToken: String? = null,
        pageSize: Int = 50,
    ): Result<Page<CloudFile>>

    suspend fun getSharedWithMe(
        accountId: LocalAccountId,
        pageToken: String? = null,
        pageSize: Int = 50,
    ): Result<Page<CloudFile>>

    suspend fun getSharedByMe(
        accountId: LocalAccountId,
        pageToken: String? = null,
        pageSize: Int = 50,
    ): Result<Page<CloudFile>>

    // -----------------------------------------------------------------------
    // Write
    //
    // Each of these requires a credential with write scope. When the credential
    // lacks it the result is AppError.Unauthorized(SCOPE_INSUFFICIENT) rather
    // than a provider exception, so the UI can explain the scope difference
    // (PC-3). Callers may short-circuit on capabilities, but must still handle
    // this error: capabilities are a cache, not a guarantee.
    // -----------------------------------------------------------------------

    suspend fun createFolder(
        accountId: LocalAccountId,
        parentFolderId: ProviderFileId?,
        name: String,
    ): Result<CloudFile>

    suspend fun rename(
        accountId: LocalAccountId,
        fileId: ProviderFileId,
        newName: String,
    ): Result<CloudFile>

    suspend fun move(
        accountId: LocalAccountId,
        fileId: ProviderFileId,
        newParentFolderId: ProviderFileId?,
        /** Optional conflict behaviour; the default keeps both. */
        conflictStrategy: ConflictStrategy = ConflictStrategy.KEEP_BOTH,
    ): Result<CloudFile>

    suspend fun copy(
        accountId: LocalAccountId,
        fileId: ProviderFileId,
        newParentFolderId: ProviderFileId?,
        conflictStrategy: ConflictStrategy = ConflictStrategy.KEEP_BOTH,
    ): Result<CloudFile>

    suspend fun trash(accountId: LocalAccountId, fileId: ProviderFileId): Result<Unit>

    suspend fun restore(accountId: LocalAccountId, fileId: ProviderFileId): Result<Unit>

    /**
     * Permanent deletion. Irreversible; the UI must confirm and must state that
     * it cannot be undone.
     */
    suspend fun deletePermanently(accountId: LocalAccountId, fileId: ProviderFileId): Result<Unit>

    suspend fun emptyTrash(accountId: LocalAccountId): Result<Unit>

    suspend fun setStarred(
        accountId: LocalAccountId,
        fileId: ProviderFileId,
        starred: Boolean,
    ): Result<Unit>

    // -----------------------------------------------------------------------
    // Content
    //
    // These move bytes directly between the provider and the device. The app is
    // a management layer and never a proxy: it does not cache file contents for
    // re-serving, and it does not expose them through any other channel
    // (Rules.md §2, X-1).
    // -----------------------------------------------------------------------

    /**
     * Opens the file's bytes.
     *
     * The caller owns [ContentSource] and must close it. A non-null
     * [ContentSource.lengthBytes] is required for resume to be possible;
     * without it the engine downloads from zero.
     */
    suspend fun download(
        accountId: LocalAccountId,
        fileId: ProviderFileId,
        destination: TransferDestination,
    ): Result<ContentSource>

    /** Partial read. Fails rather than silently returning the whole file. */
    suspend fun downloadRange(
        accountId: LocalAccountId,
        fileId: ProviderFileId,
        range: ByteRange,
    ): Result<ContentSource>

    suspend fun upload(
        accountId: LocalAccountId,
        source: java.io.InputStream,
        parentFolderId: ProviderFileId?,
        name: String,
        mimeType: String,
        sizeBytes: Long?,
        onProgress: ProgressSink? = null,
    ): Result<CloudFile>

    // -----------------------------------------------------------------------
    // Revisions
    // -----------------------------------------------------------------------

    suspend fun getRevisions(
        accountId: LocalAccountId,
        fileId: ProviderFileId,
        pageToken: String? = null,
        pageSize: Int = 50,
    ): Result<Page<Revision>>

    suspend fun getRevisionContent(
        accountId: LocalAccountId,
        fileId: ProviderFileId,
        revisionId: String,
    ): Result<ContentSource>

    suspend fun restoreRevision(
        accountId: LocalAccountId,
        fileId: ProviderFileId,
        revisionId: String,
    ): Result<CloudFile>

    /**
     * Export a Google-native document to a portable format.
     *
     * This is a Google export, not a download. The result is a conversion, and
     * the UI must not present it as the original (Architecture.md §6.1).
     */
    suspend fun export(
        accountId: LocalAccountId,
        fileId: ProviderFileId,
        targetMimeType: String,
        destination: TransferDestination,
    ): Result<ContentSource>

    // -----------------------------------------------------------------------
    // Change notification
    // -----------------------------------------------------------------------

    /**
     * Emits when anything in the account may have changed, so caches can
     * revalidate.
     *
     * Best-effort and coalescing. A missed emission costs a stale read, never
     * incorrect data - so the implementation may drop notifications under load
     * rather than queueing without bound.
     */
    fun watchForChanges(accountId: LocalAccountId): Flow<Unit>

    /** Account-scoped watch for one file. Same best-effort contract. */
    fun watchFile(accountId: LocalAccountId, fileId: ProviderFileId): Flow<FileChange>
}

enum class ConflictStrategy {
    KEEP_BOTH,
    REPLACE,
    RENAME,
    FAIL,
}

sealed interface FileChange {
    data object Modified : FileChange
    data object Trashed : FileChange
    data object Restored : FileChange
    data object Deleted : FileChange
    data class Renamed(val newName: String) : FileChange
    data class Moved(val newParentFolderId: ProviderFileId?) : FileChange
    data class Replaced(val newFileId: ProviderFileId) : FileChange
}
