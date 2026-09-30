package com.unifiedcloud.filemanager.domain.usecase

import com.unifiedcloud.filemanager.domain.model.CloudFile
import com.unifiedcloud.filemanager.domain.model.Feature
import com.unifiedcloud.filemanager.domain.model.FileRef
import com.unifiedcloud.filemanager.domain.model.LocalAccountId
import com.unifiedcloud.filemanager.domain.model.ProviderCapabilities
import com.unifiedcloud.filemanager.domain.model.ProviderFileId
import com.unifiedcloud.filemanager.domain.model.ProviderId
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * The action matrix is the mechanism behind "never show a control that will
 * fail" (PC-1, PC-4), so it is asserted exhaustively rather than by example.
 * A regression here is a user-visible dead button or, worse, a live button that
 * errors.
 */
class ResolveFileActionsTest {
    private val accountId = LocalAccountId(1)

    private fun file(
        name: String = "doc",
        mimeType: String = "text/plain",
        isFolder: Boolean = false,
        owned: Boolean = true,
        trashed: Boolean = false,
    ) = CloudFile(
        ref =
            FileRef(
                provider = ProviderId.GOOGLE_DRIVE,
                accountId = accountId,
                fileId = ProviderFileId("file-1"),
            ),
        name = name,
        mimeType = mimeType,
        sizeBytes = if (isFolder) null else 1024,
        modifiedTimeMillis = 1_700_000_000_000,
        isFolder = isFolder,
        parentFolderId = null,
        isShared = !owned,
        isOwnedByUser = owned,
        isTrashed = trashed,
    )

    private fun availability(
        f: CloudFile,
        c: ProviderCapabilities,
        action: FileAction,
    ) = ResolveFileActions.resolve(f, c).first { it.action == action }

    // -----------------------------------------------------------------------

    @Test
    fun `unknown capabilities make every capability-gated action unavailable`() {
        val actions = ResolveFileActions.resolve(file(), ProviderCapabilities.UNKNOWN)

        // Open is gated on read; everything is gated on something.
        assertTrue(actions.none { it.available })
    }

    @Test
    fun `unavailable actions always carry a reason`() {
        val actions = ResolveFileActions.resolve(file(), ProviderCapabilities.UNKNOWN)

        actions.forEach { a ->
            assertFalse("${a.action} unavailable without a reason", a.available)
            assertTrue("${a.action} missing reason", a.reason != null)
        }
    }

    @Test
    fun `read-only credential allows download but not rename`() {
        val f = file()
        val c = ProviderCapabilities.READ_ONLY

        assertTrue(availability(f, c, FileAction.DOWNLOAD).available)
        assertTrue(availability(f, c, FileAction.OPEN).available)

        assertFalse(availability(f, c, FileAction.RENAME).available)
        assertFalse(availability(f, c, FileAction.TRASH).available)
    }

    @Test
    fun `rename is refused for a file the user does not own even with write scope`() {
        val c = fullWrite()
        val f = file(owned = false)

        val rename = availability(f, c, FileAction.RENAME)

        assertFalse(rename.available)
        assertTrue(rename.reason is UnavailableReason.FileCannot)
    }

    @Test
    fun `ownership beats scope - an unowned file is refused before scope is consulted`() {
        val f = file(owned = false)

        val rename = availability(f, ProviderCapabilities.UNKNOWN, FileAction.RENAME)

        // The file explanation is more useful to the user than the scope one.
        assertTrue(rename.reason is UnavailableReason.FileCannot)
    }

    @Test
    fun `folder cannot be downloaded and says why`() {
        val f = file(isFolder = true)

        val download = availability(f, fullWrite(), FileAction.DOWNLOAD)

        assertFalse(download.available)
        assertTrue(download.reason is UnavailableReason.FileCannot)
    }

    @Test
    fun `google-native document cannot be downloaded but can be exported`() {
        val f = file(mimeType = "application/vnd.google-apps.document")
        val c = fullWrite()

        assertFalse(availability(f, c, FileAction.DOWNLOAD).available)

        val export = availability(f, c, FileAction.EXPORT)
        assertTrue(export.available)
    }

    @Test
    fun `export is refused for a non-native file`() {
        val export = availability(file(mimeType = "text/plain"), fullWrite(), FileAction.EXPORT)

        assertFalse(export.available)
        assertTrue(export.reason is UnavailableReason.FileCannot)
    }

    @Test
    fun `folder has no revisions`() {
        val revisions = availability(file(isFolder = true), fullWrite(), FileAction.VIEW_REVISIONS)

        assertFalse(revisions.available)
    }

    @Test
    fun `google-native document still opens`() {
        val f = file(mimeType = "application/vnd.google-apps.document")

        assertTrue(availability(f, fullWrite(), FileAction.OPEN).available)
    }

    @Test
    fun `move and copy are both present and agree`() {
        // They were once derived from one entry that only emitted MOVE, so a UI
        // asking about COPY got nothing back at all.
        val actions = ResolveFileActions.resolve(file(), fullWrite())
        val byAction = actions.associateBy { it.action }

        assertTrue(FileAction.MOVE in byAction)
        assertTrue(FileAction.COPY in byAction)
        assertEquals(byAction[FileAction.MOVE]?.available, byAction[FileAction.COPY]?.available)
    }

    @Test
    fun `copy is refused for an unowned file`() {
        val copy = availability(file(owned = false), fullWrite(), FileAction.COPY)

        assertFalse(copy.available)
        assertTrue(copy.reason is UnavailableReason.FileCannot)
    }

    @Test
    fun `a live file cannot be restored or permanently deleted`() {
        val f = file()
        val c = fullWrite()

        assertFalse(availability(f, c, FileAction.RESTORE).available)
        assertFalse(availability(f, c, FileAction.DELETE_PERMANENTLY).available)
    }

    @Test
    fun `a trashed file offers restore and permanent delete, not trash`() {
        val f = file(trashed = true)
        val c = fullWrite()

        assertTrue(availability(f, c, FileAction.RESTORE).available)
        assertTrue(availability(f, c, FileAction.DELETE_PERMANENTLY).available)

        // Trashing something already trashed is not a distinct operation.
        val trash = availability(f, c, FileAction.TRASH)
        assertFalse(trash.available)
        assertTrue(trash.reason is UnavailableReason.FileCannot)
    }

    @Test
    fun `permanent delete needs write scope even in the trash`() {
        val delete = availability(file(trashed = true), ProviderCapabilities.READ_ONLY, FileAction.DELETE_PERMANENTLY)

        assertFalse(delete.available)
        assertTrue(delete.reason is UnavailableReason.ScopeInsufficient)
    }

    @Test
    fun `share is refused in the trash and for unowned files`() {
        val c = fullWrite()

        val trashed = availability(file(trashed = true), c, FileAction.SHARE)
        assertEquals(UnavailableReason.FileInTrash, trashed.reason)

        val unowned = availability(file(owned = false), c, FileAction.SHARE)
        assertTrue(unowned.reason is UnavailableReason.FileCannot)
    }

    @Test
    fun `every action the UI can ask about is always resolvable`() {
        // Guards the class of bug above: an action that can never be found is
        // indistinguishable, at the call site, from one that is unavailable.
        val f = file()
        val resolved = ResolveFileActions.resolve(f, fullWrite()).map { it.action }

        FileAction.entries.forEach { action ->
            assertTrue("no availability produced for $action", action in resolved)
        }
    }

    @Test
    fun `scope reason names the feature that is missing`() {
        val rename = availability(file(), ProviderCapabilities.READ_ONLY, FileAction.RENAME)

        val reason = rename.reason as UnavailableReason.ScopeInsufficient
        assertEquals(Feature.WRITE, reason.feature)
    }

    private fun fullWrite() =
        ProviderCapabilities(
            canReadFiles = true,
            canWriteFiles = true,
            canCreateFolders = true,
            canRename = true,
            canTrash = true,
            canSearch = true,
            canReadRevisions = true,
            canStar = true,
            canDownloadBytes = true,
            grantsOfflineAccess = true,
            canExport = true,
        )
}
