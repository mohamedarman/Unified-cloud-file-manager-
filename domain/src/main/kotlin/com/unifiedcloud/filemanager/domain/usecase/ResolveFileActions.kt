package com.unifiedcloud.filemanager.domain.usecase

import com.unifiedcloud.filemanager.domain.model.CloudFile
import com.unifiedcloud.filemanager.domain.model.Feature
import com.unifiedcloud.filemanager.domain.model.ProviderCapabilities

/** An action a user can take on a file, as the UI understands actions. */
enum class FileAction {
    OPEN,
    DOWNLOAD,
    EXPORT,
    RENAME,
    MOVE,
    COPY,
    TRASH,
    RESTORE,
    DELETE_PERMANENTLY,
    STAR,
    VIEW_REVISIONS,
    SHARE,
}

/**
 * Why an action is unavailable.
 *
 * The reason exists so the UI can explain rather than merely disable. A greyed
 * button with no explanation is the failure mode PC-4 is written to prevent; a
 * disabled "Rename" that says "this account has view-only access" is a
 * different, and acceptable, experience.
 */
sealed interface UnavailableReason {
    /** The credential's scope does not permit this action. */
    data class ScopeInsufficient(val feature: Feature) : UnavailableReason

    /** The file itself cannot support the action regardless of credential. */
    data class FileCannot(val explanation: String) : UnavailableReason

    /** Permanently unavailable - the file is in the trash. */
    data object FileInTrash : UnavailableReason
}

/** One action with its availability and, when unavailable, its reason. */
data class ActionAvailability(
    val action: FileAction,
    val available: Boolean,
    val reason: UnavailableReason? = null,
) {
    init {
        require(available || reason != null) {
            "Action $action marked unavailable must carry a reason"
        }
        require(!available || reason == null) {
            "Action $action marked available must not carry a reason"
        }
    }

    companion object {
        fun yes(action: FileAction) = ActionAvailability(action, available = true)

        fun no(
            action: FileAction,
            reason: UnavailableReason,
        ) = ActionAvailability(action, available = false, reason = reason)
    }
}

/**
 * Decides which actions a file offers, from the file's own properties and the
 * account's capabilities.
 *
 * This is the single place the "don't show a button that will fail" rule lives
 * (PC-1, PC-4). Doing it once here rather than per-screen is what keeps the
 * behaviour consistent: a file that cannot be renamed shows no rename affordance
 * in the list, in the detail sheet, and in the multi-select bar alike.
 *
 * It is pure and synchronous by design - no I/O, no provider call - so the UI
 * can evaluate it on every recomposition and tests can assert the whole matrix
 * without a harness. The inputs are the file and the account's capabilities.
 *
 * Capabilities are passed in rather than carried on [CloudFile] on purpose.
 * Capability is a property of the *account's credential*, not of a file, so a
 * per-file copy would be a second source of truth that defaults to `UNKNOWN` -
 * and a caller reading the wrong one would conclude every action is unavailable
 * with no indication why.
 *
 * Note the asymmetry this deliberately preserves: an unknown capability yields
 * *unavailable*, not available. Hiding an action that would have worked is a
 * smaller failure than showing one that will not, and the missing affordance
 * disappears as soon as capabilities load.
 */
object ResolveFileActions {
    fun resolve(
        file: CloudFile,
        capabilities: ProviderCapabilities,
    ): Set<ActionAvailability> =
        buildSet {
            add(open(file, capabilities))
            add(download(file, capabilities))
            add(export(file, capabilities))
            add(rename(file, capabilities))
            add(move(file, capabilities))
            add(copy(file, capabilities))
            add(trash(file, capabilities))
            add(restore(file, capabilities))
            add(deletePermanently(file, capabilities))
            add(share(file, capabilities))
            add(revisions(file, capabilities))
            add(star(file, capabilities))
        }

    /**
     * Open is the one action that has no further conditions once the credential
     * can read. A Google-native document opens in Google's own editor via HTTP
     * redirect, which is correct behaviour rather than a special case - and it
     * is why [FileAction.EXPORT] exists separately for those files.
     */
    private fun open(
        file: CloudFile,
        c: ProviderCapabilities,
    ): ActionAvailability =
        if (c.canReadFiles != true) {
            ActionAvailability.no(
                FileAction.OPEN,
                UnavailableReason.ScopeInsufficient(Feature.READ),
            )
        } else {
            ActionAvailability.yes(FileAction.OPEN)
        }

    private fun download(
        file: CloudFile,
        c: ProviderCapabilities,
    ): ActionAvailability =
        when {
            file.isFolder ->
                ActionAvailability.no(
                    FileAction.DOWNLOAD,
                    UnavailableReason.FileCannot("A folder has no content to download"),
                )
            file.isGoogleNative ->
                ActionAvailability.no(
                    FileAction.DOWNLOAD,
                    UnavailableReason.FileCannot("This document has no downloadable form; export it instead"),
                )
            c.canDownloadBytes != true ->
                ActionAvailability.no(
                    FileAction.DOWNLOAD,
                    UnavailableReason.ScopeInsufficient(Feature.DOWNLOAD),
                )
            else -> ActionAvailability.yes(FileAction.DOWNLOAD)
        }

    private fun export(
        file: CloudFile,
        c: ProviderCapabilities,
    ): ActionAvailability =
        when {
            !file.isGoogleNative ->
                ActionAvailability.no(
                    FileAction.EXPORT,
                    UnavailableReason.FileCannot("Only Google documents can be exported"),
                )
            c.canExport != true ->
                ActionAvailability.no(
                    FileAction.EXPORT,
                    UnavailableReason.ScopeInsufficient(Feature.EXPORT),
                )
            else -> ActionAvailability.yes(FileAction.EXPORT)
        }

    private fun rename(
        file: CloudFile,
        c: ProviderCapabilities,
    ): ActionAvailability =
        when {
            !file.isOwnedByUser ->
                ActionAvailability.no(
                    FileAction.RENAME,
                    UnavailableReason.FileCannot("Only the owner can rename this file"),
                )
            c.canRename != true ->
                ActionAvailability.no(
                    FileAction.RENAME,
                    UnavailableReason.ScopeInsufficient(Feature.WRITE),
                )
            else -> ActionAvailability.yes(FileAction.RENAME)
        }

    /**
     * Move and copy share every condition: both need write scope, and both are
     * owner-only. They are returned separately rather than merged, because a
     * multi-select bar offering move without copy would be a capability the UI
     * cannot express - and sharing one predicate keeps the two from drifting.
     */
    private fun move(
        file: CloudFile,
        c: ProviderCapabilities,
    ): ActionAvailability = resolveAction(FileAction.MOVE, moveOrCopyReason(file, c))

    private fun copy(
        file: CloudFile,
        c: ProviderCapabilities,
    ): ActionAvailability = resolveAction(FileAction.COPY, moveOrCopyReason(file, c))

    private fun resolveAction(
        action: FileAction,
        reason: UnavailableReason?,
    ): ActionAvailability =
        if (reason == null) {
            ActionAvailability.yes(action)
        } else {
            ActionAvailability.no(action, reason)
        }

    /** Ownership is checked before scope, so the more useful reason is reported. */
    private fun moveOrCopyReason(
        file: CloudFile,
        c: ProviderCapabilities,
    ): UnavailableReason? =
        when {
            !file.isOwnedByUser ->
                UnavailableReason.FileCannot("Only the owner can move or copy this file")
            c.canWriteFiles != true ->
                UnavailableReason.ScopeInsufficient(Feature.WRITE)
            else -> null
        }

    private fun trash(
        file: CloudFile,
        c: ProviderCapabilities,
    ): ActionAvailability =
        when {
            // Already in the trash: restore is the action, not a second trash.
            file.isTrashed ->
                ActionAvailability.no(
                    FileAction.TRASH,
                    UnavailableReason.FileCannot("This file is already in the trash"),
                )
            !file.isOwnedByUser ->
                ActionAvailability.no(
                    FileAction.TRASH,
                    UnavailableReason.FileCannot("Only the owner can move this file to trash"),
                )
            c.canTrash != true ->
                ActionAvailability.no(
                    FileAction.TRASH,
                    UnavailableReason.ScopeInsufficient(Feature.WRITE),
                )
            else -> ActionAvailability.yes(FileAction.TRASH)
        }

    private fun restore(
        file: CloudFile,
        c: ProviderCapabilities,
    ): ActionAvailability =
        when {
            !file.isTrashed ->
                ActionAvailability.no(
                    FileAction.RESTORE,
                    UnavailableReason.FileCannot("This file is not in the trash"),
                )
            c.canTrash != true ->
                ActionAvailability.no(
                    FileAction.RESTORE,
                    UnavailableReason.ScopeInsufficient(Feature.WRITE),
                )
            else -> ActionAvailability.yes(FileAction.RESTORE)
        }

    /**
     * Permanent deletion is irreversible, so the capability check is not the
     * point - the UI must confirm. This only reports that the account is
     * permitted to do it at all; the confirmation requirement belongs to the
     * screen and is deliberately not modelled as a capability.
     */
    private fun deletePermanently(
        file: CloudFile,
        c: ProviderCapabilities,
    ): ActionAvailability =
        when {
            !file.isTrashed ->
                ActionAvailability.no(
                    FileAction.DELETE_PERMANENTLY,
                    UnavailableReason.FileCannot("Only a file in the trash can be deleted permanently"),
                )
            c.canTrash != true ->
                ActionAvailability.no(
                    FileAction.DELETE_PERMANENTLY,
                    UnavailableReason.ScopeInsufficient(Feature.WRITE),
                )
            else -> ActionAvailability.yes(FileAction.DELETE_PERMANENTLY)
        }

    /** Sharing creates a new permission, so it is owner-only and needs write. */
    private fun share(
        file: CloudFile,
        c: ProviderCapabilities,
    ): ActionAvailability =
        when {
            file.isTrashed ->
                ActionAvailability.no(
                    FileAction.SHARE,
                    UnavailableReason.FileInTrash,
                )
            !file.isOwnedByUser ->
                ActionAvailability.no(
                    FileAction.SHARE,
                    UnavailableReason.FileCannot("Only the owner can change who this file is shared with"),
                )
            c.canWriteFiles != true ->
                ActionAvailability.no(
                    FileAction.SHARE,
                    UnavailableReason.ScopeInsufficient(Feature.WRITE),
                )
            else -> ActionAvailability.yes(FileAction.SHARE)
        }

    private fun revisions(
        file: CloudFile,
        c: ProviderCapabilities,
    ): ActionAvailability =
        when {
            file.isFolder ->
                ActionAvailability.no(
                    FileAction.VIEW_REVISIONS,
                    UnavailableReason.FileCannot("Folders do not have revisions"),
                )
            c.canReadRevisions != true ->
                ActionAvailability.no(
                    FileAction.VIEW_REVISIONS,
                    UnavailableReason.ScopeInsufficient(Feature.REVISIONS),
                )
            else -> ActionAvailability.yes(FileAction.VIEW_REVISIONS)
        }

    private fun star(
        file: CloudFile,
        c: ProviderCapabilities,
    ): ActionAvailability =
        if (c.canStar != true) {
            ActionAvailability.no(
                FileAction.STAR,
                UnavailableReason.ScopeInsufficient(Feature.STAR),
            )
        } else {
            ActionAvailability.yes(FileAction.STAR)
        }
}
