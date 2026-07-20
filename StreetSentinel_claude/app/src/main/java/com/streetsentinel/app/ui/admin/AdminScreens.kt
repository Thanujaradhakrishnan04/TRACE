package com.streetsentinel.app.ui.admin

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.streetsentinel.app.theme.SentinelColors

private data class AdminCard(val icon: androidx.compose.ui.graphics.vector.ImageVector, val label: String, val value: String)

/** Port of pages/admin/AdminHome.jsx — smart-city overwatch summary (mock metrics, same as web). */
@Composable
fun AdminHomeScreen() {
    val cards = listOf(
        AdminCard(Icons.Filled.People, "Active Citizens", "12,480"),
        AdminCard(Icons.Filled.LocalPolice, "Officers On Duty", "342"),
        AdminCard(Icons.Filled.Warning, "Incidents Today", "18"),
        AdminCard(Icons.Filled.Map, "Coverage Zones", "56"),
    )
    Column(Modifier.fillMaxSize().background(SentinelColors.BgLight).padding(20.dp)) {
        Text("Overwatch", fontSize = 24.sp, fontWeight = FontWeight.Bold, color = SentinelColors.Slate800)
        Text("Smart city analytics & system control", color = SentinelColors.Slate500, fontSize = 13.sp)
        Spacer(Modifier.height(20.dp))
        LazyVerticalGrid(columns = GridCells.Fixed(2), horizontalArrangement = Arrangement.spacedBy(12.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            items(cards) { c ->
                Card(shape = RoundedCornerShape(18.dp), colors = CardDefaults.cardColors(containerColor = Color.White)) {
                    Column(Modifier.padding(16.dp)) {
                        Icon(c.icon, contentDescription = null, tint = SentinelColors.PrimaryRed)
                        Spacer(Modifier.height(8.dp))
                        Text(c.value, fontWeight = FontWeight.Black, fontSize = 20.sp, color = SentinelColors.Slate800)
                        Text(c.label, fontSize = 12.sp, color = SentinelColors.Slate500)
                    }
                }
            }
        }
    }
}

/** Placeholder admin sub-pages — mirrors the web app, where these are also mock/placeholder screens. */
@Composable
fun AdminPlaceholderScreen(title: String) {
    Column(Modifier.fillMaxSize().background(SentinelColors.BgLight).padding(20.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center) {
        Icon(Icons.Filled.Construction, contentDescription = null, tint = SentinelColors.Slate300, modifier = Modifier.size(56.dp))
        Spacer(Modifier.height(12.dp))
        Text(title, fontSize = 18.sp, fontWeight = FontWeight.Bold, color = SentinelColors.Slate700)
        Text("Coming soon", color = SentinelColors.Slate400, fontSize = 13.sp)
    }
}
