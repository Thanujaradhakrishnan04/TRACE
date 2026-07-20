package com.streetsentinel.app.ui.police

import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp
import androidx.navigation.NavHostController
import com.streetsentinel.app.navigation.Routes
import com.streetsentinel.app.theme.SentinelColors

private data class NavEntry(val route: String, val icon: androidx.compose.ui.graphics.vector.ImageVector, val label: String)

private val policeNavItems = listOf(
    NavEntry(Routes.POLICE_HOME, Icons.Filled.LocalPolice, "Dispatch"),
    NavEntry(Routes.POLICE_MAP, Icons.Filled.Public, "Map"),
    NavEntry(Routes.POLICE_TACTICAL, Icons.Filled.Security, "Tactical"),
    NavEntry(Routes.POLICE_CHAT, Icons.Filled.Forum, "Chat"),
)

/** Port of src/layouts/PoliceLayout.jsx */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PoliceScaffold(navController: NavHostController, currentRoute: String?, content: @Composable (androidx.compose.foundation.layout.PaddingValues) -> Unit) {
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("STREET SENTINEL · TACTICAL", fontWeight = FontWeight.Black, fontSize = 14.sp) },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = SentinelColors.Slate900, titleContentColor = androidx.compose.ui.graphics.Color.White)
            )
        },
        bottomBar = {
            NavigationBar(containerColor = SentinelColors.Slate900) {
                policeNavItems.forEach { item ->
                    NavigationBarItem(
                        selected = currentRoute == item.route,
                        onClick = { navController.navigate(item.route) },
                        icon = { Icon(item.icon, contentDescription = item.label) },
                        label = { Text(item.label, fontSize = 10.sp) },
                        colors = NavigationBarItemDefaults.colors(
                            selectedIconColor = SentinelColors.PrimaryRed, selectedTextColor = SentinelColors.PrimaryRed,
                            unselectedIconColor = SentinelColors.Slate400, unselectedTextColor = SentinelColors.Slate400,
                            indicatorColor = androidx.compose.ui.graphics.Color.Transparent
                        )
                    )
                }
            }
        }
    ) { padding -> content(padding) }
}
