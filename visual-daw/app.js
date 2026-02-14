/* ============================================
   SoundPrint Visual DAW - Main Application
   Wires together audio engine, visualizer,
   sign language controller, and sequencer
   ============================================ */

(function () {
  'use strict';

  // ---- Core Instances ----
  const audioEngine = new AudioEngine();
  const signController = new SignLanguageController();
  let visualizer = null;
  let sequencer = null;
  let isAudioReady = false;

  // ---- DOM Elements ----
  const btnPlay = document.getElementById('btn-play');
  const btnStop = document.getElementById('btn-stop');
  const btnRewind = document.getElementById('btn-rewind');
  const btnRecord = document.getElementById('btn-record');
  const btnSignLanguage = document.getElementById('btn-sign-language');
  const btnAccessibility = document.getElementById('btn-accessibility');
  const bpmInput = document.getElementById('bpm-input');
  const timeDisplay = document.getElementById('time-display');
  const statusText = document.getElementById('status-text');
  const audioStatus = document.getElementById('audio-status');
  const stepCountSelect = document.getElementById('step-count');
  const scaleSelect = document.getElementById('scale-select');
  const keySelect = document.getElementById('key-select');
  const clearSeqBtn = document.getElementById('clear-seq');
  const addTrackBtn = document.getElementById('add-track-btn');
  const vizCanvas = document.getElementById('main-viz-canvas');
  const a11yOverlay = document.getElementById('a11y-overlay');

  // ---- Initialize Audio on First User Interaction ----
  async function initAudio() {
    if (isAudioReady) return;
    try {
      await audioEngine.init();
      isAudioReady = true;
      audioStatus.textContent = 'Audio: Ready';
      statusText.textContent = 'Audio engine initialized';

      // Init visualizer
      visualizer = new Visualizer(vizCanvas, audioEngine);
      visualizer.start();

      // Init sequencer
      sequencer = new VisualSequencer(audioEngine);
      sequencer.setBPM(parseInt(bpmInput.value));

      // Wire sequencer callbacks
      sequencer.onStepChange = (step) => {
        sequencer.highlightStep(step);
        updateTime();
        updateHapticDisplay();
        updateMixerMeters();

        // Beat flash
        if (step % 4 === 0) {
          doBeatFlash();
        }
      };

      sequencer.onNotePlay = (row, step, note, track) => {
        // Visual feedback when a note plays
        const cells = document.querySelectorAll(`.seq-cell[data-row="${row}"][data-col="${step}"]`);
        cells.forEach(cell => {
          cell.style.boxShadow = `0 0 12px ${note.color}`;
          setTimeout(() => {
            cell.style.boxShadow = '';
          }, 200);
        });
      };

      // Render initial state
      renderSequencer();
      renderTracks();
      renderMixer();
      renderKnobs();

    } catch (err) {
      console.error('Audio init failed:', err);
      audioStatus.textContent = 'Audio: Error';
    }
  }

  // Ensure audio is ready on any interaction
  document.addEventListener('click', initAudio, { once: true });
  document.addEventListener('keydown', initAudio, { once: true });

  // ---- Transport Controls ----
  btnPlay.addEventListener('click', async () => {
    await initAudio();
    await audioEngine.resume();

    if (sequencer && !sequencer.isPlaying) {
      sequencer.play();
      btnPlay.classList.add('active');
      audioStatus.textContent = 'Audio: Playing';
      statusText.textContent = 'Sequencer playing';
    } else if (sequencer && sequencer.isPlaying) {
      sequencer.stop();
      btnPlay.classList.remove('active');
      audioStatus.textContent = 'Audio: Stopped';
    }
  });

  btnStop.addEventListener('click', () => {
    if (sequencer) {
      sequencer.stop();
      sequencer.currentStep = -1;
      sequencer.highlightStep(-1);
    }
    audioEngine.stopAllNotes();
    btnPlay.classList.remove('active');
    btnRecord.classList.remove('active');
    audioStatus.textContent = 'Audio: Stopped';
    timeDisplay.textContent = '0:00.000';
  });

  btnRewind.addEventListener('click', () => {
    if (sequencer) {
      sequencer.currentStep = -1;
    }
    timeDisplay.textContent = '0:00.000';
  });

  btnRecord.addEventListener('click', async () => {
    await initAudio();
    btnRecord.classList.toggle('active');
    statusText.textContent = btnRecord.classList.contains('active')
      ? 'Record armed - play to start recording'
      : 'Record disarmed';
  });

  bpmInput.addEventListener('change', () => {
    const bpm = parseInt(bpmInput.value);
    if (sequencer) {
      sequencer.setBPM(bpm);
    }
  });

  // ---- Visualization Tabs ----
  document.querySelectorAll('.viz-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.viz-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      if (visualizer) {
        visualizer.setMode(tab.dataset.viz);
      }
    });
  });

  // ---- Instrument Selection ----
  document.querySelectorAll('.instrument-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      await initAudio();
      document.querySelectorAll('.instrument-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const instrument = btn.dataset.instrument;
      audioEngine.setWaveform(instrument);
      statusText.textContent = `Instrument: ${btn.querySelector('span').textContent}`;
    });
  });

  // ---- Sequencer Controls ----
  stepCountSelect.addEventListener('change', () => {
    if (sequencer) {
      sequencer.setSteps(parseInt(stepCountSelect.value));
      renderSequencer();
    }
  });

  scaleSelect.addEventListener('change', () => {
    if (sequencer) {
      sequencer.setScale(scaleSelect.value);
      renderSequencer();
    }
  });

  keySelect.addEventListener('change', () => {
    if (sequencer) {
      sequencer.setKey(keySelect.value);
      renderSequencer();
    }
  });

  clearSeqBtn.addEventListener('click', () => {
    if (sequencer) {
      sequencer.clearGrid();
      renderSequencer();
    }
  });

  addTrackBtn.addEventListener('click', () => {
    if (sequencer) {
      const instruments = ['sine', 'square', 'sawtooth', 'triangle', 'drums', 'noise'];
      const names = ['Sine Pad', 'Square Lead', 'Saw Bass', 'Triangle Bell', 'Drum Kit', 'Noise FX'];
      const colors = ['#818cf8', '#ffd60a', '#ff2d55', '#34d399', '#ff6b35', '#c084fc'];

      const idx = sequencer.tracks.length % instruments.length;
      sequencer.addTrack(names[idx], instruments[idx], colors[idx]);
      renderTracks();
      renderMixer();
    }
  });

  // ---- Sign Language Control ----
  btnSignLanguage.addEventListener('click', async () => {
    await initAudio();
    const enabled = signController.toggle();
    btnSignLanguage.classList.toggle('active', enabled);
  });

  // Wire sign language gestures to DAW actions
  signController.onGesture('play', () => {
    btnPlay.click();
  });

  signController.onGesture('stop', () => {
    btnStop.click();
  });

  signController.onGesture('addTrack', () => {
    addTrackBtn.click();
  });

  signController.onGesture('volumeUp', () => {
    const currentVol = parseFloat(bpmInput.value);
    audioEngine.setMasterVolume(Math.min(1.0, (audioEngine.masterGain?.gain.value || 0.7) + 0.1));
    statusText.textContent = 'Volume Up';
  });

  signController.onGesture('volumeDown', () => {
    audioEngine.setMasterVolume(Math.max(0.0, (audioEngine.masterGain?.gain.value || 0.7) - 0.1));
    statusText.textContent = 'Volume Down';
  });

  signController.onGesture('rewind', () => {
    btnRewind.click();
  });

  signController.onGesture('clear', () => {
    clearSeqBtn.click();
  });

  signController.onGesture('selectInstrument_0', () => {
    document.querySelector('[data-instrument="sine"]').click();
  });
  signController.onGesture('selectInstrument_1', () => {
    document.querySelector('[data-instrument="square"]').click();
  });
  signController.onGesture('selectInstrument_2', () => {
    document.querySelector('[data-instrument="sawtooth"]').click();
  });
  signController.onGesture('selectInstrument_3', () => {
    document.querySelector('[data-instrument="triangle"]').click();
  });

  // ---- Accessibility ----
  btnAccessibility.addEventListener('click', () => {
    a11yOverlay.classList.toggle('hidden');
  });

  document.querySelector('.close-overlay').addEventListener('click', () => {
    a11yOverlay.classList.add('hidden');
  });

  document.getElementById('opt-high-contrast').addEventListener('change', (e) => {
    document.body.classList.toggle('high-contrast', e.target.checked);
  });

  document.getElementById('opt-color-blind').addEventListener('change', (e) => {
    document.body.classList.toggle('color-blind-mode', e.target.checked);
  });

  document.getElementById('viz-intensity').addEventListener('input', (e) => {
    if (visualizer) {
      visualizer.setIntensity(parseFloat(e.target.value));
    }
  });

  // ---- Knob Controls ----
  function renderKnobs() {
    document.querySelectorAll('.visual-knob').forEach(knob => {
      const canvas = knob.querySelector('.knob-canvas');
      const ctx = canvas.getContext('2d');
      const valueEl = knob.querySelector('.knob-value');
      const param = knob.dataset.param;
      let value = parseFloat(knob.dataset.value);

      const drawKnob = (val) => {
        ctx.clearRect(0, 0, 60, 60);
        const cx = 30, cy = 30, radius = 22;

        // Background arc
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0.75 * Math.PI, 2.25 * Math.PI);
        ctx.strokeStyle = 'rgba(42, 42, 74, 0.8)';
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';
        ctx.stroke();

        // Value arc
        const startAngle = 0.75 * Math.PI;
        const endAngle = startAngle + val * 1.5 * Math.PI;
        ctx.beginPath();
        ctx.arc(cx, cy, radius, startAngle, endAngle);

        const colors = {
          reverb: '#818cf8',
          delay: '#34d399',
          distortion: '#ff2d55',
          filter: '#ffd60a',
        };
        ctx.strokeStyle = colors[param] || '#818cf8';
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';
        ctx.stroke();

        // Indicator dot
        const dotAngle = endAngle;
        ctx.beginPath();
        ctx.arc(
          cx + Math.cos(dotAngle) * radius,
          cy + Math.sin(dotAngle) * radius,
          4, 0, Math.PI * 2
        );
        ctx.fillStyle = colors[param] || '#818cf8';
        ctx.fill();

        valueEl.textContent = Math.round(val * 100) + '%';
      };

      drawKnob(value);

      // Drag to change value
      let isDragging = false;
      let startY = 0;
      let startValue = 0;

      knob.addEventListener('mousedown', (e) => {
        isDragging = true;
        startY = e.clientY;
        startValue = value;
        e.preventDefault();
      });

      document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        const dy = startY - e.clientY;
        value = Math.max(0, Math.min(1, startValue + dy / 100));
        knob.dataset.value = value;
        drawKnob(value);
        audioEngine.setParam(param, value);
      });

      document.addEventListener('mouseup', () => {
        isDragging = false;
      });

      // Double-click to reset
      knob.addEventListener('dblclick', () => {
        const defaults = { reverb: 0.3, delay: 0.0, distortion: 0.0, filter: 1.0 };
        value = defaults[param] || 0.5;
        knob.dataset.value = value;
        drawKnob(value);
        audioEngine.setParam(param, value);
      });
    });
  }

  // ---- Mixer ----
  function renderMixer() {
    if (!sequencer) return;
    const container = document.getElementById('mixer-channels');
    container.innerHTML = '';

    sequencer.tracks.forEach((track, index) => {
      const channel = document.createElement('div');
      channel.className = 'mixer-channel';
      channel.innerHTML = `
        <div class="mixer-channel-label">${track.name.split(' ')[0]}</div>
        <div class="mixer-fader-container" data-track="${index}">
          <div class="mixer-fader-fill" style="height: ${track.volume * 100}%; background: ${track.color};"></div>
          <div class="mixer-fader-handle" style="bottom: ${track.volume * 100 - 3}%;"></div>
        </div>
        <div class="mixer-meter" data-track="${index}">
          <div class="mixer-meter-fill" style="height: 0%;"></div>
        </div>
      `;

      // Fader interaction
      const faderContainer = channel.querySelector('.mixer-fader-container');
      let faderDragging = false;

      faderContainer.addEventListener('mousedown', (e) => {
        faderDragging = true;
        updateFader(e);
      });

      document.addEventListener('mousemove', (e) => {
        if (faderDragging) updateFader(e);
      });

      document.addEventListener('mouseup', () => {
        faderDragging = false;
      });

      function updateFader(e) {
        const rect = faderContainer.getBoundingClientRect();
        const y = 1 - ((e.clientY - rect.top) / rect.height);
        const vol = Math.max(0, Math.min(1, y));
        track.volume = vol;
        const fill = faderContainer.querySelector('.mixer-fader-fill');
        const handle = faderContainer.querySelector('.mixer-fader-handle');
        fill.style.height = vol * 100 + '%';
        handle.style.bottom = (vol * 100 - 3) + '%';
      }

      container.appendChild(channel);
    });
  }

  function updateMixerMeters() {
    if (!sequencer || !isAudioReady) return;
    const bands = audioEngine.getBandEnergy();
    const meters = document.querySelectorAll('.mixer-meter-fill');
    const totalEnergy = (bands.bass + bands.mid + bands.high) / 3;

    meters.forEach((meter, i) => {
      const track = sequencer.tracks[i];
      if (!track) return;
      const energy = totalEnergy * track.volume * (track.muted ? 0 : 1);
      meter.style.height = Math.min(100, energy * 200) + '%';
    });
  }

  // ---- Haptic Visual Display ----
  function updateHapticDisplay() {
    if (!isAudioReady) return;
    const bands = audioEngine.getBandEnergy();

    const bassPulse = document.getElementById('pulse-bass');
    const midPulse = document.getElementById('pulse-mid');
    const highPulse = document.getElementById('pulse-high');
    const vibBar = document.getElementById('vib-bar');

    if (bassPulse) {
      const bassScale = 1 + bands.bass * 0.5;
      bassPulse.style.transform = `scale(${bassScale})`;
      bassPulse.style.boxShadow = `0 0 ${bands.bass * 30}px rgba(255, 45, 85, ${bands.bass * 0.6})`;
    }

    if (midPulse) {
      const midScale = 1 + bands.mid * 0.4;
      midPulse.style.transform = `scale(${midScale})`;
      midPulse.style.boxShadow = `0 0 ${bands.mid * 25}px rgba(255, 214, 10, ${bands.mid * 0.6})`;
    }

    if (highPulse) {
      const highScale = 1 + bands.high * 0.3;
      highPulse.style.transform = `scale(${highScale})`;
      highPulse.style.boxShadow = `0 0 ${bands.high * 20}px rgba(129, 140, 248, ${bands.high * 0.6})`;
    }

    if (vibBar) {
      const totalEnergy = (bands.bass * 2 + bands.mid + bands.high) / 4;
      vibBar.style.width = Math.min(100, totalEnergy * 200) + '%';
    }
  }

  // ---- Beat Flash ----
  function doBeatFlash() {
    if (!document.getElementById('opt-flash-alerts').checked) return;
    const el = document.getElementById('visualization-area');
    el.classList.add('beat-flash');
    setTimeout(() => el.classList.remove('beat-flash'), 100);
  }

  // ---- Time Display ----
  let startTime = 0;
  function updateTime() {
    if (!sequencer || !sequencer.isPlaying) return;
    const stepDuration = 60 / sequencer.bpm / 4;
    const elapsed = sequencer.currentStep * stepDuration;
    const minutes = Math.floor(elapsed / 60);
    const seconds = Math.floor(elapsed % 60);
    const ms = Math.floor((elapsed % 1) * 1000);
    timeDisplay.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
  }

  // ---- Render Functions ----
  function renderSequencer() {
    if (!sequencer) return;
    sequencer.renderGrid(
      document.getElementById('sequencer-grid'),
      document.getElementById('note-labels')
    );
  }

  function renderTracks() {
    if (!sequencer) return;
    sequencer.renderTracks(document.getElementById('tracks-container'));
  }

  // ---- Keyboard Shortcuts ----
  document.addEventListener('keydown', async (e) => {
    // Space = play/stop
    if (e.code === 'Space' && e.target.tagName !== 'INPUT') {
      e.preventDefault();
      btnPlay.click();
    }

    // Escape = stop
    if (e.code === 'Escape') {
      btnStop.click();
    }

    // 1-6 = instrument select
    if (e.key >= '1' && e.key <= '6' && e.target.tagName !== 'INPUT') {
      const instruments = document.querySelectorAll('.instrument-btn');
      const idx = parseInt(e.key) - 1;
      if (instruments[idx]) instruments[idx].click();
    }

    // C = clear
    if (e.key === 'c' && e.target.tagName !== 'INPUT') {
      clearSeqBtn.click();
    }

    // Tab = next track
    if (e.key === 'Tab' && e.target.tagName !== 'INPUT') {
      e.preventDefault();
      if (sequencer) {
        sequencer.activeTrack = (sequencer.activeTrack + 1) % sequencer.tracks.length;
        renderSequencer();
        renderTracks();
        statusText.textContent = `Track: ${sequencer.tracks[sequencer.activeTrack].name}`;
      }
    }
  });

  // ---- Continuous visual updates ----
  function visualLoop() {
    if (isAudioReady) {
      updateHapticDisplay();
      updateMixerMeters();

      // Update track previews
      if (sequencer && sequencer.isPlaying) {
        sequencer.renderTracks(document.getElementById('tracks-container'));
      }
    }

    requestAnimationFrame(visualLoop);
  }
  requestAnimationFrame(visualLoop);

  // ---- Initial Status ----
  statusText.textContent = 'Click anywhere to initialize audio engine';

  // ---- Latency display ----
  setInterval(() => {
    if (audioEngine.ctx) {
      const latency = audioEngine.ctx.baseLatency || 0;
      document.getElementById('latency-display').textContent =
        `Latency: ${(latency * 1000).toFixed(1)}ms`;
    }
  }, 1000);

})();
