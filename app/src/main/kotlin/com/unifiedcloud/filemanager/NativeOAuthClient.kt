package com.unifiedcloud.filemanager

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.longOrNull
import kotlinx.serialization.json.put
import okhttp3.FormBody
import okhttp3.OkHttpClient
import okhttp3.Request

/**
 * Performs native OAuth 2.0 + PKCE code exchange and refresh-token HTTP requests
 * outside the WebView using [OkHttpClient] and configured [BuildConfig] client IDs.
 */
internal class NativeOAuthClient(
    private val httpClient: OkHttpClient = OkHttpClient(),
) {
    private val json = Json { ignoreUnknownKeys = true }

    fun exchangeCode(
        provider: String,
        code: String,
        codeVerifier: String,
        redirectUri: String,
    ): String {
        val config = endpointFor(provider)
            ?: return errorJson("Provider $provider OAuth client ID is not configured in BuildConfig")
        if (code.isBlank() || codeVerifier.isBlank()) {
            return errorJson("Missing OAuth authorization code or PKCE verifier")
        }
        val body =
            FormBody.Builder()
                .add("grant_type", "authorization_code")
                .add("client_id", config.clientId)
                .add("code", code)
                .add("code_verifier", codeVerifier)
                .add("redirect_uri", redirectUri)
                .build()
        return executeTokenRequest(config.tokenEndpoint, body)
    }

    fun refreshToken(
        provider: String,
        refreshToken: String,
    ): String {
        val config = endpointFor(provider)
            ?: return errorJson("Provider $provider OAuth client ID is not configured in BuildConfig")
        if (refreshToken.isBlank()) {
            return errorJson("Missing refresh token")
        }
        val body =
            FormBody.Builder()
                .add("grant_type", "refresh_token")
                .add("client_id", config.clientId)
                .add("refresh_token", refreshToken)
                .build()
        return executeTokenRequest(config.tokenEndpoint, body)
    }

    private fun executeTokenRequest(
        tokenEndpoint: String,
        body: FormBody,
    ): String =
        runCatching {
            val request =
                Request.Builder()
                    .url(tokenEndpoint)
                    .post(body)
                    .build()
            httpClient.newCall(request).execute().use { response ->
                val rawBody = response.body?.string().orEmpty()
                if (!response.isSuccessful) {
                    return errorJson("OAuth token endpoint returned HTTP ${response.code}")
                }
                val parsed = json.parseToJsonElement(rawBody).jsonObject
                buildJsonObject {
                    put("ok", true)
                    put("accessToken", parsed["access_token"]?.jsonPrimitive?.content.orEmpty())
                    put("refreshToken", parsed["refresh_token"]?.jsonPrimitive?.content.orEmpty())
                    put(
                        "expiresInSeconds",
                        parsed["expires_in"]?.jsonPrimitive?.longOrNull ?: DEFAULT_EXPIRES_SEC,
                    )
                    put("scope", parsed["scope"]?.jsonPrimitive?.content.orEmpty())
                }.toString()
            }
        }.getOrElse { err ->
            errorJson(err.message ?: "OAuth token network error")
        }

    private fun endpointFor(provider: String): OAuthProviderEndpoint? =
        when (provider.uppercase()) {
            "GOOGLE_DRIVE" ->
                BuildConfig.GOOGLE_OAUTH_CLIENT_ID.takeIf { it.isNotBlank() }?.let {
                    OAuthProviderEndpoint(it, "https://oauth2.googleapis.com/token")
                }
            "ONE_DRIVE" ->
                BuildConfig.ONEDRIVE_CLIENT_ID.takeIf { it.isNotBlank() }?.let {
                    OAuthProviderEndpoint(it, "https://login.microsoftonline.com/common/oauth2/v2.0/token")
                }
            "DROPBOX" ->
                BuildConfig.DROPBOX_CLIENT_ID.takeIf { it.isNotBlank() }?.let {
                    OAuthProviderEndpoint(it, "https://api.dropboxapi.com/oauth2/token")
                }
            "BOX" ->
                BuildConfig.BOX_CLIENT_ID.takeIf { it.isNotBlank() }?.let {
                    OAuthProviderEndpoint(it, "https://api.box.com/oauth2/token")
                }
            else -> null
        }

    private fun errorJson(message: String): String =
        buildJsonObject {
            put("ok", false)
            put("error", message)
        }.toString()

    private data class OAuthProviderEndpoint(
        val clientId: String,
        val tokenEndpoint: String,
    )

    companion object {
        private const val DEFAULT_EXPIRES_SEC = 3600L
    }
}
