package com.unifiedcloud.filemanager.domain.model

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * File identity rules (FI-05, FI-06, FI-07).
 *
 * Several of these invariants are enforced by the type system and cannot be
 * tested at runtime - a test that passes a `ProviderFileId` where a
 * `LocalAccountId` is expected does not compile, which is the point. The tests
 * below cover the parts that remain runtime-observable.
 */
class FileRefTest {

    private val google = ProviderId.GOOGLE_DRIVE

    @Test
    fun `the same provider file in two accounts is two distinct files`() {
        // FI-07. A file shared with a second account must never be merged with
        // the first account's copy, or one account's view of a name change would
        // silently rewrite the other's.
        val fileId = ProviderFileId("abc123")

        val inAccountA = FileRef(google, LocalAccountId(1), fileId)
        val inAccountB = FileRef(google, LocalAccountId(2), fileId)

        assertNotEquals(inAccountA, inAccountB)
    }

    @Test
    fun `cache keys differ per account for the same file id`() {
        // FI-06. If this ever collided, one account's cached listing would be
        // served under another account.
        val fileId = ProviderFileId("abc123")

        val keyA = FileRef(google, LocalAccountId(1), fileId).cacheKey()
        val keyB = FileRef(google, LocalAccountId(2), fileId).cacheKey()

        assertNotEquals(keyA, keyB)
    }

    @Test
    fun `cache key includes the provider`() {
        val fileId = ProviderFileId("abc123")

        val key = FileRef(google, LocalAccountId(1), fileId).cacheKey()

        assertTrue(key.contains(ProviderId.GOOGLE_DRIVE.value))
    }

    @Test
    fun `cache key is stable for equal refs`() {
        val a = FileRef(google, LocalAccountId(7), ProviderFileId("x"))
        val b = FileRef(google, LocalAccountId(7), ProviderFileId("x"))

        assertEquals(a.cacheKey(), b.cacheKey())
    }

    @Test
    fun `local account id does not print as a real account identifier`() {
        // LG-3. The id is local, and a log line should not look like a Google
        // account id.
        assertEquals("acct#1", LocalAccountId(1).toString())
    }

    @Test
    fun `provider file id is truncated in output`() {
        val printed = ProviderFileId("verylongproviderfileidentifier123456").toString()

        assertTrue(printed.startsWith("file(verylo"))
        assertTrue("should not print the whole id: $printed", printed.length < 30)
    }

    @Test(expected = IllegalArgumentException::class)
    fun `a blank provider file id is rejected`() {
        ProviderFileId("   ")
    }

    @Test(expected = IllegalArgumentException::class)
    fun `a non-positive local account id is rejected`() {
        LocalAccountId(0)
    }

    @Test(expected = IllegalArgumentException::class)
    fun `a blank provider id is rejected`() {
        ProviderId("")
    }
}

/**
 * The quota type must never be shaped in a way that invites an "upgrade" claim.
 * Rules.md §1 and PS-1/PS-2 are contractual, so the guard is asserted.
 */
class QuotaUsageTest {

    @Test
    fun `description attributes usage to the provider, not to this app`() {
        val usage = QuotaUsage(
            providerId = ProviderId.GOOGLE_DRIVE,
            usedBytes = 12_000_000_000,
            limitBytes = 15_000_000_000,
            manageUrl = null,
        )

        val text = usage.describe()

        assertTrue("must name Drive: $text", text.contains("Google Drive"))
        assertTrue("must state both figures: $text", text.contains("11.2 GB"))
        assertTrue("must state the limit: $text", text.contains("14.0 GB"))
    }

    @Test
    fun `description contains no banned storage language`() {
        val usage = QuotaUsage(ProviderId.GOOGLE_DRIVE, 5_000_000_000, 15_000_000_000, null)
        val text = usage.describe().lowercase()

        listOf("unlimited", "extra", "free", "added", "upgrade", "more storage")
            .forEach { banned ->
                assertTrue("'$banned' in: $text", !text.contains(banned))
            }
    }

    @Test
    fun `unknown limit still describes usage without inventing one`() {
        val usage = QuotaUsage(ProviderId.GOOGLE_DRIVE, 5_000_000_000, null, null)

        assertFalse(usage.isKnown)
        assertTrue(usage.describe().contains("Google Drive"))
    }
}
