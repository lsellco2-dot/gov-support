package com.govsupport.app.fcm

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.app.NotificationCompat
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import com.govsupport.app.FcmTokenStore
import com.govsupport.app.MainActivity
import com.govsupport.app.R

/**
 * FCM 수신 골격. google-services.json이 없으면 Firebase가 초기화되지 않아
 * 이 서비스는 호출되지 않는다 (빌드는 정상).
 *
 * 발송 페이로드 규약 (data 메시지 권장 — 백그라운드에서도 onMessageReceived 보장):
 *   { "data": { "title": "...", "body": "...", "path": "/app/announcements/123" } }
 */
class AppMessagingService : FirebaseMessagingService() {

    override fun onNewToken(token: String) {
        FcmTokenStore.set(this, token)
        // 앱이 떠 있으면 다음 페이지 로드 시 WebAppBridge.pushFcmTokenToWeb()로 웹에 전달됨.
        // TODO: 서버에 토큰 등록 API가 생기면 여기서 전송
    }

    override fun onMessageReceived(message: RemoteMessage) {
        val title = message.notification?.title
            ?: message.data["title"]
            ?: getString(R.string.app_name)
        val body = message.notification?.body
            ?: message.data["body"]
            ?: return
        showNotification(title, body, message.data["path"])
    }

    private fun showNotification(title: String, body: String, path: String?) {
        if (Build.VERSION.SDK_INT >= 33 &&
            checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
        ) return

        val manager = getSystemService(NotificationManager::class.java)
        manager.createNotificationChannel(
            NotificationChannel(
                CHANNEL_ID,
                getString(R.string.notification_channel_name),
                NotificationManager.IMPORTANCE_DEFAULT
            )
        )

        val intent = Intent(this, MainActivity::class.java).apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
            path?.let { putExtra(MainActivity.EXTRA_PATH, it) }
        }
        val pendingIntent = PendingIntent.getActivity(
            this,
            0,
            intent,
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )

        val notification = NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_notification)
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(NotificationCompat.BigTextStyle().bigText(body))
            .setAutoCancel(true)
            .setContentIntent(pendingIntent)
            .build()

        manager.notify(System.currentTimeMillis().toInt(), notification)
    }

    companion object {
        // AndroidManifest.xml의 default_notification_channel_id와 일치해야 함
        const val CHANNEL_ID = "announcements"
    }
}
