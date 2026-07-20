package com.streetsentinel.app.services

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Intent
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat

/**
 * Native equivalent of the `BackgroundProtection` Capacitor plugin referenced in
 * useStore.js (registerPlugin('BackgroundProtection').cancelWarning()). Keeps
 * Sentinel's ambient-monitoring alive while the app is backgrounded, mirroring the
 * "always-on protection" promise of the web app's PWA service worker.
 *
 * NOTE: this is a scaffold — wiring it to the actual audio/threat-detection loop
 * (equivalent of useAudioDetection.js) is phase-2 work.
 */
class SentinelProtectionService : Service() {

    companion object {
        private const val CHANNEL_ID = "sentinel_protection_channel"
        private const val NOTIFICATION_ID = 1001
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        startForeground(NOTIFICATION_ID, buildNotification())
        return START_STICKY
    }

    private fun buildNotification(): Notification {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(CHANNEL_ID, "Sentinel Protection", NotificationManager.IMPORTANCE_LOW)
            getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
        }
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Street Sentinel")
            .setContentText("AI Guardian active — monitoring for your safety.")
            .setSmallIcon(android.R.drawable.ic_lock_idle_alarm)
            .setOngoing(true)
            .build()
    }
}
