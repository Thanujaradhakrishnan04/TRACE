package com.streetsentinel.app.services

import android.annotation.SuppressLint
import android.media.AudioFormat
import android.media.AudioRecord
import android.media.MediaRecorder
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import java.util.Calendar
import kotlin.math.log10
import kotlin.math.max
import kotlin.math.min
import kotlin.math.sqrt

/**
 * Native port of hooks/useAudioDetection.js. The web version uses the Web Audio API's
 * AnalyserNode to compute an RMS-derived dB value on a -100 (silence) to 0 (max) scale,
 * then compares against day/night thresholds to flag loud-noise spikes. This does the
 * same thing using AudioRecord's raw PCM samples.
 *
 * Distress-keyword speech recognition (the Web Speech API branch in the original hook)
 * is not ported here — that would map to Android's SpeechRecognizer API and is a
 * reasonable phase-3 addition, but is a separate, non-trivial subsystem on its own.
 */
data class AudioThreat(val type: String, val confidence: Double, val label: String)

class AudioDetectionService {
    companion object {
        private const val DAY_ABSOLUTE_THRESHOLD = -15.0
        private const val DAY_SPIKE_THRESHOLD = 25.0
        private const val NIGHT_ABSOLUTE_THRESHOLD = -20.0
        private const val NIGHT_SPIKE_THRESHOLD = 15.0
        private const val SAMPLE_RATE = 44100
    }

    private val _decibels = MutableStateFlow(-100.0)
    val decibels: StateFlow<Double> = _decibels

    private val _currentThreshold = MutableStateFlow(DAY_ABSOLUTE_THRESHOLD)
    val currentThreshold: StateFlow<Double> = _currentThreshold

    private val _threats = MutableSharedFlow<AudioThreat>(extraBufferCapacity = 4)
    val threats: SharedFlow<AudioThreat> = _threats

    private var job: Job? = null
    private var baselineDb = -50.0

    @SuppressLint("MissingPermission")
    fun start(scope: CoroutineScope) {
        stop()
        job = scope.launch(Dispatchers.Default) {
            val minBuf = AudioRecord.getMinBufferSize(SAMPLE_RATE, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT)
            if (minBuf <= 0) return@launch
            val recorder = try {
                AudioRecord(MediaRecorder.AudioSource.MIC, SAMPLE_RATE, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT, minBuf)
            } catch (e: Exception) { null } ?: return@launch

            if (recorder.state != AudioRecord.STATE_INITIALIZED) { recorder.release(); return@launch }
            recorder.startRecording()

            // Calibration: sample baseline ambient noise for ~2s (4 x 500ms), mirrors startCalibration()
            val buffer = ShortArray(minBuf)
            val calibSamples = mutableListOf<Double>()
            repeat(4) {
                if (!isActive) return@launch
                val read = recorder.read(buffer, 0, buffer.size)
                calibSamples.add(rmsToDb(buffer, read))
                kotlinx.coroutines.delay(500)
            }
            baselineDb = calibSamples.filter { it > -100 }.let { if (it.isEmpty()) -50.0 else it.average() }

            // Continuous loudness detection loop, mirrors detectLoudness()'s 150ms interval
            while (isActive) {
                val read = recorder.read(buffer, 0, buffer.size)
                var db = rmsToDb(buffer, read)
                db = db.coerceIn(-100.0, 0.0)
                _decibels.value = db

                val hour = Calendar.getInstance().get(Calendar.HOUR_OF_DAY)
                val isNight = hour >= 20 || hour < 6
                val absThreshold = if (isNight) NIGHT_ABSOLUTE_THRESHOLD else DAY_ABSOLUTE_THRESHOLD
                val spikeThreshold = if (isNight) NIGHT_SPIKE_THRESHOLD else DAY_SPIKE_THRESHOLD
                _currentThreshold.value = absThreshold

                val isLoudSpike = db > (baselineDb + spikeThreshold) || db > absThreshold
                if (isLoudSpike) {
                    val confidence = min((db - absThreshold) / 10 + 0.5, 0.9)
                    _threats.tryEmit(AudioThreat("LOUD_SOUND_SOS", confidence, "Loud Noise Spike Detected"))
                }
                kotlinx.coroutines.delay(150)
            }
            recorder.stop()
            recorder.release()
        }
    }

    fun stop() {
        job?.cancel()
        job = null
        _decibels.value = -100.0
    }

    /** Ports the RMS -> dB formula used identically in startCalibration()/detectLoudness() (128-centered, since Web Audio's getByteTimeDomainData is 0-255 centered at 128; here we normalize 16-bit PCM the same way). */
    private fun rmsToDb(buffer: ShortArray, samplesRead: Int): Double {
        if (samplesRead <= 0) return -100.0
        var sum = 0.0
        for (i in 0 until samplesRead) {
            val normalized = buffer[i] / 256.0 // scale 16-bit sample down to an 8-bit-equivalent range like the web version's Uint8 data
            sum += normalized * normalized
        }
        val rms = sqrt(sum / samplesRead)
        val db = 20 * log10(rms / 128.0)
        return if (db.isFinite()) db else -100.0
    }
}
