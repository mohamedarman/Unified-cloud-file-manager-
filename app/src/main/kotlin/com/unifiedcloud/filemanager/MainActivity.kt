package com.unifiedcloud.filemanager

import android.Manifest
import android.annotation.SuppressLint
import android.app.DownloadManager
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Environment
import android.util.Log
import android.view.ViewGroup
import android.webkit.ConsoleMessage
import android.webkit.RenderProcessGoneDetail
import android.webkit.URLUtil
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.ActivityResult
import androidx.activity.result.ActivityResultLauncher
import androidx.activity.result.contract.ActivityResultContracts
import androidx.browser.customtabs.CustomTabsIntent
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.systemBarsPadding
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableIntStateOf
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
import androidx.core.content.ContextCompat
import androidx.webkit.WebViewAssetLoader
import org.json.JSONObject

class MainActivity : ComponentActivity() {
    private var fileUploadCallback: ValueCallback<Array<Uri>>? = null
    private lateinit var fileChooserLauncher: ActivityResultLauncher<Intent>
    private lateinit var notificationPermissionLauncher: ActivityResultLauncher<String>
    private lateinit var nativeBridge: NativeCloudBridge

    override fun onCreate(savedInstanceState: Bundle?) {
        enableEdgeToEdge()
        super.onCreate(savedInstanceState)

        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG)
        nativeBridge = NativeCloudBridge(applicationContext)
        captureOAuthIntent(intent)

        fileChooserLauncher =
            registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
                handleFileChooserResult(result)
            }

        notificationPermissionLauncher =
            registerForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
                Log.d(TAG, "POST_NOTIFICATIONS permission granted=$granted")
            }

        requestNotificationsPermissionIfNeeded()

        setContent {
            MaterialTheme {
                Surface(
                    modifier =
                        Modifier
                            .fillMaxSize()
                            .systemBarsPadding()
                            .imePadding(),
                    color = MaterialTheme.colorScheme.background,
                ) {
                    AppWebView(
                        nativeBridge = nativeBridge,
                        onLaunchFileChooser = ::launchSystemFileChooser,
                    )
                }
            }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        captureOAuthIntent(intent)
    }

    private fun captureOAuthIntent(incoming: Intent?) {
        val data = incoming?.data ?: return
        if (data.scheme == OAUTH_REDIRECT_SCHEME && data.host == OAUTH_REDIRECT_HOST) {
            nativeBridge.recordOAuthRedirect(data)
        }
    }

    private fun requestNotificationsPermissionIfNeeded() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            val status =
                ContextCompat.checkSelfPermission(
                    this,
                    Manifest.permission.POST_NOTIFICATIONS,
                )
            if (status != PackageManager.PERMISSION_GRANTED) {
                notificationPermissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
            }
        }
    }

    private fun launchSystemFileChooser(
        callback: ValueCallback<Array<Uri>>,
        params: WebChromeClient.FileChooserParams?,
    ): Boolean {
        fileUploadCallback?.onReceiveValue(null)
        fileUploadCallback = callback
        val chooserIntent =
            runCatching { params?.createIntent() }.getOrNull()
                ?: Intent(Intent.ACTION_GET_CONTENT).apply {
                    addCategory(Intent.CATEGORY_OPENABLE)
                    type = "*/*"
                }
        return runCatching {
            fileChooserLauncher.launch(chooserIntent)
            true
        }.getOrElse {
            fileUploadCallback?.onReceiveValue(null)
            fileUploadCallback = null
            false
        }
    }

    private fun handleFileChooserResult(result: ActivityResult) {
        val callback = fileUploadCallback ?: return
        fileUploadCallback = null
        val clipData = result.data?.clipData
        val uris =
            if (result.resultCode == RESULT_OK && clipData != null && clipData.itemCount > 0) {
                val collected =
                    (0 until clipData.itemCount)
                        .mapNotNull { index -> clipData.getItemAt(index).uri }
                        .toTypedArray()
                collected.takeIf { it.isNotEmpty() }
            } else {
                WebChromeClient.FileChooserParams.parseResult(result.resultCode, result.data)
            }
        callback.onReceiveValue(uris)
    }
}

private const val ASSET_DOMAIN = "appassets.androidplatform.net"
private const val APP_URL = "https://$ASSET_DOMAIN/assets/index.html"
private const val OAUTH_REDIRECT_SCHEME = "com.unifiedcloud.filemanager"
private const val OAUTH_REDIRECT_HOST = "oauth2redirect"
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
private const val UNKNOWN_HTTP_STATUS = -1

private data class WebViewCallbacks(
    val onFinished: () -> Unit,
    val onError: (String) -> Unit,
    val onRendererCrashed: () -> Unit,
    val onLaunchFileChooser: (
        ValueCallback<Array<Uri>>,
        WebChromeClient.FileChooserParams?,
    ) -> Boolean,
)

@SuppressLint("SetJavaScriptEnabled")
@Suppress("FunctionName", "ktlint:standard:function-naming")
@Composable
fun AppWebView(
    nativeBridge: NativeCloudBridge,
    onLaunchFileChooser: (ValueCallback<Array<Uri>>, WebChromeClient.FileChooserParams?) -> Boolean,
) {
    var isLoading by remember { mutableStateOf(true) }
    var loadError by remember { mutableStateOf<String?>(null) }
    var webViewInstance by remember { mutableStateOf<WebView?>(null) }
    var canNavigateBack by remember { mutableStateOf(false) }
    var recreateGeneration by remember { mutableIntStateOf(0) }

    BackHandler(enabled = canNavigateBack) {
        webViewInstance?.goBack()
    }

    Box(
        modifier =
            Modifier
                .fillMaxSize()
                .background(Color(BACKGROUND_COLOR_HEX)),
    ) {
        key(recreateGeneration) {
            AndroidView(
                modifier = Modifier.fillMaxSize(),
                factory = { context ->
                    val callbacks =
                        WebViewCallbacks(
                            onFinished = {
                                isLoading = false
                                canNavigateBack = webViewInstance?.canGoBack() == true
                            },
                            onError = { error ->
                                loadError = error
                                isLoading = false
                            },
                            onRendererCrashed = {
                                Log.w(TAG, "WebView renderer process gone; recreating WebView")
                                isLoading = true
                                loadError = null
                                recreateGeneration++
                            },
                            onLaunchFileChooser = onLaunchFileChooser,
                        )
                    createWebView(
                        context = context,
                        nativeBridge = nativeBridge,
                        callbacks = callbacks,
                    ).also { webView ->
                        webViewInstance = webView
                        webView.loadUrl(APP_URL)
                    }
                },
            )
        }

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

@SuppressLint("SetJavaScriptEnabled")
private fun createWebView(
    context: Context,
    nativeBridge: NativeCloudBridge,
    callbacks: WebViewCallbacks,
): WebView {
    val assetLoader =
        WebViewAssetLoader
            .Builder()
            .setDomain(ASSET_DOMAIN)
            .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(context))
            .build()

    return WebView(context).apply {
        layoutParams =
            ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT,
            )
        setBackgroundColor(BACKGROUND_COLOR_HEX.toInt())
        settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            allowFileAccess = false
            allowContentAccess = false
            useWideViewPort = true
            loadWithOverviewMode = true
            mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
            setSupportZoom(false)
            cacheMode = WebSettings.LOAD_DEFAULT
        }
        addJavascriptInterface(nativeBridge, NativeCloudBridge.JS_INTERFACE_NAME)
        setDownloadListener { url, userAgent, contentDisposition, mimeType, _ ->
            handleWebViewDownload(this, context, url, userAgent, contentDisposition, mimeType)
        }
        webChromeClient = createWebChromeClient(callbacks.onLaunchFileChooser)
        webViewClient = createWebViewClient(context, assetLoader, callbacks)
    }
}

private fun handleWebViewDownload(
    webView: WebView,
    context: Context,
    url: String?,
    userAgent: String?,
    contentDisposition: String?,
    mimeType: String?,
) {
    val parsed = url?.let { runCatching { Uri.parse(it) }.getOrNull() } ?: return
    val fileName = URLUtil.guessFileName(url, contentDisposition, mimeType)
    val resolvedMime = mimeType ?: "application/octet-stream"
    if (parsed.scheme == "blob" || parsed.scheme == "data") {
        val quotedUrl = JSONObject.quote(url)
        val quotedName = JSONObject.quote(fileName)
        val quotedMime = JSONObject.quote(resolvedMime)
        val script =
            """
            (function() {
              fetch($quotedUrl)
                .then(function(r) { return r.blob(); })
                .then(function(b) {
                  var reader = new FileReader();
                  reader.onloadend = function() {
                    var bridge = window.UnifiedCloudBridge;
                    if (bridge && reader.result) {
                      bridge.saveDownloadedFileBase64(
                        $quotedName,
                        $quotedMime,
                        String(reader.result)
                      );
                    }
                  };
                  reader.readAsDataURL(b);
                });
            })();
            """.trimIndent()
        webView.evaluateJavascript(script, null)
        return
    }
    if (parsed.scheme != "https") return
    runCatching {
        val request =
            DownloadManager.Request(parsed).apply {
                setMimeType(resolvedMime)
                if (!userAgent.isNullOrBlank()) {
                    addRequestHeader("User-Agent", userAgent)
                }
                setTitle(fileName)
                setNotificationVisibility(
                    DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED,
                )
                setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, fileName)
            }
        val dm = context.getSystemService(Context.DOWNLOAD_SERVICE) as? DownloadManager
        dm?.enqueue(request)
    }.onFailure { err ->
        Log.w(TAG, "DownloadManager enqueue failed: ${err.message}")
    }
}

private fun createWebChromeClient(
    onLaunchFileChooser: (ValueCallback<Array<Uri>>, WebChromeClient.FileChooserParams?) -> Boolean,
) = object : WebChromeClient() {
    override fun onShowFileChooser(
        webView: WebView?,
        filePathCallback: ValueCallback<Array<Uri>>?,
        fileChooserParams: FileChooserParams?,
    ): Boolean {
        val callback = filePathCallback ?: return false
        return onLaunchFileChooser(callback, fileChooserParams)
    }

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

private fun createWebViewClient(
    context: Context,
    assetLoader: WebViewAssetLoader,
    callbacks: WebViewCallbacks,
) = object : WebViewClient() {
    override fun shouldOverrideUrlLoading(
        view: WebView?,
        request: WebResourceRequest?,
    ): Boolean {
        val url = request?.url ?: return true
        val isLocalAsset = url.scheme == "https" && url.host == ASSET_DOMAIN
        if (!isLocalAsset && (url.scheme == "https" || url.scheme == "http")) {
            val openedCustomTab =
                runCatching {
                    val tabsIntent = CustomTabsIntent.Builder().setShowTitle(true).build()
                    tabsIntent.intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    tabsIntent.launchUrl(context, url)
                    true
                }.getOrDefault(false)
            if (!openedCustomTab) {
                runCatching {
                    val intent =
                        Intent(Intent.ACTION_VIEW, url).apply {
                            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                        }
                    context.startActivity(intent)
                }
            }
        }
        return !isLocalAsset
    }

    override fun shouldInterceptRequest(
        view: WebView?,
        request: WebResourceRequest?,
    ): WebResourceResponse? = request?.url?.let { assetLoader.shouldInterceptRequest(it) }

    override fun onPageFinished(
        view: WebView?,
        url: String?,
    ) {
        super.onPageFinished(view, url)
        callbacks.onFinished()
    }

    override fun onReceivedError(
        view: WebView?,
        request: WebResourceRequest?,
        error: WebResourceError?,
    ) {
        super.onReceivedError(view, request, error)
        if (request?.isForMainFrame == true) {
            callbacks.onError(error?.description?.toString() ?: "Connection failed")
        }
    }

    override fun onReceivedHttpError(
        view: WebView?,
        request: WebResourceRequest?,
        response: WebResourceResponse?,
    ) {
        super.onReceivedHttpError(view, request, response)
        if (request?.isForMainFrame == true) {
            callbacks.onError("HTTP error ${response?.statusCode ?: UNKNOWN_HTTP_STATUS}")
        }
    }

    override fun onRenderProcessGone(
        view: WebView?,
        detail: RenderProcessGoneDetail?,
    ): Boolean {
        view?.destroy()
        callbacks.onRendererCrashed()
        return true
    }
}

@Suppress("FunctionName", "ktlint:standard:function-naming")
@Composable
fun LoadingOverlay() {
    Box(
        modifier =
            Modifier
                .fillMaxSize()
                .background(Color(BACKGROUND_COLOR_HEX)),
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
                fontWeight = FontWeight.SemiBold,
            )
            Text(
                "Loading workspace...",
                color = Color(TEXT_SECONDARY_COLOR),
                fontSize = TEXT_SIZE_SUBTITLE.sp,
            )
        }
    }
}

@Suppress("FunctionName", "ktlint:standard:function-naming")
@Composable
fun ErrorOverlay(
    errorMsg: String,
    onRetry: () -> Unit,
) {
    Box(
        modifier =
            Modifier
                .fillMaxSize()
                .background(Color(BACKGROUND_COLOR_HEX))
                .padding(PADDING_DEFAULT.dp),
        contentAlignment = Alignment.Center,
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Text(
                "Unable to Load Workspace",
                color = Color(ERROR_TEXT_COLOR),
                fontSize = TEXT_SIZE_ERROR_TITLE.sp,
                fontWeight = FontWeight.Bold,
            )
            Spacer(modifier = Modifier.height(SPACING_SMALL.dp))
            Text(
                errorMsg,
                color = Color(TEXT_SECONDARY_COLOR),
                fontSize = TEXT_SIZE_SUBTITLE.sp,
            )
            Spacer(modifier = Modifier.height(SPACING_LARGE.dp))
            Button(
                onClick = onRetry,
                colors = ButtonDefaults.buttonColors(containerColor = Color(BUTTON_CONTAINER_COLOR)),
            ) {
                Text("Retry Connection", color = Color.White)
            }
        }
    }
}
