package com.streetsentinel.app.navigation

/** Mirrors the <Route> tree in web `src/App.jsx` 1:1 so the navigation shape matches. */
object Routes {
    // Auth (top-level, matches "/", "/onboarding", etc.)
    const val SPLASH = "splash"
    const val ONBOARDING = "onboarding"
    const val ROLE_SELECTION = "role-selection"
    const val AUTH_HOME = "auth-home"
    const val LOGIN = "login"
    const val SIGNUP = "signup"

    // Citizen ("/citizen/...")
    const val CITIZEN_HOME = "citizen/home"
    const val CITIZEN_SOS = "citizen/sos"
    const val CITIZEN_TRACKING = "citizen/tracking" // SafeWalk
    const val CITIZEN_ALERTS = "citizen/alerts"
    const val CITIZEN_CONTACTS = "citizen/contacts"
    const val CITIZEN_GUARDIANS = "citizen/guardians"
    const val CITIZEN_PROFILE = "citizen/profile"
    const val CITIZEN_SETTINGS = "citizen/settings"
    const val CITIZEN_VAULT = "citizen/vault" // EvidenceVault
    const val CITIZEN_HEALTH = "citizen/health" // SystemHealth
    const val CITIZEN_CHAT = "citizen/chat"
    const val CITIZEN_DIAGNOSTICS = "citizen/diagnostics"

    // Police ("/police/...")
    const val POLICE_HOME = "police/home" // PoliceDashboard
    const val POLICE_MAP = "police/map"
    const val POLICE_TACTICAL = "police/tactical"
    const val POLICE_CHAT = "police/chat"

    // Admin ("/admin/...")
    const val ADMIN_HOME = "admin/home"
    const val ADMIN_ANALYTICS = "admin/analytics"
    const val ADMIN_USERS = "admin/users"
    const val ADMIN_HEATMAP = "admin/heatmap"
    const val ADMIN_SETTINGS = "admin/settings"
}

enum class UserRole { CITIZEN, POLICE, ADMIN }
