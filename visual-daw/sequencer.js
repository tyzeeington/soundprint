/* ============================================
   SoundPrint Visual DAW - Visual Sequencer
   Color-coded step sequencer with scale-aware
   note grid and visual feedback
   ============================================ */

class VisualSequencer {
  constructor(audioEngine) {
    this.audio = audioEngine;
    this.steps = 16;
    this.currentStep = -1;
    this.isPlaying = false;
    this.bpm = 120;
    this.intervalId = null;
    this.key = 'C';
    this.scale = 'major';
    this.octaveRange = [3, 5]; // 3 octaves

    // Grid data: rows (notes) x cols (steps)
    this.grid = [];
    this.notes = [];

    // Tracks
    this.tracks = [
      { name: 'Sine Pad', instrument: 'sine', color: '#818cf8', muted: false, solo: false, volume: 0.8 },
      { name: 'Square Lead', instrument: 'square', color: '#ffd60a', muted: false, solo: false, volume: 0.7 },
      { name: 'Saw Bass', instrument: 'sawtooth', color: '#ff2d55', muted: false, solo: false, volume: 0.75 },
    ];

    this.activeTrack = 0;

    // Scale definitions (semitone intervals from root)
    this.scales = {
      chromatic: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
      major: [0, 2, 4, 5, 7, 9, 11],
      minor: [0, 2, 3, 5, 7, 8, 10],
      pentatonic: [0, 2, 4, 7, 9],
      blues: [0, 3, 5, 6, 7, 10],
    };

    this.noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

    // Callbacks
    this.onStepChange = null;
    this.onNotePlay = null;

    this._buildNotes();
    this._initGrid();
  }

  _buildNotes() {
    this.notes = [];
    const rootIndex = this.noteNames.indexOf(this.key);
    const scaleIntervals = this.scales[this.scale];

    for (let octave = this.octaveRange[1]; octave >= this.octaveRange[0]; octave--) {
      for (let i = scaleIntervals.length - 1; i >= 0; i--) {
        const noteIndex = (rootIndex + scaleIntervals[i]) % 12;
        const noteName = this.noteNames[noteIndex];
        const adjustedOctave = octave + Math.floor((rootIndex + scaleIntervals[i]) / 12);
        const frequency = AudioEngine.noteToFrequency(noteName, adjustedOctave);

        this.notes.push({
          name: noteName,
          octave: adjustedOctave,
          frequency,
          display: `${noteName}${adjustedOctave}`,
          isRoot: scaleIntervals[i] === 0,
          isSharp: noteName.includes('#'),
          color: AudioEngine.frequencyToColor(frequency),
        });
      }
    }

    // Reverse so low notes are at bottom
    this.notes.reverse();
  }

  _initGrid() {
    // Each track has its own grid
    for (const track of this.tracks) {
      if (!track.grid) {
        track.grid = [];
        for (let row = 0; row < this.notes.length; row++) {
          track.grid[row] = new Array(this.steps).fill(false);
        }
      }
    }
  }

  setSteps(count) {
    this.steps = count;
    for (const track of this.tracks) {
      for (let row = 0; row < this.notes.length; row++) {
        if (!track.grid[row]) track.grid[row] = [];
        while (track.grid[row].length < count) track.grid[row].push(false);
      }
    }
  }

  setScale(scale) {
    this.scale = scale;
    this._buildNotes();
    // Reset grids since note count may change
    for (const track of this.tracks) {
      track.grid = [];
      for (let row = 0; row < this.notes.length; row++) {
        track.grid[row] = new Array(this.steps).fill(false);
      }
    }
  }

  setKey(key) {
    this.key = key;
    this._buildNotes();
    for (const track of this.tracks) {
      track.grid = [];
      for (let row = 0; row < this.notes.length; row++) {
        track.grid[row] = new Array(this.steps).fill(false);
      }
    }
  }

  setBPM(bpm) {
    this.bpm = bpm;
    if (this.isPlaying) {
      this.stop();
      this.play();
    }
  }

  toggleCell(row, col, trackIndex = null) {
    const ti = trackIndex !== null ? trackIndex : this.activeTrack;
    const track = this.tracks[ti];
    if (!track || !track.grid[row]) return;
    track.grid[row][col] = !track.grid[row][col];
    return track.grid[row][col];
  }

  clearGrid(trackIndex = null) {
    const ti = trackIndex !== null ? trackIndex : this.activeTrack;
    const track = this.tracks[ti];
    if (!track) return;
    for (let row = 0; row < this.notes.length; row++) {
      track.grid[row] = new Array(this.steps).fill(false);
    }
  }

  clearAllGrids() {
    for (let ti = 0; ti < this.tracks.length; ti++) {
      this.clearGrid(ti);
    }
  }

  addTrack(name, instrument, color) {
    const track = {
      name: name || `Track ${this.tracks.length + 1}`,
      instrument: instrument || 'sine',
      color: color || `hsl(${Math.random() * 360}, 70%, 60%)`,
      muted: false,
      solo: false,
      volume: 0.7,
      grid: [],
    };
    for (let row = 0; row < this.notes.length; row++) {
      track.grid[row] = new Array(this.steps).fill(false);
    }
    this.tracks.push(track);
    return this.tracks.length - 1;
  }

  removeTrack(index) {
    if (this.tracks.length <= 1) return; // Keep at least one track
    this.tracks.splice(index, 1);
    if (this.activeTrack >= this.tracks.length) {
      this.activeTrack = this.tracks.length - 1;
    }
  }

  play() {
    if (this.isPlaying) return;
    this.isPlaying = true;
    this.currentStep = -1;

    const stepDuration = (60 / this.bpm / 4) * 1000; // 16th note

    this.intervalId = setInterval(() => {
      this.currentStep = (this.currentStep + 1) % this.steps;
      this._playStep(this.currentStep);

      if (this.onStepChange) {
        this.onStepChange(this.currentStep);
      }
    }, stepDuration);
  }

  stop() {
    this.isPlaying = false;
    this.currentStep = -1;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.audio.stopAllNotes();
  }

  _playStep(step) {
    const hasSolo = this.tracks.some(t => t.solo);

    for (let ti = 0; ti < this.tracks.length; ti++) {
      const track = this.tracks[ti];

      // Skip muted tracks, or non-solo tracks when solo is active
      if (track.muted) continue;
      if (hasSolo && !track.solo) continue;

      for (let row = 0; row < this.notes.length; row++) {
        if (track.grid[row] && track.grid[row][step]) {
          const note = this.notes[row];
          const prevWaveform = this.audio.waveform;
          this.audio.setWaveform(track.instrument);

          const stepDuration = (60 / this.bpm / 4);
          const lengthMul = track.noteLengthMul || 1;
          const noteId = this.audio.playNote(
            note.frequency,
            track.volume,
            stepDuration * 0.8 * lengthMul
          );

          this.audio.setWaveform(prevWaveform);

          if (this.onNotePlay) {
            this.onNotePlay(row, step, note, track);
          }
        }
      }
    }
  }

  // Render the sequencer grid into the DOM
  renderGrid(container, labelContainer) {
    container.innerHTML = '';
    labelContainer.innerHTML = '';

    // Set grid template
    container.style.gridTemplateColumns = `repeat(${this.steps}, 1fr)`;
    container.style.gridTemplateRows = `repeat(${this.notes.length}, 20px)`;

    const track = this.tracks[this.activeTrack];

    // Note labels
    for (let row = this.notes.length - 1; row >= 0; row--) {
      const note = this.notes[row];
      const label = document.createElement('div');
      label.className = 'note-label' + (note.isSharp ? ' sharp' : '');
      label.textContent = note.display;
      label.style.borderLeft = `3px solid ${note.color}`;
      if (note.isRoot) {
        label.style.fontWeight = 'bold';
        label.style.color = '#e8e8f0';
      }
      labelContainer.appendChild(label);
    }

    // Grid cells
    for (let row = this.notes.length - 1; row >= 0; row--) {
      for (let col = 0; col < this.steps; col++) {
        const cell = document.createElement('div');
        cell.className = 'seq-cell';
        cell.dataset.row = row;
        cell.dataset.col = col;

        if (col % 4 === 0) cell.classList.add('beat-marker');

        if (track.grid[row] && track.grid[row][col]) {
          cell.classList.add('active');
          cell.style.background = this.notes[row].color;
        }

        // Click to toggle
        cell.addEventListener('mousedown', (e) => {
          const r = parseInt(e.target.dataset.row);
          const c = parseInt(e.target.dataset.col);
          const isActive = this.toggleCell(r, c);

          if (isActive) {
            e.target.classList.add('active');
            e.target.style.background = this.notes[r].color;
            // Preview note
            const prevWaveform = this.audio.waveform;
            this.audio.setWaveform(track.instrument);
            this.audio.playNote(this.notes[r].frequency, 0.5, 0.15);
            this.audio.setWaveform(prevWaveform);
          } else {
            e.target.classList.remove('active');
            e.target.style.background = '';
          }
        });

        // Hover preview
        cell.addEventListener('mouseenter', (e) => {
          if (e.buttons === 1) { // Dragging
            const r = parseInt(e.target.dataset.row);
            const c = parseInt(e.target.dataset.col);
            if (!track.grid[r][c]) {
              this.toggleCell(r, c);
              e.target.classList.add('active');
              e.target.style.background = this.notes[r].color;
            }
          }
        });

        container.appendChild(cell);
      }
    }
  }

  // Highlight current step column
  highlightStep(step) {
    const cells = document.querySelectorAll('.seq-cell');
    cells.forEach(cell => {
      cell.classList.remove('playing');
      const col = parseInt(cell.dataset.col);
      if (col === step) {
        cell.classList.add('playing');
      }
    });
  }

  // Render tracks in the track area
  renderTracks(container) {
    container.innerHTML = '';

    this.tracks.forEach((track, index) => {
      const trackEl = document.createElement('div');
      trackEl.className = 'track';
      if (index === this.activeTrack) {
        trackEl.style.background = 'rgba(129, 140, 248, 0.05)';
      }

      trackEl.innerHTML = `
        <div class="track-info" style="cursor: pointer;" data-track="${index}">
          <div class="track-color" style="background: ${track.color}"></div>
          <div class="track-name">${track.name}</div>
        </div>
        <div class="track-controls">
          <button class="track-ctrl-btn ${track.muted ? 'muted' : ''}" data-action="mute" data-track="${index}" title="Mute">M</button>
          <button class="track-ctrl-btn ${track.solo ? 'soloed' : ''}" data-action="solo" data-track="${index}" title="Solo">S</button>
          <button class="track-ctrl-btn" data-action="delete" data-track="${index}" title="Delete">&times;</button>
        </div>
        <div class="track-timeline">
          <canvas class="track-waveform" data-track="${index}"></canvas>
        </div>
      `;

      // Select track
      trackEl.querySelector('.track-info').addEventListener('click', () => {
        this.activeTrack = index;
        this.renderTracks(container);
        this.renderGrid(
          document.getElementById('sequencer-grid'),
          document.getElementById('note-labels')
        );
      });

      // Mute/Solo/Delete
      trackEl.querySelectorAll('.track-ctrl-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const action = e.target.dataset.action;
          const ti = parseInt(e.target.dataset.track);
          if (action === 'mute') {
            this.tracks[ti].muted = !this.tracks[ti].muted;
          } else if (action === 'solo') {
            this.tracks[ti].solo = !this.tracks[ti].solo;
          } else if (action === 'delete') {
            this.removeTrack(ti);
          }
          this.renderTracks(container);
        });
      });

      container.appendChild(trackEl);

      // Draw mini waveform preview on track timeline
      this._drawTrackPreview(trackEl.querySelector('.track-waveform'), track);
    });
  }

  _drawTrackPreview(canvas, track) {
    if (!canvas) return;

    const rect = canvas.parentElement.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;

    const ctx = canvas.getContext('2d');
    const cellWidth = canvas.width / this.steps;

    // Draw step grid
    for (let col = 0; col < this.steps; col++) {
      if (col % 4 === 0) {
        ctx.fillStyle = 'rgba(129, 140, 248, 0.05)';
        ctx.fillRect(col * cellWidth, 0, cellWidth, canvas.height);
      }

      // Check if any note is active in this step
      let hasNote = false;
      let noteColor = track.color;
      for (let row = 0; row < this.notes.length; row++) {
        if (track.grid[row] && track.grid[row][col]) {
          hasNote = true;
          noteColor = this.notes[row].color;
          break;
        }
      }

      if (hasNote) {
        ctx.fillStyle = noteColor + '80'; // Semi-transparent
        ctx.fillRect(
          col * cellWidth + 1,
          canvas.height * 0.2,
          cellWidth - 2,
          canvas.height * 0.6
        );
      }
    }

    // Playhead
    if (this.currentStep >= 0) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.fillRect(this.currentStep * cellWidth, 0, cellWidth, canvas.height);
    }
  }
}

window.VisualSequencer = VisualSequencer;
