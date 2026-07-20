package com.streetsentinel.app.ui.citizen

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
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
import androidx.navigation.NavHostController
import com.streetsentinel.app.data.model.SentinelUser
import com.streetsentinel.app.navigation.Routes
import com.streetsentinel.app.theme.SentinelColors

private data class NavItem(val route: String, val icon: androidx.compose.ui.graphics.vector.ImageVector, val label: String, val isSos: Boolean = false)

private val bottomNavItems = listOf(
    NavItem(Routes.CITIZEN_HOME, Icons.Filled.Home, "Home"),
    NavItem(Routes.CITIZEN_TRACKING, Icons.Filled.Navigation, "Routes"),
    NavItem(Routes.CITIZEN_SOS, Icons.Filled.NotificationImportant, "SOS", isSos = true),
    NavItem(Routes.CITIZEN_ALERTS, Icons.Filled.Notifications, "Alerts"),
    NavItem(Routes.CITIZEN_PROFILE, Icons.Filled.Person, "Profile"),
)

private val drawerItems = listOf(
    NavItem(Routes.CITIZEN_HOME, Icons.Filled.Home, "Home"),
    NavItem(Routes.CITIZEN_TRACKING, Icons.Filled.Navigation, "SafeWalk"),
    NavItem(Routes.CITIZEN_SOS, Icons.Filled.NotificationImportant, "Emergency SOS"),
    NavItem(Routes.CITIZEN_ALERTS, Icons.Filled.Notifications, "Alerts History"),
    NavItem(Routes.CITIZEN_CHAT, Icons.Filled.Chat, "Police Chat"),
    NavItem(Routes.CITIZEN_CONTACTS, Icons.Filled.Call, "Contacts"),
    NavItem(Routes.CITIZEN_GUARDIANS, Icons.Filled.Groups, "Guardians"),
    NavItem(Routes.CITIZEN_VAULT, Icons.Filled.RemoveRedEye, "Evidence Vault"),
    NavItem(Routes.CITIZEN_SETTINGS, Icons.Filled.Settings, "Settings"),
    NavItem(Routes.CITIZEN_PROFILE, Icons.Filled.Person, "Profile"),
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CitizenScaffold(
    navController: NavHostController,
    currentRoute: String?,
    currentUser: SentinelUser?,
    isEmergencyMode: Boolean,
    threatLevelHigh: Boolean,
    activeEmergencyId: String?,
    onLogout: () -> Unit,
    content: @Composable (PaddingValues) -> Unit
) {
    var drawerOpen by remember { mutableStateOf(false) }

    Box(Modifier.fillMaxSize()) {
        Scaffold(
            topBar = {
                Column {
                    TopAppBar(
                        title = {
                            Column {
                                Text("STREET SENTINEL", fontWeight = FontWeight.Black, fontSize = 15.sp,
                                    color = if (isEmergencyMode) Color.White else SentinelColors.Slate800)
                                Text(
                                    if (isEmergencyMode) "⚠ EMERGENCY ACTIVE" else "AI Guardian Active",
                                    fontSize = 10.sp, fontWeight = FontWeight.Bold,
                                    color = if (isEmergencyMode) SentinelColors.Red100 else SentinelColors.Slate400
                                )
                            }
                        },
                        navigationIcon = {
                            IconButton(onClick = { drawerOpen = true }) {
                                Icon(Icons.Filled.Menu, contentDescription = "Menu", tint = if (isEmergencyMode) Color.White else SentinelColors.Slate600)
                            }
                        },
                        actions = {
                            Box(
                                Modifier.size(8.dp).clip(CircleShape)
                                    .background(if (isEmergencyMode) Color.White else if (threatLevelHigh) SentinelColors.Red500 else SentinelColors.Emerald500)
                            )
                            Spacer(Modifier.width(8.dp))
                            IconButton(onClick = { navController.navigate(Routes.CITIZEN_SETTINGS) }) {
                                Icon(Icons.Filled.Settings, contentDescription = "Settings", tint = if (isEmergencyMode) Color.White else SentinelColors.Slate500)
                            }
                        },
                        colors = TopAppBarDefaults.topAppBarColors(
                            containerColor = if (isEmergencyMode) SentinelColors.Red600 else SentinelColors.BgWhite
                        )
                    )
                    if (isEmergencyMode && activeEmergencyId != null && currentRoute != Routes.CITIZEN_CHAT) {
                        Row(
                            Modifier.fillMaxWidth().background(SentinelColors.Blue600)
                                .clickable { navController.navigate(Routes.CITIZEN_CHAT) }
                                .padding(horizontal = 16.dp, vertical = 8.dp),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text("🚨 SECURE CHAT UPLINK WITH POLICE DISPATCH", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 11.sp)
                            Text("Open Chat ➔", color = Color.White, fontSize = 10.sp, fontWeight = FontWeight.Black)
                        }
                    }
                }
            },
            bottomBar = {
                NavigationBar(containerColor = SentinelColors.BgWhite) {
                    bottomNavItems.forEach { item ->
                        if (item.isSos) {
                            Box(Modifier.weight(1f), contentAlignment = Alignment.Center) {
                                Box(
                                    Modifier
                                        .offset(y = (-16).dp)
                                        .size(56.dp)
                                        .clip(CircleShape)
                                        .background(SentinelColors.Red500)
                                        .clickable { navController.navigate(item.route) },
                                    contentAlignment = Alignment.Center
                                ) {
                                    Icon(item.icon, contentDescription = item.label, tint = Color.White)
                                }
                            }
                        } else {
                            NavigationBarItem(
                                selected = currentRoute == item.route,
                                onClick = { navController.navigate(item.route) },
                                icon = { Icon(item.icon, contentDescription = item.label) },
                                label = { Text(item.label, fontSize = 10.sp, fontWeight = FontWeight.Bold) },
                                colors = NavigationBarItemDefaults.colors(
                                    selectedIconColor = SentinelColors.Red500, selectedTextColor = SentinelColors.Red500,
                                    unselectedIconColor = SentinelColors.Slate400, unselectedTextColor = SentinelColors.Slate400,
                                    indicatorColor = Color.Transparent
                                )
                            )
                        }
                    }
                }
            },
            containerColor = SentinelColors.BgLight
        ) { padding -> content(padding) }

        if (drawerOpen) {
            Box(Modifier.fillMaxSize().background(Color.Black.copy(alpha = 0.5f)).clickable { drawerOpen = false })
            Column(
                Modifier
                    .fillMaxHeight()
                    .width(280.dp)
                    .background(Color.White)
            ) {
                Column(Modifier.fillMaxWidth().background(SentinelColors.Slate900).padding(24.dp)) {
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                        Icon(Icons.Filled.Shield, contentDescription = null, tint = SentinelColors.Red500)
                        Icon(Icons.Filled.Close, contentDescription = "Close", tint = SentinelColors.Slate400,
                            modifier = Modifier.clickable { drawerOpen = false })
                    }
                    Spacer(Modifier.height(12.dp))
                    Text("STREET SENTINEL", color = Color.White, fontWeight = FontWeight.Black, fontSize = 20.sp)
                    Text(currentUser?.name ?: "Citizen", color = SentinelColors.Slate400, fontWeight = FontWeight.Bold, fontSize = 13.sp)
                    Text(currentUser?.email ?: "", color = SentinelColors.Slate500, fontSize = 11.sp)
                }
                Column(Modifier.weight(1f).padding(vertical = 8.dp)) {
                    drawerItems.forEach { item ->
                        val active = currentRoute == item.route
                        Row(
                            Modifier.fillMaxWidth()
                                .background(if (active) SentinelColors.Red50 else Color.Transparent)
                                .clickable { navController.navigate(item.route); drawerOpen = false }
                                .padding(horizontal = 20.dp, vertical = 14.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Icon(item.icon, contentDescription = null, tint = if (active) SentinelColors.Red600 else SentinelColors.Slate600)
                            Spacer(Modifier.width(16.dp))
                            Text(item.label, fontWeight = FontWeight.SemiBold, fontSize = 14.sp, color = if (active) SentinelColors.Red600 else SentinelColors.Slate600)
                        }
                    }
                }
                Row(
                    Modifier.fillMaxWidth()
                        .clickable { onLogout() }
                        .padding(horizontal = 20.dp, vertical = 16.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(Icons.Filled.Logout, contentDescription = null, tint = SentinelColors.Red500)
                    Spacer(Modifier.width(12.dp))
                    Text("Sign Out", color = SentinelColors.Red500, fontWeight = FontWeight.Bold)
                }
            }
        }
    }
}
