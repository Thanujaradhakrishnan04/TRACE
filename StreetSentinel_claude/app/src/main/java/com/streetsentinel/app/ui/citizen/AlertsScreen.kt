package com.streetsentinel.app.ui.citizen

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.NotificationsNone
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.streetsentinel.app.data.model.AlertRecord
import com.streetsentinel.app.theme.SentinelColors
import com.streetsentinel.app.viewmodel.SentinelViewModel
import java.text.SimpleDateFormat
import java.util.*

/** Port of pages/citizen/Alerts.jsx */
@Composable
fun AlertsScreen(viewModel: SentinelViewModel) {
    val alerts by viewModel.alertHistory.collectAsState()
    Column(Modifier.fillMaxSize().background(SentinelColors.BgLight)) {
        Column(Modifier.padding(20.dp)) {
            Text("Alerts History", fontSize = 24.sp, fontWeight = FontWeight.Bold, color = SentinelColors.Slate800)
            Text("${alerts.size} past emergency events", color = SentinelColors.Slate500, fontSize = 13.sp)
        }
        if (alerts.isEmpty()) {
            Column(Modifier.fillMaxSize(), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center) {
                Icon(Icons.Filled.NotificationsNone, contentDescription = null, tint = SentinelColors.Slate300, modifier = Modifier.size(56.dp))
                Spacer(Modifier.height(8.dp))
                Text("No alerts yet", color = SentinelColors.Slate400)
            }
        } else {
            LazyColumn(Modifier.padding(horizontal = 20.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                items(alerts) { alert -> AlertRow(alert) }
                item { Spacer(Modifier.height(20.dp)) }
            }
        }
    }
}

@Composable
private fun AlertRow(alert: AlertRecord) {
    val riskColor = when (alert.riskLevel) {
        "CRITICAL", "HIGH" -> SentinelColors.PrimaryRed
        "MEDIUM" -> SentinelColors.Amber500
        else -> SentinelColors.Emerald500
    }
    Card(shape = RoundedCornerShape(16.dp), colors = CardDefaults.cardColors(containerColor = Color.White)) {
        Row(Modifier.fillMaxWidth().padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.size(40.dp).background(riskColor.copy(alpha = 0.12f), CircleShape), contentAlignment = Alignment.Center) {
                Icon(Icons.Filled.Warning, contentDescription = null, tint = riskColor, modifier = Modifier.size(20.dp))
            }
            Spacer(Modifier.width(12.dp))
            Column(Modifier.weight(1f)) {
                Text(alert.type, fontWeight = FontWeight.Bold, fontSize = 14.sp, color = SentinelColors.Slate800)
                Text(
                    SimpleDateFormat("MMM d, yyyy · h:mm a", Locale.getDefault()).format(Date(alert.timestamp)),
                    fontSize = 11.sp, color = SentinelColors.Slate500
                )
            }
            Surface(color = riskColor.copy(alpha = 0.12f), shape = RoundedCornerShape(50)) {
                Text(alert.riskLevel, modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp), fontSize = 10.sp, fontWeight = FontWeight.Black, color = riskColor)
            }
        }
    }
}
