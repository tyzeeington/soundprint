/* ============================================================
   SoundPrint Visual DAW — Downtempo Voices
   Lo-fi / chill / trip-hop voice module.

   Sonic references:
     - Bonobo (Black Sands, Migration) — laid-back kits, lush keys
     - Tycho (Dive, Awake) — dusted Rhodes pads, soft drums
     - Boards of Canada — wobbly tape strings, faded warmth
     - Massive Attack ("Teardrop") — slow heavy kick, breathy keys
     - DJ Krush, Mo' Wax / Ninja Tune lineage — brushed jazz drums,
       woozy Rhodes, tape-saturated everything
     - Vintage hardware: Rhodes Mark I (1:1 FM bell), Wurlitzer 200A
       (2:1 FM reedy bite), Mellotron M400 (tape strings + flute)

   Engineering:
     - Drums (except kick) and tonal voices route to engine.duckBus
       so they get sidechained off the kick. Kick lands on
       engine.effectsInput directly to drive the duck.
     - Tonal voices have an optional tape-saturation chain that
       softly clips and rolls off highs (~12 kHz) to ape tape head
       loss. Reverb sends are generous. Delay sends sparingly used.
     - FM is implemented by routing the modulator oscillator into a
       gain (the modulation depth, scaled by carrier frequency *
       index) and into the carrier's frequency AudioParam.
   ============================================================ */

(function () {
  'use strict';

  // ---------- helpers ----------

  function destFor(engine) {
    return engine.duckBus || engine.effectsInput;
  }

  function newId(name) {
    return `dt_${name}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }

  function track(engine, id, gain) {
    engine.activeNotes.set(id, { osc: { stop() {} }, gain });
    return id;
  }

  function reverbSend(engine, node, amount) {
    if (!engine.effects || !engine.effects.reverb || !engine.reverbGain) return;
    if (amount === 1) {
      node.connect(engine.effects.reverb);
      return;
    }
    const send = engine.ctx.createGain();
    send.gain.value = amount;
    node.connect(send);
    send.connect(engine.effects.reverb);
  }

  function delaySend(engine, node, amount) {
    if (!engine.effects || !engine.effects.delay || !engine.delayGain) return;
    const send = engine.ctx.createGain();
    send.gain.value = amount;
    node.connect(send);
    send.connect(engine.effects.delay);
  }

  // Tape saturation: gentle soft-clip + high rolloff. Returns the
  // output node so callers can keep chaining.
  function tapeSaturate(engine, sourceNode, amount) {
    const ws = engine.ctx.createWaveShaper();
    ws.curve = engine._makeDistortionCurve((amount || 0.4) * 0.25);
    ws.oversample = '2x';
    const lp = engine.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 12000;
    lp.Q.value = 0.5;
    sourceNode.connect(ws);
    ws.connect(lp);
    return lp;
  }

  // ---------- DRUMS ----------

  // Soft kick — feels less like a club thump, more like a heartbeat
  function kick(engine, velocity) {
    const ctx = engine.ctx;
    const now = ctx.currentTime;
    const v = velocity == null ? 0.85 : velocity;

    // Body: 110 Hz -> 42 Hz over ~80 ms
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(110, now);
    osc.frequency.exponentialRampToValueAtTime(42, now + 0.08);

    // Take the edge off — warm low-passed body
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 600;
    lp.Q.value = 0.7;

    const bodyGain = ctx.createGain();
    bodyGain.gain.setValueAtTime(0, now);
    bodyGain.gain.linearRampToValueAtTime(v * 0.95, now + 0.005);
    bodyGain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

    osc.connect(lp);
    lp.connect(bodyGain);
    // Kick goes direct to effectsInput to drive sidechain
    bodyGain.connect(engine.effectsInput);

    osc.start(now);
    osc.stop(now + 0.45 + 0.1);

    // Reduced click — ~30% of a typical house kick click
    const clickLen = 0.012;
    const noise = ctx.createBufferSource();
    noise.buffer = engine._whiteNoiseBuffer(clickLen);
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 1200;
    const cg = ctx.createGain();
    cg.gain.setValueAtTime(v * 0.14, now);
    cg.gain.exponentialRampToValueAtTime(0.001, now + clickLen);
    noise.connect(hp);
    hp.connect(cg);
    cg.connect(engine.effectsInput);
    noise.start(now);
    noise.stop(now + clickLen + 0.05);

    // Sub layer for weight, low and slow
    const sub = ctx.createOscillator();
    sub.type = 'sine';
    sub.frequency.value = 45;
    const sg = ctx.createGain();
    sg.gain.setValueAtTime(0, now);
    sg.gain.linearRampToValueAtTime(v * 0.35, now + 0.015);
    sg.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
    sub.connect(sg);
    sg.connect(engine.effectsInput);
    sub.start(now);
    sub.stop(now + 0.55 + 0.1);

    return track(engine, newId('kick'), bodyGain);
  }

  function snare(engine, velocity) {
    const ctx = engine.ctx;
    const now = ctx.currentTime;
    const v = velocity == null ? 0.8 : velocity;
    const dest = destFor(engine);

    // Tonal weight — triangle at 180 Hz, 50% mix
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(180, now);
    osc.frequency.exponentialRampToValueAtTime(120, now + 0.10);
    const tg = ctx.createGain();
    tg.gain.setValueAtTime(v * 0.5, now);
    tg.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
    osc.connect(tg);
    tg.connect(dest);
    osc.start(now);
    osc.stop(now + 0.16 + 0.1);

    // Noise — HP ~1.1 kHz, longer tail (~200 ms)
    const noise = ctx.createBufferSource();
    noise.buffer = engine._whiteNoiseBuffer(0.22);
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 1100;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 2200;
    bp.Q.value = 0.7;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(v * 0.55, now);
    ng.gain.exponentialRampToValueAtTime(0.001, now + 0.20);
    noise.connect(hp);
    hp.connect(bp);
    bp.connect(ng);
    ng.connect(dest);
    noise.start(now);
    noise.stop(now + 0.22 + 0.1);

    // Room reverb tap
    reverbSend(engine, ng, 0.35);

    return track(engine, newId('snare'), tg);
  }

  // Brushed snare — broad noise, soft attack, the jazzy feel
  function snareBrush(engine, velocity) {
    const ctx = engine.ctx;
    const now = ctx.currentTime;
    const v = velocity == null ? 0.7 : velocity;
    const dest = destFor(engine);

    // Tiny tonal element (5%) just for body presence
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = 200;
    const tg = ctx.createGain();
    tg.gain.setValueAtTime(0, now);
    tg.gain.linearRampToValueAtTime(v * 0.06, now + 0.012);
    tg.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    osc.connect(tg);
    tg.connect(dest);
    osc.start(now);
    osc.stop(now + 0.12 + 0.1);

    // Noise — broad bandpass ~2.5 kHz, Q ~0.4, soft brushed attack
    const noise = ctx.createBufferSource();
    noise.buffer = engine._whiteNoiseBuffer(0.4);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 2500;
    bp.Q.value = 0.4;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0, now);
    ng.gain.linearRampToValueAtTime(v * 0.55, now + 0.010); // soft brush attack
    ng.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    noise.connect(bp);
    bp.connect(ng);
    ng.connect(dest);
    noise.start(now);
    noise.stop(now + 0.4 + 0.1);

    // Tiny reverb tap
    reverbSend(engine, ng, 0.25);

    return track(engine, newId('snareBrush'), ng);
  }

  function clap(engine, velocity) {
    const ctx = engine.ctx;
    const now = ctx.currentTime;
    const v = velocity == null ? 0.8 : velocity;
    const dest = destFor(engine);

    const out = ctx.createGain();
    out.gain.value = 0.75;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1300;
    bp.Q.value = 0.55;
    bp.connect(out);
    out.connect(dest);

    // 3 quick taps + reverb-heavy body tail (~250 ms)
    const offsets = [0, 0.012, 0.025, 0.045];
    offsets.forEach((off, i) => {
      const isBody = i === offsets.length - 1;
      const tapDecay = isBody ? 0.25 : 0.020;
      const t0 = now + off;
      const noise = ctx.createBufferSource();
      noise.buffer = engine._whiteNoiseBuffer(tapDecay + 0.02);
      const g = ctx.createGain();
      const peak = v * (isBody ? 0.55 : 0.7);
      g.gain.setValueAtTime(peak, t0);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + tapDecay);
      noise.connect(g);
      g.connect(bp);
      noise.start(t0);
      noise.stop(t0 + tapDecay + 0.05);
    });

    reverbSend(engine, out, 0.6); // heavy reverb tail

    return track(engine, newId('clap'), out);
  }

  function rim(engine, velocity) {
    const ctx = engine.ctx;
    const now = ctx.currentTime;
    const v = velocity == null ? 0.7 : velocity;
    const dest = destFor(engine);

    // Warmer center than house rim — 900 Hz
    const osc = ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.value = 900;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 900;
    bp.Q.value = 4;
    const g = ctx.createGain();
    // Softer attack
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(v * 0.45, now + 0.004);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.07);
    osc.connect(bp);
    bp.connect(g);
    g.connect(dest);
    osc.start(now);
    osc.stop(now + 0.07 + 0.1);

    reverbSend(engine, g, 0.2);

    return track(engine, newId('rim'), g);
  }

  function _hat(engine, velocity, open) {
    const ctx = engine.ctx;
    const now = ctx.currentTime;
    const v = velocity == null ? 0.7 : velocity;
    const dest = destFor(engine);

    // Same 6-square metallic stack as house, but voiced wetter
    const ratios = [2.0, 3.0, 4.16, 5.43, 6.79, 8.21];
    const baseFreq = 320;
    const decay = open ? 0.5 : 0.08;

    const mix = ctx.createGain();
    mix.gain.value = 1 / ratios.length;
    ratios.forEach((r) => {
      const o = ctx.createOscillator();
      o.type = 'square';
      o.frequency.value = baseFreq * r;
      o.connect(mix);
      o.start(now);
      o.stop(now + decay + 0.1);
    });

    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    // Open hat darker — 5.5 kHz; closed hat slightly less aggressive than house
    hp.frequency.value = open ? 5500 : 7200;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 8500;
    bp.Q.value = 0.4;

    const out = ctx.createGain();
    // Softer attack on closed hat — sounds breathier
    out.gain.setValueAtTime(0, now);
    out.gain.linearRampToValueAtTime(v * (open ? 0.22 : 0.24), now + 0.004);
    out.gain.exponentialRampToValueAtTime(0.001, now + decay);

    mix.connect(hp);
    hp.connect(bp);
    bp.connect(out);
    out.connect(dest);

    // Small reverb tap on both
    reverbSend(engine, out, open ? 0.35 : 0.15);

    return track(engine, newId(open ? 'hatOpen' : 'hatClosed'), out);
  }

  function hatClosed(engine, velocity) { return _hat(engine, velocity, false); }
  function hatOpen(engine, velocity)   { return _hat(engine, velocity, true); }

  function ride(engine, velocity) {
    const ctx = engine.ctx;
    const now = ctx.currentTime;
    const v = velocity == null ? 0.7 : velocity;
    const dest = destFor(engine);

    // Bell stack with longer decay — jazzy ride bell
    const ratios = [3.0, 4.45, 5.92, 7.31];
    const baseFreq = 280;
    const decay = 0.9;

    const mix = ctx.createGain();
    mix.gain.value = 1 / ratios.length;
    ratios.forEach((r) => {
      const o = ctx.createOscillator();
      o.type = 'square';
      o.frequency.value = baseFreq * r;
      o.connect(mix);
      o.start(now);
      o.stop(now + decay + 0.1);
    });

    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 4000;

    const out = ctx.createGain();
    // Softer attack
    out.gain.setValueAtTime(0, now);
    out.gain.linearRampToValueAtTime(v * 0.18, now + 0.008);
    out.gain.exponentialRampToValueAtTime(0.001, now + decay);

    mix.connect(hp);
    hp.connect(out);
    out.connect(dest);

    reverbSend(engine, out, 0.4);

    return track(engine, newId('ride'), out);
  }

  function shaker(engine, velocity) {
    const ctx = engine.ctx;
    const now = ctx.currentTime;
    const v = velocity == null ? 0.6 : velocity;
    const dest = destFor(engine);

    const decay = 0.15; // longer than house
    const noise = ctx.createBufferSource();
    noise.buffer = engine._whiteNoiseBuffer(decay + 0.05);
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 5000;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 7200;
    bp.Q.value = 0.6;

    const g = ctx.createGain();
    // Soft attack — feels like a real shaker, not a snap
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(v * 0.22, now + 0.018);
    g.gain.exponentialRampToValueAtTime(0.001, now + decay);

    noise.connect(hp);
    hp.connect(bp);
    bp.connect(g);
    g.connect(dest);
    noise.start(now);
    noise.stop(now + decay + 0.1);

    reverbSend(engine, g, 0.18);

    return track(engine, newId('shaker'), g);
  }

  // ---------- TONAL ----------

  // Rhodes — 1:1 FM ratio (classic bell). Mod index decays from
  // ~3.5 to ~0.5 over ~150 ms, giving the bell-on-attack character.
  function rhodes(engine, frequency, velocity, duration) {
    const ctx = engine.ctx;
    const now = ctx.currentTime;
    const v = velocity == null ? 0.75 : velocity;
    const dur = duration || 1.2;
    const dest = destFor(engine);

    // Carrier (the audible tone)
    const carrier = ctx.createOscillator();
    carrier.type = 'sine';
    carrier.frequency.value = frequency;

    // Modulator (1:1 ratio — Rhodes bell)
    const modulator = ctx.createOscillator();
    modulator.type = 'sine';
    modulator.frequency.value = frequency * 1.0;

    // Modulation depth: index * carrier freq. Index 3.5 -> 0.5 over 150ms.
    const modGain = ctx.createGain();
    const startDepth = frequency * 3.5;
    const endDepth = frequency * 0.5;
    modGain.gain.setValueAtTime(startDepth, now);
    modGain.gain.linearRampToValueAtTime(Math.max(endDepth, 0.001), now + 0.15);

    modulator.connect(modGain);
    modGain.connect(carrier.frequency); // FM: added to carrier freq

    // Take off harsh harmonics
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 3500;
    lp.Q.value = 0.7;

    // Amp envelope — fast attack, exponential decay over duration
    const amp = ctx.createGain();
    const peak = v * 0.55;
    amp.gain.setValueAtTime(0, now);
    amp.gain.linearRampToValueAtTime(peak, now + 0.005);
    amp.gain.exponentialRampToValueAtTime(Math.max(peak * 0.0015, 0.0001), now + dur);

    // Slight chorus — short detuned delay (~12 ms)
    const chorusDelay = ctx.createDelay(0.05);
    chorusDelay.delayTime.value = 0.012;
    const chorusLfo = ctx.createOscillator();
    chorusLfo.frequency.value = 0.6;
    const chorusLfoGain = ctx.createGain();
    chorusLfoGain.gain.value = 0.0015;
    chorusLfo.connect(chorusLfoGain);
    chorusLfoGain.connect(chorusDelay.delayTime);

    const chorusMix = ctx.createGain();
    chorusMix.gain.value = 0.35;

    carrier.connect(lp);
    lp.connect(amp);

    // Wet chorus path
    amp.connect(chorusDelay);
    chorusDelay.connect(chorusMix);

    // Pre-tape sum
    const preTape = ctx.createGain();
    preTape.gain.value = 1.0;
    amp.connect(preTape);
    chorusMix.connect(preTape);

    // Tape saturation for that lo-fi character
    const tape = tapeSaturate(engine, preTape, 0.5);
    tape.connect(dest);

    // Reverb send
    reverbSend(engine, tape, 0.55);

    const stopAt = now + dur + 0.1;
    carrier.start(now);
    modulator.start(now);
    chorusLfo.start(now);
    carrier.stop(stopAt);
    modulator.stop(stopAt);
    chorusLfo.stop(stopAt);

    return track(engine, newId('rhodes'), amp);
  }

  // Wurlitzer — 2:1 FM ratio for the metallic reedy edge. Higher
  // mod index (~5 -> 1), faster decay, slight square blend (~20%).
  function wurli(engine, frequency, velocity, duration) {
    const ctx = engine.ctx;
    const now = ctx.currentTime;
    const v = velocity == null ? 0.75 : velocity;
    const dur = duration || 0.9;
    const dest = destFor(engine);

    const carrier = ctx.createOscillator();
    carrier.type = 'sine';
    carrier.frequency.value = frequency;

    // Modulator at 2× — the Wurli bite
    const modulator = ctx.createOscillator();
    modulator.type = 'sine';
    modulator.frequency.value = frequency * 2.0;

    const modGain = ctx.createGain();
    const startDepth = frequency * 5.0;
    const endDepth = frequency * 1.0;
    modGain.gain.setValueAtTime(startDepth, now);
    modGain.gain.linearRampToValueAtTime(Math.max(endDepth, 0.001), now + 0.12);

    modulator.connect(modGain);
    modGain.connect(carrier.frequency);

    // 20% square blend for reedy honk
    const sq = ctx.createOscillator();
    sq.type = 'square';
    sq.frequency.value = frequency;
    const sqGain = ctx.createGain();
    sqGain.gain.value = 0.20;

    // Higher LP cutoff — let the bite through
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 5000;
    lp.Q.value = 0.7;

    // Faster decay than Rhodes
    const amp = ctx.createGain();
    const peak = v * 0.50;
    amp.gain.setValueAtTime(0, now);
    amp.gain.linearRampToValueAtTime(peak, now + 0.004);
    amp.gain.exponentialRampToValueAtTime(Math.max(peak * 0.001, 0.0001), now + dur);

    carrier.connect(lp);
    sq.connect(sqGain);
    sqGain.connect(lp);
    lp.connect(amp);

    // Tape saturation
    const tape = tapeSaturate(engine, amp, 0.6);
    tape.connect(dest);

    reverbSend(engine, tape, 0.35);

    const stopAt = now + dur + 0.1;
    carrier.start(now);
    modulator.start(now);
    sq.start(now);
    carrier.stop(stopAt);
    modulator.stop(stopAt);
    sq.stop(stopAt);

    return track(engine, newId('wurli'), amp);
  }

  // Mellotron tape strings — 5 detuned saws + tape wow LFO
  function mellotronStrings(engine, frequency, velocity, duration) {
    const ctx = engine.ctx;
    const now = ctx.currentTime;
    const v = velocity == null ? 0.7 : velocity;
    const dur = duration || 1.6;
    const dest = destFor(engine);

    // 5 sawtooths at -15, -7, 0, +7, +15 cents
    const detunes = [-15, -7, 0, 7, 15];
    const oscs = detunes.map((d) => {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = frequency;
      o.detune.value = d;
      return o;
    });

    // Tape wow/flutter — slow LFO modulating one saw's detune ±5 cents
    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 1.5;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 5; // ±5 cents
    lfo.connect(lfoGain);
    lfoGain.connect(oscs[2].detune); // wobble the center voice

    // Gentle bandpass shaping in lower mids
    const bp = ctx.createBiquadFilter();
    bp.type = 'peaking';
    bp.frequency.value = 600;
    bp.Q.value = 0.8;
    bp.gain.value = 2.5;

    // Tape head loss — LP ~2.8 kHz
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 2800;
    lp.Q.value = 0.6;

    // Slow attack (tape ramp), long release tied to duration
    const amp = ctx.createGain();
    const peak = v * 0.30;
    const attack = 0.18;
    const release = 0.4;
    amp.gain.setValueAtTime(0, now);
    amp.gain.linearRampToValueAtTime(peak, now + attack);
    const sustainEnd = Math.max(now + attack + 0.02, now + dur - release);
    amp.gain.setValueAtTime(peak, sustainEnd);
    amp.gain.exponentialRampToValueAtTime(0.0005, now + dur);

    const sumGain = ctx.createGain();
    sumGain.gain.value = 1 / oscs.length;

    oscs.forEach((o) => o.connect(sumGain));
    sumGain.connect(bp);
    bp.connect(lp);
    lp.connect(amp);

    // Tape saturation
    const tape = tapeSaturate(engine, amp, 0.55);
    tape.connect(dest);

    // Heavy reverb send
    reverbSend(engine, tape, 0.85);

    const stopAt = now + dur + 0.1;
    oscs.forEach((o) => { o.start(now); o.stop(stopAt); });
    lfo.start(now);
    lfo.stop(stopAt);

    return track(engine, newId('mellotronStrings'), amp);
  }

  // Mellotron flute — sine fundamental + filtered breath noise
  function mellotronFlute(engine, frequency, velocity, duration) {
    const ctx = engine.ctx;
    const now = ctx.currentTime;
    const v = velocity == null ? 0.7 : velocity;
    const dur = duration || 1.2;
    const dest = destFor(engine);

    // Sine fundamental
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = frequency;

    // Pitch wobble — 1 Hz LFO, ±3 cents
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 1.0;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 3;
    lfo.connect(lfoGain);
    lfoGain.connect(osc.detune);

    // Breath noise: HP ~600 Hz, very low gain
    const noise = ctx.createBufferSource();
    noise.buffer = engine._whiteNoiseBuffer(Math.max(dur + 0.2, 0.5));
    noise.loop = true;
    const noiseHp = ctx.createBiquadFilter();
    noiseHp.type = 'highpass';
    noiseHp.frequency.value = 600;
    const noiseLp = ctx.createBiquadFilter();
    noiseLp.type = 'lowpass';
    noiseLp.frequency.value = 4000;
    const noiseGain = ctx.createGain();
    noiseGain.gain.value = 0.06;

    // Lowpass ~2 kHz on the whole voice
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 2000;
    lp.Q.value = 0.6;

    // Slow ~80 ms attack
    const amp = ctx.createGain();
    const peak = v * 0.45;
    const release = 0.25;
    amp.gain.setValueAtTime(0, now);
    amp.gain.linearRampToValueAtTime(peak, now + 0.08);
    const sustainEnd = Math.max(now + 0.10, now + dur - release);
    amp.gain.setValueAtTime(peak, sustainEnd);
    amp.gain.exponentialRampToValueAtTime(0.0005, now + dur);

    osc.connect(lp);
    noise.connect(noiseHp);
    noiseHp.connect(noiseLp);
    noiseLp.connect(noiseGain);
    noiseGain.connect(lp);
    lp.connect(amp);

    const tape = tapeSaturate(engine, amp, 0.4);
    tape.connect(dest);

    reverbSend(engine, tape, 0.7);

    const stopAt = now + dur + 0.1;
    osc.start(now);
    osc.stop(stopAt);
    lfo.start(now);
    lfo.stop(stopAt);
    noise.start(now);
    noise.stop(stopAt);

    return track(engine, newId('mellotronFlute'), amp);
  }

  // ---------- export ----------

  window.DowntempoVoices = {
    // Drums
    kick,
    snare,
    snareBrush,
    clap,
    rim,
    hatClosed,
    hatOpen,
    ride,
    shaker,

    // Tonal
    rhodes,
    wurli,
    mellotronStrings,
    mellotronFlute,

    // Helper
    tapeSaturate,
  };
})();
