package com.unifiedcloud.filemanager.cloud.google.drive

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * `Rules.md` QD-2, `Architecture.md` §11.1.1.
 *
 * The drift test at the bottom is the one that matters. `ALLOWED` and the
 * request constants have to agree, and nothing but a test makes them: a field
 * added to `FILE_LIST` without being added to `ALLOWED` would otherwise be
 * rejected by the app's own guard on the next call, or - worse - quietly
 * tolerated until someone reads the constant and wonders what it is doing.
 */
class DriveFieldsTest {

    private val listFields = DriveFields.parseFields(DriveFields.FILE_LIST)
    private val metadataFields = DriveFields.parseFields(DriveFields.FILE_METADATA)
    private val aboutFields = DriveFields.parseFields(DriveFields.ABOUT)

    // --- the shipped constants satisfy the policy ---------------------------

    @Test
    fun `the list fields constant passes its own allowlist check`() {
        DriveFields.requireFieldsAllowed(DriveFields.FILE_LIST)
    }

    @Test
    fun `the metadata fields constant passes its own allowlist check`() {
        DriveFields.requireFieldsAllowed(DriveFields.FILE_METADATA)
    }

    @Test
    fun `the about fields constant passes its own allowlist check`() {
        DriveFields.requireFieldsAllowed(DriveFields.ABOUT)
    }

    // --- drift between the constants and the allowlist ----------------------

    @Test
    fun `every field the constants request is on the allowlist`() {
        val requested = listFields + metadataFields + aboutFields

        assertEquals(
            "DriveFields.ALLOWED is missing fields the request constants use",
            emptySet<String>(),
            requested - DriveFields.ALLOWED,
        )
    }

    @Test
    fun `the allowlist holds no field no constant requests`() {
        // Not a defect on its own - a field may be allowlisted for a call not yet
        // written - but an entry nothing can reach is a hint the list and the
        // code have drifted apart, so it is surfaced rather than left to rot.
        val reachable = listFields + metadataFields + aboutFields

        assertTrue(
            "unreachable allowlist entries: ${(DriveFields.ALLOWED - reachable).sorted()}",
            (DriveFields.ALLOWED - reachable).isEmpty(),
        )
    }

    // --- QD-2: over-fetching is refused -------------------------------------

    @Test
    fun `a field outside the allowlist is refused`() {
        val overreaching = listOf(
            "files(id,version)",
            "files(id,properties)",
            "files(id,permissions)",
            "files(id,lastModifyingUser)",
            "files(*)",
            "*",
        )

        overreaching.forEach { fields ->
            val refused = runCatching { DriveFields.requireFieldsAllowed(fields) }
            assertTrue("expected <$fields> to be refused", refused.isFailure)
        }
    }

    @Test
    fun `the refusal names the offending field`() {
        // A guard that says only "invalid" sends the next person looking in the
        // wrong place.
        val thrown = runCatching { DriveFields.requireFieldsAllowed("files(id,quotaBytesUsed)") }
            .exceptionOrNull()

        assertTrue(thrown is IllegalArgumentException)
        assertTrue(
            "message should name the field, was: ${thrown?.message}",
            thrown?.message?.contains("quotaBytesUsed") == true,
        )
    }

    @Test
    fun `one allowed field does not excuse an unallowed sibling`() {
        val refused = runCatching { DriveFields.requireFieldsAllowed("nextPageToken,files(id,exportLinks)") }

        assertTrue(refused.isFailure)
    }

    // --- parsing ------------------------------------------------------------

    @Test
    fun `the files wrapper and whitespace are tolerated`() {
        val messy = "  nextPageToken , files( id , name )  "

        assertEquals(setOf("nextPageToken", "id", "name"), DriveFields.parseFields(messy))
    }

    @Test
    fun `an empty expression yields no fields rather than a blank entry`() {
        assertEquals(emptySet<String>(), DriveFields.parseFields(""))
        assertEquals(emptySet<String>(), DriveFields.parseFields("files()"))
    }

    // --- pagination contract -------------------------------------------------

    @Test
    fun `the list fields include nextPageToken`() {
        // Page treats a null nextPageToken as the definition of "no more
        // results". Omitting it makes a listing stop after one page with nothing
        // to indicate that it did.
        assertTrue("pagination token missing from $listFields", "nextPageToken" in listFields)
    }

    @Test
    fun `the single-file fields carry no pagination token`() {
        assertFalse("a files.get has no pages", "nextPageToken" in metadataFields)
    }

    // --- the list is the architecture's, not a guess -------------------------

    @Test
    fun `the list fields match Architecture 11_1_1 exactly`() {
        // Transcribed from the representative list call. If a field is added or
        // removed, this test is the reminder that §11.1.1 should be updated in
        // the same change (Rules.md DC-1, PR-12).
        val expected = setOf(
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
        )

        assertEquals(expected, listFields)
    }

    @Test
    fun noFieldIsRequestedTwice() {
        // Drive rejects a repeated field, and a duplicate is the usual symptom of
        // a `fields` string assembled by appending at several call sites.
        val duplicates = DriveFields.FILE_LIST
            .removePrefix("nextPageToken,")
            .removeSurrounding("files(", ")")
            .split(',')
            .groupingBy { it }
            .eachCount()
            .filterValues { it > 1 }
            .keys

        assertEquals(emptySet<String>(), duplicates)
    }

    @Test
    fun `per-file capabilities are requested so a scope downgrade degrades`() {
        // PC-7: the UI renders available actions from capabilities(), never from
        // a hardcoded list. That only works if the capabilities are fetched.
        val capabilities = listFields.filter { it.startsWith("capabilities/") }

        assertEquals(4, capabilities.size)
        assertTrue("capabilities/canShare" in capabilities)
    }

    // --- QD-8: corpora and spaces are pinned --------------------------------

    @Test
    fun `corpora and spaces are constrained to the out-of-scope-safe values`() {
        // R-22: shared drives are out of MVP scope and leakage into unified
        // results is a real risk. corpora=user and spaces=drive are what exclude
        // them, so they are pinned rather than left to the provider's default.
        assertEquals("user", DriveFields.CORPORA_USER)
        assertEquals("drive", DriveFields.SPACES_DRIVE)
    }

    // --- QD-3: bounded pages ------------------------------------------------

    @Test
    fun `the page size is bounded and within the domain ceiling`() {
        assertTrue(DriveFields.PAGE_SIZE > 0)
        assertTrue(
            "page size ${DriveFields.PAGE_SIZE} exceeds the domain maximum",
            DriveFields.PAGE_SIZE <= 200,
        )
    }
}
