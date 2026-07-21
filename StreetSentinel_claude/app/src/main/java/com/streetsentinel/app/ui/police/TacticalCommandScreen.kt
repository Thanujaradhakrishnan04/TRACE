package com.streetsentinel.app.ui.police

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Forum
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.streetsentinel.app.data.model.GeoPoint
import com.streetsentinel.app.data.model.SentinelUser
import com.streetsentinel.app.data.repository.FirestoreRepository
import com.streetsentinel.app.services.NearbyZone
import com.streetsentinel.app.services.OverpassService
import com.streetsentinel.app.theme.SentinelColors
import java.text.SimpleDateFormat
import java.util.*

private enum class TacticalTab { SOS_FEED, PROFILES, STATIONS }

/**
 * Full rebuild of pages/police/TacticalCommand.jsx: 3 tabs —
 *  - SOS Feed: same live incident list as PoliceDashboard, plus a historic case ledger table
 *    (all emergencies regardless of status — resolved ones included).
 *  - Profiles: every citizen account in Firestore (`users` where role == citizen), expandable
 *    to show that citizen's saved emergency contacts and alert history.
 *  - Stations: nearby police stations pulled from OverpassService, same as the web app's
 *    "Nearby Assets" panel.
 * This is the screen the previous pass left as 4 static placeholder rows — it's now backed
 * entirely by live Firestore data.
 */
@Composable
fun TacticalCommandScreen(
    repo: FirestoreRepository = remember { FirestoreRepository() },
    viewModel: com.streetsentinel.app.viewmodel.SentinelViewModel,
    onNavigateToChat: () -> Unit = {}
) {
    var tab by remember { mutableStateOf(TacticalTab.SOS_FEED) }
 
    Column(Modifier.fillMaxSize().background(SentinelColors.Slate900)) {
        Column(Modifier.fillMaxWidth().padding(20.dp, 20.dp, 20.dp, 8.dp)) {
            Text("TACTICAL COMMAND", color = Color.White, fontSize = 20.sp, fontWeight = FontWeight.Black, letterSpacing = 1.sp)
            Text("Citywide citizen & incident oversight", color = SentinelColors.Slate500, fontSize = 12.sp)
        }
        Row(Modifier.fillMaxWidth().padding(horizontal = 20.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            TabChip("SOS Feed", tab == TacticalTab.SOS_FEED) { tab = TacticalTab.SOS_FEED }
            TabChip("Profiles", tab == TacticalTab.PROFILES) { tab = TacticalTab.PROFILES }
            TabChip("Stations", tab == TacticalTab.STATIONS) { tab = TacticalTab.STATIONS }
        }
        Spacer(Modifier.height(12.dp))
        when (tab) {
            TacticalTab.SOS_FEED -> SosFeedTab(repo)
            TacticalTab.PROFILES -> ProfilesTab(repo, viewModel, onNavigateToChat)
            TacticalTab.STATIONS -> StationsTab(viewModel)
        }
    }
}

@Composable
private fun TabChip(label: String, selected: Boolean, onClick: () -> Unit) {
    Surface(
        color = if (selected) SentinelColors.PrimaryRed else SentinelColors.Slate800,
        shape = RoundedCornerShape(50),
        modifier = Modifier.clickable { onClick() }
    ) {
        Text(label, modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp), color = Color.White, fontSize = 12.sp, fontWeight = FontWeight.Bold)
    }
}

@Composable
private fun SosFeedTab(repo: FirestoreRepository) {
    val allEmergencies by repo.allEmergenciesFlow().collectAsState(initial = emptyList())
    val active = allEmergencies.filter { it["status"] != "resolved" }
    val resolved = allEmergencies.filter { it["status"] == "resolved" }

    LazyColumn(Modifier.fillMaxSize().padding(horizontal = 20.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        item { SectionLabel("LIVE (${active.size})") }
        if (active.isEmpty()) {
            item { EmptyRow("No active SOS signals") }
        } else {
            items(active, key = { "a_" + it["id"] }) { e -> CaseRow(e, live = true) }
        }
        item { Spacer(Modifier.height(8.dp)); SectionLabel("CASE LEDGER — RESOLVED (${resolved.size})") }
        if (resolved.isEmpty()) {
            item { EmptyRow("No resolved cases yet") }
        } else {
            items(resolved, key = { "r_" + it["id"] }) { e -> CaseRow(e, live = false) }
        }
        item { Spacer(Modifier.height(20.dp)) }
    }
}

@Composable
private fun CaseRow(e: Map<String, Any?>, live: Boolean) {
    val status = e["status"] as? String ?: "active"
    val color = when (status) { "dispatched" -> SentinelColors.Amber500; "resolved" -> SentinelColors.Emerald500; else -> SentinelColors.PrimaryRed }
    val ts = (e["timestamp"] as? Number)?.toLong()
    Card(shape = RoundedCornerShape(14.dp), colors = CardDefaults.cardColors(containerColor = SentinelColors.Slate800)) {
        Row(Modifier.fillMaxWidth().padding(14.dp), verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.size(10.dp).clip(CircleShape).background(color))
            Spacer(Modifier.width(10.dp))
            Column(Modifier.weight(1f)) {
                Text((e["userName"] as? String) ?: "Citizen", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 13.sp)
                Text((e["reason"] as? String) ?: "Emergency", color = SentinelColors.Slate400, fontSize = 11.sp)
                if (ts != null) Text(SimpleDateFormat("MMM d, h:mm a", Locale.getDefault()).format(Date(ts)), color = SentinelColors.Slate500, fontSize = 10.sp)
            }
            Surface(color = color.copy(alpha = 0.15f), shape = RoundedCornerShape(50)) {
                Text(status.uppercase(), modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp), fontSize = 9.sp, fontWeight = FontWeight.Black, color = color)
            }
        }
    }
}

@Composable
private fun ProfilesTab(
    repo: FirestoreRepository,
    viewModel: com.streetsentinel.app.viewmodel.SentinelViewModel,
    onNavigateToChat: () -> Unit
) {
    val citizens by repo.allCitizenProfilesFlow().collectAsState(initial = emptyList())
    var expandedUid by remember { mutableStateOf<String?>(null) }
 
    if (citizens.isEmpty()) {
        Column(Modifier.fillMaxSize(), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center) {
            Icon(Icons.Filled.Groups, contentDescription = null, tint = SentinelColors.Slate600, modifier = Modifier.size(48.dp))
            Spacer(Modifier.height(8.dp))
            Text("No citizen accounts found yet", color = SentinelColors.Slate500)
        }
        return
    }
 
    LazyColumn(Modifier.fillMaxSize().padding(horizontal = 20.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        item { SectionLabel("REGISTERED CITIZENS (${citizens.size})") }
        items(citizens, key = { it.uid }) { citizen ->
            ProfileCard(
                citizen, expanded = expandedUid == citizen.uid, repo = repo,
                onToggle = { expandedUid = if (expandedUid == citizen.uid) null else citizen.uid },
                onMessage = {
                    viewModel.openChatWith(citizen.uid, citizen.name)
                    onNavigateToChat()
                }
            )
        }
        item { Spacer(Modifier.height(20.dp)) }
    }
}

@Composable
private fun ProfileCard(citizen: SentinelUser, expanded: Boolean, repo: FirestoreRepository, onToggle: () -> Unit, onMessage: () -> Unit) {
    Card(shape = RoundedCornerShape(16.dp), colors = CardDefaults.cardColors(containerColor = SentinelColors.Slate800)) {
        Column(Modifier.padding(14.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.clickable { onToggle() }) {
                Box(Modifier.size(40.dp).clip(CircleShape).background(SentinelColors.Slate700), contentAlignment = Alignment.Center) {
                    Text(citizen.name.take(1).uppercase(), color = Color.White, fontWeight = FontWeight.Black)
                }
                Spacer(Modifier.width(12.dp))
                Column(Modifier.weight(1f)) {
                    Text(citizen.name, color = Color.White, fontWeight = FontWeight.Bold, fontSize = 14.sp)
                    Text(citizen.email, color = SentinelColors.Slate400, fontSize = 11.sp)
                }
                Icon(if (expanded) Icons.Filled.ExpandLess else Icons.Filled.ExpandMore, contentDescription = null, tint = SentinelColors.Slate500)
            }
            if (expanded) {
                Spacer(Modifier.height(12.dp))
                Text("📞 ${citizen.phone.ifBlank { "No phone on file" }}", color = SentinelColors.Slate300, fontSize = 12.sp)
                Spacer(Modifier.height(8.dp))
                val contacts by repo.contactsOnce(citizen.uid).collectAsState(initial = emptyList())
                val alerts by repo.alertsOnce(citizen.uid).collectAsState(initial = emptyList())
                Text("EMERGENCY CONTACTS (${contacts.size})", color = SentinelColors.Slate500, fontSize = 10.sp, fontWeight = FontWeight.Black)
                contacts.forEach { c -> Text("• ${c.name} (${c.relation}) — ${c.phone}", color = SentinelColors.Slate300, fontSize = 11.sp) }
                Spacer(Modifier.height(8.dp))
                Text("ALERT HISTORY (${alerts.size})", color = SentinelColors.Slate500, fontSize = 10.sp, fontWeight = FontWeight.Black)
                alerts.take(3).forEach { a -> Text("• ${a.type} — ${a.riskLevel}", color = SentinelColors.Slate300, fontSize = 11.sp) }
                Spacer(Modifier.height(10.dp))
                Button(
                    onClick = onMessage, colors = ButtonDefaults.buttonColors(containerColor = SentinelColors.Blue600),
                    shape = RoundedCornerShape(12.dp), modifier = Modifier.fillMaxWidth()
                ) {
                    Icon(Icons.Filled.Forum, contentDescription = null, modifier = Modifier.size(16.dp))
                    Spacer(Modifier.width(6.dp))
                    Text("Message ${citizen.name.split(" ").first()}", fontSize = 12.sp, fontWeight = FontWeight.Bold)
                }
            }
        }
    }
}

@Composable
private fun StationsTab(viewModel: com.streetsentinel.app.viewmodel.SentinelViewModel) {
    val lastLocation by viewModel.lastKnownLocation.collectAsState()
    val overpass = remember { OverpassService() }
    var stations by remember { mutableStateOf<List<NearbyZone>>(emptyList()) }
    var loading by remember { mutableStateOf(true) }

    LaunchedEffect(lastLocation) {
        val loc = lastLocation
        if (loc == null) {
            stations = emptyList()
            loading = false
            return@LaunchedEffect
        }
        stations = overpass.fetchNearbyAmenities(loc.lat, loc.lng, radius = 15000, types = listOf("police"))
        loading = false
    }

    if (loading) {
        Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { CircularProgressIndicator(color = SentinelColors.Blue500) }
        return
    }

    LazyColumn(Modifier.fillMaxSize().padding(horizontal = 20.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        item { SectionLabel("NEARBY POLICE STATIONS (${stations.size})") }
        items(stations) { s ->
            Card(shape = RoundedCornerShape(14.dp), colors = CardDefaults.cardColors(containerColor = SentinelColors.Slate800)) {
                Row(Modifier.padding(14.dp), verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Filled.LocalPolice, contentDescription = null, tint = SentinelColors.Blue500)
                    Spacer(Modifier.width(10.dp))
                    Column {
                        Text("Station", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 13.sp)
                        Text("${s.distanceMeters.toInt()} m away", color = SentinelColors.Slate400, fontSize = 11.sp)
                    }
                }
            }
        }
        item { Spacer(Modifier.height(20.dp)) }
    }
}

@Composable
private fun SectionLabel(text: String) {
    Text(text, color = SentinelColors.Slate500, fontSize = 11.sp, fontWeight = FontWeight.Black, letterSpacing = 1.sp)
}

@Composable
private fun EmptyRow(text: String) {
    Card(shape = RoundedCornerShape(14.dp), colors = CardDefaults.cardColors(containerColor = SentinelColors.Slate800)) {
        Text(text, modifier = Modifier.padding(16.dp), color = SentinelColors.Slate500, fontSize = 12.sp)
    }
}
