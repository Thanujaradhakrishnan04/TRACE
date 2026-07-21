package com.streetsentinel.app.navigation

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import androidx.navigation.NavType
import com.streetsentinel.app.data.repository.FirestoreRepository
import com.streetsentinel.app.ui.admin.AdminHomeScreen
import com.streetsentinel.app.ui.admin.AdminPlaceholderScreen
import com.streetsentinel.app.ui.admin.AdminScaffold
import com.streetsentinel.app.ui.auth.*
import com.streetsentinel.app.ui.citizen.*
import com.streetsentinel.app.ui.police.PoliceChatScreen
import com.streetsentinel.app.ui.police.PoliceDashboardScreen
import com.streetsentinel.app.ui.police.PoliceMapScreen
import com.streetsentinel.app.ui.police.PoliceScaffold
import com.streetsentinel.app.ui.police.TacticalCommandScreen
import com.streetsentinel.app.viewmodel.SentinelViewModel

/**
 * Direct port of the <Routes>/<Route> tree in src/App.jsx. Each `composable(Routes.X)` below
 * corresponds 1:1 to a <Route path="X" element={...}/> in the original, including the
 * role-based landing logic that ProtectedRoute.jsx implements via redirects in the web app
 * (here expressed as navController.navigate(...) calls after login/signup).
 */
@Composable
fun SentinelNavGraph(viewModel: SentinelViewModel) {
    val navController = rememberNavController()
    val backStackEntry by navController.currentBackStackEntryAsState()
    val currentRoute = backStackEntry?.destination?.route

    NavHost(navController = navController, startDestination = Routes.SPLASH) {

        // ---- Auth flow ----
        composable(Routes.SPLASH) { SplashScreen(onFinished = { navController.navigate(Routes.ONBOARDING) { popUpTo(Routes.SPLASH) { inclusive = true } } }) }
        composable(Routes.ONBOARDING) { OnboardingScreen(onDone = { navController.navigate(Routes.ROLE_SELECTION) }) }
        composable(Routes.ROLE_SELECTION) { RoleSelectionScreen(onRoleSelected = { role -> navController.navigate("${Routes.AUTH_HOME}/$role") }) }
        composable("${Routes.AUTH_HOME}/{role}", arguments = listOf(navArgument("role") { type = NavType.StringType })) { entry ->
            val role = entry.arguments?.getString("role") ?: "citizen"
            AuthLandingScreen(
                role = role,
                onLogin = { navController.navigate("${Routes.LOGIN}/$role") },
                onSignup = { navController.navigate("${Routes.SIGNUP}/$role") }
            )
        }
        composable("${Routes.LOGIN}/{role}", arguments = listOf(navArgument("role") { type = NavType.StringType })) { entry ->
            val role = entry.arguments?.getString("role") ?: "citizen"
            LoginScreen(
                role = role, viewModel = viewModel,
                onSuccess = { navController.navigate(homeRouteFor(role)) { popUpTo(Routes.SPLASH) { inclusive = true } } },
                onSwitchToSignup = { navController.navigate("${Routes.SIGNUP}/$role") }
            )
        }
        composable("${Routes.SIGNUP}/{role}", arguments = listOf(navArgument("role") { type = NavType.StringType })) { entry ->
            val role = entry.arguments?.getString("role") ?: "citizen"
            SignupScreen(
                role = role, viewModel = viewModel,
                onSuccess = { navController.navigate(homeRouteFor(role)) { popUpTo(Routes.SPLASH) { inclusive = true } } },
                onSwitchToLogin = { navController.navigate("${Routes.LOGIN}/$role") }
            )
        }

        // ---- Citizen module (wrapped in CitizenScaffold, equivalent of CitizenLayout.jsx's <Outlet/>) ----
        val citizenRoutes = listOf(
            Routes.CITIZEN_HOME, Routes.CITIZEN_SOS, Routes.CITIZEN_TRACKING, Routes.CITIZEN_ALERTS,
            Routes.CITIZEN_CONTACTS, Routes.CITIZEN_GUARDIANS, Routes.CITIZEN_PROFILE, Routes.CITIZEN_SETTINGS,
            Routes.CITIZEN_VAULT, Routes.CITIZEN_HEALTH, Routes.CITIZEN_CHAT, Routes.CITIZEN_DIAGNOSTICS
        )
        citizenRoutes.forEach { route ->
            composable(route) {
                val user by viewModel.currentUser.collectAsState()
                val isEmergencyMode by viewModel.isEmergencyMode.collectAsState()
                val threatLevel by viewModel.threatLevel.collectAsState()
                val activeEmergencyId by viewModel.activeEmergencyId.collectAsState()
                CitizenScaffold(
                    navController = navController,
                    currentRoute = currentRoute,
                    currentUser = user,
                    isEmergencyMode = isEmergencyMode,
                    threatLevelHigh = threatLevel.name == "HIGH" || threatLevel.name == "CRITICAL",
                    activeEmergencyId = activeEmergencyId,
                    onLogout = { viewModel.logout(); navController.navigate(Routes.SPLASH) { popUpTo(0) } }
                ) { padding ->
                    androidx.compose.foundation.layout.Box(androidx.compose.ui.Modifier.padding(padding)) {
                        when (route) {
                            Routes.CITIZEN_HOME -> CitizenHomeScreen(viewModel) { navController.navigate(it) }
                            Routes.CITIZEN_SOS -> EmergencySosScreen(viewModel, onOpenChat = { navController.navigate(Routes.CITIZEN_CHAT) }, onOpenContacts = { navController.navigate(Routes.CITIZEN_CONTACTS) })
                            Routes.CITIZEN_TRACKING -> SafeWalkScreen(viewModel)
                            Routes.CITIZEN_ALERTS -> AlertsScreen(viewModel)
                            Routes.CITIZEN_CONTACTS -> ContactsScreen(viewModel)
                            Routes.CITIZEN_GUARDIANS -> GuardiansScreen(viewModel)
                            Routes.CITIZEN_PROFILE -> ProfileScreen(viewModel, onLogout = { viewModel.logout(); navController.navigate(Routes.SPLASH) { popUpTo(0) } })
                            Routes.CITIZEN_SETTINGS -> SettingsScreen(viewModel)
                            Routes.CITIZEN_VAULT -> EvidenceVaultScreen(viewModel)
                            Routes.CITIZEN_HEALTH -> SystemHealthScreen(viewModel)
                            Routes.CITIZEN_CHAT -> CitizenChatScreen(viewModel)
                            Routes.CITIZEN_DIAGNOSTICS -> DiagnosticsScreen(viewModel)
                        }
                    }
                }
            }
        }

        // ---- Police module ----
        val policeRoutes = listOf(Routes.POLICE_HOME, Routes.POLICE_MAP, Routes.POLICE_TACTICAL, Routes.POLICE_CHAT)
        policeRoutes.forEach { route ->
            composable(route) {
                PoliceScaffold(navController, currentRoute) { padding ->
                    androidx.compose.foundation.layout.Box(androidx.compose.ui.Modifier.padding(padding)) {
                        when (route) {
                            Routes.POLICE_HOME -> PoliceDashboardScreen(viewModel = viewModel, onNavigateToChat = { navController.navigate(Routes.POLICE_CHAT) })
                            Routes.POLICE_MAP -> PoliceMapScreen(viewModel = viewModel, onNavigateToChat = { navController.navigate(Routes.POLICE_CHAT) })
                            Routes.POLICE_TACTICAL -> TacticalCommandScreen(viewModel = viewModel, onNavigateToChat = { navController.navigate(Routes.POLICE_CHAT) })
                            Routes.POLICE_CHAT -> PoliceChatScreen(viewModel)
                        }
                    }
                }
            }
        }

        // ---- Admin module ----
        val adminRoutes = mapOf(
            Routes.ADMIN_HOME to "Overwatch Home",
            Routes.ADMIN_ANALYTICS to "Analytics",
            Routes.ADMIN_USERS to "User Management",
            Routes.ADMIN_HEATMAP to "Incident Heatmap",
            Routes.ADMIN_SETTINGS to "System Settings"
        )
        adminRoutes.forEach { (route, title) ->
            composable(route) {
                AdminScaffold(navController, currentRoute) { padding ->
                    androidx.compose.foundation.layout.Box(androidx.compose.ui.Modifier.padding(padding)) {
                        if (route == Routes.ADMIN_HOME) AdminHomeScreen() else AdminPlaceholderScreen(title)
                    }
                }
            }
        }
    }
}

private fun homeRouteFor(role: String) = when (role) {
    "police" -> Routes.POLICE_HOME
    "admin" -> Routes.ADMIN_HOME
    else -> Routes.CITIZEN_HOME
}
