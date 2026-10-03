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
    this.drumStyle = 'house'; // 'house' | 'dnb' | 'downtempo'
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

    // Connect chain. Two parallel entry points share the same downstream FX:
    //   effectsInput  -> filter (kicks bypass the sidechain duck)
    //   duckBus       -> filter (everything else; gain modulated by sidechain)
    this.effectsInput = this.ctx.createGain();
    this.effectsInput.connect(this.effects.filter);

    this.duckBus = this.ctx.createGain();
    this.duckBus.gain.value = 1;
    this.duckBus.connect(this.effects.filter);

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

  // Sidechain ducking — kick triggers, everything on duckBus dips briefly.
  _triggerSidechain(velocity = 1) {
    if (!this.duckBus) return;
    const cfg = ({
      house:     { depth: 0.35, recovery: 0.22 }, // strong four-on-floor pump
      dnb:       { depth: 0.65, recovery: 0.10 }, // lighter, faster
      downtempo: { depth: 0.85, recovery: 0.15 }, // subtle
    }[this.drumStyle]) || { depth: 1.0, recovery: 0.05 };

    if (cfg.depth >= 1) return;
    const now = this.ctx.currentTime;
    const v = Math.max(0.4, Math.min(1, velocity));
    // Velocity scales how deeply we duck (softer kicks pump less).
    const minDuck = cfg.depth + (1 - cfg.depth) * (1 - v) * 0.4;

    this.duckBus.gain.cancelScheduledValues(now);
    this.duckBus.gain.setValueAtTime(this.duckBus.gain.value, now);
    this.duckBus.gain.linearRampToValueAtTime(minDuck, now + 0.006);
    this.duckBus.gain.linearRampToValueAtTime(1, now + cfg.recovery);
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

  setDrumStyle(style) {
    this.drumStyle = style;
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

    if (this.waveform === 'drums') return this._playDrumHit(frequency, velocity);
    if (this.waveform === 'noise') return this._playNoise(velocity, duration);

    // Plugin-emulation tonal voices (M1 stab, Juno pad, TB-303, Reese, Rhodes, etc.)
    const customVoice = this._findCustomVoice(this.waveform);
    if (customVoice) {
      try { return customVoice(this, frequency, velocity, duration); }
      catch (e) { console.warn(`Voice ${this.waveform} failed:`, e); }
    }

    if (this.waveform === 'reese') return this._playReese(frequency, velocity, duration);
    if (this.waveform === 'sub')   return this._playSub(frequency, velocity, duration);

    const noteId = `${frequency}_${Date.now()}_${Math.random()}`;
    const osc = this.ctx.createOscillator();
    const noteGain = this.ctx.createGain();
    const now = this.ctx.currentTime;

    // Guard: if waveform is a custom voice name but the module hasn't loaded,
    // fall back to sawtooth instead of crashing OscillatorNode.type.
    const validBasic = ['sine', 'square', 'sawtooth', 'triangle'];
    osc.type = validBasic.includes(this.waveform) ? this.waveform : 'sawtooth';
    osc.frequency.value = frequency;

    // Per-waveform ADSR envelope
    const env = this._envelopeFor(this.waveform);
    const dur = duration || 0.5;
    const peak = velocity * 0.55;
    const sustain = peak * env.sustain;

    noteGain.gain.setValueAtTime(0, now);
    noteGain.gain.linearRampToValueAtTime(peak, now + env.attack);
    noteGain.gain.linearRampToValueAtTime(sustain, now + env.attack + env.decay);

    const releaseStart = Math.max(now + env.attack + env.decay, now + dur - env.release);
    noteGain.gain.setValueAtTime(sustain, releaseStart);
    noteGain.gain.exponentialRampToValueAtTime(0.001, releaseStart + env.release);

    osc.connect(noteGain);
    // Tonal voices route through duckBus so they're sidechained by the kick.
    noteGain.connect(this.duckBus || this.effectsInput);
    if (this.effects.reverb && this.reverbGain) noteGain.connect(this.effects.reverb);
    if (this.effects.delay && this.delayGain) noteGain.connect(this.effects.delay);

    osc.start(now);
    osc.stop(releaseStart + env.release + 0.05);

    this.activeNotes.set(noteId, { osc, gain: noteGain });
    return noteId;
  }

  _envelopeFor(waveform) {
    const env = {
      sine:     { attack: 0.06, decay: 0.10, sustain: 0.85, release: 0.30 }, // pad-like
      triangle: { attack: 0.02, decay: 0.10, sustain: 0.75, release: 0.18 }, // bell/keys
      square:   { attack: 0.005, decay: 0.06, sustain: 0.55, release: 0.10 }, // lead
      sawtooth: { attack: 0.005, decay: 0.08, sustain: 0.45, release: 0.08 }, // bass
    };
    return env[waveform] || env.sine;
  }

  _playReese(frequency, velocity, duration) {
    const now = this.ctx.currentTime;
    const id = `reese_${frequency}_${Date.now()}_${Math.random()}`;
    const dur = duration || 0.5;

    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const osc3 = this.ctx.createOscillator();
    osc1.type = 'sawtooth'; osc2.type = 'sawtooth'; osc3.type = 'square';
    osc1.frequency.value = frequency;
    osc2.frequency.value = frequency;
    osc3.frequency.value = frequency * 0.5; // sub-octave fundamental
    osc1.detune.value = -9;
    osc2.detune.value = +11;

    // LFO on detune for the reese growl
    const lfo = this.ctx.createOscillator();
    const lfoGain = this.ctx.createGain();
    lfo.frequency.value = 5.2;
    lfoGain.gain.value = 7;
    lfo.connect(lfoGain);
    lfoGain.connect(osc1.detune);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.Q.value = 5;
    filter.frequency.setValueAtTime(180, now);
    filter.frequency.exponentialRampToValueAtTime(1400, now + Math.min(0.08, dur * 0.2));
    filter.frequency.exponentialRampToValueAtTime(700, now + Math.min(dur, 0.6));

    const drive = this.ctx.createWaveShaper();
    drive.curve = this._makeDistortionCurve(0.18);
    drive.oversample = '2x';

    const gain = this.ctx.createGain();
    const peak = velocity * 0.5;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(peak, now + 0.008);
    gain.gain.setValueAtTime(peak, Math.max(now + 0.01, now + dur - 0.06));
    gain.gain.exponentialRampToValueAtTime(0.001, now + dur);

    osc1.connect(filter);
    osc2.connect(filter);
    osc3.connect(filter);
    filter.connect(drive);
    drive.connect(gain);
    gain.connect(this.duckBus || this.effectsInput);
    if (this.effects.reverb && this.reverbGain) gain.connect(this.effects.reverb);

    const stopAt = now + dur + 0.1;
    osc1.start(now); osc2.start(now); osc3.start(now); lfo.start(now);
    osc1.stop(stopAt); osc2.stop(stopAt); osc3.stop(stopAt); lfo.stop(stopAt);

    this.activeNotes.set(id, { osc: osc1, gain });
    return id;
  }

  _playSub(frequency, velocity, duration) {
    const now = this.ctx.currentTime;
    const id = `sub_${frequency}_${Date.now()}_${Math.random()}`;
    const dur = duration || 0.5;
    // Drop an octave for true sub feel.
    const subFreq = frequency * 0.5;

    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = subFreq;

    // Faint harmonic for definition
    const harm = this.ctx.createOscillator();
    harm.type = 'sine';
    harm.frequency.value = subFreq * 2;
    const harmGain = this.ctx.createGain();
    harmGain.gain.value = 0.12;

    const drive = this.ctx.createWaveShaper();
    drive.curve = this._makeDistortionCurve(0.05);

    const gain = this.ctx.createGain();
    const peak = velocity * 0.7;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(peak, now + 0.012);
    gain.gain.setValueAtTime(peak, Math.max(now + 0.02, now + dur - 0.08));
    gain.gain.exponentialRampToValueAtTime(0.001, now + dur);

    osc.connect(drive);
    harm.connect(harmGain);
    harmGain.connect(drive);
    drive.connect(gain);
    gain.connect(this.duckBus || this.effectsInput);

    const stopAt = now + dur + 0.1;
    osc.start(now); harm.start(now);
    osc.stop(stopAt); harm.stop(stopAt);

    this.activeNotes.set(id, { osc, gain });
    return id;
  }

  // Frequency boundaries select which drum voice to fire. Locked C-pentatonic
  // rows map cleanly to 8 distinct voices:
  //   C3=131 -> kick, C4=262 -> snare, E4=330 -> clap, A4=440 -> rim,
  //   C5=523 -> closed hat, D5=587 -> open hat, G5=784 -> ride, A5=880 -> shaker.
  _drumVoiceFor(frequency) {
    if (frequency < 200) return 'kick';
    if (frequency < 310) return 'snare';
    if (frequency < 380) return 'clap';
    if (frequency < 475) return 'rim';
    if (frequency < 555) return 'hatClosed';
    if (frequency < 700) return 'hatOpen';
    if (frequency < 820) return 'ride';
    return 'shaker';
  }

  _drumVoiceModule() {
    const map = { house: 'HouseVoices', dnb: 'DnbVoices', downtempo: 'DowntempoVoices' };
    return window[map[this.drumStyle]] || null;
  }

  _playDrumHit(frequency, velocity) {
    const style = this.drumStyle || 'house';
    const voiceName = this._drumVoiceFor(frequency);
    if (voiceName === 'kick') this._triggerSidechain(velocity);

    // Prefer plugin-emulation voice module if loaded
    const mod = this._drumVoiceModule();
    if (mod && typeof mod[voiceName] === 'function') {
      try { return mod[voiceName](this, velocity); }
      catch (e) { console.warn(`Voice ${voiceName} failed, falling back:`, e); }
    }

    // Fallback to internal synthesis
    switch (voiceName) {
      case 'kick':      return this._kick(style, velocity);
      case 'snare':     return this._snare(style, velocity);
      case 'clap':      return this._clap(style, velocity);
      case 'rim':       return this._rim(style, velocity);
      case 'hatClosed': return this._hat(style, velocity, false);
      case 'hatOpen':   return this._hat(style, velocity, true);
      case 'ride':      return this._ride(style, velocity);
      case 'shaker':    return this._shaker(style, velocity);
    }
    return null;
  }

  // Tonal voice lookup across loaded voice modules (m1Stab, junoPad, acid303,
  // reese, growl, dnbLead, rhodes, wurli, mellotronStrings, mellotronFlute, etc.)
  _findCustomVoice(name) {
    if (['sine', 'square', 'sawtooth', 'triangle', 'drums', 'noise', 'reese', 'sub'].includes(name)) return null;
    const drumNames = ['kick', 'snare', 'snareGhost', 'snareBrush', 'clap', 'rim', 'hatClosed', 'hatOpen', 'ride', 'shaker'];
    if (drumNames.includes(name)) return null;
    for (const mod of [window.HouseVoices, window.DnbVoices, window.DowntempoVoices]) {
      if (mod && typeof mod[name] === 'function') return mod[name];
    }
    return null;
  }

  _whiteNoiseBuffer(seconds) {
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * seconds));
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  _trackVoice(id, gain) {
    this.activeNotes.set(id, { osc: { stop() {} }, gain });
    return id;
  }

  _kick(style, velocity) {
    const now = this.ctx.currentTime;
    const cfg = ({
      house:     { startF: 130, endF: 38, decay: 0.36, click: 0.55, attackF: 0.10, sub: 0.50 },
      dnb:       { startF: 180, endF: 32, decay: 0.22, click: 0.85, attackF: 0.07, sub: 0.65 },
      downtempo: { startF: 110, endF: 42, decay: 0.50, click: 0.30, attackF: 0.14, sub: 0.20 },
    }[style]) || {};

    // Body: pitched sine with rapid pitch drop
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(cfg.startF, now);
    osc.frequency.exponentialRampToValueAtTime(cfg.endF, now + cfg.attackF);
    const bodyGain = this.ctx.createGain();
    bodyGain.gain.setValueAtTime(0, now);
    bodyGain.gain.linearRampToValueAtTime(velocity * 0.95, now + 0.003);
    bodyGain.gain.exponentialRampToValueAtTime(0.001, now + cfg.decay);
    osc.connect(bodyGain);
    bodyGain.connect(this.effectsInput);
    osc.start(now);
    osc.stop(now + cfg.decay + 0.05);

    // Click: short HP-filtered noise burst for attack transient
    if (cfg.click > 0) {
      const len = 0.014;
      const noise = this.ctx.createBufferSource();
      noise.buffer = this._whiteNoiseBuffer(len);
      const hp = this.ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 1500;
      const cg = this.ctx.createGain();
      cg.gain.setValueAtTime(velocity * cfg.click * 0.45, now);
      cg.gain.exponentialRampToValueAtTime(0.001, now + len);
      noise.connect(hp); hp.connect(cg); cg.connect(this.effectsInput);
      noise.start(now);
    }

    // Sub layer for weight
    if (cfg.sub > 0) {
      const sub = this.ctx.createOscillator();
      sub.type = 'sine';
      sub.frequency.value = 50;
      const sg = this.ctx.createGain();
      sg.gain.setValueAtTime(0, now);
      sg.gain.linearRampToValueAtTime(velocity * cfg.sub, now + 0.012);
      sg.gain.exponentialRampToValueAtTime(0.001, now + cfg.decay * 1.4);
      sub.connect(sg); sg.connect(this.effectsInput);
      sub.start(now); sub.stop(now + cfg.decay * 1.5 + 0.05);
    }

    return this._trackVoice(`kick_${Date.now()}_${Math.random()}`, bodyGain);
  }

  _snare(style, velocity) {
    const now = this.ctx.currentTime;
    const cfg = ({
      house:     { tonalF: 200, tonalDecay: 0.08, noiseDecay: 0.16, hp: 1500, bpF: 3000, mix: 0.55 },
      dnb:       { tonalF: 240, tonalDecay: 0.06, noiseDecay: 0.13, hp: 1900, bpF: 3400, mix: 0.65 },
      downtempo: { tonalF: 180, tonalDecay: 0.10, noiseDecay: 0.22, hp: 1100, bpF: 2200, mix: 0.40 },
    }[style]) || {};

    // Tonal element
    const osc = this.ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(cfg.tonalF, now);
    osc.frequency.exponentialRampToValueAtTime(cfg.tonalF * 0.6, now + cfg.tonalDecay);
    const tg = this.ctx.createGain();
    tg.gain.setValueAtTime(velocity * 0.4 * (1 - cfg.mix * 0.5), now);
    tg.gain.exponentialRampToValueAtTime(0.001, now + cfg.tonalDecay);
    osc.connect(tg); tg.connect(this.effectsInput);
    osc.start(now); osc.stop(now + cfg.tonalDecay + 0.02);

    // Noise element through bandpass + highpass
    const noise = this.ctx.createBufferSource();
    noise.buffer = this._whiteNoiseBuffer(cfg.noiseDecay);
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = cfg.bpF; bp.Q.value = 0.7;
    const hp = this.ctx.createBiquadFilter();
    hp.type = 'highpass'; hp.frequency.value = cfg.hp;
    const ng = this.ctx.createGain();
    ng.gain.setValueAtTime(velocity * 0.55 * cfg.mix, now);
    ng.gain.exponentialRampToValueAtTime(0.001, now + cfg.noiseDecay);
    noise.connect(bp); bp.connect(hp); hp.connect(ng); ng.connect(this.effectsInput);
    noise.start(now);

    return this._trackVoice(`snare_${Date.now()}_${Math.random()}`, tg);
  }

  _clap(style, velocity) {
    const now = this.ctx.currentTime;
    const decay = style === 'downtempo' ? 0.24 : style === 'dnb' ? 0.16 : 0.20;
    const out = this.ctx.createGain();
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = style === 'dnb' ? 1600 : 1300;
    bp.Q.value = 0.55;
    bp.connect(out);
    out.connect(this.effectsInput);

    // Three rapid taps + one longer body tail
    const offsets = [0, 0.011, 0.023, 0.04];
    offsets.forEach((off, i) => {
      const isBody = i === offsets.length - 1;
      const tapDecay = isBody ? decay : 0.018;
      const noise = this.ctx.createBufferSource();
      noise.buffer = this._whiteNoiseBuffer(tapDecay + 0.01);
      const g = this.ctx.createGain();
      const t0 = now + off;
      const peak = velocity * (isBody ? 0.55 : 0.7);
      g.gain.setValueAtTime(peak, t0);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + tapDecay);
      noise.connect(g); g.connect(bp);
      noise.start(t0);
    });

    out.gain.value = 0.75;
    return this._trackVoice(`clap_${Date.now()}_${Math.random()}`, out);
  }

  _rim(style, velocity) {
    const now = this.ctx.currentTime;
    // Rim: short blip + tonal click
    const osc = this.ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.value = style === 'dnb' ? 1100 : 880;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = 1500; bp.Q.value = 4;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(velocity * 0.5, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
    osc.connect(bp); bp.connect(g); g.connect(this.effectsInput);
    osc.start(now); osc.stop(now + 0.06);
    return this._trackVoice(`rim_${Date.now()}_${Math.random()}`, g);
  }

  _hat(style, velocity, open) {
    const now = this.ctx.currentTime;
    const decay = open
      ? (style === 'dnb' ? 0.30 : style === 'downtempo' ? 0.50 : 0.42)
      : (style === 'dnb' ? 0.04 : style === 'downtempo' ? 0.08 : 0.06);

    // 808-style metallic: 6 squares at non-harmonic ratios, summed and HP-filtered
    const ratios = [2.0, 3.0, 4.16, 5.43, 6.79, 8.21];
    const baseFreq = 320;
    const mix = this.ctx.createGain();
    mix.gain.value = 1 / ratios.length;
    const stops = [];
    ratios.forEach((r) => {
      const o = this.ctx.createOscillator();
      o.type = 'square';
      o.frequency.value = baseFreq * r;
      o.connect(mix);
      o.start(now);
      o.stop(now + decay + 0.03);
      stops.push(o);
    });

    const hp = this.ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = open ? 6500 : 7800;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 9000;
    bp.Q.value = 0.4;

    const out = this.ctx.createGain();
    out.gain.setValueAtTime(velocity * (open ? 0.22 : 0.25), now);
    out.gain.exponentialRampToValueAtTime(0.001, now + decay);

    mix.connect(hp); hp.connect(bp); bp.connect(out);
    out.connect(this.effectsInput);

    return this._trackVoice(`hat_${Date.now()}_${Math.random()}`, out);
  }

  _ride(style, velocity) {
    const now = this.ctx.currentTime;
    const decay = style === 'dnb' ? 0.55 : 0.85;
    // Bell + shimmer: square stack + bandpass
    const ratios = [3.0, 4.45, 5.92, 7.31];
    const baseFreq = 280;
    const mix = this.ctx.createGain();
    mix.gain.value = 1 / ratios.length;
    ratios.forEach((r) => {
      const o = this.ctx.createOscillator();
      o.type = 'square';
      o.frequency.value = baseFreq * r;
      o.connect(mix);
      o.start(now);
      o.stop(now + decay + 0.05);
    });
    const hp = this.ctx.createBiquadFilter();
    hp.type = 'highpass'; hp.frequency.value = 4500;
    const out = this.ctx.createGain();
    out.gain.setValueAtTime(velocity * 0.18, now);
    out.gain.exponentialRampToValueAtTime(0.001, now + decay);
    mix.connect(hp); hp.connect(out); out.connect(this.effectsInput);
    return this._trackVoice(`ride_${Date.now()}_${Math.random()}`, out);
  }

  _shaker(style, velocity) {
    const now = this.ctx.currentTime;
    const decay = 0.10;
    const noise = this.ctx.createBufferSource();
    noise.buffer = this._whiteNoiseBuffer(decay);
    const hp = this.ctx.createBiquadFilter();
    hp.type = 'highpass'; hp.frequency.value = 5500;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = 7500; bp.Q.value = 0.6;
    const g = this.ctx.createGain();
    // soft attack so it sounds more like a shake than a snap
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(velocity * 0.22, now + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, now + decay);
    noise.connect(hp); hp.connect(bp); bp.connect(g); g.connect(this.effectsInput);
    noise.start(now);
    return this._trackVoice(`shaker_${Date.now()}_${Math.random()}`, g);
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
