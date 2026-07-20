package com.streetsentinel.app.ui.citizen

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import com.streetsentinel.app.data.model.GeoPoint
import com.streetsentinel.app.services.*
import com.streetsentinel.app.theme.SentinelColors
import com.streetsentinel.app.viewmodel.SentinelViewModel
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.osmdroid.config.Configuration
import org.osmdroid.tileprovider.tilesource.TileSourceFactory
import org.osmdroid.util.GeoPoint as OsmGeoPoint
import org.osmdroid.views.MapView
import org.osmdroid.views.overlay.Marker
import org.osmdroid.views.overlay.Polyline

/**
 * Full rebuild of pages/citizen/SafeWalk.jsx: destination search (Nominatim), a real OSRM
 * walking route drawn on the map, a live safety score for the area, and the check-in monitor
 * (matching useSafeWalkMonitor.js) — periodic "have you arrived safely?" prompts that, if
 * unconfirmed within 15s, automatically call triggerEmergency("SafeWalk Check-In Timeout").
 * (Note: the web app's "safest via police/hospital waypoint" OSRM two-leg routing is not
 * ported yet — this shows the direct walking route + area safety score.)
 */
@Composable
fun SafeWalkScreen(viewModel: SentinelViewModel) {
    val context = LocalContext.current
    val lastLocation by viewModel.lastKnownLocation.collectAsState()
    val routeService = remember { RouteService() }
    val scope = rememberCoroutineScope()
    
    var searchText by remember { mutableStateOf("") }
    var searchResults by remember { mutableStateOf<List<PlaceResult>>(emptyList()) }
    var destination by remember { mutableStateOf<PlaceResult?>(null) }
    var route by remember { mutableStateOf<RouteResult?>(null) }
    var isLoadingRoute by remember { mutableStateOf(false) }
    
    val nearbyZones by viewModel.nearbyZones.collectAsState()
    val safetyScore by viewModel.safetyScore.collectAsState()
    var activeFilter by remember { mutableStateOf("all") } // "all", "police", "hospital", "pharmacy"
    var hasCentered by remember { mutableStateOf(false) }

    // ---- SafeWalk session / check-in state (port of useSafeWalkMonitor.js) ----
    var isActive by remember { mutableStateOf(false) }
    var checkInMinutes by remember { mutableStateOf(5f) }
    var checkInTimeLeft by remember { mutableStateOf<Int?>(null) }
    var showCheckInPrompt by remember { mutableStateOf(false) }
    var checkInCountdown by remember { mutableStateOf(15) }
    var walkedDistanceKm by remember { mutableStateOf(0.0) }

    val user by viewModel.currentUser.collectAsState()
    var userBitmap by remember { mutableStateOf<android.graphics.Bitmap?>(null) }

    LaunchedEffect(user?.photoUrl) {
        if (!user?.photoUrl.isNullOrEmpty()) {
            withContext(Dispatchers.IO) {
                try {
                    val client = okhttp3.OkHttpClient()
                    val request = okhttp3.Request.Builder().url(user!!.photoUrl).build()
                    val response = client.newCall(request).execute()
                    val stream = response.body?.byteStream()
                    if (stream != null) {
                        val bmp = android.graphics.BitmapFactory.decodeStream(stream)
                        userBitmap = getCircularBitmap(bmp)
                    }
                } catch (e: Exception) {
                    e.printStackTrace()
                }
            }
        }
    }

    LaunchedEffect(Unit) { Configuration.getInstance().userAgentValue = context.packageName }

    LaunchedEffect(lastLocation) {
        val loc = lastLocation
        if (loc != null && destination != null) {
            val dLat = destination!!.lat; val dLng = destination!!.lng
            walkedDistanceKm = haversineKm(loc.lat, loc.lng, dLat, dLng)
        }
    }

    // Debounced destination search
    LaunchedEffect(searchText) {
        if (searchText.length < 3) { searchResults = emptyList(); return@LaunchedEffect }
        delay(500)
        searchResults = routeService.search(searchText)
    }

    // Check-in countdown: ticks down, then shows the "have you arrived safely?" prompt
    LaunchedEffect(isActive, checkInTimeLeft, showCheckInPrompt) {
        if (isActive && checkInTimeLeft != null && checkInTimeLeft!! > 0 && !showCheckInPrompt) {
            delay(1000)
            checkInTimeLeft = checkInTimeLeft!! - 1
            if (checkInTimeLeft == 0) showCheckInPrompt = true
        }
    }

    // Safety-confirmation countdown: if unconfirmed within 15s, auto-trigger emergency
    LaunchedEffect(showCheckInPrompt) {
        if (showCheckInPrompt) {
            checkInCountdown = 15
            while (checkInCountdown > 0) {
                delay(1000)
                checkInCountdown -= 1
            }
            if (showCheckInPrompt) {
                viewModel.triggerEmergency("SafeWalk Check-In Timeout")
                showCheckInPrompt = false
            }
        }
    }

    fun fetchRoute(dest: PlaceResult, loc: GeoPoint) {
        scope.launch {
            isLoadingRoute = true
            route = routeService.getRoute(loc.lat, loc.lng, dest.lat, dest.lng)
            isLoadingRoute = false
        }
    }

    Column(Modifier.fillMaxSize().background(SentinelColors.BgLight)) {

        // Header + search
        Column(Modifier.fillMaxWidth().background(SentinelColors.Slate900).padding(20.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(Icons.Filled.Navigation, contentDescription = null, tint = SentinelColors.Blue500, modifier = Modifier.size(16.dp))
                Spacer(Modifier.width(6.dp))
                Text("SAFE NAVIGATION", color = SentinelColors.Blue500, fontSize = 11.sp, fontWeight = FontWeight.Black, letterSpacing = 1.sp)
            }
            Text("SafeWalk", color = Color.White, fontSize = 22.sp, fontWeight = FontWeight.Black)
            Spacer(Modifier.height(10.dp))
            OutlinedTextField(
                value = searchText, onValueChange = { searchText = it },
                placeholder = { Text("Search destination...", color = Color.White.copy(alpha = 0.5f)) },
                leadingIcon = { Icon(Icons.Filled.Search, contentDescription = null, tint = Color.White.copy(alpha = 0.6f)) },
                colors = OutlinedTextFieldDefaults.colors(
                    focusedTextColor = Color.White, unfocusedTextColor = Color.White,
                    focusedBorderColor = Color.White.copy(alpha = 0.3f), unfocusedBorderColor = Color.White.copy(alpha = 0.2f)
                ),
                singleLine = true, modifier = Modifier.fillMaxWidth(), enabled = !isActive
            )
            if (searchResults.isNotEmpty()) {
                Card(shape = RoundedCornerShape(16.dp), colors = CardDefaults.cardColors(containerColor = Color.White), modifier = Modifier.fillMaxWidth().padding(top = 4.dp)) {
                    Column {
                        searchResults.forEach { r ->
                            Row(
                                Modifier.fillMaxWidth()
                                    .clickable {
                                        destination = r
                                        searchText = r.displayName.split(",").first()
                                        searchResults = emptyList()
                                        lastLocation?.let { fetchRoute(r, it) }
                                    }
                                    .padding(12.dp),
                                verticalAlignment = Alignment.Top
                            ) {
                                Icon(Icons.Filled.LocationOn, contentDescription = null, tint = SentinelColors.PrimaryRed, modifier = Modifier.size(16.dp))
                                Spacer(Modifier.width(8.dp))
                                Text(r.displayName, fontSize = 12.sp, color = SentinelColors.Slate700, maxLines = 2)
                            }
                        }
                    }
                }
            }
        }

        // Route info bar
        if (route != null || isLoadingRoute) {
            Card(shape = RoundedCornerShape(0.dp), colors = CardDefaults.cardColors(containerColor = Color.White), modifier = Modifier.fillMaxWidth()) {
                Column(Modifier.padding(14.dp)) {
                    if (isLoadingRoute) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            CircularProgressIndicator(modifier = Modifier.size(14.dp), strokeWidth = 2.dp, color = SentinelColors.Blue500)
                            Spacer(Modifier.width(8.dp))
                            Text("Calculating route…", fontSize = 12.sp, color = SentinelColors.Blue500, fontWeight = FontWeight.Bold)
                        }
                    } else if (route != null) {
                        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                            Text("${(route!!.distanceMeters / 1000).let { "%.2f".format(it) }} km", fontWeight = FontWeight.Bold, fontSize = 13.sp, color = SentinelColors.Slate700)
                            Text("${(route!!.durationSeconds / 60).toInt()} min", fontWeight = FontWeight.Bold, fontSize = 13.sp, color = SentinelColors.Slate700)
                            safetyScore?.let { s ->
                                Text("$s% safe", fontWeight = FontWeight.Black, fontSize = 13.sp, color = if (s > 80) SentinelColors.Emerald500 else SentinelColors.Amber500)
                            }
                        }
                    }
                }
            }
        }

        if (nearbyZones.isNotEmpty()) {
            Row(Modifier.fillMaxWidth().background(Color.White).padding(horizontal = 8.dp, vertical = 8.dp), horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                LegendDot(Color(0xFF2563EB), "${nearbyZones.count { it.type == "police" }} Police", activeFilter == "all" || activeFilter == "police") { activeFilter = if (activeFilter == "police") "all" else "police" }
                LegendDot(Color(0xFFDC2626), "${nearbyZones.count { it.type == "hospital" || it.type == "clinic" }} Hospitals", activeFilter == "all" || activeFilter == "hospital") { activeFilter = if (activeFilter == "hospital") "all" else "hospital" }
                LegendDot(Color(0xFF16A34A), "${nearbyZones.count { it.type == "pharmacy" || it.type == "chemist" }} Pharmacies", activeFilter == "all" || activeFilter == "pharmacy") { activeFilter = if (activeFilter == "pharmacy") "all" else "pharmacy" }
            }
        }

        // Map
        Box(Modifier.weight(1f)) {
            AndroidView(
                modifier = Modifier.fillMaxSize(),
                factory = { ctx -> MapView(ctx).apply { setTileSource(TileSourceFactory.MAPNIK); setMultiTouchControls(true); controller.setZoom(15.0) } },
                update = { mapView ->
                    mapView.overlays.clear()
                    val center = lastLocation?.let { OsmGeoPoint(it.lat, it.lng) }
                    if (center != null) {
                        val meMarker = Marker(mapView).apply {
                            position = center; title = "You are here"
                            if (userBitmap != null) {
                                icon = android.graphics.drawable.BitmapDrawable(mapView.context.resources, userBitmap)
                                setAnchor(Marker.ANCHOR_CENTER, Marker.ANCHOR_CENTER)
                            } else {
                                icon = coloredDotDrawable(mapView.context, android.graphics.Color.parseColor("#3B82F6"))
                            }
                        }
                        mapView.overlays.add(meMarker)
                        if (!hasCentered || isActive) {
                            mapView.controller.setCenter(center)
                            hasCentered = true
                        }
                    }
                    // Nearby amenity markers - limit to 100 to prevent map view lag/crashing
                    nearbyZones.take(100).forEach { z ->
                        val category = when (z.type) {
                            "police" -> "police"
                            "hospital", "clinic" -> "hospital"
                            "pharmacy", "chemist" -> "pharmacy"
                            else -> "other"
                        }
                        
                        if (activeFilter == "all" || activeFilter == category) {
                            val colorStr = when (category) {
                                "police" -> "#2563EB"
                                "hospital" -> "#DC2626"
                                "pharmacy" -> "#16A34A"
                                else -> "#94A3B8"
                            }
                            val emojiStr = when (category) {
                                "police" -> "👮"
                                "hospital" -> "🏥"
                                "pharmacy" -> "💊"
                                else -> "📍"
                            }
                            val marker = Marker(mapView).apply {
                                position = OsmGeoPoint(z.lat, z.lng)
                                title = z.type.replaceFirstChar { it.uppercase() }
                                snippet = "${z.distanceMeters.toInt()} m away"
                                icon = emojiMarkerDrawable(mapView.context, emojiStr, android.graphics.Color.parseColor(colorStr))
                                setAnchor(Marker.ANCHOR_CENTER, Marker.ANCHOR_CENTER)
                            }
                            mapView.overlays.add(marker)
                        }
                    }
                    destination?.let { d ->
                        val dMarker = Marker(mapView).apply { position = OsmGeoPoint(d.lat, d.lng); title = d.displayName }
                        mapView.overlays.add(dMarker)
                    }
                    route?.let { r ->
                        val line = Polyline().apply {
                            setPoints(r.coordinates.map { (lat, lng) -> OsmGeoPoint(lat, lng) })
                            outlinePaint.color = android.graphics.Color.parseColor("#3B82F6")
                            outlinePaint.strokeWidth = 8f
                        }
                        mapView.overlays.add(line)
                    }
                    mapView.invalidate()
                }
            )
        }

        // Bottom action panel
        Column(Modifier.fillMaxWidth().background(Color.White).padding(16.dp)) {
            if (!isActive) {
                if (destination != null) {
                    Row(Modifier.fillMaxWidth().background(SentinelColors.Slate50, RoundedCornerShape(16.dp)).padding(12.dp), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                        Text("Check-in interval:", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = SentinelColors.Slate600)
                        var expanded by remember { mutableStateOf(false) }
                        Box {
                            Row(Modifier.clickable { expanded = true }.background(Color.White, RoundedCornerShape(10.dp)).border(1.dp, SentinelColors.Slate200, RoundedCornerShape(10.dp)).padding(horizontal = 10.dp, vertical = 6.dp), verticalAlignment = Alignment.CenterVertically) {
                                Text(intervalLabel(checkInMinutes), fontSize = 12.sp, fontWeight = FontWeight.Bold, color = SentinelColors.Slate700)
                                Icon(Icons.Filled.ArrowDropDown, contentDescription = null, modifier = Modifier.size(16.dp))
                            }
                            DropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }) {
                                listOf(0.166f to "10 seconds (Test)", 1f to "1 minute", 5f to "5 minutes", 10f to "10 minutes", 30f to "30 minutes").forEach { (v, label) ->
                                    DropdownMenuItem(text = { Text(label) }, onClick = { checkInMinutes = v; expanded = false })
                                }
                            }
                        }
                    }
                    Spacer(Modifier.height(10.dp))
                }
                Button(
                    onClick = {
                        if (destination != null) {
                            isActive = true
                            checkInTimeLeft = (checkInMinutes * 60).toInt()
                            showCheckInPrompt = false
                        }
                    },
                    enabled = destination != null,
                    modifier = Modifier.fillMaxWidth().height(52.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = SentinelColors.Blue600, disabledContainerColor = SentinelColors.Slate100),
                    shape = RoundedCornerShape(16.dp)
                ) {
                    Icon(Icons.Filled.Navigation, contentDescription = null)
                    Spacer(Modifier.width(8.dp))
                    Text(if (destination != null) "Start SafeWalk" else "Select a destination", fontWeight = FontWeight.Bold)
                }
            } else {
                Row(Modifier.fillMaxWidth().background(Color(0xFFEFF6FF), RoundedCornerShape(16.dp)).padding(12.dp), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Box(Modifier.size(8.dp).background(SentinelColors.Blue500, androidx.compose.foundation.shape.CircleShape))
                        Spacer(Modifier.width(8.dp))
                        Text("SafeWalk Active", color = SentinelColors.Blue600, fontWeight = FontWeight.Bold, fontSize = 13.sp)
                    }
                    Column(horizontalAlignment = Alignment.End) {
                        Text("%.2f km".format(walkedDistanceKm), color = SentinelColors.Blue600, fontWeight = FontWeight.Black, fontSize = 13.sp)
                        checkInTimeLeft?.let { t -> Text("Check-in in: ${t / 60}:${(t % 60).toString().padStart(2, '0')}", color = SentinelColors.Blue500, fontSize = 11.sp, fontWeight = FontWeight.Bold) }
                    }
                }
                Spacer(Modifier.height(10.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    Button(
                        onClick = { viewModel.triggerEmergency("SafeWalk SOS") },
                        modifier = Modifier.weight(1f).height(48.dp),
                        colors = ButtonDefaults.buttonColors(containerColor = SentinelColors.PrimaryRed), shape = RoundedCornerShape(16.dp)
                    ) { Text("🚨 SOS", fontWeight = FontWeight.Black) }
                    Button(
                        onClick = { isActive = false; destination = null; route = null; checkInTimeLeft = null; showCheckInPrompt = false },
                        modifier = Modifier.weight(1f).height(48.dp),
                        colors = ButtonDefaults.buttonColors(containerColor = SentinelColors.Slate200), shape = RoundedCornerShape(16.dp)
                    ) { Text("End Walk", fontWeight = FontWeight.Black, color = SentinelColors.Slate700) }
                }
            }
        }
    }

    // "Have you arrived safely?" check-in prompt
    if (showCheckInPrompt) {
        androidx.compose.material3.AlertDialog(
            onDismissRequest = {},
            title = { Text("Have you arrived safely?") },
            text = { Text("Please confirm your safety. Emergency alert will trigger in ${checkInCountdown}s.") },
            confirmButton = {
                Button(
                    onClick = { showCheckInPrompt = false; checkInTimeLeft = (checkInMinutes * 60).toInt() },
                    colors = ButtonDefaults.buttonColors(containerColor = SentinelColors.Emerald500)
                ) { Text("✓ I'm Safe", fontWeight = FontWeight.Black) }
            }
        )
    }
}

@Composable
private fun LegendDot(color: Color, label: String, isSelected: Boolean = true, onClick: () -> Unit = {}) {
    Row(Modifier.clickable { onClick() }.background(if(isSelected) color.copy(alpha=0.1f) else Color.Transparent, RoundedCornerShape(12.dp)).padding(horizontal=8.dp, vertical=6.dp), verticalAlignment = Alignment.CenterVertically) {
        Box(Modifier.size(8.dp).background(if(isSelected) color else color.copy(alpha=0.3f), androidx.compose.foundation.shape.CircleShape))
        Spacer(Modifier.width(5.dp))
        Text(label, fontSize = 11.sp, fontWeight = FontWeight.Bold, color = if(isSelected) SentinelColors.Slate600 else SentinelColors.Slate400)
    }
}

private fun intervalLabel(minutes: Float) = when (minutes) {
    0.166f -> "10 sec (Test)"
    1f -> "1 min"
    5f -> "5 min"
    10f -> "10 min"
    30f -> "30 min"
    else -> "$minutes min"
}

private fun haversineKm(lat1: Double, lon1: Double, lat2: Double, lon2: Double): Double {
    val r = 6371.0
    val dLat = Math.toRadians(lat2 - lat1)
    val dLon = Math.toRadians(lon2 - lon1)
    val a = kotlin.math.sin(dLat / 2).let { it * it } +
        kotlin.math.cos(Math.toRadians(lat1)) * kotlin.math.cos(Math.toRadians(lat2)) * kotlin.math.sin(dLon / 2).let { it * it }
    return r * 2 * kotlin.math.atan2(kotlin.math.sqrt(a), kotlin.math.sqrt(1 - a))
}

/** Simple colored-dot marker icon, since osmdroid has no built-in colored pins. */
private fun coloredDotDrawable(context: android.content.Context, color: Int): android.graphics.drawable.Drawable {
    val size = 48
    val bitmap = android.graphics.Bitmap.createBitmap(size, size, android.graphics.Bitmap.Config.ARGB_8888)
    val canvas = android.graphics.Canvas(bitmap)
    val paint = android.graphics.Paint(android.graphics.Paint.ANTI_ALIAS_FLAG).apply { this.color = color }
    canvas.drawCircle(size / 2f, size / 2f, size / 2.4f, paint)
    paint.color = android.graphics.Color.WHITE
    paint.style = android.graphics.Paint.Style.STROKE
    paint.strokeWidth = 4f
    canvas.drawCircle(size / 2f, size / 2f, size / 2.4f, paint)
    return android.graphics.drawable.BitmapDrawable(context.resources, bitmap)
}

private fun getCircularBitmap(bitmap: android.graphics.Bitmap): android.graphics.Bitmap {
    val size = Math.min(bitmap.width, bitmap.height)
    val output = android.graphics.Bitmap.createBitmap(size, size, android.graphics.Bitmap.Config.ARGB_8888)
    val canvas = android.graphics.Canvas(output)
    val paint = android.graphics.Paint(android.graphics.Paint.ANTI_ALIAS_FLAG)
    val rect = android.graphics.Rect(0, 0, bitmap.width, bitmap.height)
    val destRect = android.graphics.Rect(0, 0, size, size)
    canvas.drawARGB(0, 0, 0, 0)
    canvas.drawCircle(size / 2f, size / 2f, size / 2f, paint)
    paint.xfermode = android.graphics.PorterDuffXfermode(android.graphics.PorterDuff.Mode.SRC_IN)
    canvas.drawBitmap(bitmap, rect, destRect, paint)

    // Add white border
    paint.xfermode = null
    paint.style = android.graphics.Paint.Style.STROKE
    paint.color = android.graphics.Color.WHITE
    paint.strokeWidth = 6f
    canvas.drawCircle(size / 2f, size / 2f, (size / 2f) - 3f, paint)
    
    // Resize down to map marker size
    return android.graphics.Bitmap.createScaledBitmap(output, 84, 84, true)
}

private fun emojiMarkerDrawable(context: android.content.Context, emoji: String, color: Int): android.graphics.drawable.Drawable {
    val size = 90
    val bitmap = android.graphics.Bitmap.createBitmap(size, size, android.graphics.Bitmap.Config.ARGB_8888)
    val canvas = android.graphics.Canvas(bitmap)
    val paint = android.graphics.Paint(android.graphics.Paint.ANTI_ALIAS_FLAG).apply { this.color = color }
    
    canvas.drawCircle(size / 2f, size / 2f, size / 2.2f, paint)
    paint.color = android.graphics.Color.WHITE
    paint.style = android.graphics.Paint.Style.STROKE
    paint.strokeWidth = 4f
    canvas.drawCircle(size / 2f, size / 2f, size / 2.2f, paint)
    
    val textPaint = android.graphics.Paint(android.graphics.Paint.ANTI_ALIAS_FLAG).apply {
        textSize = 48f
        textAlign = android.graphics.Paint.Align.CENTER
    }
    val xPos = (canvas.width / 2).toFloat()
    val yPos = (canvas.height / 2 - (textPaint.descent() + textPaint.ascent()) / 2)
    canvas.drawText(emoji, xPos, yPos, textPaint)
    
    return android.graphics.drawable.BitmapDrawable(context.resources, bitmap)
}
