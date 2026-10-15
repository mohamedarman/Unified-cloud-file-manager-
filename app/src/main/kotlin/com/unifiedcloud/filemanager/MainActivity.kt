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

private const val LOCAL_HOST = "unifiedcloud.local"
private const val APP_URL = "https://$LOCAL_HOST/index.html"

@SuppressLint("SetJavaScriptEnabled")
@Composable
fun AppWebView() {
    AndroidView(
        modifier = Modifier.fillMaxSize(),
        factory = { context ->
            WebView(context).apply {
                settings.apply {
                    javaScriptEnabled = true
                    domStorageEnabled = true
                    databaseEnabled = true
                    allowFileAccess = true
                    allowContentAccess = true
                    allowFileAccessFromFileURLs = true
                    allowUniversalAccessFromFileURLs = true
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
                            return uri.host != LOCAL_HOST && uri.scheme != "file"
                        }

                        override fun shouldInterceptRequest(
                            view: WebView?,
                            request: WebResourceRequest?,
                        ): WebResourceResponse? {
                            val uri = request?.url ?: return null
                            if (uri.host == LOCAL_HOST) {
                                val rawPath = uri.path?.takeIf { it.isNotEmpty() && it != "/" } ?: "/index.html"
                                val assetPath = rawPath.removePrefix("/")
                                val mime = resolveMimeType(assetPath)
                                return runCatching {
                                    WebResourceResponse(mime, "UTF-8", context.assets.open(assetPath))
                                }.getOrElse {
                                    runCatching {
                                        WebResourceResponse("text/html", "UTF-8", context.assets.open("index.html"))
                                    }.getOrNull()
                                }
                            }
                            return super.shouldInterceptRequest(view, request)
                        }
                    }

                loadUrl(APP_URL)
            }
        },
    )
}

private fun resolveMimeType(path: String): String {
    return when {
        path.endsWith(".html") -> "text/html"
        path.endsWith(".js") || path.endsWith(".mjs") -> "application/javascript"
        path.endsWith(".css") -> "text/css"
        path.endsWith(".svg") -> "image/svg+xml"
        path.endsWith(".png") -> "image/png"
        path.endsWith(".jpg") || path.endsWith(".jpeg") -> "image/jpeg"
        path.endsWith(".json") -> "application/json"
        path.endsWith(".ico") -> "image/x-icon"
        path.endsWith(".woff2") -> "font/woff2"
        else -> "application/octet-stream"
    }
}


