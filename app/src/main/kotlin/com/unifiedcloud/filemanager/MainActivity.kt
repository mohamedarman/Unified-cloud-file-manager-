package com.unifiedcloud.filemanager

import android.annotation.SuppressLint
import android.os.Bundle
import android.util.Log
import android.webkit.ConsoleMessage
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
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
import java.io.InputStream

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

private const val TAG = "UnifiedCloudWebView"
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

                webChromeClient = object : WebChromeClient() {
                    override fun onConsoleMessage(consoleMessage: ConsoleMessage?): Boolean {
                        val msg = consoleMessage?.message() ?: ""
                        val source = consoleMessage?.sourceId() ?: ""
                        val line = consoleMessage?.lineNumber() ?: 0
                        Log.d(TAG, "[$source:$line] $msg")
                        return true
                    }
                }

                webViewClient = object : WebViewClient() {
                    override fun shouldOverrideUrlLoading(
                        view: WebView?,
                        request: WebResourceRequest?,
                    ): Boolean {
                        val uri = request?.url ?: return false
                        val host = uri.host
                        if (host == LOCAL_HOST || uri.scheme == "file") {
                            return false
                        }
                        return false
                    }

                    override fun shouldInterceptRequest(
                        view: WebView?,
                        request: WebResourceRequest?,
                    ): WebResourceResponse? {
                        val uri = request?.url ?: return null
                        if (uri.host == LOCAL_HOST) {
                            var rawPath = uri.path ?: "/index.html"
                            if (rawPath.isEmpty() || rawPath == "/") {
                                rawPath = "/index.html"
                            }
                            val assetPath = rawPath.removePrefix("/")
                            return try {
                                val stream: InputStream = context.assets.open(assetPath)
                                val mimeType = getMimeType(assetPath)
                                WebResourceResponse(mimeType, "UTF-8", stream)
                            } catch (e: Exception) {
                                Log.w(TAG, "Asset not found: $assetPath, fallback to index.html")
                                try {
                                    val stream: InputStream = context.assets.open("index.html")
                                    WebResourceResponse("text/html", "UTF-8", stream)
                                } catch (e2: Exception) {
                                    Log.e(TAG, "Failed loading index.html fallback", e2)
                                    null
                                }
                            }
                        }
                        return super.shouldInterceptRequest(view, request)
                    }

                    override fun onReceivedError(
                        view: WebView?,
                        request: WebResourceRequest?,
                        error: WebResourceError?,
                    ) {
                        Log.e(TAG, "WebView error: ${request?.url} code=${error?.errorCode} desc=${error?.description}")
                    }
                }

                loadUrl(APP_URL)
            }
        },
    )
}

private fun getMimeType(path: String): String {
    return when {
        path.endsWith(".html", ignoreCase = true) -> "text/html"
        path.endsWith(".js", ignoreCase = true) || path.endsWith(".mjs", ignoreCase = true) -> "application/javascript"
        path.endsWith(".css", ignoreCase = true) -> "text/css"
        path.endsWith(".svg", ignoreCase = true) -> "image/svg+xml"
        path.endsWith(".png", ignoreCase = true) -> "image/png"
        path.endsWith(".jpg", ignoreCase = true) || path.endsWith(".jpeg", ignoreCase = true) -> "image/jpeg"
        path.endsWith(".gif", ignoreCase = true) -> "image/gif"
        path.endsWith(".webp", ignoreCase = true) -> "image/webp"
        path.endsWith(".json", ignoreCase = true) -> "application/json"
        path.endsWith(".ico", ignoreCase = true) -> "image/x-icon"
        path.endsWith(".woff", ignoreCase = true) -> "font/woff"
        path.endsWith(".woff2", ignoreCase = true) -> "font/woff2"
        path.endsWith(".ttf", ignoreCase = true) -> "font/ttf"
        else -> "application/octet-stream"
    }
}

