/* ============================================
   SoundPrint Visual DAW — DRUM & BASS Voices
   Drop-in voice module attached as window.DnbVoices.

   Synthesis references (lineage / inspiration):
     - Origin Unknown "Valley of the Shadows" (1993)        -> tight kick, Amen-flavored snare
     - Goldie "Inner City Life" / "Timeless" (1995)         -> liquid pads, rolling sub-bass
     - LTJ Bukem / Good Looking catalog                     -> lush detuned saw leads, atmospheric reverb
     - Pendulum / Noisia / Black Sun Empire                 -> neuro growl, heavy drive, resonant LFOs
     - Kevin Saunderson "Just Want Another Chance" (1987)   -> the original REESE bass on Casio CZ-5000
                                                                 (dual detuned saws, beating overtones)
     - Ed Rush & Optical / Virus Recordings                 -> the Reese as D&B tearout staple
     - Native Instruments Massive lineage                   -> wobble / growl filter automation

   All non-kick voices route through engine.duckBus (sidechain target).
   The kick connects directly to engine.effectsInput so it is the sidechain driver.
   ============================================ */

(function () {
  'use strict';

  function _bus(engine) {
    return engine.duckBus || engine.effectsInput;
  }

  function _id(name) {
    return `dnb_${name}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }

  function _track(engine, id, osc, gain) {
    engine.activeNotes.set(id, { osc: osc || { stop() {} }, gain });
    return id;
  }

  window.DnbVoices = {

    // ============================================================
    // KICK — tighter than house. Drives the sidechain.
    // ============================================================
    kick(engine, velocity) {
      const ctx = engine.ctx;
      const now = ctx.currentTime;
      const v = (velocity == null ? 0.9 : velocity);
      const id = _id('kick');

      // Body: pitched sine, 150 Hz -> 40 Hz over ~30 ms, decay ~200 ms
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(150, now);
      osc.frequency.exponentialRampToValueAtTime(40, now + 0.03);

      const bodyGain = ctx.createGain();
      bodyGain.gain.setValueAtTime(0, now);
      bodyGain.gain.linearRampToValueAtTime(v * 0.95, now + 0.003);
      bodyGain.gain.exponentialRampToValueAtTime(0.001, now + 0.20);

      osc.connect(bodyGain);
      bodyGain.connect(engine.effectsInput); // KICK -> direct, drives sidechain

      osc.start(now);
      osc.stop(now + 0.20 + 0.10);

      // Click transient: HP noise ~1.8 kHz, very short, velocity-sensitive
      const clickLen = 0.012;
      const noise = ctx.createBufferSource();
      noise.buffer = engine._whiteNoiseBuffer(clickLen + 0.005);
      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 1800;
      const cg = ctx.createGain();
      // Strong velocity sensitivity on the click: scale^2
      const clickAmp = Math.pow(v, 2) * 0.85;
      cg.gain.setValueAtTime(clickAmp, now);
      cg.gain.exponentialRampToValueAtTime(0.001, now + clickLen);
      noise.connect(hp); hp.connect(cg); cg.connect(engine.effectsInput);
      noise.start(now);
      noise.stop(now + clickLen + 0.05);

      // Sub layer: 50 Hz sine, ~150 ms decay
      const sub = ctx.createOscillator();
      sub.type = 'sine';
      sub.frequency.value = 50;
      const sg = ctx.createGain();
      sg.gain.setValueAtTime(0, now);
      sg.gain.linearRampToValueAtTime(v * 0.7, now + 0.010);
      sg.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
      sub.connect(sg); sg.connect(engine.effectsInput);
      sub.start(now);
      sub.stop(now + 0.15 + 0.10);

      return _track(engine, id, osc, bodyGain);
    },

    // ============================================================
    // SNARE — Amen-break flavored, mostly noise
    // ============================================================
    snare(engine, velocity) {
      const ctx = engine.ctx;
      const now = ctx.currentTime;
      const v = (velocity == null ? 0.9 : velocity);
      const id = _id('snare');
      const bus = _bus(engine);

      // Tonal element (30%): triangle ~240 Hz, fast decay
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(240, now);
      osc.frequency.exponentialRampToValueAtTime(150, now + 0.06);
      const tg = ctx.createGain();
      tg.gain.setValueAtTime(0, now);
      tg.gain.linearRampToValueAtTime(v * 0.30, now + 0.002);
      tg.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
      osc.connect(tg); tg.connect(bus);
      osc.start(now);
      osc.stop(now + 0.06 + 0.10);

      // Noise body (70%): bandpass ~3.2 kHz, highpass ~1.8 kHz, ~120 ms
      const noiseDecay = 0.12;
      const noise = ctx.createBufferSource();
      noise.buffer = engine._whiteNoiseBuffer(noiseDecay + 0.02);
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass'; bp.frequency.value = 3200; bp.Q.value = 0.9;
      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass'; hp.frequency.value = 1800;
      const ng = ctx.createGain();
      ng.gain.setValueAtTime(0, now);
      ng.gain.linearRampToValueAtTime(v * 0.70, now + 0.002);
      ng.gain.exponentialRampToValueAtTime(0.001, now + noiseDecay);
      noise.connect(bp); bp.connect(hp); hp.connect(ng); ng.connect(bus);
      noise.start(now);
      noise.stop(now + noiseDecay + 0.10);

      // Tiny reverb send for breakbeat air
      if (engine.effects.reverb && engine.reverbGain) {
        const verbSend = ctx.createGain();
        verbSend.gain.value = 0.18;
        ng.connect(verbSend);
        verbSend.connect(engine.effects.reverb);
      }

      return _track(engine, id, osc, ng);
    },

    // ============================================================
    // SNARE GHOST — softer, darker, for breakbeat texture
    // ============================================================
    snareGhost(engine, velocity) {
      const ctx = engine.ctx;
      const now = ctx.currentTime;
      const v = (velocity == null ? 0.5 : velocity) * 0.4; // ghost = 0.4x peak
      const id = _id('snareGhost');
      const bus = _bus(engine);

      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(220, now);
      osc.frequency.exponentialRampToValueAtTime(140, now + 0.04);
      const tg = ctx.createGain();
      tg.gain.setValueAtTime(0, now);
      tg.gain.linearRampToValueAtTime(v * 0.25, now + 0.002);
      tg.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
      osc.connect(tg); tg.connect(bus);
      osc.start(now);
      osc.stop(now + 0.04 + 0.08);

      const noiseDecay = 0.07;
      const noise = ctx.createBufferSource();
      noise.buffer = engine._whiteNoiseBuffer(noiseDecay + 0.01);
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass'; bp.frequency.value = 2400; bp.Q.value = 0.9;
      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass'; hp.frequency.value = 1500;
      const ng = ctx.createGain();
      ng.gain.setValueAtTime(0, now);
      ng.gain.linearRampToValueAtTime(v * 0.60, now + 0.002);
      ng.gain.exponentialRampToValueAtTime(0.001, now + noiseDecay);
      noise.connect(bp); bp.connect(hp); hp.connect(ng); ng.connect(bus);
      noise.start(now);
      noise.stop(now + noiseDecay + 0.08);

      return _track(engine, id, osc, ng);
    },

    // ============================================================
    // CLAP — 4 noise bursts + body tail
    // ============================================================
    clap(engine, velocity) {
      const ctx = engine.ctx;
      const now = ctx.currentTime;
      const v = (velocity == null ? 0.9 : velocity);
      const id = _id('clap');
      const bus = _bus(engine);

      const out = ctx.createGain();
      out.gain.value = 0.85;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass'; bp.frequency.value = 1600; bp.Q.value = 0.6;
      bp.connect(out);
      out.connect(bus);

      const offsets = [0, 0.010, 0.021, 0.038];
      offsets.forEach((off, i) => {
        const isBody = i === offsets.length - 1;
        const tapDecay = isBody ? 0.16 : 0.018;
        const noise = ctx.createBufferSource();
        noise.buffer = engine._whiteNoiseBuffer(tapDecay + 0.01);
        const g = ctx.createGain();
        const t0 = now + off;
        const peak = v * (isBody ? 0.55 : 0.7);
        g.gain.setValueAtTime(0, t0);
        g.gain.linearRampToValueAtTime(peak, t0 + 0.001);
        g.gain.exponentialRampToValueAtTime(0.001, t0 + tapDecay);
        noise.connect(g); g.connect(bp);
        noise.start(t0);
        noise.stop(t0 + tapDecay + 0.05);
      });

      return _track(engine, id, null, out);
    },

    // ============================================================
    // RIM — short bandpassed square ~1100 Hz
    // ============================================================
    rim(engine, velocity) {
      const ctx = engine.ctx;
      const now = ctx.currentTime;
      const v = (velocity == null ? 0.85 : velocity);
      const id = _id('rim');
      const bus = _bus(engine);

      const osc = ctx.createOscillator();
      osc.type = 'square';
      osc.frequency.value = 1100;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass'; bp.frequency.value = 1500; bp.Q.value = 5;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, now);
      g.gain.linearRampToValueAtTime(v * 0.55, now + 0.001);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
      osc.connect(bp); bp.connect(g); g.connect(bus);
      osc.start(now);
      osc.stop(now + 0.05 + 0.05);

      return _track(engine, id, osc, g);
    },

    // ============================================================
    // CLOSED HAT — metallic 6-square stack, HP ~7.5 kHz, ~40 ms
    // ============================================================
    hatClosed(engine, velocity) {
      const ctx = engine.ctx;
      const now = ctx.currentTime;
      const v = (velocity == null ? 0.7 : velocity);
      const id = _id('hatClosed');
      const bus = _bus(engine);
      const decay = 0.04;

      const ratios = [2.0, 3.0, 4.16, 5.43, 6.79, 8.21];
      const baseFreq = 320;
      const mix = ctx.createGain();
      mix.gain.value = 1 / ratios.length;
      ratios.forEach((r) => {
        const o = ctx.createOscillator();
        o.type = 'square';
        o.frequency.value = baseFreq * r;
        o.connect(mix);
        o.start(now);
        o.stop(now + decay + 0.05);
      });

      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass'; hp.frequency.value = 7500;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass'; bp.frequency.value = 9000; bp.Q.value = 0.4;

      const out = ctx.createGain();
      out.gain.setValueAtTime(0, now);
      out.gain.linearRampToValueAtTime(v * 0.28, now + 0.001);
      out.gain.exponentialRampToValueAtTime(0.001, now + decay);

      mix.connect(hp); hp.connect(bp); bp.connect(out);
      out.connect(bus);

      return _track(engine, id, null, out);
    },

    // ============================================================
    // OPEN HAT — same stack, ~280 ms, slightly lower HP, tiny reverb tap
    // ============================================================
    hatOpen(engine, velocity) {
      const ctx = engine.ctx;
      const now = ctx.currentTime;
      const v = (velocity == null ? 0.7 : velocity);
      const id = _id('hatOpen');
      const bus = _bus(engine);
      const decay = 0.28;

      const ratios = [2.0, 3.0, 4.16, 5.43, 6.79, 8.21];
      const baseFreq = 320;
      const mix = ctx.createGain();
      mix.gain.value = 1 / ratios.length;
      ratios.forEach((r) => {
        const o = ctx.createOscillator();
        o.type = 'square';
        o.frequency.value = baseFreq * r;
        o.connect(mix);
        o.start(now);
        o.stop(now + decay + 0.05);
      });

      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass'; hp.frequency.value = 6800;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass'; bp.frequency.value = 9000; bp.Q.value = 0.4;

      const out = ctx.createGain();
      out.gain.setValueAtTime(0, now);
      out.gain.linearRampToValueAtTime(v * 0.24, now + 0.001);
      out.gain.exponentialRampToValueAtTime(0.001, now + decay);

      mix.connect(hp); hp.connect(bp); bp.connect(out);
      out.connect(bus);

      // Tiny reverb tap — wetter tail than 909
      if (engine.effects.reverb && engine.reverbGain) {
        const verbSend = ctx.createGain();
        verbSend.gain.value = 0.15;
        out.connect(verbSend);
        verbSend.connect(engine.effects.reverb);
      }

      return _track(engine, id, null, out);
    },

    // ============================================================
    // RIDE — bell-stack squares, drier than house
    // ============================================================
    ride(engine, velocity) {
      const ctx = engine.ctx;
      const now = ctx.currentTime;
      const v = (velocity == null ? 0.7 : velocity);
      const id = _id('ride');
      const bus = _bus(engine);
      const decay = 0.55;

      const ratios = [3.0, 4.45, 5.92, 7.31];
      const baseFreq = 280;
      const mix = ctx.createGain();
      mix.gain.value = 1 / ratios.length;
      ratios.forEach((r) => {
        const o = ctx.createOscillator();
        o.type = 'square';
        o.frequency.value = baseFreq * r;
        o.connect(mix);
        o.start(now);
        o.stop(now + decay + 0.05);
      });

      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass'; hp.frequency.value = 4500;
      const out = ctx.createGain();
      out.gain.setValueAtTime(0, now);
      out.gain.linearRampToValueAtTime(v * 0.20, now + 0.002);
      out.gain.exponentialRampToValueAtTime(0.001, now + decay);
      mix.connect(hp); hp.connect(out); out.connect(bus);

      return _track(engine, id, null, out);
    },

    // ============================================================
    // SHAKER — HP noise ~5.5 kHz, soft attack
    // ============================================================
    shaker(engine, velocity) {
      const ctx = engine.ctx;
      const now = ctx.currentTime;
      const v = (velocity == null ? 0.6 : velocity);
      const id = _id('shaker');
      const bus = _bus(engine);
      const decay = 0.09;

      const noise = ctx.createBufferSource();
      noise.buffer = engine._whiteNoiseBuffer(decay + 0.02);
      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass'; hp.frequency.value = 5500;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass'; bp.frequency.value = 7500; bp.Q.value = 0.6;
      const g = ctx.createGain();
      // soft attack
      g.gain.setValueAtTime(0, now);
      g.gain.linearRampToValueAtTime(v * 0.24, now + 0.012);
      g.gain.exponentialRampToValueAtTime(0.001, now + decay);
      noise.connect(hp); hp.connect(bp); bp.connect(g); g.connect(bus);
      noise.start(now);
      noise.stop(now + decay + 0.05);

      return _track(engine, id, null, g);
    },

    // ============================================================
    // REESE BASS — the centerpiece.
    //   Kevin Saunderson's CZ-5000 dual-saw, weaponized for D&B.
    //   Two sawtooths detuned -9 / +11 cents, square one octave below,
    //   LFO at ~5.5 Hz on osc1.detune (depth ~9 cents),
    //   LP filter env: 180 -> 1400 -> 700 Hz (Q ~5),
    //   WaveShaper drive @ 0.18, 2x oversample, reverb send.
    // ============================================================
    reese(engine, frequency, velocity, duration) {
      const ctx = engine.ctx;
      const now = ctx.currentTime;
      const f = frequency || 55;            // ~A1 default
      const v = (velocity == null ? 0.85 : velocity);
      const dur = duration || 0.8;
      const id = _id('reese');
      const bus = _bus(engine);

      // Three oscillators
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const osc3 = ctx.createOscillator();
      osc1.type = 'sawtooth';
      osc2.type = 'sawtooth';
      osc3.type = 'square';
      osc1.frequency.value = f;
      osc2.frequency.value = f;
      osc3.frequency.value = f * 0.5;       // octave below — metallic mid
      osc1.detune.value = -9;
      osc2.detune.value = +11;

      // LFO modulating osc1.detune for the moving Reese character
      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();
      lfo.type = 'sine';
      lfo.frequency.value = 5.5;            // ~5-6 Hz
      lfoGain.gain.value = 9;               // ~9 cents depth
      lfo.connect(lfoGain);
      lfoGain.connect(osc1.detune);

      // Per-osc level mix (squarer is hot — keep it slightly lower)
      const m1 = ctx.createGain(); m1.gain.value = 0.45;
      const m2 = ctx.createGain(); m2.gain.value = 0.45;
      const m3 = ctx.createGain(); m3.gain.value = 0.32;
      osc1.connect(m1);
      osc2.connect(m2);
      osc3.connect(m3);

      // Lowpass with envelope: 180 -> 1400 in 80 ms, settle to ~700 over ~600 ms
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.Q.value = 5;
      const tOpen = now + Math.min(0.08, dur * 0.25);
      const tSettle = now + Math.min(dur, 0.6 + 0.08);
      filter.frequency.setValueAtTime(180, now);
      filter.frequency.exponentialRampToValueAtTime(1400, tOpen);
      filter.frequency.exponentialRampToValueAtTime(700, tSettle);

      // Drive: WaveShaper with 0.18, 2x oversample
      const drive = ctx.createWaveShaper();
      drive.curve = engine._makeDistortionCurve(0.18);
      drive.oversample = '2x';

      // Amp envelope — slight attack, long release tail
      const gain = ctx.createGain();
      const peak = v * 0.55;
      const releaseStart = Math.max(now + 0.02, now + dur - 0.12);
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(peak, now + 0.012);
      gain.gain.linearRampToValueAtTime(peak * 0.85, releaseStart);
      gain.gain.exponentialRampToValueAtTime(0.001, now + dur);

      // Routing
      m1.connect(filter);
      m2.connect(filter);
      m3.connect(filter);
      filter.connect(drive);
      drive.connect(gain);
      gain.connect(bus);

      // Reverb send (moderate)
      if (engine.effects.reverb && engine.reverbGain) {
        const verbSend = ctx.createGain();
        verbSend.gain.value = 0.30;
        gain.connect(verbSend);
        verbSend.connect(engine.effects.reverb);
      }

      const stopAt = now + dur + 0.10;
      osc1.start(now); osc2.start(now); osc3.start(now); lfo.start(now);
      osc1.stop(stopAt); osc2.stop(stopAt); osc3.stop(stopAt); lfo.stop(stopAt);

      return _track(engine, id, osc1, gain);
    },

    // ============================================================
    // GROWL — Massive-style wobble. Resonant LP swept by an LFO.
    // ============================================================
    growl(engine, frequency, velocity, duration) {
      const ctx = engine.ctx;
      const now = ctx.currentTime;
      const f = frequency || 55;
      const v = (velocity == null ? 0.85 : velocity);
      const dur = duration || 0.8;
      const id = _id('growl');
      const bus = _bus(engine);

      // Square + saw
      const oSq = ctx.createOscillator();
      const oSw = ctx.createOscillator();
      oSq.type = 'square';
      oSw.type = 'sawtooth';
      oSq.frequency.value = f;
      oSw.frequency.value = f;
      oSw.detune.value = -7;

      const mSq = ctx.createGain(); mSq.gain.value = 0.45;
      const mSw = ctx.createGain(); mSw.gain.value = 0.50;
      oSq.connect(mSq);
      oSw.connect(mSw);

      // Resonant LP, base ~300 Hz, swept by LFO between ~300 and ~2200 Hz
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 300;
      filter.Q.value = 9;

      // LFO at ~5 Hz, depth ~950 Hz so cutoff oscillates ~300 .. ~2200 Hz
      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();
      lfo.type = 'sine';
      lfo.frequency.value = 5;
      lfoGain.gain.value = 950;
      lfo.connect(lfoGain);
      lfoGain.connect(filter.frequency);

      // Heavy drive
      const drive = ctx.createWaveShaper();
      drive.curve = engine._makeDistortionCurve(0.30);
      drive.oversample = '2x';

      // Amp envelope
      const gain = ctx.createGain();
      const peak = v * 0.50;
      const releaseStart = Math.max(now + 0.02, now + dur - 0.10);
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(peak, now + 0.015);
      gain.gain.linearRampToValueAtTime(peak * 0.9, releaseStart);
      gain.gain.exponentialRampToValueAtTime(0.001, now + dur);

      mSq.connect(filter);
      mSw.connect(filter);
      filter.connect(drive);
      drive.connect(gain);
      gain.connect(bus);

      if (engine.effects.reverb && engine.reverbGain) {
        const verbSend = ctx.createGain();
        verbSend.gain.value = 0.18;
        gain.connect(verbSend);
        verbSend.connect(engine.effects.reverb);
      }

      const stopAt = now + dur + 0.10;
      oSq.start(now); oSw.start(now); lfo.start(now);
      oSq.stop(stopAt); oSw.stop(stopAt); lfo.stop(stopAt);

      return _track(engine, id, oSw, gain);
    },

    // ============================================================
    // D&B LEAD — lush detuned saw stack, bright filter env, slight attack
    // ============================================================
    dnbLead(engine, frequency, velocity, duration) {
      const ctx = engine.ctx;
      const now = ctx.currentTime;
      const f = frequency || 440;
      const v = (velocity == null ? 0.8 : velocity);
      const dur = duration || 0.6;
      const id = _id('dnbLead');
      const bus = _bus(engine);

      // 4 detuned saws
      const detunes = [-14, -5, +6, +13];
      const oscs = detunes.map((d) => {
        const o = ctx.createOscillator();
        o.type = 'sawtooth';
        o.frequency.value = f;
        o.detune.value = d;
        return o;
      });
      const stackMix = ctx.createGain();
      stackMix.gain.value = 1 / oscs.length;
      oscs.forEach((o) => o.connect(stackMix));

      // Filter envelope: 800 -> 4000 in 50 ms -> settle at 2000 over rest
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.Q.value = 2;
      const tOpen = now + Math.min(0.05, dur * 0.2);
      const tSettle = now + Math.min(dur, 0.45);
      filter.frequency.setValueAtTime(800, now);
      filter.frequency.exponentialRampToValueAtTime(4000, tOpen);
      filter.frequency.exponentialRampToValueAtTime(2000, tSettle);

      // Slight slow attack (~20 ms) to feel less synthetic
      const gain = ctx.createGain();
      const peak = v * 0.45;
      const releaseStart = Math.max(now + 0.025, now + dur - 0.10);
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(peak, now + 0.020);
      gain.gain.linearRampToValueAtTime(peak * 0.85, releaseStart);
      gain.gain.exponentialRampToValueAtTime(0.001, now + dur);

      stackMix.connect(filter);
      filter.connect(gain);
      gain.connect(bus);

      // Reverb tap
      if (engine.effects.reverb && engine.reverbGain) {
        const verbSend = ctx.createGain();
        verbSend.gain.value = 0.28;
        gain.connect(verbSend);
        verbSend.connect(engine.effects.reverb);
      }

      const stopAt = now + dur + 0.10;
      oscs.forEach((o) => { o.start(now); o.stop(stopAt); });

      return _track(engine, id, oscs[0], gain);
    },
  };
})();
