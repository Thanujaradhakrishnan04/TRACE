package com.streetsentinel.app.ui.citizen

import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
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
import com.streetsentinel.app.data.model.GeoPoint
import com.streetsentinel.app.data.model.ThreatLevel
import com.streetsentinel.app.navigation.Routes
import com.streetsentinel.app.services.OverpassService
import com.streetsentinel.app.services.SafetyScoreService
import com.streetsentinel.app.theme.SentinelColors
import com.streetsentinel.app.viewmodel.SentinelViewModel
import kotlin.math.max
import kotlin.math.min

/**
 * Direct rebuild of pages/citizen/CitizenHome.jsx. Key fixes from the previous pass:
 *  - The hero button is the real single-tap ARM/DISARM Shield toggle (not the 3-state
 *    Smart/Extreme ProtectionToggle component, which the web CitizenHome doesn't use at all).
 *  - Live dB meter with a threshold marker line + "Only saying 'help me' triggers SOS" copy.
 *  - Score cards (Safety Score / Police Nearby / Guardians), hospital/pharmacy stat row.
 *  - The exact 6-item quick-access grid from the web version.
 *  - Utility row: Fake Call + Voice SOS toggle (same ARM/DISARM state).
 */
@Composable
fun CitizenHomeScreen(viewModel: SentinelViewModel, onNavigate: (String) -> Unit) {
    val user by viewModel.currentUser.collectAsState()
    val threatLevel by viewModel.threatLevel.collectAsState()
    val aiMessage by viewModel.aiMessage.collectAsState()
    val isListening by viewModel.isListening.collectAsState()
    val audioLevel by viewModel.audioLevel.collectAsState()
    val currentThreshold by viewModel.currentThreshold.collectAsState()
    val contacts by viewModel.contacts.collectAsState()
    val alertHistory by viewModel.alertHistory.collectAsState()
    val lastLocation by viewModel.lastKnownLocation.collectAsState()
    val context = LocalContext.current

    val safetyScore by viewModel.safetyScore.collectAsState()
    val safetyLevel by viewModel.safetyLevel.collectAsState()
    val safetyReasons by viewModel.safetyReasons.collectAsState()
    val nearbyZones by viewModel.nearbyZones.collectAsState()
    val policeCount by viewModel.policeCount.collectAsState()
    val hospitalCount by viewModel.hospitalCount.collectAsState()
    val pharmacyCount by viewModel.pharmacyCount.collectAsState()

    var showFakeCall by remember { mutableStateOf(false) }
    var showSafeZonesModal by remember { mutableStateOf(false) }
    var safeZoneFilter by remember { mutableStateOf("police") }

    val threatGradient = when (threatLevel) {
        ThreatLevel.CRITICAL -> listOf(Color(0xFFDC2626), Color(0xFF881337))
        ThreatLevel.HIGH -> listOf(Color(0xFFF97316), Color(0xFFB91C1C))
        ThreatLevel.MEDIUM -> listOf(SentinelColors.Amber500, Color(0xFFEA580C))
        else -> listOf(SentinelColors.Slate800, SentinelColors.Slate900)
    }

    Column(Modifier.fillMaxSize().background(SentinelColors.BgLight).verticalScroll(rememberScrollState())) {

        // ─── HERO ───
        Column(
            Modifier.fillMaxWidth()
                .background(androidx.compose.ui.graphics.Brush.verticalGradient(threatGradient))
                .padding(horizontal = 20.dp, vertical = 20.dp)
        ) {
            Row(verticalAlignment = Alignment.Top) {
                Column(Modifier.weight(1f)) {
                    Text("WELCOME BACK", color = SentinelColors.Slate400, fontSize = 11.sp, fontWeight = FontWeight.Bold, letterSpacing = 1.sp)
                    Text(user?.name?.split(" ")?.firstOrNull() ?: "Citizen", color = Color.White, fontSize = 30.sp, fontWeight = FontWeight.Black)
                    Spacer(Modifier.height(6.dp))
                    val (pillBg, dotColor) = when (threatLevel) {
                        ThreatLevel.LOW -> SentinelColors.Emerald500.copy(alpha = 0.2f) to SentinelColors.Emerald500
                        ThreatLevel.MEDIUM -> SentinelColors.Amber500.copy(alpha = 0.2f) to SentinelColors.Amber500
                        else -> SentinelColors.Red500.copy(alpha = 0.3f) to SentinelColors.Red300
                    }
                    Surface(color = pillBg, shape = RoundedCornerShape(50)) {
                        Row(Modifier.padding(horizontal = 10.dp, vertical = 5.dp), verticalAlignment = Alignment.CenterVertically) {
                            Box(Modifier.size(6.dp).clip(CircleShape).background(dotColor))
                            Spacer(Modifier.width(6.dp))
                            Text("${threatLevel.name} RISK", color = dotColor, fontSize = 11.sp, fontWeight = FontWeight.Black)
                        }
                    }
                }

                // ARM/DISARM button — the real hero control (single Shield toggle, not a 3-state dial)
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    val pulse = rememberInfiniteTransition(label = "arm")
                    val ringAlpha by pulse.animateFloat(0.15f, 0.5f, infiniteRepeatable(tween(1200), RepeatMode.Reverse), label = "r")
                    Box(
                        Modifier.size(80.dp).clip(CircleShape)
                            .background(if (isListening) SentinelColors.Red500 else Color.White.copy(alpha = 0.1f))
                            .border(2.dp, if (isListening) Color.Transparent else Color.White.copy(alpha = 0.3f), CircleShape)
                            .clickable { viewModel.setIsListening(!isListening) },
                        contentAlignment = Alignment.Center
                    ) {
                        if (isListening) {
                            Box(Modifier.fillMaxSize().clip(CircleShape).border(4.dp, Color.White.copy(alpha = ringAlpha), CircleShape))
                        }
                        Icon(Icons.Filled.Shield, contentDescription = "Arm/disarm", tint = Color.White, modifier = Modifier.size(38.dp))
                    }
                    Spacer(Modifier.height(4.dp))
                    Text(if (isListening) "DISARM" else "ARM", color = Color.White, fontSize = 10.sp, fontWeight = FontWeight.Black, letterSpacing = 1.sp)
                }
            }

            // AI status message
            Surface(color = Color.White.copy(alpha = 0.1f), shape = RoundedCornerShape(16.dp), modifier = Modifier.fillMaxWidth().padding(top = 16.dp)) {
                Row(Modifier.padding(14.dp), verticalAlignment = Alignment.CenterVertically) {
                    Box(Modifier.size(32.dp).clip(RoundedCornerShape(10.dp)).background(if (isListening) SentinelColors.Red500.copy(alpha = 0.4f) else SentinelColors.Blue500.copy(alpha = 0.3f)), contentAlignment = Alignment.Center) {
                        Icon(Icons.Filled.Bolt, contentDescription = null, tint = Color.White, modifier = Modifier.size(16.dp))
                    }
                    Spacer(Modifier.width(10.dp))
                    Text(aiMessage, color = Color.White, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
                }
            }

            // Live dB meter — shown when armed, direct port of the web meter incl. threshold marker
            if (isListening) {
                Surface(color = Color.Black.copy(alpha = 0.3f), shape = RoundedCornerShape(16.dp), modifier = Modifier.fillMaxWidth().padding(top = 10.dp)) {
                    Column(Modifier.padding(12.dp)) {
                        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                            Text("LIVE dB LEVEL", color = Color.White.copy(alpha = 0.7f), fontSize = 10.sp, fontWeight = FontWeight.Black, letterSpacing = 1.sp)
                            Text(
                                "${audioLevel.toInt()} dB", fontSize = 12.sp, fontWeight = FontWeight.Black,
                                color = if (audioLevel > currentThreshold) SentinelColors.Red400 else SentinelColors.Emerald500
                            )
                        }
                        Spacer(Modifier.height(6.dp))
                        Box(Modifier.fillMaxWidth().height(12.dp).clip(RoundedCornerShape(50)).background(Color.White.copy(alpha = 0.1f))) {
                            val fillFrac = max(0f, min(100f, (audioLevel + 100).toFloat())) / 100f
                            Box(
                                Modifier.fillMaxWidth(fillFrac).fillMaxHeight().clip(RoundedCornerShape(50))
                                    .background(if (audioLevel > currentThreshold) SentinelColors.Red500 else SentinelColors.Emerald500)
                            )
                            val threshFrac = max(0f, min(100f, (currentThreshold + 100).toFloat())) / 100f
                            Box(
                                Modifier.fillMaxHeight().width(2.dp)
                                    .align(Alignment.CenterStart)
                                    .padding(start = (threshFrac * 300).dp) // approximate marker position on a ~300dp-wide bar
                                    .background(SentinelColors.Amber500)
                            )
                        }
                        Spacer(Modifier.height(4.dp))
                        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                            Text("-100 dB (silence)", color = Color.White.copy(alpha = 0.4f), fontSize = 9.sp)
                            Text("⚡ Alert at ${currentThreshold.toInt()} dB", color = SentinelColors.Amber500, fontSize = 9.sp, fontWeight = FontWeight.Bold)
                            Text("0 dB (max)", color = Color.White.copy(alpha = 0.4f), fontSize = 9.sp)
                        }
                        Spacer(Modifier.height(4.dp))
                        Text(
                            "Only saying \"help me\" / \"save me\" or a sudden loud sound triggers SOS",
                            color = Color.White.copy(alpha = 0.4f), fontSize = 9.sp, textAlign = androidx.compose.ui.text.style.TextAlign.Center,
                            modifier = Modifier.fillMaxWidth()
                        )
                    }
                }
            }

            // Status pills
            Row(Modifier.padding(top = 10.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                StatusPill(if (isListening) Icons.Filled.Mic else Icons.Filled.MicOff, if (isListening) "${audioLevel.toInt()} dB" else "MIC OFF", isListening)
                StatusPill(Icons.Filled.LocationOn, if (lastLocation != null) "GPS Active" else "GPS Off", lastLocation != null)
            }
        }

        Column(Modifier.padding(horizontal = 16.dp).offset(y = (-16).dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {

            // Score cards
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                ScoreCard(safetyScore?.toString() ?: "0", safetyLevel?.replace("_", " ") ?: "WAITING FOR GPS", scoreColor(safetyScore ?: 0), Modifier.weight(1f)) { onNavigate(Routes.CITIZEN_HEALTH) }
                ScoreCard(policeCount?.toString() ?: "-", "Police Nearby", SentinelColors.Blue500, Modifier.weight(1f)) { safeZoneFilter = "police"; showSafeZonesModal = true }
                ScoreCard(contacts.size.toString(), "Guardians", Color(0xFFA855F7), Modifier.weight(1f)) { onNavigate(Routes.CITIZEN_GUARDIANS) }
            }

            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                StatChip("🏥", hospitalCount?.toString() ?: "-", "Hospitals", Modifier.weight(1f)) { safeZoneFilter = "hospital"; showSafeZonesModal = true }
                StatChip("💊", pharmacyCount?.toString() ?: "-", "Pharmacies", Modifier.weight(1f)) { safeZoneFilter = "pharmacy"; showSafeZonesModal = true }
            }

            if (safetyReasons.isNotEmpty()) {
                Card(shape = RoundedCornerShape(18.dp), colors = CardDefaults.cardColors(containerColor = Color.White)) {
                    Column(Modifier.padding(14.dp)) {
                        Text("SAFETY ANALYSIS", color = SentinelColors.Slate400, fontSize = 10.sp, fontWeight = FontWeight.Black, letterSpacing = 1.sp)
                        Spacer(Modifier.height(6.dp))
                        safetyReasons.take(4).forEach { r ->
                            Text(r, fontSize = 12.sp, fontWeight = FontWeight.Bold, color = if (r.startsWith("✓")) SentinelColors.Emerald500 else SentinelColors.Amber500)
                        }
                    }
                }
            }

            // Big SOS button
            Card(
                modifier = Modifier.fillMaxWidth().clickable { viewModel.triggerEmergency("Manual SOS Override") },
                shape = RoundedCornerShape(24.dp),
                colors = CardDefaults.cardColors(containerColor = SentinelColors.PrimaryRed)
            ) {
                Row(Modifier.padding(20.dp), verticalAlignment = Alignment.CenterVertically) {
                    Box(Modifier.size(52.dp).clip(CircleShape).background(Color.White.copy(alpha = 0.2f)), contentAlignment = Alignment.Center) {
                        Icon(Icons.Filled.NotificationImportant, contentDescription = null, tint = Color.White, modifier = Modifier.size(28.dp))
                    }
                    Spacer(Modifier.width(14.dp))
                    Column {
                        Text("SOS EMERGENCY", color = Color.White, fontWeight = FontWeight.Black, fontSize = 18.sp, letterSpacing = 1.sp)
                        Text("Tap to send immediate alert to all contacts", color = SentinelColors.Red100, fontSize = 11.sp)
                    }
                }
            }

            // Quick access grid — exact 6 items from CitizenHome.jsx
            Text("QUICK ACCESS", color = SentinelColors.Slate400, fontSize = 11.sp, fontWeight = FontWeight.Black, letterSpacing = 1.sp)
            val quickActions = listOf(
                QuickLink(Icons.Filled.Navigation, "SafeWalk", "Live Route", SentinelColors.Blue500) { onNavigate(Routes.CITIZEN_TRACKING) },
                QuickLink(Icons.Filled.Call, "Contacts", "${contacts.size} saved", SentinelColors.Emerald500) { onNavigate(Routes.CITIZEN_CONTACTS) },
                QuickLink(Icons.Filled.Notifications, "Alerts", "${alertHistory.size} total", SentinelColors.Amber500) { onNavigate(Routes.CITIZEN_ALERTS) },
                QuickLink(Icons.Filled.Groups, "Guardians", "Tracking", Color(0xFFA855F7)) { onNavigate(Routes.CITIZEN_GUARDIANS) },
                QuickLink(Icons.Filled.RemoveRedEye, "Vault", "Evidence", Color(0xFF6366F1)) { onNavigate(Routes.CITIZEN_VAULT) },
                QuickLink(Icons.Filled.Chat, "Police Chat", "Direct line", SentinelColors.PrimaryRed) { onNavigate(Routes.CITIZEN_CHAT) },
            )
            LazyVerticalGrid(columns = GridCells.Fixed(3), modifier = Modifier.heightIn(max = 220.dp), horizontalArrangement = Arrangement.spacedBy(10.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                items(quickActions) { a ->
                    Card(modifier = Modifier.clickable { a.onClick() }, shape = RoundedCornerShape(16.dp), colors = CardDefaults.cardColors(containerColor = Color.White)) {
                        Column(Modifier.padding(12.dp).fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally) {
                            Box(Modifier.size(40.dp).clip(RoundedCornerShape(12.dp)).background(a.color), contentAlignment = Alignment.Center) {
                                Icon(a.icon, contentDescription = a.label, tint = Color.White, modifier = Modifier.size(18.dp))
                            }
                            Spacer(Modifier.height(6.dp))
                            Text(a.label, fontSize = 11.sp, fontWeight = FontWeight.Bold, color = SentinelColors.Slate800)
                            Text(a.sub, fontSize = 9.sp, color = SentinelColors.Slate400)
                        }
                    }
                }
            }

            // Utility row: Fake Call + Voice SOS toggle
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                Card(modifier = Modifier.weight(1f).clickable { showFakeCall = true }, shape = RoundedCornerShape(16.dp), colors = CardDefaults.cardColors(containerColor = Color.White)) {
                    Row(Modifier.padding(14.dp), verticalAlignment = Alignment.CenterVertically) {
                        Box(Modifier.size(36.dp).clip(RoundedCornerShape(10.dp)).background(Color(0xFFF3E8FF)), contentAlignment = Alignment.Center) {
                            Icon(Icons.Filled.Call, contentDescription = null, tint = Color(0xFF9333EA))
                        }
                        Spacer(Modifier.width(10.dp))
                        Column { Text("Fake Call", fontWeight = FontWeight.Bold, fontSize = 13.sp, color = SentinelColors.Slate800); Text("Escape system", fontSize = 9.sp, color = SentinelColors.Slate400) }
                    }
                }
                Card(
                    modifier = Modifier.weight(1f).clickable { viewModel.setIsListening(!isListening) }, shape = RoundedCornerShape(16.dp),
                    colors = CardDefaults.cardColors(containerColor = if (isListening) SentinelColors.Red50 else Color.White)
                ) {
                    Row(Modifier.padding(14.dp), verticalAlignment = Alignment.CenterVertically) {
                        Box(Modifier.size(36.dp).clip(RoundedCornerShape(10.dp)).background(if (isListening) SentinelColors.PrimaryRed else SentinelColors.Slate100), contentAlignment = Alignment.Center) {
                            Icon(if (isListening) Icons.Filled.Mic else Icons.Filled.MicOff, contentDescription = null, tint = if (isListening) Color.White else SentinelColors.Slate500)
                        }
                        Spacer(Modifier.width(10.dp))
                        Column { Text("Voice SOS", fontWeight = FontWeight.Bold, fontSize = 13.sp, color = SentinelColors.Slate800); Text(if (isListening) "Listening..." else "Tap to arm", fontSize = 9.sp, fontWeight = FontWeight.Bold, color = if (isListening) SentinelColors.PrimaryRed else SentinelColors.Slate400) }
                    }
                }
            }

            // Live map preview
            Text("LIVE SAFETY MAP", color = SentinelColors.Slate400, fontSize = 11.sp, fontWeight = FontWeight.Black, letterSpacing = 1.sp)
            Card(
                modifier = Modifier.fillMaxWidth().height(140.dp).clickable { onNavigate(Routes.CITIZEN_TRACKING) },
                shape = RoundedCornerShape(20.dp), colors = CardDefaults.cardColors(containerColor = SentinelColors.Slate800)
            ) {
                Box(Modifier.fillMaxSize().padding(16.dp)) {
                    Column(Modifier.align(Alignment.BottomStart)) {
                        Text("Live Map", color = Color.White, fontWeight = FontWeight.Black, fontSize = 15.sp)
                        Text("${policeCount ?: 0} safe zones • Tap to navigate", color = SentinelColors.Emerald500, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                    }
                    Surface(color = Color.White.copy(alpha = 0.15f), shape = RoundedCornerShape(50), modifier = Modifier.align(Alignment.BottomEnd)) {
                        Text("OPEN →", modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp), color = Color.White, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                    }
                }
            }
            Spacer(Modifier.height(24.dp))
        }
    }

    if (showFakeCall) {
        FakeCallOverlay(onClose = { showFakeCall = false })
    }

    if (showSafeZonesModal) {
        @OptIn(ExperimentalMaterial3Api::class)
        ModalBottomSheet(
            onDismissRequest = { showSafeZonesModal = false },
            containerColor = SentinelColors.BgLight
        ) {
            val title = when (safeZoneFilter) {
                "police" -> "Nearby Police Stations"
                "hospital" -> "Nearby Hospitals"
                else -> "Nearby Pharmacies"
            }
            val displayed = nearbyZones.filter {
                when (safeZoneFilter) {
                    "police" -> it.type == "police"
                    "hospital" -> it.type == "hospital" || it.type == "clinic"
                    else -> it.type == "pharmacy" || it.type == "chemist"
                }
            }.sortedBy { it.distanceMeters }
            
            Column(Modifier.fillMaxWidth().padding(horizontal = 20.dp, vertical = 10.dp)) {
                Text(title, fontSize = 20.sp, fontWeight = FontWeight.Black, color = SentinelColors.Slate800)
                Spacer(Modifier.height(16.dp))
                if (displayed.isEmpty()) {
                    Text("No places found within 15km yet. Make sure GPS is connected.", fontSize = 14.sp, color = SentinelColors.Slate500, modifier = Modifier.padding(bottom = 30.dp))
                } else {
                    androidx.compose.foundation.lazy.LazyColumn(modifier = Modifier.fillMaxWidth().padding(bottom = 20.dp)) {
                        items(displayed.size) { i ->
                            val z = displayed[i]
                            Card(
                                modifier = Modifier.fillMaxWidth().padding(bottom = 8.dp),
                                shape = RoundedCornerShape(16.dp),
                                colors = CardDefaults.cardColors(containerColor = Color.White)
                            ) {
                                Row(Modifier.padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
                                    Box(Modifier.size(40.dp).clip(RoundedCornerShape(12.dp)).background(SentinelColors.Slate100), contentAlignment = Alignment.Center) {
                                        Icon(if (safeZoneFilter == "police") Icons.Filled.Shield else Icons.Filled.LocalHospital, contentDescription = null, tint = if (safeZoneFilter == "police") SentinelColors.Blue500 else if (safeZoneFilter == "hospital") SentinelColors.Emerald500 else SentinelColors.Amber500)
                                    }
                                    Spacer(Modifier.width(12.dp))
                                    Column(Modifier.weight(1f)) {
                                        Text(z.name, fontWeight = FontWeight.Bold, fontSize = 14.sp, color = SentinelColors.Slate800, maxLines = 1)
                                        Text("${z.distanceMeters.toInt()}m away", fontSize = 11.sp, color = SentinelColors.Slate500)
                                    }
                                    Spacer(Modifier.width(12.dp))
                                    Box(Modifier.size(36.dp).clip(RoundedCornerShape(10.dp)).background(SentinelColors.Blue500).clickable { showSafeZonesModal = false; onNavigate(Routes.CITIZEN_TRACKING) }, contentAlignment = Alignment.Center) {
                                        Icon(Icons.Filled.Navigation, contentDescription = "Navigate", tint = Color.White, modifier = Modifier.size(16.dp))
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

private data class QuickLink(val icon: androidx.compose.ui.graphics.vector.ImageVector, val label: String, val sub: String, val color: Color, val onClick: () -> Unit)

private fun scoreColor(score: Int) = when {
    score >= 90 -> SentinelColors.Emerald500
    score >= 70 -> SentinelColors.Blue500
    score >= 50 -> SentinelColors.Amber500
    else -> SentinelColors.PrimaryRed
}

@Composable
private fun StatusPill(icon: androidx.compose.ui.graphics.vector.ImageVector, label: String, active: Boolean) {
    Surface(color = if (active) Color.White.copy(alpha = 0.15f) else Color.White.copy(alpha = 0.08f), shape = RoundedCornerShape(50)) {
        Row(Modifier.padding(horizontal = 10.dp, vertical = 6.dp), verticalAlignment = Alignment.CenterVertically) {
            Icon(icon, contentDescription = null, tint = if (active) Color.White else SentinelColors.Slate400, modifier = Modifier.size(12.dp))
            Spacer(Modifier.width(5.dp))
            Text(label, color = if (active) Color.White else SentinelColors.Slate400, fontSize = 11.sp, fontWeight = FontWeight.Bold)
        }
    }
}

@Composable
private fun ScoreCard(value: String, label: String, color: Color, modifier: Modifier = Modifier, onClick: () -> Unit) {
    Card(modifier = modifier.clickable { onClick() }, shape = RoundedCornerShape(16.dp), colors = CardDefaults.cardColors(containerColor = Color.White)) {
        Column(Modifier.padding(vertical = 12.dp).fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally) {
            Text(value, color = color, fontWeight = FontWeight.Black, fontSize = 24.sp)
            Text(label.uppercase(), color = SentinelColors.Slate400, fontSize = 9.sp, fontWeight = FontWeight.Bold)
        }
    }
}

@Composable
private fun StatChip(emoji: String, value: String, label: String, modifier: Modifier = Modifier, onClick: () -> Unit = {}) {
    Card(modifier = modifier.clickable { onClick() }, shape = RoundedCornerShape(16.dp), colors = CardDefaults.cardColors(containerColor = Color.White)) {
        Row(Modifier.padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.size(36.dp).clip(RoundedCornerShape(10.dp)).background(SentinelColors.Slate100), contentAlignment = Alignment.Center) {
                Text(emoji, fontSize = 16.sp)
            }
            Spacer(Modifier.width(8.dp))
            Column { Text(value, fontWeight = FontWeight.Bold, fontSize = 14.sp, color = SentinelColors.Slate800); Text(label.uppercase(), fontSize = 9.sp, color = SentinelColors.Slate400, fontWeight = FontWeight.Bold) }
        }
    }
}

@Composable
private fun FakeCallOverlay(onClose: () -> Unit) {
    Box(Modifier.fillMaxSize().background(SentinelColors.Slate900)) {
        Column(Modifier.fillMaxSize().padding(32.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center) {
            Box(Modifier.size(96.dp).clip(CircleShape).background(SentinelColors.Slate700), contentAlignment = Alignment.Center) {
                Icon(Icons.Filled.Call, contentDescription = null, tint = Color.White, modifier = Modifier.size(40.dp))
            }
            Spacer(Modifier.height(20.dp))
            Text("Incoming Call", color = SentinelColors.Slate400, fontSize = 16.sp)
            Text("Dad (Home)", color = Color.White, fontSize = 34.sp, fontWeight = FontWeight.Light)
            Text("Ringing...", color = SentinelColors.Slate500, fontSize = 13.sp)
        }
        Row(Modifier.align(Alignment.BottomCenter).padding(bottom = 64.dp, start = 48.dp, end = 48.dp).fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Box(Modifier.size(72.dp).clip(CircleShape).background(SentinelColors.PrimaryRed).clickable { onClose() }, contentAlignment = Alignment.Center) {
                    Icon(Icons.Filled.CallEnd, contentDescription = "Decline", tint = Color.White)
                }
                Spacer(Modifier.height(6.dp)); Text("Decline", color = SentinelColors.Slate500, fontSize = 11.sp)
            }
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Box(Modifier.size(72.dp).clip(CircleShape).background(SentinelColors.Emerald500).clickable { onClose() }, contentAlignment = Alignment.Center) {
                    Icon(Icons.Filled.Call, contentDescription = "Accept", tint = Color.White)
                }
                Spacer(Modifier.height(6.dp)); Text("Accept", color = SentinelColors.Slate500, fontSize = 11.sp)
            }
        }
    }
}
