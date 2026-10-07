package com.unifiedcloud.filemanager.domain.util

import com.unifiedcloud.filemanager.domain.error.AppError

/*
 * `Result` helpers.
 *
 * Kotlin's [Result] is fine as a return type but awkward as a thing to combine,
 * and the combinations - "do this, then that, if both work" - are where
 * error-handling bugs hide. A provider call chain that loses its error on the way
 * up is how a user sees an empty screen instead of a permission message.
 *
 * These helpers exist so the accumulation is written once and reused, rather than
 * re-derived at each call site with a slightly different mistake.
 */

/** Left-biased accumulation: the first failure wins and short-circuits. */
inline fun <T, R> Result<T>.mapCatching(transform: (T) -> R): Result<R> =
    fold(onSuccess = { Result.success(transform(it)) }, onFailure = { Result.failure(it) })

inline fun <T, R> Result<T>.flatMapCatching(transform: (T) -> Result<R>): Result<R> =
    fold(onSuccess = transform, onFailure = { Result.failure(it) })

inline fun <T> Result<T>.onAppError(action: (AppError) -> Unit): Result<T> =
    apply {
        exceptionOrNull()?.let { throwable ->
            if (throwable is AppError) action(throwable)
        }
    }

/**
 * Runs [block], converting a thrown [AppError] into a failed [Result].
 *
 * Only for [AppError]. An unexpected exception is a bug and is deliberately
 * allowed to propagate: swallowing it here would hide the defect behind a
 * plausible-looking failure the UI cannot explain.
 */
@Suppress("InstanceOfCheckForException")
inline fun <T> appErrorCatching(block: () -> T): Result<T> =
    try {
        Result.success(block())
    } catch (e: Throwable) {
        if (e is AppError) Result.failure(e) else throw e
    }

/** The [AppError], or null when this is a success. */
fun <T> Result<T>.appErrorOrNull(): AppError? = exceptionOrNull() as? AppError

val Result<*>.isSuccessOrNonAppError: Boolean
    get() = exceptionOrNull() !is AppError
