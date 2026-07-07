package com.govsupport.app

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.webkit.JavascriptInterface
import android.webkit.WebView
import org.json.JSONObject

/**
 * WebView ↔ 웹(JS) 브릿지 — 네이티브 연동은 전부 이 파일에 격리한다.
 * 나중에 Flutter로 전환할 때는 이 파일의 "JS 계약"만 동일하게 재구현하면 웹은 수정 불필요.
 *
 * ── JS 계약 ─────────────────────────────────────────────
 * 웹 → 네이티브 (window.GovSupportNative.*):
 *   share(title, url)      — 시스템 공유 시트 열기
 *   openExternal(url)      — Chrome Custom Tab으로 열기
 *   getFcmToken(): string  — 저장된 FCM 토큰 ("" = 미발급)
 *
 * 네이티브 → 웹 (CustomEvent):
 *   window.addEventListener("govsupport:fcmToken", (e) => e.detail.token)
 * ────────────────────────────────────────────────────────
 */
class WebAppBridge(
    private val activity: Activity,
    private val webView: WebView,
) {

    fun attach() {
        webView.addJavascriptInterface(this, JS_NAME)
    }

    /** [네이티브 기능 1] 공고 공유 — 시스템 공유 시트 */
    @JavascriptInterface
    fun share(title: String, url: String) {
        val send = Intent(Intent.ACTION_SEND).apply {
            type = "text/plain"
            putExtra(Intent.EXTRA_SUBJECT, title)
            putExtra(Intent.EXTRA_TEXT, "$title\n$url")
        }
        activity.startActivity(Intent.createChooser(send, title))
    }

    /** 외부 링크를 Chrome Custom Tab으로 (웹에서 명시적으로 요청할 때) */
    @JavascriptInterface
    fun openExternal(url: String) {
        activity.runOnUiThread {
            (activity as? MainActivity)?.openExternal(Uri.parse(url))
        }
    }

    /** [네이티브 기능 2] FCM 토큰 조회 — 웹이 필요할 때 직접 가져가는 pull 방식 */
    @JavascriptInterface
    fun getFcmToken(): String = FcmTokenStore.get(activity)

    /** 저장된 FCM 토큰을 웹으로 push (페이지 로드 완료·토큰 갱신 시 호출) */
    fun pushFcmTokenToWeb() {
        val token = FcmTokenStore.get(activity)
        if (token.isEmpty()) return
        val detail = JSONObject().put("token", token).toString()
        webView.post {
            webView.evaluateJavascript(
                "window.dispatchEvent(new CustomEvent('$EVENT_FCM_TOKEN', { detail: $detail }));",
                null
            )
        }
    }

    companion object {
        const val JS_NAME = "GovSupportNative"
        const val EVENT_FCM_TOKEN = "govsupport:fcmToken"
    }
}

/**
 * FCM 토큰 저장소 — 백그라운드 서비스(onNewToken)와 액티비티가 SharedPreferences로 공유.
 * 브릿지 계약의 일부이므로 이 파일에 함께 둔다.
 */
object FcmTokenStore {
    private const val PREFS = "govsupport"
    private const val KEY_TOKEN = "fcm_token"

    fun get(context: Context): String =
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .getString(KEY_TOKEN, "") ?: ""

    fun set(context: Context, token: String) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .edit().putString(KEY_TOKEN, token).apply()
    }
}
