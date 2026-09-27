package com.unifiedcloud.filemanager.cloud.google.drive

/**
 * The explicit `fields` allowlist for every Drive call.
 *
 * `Rules.md` QD-2 makes `fields` mandatory on every request, and
 * `Architecture.md` §11.1.1 goes further and calls over-fetching "a policy
 * violation, not an optimisation" - it costs latency, it costs quota against a
 * budget that is **not yet measured** (V-06, Q-05), and for restricted scopes it
 * widens what the app touches at all.
 *
 * That is why this is a set of named constants rather than a string assembled
 * at each call site. A `fields` string built inline is a `fields` string that
 * grows by accretion, one `,` at a time, and nobody notices until the quota
 * does. Here the list is written once and [requireFieldsAllowed] refuses a
 * composition that is not a subset of it, so the policy is checkable rather than
 * aspirational.
 *
 * **The field list is taken verbatim from `Architecture.md` §11.1.1.** It is not
 * extended, trimmed, or reordered on judgement. It is also not *measured*: the
 * document calls its own list "a representative list call", so it is the
 * architecture's stated intent rather than a verified minimum, and trimming it
 * to the smallest set that happens to satisfy today's mappers would be an
 * unmeasured optimisation in the opposite direction.
 */
object DriveFields {

    /**
     * Fields for a `files.list` response.
     *
     * `nextPageToken` is part of the list, not a decoration: [com.unifiedcloud.filemanager.domain.model.Page]
     * treats a null token as the definition of "no more results", so omitting it
     * would make exhaustion undetectable and a listing would silently stop
     * after one page.
     *
     * `thumbnailLink` is requested because the gallery needs it, and
     * `Rules.md` CA-5 / LG-3 govern what happens to it afterwards: it is
     * bearer-adjacent, so it is never logged and never treated as durable. Its
     * lifetime is unmeasured (V-08, Q-07).
     */
    const val FILE_LIST = "nextPageToken,files(" +
        "id," +
        "name," +
        "mimeType," +
        "size," +
        "modifiedTime," +
        "createdTime," +
        "thumbnailLink," +
        "webViewLink," +
        "parents," +
        "trashed," +
        "starred," +
        "ownedByMe," +
        "driveId," +
        "capabilities/canRename," +
        "capabilities/canTrash," +
        "capabilities/canDownload," +
        "capabilities/canShare" +
        ")"

    /**
     * Fields for a single `files.get`.
     *
     * No `nextPageToken`, because a single file has no pages. The per-file
     * capabilities are kept: the UI resolves available actions from
     * `capabilities()` rather than a hardcoded list (`Rules.md` PC-7), which is
     * what makes a forced scope downgrade degrade instead of break.
     */
    const val FILE_METADATA = "files(" +
        "id," +
        "name," +
        "mimeType," +
        "size," +
        "modifiedTime," +
        "createdTime," +
        "thumbnailLink," +
        "webViewLink," +
        "parents," +
        "trashed," +
        "starred," +
        "ownedByMe," +
        "driveId," +
        "capabilities/canRename," +
        "capabilities/canTrash," +
        "capabilities/canDownload," +
        "capabilities/canShare" +
        ")"

    /**
     * Fields for `about`, per `Architecture.md` §11.1.
     *
     * `storageQuota` is what backs [com.unifiedcloud.filemanager.domain.model.QuotaUsage].
     * It describes **Google's** quota for **this one account**. `Rules.md` AP-6
     * and CP-3 forbid summing it across accounts, and §1 forbids ever presenting
     * it as capacity this app provides.
     */
    const val ABOUT = "user,storageQuota"

    /**
     * `corpora`, constrained explicitly on every call (`Rules.md` QD-8).
     *
     * `user` is the only value this product uses. It is what keeps **shared
     * drives** out of unified results - `PRD.md` R-22 rates shared-drive leakage
     * a real risk and shared drives are out of MVP scope. Leaving `corpora`
     * unset would let the provider decide, and the provider's default is not a
     * decision this product should be taking by omission.
     */
    const val CORPORA_USER = "user"

    /**
     * `spaces`, constrained explicitly on every call (`Rules.md` QD-8).
     *
     * `drive` excludes Drive appData, which is not user file content in the sense
     * this app presents. See [CORPORA_USER] for why this is a constant and not
     * an omitted parameter.
     */
    const val SPACES_DRIVE = "drive"

    /**
     * Bounded page size (`Rules.md` QD-3: `listFiles` never requests an
     * unbounded result).
     *
     * Matches the `pageSize` in the `Architecture.md` §11.1.1 example. The
     * domain's own ceiling is `FileQuery.MAX_PAGE_SIZE` (200); this is the value
     * actually sent, chosen lower because a page is held in memory and rendered
     * as a unit.
     */
    const val PAGE_SIZE = 100

    /**
     * Every field name this module is permitted to request, as a flat set.
     *
     * Used only by [requireFieldsAllowed], which is a guard rather than a
     * runtime cost on the request path - it is intended for tests and for a
     * debug assertion, not for every call in production.
     */
    val ALLOWED: Set<String> = setOf(
        "nextPageToken",
        "id",
        "name",
        "mimeType",
        "size",
        "modifiedTime",
        "createdTime",
        "thumbnailLink",
        "webViewLink",
        "parents",
        "trashed",
        "starred",
        "ownedByMe",
        "driveId",
        "capabilities/canRename",
        "capabilities/canTrash",
        "capabilities/canDownload",
        "capabilities/canShare",
        "user",
        "storageQuota",
    )

    /**
     * Fails if [fields] requests anything outside [ALLOWED].
     *
     * This is the mechanical half of QD-2. A `fields` value that widens the
     * request is a policy violation whether or not anyone notices, and for
     * restricted scopes it widens what the app touches at all - so it is worth a
     * hard failure rather than a review comment.
     *
     * Throws [IllegalArgumentException] rather than returning a boolean so a
     * violation cannot be logged and ignored. Accepts the `files(...)` wrapper
     * and any whitespace, because that is the shape Drive actually takes.
     */
    fun requireFieldsAllowed(fields: String) {
        val requested = parseFields(fields)
        val offending = requested - ALLOWED
        require(offending.isEmpty()) {
            "fields requests ${offending.sorted()}, which is outside the allowlist (Rules.md QD-2)"
        }
    }

    /**
     * The field names in a `fields` expression.
     *
     * Strips the `files(...)` wrapper and the `nextPageToken` sibling that Drive
     * allows alongside it, then splits on commas. Exposed as `internal` because
     * the allowlist check is the only consumer and a public parser invites it to
     * be used somewhere it should not be.
     */
    internal fun parseFields(fields: String): Set<String> {
        val unwrapped = fields
            .replace(OPEN_FILES, "")
            .replace(CLOSE_FILES, "")
        return unwrapped
            .split(',')
            .map { it.trim() }
            .filter { it.isNotEmpty() }
            .toSet()
    }

    private const val OPEN_FILES = "files("
    private const val CLOSE_FILES = ")"
}
