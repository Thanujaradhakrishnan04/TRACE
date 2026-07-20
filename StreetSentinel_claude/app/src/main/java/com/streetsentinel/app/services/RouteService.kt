package com.streetsentinel.app.services

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import org.json.JSONObject
import java.net.URLEncoder
import java.util.concurrent.TimeUnit

data class PlaceResult(val displayName: String, val lat: Double, val lng: Double)
data class RouteResult(val distanceMeters: Double, val durationSeconds: Double, val coordinates: List<Pair<Double, Double>>)

/**
 * Port of the Nominatim destination search and OSRM `getRoute()` calls in
 * pages/citizen/SafeWalk.jsx / utils/geo.js. Both are free, no-API-key public
 * OpenStreetMap services — matching the web app's zero-API-key setup exactly.
 */
class RouteService(
    private val client: OkHttpClient = OkHttpClient.Builder()
        .connectTimeout(8, TimeUnit.SECONDS).readTimeout(15, TimeUnit.SECONDS).build()
) {
    suspend fun search(query: String): List<PlaceResult> = withContext(Dispatchers.IO) {
        if (query.length < 3) return@withContext emptyList()
        try {
            val url = "https://nominatim.openstreetmap.org/search?q=${URLEncoder.encode(query, "UTF-8")}&format=json&limit=5"
            val request = Request.Builder().url(url).addHeader("Accept-Language", "en").build()
            client.newCall(request).execute().use { response ->
                if (!response.isSuccessful) return@withContext emptyList()
                val arr = org.json.JSONArray(response.body?.string().orEmpty())
                (0 until arr.length()).map { i ->
                    val o = arr.getJSONObject(i)
                    PlaceResult(o.getString("display_name"), o.getString("lat").toDouble(), o.getString("lon").toDouble())
                }
            }
        } catch (e: Exception) { emptyList() }
    }

    /** Direct port of getRoute() — OSRM public foot-routing API. */
    suspend fun getRoute(fromLat: Double, fromLng: Double, toLat: Double, toLng: Double): RouteResult? = withContext(Dispatchers.IO) {
        try {
            val url = "https://router.project-osrm.org/route/v1/foot/$fromLng,$fromLat;$toLng,$toLat?overview=full&geometries=geojson"
            val request = Request.Builder().url(url).build()
            client.newCall(request).execute().use { response ->
                if (!response.isSuccessful) return@withContext null
                val json = JSONObject(response.body?.string().orEmpty())
                if (json.optString("code") != "Ok") return@withContext null
                val route = json.getJSONArray("routes").getJSONObject(0)
                val coordsArr = route.getJSONObject("geometry").getJSONArray("coordinates")
                val coords = (0 until coordsArr.length()).map { i ->
                    val pt = coordsArr.getJSONArray(i)
                    pt.getDouble(1) to pt.getDouble(0) // GeoJSON is [lng, lat] -> (lat, lng)
                }
                RouteResult(route.getDouble("distance"), route.getDouble("duration"), coords)
            }
        } catch (e: Exception) { null }
    }
}
