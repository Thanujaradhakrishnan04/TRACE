package com.streetsentinel.app.services

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.FormBody
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.util.concurrent.TimeUnit
import kotlin.math.atan2
import kotlin.math.cos
import kotlin.math.sin
import kotlin.math.sqrt

/**
 * Port of services/overpassService.js — queries OpenStreetMap's Overpass API for nearby
 * amenities (police/hospital/pharmacy/etc) and landuse tags, feeding SafetyScoreService.
 * Ports the endpoint fallback list, 5-minute cache, and generated fallback amenities
 * (used when Overpass is unreachable) 1:1.
 */
class OverpassService(
    private val client: OkHttpClient = OkHttpClient.Builder()
        .connectTimeout(8, TimeUnit.SECONDS).readTimeout(20, TimeUnit.SECONDS).build()
) {
    companion object {
        private val ENDPOINTS = listOf(
            "https://overpass-api.de/api/interpreter",
            "https://lz4.overpass-api.de/api/interpreter",
            "https://z.overpass-api.de/api/interpreter",
            "https://overpass.kumi.systems/api/interpreter"
        )
        private const val CACHE_TTL_MS = 300_000L
    }

    private data class CacheEntry(val ts: Long, val lat: Double, val lng: Double, val data: List<NearbyZone>)
    private val amenityCache = mutableMapOf<String, CacheEntry>()
    private val landuseCache = mutableMapOf<String, List<String>>()

    suspend fun fetchNearbyAmenities(
        lat: Double, lng: Double, radius: Int = 15000,
        types: List<String> = listOf("police", "hospital", "clinic", "pharmacy", "womens_shelter")
    ): List<NearbyZone> = withContext(Dispatchers.IO) {
        val key = "${radius}_${types.sorted().joinToString(",")}"
        amenityCache[key]?.let { 
            if (System.currentTimeMillis() - it.ts < CACHE_TTL_MS && calculateDistanceMeters(lat, lng, it.lat, it.lng) < 200) {
                return@withContext it.data
            }
        }

        val amenityFilters = types
            .filter { it != "womens_shelter" }
            .joinToString("\n") { t ->
                var f = "node[\"amenity\"=\"$t\"](around:$radius,$lat,$lng);\nway[\"amenity\"=\"$t\"](around:$radius,$lat,$lng);"
                if (t == "pharmacy") {
                    f += "\nnode[\"healthcare\"=\"pharmacy\"](around:$radius,$lat,$lng);"
                    f += "\nnode[\"shop\"=\"chemist\"](around:$radius,$lat,$lng);"
                    f += "\nway[\"shop\"=\"chemist\"](around:$radius,$lat,$lng);"
                    f += "\nnode[\"shop\"=\"medical_supply\"](around:$radius,$lat,$lng);"
                }
                if (t == "clinic") {
                    f += "\nnode[\"healthcare\"=\"clinic\"](around:$radius,$lat,$lng);"
                    f += "\nway[\"healthcare\"=\"clinic\"](around:$radius,$lat,$lng);"
                }
                f
            }
        val shelterFilter = if (types.contains("womens_shelter")) {
            "node[\"social_facility\"=\"womens_shelter\"](around:$radius,$lat,$lng);\nway[\"social_facility\"=\"womens_shelter\"](around:$radius,$lat,$lng);"
        } else ""
        val query = "[out:json][timeout:25];($amenityFilters\n$shelterFilter);out center body;"

        val result = queryEndpoints(query)?.let { json -> parseAmenities(json, lat, lng, types) }

        if (result != null) {
            amenityCache[key] = CacheEntry(System.currentTimeMillis(), lat, lng, result)
            return@withContext result
        } else {
            // Network failure or rate limit: return stale cache if available, else use generated fallback
            val fallback = amenityCache[key]?.data ?: generateFallbackAmenities(lat, lng)
            amenityCache[key] = CacheEntry(System.currentTimeMillis(), lat, lng, fallback)
            return@withContext fallback
        }
    }

    suspend fun fetchLanduse(lat: Double, lng: Double, radius: Int = 500): List<String> = withContext(Dispatchers.IO) {
        val key = "${"%.3f".format(lat)}_${"%.3f".format(lng)}_$radius"
        landuseCache[key]?.let { return@withContext it }

        val query = "[out:json][timeout:15];(way[\"landuse\"](around:$radius,$lat,$lng);relation[\"landuse\"](around:$radius,$lat,$lng););out tags;"
        val types = queryEndpoints(query)?.let { json ->
            val elements = json.optJSONArray("elements") ?: return@let emptyList<String>()
            (0 until elements.length()).mapNotNull { i ->
                elements.getJSONObject(i).optJSONObject("tags")?.optString("landuse")?.takeIf { it.isNotBlank() }
            }.distinct()
        } ?: generateFallbackLanduse()

        landuseCache[key] = types
        types
    }

    private fun queryEndpoints(query: String): JSONObject? {
        for (endpoint in ENDPOINTS) {
            try {
                val encodedQuery = java.net.URLEncoder.encode(query, "UTF-8").replace("+", "%20")
                val bodyStr = "data=$encodedQuery"
                val body = bodyStr.toRequestBody("application/x-www-form-urlencoded".toMediaType())
                val request = Request.Builder().url(endpoint)
                    .header("User-Agent", "StreetSentinel-Android/2.0 (contact: support@streetsentinel.com)")
                    .header("Accept", "application/json")
                    .post(body)
                    .build()
                client.newCall(request).execute().use { response ->
                    if (response.isSuccessful) {
                        return JSONObject(response.body?.string().orEmpty())
                    } else if (response.code == 429) {
                        // Rate limited — continue trying fallback endpoints
                    }
                }
            } catch (e: Exception) { /* try next endpoint, mirrors the web app's fallback chain */ }
        }
        return null
    }

    private fun parseAmenities(json: JSONObject, lat: Double, lng: Double, types: List<String>): List<NearbyZone> {
        val elements = json.optJSONArray("elements") ?: return emptyList()
        val results = (0 until elements.length()).mapNotNull { i ->
            val el = elements.getJSONObject(i)
            val elLat = if (el.has("lat")) el.optDouble("lat", Double.NaN) else el.optJSONObject("center")?.optDouble("lat", Double.NaN)
            val elLng = if (el.has("lon")) el.optDouble("lon", Double.NaN) else el.optJSONObject("center")?.optDouble("lon", Double.NaN)
            if (elLat == null || elLng == null || elLat.isNaN() || elLng.isNaN()) return@mapNotNull null
            val tags = el.optJSONObject("tags") ?: JSONObject()
            var type = tags.optString("amenity").ifBlank { tags.optString("shop") }.ifBlank { tags.optString("healthcare") }
                .ifBlank { tags.optString("social_facility") }.ifBlank { "safety_center" }
            type = type.replace("chemist", "pharmacy").replace("medical_supply", "pharmacy")
            val name = tags.optString("name").ifBlank { "${type.replaceFirstChar { it.uppercase() }} near ${"%.4f".format(elLat)}, ${"%.4f".format(elLng)}" }
            val dist = calculateDistanceMeters(lat, lng, elLat, elLng)
            if (dist.isNaN()) return@mapNotNull null
            NearbyZone(elLat, elLng, type, dist, name)
        }.sortedBy { it.distanceMeters }
        return results
    }

    /** Haversine distance in meters — port of utils/geo.js's calculateDistance(). */
    private fun calculateDistanceMeters(lat1: Double, lon1: Double, lat2: Double, lon2: Double): Double {
        val r = 6371000.0
        val dLat = Math.toRadians(lat2 - lat1)
        val dLon = Math.toRadians(lon2 - lon1)
        val a = sin(dLat / 2) * sin(dLat / 2) + cos(Math.toRadians(lat1)) * cos(Math.toRadians(lat2)) * sin(dLon / 2) * sin(dLon / 2)
        return r * 2 * atan2(sqrt(a), sqrt(1 - a))
    }

    private fun generateFallbackAmenities(lat: Double, lng: Double): List<NearbyZone> {
        return listOf(
            NearbyZone(lat + 0.005, lng + 0.005, "police", calculateDistanceMeters(lat, lng, lat + 0.005, lng + 0.005), "Central Police Station (Simulated)"),
            NearbyZone(lat - 0.004, lng + 0.002, "hospital", calculateDistanceMeters(lat, lng, lat - 0.004, lng + 0.002), "City General Hospital (Simulated)"),
            NearbyZone(lat + 0.002, lng - 0.003, "pharmacy", calculateDistanceMeters(lat, lng, lat + 0.002, lng - 0.003), "24/7 Pharmacy (Simulated)")
        )
    }

    private fun generateFallbackLanduse(): List<String> = listOf("residential", "commercial")
}
