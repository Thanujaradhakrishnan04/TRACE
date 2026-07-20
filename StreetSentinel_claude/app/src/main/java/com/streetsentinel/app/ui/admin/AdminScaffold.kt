package com.streetsentinel.app.ui.admin

import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp
import androidx.navigation.NavHostController
import com.streetsentinel.app.navigation.Routes
import com.streetsentinel.app.theme.SentinelColors

private data class NavEntry(val route: String, val icon: androidx.compose.ui.graphics.vector.ImageVector, val label: String)

private val adminNavItems = listOf(
    NavEntry(Routes.ADMIN_HOME, Icons.Filled.Dashboard, "Home"),
    NavEntry(Routes.ADMIN_ANALYTICS, Icons.Filled.Insights, "Analytics"),
    NavEntry(Routes.ADMIN_USERS, Icons.Filled.People, "Users"),
    NavEntry(Routes.ADMIN_HEATMAP, Icons.Filled.Map, "Heatmap"),
    NavEntry(Routes.ADMIN_SETTINGS, Icons.Filled.Settings, "Settings"),
)

/** Port of src/layouts/AdminLayout.jsx */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AdminScaffold(navController: NavHostController, currentRoute: String?, content: @Composable (androidx.compose.foundation.layout.PaddingValues) -> Unit) {
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("STREET SENTINEL · OVERWATCH", fontWeight = FontWeight.Black, fontSize = 13.sp) },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = SentinelColors.Slate900, titleContentColor = Color.White)
            )
        },
        bottomBar = {
            NavigationBar(containerColor = SentinelColors.Slate900) {
                adminNavItems.forEach { item ->
                    NavigationBarItem(
                        selected = currentRoute == item.route,
                        onClick = { navController.navigate(item.route) },
                        icon = { Icon(item.icon, contentDescription = item.label) },
                        label = { Text(item.label, fontSize = 9.sp) },
                        colors = NavigationBarItemDefaults.colors(
                            selectedIconColor = SentinelColors.PrimaryRed, selectedTextColor = SentinelColors.PrimaryRed,
                            unselectedIconColor = SentinelColors.Slate400, unselectedTextColor = SentinelColors.Slate400,
                            indicatorColor = Color.Transparent
                        )
                    )
                }
            }
        }
    ) { padding -> content(padding) }
}
