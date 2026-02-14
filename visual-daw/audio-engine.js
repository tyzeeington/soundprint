/* ============================================
   SoundPrint Visual DAW - Audio Engine
   Web Audio API based synth engine with
   visual feedback hooks
   ============================================ */

class AudioEngine {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.analyser = null;
    this.compressor = null;
    this.activeNotes = new Map();
    this.effects = {
      reverb: null,
      delay: null,
      distortion: null,
      filter: null,
    };
    this.params = {
      reverb: 0.3,
      delay: 0.0,
      distortion: 0.0,
      filter: 1.0,
    };
    this.waveform = 'sine';
    this.isInitialized = false;

    // Frequency data buffers for visualization
    this.frequencyData = null;
    this.timeDomainData = null;
  }

  async init() {
    if (this.isInitialized) return;

    this.ctx = new (window.AudioContext || window.webkitAudioContext)();

    // Create master chain: source -> effects -> compressor -> analyser -> master gain -> destination
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0.7;

    this.compressor = this.ctx.createDynamicsCompressor();
    this.compressor.threshold.value = -24;
    this.compressor.knee.value = 30;
    this.compressor.ratio.value = 12;

    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 2048;
    this.analyser.smoothingTimeConstant = 0.8;

    // Setup frequency and time domain buffers
    this.frequencyData = new Uint8Array(this.analyser.frequencyBinCount);
    this.timeDomainData = new Uint8Array(this.analyser.fftSize);

    // Create effects
    await this._createEffects();

    // Connect chain
    this.effectsInput = this.ctx.createGain();
    this.effectsInput.connect(this.effects.filter);
    this.effects.filter.connect(this.effects.distortion || this.compressor);
    if (this.effects.distortion) {
      this.effects.distortion.connect(this.compressor);
    }
    this.compressor.connect(this.analyser);
    this.analyser.connect(this.masterGain);
    this.masterGain.connect(this.ctx.destination);

    // Dry send for reverb and delay (parallel effects)
    this.drySend = this.ctx.createGain();
    this.drySend.connect(this.compressor);

    this.isInitialized = true;
  }

  async _createEffects() {
    // Filter (low-pass)
    this.effects.filter = this.ctx.createBiquadFilter();
    this.effects.filter.type = 'lowpass';
    this.effects.filter.frequency.value = 20000;
    this.effects.filter.Q.value = 1;

    // Distortion (waveshaper)
    this.effects.distortion = this.ctx.createWaveShaper();
    this.effects.distortion.curve = this._makeDistortionCurve(0);
    this.effects.distortion.oversample = '4x';

    // Reverb (convolver with generated impulse)
    try {
      this.effects.reverb = this.ctx.createConvolver();
      this.effects.reverb.buffer = this._generateReverbImpulse(2, 2.5);
      this.reverbGain = this.ctx.createGain();
      this.reverbGain.gain.value = this.params.reverb;
      this.effects.reverb.connect(this.reverbGain);
      this.reverbGain.connect(this.compressor);
    } catch (e) {
      console.warn('Reverb not available:', e);
    }

    // Delay
    this.effects.delay = this.ctx.createDelay(2.0);
    this.effects.delay.delayTime.value = 0.35;
    this.delayFeedback = this.ctx.createGain();
    this.delayFeedback.gain.value = 0.3;
    this.delayGain = this.ctx.createGain();
    this.delayGain.gain.value = this.params.delay;
    this.effects.delay.connect(this.delayFeedback);
    this.delayFeedback.connect(this.effects.delay);
    this.effects.delay.connect(this.delayGain);
    this.delayGain.connect(this.compressor);
  }

  _generateReverbImpulse(duration, decay) {
    const length = this.ctx.sampleRate * duration;
    const impulse = this.ctx.createBuffer(2, length, this.ctx.sampleRate);
    for (let channel = 0; channel < 2; channel++) {
      const data = impulse.getChannelData(channel);
      for (let i = 0; i < length; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
      }
    }
    return impulse;
  }

  _makeDistortionCurve(amount) {
    const samples = 44100;
    const curve = new Float32Array(samples);
    const deg = Math.PI / 180;
    for (let i = 0; i < samples; i++) {
      const x = (i * 2) / samples - 1;
      if (amount === 0) {
        curve[i] = x;
      } else {
        curve[i] = ((3 + amount * 100) * x * 20 * deg) /
          (Math.PI + (amount * 100) * Math.abs(x));
      }
    }
    return curve;
  }

  setWaveform(type) {
    this.waveform = type;
  }

  setParam(param, value) {
    this.params[param] = value;

    if (!this.isInitialized) return;

    switch (param) {
      case 'reverb':
        if (this.reverbGain) this.reverbGain.gain.value = value;
        break;
      case 'delay':
        if (this.delayGain) this.delayGain.gain.value = value;
        break;
      case 'distortion':
        if (this.effects.distortion) {
          this.effects.distortion.curve = this._makeDistortionCurve(value);
        }
        break;
      case 'filter':
        if (this.effects.filter) {
          // Map 0-1 to 100Hz-20000Hz logarithmically
          const minFreq = 100;
          const maxFreq = 20000;
          const freq = minFreq * Math.pow(maxFreq / minFreq, value);
          this.effects.filter.frequency.setTargetAtTime(freq, this.ctx.currentTime, 0.01);
        }
        break;
    }
  }

  setMasterVolume(value) {
    if (this.masterGain) {
      this.masterGain.gain.setTargetAtTime(value, this.ctx.currentTime, 0.01);
    }
  }

  // Play a note - returns an ID to stop it later
  playNote(frequency, velocity = 0.8, duration = null) {
    if (!this.isInitialized) return null;

    const noteId = `${frequency}_${Date.now()}`;

    const osc = this.ctx.createOscillator();
    const noteGain = this.ctx.createGain();

    if (this.waveform === 'drums') {
      return this._playDrumHit(frequency, velocity);
    }

    if (this.waveform === 'noise') {
      return this._playNoise(velocity, duration);
    }

    osc.type = this.waveform;
    osc.frequency.value = frequency;

    // Envelope
    noteGain.gain.setValueAtTime(0, this.ctx.currentTime);
    noteGain.gain.linearRampToValueAtTime(velocity * 0.5, this.ctx.currentTime + 0.02);

    osc.connect(noteGain);
    noteGain.connect(this.effectsInput);

    // Send to reverb and delay
    if (this.effects.reverb && this.reverbGain) {
      noteGain.connect(this.effects.reverb);
    }
    if (this.effects.delay && this.delayGain) {
      noteGain.connect(this.effects.delay);
    }

    osc.start();

    if (duration) {
      noteGain.gain.setValueAtTime(velocity * 0.5, this.ctx.currentTime + duration - 0.05);
      noteGain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + duration);
      osc.stop(this.ctx.currentTime + duration + 0.1);
    }

    this.activeNotes.set(noteId, { osc, gain: noteGain });
    return noteId;
  }

  _playDrumHit(frequency, velocity) {
    const noteId = `drum_${Date.now()}`;

    // Drum synthesis using frequency to determine type
    const osc = this.ctx.createOscillator();
    const noteGain = this.ctx.createGain();
    const now = this.ctx.currentTime;

    if (frequency < 200) {
      // Kick drum
      osc.type = 'sine';
      osc.frequency.setValueAtTime(150, now);
      osc.frequency.exponentialRampToValueAtTime(40, now + 0.15);
      noteGain.gain.setValueAtTime(velocity * 0.8, now);
      noteGain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
      osc.connect(noteGain);
      noteGain.connect(this.effectsInput);
      osc.start(now);
      osc.stop(now + 0.5);
    } else if (frequency < 500) {
      // Snare
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(200, now);
      osc.frequency.exponentialRampToValueAtTime(100, now + 0.1);
      noteGain.gain.setValueAtTime(velocity * 0.6, now);
      noteGain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

      // Noise component for snare
      const noiseBuffer = this.ctx.createBuffer(1, this.ctx.sampleRate * 0.2, this.ctx.sampleRate);
      const noiseData = noiseBuffer.getChannelData(0);
      for (let i = 0; i < noiseData.length; i++) {
        noiseData[i] = Math.random() * 2 - 1;
      }
      const noiseSource = this.ctx.createBufferSource();
      noiseSource.buffer = noiseBuffer;
      const noiseGain = this.ctx.createGain();
      noiseGain.gain.setValueAtTime(velocity * 0.4, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
      const noiseFilter = this.ctx.createBiquadFilter();
      noiseFilter.type = 'highpass';
      noiseFilter.frequency.value = 1000;
      noiseSource.connect(noiseFilter);
      noiseFilter.connect(noiseGain);
      noiseGain.connect(this.effectsInput);
      noiseSource.start(now);

      osc.connect(noteGain);
      noteGain.connect(this.effectsInput);
      osc.start(now);
      osc.stop(now + 0.3);
    } else {
      // Hi-hat
      const noiseBuffer = this.ctx.createBuffer(1, this.ctx.sampleRate * 0.1, this.ctx.sampleRate);
      const noiseData = noiseBuffer.getChannelData(0);
      for (let i = 0; i < noiseData.length; i++) {
        noiseData[i] = Math.random() * 2 - 1;
      }
      const noiseSource = this.ctx.createBufferSource();
      noiseSource.buffer = noiseBuffer;
      const hihatFilter = this.ctx.createBiquadFilter();
      hihatFilter.type = 'highpass';
      hihatFilter.frequency.value = 5000;
      noteGain.gain.setValueAtTime(velocity * 0.3, now);
      noteGain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
      noiseSource.connect(hihatFilter);
      hihatFilter.connect(noteGain);
      noteGain.connect(this.effectsInput);
      noiseSource.start(now);
      // No oscillator needed for hi-hat
      this.activeNotes.set(noteId, { osc: noiseSource, gain: noteGain });
      return noteId;
    }

    this.activeNotes.set(noteId, { osc, gain: noteGain });
    return noteId;
  }

  _playNoise(velocity, duration) {
    const noteId = `noise_${Date.now()}`;
    const bufferSize = this.ctx.sampleRate * (duration || 0.5);
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(velocity * 0.3, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + (duration || 0.5));
    source.connect(gain);
    gain.connect(this.effectsInput);
    source.start();
    this.activeNotes.set(noteId, { osc: source, gain });
    return noteId;
  }

  stopNote(noteId) {
    const note = this.activeNotes.get(noteId);
    if (note) {
      try {
        note.gain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.05);
        setTimeout(() => {
          try { note.osc.stop(); } catch (e) { /* already stopped */ }
          this.activeNotes.delete(noteId);
        }, 200);
      } catch (e) {
        this.activeNotes.delete(noteId);
      }
    }
  }

  stopAllNotes() {
    for (const [id] of this.activeNotes) {
      this.stopNote(id);
    }
  }

  // Get analysis data for visualizations
  getFrequencyData() {
    if (!this.analyser) return new Uint8Array(0);
    this.analyser.getByteFrequencyData(this.frequencyData);
    return this.frequencyData;
  }

  getTimeDomainData() {
    if (!this.analyser) return new Uint8Array(0);
    this.analyser.getByteTimeDomainData(this.timeDomainData);
    return this.timeDomainData;
  }

  // Get energy in frequency bands for haptic display
  getBandEnergy() {
    const freq = this.getFrequencyData();
    if (!freq.length) return { bass: 0, mid: 0, high: 0 };

    const binCount = freq.length;
    let bass = 0, mid = 0, high = 0;
    const bassEnd = Math.floor(binCount * 0.1);    // ~0-2kHz
    const midEnd = Math.floor(binCount * 0.4);     // ~2kHz-8kHz

    for (let i = 0; i < bassEnd; i++) bass += freq[i];
    for (let i = bassEnd; i < midEnd; i++) mid += freq[i];
    for (let i = midEnd; i < binCount; i++) high += freq[i];

    bass = bass / (bassEnd * 255);
    mid = mid / ((midEnd - bassEnd) * 255);
    high = high / ((binCount - midEnd) * 255);

    return { bass, mid, high };
  }

  // Frequency to color mapping for visual representation
  static frequencyToColor(frequency) {
    // Map frequency (20Hz - 20kHz) to hue (0-360)
    const minFreq = 20;
    const maxFreq = 20000;
    const logMin = Math.log2(minFreq);
    const logMax = Math.log2(maxFreq);
    const logFreq = Math.log2(Math.max(minFreq, Math.min(maxFreq, frequency)));
    const normalized = (logFreq - logMin) / (logMax - logMin);

    // Color mapping: bass=red, low-mid=orange, mid=yellow, high-mid=green, high=blue, ultra=purple
    const hue = normalized * 300; // Red through purple
    return `hsl(${hue}, 85%, 60%)`;
  }

  static noteToFrequency(note, octave) {
    const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const semitone = notes.indexOf(note);
    if (semitone === -1) return 440;
    return 440 * Math.pow(2, (semitone - 9 + (octave - 4) * 12) / 12);
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') {
      return this.ctx.resume();
    }
  }
}

// Export
window.AudioEngine = AudioEngine;
