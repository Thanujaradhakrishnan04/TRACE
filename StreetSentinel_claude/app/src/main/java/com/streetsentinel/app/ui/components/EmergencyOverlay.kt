package com.streetsentinel.app.ui.components

import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.tween
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.zIndex
import com.streetsentinel.app.theme.SentinelColors
import com.streetsentinel.app.viewmodel.SentinelViewModel
import kotlinx.coroutines.delay

/**
 * Direct port of components/ui/EmergencyOverlay.jsx. This is a GLOBAL overlay — mounted once
 * above the nav host (see MainActivity/SentinelNavGraph) so it appears over whichever screen
 * is currently showing, exactly like the web version which lives outside <Outlet/> in App.jsx.
 *
 * Two states:
 *  1. Pre-emergency 15s countdown: "Send Location Now" vs "I'm Safe". If untouched, it
 *     auto-fires sendEmergencyAlert() at 0, which dispatches location to emergency contacts
 *     via email/SMS through the backend — this is the piece that was missing before, which
 *     is why the app never showed the countdown / auto-send-on-timeout behavior the web app has.
 *  2. Full emergency mode: flashing red border, live elapsed timer, dispatch status panel.
 */
@Composable
fun EmergencyOverlay(viewModel: SentinelViewModel) {
    val countdown by viewModel.countdown.collectAsState()
    val isEmergencyMode by viewModel.isEmergencyMode.collectAsState()
    val emergencyData by viewModel.emergencyData.collectAsState()
    var activeTimer by remember { mutableStateOf(0) }

    LaunchedEffect(isEmergencyMode) {
        if (isEmergencyMode) {
            activeTimer = 0
            while (true) {
                delay(1000)
                activeTimer += 1
            }
        }
    }

    if (countdown != null && !isEmergencyMode) {
        PreEmergencyCountdownModal(
            countdown = countdown!!,
            onSendLocationNow = { viewModel.sendEmergencyAlert("Manual SOS - Send Location Override") },
            onImSafe = { viewModel.cancelEmergency() }
        )
    }

    if (isEmergencyMode) {
        FullEmergencyOverlay(
            reason = emergencyData?.reason ?: "SOS Triggered",
            elapsedSeconds = activeTimer,
            onCancel = { viewModel.cancelEmergency() }
        )
    }
}

@Composable
private fun PreEmergencyCountdownModal(countdown: Int, onSendLocationNow: () -> Unit, onImSafe: () -> Unit) {
    Box(
        Modifier.fillMaxSize().zIndex(999f)
            .background(Color.Black.copy(alpha = 0.8f))
            .clickable(enabled = false) {},
        contentAlignment = Alignment.Center
    ) {
        Card(
            modifier = Modifier.padding(24.dp).fillMaxWidth(),
            shape = RoundedCornerShape(28.dp),
            colors = CardDefaults.cardColors(containerColor = SentinelColors.Slate900),
            border = BorderStroke(2.dp, SentinelColors.Amber500)
        ) {
            Column(Modifier.padding(28.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                val pulse = rememberInfiniteTransition(label = "pulse")
                val scale by pulse.animateFloat(1f, 1.15f, infiniteRepeatable(tween(600), RepeatMode.Reverse), label = "s")
                Icon(
                    Icons.Filled.Warning, contentDescription = null, tint = SentinelColors.Amber500,
                    modifier = Modifier.size(64.dp).scale(scale)
                )
                Spacer(Modifier.height(16.dp))
                Text("EMERGENCY DETECTED", color = Color.White, fontWeight = FontWeight.Black, fontSize = 24.sp)
                Spacer(Modifier.height(8.dp))
                Text(
                    "Potential distress identified. Alerts will be sent automatically in ${countdown}s.",
                    color = SentinelColors.Slate300, textAlign = TextAlign.Center, fontSize = 14.sp
                )
                Spacer(Modifier.height(24.dp))
                Button(
                    onClick = onSendLocationNow,
                    modifier = Modifier.fillMaxWidth().height(56.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = SentinelColors.Red600),
                    shape = RoundedCornerShape(16.dp)
                ) {
                    Icon(Icons.Filled.LocationOn, contentDescription = null)
                    Spacer(Modifier.width(8.dp))
                    Text("SEND LOCATION NOW", fontWeight = FontWeight.Black, letterSpacing = 1.sp)
                }
                Spacer(Modifier.height(12.dp))
                Button(
                    onClick = onImSafe,
                    modifier = Modifier.fillMaxWidth().height(56.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = SentinelColors.Slate800),
                    shape = RoundedCornerShape(16.dp)
                ) {
                    Icon(Icons.Filled.VerifiedUser, contentDescription = null, tint = SentinelColors.Emerald500)
                    Spacer(Modifier.width(8.dp))
                    Text("I'M SAFE", fontWeight = FontWeight.Black, letterSpacing = 1.sp)
                }
            }
        }
    }
}

@Composable
private fun FullEmergencyOverlay(reason: String, elapsedSeconds: Int, onCancel: () -> Unit) {
    val pulse = rememberInfiniteTransition(label = "border")
    val borderAlpha by pulse.animateFloat(0.3f, 1f, infiniteRepeatable(tween(1000), RepeatMode.Reverse), label = "a")
    val scale by pulse.animateFloat(1f, 1.1f, infiniteRepeatable(tween(1500), RepeatMode.Reverse), label = "s2")

    Box(Modifier.fillMaxSize().zIndex(999f)) {
        Box(
            Modifier.fillMaxSize()
                .background(Color(0xFF1F0A0A).copy(alpha = 0.92f))
                .border(6.dp, SentinelColors.Red600.copy(alpha = borderAlpha))
        ) {
            IconButton(onClick = onCancel, modifier = Modifier.align(Alignment.TopEnd).padding(20.dp)) {
                Box(Modifier.size(44.dp).clip(CircleShape).background(Color(0x33FF0000)), contentAlignment = Alignment.Center) {
                    Icon(Icons.Filled.Close, contentDescription = "Cancel emergency", tint = Color.White)
                }
            }

            Column(
                Modifier.fillMaxSize().padding(24.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Center
            ) {
                Box(
                    Modifier.size(128.dp).scale(scale).clip(CircleShape).background(SentinelColors.Red600),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(Icons.Filled.NotificationImportant, contentDescription = null, tint = Color.White, modifier = Modifier.size(64.dp))
                }
                Spacer(Modifier.height(24.dp))
                Text("EMERGENCY MODE ACTIVATED", color = Color.White, fontWeight = FontWeight.Black, fontSize = 26.sp, textAlign = TextAlign.Center, letterSpacing = 1.sp)
                Spacer(Modifier.height(6.dp))
                Text(reason.uppercase(), color = SentinelColors.Red100, fontWeight = FontWeight.Bold, fontSize = 14.sp, letterSpacing = 1.sp)
                Spacer(Modifier.height(32.dp))

                Card(
                    shape = RoundedCornerShape(28.dp),
                    colors = CardDefaults.cardColors(containerColor = Color.Black.copy(alpha = 0.4f)),
                    border = BorderStroke(1.dp, SentinelColors.Red600.copy(alpha = 0.3f)),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(Modifier.padding(24.dp)) {
                        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Icon(Icons.Filled.RadioButtonChecked, contentDescription = null, tint = SentinelColors.PrimaryRed, modifier = Modifier.size(16.dp))
                                Spacer(Modifier.width(6.dp))
                                Text("LIVE TRACKING ACTIVE", color = SentinelColors.PrimaryRed, fontWeight = FontWeight.Bold, fontSize = 11.sp, letterSpacing = 1.sp)
                            }
                            Text(formatElapsed(elapsedSeconds), color = Color.White, fontWeight = FontWeight.Black, fontSize = 24.sp)
                        }
                        Spacer(Modifier.height(16.dp))
                        Row(
                            Modifier.fillMaxWidth().background(Color(0x40B91C1C), RoundedCornerShape(14.dp)).padding(14.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Box(Modifier.size(28.dp), contentAlignment = Alignment.Center) {
                                CircularProgressIndicator(strokeWidth = 3.dp, color = SentinelColors.Red500, modifier = Modifier.size(24.dp))
                            }
                            Spacer(Modifier.width(12.dp))
                            Column {
                                Text("Dispatching Nearest Authorities", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 13.sp)
                                Text("Please remain calm...", color = SentinelColors.Red100, fontSize = 11.sp)
                            }
                        }
                    }
                }
                Spacer(Modifier.height(20.dp))
                Text("📍 Location actively transmitting to Guardian Network", color = SentinelColors.PrimaryRed, fontSize = 12.sp, fontWeight = FontWeight.Bold)
            }
        }
    }
}

private fun formatElapsed(secs: Int): String {
    val m = secs / 60
    val s = secs % 60
    return "%02d:%02d".format(m, s)
}
