package com.unifiedcloud.filemanager.core.logging

/**
 * Log redaction.
 *
 * `Architecture.md` §31 (LG-3, O-3) and `Rules.md` §26 are specific about what
 * may reach a log: no access or refresh tokens, no client secrets, no file names,
 * no full document URIs, no email addresses in production logs, and no
 * `thumbnailLink` values at all - a `thumbnailLink` grants read access to that
 * thumbnail to anyone holding it, so logging one is equivalent to logging a
 * credential.
 *
 * This is the single implementation of those rules. Redaction is not applied at
 * each call site because a rule applied in thirty places is a rule that is missed
 * in one of them, and the one place it is missed is the one that ships.
 *
 * The functions are pure and take no Android or logging dependency, so they are
 * unit-testable in a plain JVM module and can be reused by any sink.
 */
object Redactor {

    /**
     * A short, stable hash of a file identity.
     *
     * Per O-3, a file is identified in logs by a hash of `(accountId, fileId)`,
     * which is enough to correlate log lines about the same file without putting
     * the name or the provider id in the log. Truncated because a full hash is
     * still an identifier, and 12 hex characters is ample for correlation while
     * being far harder to brute-force against a known file-name list.
     */
    fun fileRefTag(accountId: Long, fileId: String): String {
        // FNV-1a: cheap, dependency-free, and adequate for a correlation tag.
        // This is explicitly not a security primitive and must never be used as
        // one - the file id is not a secret, it is simply not for logs.
        var hash = -0x340d631b7bdddcdbL // 14695981039346656037
        for (char in accountId.toString() + IDENTITY_SEPARATOR + fileId) {
            hash = hash xor char.code.toLong()
            hash *= 0x100000001b3L
        }
        return hash.toString(HEX_RADIX).takeLast(TAG_WIDTH).padStart(TAG_WIDTH, '0')
    }

    /**
     * Masks a secret, keeping only enough to tell two values apart.
     *
     * Never applied to a token's *decoded* form, and the result is not a secret:
     * it exists so a log line can say "using token ending ab12" without carrying
     * a usable credential.
     */
    fun maskSecret(secret: String?): String = when {
        secret == null -> "<null>"
        secret.isEmpty() -> "<empty>"
        secret.length <= 4 -> "<redacted>"
        else -> "<redacted:${secret.takeLast(4)}>"
    }

    /**
     * Strips a document URI down to its scheme and authority.
     *
     * The path of a `DocumentsProvider` URI encodes the file id and sometimes a
     * display name, so the whole URI must never be logged. Scheme and authority
     * are enough to identify which provider produced it.
     */
    fun maskUri(uri: String?): String {
        if (uri.isNullOrEmpty()) return "<null>"
        val schemeEnd = uri.indexOf("://")
        if (schemeEnd < 0) return "<uri>"
        val authorityStart = schemeEnd + 3
        val pathStart = uri.indexOf('/', authorityStart)
        return if (pathStart < 0) uri else uri.substring(0, pathStart) + "/<redacted>"
    }

    /**
     * Masks an email address to its domain.
     *
     * The domain is enough to tell "which Google account is this about" in a log
     * without recording whose account it is. The local part is dropped entirely
     * rather than truncated - a prefix plus a domain is often enough to identify
     * a person.
     */
    fun maskEmail(email: String?): String {
        if (email.isNullOrBlank()) return "<none>"
        val at = email.indexOf('@')
        if (at < 0) return "<redacted>"
        return "<redacted>@" + email.substring(at + 1)
    }

    /**
     * Removes anything that looks like a credential from free-form text.
     *
     * A backstop for messages built by string interpolation, where a value that
     * should have been masked was not. It is a backstop rather than the primary
     * defence on purpose: pattern matching cannot be relied on to catch every
     * credential shape, so the primary defence remains passing masked values in
     * from the start.
     */
    fun scrub(message: String): String = message
        .replace(TOKEN_PATTERNS.first, "<redacted>")
        .replace(TOKEN_PATTERNS.second, "<redacted>")
        .replace(TOKEN_PATTERNS.third, "<redacted>")

    private val TOKEN_PATTERNS = listOf(
        Regex("""ya29\.[A-Za-z0-9._-]{10,}"""),
        Regex("""1//[A-Za-z0-9._-]{20,}"""),
        Regex("""GOCSPX-[A-Za-z0-9_-]{10,}"""),
    )

    /**
     * The separator between account id and file id in the hashed input.
     *
     * A NUL cannot occur in either component, so it keeps `("4", "2abc")` and
     * `("42", "abc")` distinct - without it those two hash alike, and two
     * different files in two different accounts would share a log tag.
     */
    private const val IDENTITY_SEPARATOR = "\u0000"

    /** Radix 16. A tag is a correlation handle, not a number anyone does maths on. */
    private const val HEX_RADIX = 16

    /** 12 hex characters: ample for correlation, and short enough not to be an identifier. */
    private const val TAG_WIDTH = 12
}
