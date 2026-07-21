package com.streetsentinel.app

import android.Manifest
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.viewModels
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import com.google.accompanist.permissions.ExperimentalPermissionsApi
import com.google.accompanist.permissions.isGranted
import com.google.accompanist.permissions.rememberMultiplePermissionsState
import com.streetsentinel.app.navigation.SentinelNavGraph
import com.streetsentinel.app.theme.StreetSentinelTheme
import com.streetsentinel.app.ui.components.EmergencyOverlay
import com.streetsentinel.app.viewmodel.SentinelViewModel

/**
 * Equivalent of `main.jsx`'s createRoot(...).render(<App/>) — the single Activity
 * hosting the whole Compose navigation graph (index.html + App.jsx combined).
 */
class MainActivity : ComponentActivity() {

    private val viewModel: SentinelViewModel by viewModels()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            StreetSentinelTheme {
                Surface(modifier = Modifier.fillMaxSize()) {
                    RequestRuntimePermissions(viewModel)
                    androidx.compose.foundation.layout.Box(Modifier.fillMaxSize()) {
                        SentinelNavGraph(viewModel = viewModel)
                        // Global overlay — mirrors <EmergencyOverlay/> being mounted at the
                        // App.jsx level in the web app, so it renders over ANY screen the
                        // moment triggerEmergency()/sendEmergencyAlert() fires.
                        EmergencyOverlay(viewModel = viewModel)
                    }
                }
            }
        }
    }
}

/** Equivalent of the browser's permission prompts for geolocation/microphone/camera/notifications. */
@OptIn(ExperimentalPermissionsApi::class)
@Composable
private fun RequestRuntimePermissions(viewModel: SentinelViewModel) {
    val permissionsState = rememberMultiplePermissionsState(
        permissions = listOf(
            Manifest.permission.ACCESS_COARSE_LOCATION,
            Manifest.permission.ACCESS_FINE_LOCATION,
            Manifest.permission.RECORD_AUDIO,
            Manifest.permission.CAMERA,
            Manifest.permission.POST_NOTIFICATIONS
        )
    )
    androidx.compose.runtime.LaunchedEffect(Unit) {
        if (!permissionsState.allPermissionsGranted) {
            permissionsState.launchMultiplePermissionRequest()
        }
    }
    // Bug fix: the ViewModel starts watching location in init{} — before this permission
    // request even runs — so on a fresh install the very first location watch attempt throws
    // SecurityException and gives up. Once permissions are actually granted, restart it.
    // Key on the boolean directly so it fires exactly when false→true transition happens.
    val locationGranted = permissionsState.permissions.any {
        (it.permission == Manifest.permission.ACCESS_FINE_LOCATION ||
         it.permission == Manifest.permission.ACCESS_COARSE_LOCATION) && it.status.isGranted
    }
    androidx.compose.runtime.LaunchedEffect(locationGranted) {
        if (locationGranted) viewModel.startLocationTracking()
    }
}
