package com.streetsentinel.app.ui.citizen

import androidx.compose.foundation.background
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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.streetsentinel.app.data.model.ChatMessage
import com.streetsentinel.app.theme.SentinelColors
import com.streetsentinel.app.viewmodel.SentinelViewModel

/** Port of pages/citizen/Guardians.jsx — trusted contacts who receive passive check-ins. */
@Composable
fun GuardiansScreen(viewModel: SentinelViewModel) {
    val contacts by viewModel.contacts.collectAsState()
    ScreenScaffold("Guardians", "Trusted people notified during SafeWalk sessions") {
        if (contacts.isEmpty()) {
            EmptyState(Icons.Filled.Groups, "No guardians assigned yet")
        } else {
            contacts.forEach { c ->
                SimpleRow(title = c.name, subtitle = "Guardian · ${c.relation}", icon = Icons.Filled.Shield)
            }
        }
    }
}

/** Port of pages/citizen/EvidenceVault.jsx — AI snapshot / audio evidence log during incidents. */
@Composable
fun EvidenceVaultScreen(viewModel: SentinelViewModel) {
    val alerts by viewModel.alertHistory.collectAsState()
    ScreenScaffold("Evidence Vault", "Snapshots & audio captured during incidents") {
        if (alerts.isEmpty()) {
            EmptyState(Icons.Filled.RemoveRedEye, "No evidence recorded yet")
        } else {
            alerts.forEach { a -> SimpleRow(title = a.type, subtitle = "Risk: ${a.riskLevel}", icon = Icons.Filled.PhotoCamera) }
        }
    }
}

/** Port of pages/citizen/SystemHealth.jsx — GPS/mic/network/battery diagnostics summary. */
@Composable
fun SystemHealthScreen(viewModel: SentinelViewModel) {
    val isOffline by viewModel.isOffline.collectAsState()
    val location by viewModel.lastKnownLocation.collectAsState()
    ScreenScaffold("System Health", "Live diagnostics for protection subsystems") {
        HealthRow("GPS Signal", if (location != null) "ACTIVE" else "SEARCHING", location != null)
        HealthRow("Network", if (!isOffline) "ONLINE" else "OFFLINE — MESH MODE", !isOffline)
        HealthRow("Microphone Monitoring", "ENABLED", true)
        HealthRow("Cloud Sync (Firestore)", "CONNECTED", true)
    }
}

/** Port of pages/citizen/Diagnostics.jsx — live sensor readouts (full tuning UI is phase-3 work). */
@Composable
fun DiagnosticsScreen(viewModel: SentinelViewModel) {
    val threatLevel by viewModel.threatLevel.collectAsState()
    val isListening by viewModel.isListening.collectAsState()
    val audioLevel by viewModel.audioLevel.collectAsState()
    val currentThreshold by viewModel.currentThreshold.collectAsState()
    val riskScore by viewModel.riskScore.collectAsState()
    ScreenScaffold("Diagnostics", "Sentinel AI internal state — live sensor feed") {
        HealthRow("Threat Level", threatLevel.name, threatLevel.name == "LOW")
        HealthRow("Microphone Monitoring", if (isListening) "ACTIVE" else "DISARMED", isListening)
        HealthRow("Live Audio Level", "${audioLevel.toInt()} dB", audioLevel < currentThreshold)
        HealthRow("Alert Threshold", "${currentThreshold.toInt()} dB", true)
        HealthRow("Risk Score", "${(riskScore * 100).toInt()}%", riskScore < 0.5)
        HealthRow("Emergency Cooldown", "Ready", true)
    }
}

/**
 * Port of pages/citizen/CitizenChat.jsx — real Firestore-backed chat with police dispatch
 * (conversationId == this citizen's own uid, the same thread officers see in their inbox).
 * Bug fix: this used to be a purely local, in-memory message list — nothing was ever actually
 * sent anywhere, so police could never see it. Now it writes to/reads from Firestore.
 */
@Composable
fun CitizenChatScreen(viewModel: SentinelViewModel) {
    val activeId by viewModel.activeEmergencyId.collectAsState()
    val user by viewModel.currentUser.collectAsState()
    val uid = user?.uid

    if (uid.isNullOrBlank()) {
        // Show loading state while user data loads (was: early return = blank screen)
        Column(
            Modifier.fillMaxSize().background(SentinelColors.BgLight),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center
        ) {
            androidx.compose.material3.CircularProgressIndicator(color = SentinelColors.PrimaryRed)
            Spacer(Modifier.height(12.dp))
            Text("Connecting to secure chat...", color = SentinelColors.Slate500, fontSize = 13.sp)
        }
        return
    }

    com.streetsentinel.app.ui.components.ChatThread(
        conversationId = uid,
        citizenName = user?.name ?: "Citizen",
        messagesFlow = viewModel.chatMessages(uid),
        myRole = "citizen",
        onSend = { text -> viewModel.sendChatMessage(uid, user?.name ?: "Citizen", text, "citizen") },
        headerContent = {
            Column(Modifier.padding(20.dp, 20.dp, 20.dp, 8.dp)) {
                Text("Police Chat", fontSize = 22.sp, fontWeight = FontWeight.Bold, color = SentinelColors.Slate800)
                Text(if (activeId != null) "🟢 Secure uplink active" else "Direct line to police dispatch", color = SentinelColors.Slate500, fontSize = 12.sp)
            }
        }
    )
}

// ---- shared small helpers for the screens above ----

@Composable
private fun ScreenScaffold(title: String, subtitle: String, content: @Composable ColumnScope.() -> Unit) {
    Column(Modifier.fillMaxSize().background(SentinelColors.BgLight).padding(20.dp)) {
        Text(title, fontSize = 24.sp, fontWeight = FontWeight.Bold, color = SentinelColors.Slate800)
        Text(subtitle, color = SentinelColors.Slate500, fontSize = 13.sp)
        Spacer(Modifier.height(16.dp))
        content()
    }
}

@Composable
private fun EmptyState(icon: androidx.compose.ui.graphics.vector.ImageVector, text: String) {
    Column(Modifier.fillMaxWidth().padding(top = 48.dp), horizontalAlignment = Alignment.CenterHorizontally) {
        Icon(icon, contentDescription = null, tint = SentinelColors.Slate300, modifier = Modifier.size(48.dp))
        Spacer(Modifier.height(8.dp))
        Text(text, color = SentinelColors.Slate400)
    }
}

@Composable
private fun SimpleRow(title: String, subtitle: String, icon: androidx.compose.ui.graphics.vector.ImageVector) {
    Card(shape = RoundedCornerShape(14.dp), colors = CardDefaults.cardColors(containerColor = Color.White), modifier = Modifier.fillMaxWidth().padding(bottom = 8.dp)) {
        Row(Modifier.padding(14.dp), verticalAlignment = Alignment.CenterVertically) {
            Icon(icon, contentDescription = null, tint = SentinelColors.PrimaryRed)
            Spacer(Modifier.width(12.dp))
            Column { Text(title, fontWeight = FontWeight.Bold, color = SentinelColors.Slate800, fontSize = 14.sp); Text(subtitle, fontSize = 11.sp, color = SentinelColors.Slate500) }
        }
    }
}

@Composable
private fun HealthRow(label: String, value: String, healthy: Boolean) {
    Card(shape = RoundedCornerShape(14.dp), colors = CardDefaults.cardColors(containerColor = Color.White), modifier = Modifier.fillMaxWidth().padding(bottom = 8.dp)) {
        Row(Modifier.fillMaxWidth().padding(14.dp), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
            Text(label, fontWeight = FontWeight.Medium, color = SentinelColors.Slate700, fontSize = 13.sp)
            Text(value, fontWeight = FontWeight.Bold, fontSize = 12.sp, color = if (healthy) SentinelColors.Emerald500 else SentinelColors.PrimaryRed)
        }
    }
}
