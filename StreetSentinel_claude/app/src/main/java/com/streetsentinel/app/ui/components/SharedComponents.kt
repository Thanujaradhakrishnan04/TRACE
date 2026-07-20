package com.streetsentinel.app.ui.components

import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Mic
import androidx.compose.material.icons.filled.Shield
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.streetsentinel.app.theme.SentinelColors
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlin.math.max
import kotlin.math.min

/** Direct equivalent of the `.glass-panel` / `.glass-card` CSS utility classes. */
@Composable
fun GlassCard(
    modifier: Modifier = Modifier,
    content: @Composable ColumnScope.() -> Unit
) {
    Card(
        modifier = modifier,
        shape = RoundedCornerShape(20.dp),
        colors = CardDefaults.cardColors(containerColor = SentinelColors.BgWhite),
        elevation = CardDefaults.cardElevation(defaultElevation = 4.dp)
    ) {
        Column(modifier = Modifier.padding(16.dp), content = content)
    }
}

/** Port of components/StatusCard.jsx — live ambient-noise monitoring meter. */
@Composable
fun StatusCard(isMonitoring: Boolean, decibels: Float, modifier: Modifier = Modifier) {
    val displayDb = max(0, min(100, (decibels + 100).toInt()))
    GlassCard(modifier = modifier) {
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(Icons.Filled.Warning, contentDescription = null, tint = if (isMonitoring) SentinelColors.PrimaryRed else SentinelColors.Slate400)
                Spacer(Modifier.width(6.dp))
                Text("Live Monitoring", fontWeight = FontWeight.SemiBold, color = SentinelColors.Slate800)
            }
            if (isMonitoring) {
                Surface(color = SentinelColors.Red100, shape = RoundedCornerShape(50)) {
                    Text("● Listening", modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp), fontSize = 11.sp, color = SentinelColors.PrimaryRed, fontWeight = FontWeight.Medium)
                }
            }
        }
        Spacer(Modifier.height(12.dp))
        Surface(color = SentinelColors.Slate50, shape = RoundedCornerShape(14.dp), border = BorderStroke(1.dp, SentinelColors.Slate200)) {
            Column(Modifier.padding(16.dp)) {
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Filled.Mic, contentDescription = null, modifier = Modifier.size(16.dp), tint = SentinelColors.Slate500)
                        Spacer(Modifier.width(6.dp))
                        Text("Ambient Noise Level", fontSize = 13.sp, color = SentinelColors.Slate500)
                    }
                    Text("$displayDb dB", fontWeight = FontWeight.Bold, fontSize = 13.sp, color = SentinelColors.Slate700)
                }
                Spacer(Modifier.height(8.dp))
                LinearProgressIndicator(
                    progress = { displayDb / 100f },
                    modifier = Modifier.fillMaxWidth().height(10.dp).clip(RoundedCornerShape(50)),
                    color = SentinelColors.PrimaryRed,
                    trackColor = SentinelColors.Slate200
                )
            }
        }
    }
}

/** Port of components/ProtectionToggle.jsx — tap-to-arm smart/extreme protection dial. */
@Composable
fun ProtectionToggle(modifier: Modifier = Modifier, onModeChanged: (isActive: Boolean) -> Unit = {}) {
    var mode by remember { mutableStateOf("Disabled") } // Disabled, Smart, Extreme
    var scanning by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()

    val bg = when (mode) { "Extreme" -> Color(0xFF450A0A); "Smart" -> Color(0xFF172554); else -> SentinelColors.Slate900 }
    val accent = if (mode == "Extreme") SentinelColors.Red500 else SentinelColors.Blue500
    val borderColor = if (mode == "Extreme") SentinelColors.Red500 else if (mode == "Smart") SentinelColors.Blue500 else SentinelColors.Slate700

    Column(
        modifier = modifier
            .clip(RoundedCornerShape(40.dp))
            .background(bg)
            .border(2.dp, borderColor, RoundedCornerShape(40.dp))
            .padding(32.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Text(
            text = if (mode != "Disabled") "AI PROTECTION: ${mode.uppercase()}" else "SYSTEM STANDBY",
            color = if (mode != "Disabled") accent else SentinelColors.Slate500,
            fontWeight = FontWeight.Black, fontSize = 11.sp
        )
        Spacer(Modifier.height(20.dp))

        val infiniteRotation = rememberInfiniteTransition(label = "spin")
        val angle by infiniteRotation.animateFloat(
            initialValue = 0f, targetValue = 360f,
            animationSpec = infiniteRepeatable(tween(1000, easing = LinearEasing)), label = "angle"
        )

        Box(
            modifier = Modifier
                .size(140.dp)
                .clip(CircleShape)
                .background(
                    when {
                        scanning -> SentinelColors.Slate800
                        mode == "Extreme" -> SentinelColors.Red600
                        mode == "Smart" -> SentinelColors.Blue600
                        else -> SentinelColors.Slate800
                    }
                ),
            contentAlignment = Alignment.Center
        ) {
            IconButton(
                enabled = !scanning,
                onClick = {
                    scanning = true
                    scope.launch {
                        delay(1500)
                        scanning = false
                        val wasDisabled = mode == "Disabled"
                        mode = when (mode) { "Disabled" -> "Smart"; "Smart" -> "Extreme"; else -> "Disabled" }
                        if (wasDisabled) onModeChanged(true) else if (mode == "Disabled") onModeChanged(false)
                    }
                }
            ) {
                Icon(
                    imageVector = Icons.Filled.Shield,
                    contentDescription = "Toggle protection",
                    modifier = Modifier.size(56.dp).let { if (scanning) it.rotate(angle) else it },
                    tint = if (mode == "Disabled" && !scanning) SentinelColors.Slate500 else Color.White
                )
            }
        }
        Spacer(Modifier.height(20.dp))
        Text(
            text = if (scanning) "CONFIGURING AI..." else when (mode) {
                "Disabled" -> "Tap to arm Smart Protection"
                "Smart" -> "Tap to arm Extreme Mode"
                else -> "Tap to Disarm"
            },
            color = if (scanning) Color.White else SentinelColors.Slate400,
            fontSize = 12.sp, fontWeight = FontWeight.Medium
        )
    }
}
