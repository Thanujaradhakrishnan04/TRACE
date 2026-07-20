package com.streetsentinel.app.data.repository

import com.google.gson.Gson
import com.streetsentinel.app.BuildConfig
import com.streetsentinel.app.data.model.EmergencyContact
import com.streetsentinel.app.data.model.GeoPoint
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.util.concurrent.TimeUnit

/**
 * Talks to the SAME Node/Express backend as the web app (server/server.js,
 * route: POST /emergency/dispatch). No backend changes are needed — this app
 * is a drop-in native client for it. Points at BuildConfig.BACKEND_URL,
 * which defaults to 10.0.2.2:4000 (emulator loopback to your machine), matching
 * getBackendUrl() in useStore.js which does the same localhost->10.0.2.2 rewrite
 * for Capacitor native builds.
 */
class BackendApi(
    private val client: OkHttpClient = OkHttpClient.Builder()
        .connectTimeout(30, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .writeTimeout(30, TimeUnit.SECONDS)
        .build(),
    private val gson: Gson = Gson()
) {
    data class DispatchResult(val success: Boolean, val smsStatus: String?, val emailStatus: String?, val error: String?)

    suspend fun dispatchEmergency(
        idToken: String?,
        emergencyId: String?,
        reason: String,
        location: GeoPoint,
        mapsLink: String,
        contacts: List<EmergencyContact>,
        userName: String,
        userPhone: String
    ): DispatchResult = withContext(Dispatchers.IO) {
        try {
            val tokenToSend = if (!idToken.isNullOrBlank()) idToken else "mock.jwt.token"
            val mappedContacts = contacts.map { 
                mapOf(
                    "id" to it.id,
                    "name" to it.name,
                    "phone" to it.phone,
                    "relation" to it.relation,
                    "email" to it.email
                )
            }
            
            val body = mapOf(
                "emergencyId" to emergencyId,
                "reason" to reason,
                "location" to mapOf("lat" to location.lat, "lng" to location.lng),
                "mapsLink" to mapsLink,
                "contacts" to mappedContacts,
                "targetContactId" to null,
                "userName" to userName,
                "userPhone" to userPhone,
                "photo" to null
            )
            val request = Request.Builder()
                .url("${BuildConfig.BACKEND_URL}/emergency/dispatch")
                .addHeader("Content-Type", "application/json")
                .addHeader("Authorization", "Bearer $tokenToSend")
                .post(gson.toJson(body).toRequestBody("application/json".toMediaType()))
                .build()

            client.newCall(request).execute().use { response ->
                val json = response.body?.string().orEmpty()
                val map = gson.fromJson(json, Map::class.java)
                DispatchResult(
                    success = (map["success"] as? Boolean) ?: false,
                    smsStatus = map["smsStatus"] as? String,
                    emailStatus = map["emailStatus"] as? String,
                    error = map["error"] as? String
                )
            }
        } catch (e: Exception) {
            DispatchResult(success = false, smsStatus = null, emailStatus = null, error = e.message ?: "Network request failed")
        }
    }
}
