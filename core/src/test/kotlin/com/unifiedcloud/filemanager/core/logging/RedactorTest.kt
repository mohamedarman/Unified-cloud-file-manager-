package com.unifiedcloud.filemanager.core.logging

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Redaction is a contractual rule (`Rules.md` §26, LG-3, O-3), not a style
 * preference: a token in a log is a credential in someone else's hands, and a
 * file name is the user's data. These assertions are the enforcement.
 */
class RedactorTest {
    // --- file identity ------------------------------------------------------

    @Test
    fun `file tag never contains the file id or the account id`() {
        val tag = Redactor.fileRefTag(accountId = 42, fileId = "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms")

        assertFalse("leaked file id: $tag", tag.contains("1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms"))
        assertFalse("leaked account id: $tag", tag.contains("42"))
    }

    @Test
    fun `file tag is stable for the same identity`() {
        val a = Redactor.fileRefTag(7, "abc")
        val b = Redactor.fileRefTag(7, "abc")

        assertEquals(a, b)
    }

    @Test
    fun `file tag differs per account for the same provider file id`() {
        // Otherwise two accounts' files would be indistinguishable in a log, and
        // an isolation bug would be invisible in exactly the log used to chase it.
        val a = Redactor.fileRefTag(1, "same-file")
        val b = Redactor.fileRefTag(2, "same-file")

        assertNotEquals(a, b)
    }

    @Test
    fun `file tag is a fixed short width`() {
        val tag = Redactor.fileRefTag(1, "x")

        assertEquals(12, tag.length)
    }

    // --- secrets ------------------------------------------------------------

    @Test
    fun `masked secret exposes at most four trailing characters`() {
        val masked = Redactor.maskSecret("super-secret-refresh-token-value")

        assertFalse(masked.contains("super-secret"))
        assertTrue(masked.endsWith("alue"))
        assertEquals("<redacted:alue>", masked)
    }

    @Test
    fun `very short secrets are not partially revealed`() {
        // A 5-character secret is mostly revealed by showing its last 4.
        assertEquals("<redacted>", Redactor.maskSecret("abcde"))
        assertEquals("<redacted>", Redactor.maskSecret("abcd"))
    }

    @Test
    fun `null and empty secrets are distinguishable`() {
        assertEquals("<null>", Redactor.maskSecret(null))
        assertEquals("<empty>", Redactor.maskSecret(""))
    }

    // --- uris ---------------------------------------------------------------

    @Test
    fun `document uri path is removed but scheme and authority survive`() {
        val masked = Redactor.maskUri("content://com.example.provider/tree/sdcard%3AFolder")

        assertTrue(masked.startsWith("content://com.example.provider"))
        assertFalse("leaked path: $masked", masked.contains("sdcard"))
    }

    @Test
    fun `uri without a path is unchanged`() {
        assertEquals("content://authority", Redactor.maskUri("content://authority"))
    }

    @Test
    fun `null uri is handled`() {
        assertEquals("<null>", Redactor.maskUri(null))
    }

    // --- email --------------------------------------------------------------

    @Test
    fun `email local part is dropped entirely`() {
        val masked = Redactor.maskEmail("alice.smith@gmail.com")

        assertEquals("<redacted>@gmail.com", masked)
        assertFalse("leaked local part: $masked", masked.contains("alice"))
    }

    @Test
    fun `a truncated local part would still identify the user`() {
        // Documents the reason for dropping rather than abbreviating: a prefix
        // plus a domain frequently identifies a person on its own.
        val masked = Redactor.maskEmail("alicesmith@gmail.com")

        assertFalse(masked.contains("alice"))
    }

    @Test
    fun `malformed email is fully redacted`() {
        assertEquals("<redacted>", Redactor.maskEmail("not-an-email"))
        assertEquals("<none>", Redactor.maskEmail(null))
        assertEquals("<none>", Redactor.maskEmail("  "))
    }

    // --- scrub backstop -----------------------------------------------------

    @Test
    fun `scrub removes an access token from interpolated text`() {
        val scrubbed = Redactor.scrub("refresh failed for ya29.aVeryLongAccessTokenValue123")

        assertFalse(scrubbed.contains("ya29.aVeryLongAccessTokenValue123"))
        assertTrue(scrubbed.contains("<redacted>"))
    }

    @Test
    fun `scrub removes a client secret`() {
        val scrubbed = Redactor.scrub("client GOCSPX-AbCdEfGhIjKlMnOpQr")

        assertFalse(scrubbed.contains("GOCSPX-AbCdEfGhIjKlMnOpQr"))
    }

    @Test
    fun `scrub removes a refresh token`() {
        val scrubbed = Redactor.scrub("token=1//0abcdefghijklmnopqrstuvwxyz123456")

        assertFalse(scrubbed.contains("0abcdefghijklmnopqrstuvwxyz123456"))
    }

    @Test
    fun `scrub leaves ordinary text alone`() {
        val message = "listing failed for folder Documents after 3 attempts"

        assertEquals(message, Redactor.scrub(message))
    }
}
