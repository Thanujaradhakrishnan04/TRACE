package com.streetsentinel.app.services

import android.annotation.SuppressLint
import android.content.Context
import com.google.android.gms.location.LocationCallback
import com.google.android.gms.location.LocationRequest
import com.google.android.gms.location.LocationResult
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import com.streetsentinel.app.data.model.GeoPoint
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.tasks.await

/**
 * Native equivalent of the global geolocation watcher registered in App.jsx's
 * useEffect (navigator.geolocation.watchPosition), and of src/hooks/useLocationTracking.js.
 */
class LocationService(context: Context) {
    private val fused = LocationServices.getFusedLocationProviderClient(context)

    @SuppressLint("MissingPermission")
    suspend fun getCurrentLocation(): GeoPoint? = try {
        // Force a fresh location check using High Accuracy to ensure it matches the web implementation
        val loc = fused.getCurrentLocation(Priority.PRIORITY_HIGH_ACCURACY, null).await()
            ?: fused.lastLocation.await()
        loc?.let { GeoPoint(it.latitude, it.longitude) }
    } catch (e: Exception) {
        null
    }

    @SuppressLint("MissingPermission")
    fun watchLocation(intervalMs: Long = 5000L): Flow<GeoPoint> = callbackFlow {
        val request = LocationRequest.Builder(Priority.PRIORITY_HIGH_ACCURACY, intervalMs).build()
        val callback = object : LocationCallback() {
            override fun onLocationResult(result: LocationResult) {
                result.lastLocation?.let { trySend(GeoPoint(it.latitude, it.longitude)) }
            }
        }
        fused.requestLocationUpdates(request, callback, android.os.Looper.getMainLooper())
        awaitClose { fused.removeLocationUpdates(callback) }
    }

    /** Google-Maps deep link, matching `https://maps.google.com/?q=lat,lng` built in sendEmergencyAlert() */
    fun mapsLinkFor(point: GeoPoint) = "https://maps.google.com/?q=${point.lat},${point.lng}"

    /** Instant IP-based geolocation fallback for testing indoors when physical GPS fails */
    suspend fun getIpLocation(): GeoPoint? = kotlinx.coroutines.withContext(kotlinx.coroutines.Dispatchers.IO) {
        try {
            val client = okhttp3.OkHttpClient()
            val request = okhttp3.Request.Builder().url("https://ipinfo.io/json").build()
            val response = client.newCall(request).execute()
            val json = org.json.JSONObject(response.body?.string() ?: "")
            val loc = json.optString("loc")
            if (loc.isNotBlank() && loc.contains(",")) {
                val parts = loc.split(",")
                GeoPoint(parts[0].toDouble(), parts[1].toDouble())
            } else null
        } catch (e: Exception) { null }
    }
}
