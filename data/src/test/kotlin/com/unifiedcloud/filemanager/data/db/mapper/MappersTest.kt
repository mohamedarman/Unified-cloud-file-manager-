package com.unifiedcloud.filemanager.data.db.mapper

import com.unifiedcloud.filemanager.data.db.entity.ConnectedAccountEntity
import com.unifiedcloud.filemanager.data.db.entity.FileMetadataEntity
import com.unifiedcloud.filemanager.data.security.DecryptedTokenPayload
import com.unifiedcloud.filemanager.data.security.KeystoreTokenVault
import com.unifiedcloud.filemanager.domain.model.Freshness
import com.unifiedcloud.filemanager.domain.model.LocalAccountId
import com.unifiedcloud.filemanager.domain.model.ProviderFileId
import com.unifiedcloud.filemanager.domain.model.ProviderId
import org.junit.Assert.assertEquals
import org.junit.Assert.assertSame
import org.junit.Assert.assertTrue
import org.junit.Test

class MappersTest {
    @Test
    fun `FileSyncState maps to expected Freshness`() {
        assertEquals(Freshness.FRESH, FileSyncState.SYNCED.toFreshness())
        assertEquals(Freshness.STALE, FileSyncState.SYNCING.toFreshness())
        assertEquals(Freshness.STALE, FileSyncState.FAILED.toFreshness())
        assertEquals(Freshness.NONE, FileSyncState.PENDING.toFreshness())
        assertEquals(Freshness.NONE, FileSyncState.DELETED.toFreshness())
    }

    @Test
    fun `ConnectedAccountEntity maps to Domain AccountRef and rejects non-positive localId`() {
        val valid =
            ConnectedAccountEntity(
                localId = 3L,
                provider = "GOOGLE_DRIVE",
                providerAccountId = "sub_123",
                displayEmail = "alice@example.com",
                displayName = "Alice",
                avatarUrl = null,
                createdAt = 1_000L,
            )
        val mapped = valid.toDomain(ProviderId.GOOGLE_DRIVE)
        assertTrue(mapped.isSuccess)
        assertEquals(LocalAccountId(3L), mapped.getOrThrow().localId)
        assertEquals("alice@example.com", mapped.getOrThrow().displayEmail)

        val invalid = valid.copy(localId = 0L)
        assertTrue(invalid.toDomain(ProviderId.GOOGLE_DRIVE).isFailure)
    }

    @Test
    fun `FileMetadataEntity round-trips with CloudFile preserving account isolation`() {
        val entity =
            FileMetadataEntity(
                localId = 10L,
                accountId = 2L,
                fileId = "provider_file_99",
                name = "Architecture.pdf",
                mimeType = "application/pdf",
                sizeBytes = 4_096L,
                modifiedAt = 1_700_000_000_000L,
                isFolder = false,
                parentFileId = "root_folder",
                isShared = true,
                isOwnedByUser = true,
                isStarred = true,
                trashed = false,
                isOfflineAvailable = true,
                syncState = FileSyncState.SYNCED.name,
            )
        val domainFile = entity.toDomain(ProviderId.ONE_DRIVE)
        assertEquals(ProviderId.ONE_DRIVE, domainFile.ref.provider)
        assertEquals(LocalAccountId(2L), domainFile.ref.accountId)
        assertEquals(ProviderFileId("provider_file_99"), domainFile.ref.fileId)
        assertEquals("Architecture.pdf", domainFile.name)
        assertTrue(domainFile.isStarred)
        assertTrue(domainFile.isOfflineAvailable)

        val roundTripped = domainFile.toEntity(LocalAccountId(2L), FileSyncState.SYNCED)
        assertEquals(2L, roundTripped.accountId)
        assertEquals("provider_file_99", roundTripped.fileId)
        assertEquals("Architecture.pdf", roundTripped.name)
        assertEquals(4_096L, roundTripped.sizeBytes)
    }

    @Test
    fun `KeystoreTokenVault encrypts and decrypts token payloads and isolates per-account mutexes`() {
        val vault = KeystoreTokenVault()
        val accountA = LocalAccountId(1L)
        val accountB = LocalAccountId(2L)
        val payload =
            DecryptedTokenPayload(
                accessToken = "access_token_xyz",
                refreshToken = "refresh_token_abc",
                expiresAtEpochMillis = 1_800_000_000_000L,
                grantedScopes = setOf("https://www.googleapis.com/auth/drive"),
            )
        val encrypted = vault.encrypt(accountA, payload, updatedAtMillis = 1_700_000_000_000L)
        val decrypted = vault.decrypt(encrypted)

        assertEquals(payload.accessToken, decrypted.accessToken)
        assertEquals(payload.refreshToken, decrypted.refreshToken)
        assertEquals(payload.expiresAtEpochMillis, decrypted.expiresAtEpochMillis)
        assertEquals(payload.grantedScopes, decrypted.grantedScopes)
        assertSame(vault.refreshMutexFor(accountA), vault.refreshMutexFor(accountA))
        assertTrue(vault.refreshMutexFor(accountA) !== vault.refreshMutexFor(accountB))
    }
}
