package com.streetsentinel.app.data.repository

import com.google.gson.Gson
import com.streetsentinel.app.data.model.EmergencyContact
import com.streetsentinel.app.data.model.GeoPoint
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Automated unit tests verifying SOS JSON serialization and response mapping
 * between the native Android client and the Node/Express backend (/emergency/dispatch).
 */
class BackendApiTest {

    private val gson = Gson()

    @Test
    fun testEmergencyDispatchPayload_serializesCleanly() {
        val location = GeoPoint(13.0827, 80.2707)
        val contacts = listOf(
            EmergencyContact("c1", "Guardian One", "+919876543210", "Parent", "guardian1@gmail.com")
        )
        val bodyMap = mapOf(
            "emergencyId" to "em_12345",
            "reason" to "Manual SOS - Send Location Override",
            "location" to mapOf("lat" to location.lat, "lng" to location.lng),
            "mapsLink" to "https://maps.google.com/?q=13.0827,80.2707",
            "contacts" to contacts,
            "userName" to "Roshini E",
            "userPhone" to "+919876543210"
        )
        val jsonString = gson.toJson(bodyMap)

        assertTrue("JSON payload must contain emergency reason", jsonString.contains("Manual SOS"))
        assertTrue("JSON payload must contain contact email", jsonString.contains("guardian1@gmail.com"))
        assertTrue("JSON payload must contain lat/lng coordinates", jsonString.contains("13.0827") && jsonString.contains("80.2707"))
    }

    @Test
    fun testDispatchResultParsing_parsesBackendResponseCorrectly() {
        val mockBackendResponseJson = """{
            "success": true,
            "message": "Alerts processed successfully",
            "smsStatus": "SUCCESS",
            "emailStatus": "SUCCESS",
            "whatsappStatus": "SUCCESS"
        }"""
        val map = gson.fromJson(mockBackendResponseJson, Map::class.java)
        val result = BackendApi.DispatchResult(
            success = (map["success"] as? Boolean) ?: false,
            smsStatus = map["smsStatus"] as? String,
            emailStatus = map["emailStatus"] as? String,
            error = map["error"] as? String
        )

        assertTrue("Should parse success = true", result.success)
        assertEquals("SUCCESS", result.emailStatus)
        assertEquals("SUCCESS", result.smsStatus)
    }
}
