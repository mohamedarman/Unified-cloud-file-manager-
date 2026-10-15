package com.unifiedcloud.filemanager

import android.annotation.SuppressLint
import android.os.Bundle
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.viewinterop.AndroidView
import androidx.webkit.WebViewAssetLoader

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        setContent {
            MaterialTheme {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = MaterialTheme.colorScheme.background,
                ) {
                    AppWebView()
                }
            }
        }
    }
}

private const val ASSET_DOMAIN = "appassets.androidplatform.net"
private const val APP_URL = "https://$ASSET_DOMAIN/assets/index.html"

@SuppressLint("SetJavaScriptEnabled")
@Composable
fun AppWebView() {
    AndroidView(
        modifier = Modifier.fillMaxSize(),
        factory = { context ->
            val assetLoader =
                WebViewAssetLoader.Builder()
                    .setDomain(ASSET_DOMAIN)
                    .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(context))
                    .build()

            WebView(context).apply {
                settings.apply {
                    javaScriptEnabled = true
                    domStorageEnabled = true
                    allowFileAccess = false
                    allowContentAccess = false
                    useWideViewPort = true
                    loadWithOverviewMode = true
                    mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
                    setSupportZoom(false)
                }

                webViewClient =
                    object : WebViewClient() {
                        override fun shouldOverrideUrlLoading(
                            view: WebView?,
                            request: WebResourceRequest?,
                        ): Boolean {
                            val uri = request?.url ?: return false
                            return uri.host != ASSET_DOMAIN
                        }

                        override fun shouldInterceptRequest(
                            view: WebView?,
                            request: WebResourceRequest?,
                        ): WebResourceResponse? {
                            val uri = request?.url ?: return null
                            return assetLoader.shouldInterceptRequest(uri)
                        }
                    }

                loadUrl(APP_URL)
            }
        },
    )
}



