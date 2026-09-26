package com.unifiedcloud.filemanager.data.db

import androidx.room.Room
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.unifiedcloud.filemanager.data.db.dao.AccountDao
import com.unifiedcloud.filemanager.data.db.dao.FileDao
import com.unifiedcloud.filemanager.data.db.entity.ConnectedAccountEntity
import com.unifiedcloud.filemanager.data.db.entity.FavoriteFileEntity
import com.unifiedcloud.filemanager.data.db.entity.FileMetadataEntity
import com.unifiedcloud.filemanager.data.db.entity.SyncStateEntity
import com.unifiedcloud.filemanager.data.db.mapper.FileSyncState
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.test.runTest
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith

/**
 * The M1…M16 multi-account isolation matrix (`Architecture.md` §27), exercised
 * against a real Room database and real SQLite.
 *
 * ## Why this is an instrumented test and not a unit test with a fake
 *
 * Per decision D-1.10, no `FakeCloudProvider` exists (FP-1 forbids one), and a
 * mock would only prove the mock's own behaviour. The claim under test is about
 * the *schema* and the *queries*: can a row written under account A ever be
 * returned by a query issued for account B? That question is only answerable
 * against the actual constraint and index definitions, which is what this does.
 *
 * It runs on a device or emulator because Room's generated code needs a real
 * SQLite. The assertions are deliberately about observable behaviour - what comes
 * back - rather than about SQL text.
 */
@RunWith(AndroidJUnit4::class)
class AccountIsolationMatrixTest {

    private lateinit var db: AppDatabase
    private lateinit var accounts: AccountDao
    private lateinit var files: FileDao

    private var accountA: Long = 0
    private var accountB: Long = 0

    @Before
    fun setUp() = runTest {
        db = Room.inMemoryDatabaseBuilder(
            ApplicationProvider.getApplicationContext(),
            AppDatabase::class.java,
        ).build()

        accounts = db.accountDao()
        files = db.fileDao()

        accountA = insertAccount(providerAccountId = "google-user-a@example.com")
        accountB = insertAccount(providerAccountId = "google-user-b@example.com")
    }

    @After
    fun tearDown() {
        db.close()
    }

    // -----------------------------------------------------------------------
    // Identity
    // -----------------------------------------------------------------------

    /** M-1/M-2: two accounts are distinct rows with distinct local ids. */
    @Test
    fun m1_twoAccountsAreDistinctRows() = runTest {
        assertTrue(accountA != accountB)
        assertEquals(2, accounts.count())
    }

    /**
     * The UNIQUE(accountId, fileId) constraint is what makes FI-07 structural, so
     * it is asserted directly: the same provider file id may exist under two
     * accounts, and re-upserting the same account/file pair must not duplicate.
     */
    @Test
    fun m2_sameProviderFileInTwoAccountsIsTwoRows() = runTest {
        files.upsert(file(accountA, "shared-file-id"))
        files.upsert(file(accountB, "shared-file-id"))

        assertNotNull(files.findByFileId(accountA, "shared-file-id"))
        assertNotNull(files.findByFileId(accountB, "shared-file-id"))

        // Same provider file id, different accounts, different rows.
        val rowsA = files.observeChildren(accountA, "folder-1").first()
        val rowsB = files.observeChildren(accountB, "folder-1").first()
        assertEquals(1, rowsA.size)
        assertEquals(1, rowsB.size)
    }

    @Test
    fun m3_upsertForSameAccountAndFileIsIdempotent() = runTest {
        files.upsert(file(accountA, "f1", name = "first"))
        files.upsert(file(accountA, "f1", name = "renamed"))

        val rows = files.observeChildren(accountA, "folder-1").first()
        assertEquals("re-upsert must update, not duplicate", 1, rows.size)
        assertEquals("renamed", rows.single().name)
    }

    // -----------------------------------------------------------------------
    // Read isolation
    // -----------------------------------------------------------------------

    /** M-4: a listing for account A never contains account B's files. */
    @Test
    fun m4_listingNeverLeaksAcrossAccounts() = runTest {
        files.upsert(file(accountA, "a-only", name = "alice-report.pdf"))
        files.upsert(file(accountB, "b-only", name = "bob-private.pdf"))

        val forA = files.observeChildren(accountA, "folder-1").first()

        assertEquals(1, forA.size)
        assertEquals("alice-report.pdf", forA.single().name)
    }

    /** M-5: point lookups are account-scoped in both directions. */
    @Test
    fun m5_pointLookupIsAccountScoped() = runTest {
        files.upsert(file(accountA, "only-in-a"))

        assertNotNull(files.findByFileId(accountA, "only-in-a"))
        assertNull(
            "account B must not resolve account A's file id",
            files.findByFileId(accountB, "only-in-a"),
        )
    }

    /** M-6: the media query is scoped, so the gallery cannot mix accounts. */
    @Test
    fun m6_mediaQueryIsAccountScoped() = runTest {
        files.upsert(file(accountA, "img-a", mimeType = "image/png"))
        files.upsert(file(accountB, "img-b", mimeType = "image/png"))
        files.upsert(file(accountB, "vid-b", mimeType = "video/mp4"))

        assertEquals(1, files.observeMedia(accountA, 50).first().size)
        assertEquals(2, files.observeMedia(accountB, 50).first().size)
    }

    /** M-7: trash view is scoped. */
    @Test
    fun m7_trashViewIsAccountScoped() = runTest {
        files.upsert(file(accountA, "a-trashed", trashed = true))
        files.upsert(file(accountB, "b-trashed", trashed = true))

        assertEquals(
            listOf("a-trashed"),
            files.observeTrashed(accountA).first().map { it.fileId },
        )
    }

    /** M-8: local search is scoped. */
    @Test
    fun m8_localSearchIsAccountScoped() = runTest {
        files.upsert(file(accountA, "a1", name = "quarterly-report.pdf"))
        files.upsert(file(accountB, "b1", name = "quarterly-report.pdf"))
        files.upsert(file(accountB, "b2", name = "quarterly-secret.pdf"))

        val results = files.searchByNameLocally(accountA, "quarterly", 50)

        assertEquals(1, results.size)
        assertEquals(accountA, results.single().accountId)
    }

    // -----------------------------------------------------------------------
    // Write isolation
    // -----------------------------------------------------------------------

    /**
     * M-9: deleting a file in one account must not touch the same provider file
     * id in the other. This is the write-side counterpart of the UNIQUE index, and
     * the one a `REPLACE` strategy or a missing `account_id` predicate would
     * break.
     */
    @Test
    fun m9_deleteIsAccountScoped() = runTest {
        files.upsert(file(accountA, "shared-id"))
        files.upsert(file(accountB, "shared-id"))

        files.deleteByFileId(accountA, "shared-id")

        assertNull(files.findByFileId(accountA, "shared-id"))
        assertNotNull(
            "account B's row must survive account A's delete",
            files.findByFileId(accountB, "shared-id"),
        )
    }

    /** M-10: page-token invalidation is per account. */
    @Test
    fun m10_pageTokenInvalidationIsAccountScoped() = runTest {
        files.upsertSyncState(syncState(accountA, "folder-1", "token-a"))
        files.upsertSyncState(syncState(accountB, "folder-1", "token-b"))

        files.invalidatePageTokens(accountA)

        assertNull(files.findSyncState(accountA, "folder-1"))
        assertNotNull(files.findSyncState(accountB, "folder-1"))
    }

    /** M-11: clearing cached files is per account. */
    @Test
    fun m11_clearCachedFilesIsAccountScoped() = runTest {
        files.upsert(file(accountA, "a1"))
        files.upsert(file(accountB, "b1"))

        files.clearCachedFiles(accountA)

        assertTrue(files.observeChildren(accountA, "folder-1").first().isEmpty())
        assertEquals(1, files.observeChildren(accountB, "folder-1").first().size)
    }

    // -----------------------------------------------------------------------
    // Cascade isolation
    // -----------------------------------------------------------------------

    /**
     * M-12: disconnecting an account removes its cached rows and its tokens, and
     * leaves the other account's untouched. This is the observable half of the
     * disconnect guarantee; the other half - that key material is actually gone -
     * is AR-15 and cannot be asserted here.
     */
    @Test
    fun m12_cascadeOnDisconnectIsAccountScoped() = runTest {
        files.upsert(file(accountA, "a1"))
        files.upsert(file(accountB, "b1"))

        accounts.deleteById(accountA)

        assertTrue(files.observeChildren(accountA, "folder-1").first().isEmpty())
        assertNull(accounts.findById(accountA))
        assertEquals(1, files.observeChildren(accountB, "folder-1").first().size)
        assertNotNull(accounts.findById(accountB))
    }

    // -----------------------------------------------------------------------
    // Bounded collections
    // -----------------------------------------------------------------------

    /**
     * M-13: recents pruning is bounded *and* per account. A prune that ignored the
     * account would let one account's activity evict another's history, which is
     * both a data-loss bug and an isolation leak.
     */
    @Test
    fun m13_recentsPruningIsBoundedAndAccountScoped() = runTest {
        // Account A is over the bound; account B is well under it.
        repeat(5) { i -> files.recordAccess(accountA, "a$i", at = i.toLong(), max = 3) }
        repeat(2) { i -> files.recordAccess(accountB, "b$i", at = i.toLong(), max = 3) }

        val recentsA = files.observeRecent(accountA, limit = 50, offset = 0).first()
        val recentsB = files.observeRecent(accountB, limit = 50, offset = 0).first()

        assertEquals(3, recentsA.size)
        assertEquals("account B's recents must not be evicted by A's pruning", 2, recentsB.size)
        assertTrue(recentsB.all { it.accountId == accountB })
    }

    /** M-14: recents ordering is most-recent-first within one account. */
    @Test
    fun m14_recentsAreOrderedNewestFirst() = runTest {
        files.recordAccess(accountA, "old", at = 1_000, max = 10)
        files.recordAccess(accountA, "new", at = 9_000, max = 10)

        val recents = files.observeRecent(accountA, limit = 50, offset = 0).first()

        assertEquals(listOf("new", "old"), recents.map { it.fileId })
    }

    /** M-15: favourites are account-scoped, so starring in one account is invisible in the other. */
    @Test
    fun m15_favouritesAreAccountScoped() = runTest {
        files.upsert(file(accountA, "f1"))
        files.upsert(file(accountB, "f1"))
        files.upsertFavorite(FavoriteFileEntity(accountA, "f1", 1_000))

        assertEquals(1, files.observeFavorites(accountA).first().size)
        assertTrue(files.observeFavorites(accountB).first().isEmpty())
    }

    /**
     * M-16: `findByLocalId` is account-scoped. The surrogate primary key is
     * globally unique, so an unscoped lookup by local id would in fact succeed -
     * which is precisely why the account predicate has to be there deliberately
     * rather than incidentally.
     */
    @Test
    fun m16_localIdLookupIsAccountScoped() = runTest {
        val rowA = file(accountA, "a1")
        files.upsert(rowA)
        val localId = files.observeChildren(accountA, "folder-1").first().single().localId

        assertNotNull(files.findByLocalId(accountA, localId))
        assertNull(
            "account B must not resolve account A's local id",
            files.findByLocalId(accountB, localId),
        )
    }

    // -----------------------------------------------------------------------
    // Helpers
    // -----------------------------------------------------------------------

    private suspend fun insertAccount(providerAccountId: String): Long = accounts.insert(
        ConnectedAccountEntity(
            provider = "GOOGLE_DRIVE",
            providerAccountId = providerAccountId,
            displayEmail = providerAccountId,
            isActive = true,
            connectedAt = 0,
        ),
    )

    private fun file(
        accountId: Long,
        fileId: String,
        name: String = "$fileId.txt",
        mimeType: String = "text/plain",
        trashed: Boolean = false,
    ) = FileMetadataEntity(
        accountId = accountId,
        fileId = fileId,
        name = name,
        mimeType = mimeType,
        sizeBytes = 128,
        modifiedAt = 1_700_000_000_000,
        isFolder = false,
        parentFileId = "folder-1",
        isShared = false,
        isOwnedByUser = true,
        isStarred = false,
        trashed = trashed,
        syncState = FileSyncState.SYNCED.name,
    )

    private fun syncState(accountId: Long, scopeKey: String, token: String) =
        SyncStateEntity(
            accountId = accountId,
            scopeKey = scopeKey,
            nextPageToken = token,
            lastSyncedAt = 1_700_000_000_000,
        )
}
