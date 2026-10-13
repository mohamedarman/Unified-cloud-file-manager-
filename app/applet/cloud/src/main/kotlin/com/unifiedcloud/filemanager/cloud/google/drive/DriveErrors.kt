package com.unifiedcloud.filemanager.cloud.google.drive

import com.unifiedcloud.filemanager.domain.model.AppError
import com.unifiedcloud.filemanager.domain.model.FileRef
import com.unifiedcloud.filemanager.domain.model.LocalAccountId
import com.unifiedcloud.filemanager.domain.model.PermissionReason
import com.unifiedcloud.filemanager.domain.model.ProviderFileId
import com.unifiedcloud.filemanager.domain.model.ProviderId
import com.unifiedcloud.filemanager.domain.model.QuotaScope
import com.unifiedcloud.filemanager.domain.model.Recovery
import com.unifiedcloud.filemanager.domain.model.TransportCause

/**
 * Maps Google Drive HTTP responses and transport failures into domain errors
 * (`Architecture.md` §11.1.3, `Rules.md` ER-5).
 */
object DriveErrors {
    private const val REASON_USER_RATE_LIMIT_EXCEEDED = "userRateLimitExceeded"
    private const val REASON_INSUFFICIENT_STORAGE = "insufficientStorage"
    private const val REASON_INSUFFICIENT_PERMISSIONS = "insufficientPermissions"

    private const val DEFAULT_RETRY_AFTER_MILLIS = 5_000L
    private const val MAX_RETRY_AFTER_MILLIS = 3_600_000L

    data class DriveHttpFailure(
        val httpStatus: Int,
        val reason: String?,
        val retryAfterMillis: Long?,
    )

    /**
     * Maps an HTTP response failure into an [AppError].
     */
    fun map(
        failure: DriveHttpFailure,
        context: DriveOperationContext,
    ): AppError =
        when (failure.httpStatus) {
            401 -> unauthorized(failure, context)
            403 -> forbidden(failure, context)
            404 -> notFound(context)
            429 -> rateLimited(failure)
            in 500..599 -> AppError.ProviderUnavailable(ProviderId.GOOGLE_DRIVE, failure.reason)
            else -> AppError.Unknown("Drive returned HTTP ${failure.httpStatus}", null)
        }

    private fun unauthorized(
        failure: DriveHttpFailure,
        context: DriveOperationContext,
    ): AppError =
        AppError.TokenRefreshFailed(
            providerId = ProviderId.GOOGLE_DRIVE,
            errorCode = failure.reason,
            httpStatus = failure.httpStatus,
            retryable = true,
            recovery = Recovery.RETRY_TRANSPARENTLY,
        )

    private fun forbidden(
        failure: DriveHttpFailure,
        context: DriveOperationContext,
    ): AppError =
        when (failure.reason) {
            REASON_USER_RATE_LIMIT_EXCEEDED -> rateLimited(failure)
            REASON_INSUFFICIENT_STORAGE -> storageExhausted()
            REASON_INSUFFICIENT_PERMISSIONS -> insufficientPermissions(context)
            else -> AppError.Unknown("Drive returned an unrecognised 403 reason", null)
        }

    private fun insufficientPermissions(context: DriveOperationContext): AppError =
        AppError.Unauthorized(
            if (context.grantedScopesSuffice) {
                PermissionReason.FILE_NOT_SHARED
            } else {
                PermissionReason.SCOPE_INSUFFICIENT
            },
        )

    private fun storageExhausted(): AppError =
        AppError.QuotaExceeded(
            providerId = ProviderId.GOOGLE_DRIVE,
            scope = QuotaScope.STORAGE,
            limitBytes = null,
            usedBytes = null,
        )

    private fun notFound(context: DriveOperationContext): AppError {
        val fileId =
            context.fileId
                ?: return AppError.Unknown("Drive returned 404 for an operation with no file id", null)
        return AppError.FileNotFound(
            FileRef(
                provider = ProviderId.GOOGLE_DRIVE,
                accountId = context.accountId,
                fileId = fileId,
            ),
        )
    }

    private fun rateLimited(failure: DriveHttpFailure): AppError =
        AppError.RateLimited(
            retryAfterMillis =
                (failure.retryAfterMillis ?: DEFAULT_RETRY_AFTER_MILLIS)
                    .coerceIn(0L, MAX_RETRY_AFTER_MILLIS),
        )

    fun network(
        cause: TransportCause,
        retryable: Boolean,
    ): AppError = AppError.Network(cause = cause, retryable = retryable)

    fun reasonOf(body: String?): String? {
        if (body.isNullOrBlank()) return null
        val start = quotedValueStart(body, REASON_FIELD) ?: return null
        val end = body.indexOf('"', start)
        return if (end < 0) null else body.substring(start, end)
    }

    private fun quotedValueStart(
        body: String,
        field: String,
    ): Int? {
        val key = body.indexOf(field)
        if (key < 0) return null
        var index = key + field.length
        while (index < body.length && body[index].isWhitespace()) index++
        if (index >= body.length || body[index] != ':') return null
        index++
        while (index < body.length && body[index].isWhitespace()) index++
        return if (index < body.length && body[index] == '"') index + 1 else null
    }

    fun retryAfterMillisOf(headerValue: String?): Long? {
        val text = headerValue?.trim().orEmpty()
        if (text.isEmpty()) return null
        val seconds = text.toLongOrNull() ?: return null
        if (seconds < 0) return null
        return seconds.coerceAtMost(MAX_RETRY_AFTER_SECONDS) * MILLIS_PER_SECOND
    }

    private const val REASON_FIELD = "\"reason\""
    private const val MILLIS_PER_SECOND = 1_000L
    private const val MAX_RETRY_AFTER_SECONDS = MAX_RETRY_AFTER_MILLIS / MILLIS_PER_SECOND
}
