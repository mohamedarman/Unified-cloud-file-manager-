package com.unifiedcloud.filemanager.domain.repository

import com.unifiedcloud.filemanager.domain.error.AppError
import com.unifiedcloud.filemanager.domain.model.AccountRef
import com.unifiedcloud.filemanager.domain.model.CloudFile
import com.unifiedcloud.filemanager.domain.model.FileQuery
import com.unifiedcloud.filemanager.domain.model.FileRef
import com.unifiedcloud.filemanager.domain.model.Freshness
import com.unifiedcloud.filemanager.domain.model.LocalAccountId
import com.unifiedcloud.filemanager.domain.model.Page
import com.unifiedcloud.filemanager.domain.model.ProgressSink
import com.unifiedcloud.filemanager.domain.model.ProviderCapabilities
import com.unifiedcloud.filemanager.domain.model.ProviderFileId
import com.unifiedcloud.filemanager.domain.model.QuotaUsage
import com.unifiedcloud.filemanager.domain.model.SearchQuery
import com.unifiedcloud.filemanager.domain.model.SearchResultPage
import com.unifiedcloud.filemanager.domain.model.TransferDestination
import com.unifiedcloud.filemanager.domain.model.TransferState
import kotlinx.coroutines.flow.Flow
import java.io.InputStream

/**
 * Repositories are what the presentation layer talks to. They are not thin
 * pass-throughs: each one owns a caching, pagination, or account-isolation
 * policy that the UI should not have to know about.
 *
 * All of them are account-scoped in the same way [com.unifiedcloud.filemanager.domain.provider.CloudProvider]
 * is - no ambient account, no optional account id (I-1).
 *
 * Implementations live in `:data` and may touch Room, DataStore, and the
 * provider. Implementations must not expose Android or Room types through these
 * signatures (Rules.md L-3).
 */

interface AccountRepository {
    /** Emits the current set of connected accounts. Never a "current" account. */
    fun observeAccounts(): Flow<List<AccountRef>>

    suspend fun getAccount(accountId: LocalAccountId): Result<AccountRef>

    /**
     * Registers a newly connected account and assigns it a local id.
     *
     * Idempotent on the provider's account identifier: reconnecting an account
     * already connected returns the existing local id rather than creating a
     * duplicate, so a user's data does not fork into two half-populated accounts.
     */
    suspend fun addAccount(
        providerAccountId: String,
        displayEmail: String?,
    ): Result<LocalAccountId>

    /**
     * Removes the account and its local state.
     *
     * Does NOT delete anything in the provider. The user connected their own
     * Drive; disconnecting us must not imply anything about their files.
     */
    suspend fun removeAccount(accountId: LocalAccountId): Result<Unit>
}

interface FileRepository {
    /**
     * Cached-then-fresh listing.
     *
     * Emits the cached page immediately with [Freshness.STALE] when one exists,
     * then emits again once the provider answers. Emitting fast and correcting
     * later is deliberate: a spinner on every navigation is worse than a brief
     * stale list, and the freshness flag lets the UI say which it is showing.
     */
    fun observeFiles(query: FileQuery): Flow<FileListState>

    suspend fun getFile(ref: FileRef): Result<CloudFile>

    suspend fun getRecentFiles(
        accountId: LocalAccountId,
        limit: Int = 50,
    ): Result<List<CloudFile>>

    suspend fun getStarredFiles(accountId: LocalAccountId): Result<Page<CloudFile>>

    suspend fun getSharedWithMe(accountId: LocalAccountId): Result<Page<CloudFile>>

    suspend fun getSharedByMe(accountId: LocalAccountId): Result<Page<CloudFile>>

    /**
     * Account-scoped search.
     *
     * Results may be [com.unifiedcloud.filemanager.domain.model.Completeness.PARTIAL];
     * the UI must convey that rather than implying an exhaustive answer.
     */
    suspend fun search(query: SearchQuery): Result<SearchResultPage>

    // Mutations return the affected file where one exists, so the UI can update
    // from the provider's own result instead of a guess.
    suspend fun createFolder(
        accountId: LocalAccountId,
        parentFolderId: ProviderFileId?,
        name: String,
    ): Result<CloudFile>

    suspend fun rename(
        ref: FileRef,
        newName: String,
    ): Result<CloudFile>

    suspend fun trash(ref: FileRef): Result<Unit>

    suspend fun restore(ref: FileRef): Result<Unit>

    suspend fun deletePermanently(ref: FileRef): Result<Unit>

    suspend fun emptyTrash(accountId: LocalAccountId): Result<Unit>

    suspend fun setStarred(
        ref: FileRef,
        starred: Boolean,
    ): Result<Unit>

    /**
     * Capabilities for an account, cached with the credential.
     *
     * Cheap to call, because the UI is expected to call it before showing any
     * capability-dependent affordance (PC-1, PC-4).
     */
    suspend fun getCapabilities(accountId: LocalAccountId): Result<ProviderCapabilities>

    suspend fun getQuotaInfo(accountId: LocalAccountId): Result<QuotaUsage>
}

/** Listing state, carrying freshness so the UI never has to guess. */
sealed interface FileListState {
    data object Loading : FileListState

    data class Loaded(
        val files: List<CloudFile>,
        val nextPageToken: String?,
        val freshness: Freshness,
    ) : FileListState

    data class Failed(val error: AppError) : FileListState
}

interface TransferRepository {
    /**
     * Every transfer in flight or recent, across all accounts, tagged by account
     * so the UI can filter without re-deriving ownership.
     */
    fun observeTransfers(): Flow<List<TransferState>>

    fun observeTransfersForAccount(accountId: LocalAccountId): Flow<List<TransferState>>

    suspend fun download(
        ref: FileRef,
        destination: TransferDestination,
        onProgress: ProgressSink? = null,
    ): Result<TransferState>

    suspend fun upload(
        accountId: LocalAccountId,
        source: InputStream,
        parentFolderId: ProviderFileId?,
        name: String,
        mimeType: String,
        onProgress: ProgressSink? = null,
    ): Result<TransferState>

    /**
     * Pause. The destination must retain partial bytes and enough state to
     * resume, or the transfer is restated to the caller as a fresh one.
     */
    suspend fun pause(transferId: String): Result<Unit>

    suspend fun resume(transferId: String): Result<Unit>

    suspend fun cancel(transferId: String): Result<Unit>
}
