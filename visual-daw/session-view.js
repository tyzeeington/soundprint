/* ============================================
   SoundPrint Visual DAW - Session View
   Ableton-style clip launcher with three genre
   banks (House, D&B, Downtempo). Each genre swaps
   BPM, drum-style voicing, instrument lineup, and
   a hand-baked clip grid. All clips live in C major
   pentatonic so any combination sounds intentional.
   ============================================ */

(function () {
  'use strict';

  // Locked C-pentatonic row indices (order produced by sequencer._buildNotes).
  const N = {
    C3: 0, D3: 1, E3: 2, G3: 3, A3: 4,
    C4: 5, D4: 6, E4: 7, G4: 8, A4: 9,
    C5: 10, D5: 11, E5: 12, G5: 13, A5: 14,
  };
  // Drum row -> voice (frequency boundaries set in audio-engine).
  const KICK = N.C3, SNARE = N.C4, CLAP = N.E4, RIM = N.A4;
  const HAT_C = N.C5, HAT_O = N.D5, RIDE = N.G5, SHAKER = N.A5;

  const at = (row, ...cols) => cols.map(col => ({ row, col }));
  const chord = (rows, ...cols) => {
    const out = [];
    rows.forEach(r => cols.forEach(c => out.push({ row: r, col: c })));
    return out;
  };
  const merge = (...lists) => [].concat(...lists);
  const clip = (name, color, notes) => ({ name, color, notes });

  // ---- HOUSE @ 124 BPM ----
  // Four-on-the-floor kick, off-beat hats, classic stabs, deep pad.
  const HOUSE_DRUMS_INTRO = clip('Hat Tease', '#ff6b35', merge(
    at(HAT_C, 2, 6, 10, 14)
  ));
  const HOUSE_DRUMS_BUILD = clip('Four', '#ff6b35', merge(
    at(KICK, 0, 4, 8, 12),
    at(HAT_C, 2, 6, 10, 14)
  ));
  const HOUSE_DRUMS_DROP = clip('Floor', '#ff6b35', merge(
    at(KICK, 0, 4, 8, 12),
    at(HAT_C, 2, 6, 10, 14),
    at(HAT_O, 14),
    at(CLAP, 4, 12)
  ));
  const HOUSE_DRUMS_BREAK = clip('Strip', '#ff6b35', merge(
    at(CLAP, 4, 12),
    at(HAT_C, 2, 6, 10, 14),
    at(SHAKER, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15)
  ));
  const HOUSE_DRUMS_ROLL = clip('Tuff', '#ff6b35', merge(
    at(KICK, 0, 4, 8, 12),
    at(CLAP, 4, 12),
    at(HAT_C, 1, 2, 3, 5, 6, 7, 9, 10, 11, 13, 14),
    at(HAT_O, 7, 15)
  ));

  // House bass: classic pumping pattern (root on 0, rests on the kick, fills around)
  const HOUSE_BASS_BUILD = clip('Pump', '#ff2d55', at(N.C3, 0, 4, 8, 12));
  const HOUSE_BASS_DROP = clip('Drive', '#ff2d55', merge(
    at(N.C3, 2, 3, 6, 7, 10, 11, 14, 15)
  ));
  const HOUSE_BASS_BREAK = clip('Hold', '#ff2d55', at(N.C3, 0));
  const HOUSE_BASS_ROLL = clip('8ths', '#ff2d55', at(N.C3, 0, 2, 4, 6, 8, 10, 12, 14));

  // House keys: chord stabs (square)
  const HOUSE_KEYS_DROP = clip('Stab', '#ffd60a', chord([N.C4, N.E4, N.G4], 2, 6, 10, 14));
  const HOUSE_KEYS_BREAK = clip('Melody', '#ffd60a', [
    { row: N.C4, col: 0 }, { row: N.E4, col: 4 },
    { row: N.G4, col: 8 }, { row: N.E4, col: 12 },
  ]);
  const HOUSE_KEYS_ROLL = clip('Hook', '#ffd60a', [
    { row: N.G4, col: 0 }, { row: N.A4, col: 2 }, { row: N.C5, col: 4 },
    { row: N.A4, col: 6 }, { row: N.G4, col: 8 }, { row: N.E4, col: 10 },
    { row: N.G4, col: 12 }, { row: N.E4, col: 14 },
  ]);

  // House pad: long sustained chords
  const HOUSE_PAD_INTRO = clip('Air', '#818cf8', chord([N.C4, N.E4, N.G4], 0));
  const HOUSE_PAD_BUILD = clip('Hold', '#818cf8', chord([N.C4, N.E4, N.G4], 0));
  const HOUSE_PAD_DROP = clip('Prog', '#818cf8', merge(
    chord([N.C4, N.E4, N.G4], 0),
    chord([N.A3, N.C4, N.E4], 4),
    chord([N.G3, N.C4, N.D4], 8),
    chord([N.C4, N.E4, N.G4], 12)
  ));
  const HOUSE_PAD_BREAK = clip('Float', '#818cf8', chord([N.C4, N.E4, N.G4], 0));

  const HOUSE = {
    name: 'House',
    bpm: 124,
    drumStyle: 'house',
    accent: '#ffb86b',
    description: '124 BPM · 4-on-the-floor · classic stabs',
    tracks: [
      // 909 drums + TB-303 acid bass + M1 organ stab + Juno-60 pad — the deep house DNA
      { name: 'Drums',     instrument: 'drums',   color: '#ff6b35', volume: 0.85, noteLengthMul: 1 },
      { name: '303 Bass',  instrument: 'acid303', color: '#ff2d55', volume: 0.55, noteLengthMul: 1 },
      { name: 'M1 Stab',   instrument: 'm1Stab',  color: '#ffd60a', volume: 0.5,  noteLengthMul: 1 },
      { name: 'Juno Pad',  instrument: 'junoPad', color: '#818cf8', volume: 0.5,  noteLengthMul: 16 },
    ],
    scenes: ['Intro', 'Build', 'Drop', 'Break', 'Roll'],
    clips: [
      [HOUSE_DRUMS_INTRO, null,             null,             HOUSE_PAD_INTRO],
      [HOUSE_DRUMS_BUILD, HOUSE_BASS_BUILD, null,             HOUSE_PAD_BUILD],
      [HOUSE_DRUMS_DROP,  HOUSE_BASS_DROP,  HOUSE_KEYS_DROP,  HOUSE_PAD_DROP],
      [HOUSE_DRUMS_BREAK, HOUSE_BASS_BREAK, HOUSE_KEYS_BREAK, HOUSE_PAD_BREAK],
      [HOUSE_DRUMS_ROLL,  HOUSE_BASS_ROLL,  HOUSE_KEYS_ROLL,  null],
    ],
  };

  // ---- DRUM & BASS @ 174 BPM ----
  // 2-step / amen-style breaks, Reese bass, sparse leads, ambient pad.
  const DNB_DRUMS_INTRO = clip('Tease', '#ff6b35', merge(
    at(HAT_C, 0, 2, 4, 6, 8, 10, 12, 14)
  ));
  const DNB_DRUMS_BEAT = clip('2-Step', '#ff6b35', merge(
    at(KICK, 0, 8),
    at(SNARE, 4, 12),
    at(HAT_C, 0, 2, 4, 6, 8, 10, 12, 14)
  ));
  const DNB_DRUMS_DROP = clip('Amen', '#ff6b35', merge(
    at(KICK, 0, 10),
    at(SNARE, 4, 12),
    at(HAT_C, 1, 3, 5, 7, 9, 11, 13, 15),
    at(HAT_O, 7, 15),
    at(SHAKER, 6, 14)
  ));
  const DNB_DRUMS_HALF = clip('Half', '#ff6b35', merge(
    at(KICK, 0),
    at(SNARE, 8),
    at(HAT_C, 4, 12),
    at(RIDE, 0, 2, 4, 6, 8, 10, 12, 14)
  ));
  const DNB_DRUMS_ROLL = clip('Roller', '#ff6b35', merge(
    at(KICK, 0, 3, 8, 11),
    at(SNARE, 4, 12),
    at(SNARE, 6, 14), // ghost snare
    at(HAT_C, 1, 2, 3, 5, 6, 7, 9, 10, 11, 13, 14, 15),
    at(HAT_O, 15),
    at(RIDE, 0, 8)
  ));

  // Reese bass: sustained low growl
  const DNB_REESE_BEAT = clip('Reese', '#ff2d55', at(N.C3, 0));
  const DNB_REESE_DROP = clip('Move', '#ff2d55', merge(at(N.C3, 0), at(N.E3, 8)));
  const DNB_REESE_HALF = clip('Wide', '#ff2d55', merge(at(N.C3, 0), at(N.G3, 8)));
  const DNB_REESE_ROLL = clip('Pulse', '#ff2d55', at(N.C3, 0, 8));

  // D&B leads: high arps / sparse stabs
  const DNB_LEAD_INTRO = clip('Sparkle', '#ffd60a', [
    { row: N.C5, col: 0 }, { row: N.E5, col: 4 },
    { row: N.G5, col: 8 }, { row: N.A5, col: 12 },
  ]);
  const DNB_LEAD_HALF = clip('Stab', '#ffd60a', merge(
    at(N.C4, 0, 8),
    at(N.E4, 4, 12)
  ));

  // D&B atmos pad (sine, very long sustain)
  const DNB_PAD_INTRO = clip('Air', '#818cf8', chord([N.C4, N.E4, N.G4], 0));
  const DNB_PAD_BEAT = clip('Wash', '#818cf8', chord([N.C4, N.E4, N.G4], 0));
  const DNB_PAD_DROP = clip('Drift', '#818cf8', merge(
    chord([N.C4, N.E4, N.G4], 0),
    chord([N.A3, N.C4, N.E4], 8)
  ));
  const DNB_PAD_HALF = clip('Vapor', '#818cf8', merge(
    chord([N.C4, N.E4], 0),
    chord([N.A3, N.C4], 8)
  ));

  const DNB = {
    name: 'D&B',
    bpm: 174,
    drumStyle: 'dnb',
    accent: '#5eead4',
    description: '174 BPM · breakbeats · Reese bass',
    tracks: [
      // Tight breakbeat drums + Reese (Casio CZ-5000 lineage) + neuro lead + ambient pad
      { name: 'Drums', instrument: 'drums',   color: '#ff6b35', volume: 0.8,  noteLengthMul: 1 },
      { name: 'Reese', instrument: 'reese',   color: '#ff2d55', volume: 0.45, noteLengthMul: 8 },
      { name: 'Lead',  instrument: 'dnbLead', color: '#ffd60a', volume: 0.4,  noteLengthMul: 1 },
      { name: 'Atmos', instrument: 'sine',    color: '#818cf8', volume: 0.45, noteLengthMul: 16 },
    ],
    scenes: ['Intro', 'Beat', 'Drop', 'Half-Time', 'Roll'],
    clips: [
      [DNB_DRUMS_INTRO, null,           DNB_LEAD_INTRO, DNB_PAD_INTRO],
      [DNB_DRUMS_BEAT,  DNB_REESE_BEAT, null,           DNB_PAD_BEAT],
      [DNB_DRUMS_DROP,  DNB_REESE_DROP, null,           DNB_PAD_DROP],
      [DNB_DRUMS_HALF,  DNB_REESE_HALF, DNB_LEAD_HALF,  DNB_PAD_HALF],
      [DNB_DRUMS_ROLL,  DNB_REESE_ROLL, null,           null],
    ],
  };

  // ---- DOWNTEMPO @ 88 BPM ----
  // Sparse drums, deep sub bass, gentle Rhodes-like keys, lush pad.
  const DT_DRUMS_AIR = clip('Air', '#ff6b35', merge(
    at(HAT_C, 4, 12),
    at(SHAKER, 2, 6, 10, 14)
  ));
  const DT_DRUMS_PULSE = clip('Pulse', '#ff6b35', merge(
    at(KICK, 0, 8),
    at(HAT_C, 4, 12),
    at(SHAKER, 2, 6, 10, 14)
  ));
  const DT_DRUMS_GROOVE = clip('Groove', '#ff6b35', merge(
    at(KICK, 0, 10),
    at(SNARE, 8),
    at(HAT_C, 2, 6, 12, 14),
    at(SHAKER, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15)
  ));
  const DT_DRUMS_HUSH = clip('Hush', '#ff6b35', merge(
    at(RIM, 4, 12),
    at(HAT_C, 2, 6, 10, 14)
  ));
  const DT_DRUMS_DRIFT = clip('Drift', '#ff6b35', merge(
    at(KICK, 0, 8),
    at(SNARE, 8),
    at(RIDE, 0, 2, 4, 6, 8, 10, 12, 14)
  ));

  // Sub bass clips (very long sustain via noteLengthMul)
  const DT_SUB_PULSE = clip('Pulse', '#ff2d55', at(N.C3, 0));
  const DT_SUB_GROOVE = clip('Move', '#ff2d55', merge(at(N.C3, 0), at(N.E3, 8)));
  const DT_SUB_HUSH = clip('Deep', '#ff2d55', at(N.C3, 0));
  const DT_SUB_DRIFT = clip('Riff', '#ff2d55', merge(at(N.C3, 0), at(N.A3, 8)));

  // Keys (triangle = bell-like)
  const DT_KEYS_AIR = clip('Drops', '#ffd60a', [
    { row: N.C4, col: 0 }, { row: N.E4, col: 4 },
    { row: N.G4, col: 8 }, { row: N.A4, col: 12 },
  ]);
  const DT_KEYS_GROOVE = clip('Spiral', '#ffd60a', [
    { row: N.C4, col: 0 }, { row: N.E4, col: 2 }, { row: N.G4, col: 4 },
    { row: N.A4, col: 6 }, { row: N.G4, col: 8 }, { row: N.E4, col: 10 },
    { row: N.D4, col: 12 }, { row: N.C4, col: 14 },
  ]);
  const DT_KEYS_HUSH = clip('Sparse', '#ffd60a', [
    { row: N.C4, col: 0 }, { row: N.E4, col: 6 }, { row: N.C4, col: 10 },
  ]);
  const DT_KEYS_DRIFT = clip('Lullaby', '#ffd60a', [
    { row: N.D4, col: 0 }, { row: N.G4, col: 4 },
    { row: N.E4, col: 8 }, { row: N.C4, col: 12 },
  ]);

  // Pad
  const DT_PAD_AIR = clip('Bloom', '#818cf8', chord([N.C4, N.E4, N.G4], 0));
  const DT_PAD_PULSE = clip('Hold', '#818cf8', chord([N.C4, N.E4, N.G4], 0));
  const DT_PAD_GROOVE = clip('Shift', '#818cf8', merge(
    chord([N.C4, N.E4, N.G4], 0),
    chord([N.A3, N.C4, N.E4], 8)
  ));
  const DT_PAD_HUSH = clip('Quiet', '#818cf8', merge(
    chord([N.C4, N.E4], 0),
    chord([N.G3, N.D4], 8)
  ));
  const DT_PAD_DRIFT = clip('Wide', '#818cf8', chord([N.C4, N.E4, N.G4], 0));

  const DOWNTEMPO = {
    name: 'Downtempo',
    bpm: 88,
    drumStyle: 'downtempo',
    accent: '#c084fc',
    description: '88 BPM · sparse · deep sub',
    tracks: [
      // Soft drums + sub bass + Rhodes EP + Mellotron strings — the Bonobo / Tycho lineage
      { name: 'Drums',  instrument: 'drums',            color: '#ff6b35', volume: 0.7, noteLengthMul: 1 },
      { name: 'Sub',    instrument: 'sub',              color: '#ff2d55', volume: 0.6, noteLengthMul: 8 },
      { name: 'Rhodes', instrument: 'rhodes',           color: '#ffd60a', volume: 0.5, noteLengthMul: 4 },
      { name: 'Mello',  instrument: 'mellotronStrings', color: '#818cf8', volume: 0.5, noteLengthMul: 16 },
    ],
    scenes: ['Air', 'Pulse', 'Groove', 'Hush', 'Drift'],
    clips: [
      [DT_DRUMS_AIR,    null,         DT_KEYS_AIR,    DT_PAD_AIR],
      [DT_DRUMS_PULSE,  DT_SUB_PULSE, null,           DT_PAD_PULSE],
      [DT_DRUMS_GROOVE, DT_SUB_GROOVE, DT_KEYS_GROOVE, DT_PAD_GROOVE],
      [DT_DRUMS_HUSH,   DT_SUB_HUSH,  DT_KEYS_HUSH,   DT_PAD_HUSH],
      [DT_DRUMS_DRIFT,  DT_SUB_DRIFT, DT_KEYS_DRIFT,  DT_PAD_DRIFT],
    ],
  };

  const GENRES = { house: HOUSE, dnb: DNB, downtempo: DOWNTEMPO };

  class SessionView {
    constructor(audioEngine, sequencer) {
      this.audio = audioEngine;
      this.seq = sequencer;
      this.genres = GENRES;
      this.genreKey = 'house';
      this.activeClip = [];
      this.container = null;
      this.headerEl = null;
      this.onTransportNeeded = null;
      this.onGenreChange = null;
    }

    get genre() { return this.genres[this.genreKey]; }

    bindToSequencer() {
      this.seq.setSteps(16);
      this.seq.setKey('C');
      this.seq.setScale('pentatonic');
      this.applyGenreToSequencer();
    }

    applyGenreToSequencer() {
      const g = this.genre;
      this.seq.setBPM(g.bpm);
      if (this.audio && this.audio.setDrumStyle) this.audio.setDrumStyle(g.drumStyle);
      this.seq.tracks = g.tracks.map((def) => ({
        name: def.name,
        instrument: def.instrument,
        color: def.color,
        muted: false,
        solo: false,
        volume: def.volume,
        noteLengthMul: def.noteLengthMul || 1,
        grid: this._emptyGrid(),
      }));
      this.activeClip = g.tracks.map(() => null);
      this.seq.activeTrack = 0;
    }

    setGenre(key) {
      if (!this.genres[key] || key === this.genreKey) return;
      this.genreKey = key;
      this.applyGenreToSequencer();
      if (this.container) this.render(this.container);
      if (this.onGenreChange) this.onGenreChange(this.genre);
    }

    _emptyGrid() {
      const rows = this.seq.notes.length;
      const grid = new Array(rows);
      for (let r = 0; r < rows; r++) grid[r] = new Array(this.seq.steps).fill(false);
      return grid;
    }

    _clipToGrid(clipObj) {
      const grid = this._emptyGrid();
      if (!clipObj) return grid;
      clipObj.notes.forEach(({ row, col }) => {
        if (row >= 0 && row < grid.length && col >= 0 && col < this.seq.steps) {
          grid[row][col] = true;
        }
      });
      return grid;
    }

    launchClip(trackIdx, sceneIdx) {
      const track = this.seq.tracks[trackIdx];
      if (!track) return;
      const cell = (this.genre.clips[sceneIdx] || [])[trackIdx];
      if (!cell) {
        track.grid = this._emptyGrid();
        this.activeClip[trackIdx] = null;
      } else {
        track.grid = this._clipToGrid(cell);
        this.activeClip[trackIdx] = sceneIdx;
        if (this.audio && this.audio.resume) this.audio.resume();
        if (!this.seq.isPlaying && this.onTransportNeeded) this.onTransportNeeded();
      }
      this._refreshGridUI();
    }

    stopTrack(trackIdx) {
      const track = this.seq.tracks[trackIdx];
      if (!track) return;
      track.grid = this._emptyGrid();
      this.activeClip[trackIdx] = null;
      this._refreshGridUI();
    }

    launchScene(sceneIdx) {
      this.genre.tracks.forEach((_, trackIdx) => this.launchClip(trackIdx, sceneIdx));
    }

    stopAll() {
      this.genre.tracks.forEach((_, trackIdx) => this.stopTrack(trackIdx));
    }

    render(container) {
      this.container = container;
      container.innerHTML = '';

      const g = this.genre;
      const trackCount = g.tracks.length;

      // ---- Genre selector header ----
      const header = document.createElement('div');
      header.className = 'session-genre-bar';
      header.innerHTML = `
        <div class="genre-tabs">
          ${Object.entries(this.genres).map(([key, data]) => `
            <button class="genre-tab ${key === this.genreKey ? 'active' : ''}" data-genre="${key}">
              <span class="genre-tab-name">${data.name}</span>
              <span class="genre-tab-meta">${data.description}</span>
            </button>
          `).join('')}
        </div>
      `;
      header.addEventListener('click', (e) => {
        const tab = e.target.closest('[data-genre]');
        if (tab) this.setGenre(tab.dataset.genre);
      });
      container.appendChild(header);

      // ---- Clip grid ----
      const grid = document.createElement('div');
      grid.className = 'session-grid';
      grid.style.gridTemplateColumns = `110px repeat(${trackCount}, minmax(140px, 1fr)) 80px`;
      grid.style.setProperty('--genre-accent', g.accent);

      const corner = document.createElement('div');
      corner.className = 'session-cell session-corner';
      corner.textContent = 'SCENES';
      grid.appendChild(corner);

      g.tracks.forEach((t, idx) => {
        const head = document.createElement('div');
        head.className = 'session-cell session-track-head';
        head.style.borderTop = `3px solid ${t.color}`;
        head.innerHTML = `
          <div class="track-head-name">${t.name}</div>
          <button class="track-head-stop" data-stop="${idx}" title="Stop track">&#9632;</button>
        `;
        grid.appendChild(head);
      });

      const stopAllHead = document.createElement('div');
      stopAllHead.className = 'session-cell session-track-head session-stopall-head';
      stopAllHead.innerHTML = `<button class="track-head-stop big" data-stopall title="Stop all">&#9632; ALL</button>`;
      grid.appendChild(stopAllHead);

      g.scenes.forEach((name, sceneIdx) => {
        const sceneLabel = document.createElement('div');
        sceneLabel.className = 'session-cell session-scene-label';
        sceneLabel.dataset.scene = sceneIdx;
        sceneLabel.style.cursor = 'pointer';
        sceneLabel.innerHTML = `
          <span class="scene-name">${name}</span>
          <button class="scene-launch" data-scene="${sceneIdx}" title="Launch scene">&#9654;</button>
        `;
        grid.appendChild(sceneLabel);

        g.tracks.forEach((t, trackIdx) => {
          const cell = document.createElement('div');
          cell.className = 'session-cell session-clip';
          const clipObj = (g.clips[sceneIdx] || [])[trackIdx];
          if (clipObj) {
            cell.classList.add('has-clip');
            cell.style.setProperty('--clip-color', clipObj.color);
            cell.dataset.scene = sceneIdx;
            cell.dataset.track = trackIdx;
            cell.innerHTML = `
              <span class="clip-launch">&#9654;</span>
              <span class="clip-name">${clipObj.name}</span>
            `;
          } else {
            cell.classList.add('empty');
          }
          grid.appendChild(cell);
        });

        const spacer = document.createElement('div');
        spacer.className = 'session-cell session-spacer';
        grid.appendChild(spacer);
      });

      container.appendChild(grid);
      this._wireGrid(grid);
      this._refreshGridUI();
    }

    _wireGrid(gridEl) {
      gridEl.addEventListener('click', (e) => {
        if (e.target.closest('[data-stopall]')) { this.stopAll(); return; }
        const stopBtn = e.target.closest('[data-stop]');
        if (stopBtn) { this.stopTrack(parseInt(stopBtn.dataset.stop)); return; }
        const sceneBtn = e.target.closest('[data-scene]');
        if (sceneBtn && !sceneBtn.dataset.track) {
          this.launchScene(parseInt(sceneBtn.dataset.scene));
          return;
        }
        const clipCell = e.target.closest('.session-clip.has-clip');
        if (clipCell) {
          const sceneIdx = parseInt(clipCell.dataset.scene);
          const trackIdx = parseInt(clipCell.dataset.track);
          if (this.activeClip[trackIdx] === sceneIdx) {
            this.stopTrack(trackIdx);
          } else {
            this.launchClip(trackIdx, sceneIdx);
          }
        }
      });
    }

    _refreshGridUI() {
      if (!this.container) return;
      const cells = this.container.querySelectorAll('.session-clip');
      cells.forEach((cell) => {
        if (!cell.classList.contains('has-clip')) return;
        const sceneIdx = parseInt(cell.dataset.scene);
        const trackIdx = parseInt(cell.dataset.track);
        cell.classList.toggle('playing', this.activeClip[trackIdx] === sceneIdx);
      });
      const sceneLabels = this.container.querySelectorAll('.session-scene-label');
      sceneLabels.forEach((label, sceneIdx) => {
        const rowClips = this.genre.clips[sceneIdx] || [];
        const allMatch = rowClips.every((c, ti) => !c || this.activeClip[ti] === sceneIdx);
        const someActive = rowClips.some((c, ti) => c && this.activeClip[ti] === sceneIdx);
        label.classList.toggle('row-playing', allMatch && someActive);
      });
    }

    onStep(step) {
      if (step % 4 !== 0) return;
      if (!this.container) return;
      const cells = this.container.querySelectorAll('.session-clip.playing');
      cells.forEach((cell) => {
        cell.classList.add('beat');
        setTimeout(() => cell.classList.remove('beat'), 90);
      });
    }
  }

  window.SessionView = SessionView;
})();
