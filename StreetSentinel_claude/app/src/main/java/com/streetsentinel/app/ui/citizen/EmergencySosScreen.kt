package com.streetsentinel.app.ui.citizen

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.background
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
import com.streetsentinel.app.data.model.EmergencyContact
import com.streetsentinel.app.theme.SentinelColors
import com.streetsentinel.app.viewmodel.SentinelViewModel

/** Port of pages/citizen/EmergencySOS.jsx */
@Composable
fun EmergencySosScreen(viewModel: SentinelViewModel, onOpenChat: () -> Unit, onOpenContacts: () -> Unit) {
    val context = LocalContext.current
    val isEmergencyMode by viewModel.isEmergencyMode.collectAsState()
    val contacts by viewModel.contacts.collectAsState()
    val lastLocation by viewModel.lastKnownLocation.collectAsState()
    var pressed by remember { mutableStateOf(false) }

    Column(
        Modifier.fillMaxSize().background(SentinelColors.Slate900).verticalScroll(rememberScrollState())
    ) {
        // Header
        Column(
            Modifier.fillMaxWidth().background(SentinelColors.Red700).padding(horizontal = 24.dp, vertical = 32.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Text("EMERGENCY PROTOCOL", color = SentinelColors.Red100, fontSize = 11.sp, fontWeight = FontWeight.Black, letterSpacing = 1.5.sp)
            Spacer(Modifier.height(4.dp))
            Text("SOS CENTER", color = Color.White, fontSize = 32.sp, fontWeight = FontWeight.Black)
            Text("Immediate help at your fingertips", color = SentinelColors.Red100, fontSize = 13.sp)
        }

        Column(Modifier.padding(horizontal = 20.dp).offset(y = (-24).dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
            // Big SOS button card
            Card(shape = RoundedCornerShape(28.dp), colors = CardDefaults.cardColors(containerColor = Color.White)) {
                Column(Modifier.fillMaxWidth().padding(28.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                    Text("HOLD TO ACTIVATE EMERGENCY", color = SentinelColors.Slate500, fontSize = 12.sp, fontWeight = FontWeight.Bold, letterSpacing = 1.sp)
                    Spacer(Modifier.height(20.dp))
                    Box(
                        Modifier.size(160.dp).clip(CircleShape)
                            .background(if (pressed || isEmergencyMode) SentinelColors.Red500 else SentinelColors.PrimaryRed)
                            .clickable {
                                pressed = true
                                viewModel.triggerEmergency("Manual SOS — Emergency Button")
                            },
                        contentAlignment = Alignment.Center
                    ) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Icon(Icons.Filled.NotificationImportant, contentDescription = "SOS", tint = Color.White, modifier = Modifier.size(52.dp))
                            Text("SOS", color = Color.White, fontWeight = FontWeight.Black, fontSize = 18.sp, letterSpacing = 2.sp)
                        }
                    }
                    Spacer(Modifier.height(20.dp))
                    Text(
                        if (isEmergencyMode) "🔴 Emergency mode active — contacts alerted" else "This will alert all your emergency contacts immediately",
                        color = SentinelColors.Slate400, fontSize = 12.sp
                    )
                    if (isEmergencyMode) {
                        Spacer(Modifier.height(16.dp))
                        Button(onClick = onOpenChat, colors = ButtonDefaults.buttonColors(containerColor = SentinelColors.Blue600), shape = RoundedCornerShape(14.dp), modifier = Modifier.fillMaxWidth()) {
                            Text("💬 OPEN POLICE CHAT", fontWeight = FontWeight.Black, fontSize = 13.sp)
                        }
                        Spacer(Modifier.height(8.dp))
                        Button(onClick = { viewModel.cancelEmergency() }, colors = ButtonDefaults.buttonColors(containerColor = SentinelColors.Emerald500), shape = RoundedCornerShape(14.dp)) {
                            Text("Cancel Emergency", fontWeight = FontWeight.Bold)
                        }
                    }
                }
            }

            // Quick actions grid
            LazyVerticalGrid(columns = GridCells.Fixed(2), modifier = Modifier.heightIn(max = 240.dp), horizontalArrangement = Arrangement.spacedBy(12.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                item {
                    QuickAction(Icons.Filled.Call, "Call Police", "Dial 100", SentinelColors.Blue500) {
                        context.startActivity(Intent(Intent.ACTION_DIAL, Uri.parse("tel:100")))
                    }
                }
                item {
                    QuickAction(Icons.Filled.LocationOn, "Share Location", "Send live GPS", SentinelColors.Emerald500) {
                        lastLocation?.let {
                            val url = "https://maps.google.com/?q=${it.lat},${it.lng}"
                            context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
                            viewModel.sendEmergencyAlert("Manual SOS — Shared Location")
                        }
                    }
                }
                item {
                    QuickAction(Icons.Filled.ContactPhone, "Call Contact", "${contacts.size} contacts saved", Color(0xFFA855F7), onOpenContacts)
                }
                item {
                    QuickAction(Icons.Filled.Share, "WhatsApp SOS", "Send location", Color(0xFF22C55E)) {
                        lastLocation?.let {
                            val msg = "🚨 EMERGENCY — I need help! My location: https://maps.google.com/?q=${it.lat},${it.lng}"
                            val intent = Intent(Intent.ACTION_VIEW, Uri.parse("https://wa.me/?text=${Uri.encode(msg)}"))
                            context.startActivity(intent)
                        }
                    }
                }
            }

            if (contacts.isNotEmpty()) {
                Card(shape = RoundedCornerShape(24.dp), colors = CardDefaults.cardColors(containerColor = SentinelColors.Slate800)) {
                    Column(Modifier.padding(20.dp)) {
                        Text("EMERGENCY CONTACTS", color = Color.White, fontWeight = FontWeight.Black, fontSize = 13.sp, letterSpacing = 1.sp)
                        Spacer(Modifier.height(12.dp))
                        contacts.forEach { c -> ContactRow(c, context) }
                    }
                }
            } else {
                Card(shape = RoundedCornerShape(18.dp), colors = CardDefaults.cardColors(containerColor = Color(0x1AF59E0B))) {
                    Row(Modifier.padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Filled.Warning, contentDescription = null, tint = SentinelColors.Amber500)
                        Spacer(Modifier.width(12.dp))
                        Text("No emergency contacts saved. Add contacts to enable alerts.", color = SentinelColors.Amber500, fontSize = 13.sp, fontWeight = FontWeight.SemiBold,
                            modifier = Modifier.clickable { onOpenContacts() })
                    }
                }
            }
            Spacer(Modifier.height(24.dp))
        }
    }
}

@Composable
private fun QuickAction(icon: androidx.compose.ui.graphics.vector.ImageVector, title: String, subtitle: String, tint: Color, onClick: () -> Unit) {
    Card(
        modifier = Modifier.fillMaxWidth().clickable { onClick() },
        shape = RoundedCornerShape(18.dp),
        colors = CardDefaults.cardColors(containerColor = SentinelColors.Slate800)
    ) {
        Column(Modifier.padding(18.dp), horizontalAlignment = Alignment.CenterHorizontally) {
            Box(Modifier.size(48.dp).background(tint.copy(alpha = 0.2f), CircleShape), contentAlignment = Alignment.Center) {
                Icon(icon, contentDescription = title, tint = tint)
            }
            Spacer(Modifier.height(10.dp))
            Text(title, color = Color.White, fontWeight = FontWeight.Bold, fontSize = 13.sp)
            Text(subtitle, color = SentinelColors.Slate500, fontSize = 11.sp)
        }
    }
}

@Composable
private fun ContactRow(c: EmergencyContact, context: android.content.Context) {
    Row(Modifier.fillMaxWidth().padding(vertical = 6.dp), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.size(36.dp).background(SentinelColors.Slate700, CircleShape), contentAlignment = Alignment.Center) {
                Text(c.name.take(1), color = Color.White, fontWeight = FontWeight.Black)
            }
            Spacer(Modifier.width(10.dp))
            Column { Text(c.name, color = Color.White, fontWeight = FontWeight.Bold, fontSize = 13.sp); Text(c.relation, color = SentinelColors.Slate500, fontSize = 11.sp) }
        }
        IconButton(onClick = { context.startActivity(Intent(Intent.ACTION_DIAL, Uri.parse("tel:${c.phone}"))) }) {
            Icon(Icons.Filled.Call, contentDescription = "Call ${c.name}", tint = SentinelColors.Emerald500)
        }
    }
}
