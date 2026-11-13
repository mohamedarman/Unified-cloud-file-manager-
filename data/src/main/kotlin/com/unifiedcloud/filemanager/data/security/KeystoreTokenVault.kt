package com.unifiedcloud.filemanager.data.security

import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import com.unifiedcloud.filemanager.data.db.entity.TokenSetEntity
import com.unifiedcloud.filemanager.domain.model.LocalAccountId
import kotlinx.coroutines.sync.Mutex
import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import java.security.KeyStore
import java.util.concurrent.ConcurrentHashMap
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

/**
 * Decrypted OAuth token payload held only in memory while executing a provider request.
 */
@Serializable
data class DecryptedTokenPayload(
    val accessToken: String,
    val refreshToken: String? = null,
    val expiresAtEpochMillis: Long? = null,
    val grantedScopes: Set<String> = emptySet(),
)

/**
 * Encrypts and decrypts OAuth credentials at rest using Android Keystore AES-256-GCM
 * (`TokenSetEntity.ciphertext` + `TokenSetEntity.iv`), and provides a per-account
 * refresh [Mutex] to guarantee single-flight token refresh per account (SM-1).
 */
class KeystoreTokenVault(
    private val secretKeyProvider: () -> SecretKey = ::loadOrCreateAndroidKeystoreKey,
) {
    private val refreshMutexes = ConcurrentHashMap<Long, Mutex>()
    private val json = Json { ignoreUnknownKeys = true }

    /**
     * Returns the single-flight refresh mutex dedicated to [accountId].
     */
    fun refreshMutexFor(accountId: LocalAccountId): Mutex =
        refreshMutexes.computeIfAbsent(accountId.value) { Mutex() }

    /**
     * Encrypts [payload] into a [TokenSetEntity] ready for Room persistence.
     */
    fun encrypt(
        accountId: LocalAccountId,
        payload: DecryptedTokenPayload,
        updatedAtMillis: Long,
    ): TokenSetEntity {
        val cipher = Cipher.getInstance(TRANSFORMATION)
        cipher.init(Cipher.ENCRYPT_MODE, secretKeyProvider())
        val plaintext = json.encodeToString(payload).encodeToByteArray()
        val ciphertext = cipher.doFinal(plaintext)
        return TokenSetEntity(
            accountId = accountId.value,
            ciphertext = ciphertext,
            iv = cipher.iv,
            expiresAt = payload.expiresAtEpochMillis,
            createdAt = updatedAtMillis,
        )
    }

    /**
     * Decrypts a [TokenSetEntity] back into a [DecryptedTokenPayload].
     */
    fun decrypt(entity: TokenSetEntity): DecryptedTokenPayload {
        val cipher = Cipher.getInstance(TRANSFORMATION)
        val spec = GCMParameterSpec(GCM_TAG_LENGTH_BITS, entity.iv)
        cipher.init(Cipher.DECRYPT_MODE, secretKeyProvider(), spec)
        val plaintext = cipher.doFinal(entity.ciphertext)
        return json.decodeFromString(plaintext.decodeToString())
    }

    /**
     * Clears any cached refresh mutex state when an account is disconnected.
     */
    fun removeAccountMutex(accountId: LocalAccountId) {
        refreshMutexes.remove(accountId.value)
    }

    companion object {
        private const val ANDROID_KEYSTORE = "AndroidKeyStore"
        private const val KEY_ALIAS = "ucfm_oauth_token_master_key_v1"
        private const val TRANSFORMATION = "AES/GCM/NoPadding"
        private const val GCM_TAG_LENGTH_BITS = 128
        private const val KEY_SIZE_BITS = 256

        private val fallbackJvmKey: SecretKey by lazy {
            val generator = KeyGenerator.getInstance("AES")
            generator.init(KEY_SIZE_BITS)
            generator.generateKey()
        }

        fun loadOrCreateAndroidKeystoreKey(): SecretKey =
            runCatching {
                val keyStore = KeyStore.getInstance(ANDROID_KEYSTORE).apply { load(null) }
                val existing = keyStore.getEntry(KEY_ALIAS, null) as? KeyStore.SecretKeyEntry
                if (existing != null) {
                    existing.secretKey
                } else {
                    val keyGenerator =
                        KeyGenerator.getInstance(
                            KeyProperties.KEY_ALGORITHM_AES,
                            ANDROID_KEYSTORE,
                        )
                    val spec =
                        KeyGenParameterSpec
                            .Builder(
                                KEY_ALIAS,
                                KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT,
                            ).setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                            .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                            .setKeySize(KEY_SIZE_BITS)
                            .build()
                    keyGenerator.init(spec)
                    keyGenerator.generateKey()
                }
            }.getOrElse { fallbackJvmKey }
    }
}
