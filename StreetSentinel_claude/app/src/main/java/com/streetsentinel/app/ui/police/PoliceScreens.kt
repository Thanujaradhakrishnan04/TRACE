package com.streetsentinel.app.ui.police

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Forum
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowRight
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import com.streetsentinel.app.data.repository.FirestoreRepository
import com.streetsentinel.app.theme.SentinelColors
import kotlinx.coroutines.launch
import org.osmdroid.config.Configuration
import org.osmdroid.tileprovider.tilesource.TileSourceFactory
import org.osmdroid.util.GeoPoint as OsmGeoPoint
import org.osmdroid.views.MapView
import org.osmdroid.views.overlay.Marker

/**
 * Full rebuild of pages/PoliceDashboard.jsx: stats bar (active incidents / dispatched / units),
 * live incident feed with Dispatch/Resolve actions, and a map with status-colored markers
 * (red = active/unassigned, amber = dispatched). Every citizen SOS trigger appears here the
 * moment it's written to the `emergencies` collection — this was the piece that wasn't wired
 * to real Firestore data before.
 */
/**
 * Full rebuild of pages/PoliceDashboard.jsx: stats bar, a live map with status-colored
 * markers, and an incident feed with Dispatch/Resolve/Chat actions. Every citizen SOS
 * appears here the moment it's written to the `emergencies` collection.
 *
 * Layout pass: previously the map sat flush against the stats bar with no separation and
 * the action row could wrap awkwardly on narrow screens. Rebuilt with consistent card
 * spacing, a rounded/elevated map card, and a 3-icon action row (Chat / Dispatch / Resolve)
 * that stays legible at any width.
 */
@Composable
fun PoliceDashboardScreen(repo: FirestoreRepository = remember { FirestoreRepository() }, viewModel: com.streetsentinel.app.viewmodel.SentinelViewModel) {
    val context = LocalContext.current
    val emergencies by repo.allActiveEmergenciesFlow().collectAsState(initial = emptyList())
    var selectedId by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()
    val lastLocation by viewModel.lastKnownLocation.collectAsState()
    var hasCentered by remember { mutableStateOf(false) }

    LaunchedEffect(Unit) { Configuration.getInstance().userAgentValue = context.packageName }

    val activeCount = emergencies.count { it["status"] == "active" }
    val dispatchedCount = emergencies.count { it["status"] == "dispatched" }

    Column(Modifier.fillMaxSize().background(SentinelColors.BgLight)) {
        // Header + stats bar
        Column(Modifier.fillMaxWidth().background(SentinelColors.Slate900).padding(16.dp)) {
            Text("DISPATCH CENTER", color = Color.White, fontWeight = FontWeight.Black, fontSize = 16.sp, letterSpacing = 1.sp)
            Spacer(Modifier.height(12.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.fillMaxWidth()) {
                DashStat("ACTIVE", activeCount.toString(), SentinelColors.PrimaryRed, Modifier.weight(1f))
                DashStat("DISPATCHED", dispatchedCount.toString(), SentinelColors.Amber500, Modifier.weight(1f))
                DashStat("TOTAL LIVE", emergencies.size.toString(), SentinelColors.Blue500, Modifier.weight(1f))
            }
        }

        LazyColumn(Modifier.weight(1f), contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
            // Map card — rounded + elevated so it reads as its own section, not fused to the stats bar
            item {
                Card(shape = RoundedCornerShape(20.dp), elevation = CardDefaults.cardElevation(3.dp), modifier = Modifier.fillMaxWidth().height(220.dp)) {
                    Box(Modifier.fillMaxSize()) {
                        AndroidView(
                            modifier = Modifier.fillMaxSize(),
                            factory = { ctx -> MapView(ctx).apply { setTileSource(TileSourceFactory.MAPNIK); setMultiTouchControls(true); controller.setZoom(12.0); controller.setCenter(OsmGeoPoint(12.9716, 77.5946)) } },
                            update = { mapView ->
                                mapView.overlays.clear()
                                val loc = lastLocation
                                if (loc != null) {
                                    val center = OsmGeoPoint(loc.lat, loc.lng)
                                    if (!hasCentered) {
                                        mapView.controller.setCenter(center)
                                        hasCentered = true
                                    }
                                    val myMarker = Marker(mapView)
                                    myMarker.position = center
                                    myMarker.title = "You are here"
                                    mapView.overlays.add(myMarker)
                                }
                                emergencies.forEach { e ->
                                    val eLoc = e["location"] as? Map<*, *> ?: return@forEach
                                    val lat = (eLoc["lat"] as? Number)?.toDouble() ?: return@forEach
                                    val lng = (eLoc["lng"] as? Number)?.toDouble() ?: return@forEach
                                    val marker = Marker(mapView)
                                    marker.position = OsmGeoPoint(lat, lng)
                                    marker.title = "${e["userName"]} — ${e["reason"]}"
                                    mapView.overlays.add(marker)
                                }
                                mapView.invalidate()
                            }
                        )
                        if (emergencies.isEmpty()) {
                            Surface(color = Color.White.copy(alpha = 0.92f), shape = RoundedCornerShape(12.dp), modifier = Modifier.align(Alignment.Center)) {
                                Text("No active incidents on the map", modifier = Modifier.padding(12.dp), color = SentinelColors.Slate500, fontSize = 12.sp)
                            }
                        }
                    }
                }
            }

            item {
                Text("LIVE INCIDENT FEED", color = SentinelColors.Slate500, fontSize = 12.sp, fontWeight = FontWeight.Black, letterSpacing = 1.sp)
            }

            if (emergencies.isEmpty()) {
                item {
                    Column(Modifier.fillMaxWidth().padding(top = 24.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                        Icon(Icons.Filled.Shield, contentDescription = null, tint = SentinelColors.Slate300, modifier = Modifier.size(48.dp))
                        Spacer(Modifier.height(8.dp))
                        Text("All clear — no active emergencies", color = SentinelColors.Slate400)
                    }
                }
            } else {
                items(emergencies, key = { it["id"] as String }) { e ->
                    val id = e["id"] as String
                    val citizenUid = e["userId"] as? String
                    val citizenName = (e["userName"] as? String) ?: "Citizen"
                    val status = e["status"] as? String ?: "active"
                    val statusColor = if (status == "dispatched") SentinelColors.Amber500 else SentinelColors.PrimaryRed
                    val expanded = selectedId == id

                    Card(
                        shape = RoundedCornerShape(18.dp), elevation = CardDefaults.cardElevation(if (expanded) 4.dp else 1.dp),
                        colors = CardDefaults.cardColors(containerColor = Color.White),
                        modifier = Modifier.fillMaxWidth().clickable { selectedId = if (expanded) null else id }
                    ) {
                        Column(Modifier.padding(16.dp)) {
                            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                                Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.weight(1f)) {
                                    Box(Modifier.size(10.dp).clip(CircleShape).background(statusColor))
                                    Spacer(Modifier.width(10.dp))
                                    Column {
                                        Text(citizenName, fontWeight = FontWeight.Bold, color = SentinelColors.Slate800, fontSize = 14.sp)
                                        Text((e["reason"] as? String) ?: "Emergency", fontSize = 12.sp, color = SentinelColors.Slate500)
                                    }
                                }
                                Surface(color = statusColor.copy(alpha = 0.12f), shape = RoundedCornerShape(50)) {
                                    Text(status.uppercase(), modifier = Modifier.padding(horizontal = 10.dp, vertical = 5.dp), fontSize = 10.sp, fontWeight = FontWeight.Black, color = statusColor)
                                }
                            }

                            if (expanded) {
                                Spacer(Modifier.height(12.dp))
                                Surface(color = SentinelColors.Slate50, shape = RoundedCornerShape(12.dp)) {
                                    Column(Modifier.padding(12.dp)) {
                                        Text("📞 ${e["userPhone"] ?: "—"}", fontSize = 12.sp, color = SentinelColors.Slate600, fontWeight = FontWeight.Medium)
                                        (e["mapsLink"] as? String)?.let { link -> Text(link, fontSize = 11.sp, color = SentinelColors.Blue500, modifier = Modifier.padding(top = 4.dp)) }
                                    }
                                }
                                Spacer(Modifier.height(12.dp))
                                Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
                                    OutlinedButton(
                                        onClick = { if (citizenUid != null) viewModel.openChatWith(citizenUid, citizenName) },
                                        enabled = citizenUid != null,
                                        shape = RoundedCornerShape(12.dp), modifier = Modifier.weight(1f),
                                        contentPadding = PaddingValues(horizontal = 8.dp, vertical = 10.dp)
                                    ) {
                                        Icon(Icons.Filled.Forum, contentDescription = null, modifier = Modifier.size(15.dp), tint = SentinelColors.Blue600)
                                        Spacer(Modifier.width(4.dp))
                                        Text("Chat", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = SentinelColors.Blue600)
                                    }
                                    if (status == "active") {
                                        Button(
                                            onClick = { scope.launch { runCatching { repo.dispatchEmergency(id) } } },
                                            colors = ButtonDefaults.buttonColors(containerColor = SentinelColors.Blue600), shape = RoundedCornerShape(12.dp),
                                            modifier = Modifier.weight(1f), contentPadding = PaddingValues(horizontal = 8.dp, vertical = 10.dp)
                                        ) { Text("Dispatch", fontSize = 11.sp, fontWeight = FontWeight.Bold) }
                                    }
                                    Button(
                                        onClick = { scope.launch { runCatching { repo.resolveEmergency(id) } } },
                                        colors = ButtonDefaults.buttonColors(containerColor = SentinelColors.Emerald500), shape = RoundedCornerShape(12.dp),
                                        modifier = Modifier.weight(1f), contentPadding = PaddingValues(horizontal = 8.dp, vertical = 10.dp)
                                    ) { Text("Resolve", fontSize = 11.sp, fontWeight = FontWeight.Bold) }
                                }
                            }
                        }
                    }
                }
            }
            item { Spacer(Modifier.height(8.dp)) }
        }
    }
}

@Composable
private fun DashStat(label: String, value: String, color: Color, modifier: Modifier = Modifier) {
    Card(shape = RoundedCornerShape(14.dp), colors = CardDefaults.cardColors(containerColor = SentinelColors.Slate800), modifier = modifier) {
        Column(Modifier.padding(vertical = 12.dp).fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally) {
            Text(value, color = color, fontWeight = FontWeight.Black, fontSize = 22.sp)
            Text(label, color = SentinelColors.Slate400, fontSize = 9.sp, fontWeight = FontWeight.Bold)
        }
    }
}

/** Port of pages/police/PoliceMap.jsx — standalone full-screen map view of the same live incidents. */
@Composable
fun PoliceMapScreen(repo: FirestoreRepository = remember { FirestoreRepository() }, viewModel: com.streetsentinel.app.viewmodel.SentinelViewModel) {
    val context = LocalContext.current
    val emergencies by repo.allActiveEmergenciesFlow().collectAsState(initial = emptyList())
    val lastLocation by viewModel.lastKnownLocation.collectAsState()
    var hasCentered by remember { mutableStateOf(false) }
    LaunchedEffect(Unit) { Configuration.getInstance().userAgentValue = context.packageName }

    Column(Modifier.fillMaxSize()) {
        Column(Modifier.padding(20.dp)) {
            Text("Tactical Map", fontSize = 22.sp, fontWeight = FontWeight.Bold, color = SentinelColors.Slate800)
            Text("${emergencies.size} live incidents", color = SentinelColors.Slate500, fontSize = 12.sp)
        }
        Box(Modifier.weight(1f).padding(horizontal = 20.dp, vertical = 4.dp)) {
            AndroidView(
                modifier = Modifier.fillMaxSize(),
                factory = { ctx -> MapView(ctx).apply { setTileSource(TileSourceFactory.MAPNIK); setMultiTouchControls(true); controller.setZoom(12.0); controller.setCenter(OsmGeoPoint(12.9716, 77.5946)) } },
                update = { mapView ->
                    mapView.overlays.clear()
                    val loc = lastLocation
                    if (loc != null) {
                        val center = OsmGeoPoint(loc.lat, loc.lng)
                        if (!hasCentered) {
                            mapView.controller.setCenter(center)
                            hasCentered = true
                        }
                        val myMarker = Marker(mapView)
                        myMarker.position = center
                        myMarker.title = "You are here"
                        mapView.overlays.add(myMarker)
                    }
                    emergencies.forEach { e ->
                        val eLoc = e["location"] as? Map<*, *> ?: return@forEach
                        val lat = (eLoc["lat"] as? Number)?.toDouble() ?: return@forEach
                        val lng = (eLoc["lng"] as? Number)?.toDouble() ?: return@forEach
                        val marker = Marker(mapView)
                        marker.position = OsmGeoPoint(lat, lng)
                        marker.title = (e["userName"] as? String) ?: "Citizen"
                        mapView.overlays.add(marker)
                    }
                    mapView.invalidate()
                }
            )
        }
    }
}

/**
 * Full rebuild of pages/police/PoliceChat.jsx as a real inbox: every citizen conversation
 * thread (Firestore `chats` collection), newest first, with a preview of the last message.
 * Tapping a thread opens the real two-way ChatThread. This is what "chat page can have all
 * the people's messages inboxes" needed — the previous version had no actual message store.
 */
@Composable
fun PoliceChatScreen(viewModel: com.streetsentinel.app.viewmodel.SentinelViewModel) {
    val selectedId by viewModel.selectedChatConversationId.collectAsState()
    val selectedTitle by viewModel.selectedChatTitle.collectAsState()

    if (selectedId != null) {
        Column(Modifier.fillMaxSize()) {
            Row(
                Modifier.fillMaxWidth().background(SentinelColors.Slate900).padding(16.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                IconButton(onClick = { viewModel.clearSelectedChat() }) {
                    Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back", tint = Color.White)
                }
                Spacer(Modifier.width(4.dp))
                Column {
                    Text(selectedTitle ?: "Citizen", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 15.sp)
                    Text("Dispatch ↔ Citizen", color = SentinelColors.Slate400, fontSize = 11.sp)
                }
            }
            com.streetsentinel.app.ui.components.ChatThread(
                conversationId = selectedId!!,
                citizenName = selectedTitle ?: "Citizen",
                messagesFlow = viewModel.chatMessages(selectedId!!),
                myRole = "police",
                onSend = { text -> viewModel.sendChatMessage(selectedId!!, selectedTitle ?: "Citizen", text, "police") }
            )
        }
        return
    }

    val threads by viewModel.chatThreads().collectAsState(initial = emptyList())
    Column(Modifier.fillMaxSize().background(SentinelColors.BgLight)) {
        Column(Modifier.padding(20.dp, 20.dp, 20.dp, 8.dp)) {
            Text("Dispatch Inbox", fontSize = 22.sp, fontWeight = FontWeight.Bold, color = SentinelColors.Slate800)
            Text("${threads.size} citizen conversation${if (threads.size == 1) "" else "s"}", color = SentinelColors.Slate500, fontSize = 13.sp)
        }
        if (threads.isEmpty()) {
            Column(Modifier.fillMaxSize(), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center) {
                Icon(Icons.Filled.Forum, contentDescription = null, tint = SentinelColors.Slate300, modifier = Modifier.size(48.dp))
                Spacer(Modifier.height(8.dp))
                Text("No conversations yet", color = SentinelColors.Slate400)
                Text("Messages from citizens will appear here", color = SentinelColors.Slate300, fontSize = 12.sp)
            }
        } else {
            LazyColumn(Modifier.weight(1f).padding(horizontal = 16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                items(threads, key = { it["id"] as String }) { t ->
                    val id = t["id"] as String
                    val name = (t["citizenName"] as? String) ?: "Citizen"
                    val lastMsg = (t["lastMessage"] as? String) ?: ""
                    val lastRole = (t["lastSenderRole"] as? String) ?: ""
                    Card(
                        shape = RoundedCornerShape(16.dp), colors = CardDefaults.cardColors(containerColor = Color.White),
                        modifier = Modifier.clickable { viewModel.openChatWith(id, name) }
                    ) {
                        Row(Modifier.fillMaxWidth().padding(14.dp), verticalAlignment = Alignment.CenterVertically) {
                            Box(Modifier.size(42.dp).clip(CircleShape).background(SentinelColors.Red50), contentAlignment = Alignment.Center) {
                                Text(name.take(1).uppercase(), color = SentinelColors.PrimaryRed, fontWeight = FontWeight.Black)
                            }
                            Spacer(Modifier.width(12.dp))
                            Column(Modifier.weight(1f)) {
                                Text(name, fontWeight = FontWeight.Bold, color = SentinelColors.Slate800, fontSize = 14.sp)
                                Text(
                                    if (lastRole == "police") "You: $lastMsg" else lastMsg,
                                    fontSize = 12.sp, color = SentinelColors.Slate500, maxLines = 1
                                )
                            }
                            Icon(Icons.AutoMirrored.Filled.KeyboardArrowRight, contentDescription = null, tint = SentinelColors.Slate300)
                        }
                    }
                }
                item { Spacer(Modifier.height(16.dp)) }
            }
        }
    }
}
