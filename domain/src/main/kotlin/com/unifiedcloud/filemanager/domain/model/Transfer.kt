package com.unifiedcloud.filemanager.domain.model

import com.unifiedcloud.filemanager.domain.error.AppError
import java.io.InputStream

/*
 * Transfer contracts.
 *
 * A transfer is always account-scoped and always identifies its endpoints by
 * [FileRef] and [TransferDestination]. Neither is optional, because a transfer
 * that could default either one is a transfer that could cross account or
 * destination boundaries without anyone deciding it should (I-1, X-1).
 */

/**
 * A named place to put bytes.
 *
 * WHY THIS IS AN INTERFACE AND NOT A DATA CLASS - this is a deliberate deviation
 * from the sketch in Architecture.md §6.1, which modelled it as a sealed class
 * whose `DocumentTree` variant holds an `android.net.Uri`.
 *
 * `:domain` is a pure Kotlin JVM module (Rules.md L-1, ADR-10), so `Uri` cannot
 * appear here - the build enforces that, not a reviewer. The fix is not to
 * weaken the rule but to keep the domain ignorant of platform handles: the
 * domain needs to know *that* a destination was chosen and be able to name it in
 * a log, while the concrete destinations are platform concerns owned by `:data`,
 * which already hosts the transfer engine.
 *
 * Implementations live in `:data`:
 *   - `AppCacheDestination`     - app-managed cache file
 *   - `DocumentTreeDestination` - SAF tree, wraps `Uri`
 *   - `FileProviderDestination` - FileProvider content uri
 *
 * The trade-off is that the domain cannot destructure the destination. That is
 * acceptable because the domain never does: interpreting a destination is the
 * engine's job, and the engine is in `:data`.
 */
interface TransferDestination {
    /**
     * A short, non-sensitive label for logs and error messages.
     *
     * Must never be a file name or a full path - both are sensitive (LG-3).
     */
    val logLabel: String
}

/**
 * A stream of bytes belonging to exactly one file in exactly one account.
 *
 * Returned as [InputStream] so that the payload moves provider-to-device without
 * being materialised in memory. The app is a management layer, not a proxy: it
 * never re-serves these bytes on a user's behalf through any other channel
 * (Rules.md §2).
 */
class ContentSource(
    val ref: FileRef,
    val lengthBytes: Long?,
    private val stream: InputStream,
) : AutoCloseable {
    /**
     * True when the provider will refuse a range request, in which case the
     * engine must not attempt resume for this source.
     */
    var supportsRangeRequests: Boolean = true

    /** Set by the provider when the content differs from the cached copy. */
    var etag: String? = null

    fun openStream(): InputStream = stream

    override fun close() = stream.close()
}

/** A byte range within a single file. */
data class ByteRange(val start: Long, val endInclusive: Long) {
    init {
        require(start >= 0) { "ByteRange.start must not be negative" }
        require(endInclusive >= start) { "ByteRange.end must not be >= start" }
    }

    val length: Long get() = endInclusive - start + 1
}

/**
 * Progress reporting.
 *
 * A [suspend] callback rather than a Flow because progress is a stream of
 * updates, not state: buffering it would deliver a backlog of stale percentages
 * long after the transfer finished. Backpressure drops intermediate values
 * naturally (X-3).
 */
fun interface ProgressSink {
    suspend fun onProgress(
        bytesTransferred: Long,
        totalBytes: Long?,
    )
}

/**
 * A file being transferred.
 *
 * [ref] identifies the source file, so a paused, resumed, or retried transfer
 * remains bound to one file in one account for its entire life.
 */
data class TransferState(
    val transferId: String,
    val ref: FileRef,
    val direction: Direction,
    val bytesTransferred: Long,
    val totalBytes: Long?,
    val status: Status,
) {
    val progressFraction: Float?
        get() = totalBytes?.takeIf { it > 0 }?.let { bytesTransferred.toFloat() / it }

    val isTerminal: Boolean
        get() = status is Status.Failed || status is Status.Completed || status is Status.Cancelled

    enum class Direction { DOWNLOAD, UPLOAD }

    sealed interface Status {
        data object Queued : Status

        data object Running : Status

        data object Paused : Status

        /** Retrying after a failure judged transient at the boundary (M-6). */
        data class Retrying(val attempt: Int, val nextRetryMillis: Long) : Status

        data class Completed(val ref: FileRef) : Status

        data class Failed(val error: AppError) : Status

        data object Cancelled : Status
    }
}
