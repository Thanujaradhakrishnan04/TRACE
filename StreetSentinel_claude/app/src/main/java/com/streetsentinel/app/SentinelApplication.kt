package com.streetsentinel.app

import android.app.Application
import android.app.NotificationChannel
import android.app.NotificationManager
import android.os.Build
import org.osmdroid.config.Configuration

/**
 * Equivalent of src/firebase/config.js's initializeApp() call — on Android, Firebase
 * initializes automatically from `google-services.json` the moment the process starts
 * (via the ContentProvider registered by the google-services Gradle plugin), so no
 * explicit init call is needed here. This class exists for app-wide setup (osmdroid config,
 * matching the Leaflet map init in the web app, plus the notification channel used by
 * triggerEmergency() to post the "Emergency detected! Open app if you are SAFE." alert —
 * the native equivalent of the browser Notification API + Capacitor LocalNotifications
 * calls in useStore.js).
 */
class SentinelApplication : Application() {
    companion object { const val EMERGENCY_CHANNEL_ID = "sentinel_emergency_alerts" }

    override fun onCreate() {
        super.onCreate()
        Configuration.getInstance().load(this, getSharedPreferences("osmdroid", MODE_PRIVATE))
        Configuration.getInstance().userAgentValue = packageName

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                EMERGENCY_CHANNEL_ID, "Emergency Alerts", NotificationManager.IMPORTANCE_HIGH
            ).apply { description = "StreetSentinel emergency detection alerts" }
            getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
        }
    }
}
