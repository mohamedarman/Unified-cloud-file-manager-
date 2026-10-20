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
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
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
private const val TAG = "UnifiedCloudWebView"

// Constants for styling and configuration
private const val BACKGROUND_COLOR_HEX = 0xFF0F172A
private const val PROGRESS_INDICATOR_SIZE = 44
private const val STROKE_WIDTH = 3
private const val ERROR_TEXT_COLOR = 0xFFF87171
private const val TEXT_SECONDARY_COLOR = 0xFF94A3B8
private const val TEXT_PRIMARY_COLOR = 0xFFF8FAFC
private const val BUTTON_CONTAINER_COLOR = 0xFF0284C7
private const val TEXT_SIZE_TITLE = 17
private const val TEXT_SIZE_SUBTITLE = 13
private const val TEXT_SIZE_ERROR_TITLE = 18
private const val PROGRESS_INDICATOR_COLOR = 0xFF38BDF8
private const val SPACING_SMALL = 8
private const val SPACING_MEDIUM = 16
private const val SPACING_LARGE = 20
private const val PADDING_DEFAULT = 24

@SuppressLint("SetJavaScriptEnabled")
@Suppress("FunctionName", "ktlint:standard:function-naming")
@Composable
fun AppWebView() {
    var isLoading by remember { mutableStateOf(true) }
    var loadError by remember { mutableStateOf<String?>(null) }
    var webViewInstance by remember { mutableStateOf<WebView?>(null) }

    Box(
        modifier =
            Modifier
                .fillMaxSize()
                .background(Color(BACKGROUND_COLOR_HEX)),
    ) {
        AndroidView(
            modifier = Modifier.fillMaxSize(),
            factory = { context ->
                createWebView(context) { webView ->
                    webViewInstance = webView
                    webView.webChromeClient = createWebChromeClient()
                    webView.webViewClient = createWebViewClient(
                        onFinished = { isLoading = false },
                        onError = { error ->
                            loadError = error
                            isLoading = false
                        }
                    )
                    webView.loadUrl(APP_URL)
                }
            },
        )

        if (isLoading && loadError == null) {
            LoadingOverlay()
        }

        loadError?.let { errorMsg ->
            ErrorOverlay(errorMsg) {
                loadError = null
                isLoading = true
                webViewInstance?.loadUrl(APP_URL)
            }
        }
    }
}

private fun createWebView(context: android.content.Context, onSetup: (WebView) -> Unit): WebView {
    val assetLoader = WebViewAssetLoader.Builder()
        .setDomain(ASSET_DOMAIN)
        .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(context))
        .build()

    return WebView(context).apply {
        setBackgroundColor(android.graphics.Color.parseColor("#0F172A"))
        settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            databaseEnabled = true
            allowFileAccess = false
            allowContentAccess = false
            useWideViewPort = true
            loadWithOverviewMode = true
            mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
            setSupportZoom(false)
            cacheMode = WebSettings.LOAD_DEFAULT
        }
        webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
                return request?.url?.host != ASSET_DOMAIN
            }
            override fun shouldInterceptRequest(view: WebView?, request: WebResourceRequest?): WebResourceResponse? {
                val url = request?.url ?: return null
                return assetLoader.shouldInterceptRequest(url)
            }
        }
        onSetup(this)
    }
}

private fun createWebChromeClient() = object : WebChromeClient() {
    override fun onConsoleMessage(consoleMessage: ConsoleMessage?): Boolean {
        consoleMessage?.let {
            val logMsg = "[${it.sourceId()}:${it.lineNumber()}] ${it.message()}"
            when (it.messageLevel()) {
                ConsoleMessage.MessageLevel.ERROR -> Log.e(TAG, logMsg)
                ConsoleMessage.MessageLevel.WARNING -> Log.w(TAG, logMsg)
                else -> Log.d(TAG, logMsg)
            }
        }
        return true
    }
}

private fun createWebViewClient(onFinished: () -> Unit, onError: (String) -> Unit) = object : WebViewClient() {
    override fun onPageFinished(view: WebView?, url: String?) {
        super.onPageFinished(view, url)
        onFinished()
    }
    override fun onReceivedError(view: WebView?, request: WebResourceRequest?, error: WebResourceError?) {
        super.onReceivedError(view, request, error)
        if (request?.isForMainFrame == true) {
            onError(error?.description?.toString() ?: "Connection failed")
        }
    }
    override fun onReceivedHttpError(view: WebView?, request: WebResourceRequest?, response: WebResourceResponse?) {
        super.onReceivedHttpError(view, request, response)
        if (request?.isForMainFrame == true) {
            onError("HTTP error ${response?.statusCode ?: -1}")
        }
    }
}

@Composable
fun LoadingOverlay() {
    Box(
        modifier = Modifier.fillMaxSize().background(Color(BACKGROUND_COLOR_HEX)),
        contentAlignment = Alignment.Center,
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            CircularProgressIndicator(
                modifier = Modifier.size(PROGRESS_INDICATOR_SIZE.dp),
                color = Color(PROGRESS_INDICATOR_COLOR),
                strokeWidth = STROKE_WIDTH.dp,
            )
            Spacer(modifier = Modifier.height(SPACING_MEDIUM.dp))
            Text(
                "Unified Cloud File Manager",
                color = Color(TEXT_PRIMARY_COLOR),
                fontSize = TEXT_SIZE_TITLE.sp,
                fontWeight = FontWeight.SemiBold
            )
            Text("Loading workspace...", color = Color(TEXT_SECONDARY_COLOR), fontSize = TEXT_SIZE_SUBTITLE.sp)
        }
    }
}

@Composable
fun ErrorOverlay(errorMsg: String, onRetry: () -> Unit) {
    Box(
        modifier = Modifier.fillMaxSize().background(Color(BACKGROUND_COLOR_HEX)).padding(PADDING_DEFAULT.dp),
        contentAlignment = Alignment.Center,
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Text(
                "Unable to Load Workspace",
                color = Color(ERROR_TEXT_COLOR),
                fontSize = TEXT_SIZE_ERROR_TITLE.sp,
                fontWeight = FontWeight.Bold
            )
            Spacer(modifier = Modifier.height(SPACING_SMALL.dp))
            Text(errorMsg, color = Color(TEXT_SECONDARY_COLOR), fontSize = TEXT_SIZE_SUBTITLE.sp)
            Spacer(modifier = Modifier.height(SPACING_LARGE.dp))
            Button(
                onClick = onRetry,
                colors = ButtonDefaults.buttonColors(containerColor = Color(BUTTON_CONTAINER_COLOR))
            ) {
                Text("Retry Connection", color = Color.White)
            }
        }
    }
}
