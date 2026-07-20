package com.streetsentinel.app.services

import android.content.Context
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow

/**
 * Native port of hooks/useMotionDetection.js: 3 hard shakes within a 2-second window
 * triggers a shake-SOS callback, matching the web version's DeviceMotionEvent listener.
 */
class MotionDetectionService(private val context: Context) {
    companion object { private const val SHAKE_THRESHOLD = 800.0 }

    /** Emits Unit each time a shake-SOS pattern (3 shakes in 2s) is detected. */
    fun shakeEvents(): Flow<Unit> = callbackFlow {
        val sensorManager = context.getSystemService(Context.SENSOR_SERVICE) as SensorManager
        val accelerometer = sensorManager.getDefaultSensor(Sensor.TYPE_ACCELEROMETER)
        if (accelerometer == null) { close(); return@callbackFlow }

        var lastX: Float? = null
        var lastY: Float? = null
        var lastZ: Float? = null
        var lastUpdate = 0L
        var shakeCount = 0
        var lastShakeTime = 0L

        val listener = object : SensorEventListener {
            override fun onSensorChanged(event: SensorEvent) {
                val now = System.currentTimeMillis()
                if (now - lastUpdate > 100) {
                    val diffTime = (now - lastUpdate).coerceAtLeast(1)
                    lastUpdate = now
                    val x = event.values[0]; val y = event.values[1]; val z = event.values[2]
                    if (lastX != null && lastY != null && lastZ != null) {
                        val speed = kotlin.math.abs(x + y + z - lastX!! - lastY!! - lastZ!!) / diffTime * 10000
                        if (speed > SHAKE_THRESHOLD) {
                            if (now - lastShakeTime > 2000) shakeCount = 0
                            shakeCount += 1
                            lastShakeTime = now
                            if (shakeCount >= 3) {
                                shakeCount = 0
                                trySend(Unit)
                            }
                        }
                    }
                    lastX = x; lastY = y; lastZ = z
                }
            }
            override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) {}
        }

        sensorManager.registerListener(listener, accelerometer, SensorManager.SENSOR_DELAY_GAME)
        awaitClose { sensorManager.unregisterListener(listener) }
    }
}
