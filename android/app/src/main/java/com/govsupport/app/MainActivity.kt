package com.govsupport.app

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.addCallback
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.browser.customtabs.CustomTabsIntent
import com.google.firebase.FirebaseApp
import com.google.firebase.messaging.FirebaseMessaging

class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView
    private lateinit var bridge: WebAppBridge
    private val baseUri: Uri = Uri.parse(BuildConfig.BASE_URL)

    private val notificationPermission =
        registerForActivityResult(ActivityResultContracts.RequestPermission()) { /* 거부해도 앱은 동작 */ }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        webView = WebView(this)
        setContentView(webView)

        with(webView.settings) {
            javaScriptEnabled = true
            domStorageEnabled = true
        }

        // 네이티브 연동(공유, FCM 토큰 등)은 전부 WebAppBridge에 격리
        bridge = WebAppBridge(this, webView)
        bridge.attach()

        webView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(
                view: WebView,
                request: WebResourceRequest,
            ): Boolean {
                val uri = request.url
                // 서비스 도메인 내부는 WebView에서, 외부 링크(공고 원문 detail_url 등)는 Custom Tab으로
                val isInternal = uri.scheme in listOf("http", "https") &&
                    uri.authority == baseUri.authority
                if (isInternal) return false
                openExternal(uri)
                return true
            }

            override fun onPageFinished(view: WebView, url: String) {
                bridge.pushFcmTokenToWeb()
            }
        }

        // 뒤로가기 = WebView 히스토리 back
        onBackPressedDispatcher.addCallback(this) {
            if (webView.canGoBack()) webView.goBack() else finish()
        }

        requestNotificationPermissionIfNeeded()
        fetchFcmTokenIfAvailable()

        if (savedInstanceState == null) {
            webView.loadUrl(resolveStartUrl(intent))
        } else {
            webView.restoreState(savedInstanceState)
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        // 알림 탭 → 해당 공고 경로로 이동
        intent.getStringExtra(EXTRA_PATH)?.let { path ->
            webView.loadUrl("${baseUri.scheme}://${baseUri.authority}$path")
        }
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        webView.saveState(outState)
    }

    /** http/https 외부 링크는 Chrome Custom Tab, tel:/mailto: 등은 시스템 기본 앱으로 */
    fun openExternal(uri: Uri) {
        if (uri.scheme !in listOf("http", "https")) {
            runCatching { startActivity(Intent(Intent.ACTION_VIEW, uri)) }
            return
        }
        runCatching {
            CustomTabsIntent.Builder()
                .setShowTitle(true)
                .build()
                .launchUrl(this, uri)
        }.onFailure {
            // Custom Tab을 지원하는 브라우저가 없으면 기본 브라우저로
            runCatching { startActivity(Intent(Intent.ACTION_VIEW, uri)) }
        }
    }

    private fun resolveStartUrl(intent: Intent): String {
        val path = intent.getStringExtra(EXTRA_PATH) ?: return BuildConfig.BASE_URL
        return "${baseUri.scheme}://${baseUri.authority}$path"
    }

    private fun requestNotificationPermissionIfNeeded() {
        if (Build.VERSION.SDK_INT >= 33 &&
            checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
        ) {
            notificationPermission.launch(Manifest.permission.POST_NOTIFICATIONS)
        }
    }

    /** google-services.json이 있어 Firebase가 초기화된 경우에만 토큰 조회 (없으면 조용히 스킵) */
    private fun fetchFcmTokenIfAvailable() {
        if (FirebaseApp.getApps(this).isEmpty()) return
        FirebaseMessaging.getInstance().token.addOnSuccessListener { token ->
            FcmTokenStore.set(this, token)
            bridge.pushFcmTokenToWeb()
        }
    }

    companion object {
        /** FCM data 페이로드의 "path" 값 (예: "/app/announcements/123") */
        const val EXTRA_PATH = "path"
    }
}
