/* ============================================
   SoundPrint Play — kid-friendly skin
   Reuses the audio engine, voice modules, and
   SessionView clip data from /visual-daw/.
   ============================================ */

(function () {
  'use strict';

  // Per-instrument visual mapping (the function the track plays).
  // Falls back to a generic emoji + color if instrument name unknown.
  const TRACK_VISUALS = {
    drums:           { emoji: '🥁', color: '#ff6b35', label: 'BEAT' },
    acid303:         { emoji: '🐍', color: '#ff2d55', label: 'BASS' },
    sawtooth:        { emoji: '🐘', color: '#ff2d55', label: 'BASS' },
    sub:             { emoji: '🐳', color: '#475569', label: 'SUB'  },
    reese:           { emoji: '🌊', color: '#ff2d55', label: 'BASS' },
    m1Stab:          { emoji: '🎹', color: '#ffd60a', label: 'KEYS' },
    square:          { emoji: '🎺', color: '#ffd60a', label: 'LEAD' },
    triangle:        { emoji: '🔔', color: '#ffd60a', label: 'BELL' },
    rhodes:          { emoji: '🎹', color: '#fbbf24', label: 'KEYS' },
    wurli:           { emoji: '🎹', color: '#f59e0b', label: 'KEYS' },
    dnbLead:         { emoji: '⚡', color: '#ffd60a', label: 'ZAP'  },
    growl:           { emoji: '👹', color: '#a855f7', label: 'GROWL' },
    junoPad:         { emoji: '☁️', color: '#818cf8', label: 'PAD'  },
    sine:            { emoji: '☁️', color: '#818cf8', label: 'PAD'  },
    mellotronStrings:{ emoji: '🌫️', color: '#a78bfa', label: 'STRINGS' },
    mellotronFlute:  { emoji: '🪈', color: '#c4b5fd', label: 'FLUTE' },
  };

  // Scene name → kid-friendly emoji + label
  const SCENE_VISUALS = {
    Intro:       { emoji: '😴', label: 'CALM' },
    Build:       { emoji: '🌱', label: 'GROW' },
    Drop:        { emoji: '🎉', label: 'BIG'  },
    Break:       { emoji: '🌬️', label: 'CHILL' },
    Roll:        { emoji: '🎢', label: 'FAST' },
    Beat:        { emoji: '🥁', label: 'BOOM' },
    'Half-Time': { emoji: '🐢', label: 'SLOW' },
    Air:         { emoji: '🌫️', label: 'AIR' },
    Pulse:       { emoji: '💧', label: 'DRIP' },
    Groove:      { emoji: '🌊', label: 'WAVE' },
    Hush:        { emoji: '🤫', label: 'SHHH' },
    Drift:       { emoji: '☁️', label: 'FLY' },
  };

  const CHEERS = [
    'nice!', 'go go go!', 'sounds good!', 'whoa!', 'yes yes yes!',
    'big vibes!', 'keep going!', 'that\'s a banger!', 'ooooh!', 'fire!',
  ];

  // ---- Core ----
  const audio = new AudioEngine();
  const sequencer = new VisualSequencer(audio);
  const session = new SessionView(audio, sequencer);
  let isAudioReady = false;
  let lastSpeechSwap = 0;

  // ---- DOM ----
  const grid = document.getElementById('play-grid');
  const character = document.getElementById('character');
  const speech = document.getElementById('speech');
  const stopBtn = document.getElementById('stop-all');
  const sparkleCanvas = document.getElementById('sparkle-canvas');
  const sparkleCtx = sparkleCanvas.getContext('2d');
  const worldButtons = document.querySelectorAll('.world');

  // ---- Audio init on first user gesture ----
  async function ensureAudio() {
    if (isAudioReady) {
      await audio.resume();
      return;
    }
    await audio.init();
    isAudioReady = true;
    session.bindToSequencer();
    setBodyGenre(session.genreKey);
    sequencer.onStepChange = (step) => {
      if (step % 4 === 0) bopCharacter();
      refreshTilePlayingState();
    };
    session.onTransportNeeded = () => {
      if (!sequencer.isPlaying) sequencer.play();
      character.classList.add('playing');
    };
    session.onGenreChange = (g) => {
      setBodyGenre(session.genreKey);
      renderGrid();
      say(`${g.name.toLowerCase()} time!`);
    };
    renderGrid();
  }

  // ---- Sparkle particles ----
  const sparkles = [];
  function resizeCanvas() {
    sparkleCanvas.width = window.innerWidth * devicePixelRatio;
    sparkleCanvas.height = window.innerHeight * devicePixelRatio;
    sparkleCtx.scale(devicePixelRatio, devicePixelRatio);
  }
  resizeCanvas();
  window.addEventListener('resize', () => {
    sparkleCtx.setTransform(1, 0, 0, 1, 0, 0);
    resizeCanvas();
  });

  function emit(x, y, color) {
    const count = 14;
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.4;
      const speed = 2 + Math.random() * 4;
      sparkles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 1,
        life: 1,
        size: 4 + Math.random() * 4,
        color,
      });
    }
    if (!sparkleLoopRunning) tickSparkles();
  }

  let sparkleLoopRunning = false;
  function tickSparkles() {
    sparkleLoopRunning = true;
    sparkleCtx.clearRect(0, 0, sparkleCanvas.width, sparkleCanvas.height);
    for (let i = sparkles.length - 1; i >= 0; i--) {
      const p = sparkles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.18; // gravity
      p.life -= 0.025;
      if (p.life <= 0) { sparkles.splice(i, 1); continue; }
      sparkleCtx.globalAlpha = Math.max(0, p.life);
      sparkleCtx.fillStyle = p.color;
      sparkleCtx.beginPath();
      sparkleCtx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
      sparkleCtx.fill();
    }
    sparkleCtx.globalAlpha = 1;
    if (sparkles.length > 0) {
      requestAnimationFrame(tickSparkles);
    } else {
      sparkleLoopRunning = false;
      sparkleCtx.clearRect(0, 0, sparkleCanvas.width, sparkleCanvas.height);
    }
  }

  // ---- Character bop on every kick ----
  function bopCharacter() {
    character.classList.add('bop');
    setTimeout(() => character.classList.remove('bop'), 180);
  }

  function say(text) {
    if (Date.now() - lastSpeechSwap < 600) return;
    lastSpeechSwap = Date.now();
    speech.textContent = text;
  }

  // ---- Genre / world selection ----
  function setBodyGenre(key) {
    document.body.dataset.genre = key;
    const g = session.genres[key];
    if (g && g.accent) document.documentElement.style.setProperty('--accent', g.accent);
    worldButtons.forEach(b => b.classList.toggle('active', b.dataset.genre === key));
  }

  worldButtons.forEach((btn) => {
    btn.addEventListener('click', async () => {
      await ensureAudio();
      const key = btn.dataset.genre;
      session.setGenre(key);
    });
  });

  // ---- Render the kid clip grid ----
  function renderGrid() {
    grid.innerHTML = '';
    const g = session.genre;

    g.scenes.forEach((sceneName, sceneIdx) => {
      const sv = SCENE_VISUALS[sceneName] || { emoji: '✨', label: sceneName };
      const rowLabel = document.createElement('div');
      rowLabel.className = 'play-row-label';
      rowLabel.innerHTML = `<span class="row-emoji">${sv.emoji}</span>${sv.label}`;
      grid.appendChild(rowLabel);

      g.tracks.forEach((track, trackIdx) => {
        const clipObj = (g.clips[sceneIdx] || [])[trackIdx];
        const tile = document.createElement('button');
        tile.className = 'play-tile';

        if (!clipObj) {
          tile.classList.add('empty');
          tile.disabled = true;
          tile.innerHTML = '';
          grid.appendChild(tile);
          return;
        }

        const visual = TRACK_VISUALS[track.instrument] || { emoji: '🎶', color: '#818cf8', label: track.name.toUpperCase() };
        tile.style.setProperty('--tile-color', visual.color);
        tile.dataset.scene = sceneIdx;
        tile.dataset.track = trackIdx;
        tile.innerHTML = `
          <span class="tile-emoji">${visual.emoji}</span>
          <span class="tile-name">${visual.label}</span>
        `;

        tile.addEventListener('pointerdown', async (e) => {
          await ensureAudio();
          const ti = parseInt(tile.dataset.track);
          const si = parseInt(tile.dataset.scene);
          if (session.activeClip[ti] === si) {
            session.stopTrack(ti);
          } else {
            session.launchClip(ti, si);
            // Sparkle from the tap point
            const rect = tile.getBoundingClientRect();
            emit(rect.left + rect.width / 2, rect.top + rect.height / 2, visual.color);
            say(CHEERS[Math.floor(Math.random() * CHEERS.length)]);
          }
          refreshTilePlayingState();
        });

        grid.appendChild(tile);
      });
    });

    refreshTilePlayingState();
  }

  function refreshTilePlayingState() {
    const tiles = grid.querySelectorAll('.play-tile[data-track]');
    tiles.forEach((tile) => {
      const si = parseInt(tile.dataset.scene);
      const ti = parseInt(tile.dataset.track);
      tile.classList.toggle('playing', session.activeClip[ti] === si);
    });
    const anyPlaying = session.activeClip.some(c => c !== null);
    character.classList.toggle('playing', anyPlaying);
  }

  // ---- Stop button ----
  stopBtn.addEventListener('click', async () => {
    await ensureAudio();
    session.stopAll();
    sequencer.stop();
    audio.stopAllNotes();
    character.classList.remove('playing');
    say('quiet time 🤫');
    refreshTilePlayingState();
  });

  // ---- iPad gesture defenses ----
  document.addEventListener('gesturestart', (e) => e.preventDefault());
  document.addEventListener('touchmove', (e) => {
    if (e.touches && e.touches.length > 1) e.preventDefault();
  }, { passive: false });

  // ---- Wake lock (keep screen on while playing) ----
  let wakeLock = null;
  async function requestWakeLock() {
    try {
      if ('wakeLock' in navigator) wakeLock = await navigator.wakeLock.request('screen');
    } catch (e) { /* not critical */ }
  }
  document.addEventListener('pointerdown', requestWakeLock, { once: true });

  // ---- First-paint render of placeholder grid (will be replaced after init) ----
  // Tiny placeholder so the page isn't empty before audio init.
  const placeholder = document.createElement('div');
  placeholder.className = 'play-row-label';
  placeholder.style.gridColumn = '1 / -1';
  placeholder.style.padding = '40px 20px';
  placeholder.style.fontSize = '14px';
  placeholder.textContent = 'tap anywhere to wake up the music ✨';
  grid.appendChild(placeholder);

  document.addEventListener('pointerdown', async function firstTouch() {
    document.removeEventListener('pointerdown', firstTouch);
    await ensureAudio();
  }, { once: true });

})();
