/* ============================================
   SoundPrint Visual DAW - HouseVoices
   Iconic house-music voice module.

   Inspirations & synthesis decisions:
   - TR-909 drum machine: punchy click-forward kick (not a slow 808 boom),
     bright bandpassed snare with ~60% noise mix, three-tap clap with
     reflection tail, non-harmonic square stack hats/ride.
   - Korg M1 "Organ 2" stab: the Robin S "Show Me Love" sound. Root + octave
     + perfect 5th square stack, fast attack ~3ms, bandpass focus, light
     waveshape bite, short detuned delay-line chorus, reverb send.
   - Roland Juno-60/106 pad: 3 detuned saws (-7c, 0, +7c), filter envelope
     opens then settles, slow attack with chorus + reverb send.
   - Roland TB-303 acid bass: single saw, resonant LP with velocity-driven
     accent (filter cutoff scales with velocity), squelch sweep + light drive.

   Routing:
   - Kick -> engine.effectsInput  (drives sidechain duck)
   - Other drums + tonal voices -> engine.duckBus (sidechained)
   - Tonal voices may tap engine.effects.reverb for body.
   ============================================ */

(function () {
  'use strict';

  function nid(prefix) {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }

  function duckDest(engine) {
    return engine.duckBus || engine.effectsInput;
  }

  function trackVoice(engine, id, gain, osc) {
    engine.activeNotes.set(id, {
      osc: osc || { stop() {} },
      gain,
    });
    return id;
  }

  window.HouseVoices = {
    // ---------- TR-909 KICK ----------
    // Click-forward, fast pitch drop 60->40 Hz, sub layer for weight.
    // Connects to effectsInput so it drives the sidechain duck.
    kick(engine, velocity) {
      const v = velocity == null ? 0.9 : velocity;
      const ctx = engine.ctx;
      const now = ctx.currentTime;
      const dest = engine.effectsInput;

      // Body: sine, fast pitch drop
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(63, now);
      osc.frequency.exponentialRampToValueAtTime(40, now + 0.05);
      const bodyGain = ctx.createGain();
      bodyGain.gain.setValueAtTime(0, now);
      bodyGain.gain.linearRampToValueAtTime(v * 0.95, now + 0.003);
      bodyGain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
      osc.connect(bodyGain);
      bodyGain.connect(dest);
      osc.start(now);
      osc.stop(now + 0.30 + 0.05);

      // Click: HP-filtered noise burst ~10 ms, velocity-sensitive.
      const clickLen = 0.012;
      const noise = ctx.createBufferSource();
      noise.buffer = engine._whiteNoiseBuffer(clickLen);
      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 1800;
      const cg = ctx.createGain();
      const clickAmt = v * v * 0.55; // velocity^2 for snappy expression
      cg.gain.setValueAtTime(clickAmt, now);
      cg.gain.exponentialRampToValueAtTime(0.001, now + clickLen);
      noise.connect(hp); hp.connect(cg); cg.connect(dest);
      noise.start(now);
      noise.stop(now + clickLen + 0.02);

      // Sub layer: 50 Hz sine, longer decay (~250 ms)
      const sub = ctx.createOscillator();
      sub.type = 'sine';
      sub.frequency.value = 50;
      const sg = ctx.createGain();
      sg.gain.setValueAtTime(0, now);
      sg.gain.linearRampToValueAtTime(v * 0.45, now + 0.012);
      sg.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
      sub.connect(sg); sg.connect(dest);
      sub.start(now);
      sub.stop(now + 0.30 + 0.05);

      return trackVoice(engine, nid('kick'), bodyGain, osc);
    },

    // ---------- TR-909 SNARE ----------
    // Triangle ~200 Hz tonal + bandpassed noise (~60% mix).
    snare(engine, velocity) {
      const v = velocity == null ? 0.9 : velocity;
      const ctx = engine.ctx;
      const now = ctx.currentTime;
      const dest = duckDest(engine);

      const tonalDecay = 0.08;
      const noiseDecay = 0.18;
      const mix = 0.60;

      // Tonal triangle with fast pitch decay
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(200, now);
      osc.frequency.exponentialRampToValueAtTime(120, now + tonalDecay);
      const tg = ctx.createGain();
      tg.gain.setValueAtTime(0, now);
      tg.gain.linearRampToValueAtTime(v * 0.45 * (1 - mix), now + 0.002);
      tg.gain.exponentialRampToValueAtTime(0.001, now + tonalDecay);
      osc.connect(tg); tg.connect(dest);
      osc.start(now);
      osc.stop(now + tonalDecay + 0.05);

      // Noise: bandpass ~3 kHz, highpass cleanup
      const noise = ctx.createBufferSource();
      noise.buffer = engine._whiteNoiseBuffer(noiseDecay + 0.02);
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass'; bp.frequency.value = 3000; bp.Q.value = 0.7;
      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass'; hp.frequency.value = 1500;
      const ng = ctx.createGain();
      ng.gain.setValueAtTime(0, now);
      ng.gain.linearRampToValueAtTime(v * 0.6 * mix, now + 0.001);
      ng.gain.exponentialRampToValueAtTime(0.001, now + noiseDecay);
      noise.connect(bp); bp.connect(hp); hp.connect(ng); ng.connect(dest);
      noise.start(now);
      noise.stop(now + noiseDecay + 0.05);

      return trackVoice(engine, nid('snare'), ng, osc);
    },

    // ---------- TR-909 CLAP ----------
    // Three rapid noise bursts ~12 ms apart + body tail.
    clap(engine, velocity) {
      const v = velocity == null ? 0.9 : velocity;
      const ctx = engine.ctx;
      const now = ctx.currentTime;
      const dest = duckDest(engine);

      const out = ctx.createGain();
      out.gain.value = 0.85;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 1100;
      bp.Q.value = 0.6;
      bp.connect(out);
      out.connect(dest);
      // small reverb tap for the clap body's room feel
      if (engine.effects && engine.effects.reverb) {
        const tap = ctx.createGain();
        tap.gain.value = 0.25;
        out.connect(tap);
        tap.connect(engine.effects.reverb);
      }

      const taps = [
        { off: 0.000, dec: 0.014, lvl: 0.70 },
        { off: 0.012, dec: 0.014, lvl: 0.70 },
        { off: 0.024, dec: 0.014, lvl: 0.70 },
        { off: 0.030, dec: 0.180, lvl: 0.55 }, // body tail
      ];
      taps.forEach((t) => {
        const noise = ctx.createBufferSource();
        noise.buffer = engine._whiteNoiseBuffer(t.dec + 0.02);
        const g = ctx.createGain();
        const t0 = now + t.off;
        g.gain.setValueAtTime(v * t.lvl, t0);
        g.gain.exponentialRampToValueAtTime(0.001, t0 + t.dec);
        noise.connect(g); g.connect(bp);
        noise.start(t0);
        noise.stop(t0 + t.dec + 0.05);
      });

      return trackVoice(engine, nid('clap'), out);
    },

    // ---------- TR-909 RIM ----------
    // Short bandpassed square click ~1500 Hz, ~50 ms.
    rim(engine, velocity) {
      const v = velocity == null ? 0.9 : velocity;
      const ctx = engine.ctx;
      const now = ctx.currentTime;
      const dest = duckDest(engine);

      const osc = ctx.createOscillator();
      osc.type = 'square';
      osc.frequency.value = 1500;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass'; bp.frequency.value = 1500; bp.Q.value = 5;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, now);
      g.gain.linearRampToValueAtTime(v * 0.55, now + 0.001);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
      osc.connect(bp); bp.connect(g); g.connect(dest);
      osc.start(now);
      osc.stop(now + 0.06);

      return trackVoice(engine, nid('rim'), g, osc);
    },

    // ---------- TR-909 CLOSED HAT ----------
    // Stacked squares at non-harmonic ratios, HP ~7.8 kHz, ~50 ms decay.
    hatClosed(engine, velocity) {
      return _hatStack(engine, velocity, false);
    },

    // ---------- TR-909 OPEN HAT ----------
    // Same stack, longer decay ~400 ms, slightly lower HP ~6 kHz.
    hatOpen(engine, velocity) {
      return _hatStack(engine, velocity, true);
    },

    // ---------- TR-909 RIDE ----------
    // Bell stack of 4 squares, HP 4.5 kHz, ~700 ms with slight pitch shimmer.
    ride(engine, velocity) {
      const v = velocity == null ? 0.9 : velocity;
      const ctx = engine.ctx;
      const now = ctx.currentTime;
      const dest = duckDest(engine);

      const decay = 0.70;
      const ratios = [3.0, 4.45, 5.92, 7.31];
      const baseFreq = 280;
      const mix = ctx.createGain();
      mix.gain.value = 1 / ratios.length;
      const oscs = [];
      ratios.forEach((r) => {
        const o = ctx.createOscillator();
        o.type = 'square';
        o.frequency.setValueAtTime(baseFreq * r, now);
        // shimmer: tiny upward detune drift
        o.frequency.linearRampToValueAtTime(baseFreq * r * 1.003, now + decay);
        o.connect(mix);
        o.start(now);
        o.stop(now + decay + 0.05);
        oscs.push(o);
      });

      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass'; hp.frequency.value = 4500;
      const out = ctx.createGain();
      out.gain.setValueAtTime(0, now);
      out.gain.linearRampToValueAtTime(v * 0.20, now + 0.003);
      out.gain.exponentialRampToValueAtTime(0.001, now + decay);
      mix.connect(hp); hp.connect(out); out.connect(dest);

      return trackVoice(engine, nid('ride'), out, oscs[0]);
    },

    // ---------- SHAKER ----------
    // Filtered noise, soft attack ~10 ms, ~100 ms total.
    shaker(engine, velocity) {
      const v = velocity == null ? 0.9 : velocity;
      const ctx = engine.ctx;
      const now = ctx.currentTime;
      const dest = duckDest(engine);

      const decay = 0.10;
      const noise = ctx.createBufferSource();
      noise.buffer = engine._whiteNoiseBuffer(decay + 0.02);
      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass'; hp.frequency.value = 5500;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass'; bp.frequency.value = 7500; bp.Q.value = 0.6;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, now);
      g.gain.linearRampToValueAtTime(v * 0.24, now + 0.012);
      g.gain.exponentialRampToValueAtTime(0.001, now + decay);
      noise.connect(hp); hp.connect(bp); bp.connect(g); g.connect(dest);
      noise.start(now);
      noise.stop(now + decay + 0.05);

      return trackVoice(engine, nid('shaker'), g, noise);
    },

    // ---------- M1 ORGAN 2 STAB ----------
    // Robin S "Show Me Love". Root + octave + perfect 5th squares,
    // bandpass focus ~1.7 kHz, light waveshape bite, short delay-line chorus.
    m1Stab(engine, frequency, velocity, duration) {
      const v = velocity == null ? 0.9 : velocity;
      const dur = duration || 0.16;
      const ctx = engine.ctx;
      const now = ctx.currentTime;
      const dest = duckDest(engine);
      const f = frequency || 440;

      // Three squares: root, octave up, perfect 5th above root (f * 1.5).
      const oscs = [
        { freq: f,        gain: 0.55 },
        { freq: f * 2,    gain: 0.40 },
        { freq: f * 1.5,  gain: 0.35 },
      ].map((spec) => {
        const o = ctx.createOscillator();
        o.type = 'square';
        o.frequency.value = spec.freq;
        const og = ctx.createGain();
        og.gain.value = spec.gain;
        o.connect(og);
        return { osc: o, gain: og };
      });

      const sumIn = ctx.createGain();
      sumIn.gain.value = 1.0;
      oscs.forEach((p) => p.gain.connect(sumIn));

      // Bandpass focus (the M1 "honk")
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 1700;
      bp.Q.value = 3.5;

      // Light bite via waveshaper
      const drive = ctx.createWaveShaper();
      drive.curve = engine._makeDistortionCurve(0.05);
      drive.oversample = '2x';

      // Subtle chorus: short detuned delay (~7 ms), low-gain mix back.
      const chorusDelay = ctx.createDelay(0.05);
      chorusDelay.delayTime.value = 0.007;
      const chorusGain = ctx.createGain();
      chorusGain.gain.value = 0.30;

      // Envelope: stab — 3ms attack, ~150 ms decay, no sustain
      const out = ctx.createGain();
      const peak = v * 0.55;
      out.gain.setValueAtTime(0, now);
      out.gain.linearRampToValueAtTime(peak, now + 0.003);
      out.gain.exponentialRampToValueAtTime(0.001, now + Math.max(0.12, Math.min(dur, 0.18)));

      sumIn.connect(bp);
      bp.connect(drive);
      drive.connect(out);
      // chorus tap parallel
      drive.connect(chorusDelay);
      chorusDelay.connect(chorusGain);
      chorusGain.connect(out);

      out.connect(dest);
      // Reverb send
      if (engine.effects && engine.effects.reverb) {
        const tap = ctx.createGain();
        tap.gain.value = 0.35;
        out.connect(tap);
        tap.connect(engine.effects.reverb);
      }

      const stopAt = now + Math.max(0.18, dur) + 0.06;
      oscs.forEach((p) => { p.osc.start(now); p.osc.stop(stopAt); });

      return trackVoice(engine, nid('m1stab'), out, oscs[0].osc);
    },

    // ---------- JUNO-60/106 PAD ----------
    // 3 detuned saws (-7c, 0, +7c), LP envelope opens then settles,
    // slow attack, gentle release, chorus + reverb send.
    junoPad(engine, frequency, velocity, duration) {
      const v = velocity == null ? 0.7 : velocity;
      const dur = duration || 1.0;
      const ctx = engine.ctx;
      const now = ctx.currentTime;
      const dest = duckDest(engine);
      const f = frequency || 220;

      const detunes = [-7, 0, +7];
      const oscs = detunes.map((d) => {
        const o = ctx.createOscillator();
        o.type = 'sawtooth';
        o.frequency.value = f;
        o.detune.value = d;
        return o;
      });

      const sum = ctx.createGain();
      sum.gain.value = 1 / 3;
      oscs.forEach((o) => o.connect(sum));

      // LP filter envelope: 600 -> 1800 over 80 ms -> settle 1200
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.Q.value = 0.7;
      lp.frequency.setValueAtTime(600, now);
      lp.frequency.linearRampToValueAtTime(1800, now + 0.08);
      lp.frequency.linearRampToValueAtTime(1200, now + 0.30);

      // Chorus: short detuned delay
      const chorusDelay = ctx.createDelay(0.05);
      chorusDelay.delayTime.value = 0.011;
      const chorusGain = ctx.createGain();
      chorusGain.gain.value = 0.35;

      // Envelope: slow attack, sustain, release
      const attack = 0.10;
      const release = Math.max(0.25, Math.min(0.6, dur * 0.5));
      const peak = v * 0.45;
      const sustainStart = now + attack;
      const releaseStart = Math.max(sustainStart + 0.05, now + dur - release);

      const out = ctx.createGain();
      out.gain.setValueAtTime(0, now);
      out.gain.linearRampToValueAtTime(peak, sustainStart);
      out.gain.setValueAtTime(peak, releaseStart);
      out.gain.exponentialRampToValueAtTime(0.001, releaseStart + release);

      sum.connect(lp);
      lp.connect(out);
      // chorus tap
      lp.connect(chorusDelay);
      chorusDelay.connect(chorusGain);
      chorusGain.connect(out);

      out.connect(dest);
      // Reverb send
      if (engine.effects && engine.effects.reverb) {
        const tap = ctx.createGain();
        tap.gain.value = 0.40;
        out.connect(tap);
        tap.connect(engine.effects.reverb);
      }

      const stopAt = releaseStart + release + 0.08;
      oscs.forEach((o) => { o.start(now); o.stop(stopAt); });

      return trackVoice(engine, nid('juno'), out, oscs[0]);
    },

    // ---------- TB-303 ACID BASS ----------
    // Single saw, resonant LP (Q ~12), velocity-driven cutoff accent,
    // squelch envelope: sweep up, then settle. Light drive.
    acid303(engine, frequency, velocity, duration) {
      const v = velocity == null ? 0.85 : velocity;
      const dur = duration || 0.30;
      const ctx = engine.ctx;
      const now = ctx.currentTime;
      const dest = duckDest(engine);
      const f = frequency || 110;

      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = f;

      // Resonant lowpass — the heart of the 303 squelch
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.Q.value = 12;
      // Velocity-scaled accent: harder hits open the filter wider
      const cutoffMin = 200;
      const cutoffPeak = 1200 + v * 600; // 1200..1800
      const cutoffSettle = 600 + v * 200; // 600..800
      const sweepEnd = now + Math.min(0.5, Math.max(0.08, dur * 0.4));
      const settleEnd = now + dur;
      lp.frequency.setValueAtTime(cutoffMin, now);
      lp.frequency.exponentialRampToValueAtTime(cutoffPeak, sweepEnd);
      lp.frequency.exponentialRampToValueAtTime(cutoffSettle, settleEnd);

      // Light drive
      const drive = ctx.createWaveShaper();
      drive.curve = engine._makeDistortionCurve(0.10);
      drive.oversample = '2x';

      // Envelope: short attack, sustain through note, fast release.
      const release = 0.04;
      const peak = v * 0.55;
      const releaseStart = Math.max(now + 0.01, now + dur - release);

      const out = ctx.createGain();
      out.gain.setValueAtTime(0, now);
      out.gain.linearRampToValueAtTime(peak, now + 0.005);
      out.gain.setValueAtTime(peak, releaseStart);
      out.gain.exponentialRampToValueAtTime(0.001, releaseStart + release);

      osc.connect(lp);
      lp.connect(drive);
      drive.connect(out);
      out.connect(dest);

      const stopAt = releaseStart + release + 0.05;
      osc.start(now);
      osc.stop(stopAt);

      return trackVoice(engine, nid('acid303'), out, osc);
    },
  };

  // Internal: shared 909 hat stack (closed/open).
  function _hatStack(engine, velocity, open) {
    const v = velocity == null ? 0.85 : velocity;
    const ctx = engine.ctx;
    const now = ctx.currentTime;
    const dest = duckDest(engine);

    const decay = open ? 0.40 : 0.05;
    const ratios = [2.0, 3.0, 4.16, 5.43, 6.79, 8.21];
    const baseFreq = 320;

    const mix = ctx.createGain();
    mix.gain.value = 1 / ratios.length;
    const oscs = [];
    ratios.forEach((r) => {
      const o = ctx.createOscillator();
      o.type = 'square';
      o.frequency.value = baseFreq * r;
      o.connect(mix);
      o.start(now);
      o.stop(now + decay + 0.05);
      oscs.push(o);
    });

    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = open ? 6000 : 7500;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 9000;
    bp.Q.value = 0.4;

    const out = ctx.createGain();
    out.gain.setValueAtTime(0, now);
    out.gain.linearRampToValueAtTime(v * (open ? 0.22 : 0.26), now + 0.001);
    out.gain.exponentialRampToValueAtTime(0.001, now + decay);

    mix.connect(hp); hp.connect(bp); bp.connect(out);
    out.connect(dest);

    return trackVoice(
      engine,
      nid(open ? 'hatOpen' : 'hatClosed'),
      out,
      oscs[0]
    );
  }
})();
