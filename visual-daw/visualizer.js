/* ============================================
   SoundPrint Visual DAW - Visualizer Engine
   Multiple visualization modes that translate
   audio into rich visual feedback
   ============================================ */

class Visualizer {
  constructor(canvas, audioEngine) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.audio = audioEngine;
    this.mode = 'spectrum';
    this.animationId = null;
    this.isRunning = false;
    this.intensity = 1.0;
    this.particles = [];
    this.spectrogramData = [];
    this.spectrogramX = 0;

    // Chromatic circle state
    this.chromaticAngles = new Float32Array(12).fill(0);

    this._resize();
    window.addEventListener('resize', () => this._resize());
  }

  _resize() {
    const rect = this.canvas.parentElement.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = rect.width * dpr;
    this.canvas.height = (rect.height - 56) * dpr; // Subtract tabs + legend
    this.canvas.style.width = rect.width + 'px';
    this.canvas.style.height = (rect.height - 56) + 'px';
    this.ctx.scale(dpr, dpr);
    this.width = rect.width;
    this.height = rect.height - 56;
  }

  setMode(mode) {
    this.mode = mode;
    if (mode === 'spectrogram') {
      this.spectrogramData = [];
      this.spectrogramX = 0;
    }
    if (mode === 'particles') {
      this._initParticles();
    }
  }

  setIntensity(value) {
    this.intensity = value;
  }

  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this._render();
  }

  stop() {
    this.isRunning = false;
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  _render() {
    if (!this.isRunning) return;

    this.ctx.clearRect(0, 0, this.width, this.height);

    switch (this.mode) {
      case 'spectrum':
        this._renderSpectrum();
        break;
      case 'waveform':
        this._renderWaveform();
        break;
      case 'chromatic':
        this._renderChromaticCircle();
        break;
      case 'particles':
        this._renderParticleField();
        break;
      case 'spectrogram':
        this._renderSpectrogram();
        break;
    }

    this.animationId = requestAnimationFrame(() => this._render());
  }

  /* ---- Spectrum Bars ---- */
  _renderSpectrum() {
    const freqData = this.audio.getFrequencyData();
    if (!freqData.length) {
      this._renderIdleSpectrum();
      return;
    }

    const barCount = 64;
    const barWidth = this.width / barCount - 2;
    const binStep = Math.floor(freqData.length / barCount);

    for (let i = 0; i < barCount; i++) {
      // Average a few bins for smoother display
      let sum = 0;
      for (let j = 0; j < binStep; j++) {
        sum += freqData[i * binStep + j];
      }
      const value = (sum / binStep / 255) * this.intensity;
      const barHeight = value * this.height * 0.85;

      // Frequency-mapped color
      const hue = (i / barCount) * 300;
      const lightness = 40 + value * 30;

      this.ctx.fillStyle = `hsl(${hue}, 85%, ${lightness}%)`;

      // Main bar
      const x = i * (barWidth + 2) + 1;
      const y = this.height - barHeight;
      this.ctx.fillRect(x, y, barWidth, barHeight);

      // Glow effect
      this.ctx.shadowColor = `hsl(${hue}, 85%, 60%)`;
      this.ctx.shadowBlur = value * 15;
      this.ctx.fillRect(x, y, barWidth, 2);
      this.ctx.shadowBlur = 0;

      // Reflection
      this.ctx.globalAlpha = 0.15;
      this.ctx.fillStyle = `hsl(${hue}, 85%, ${lightness}%)`;
      this.ctx.fillRect(x, this.height, barWidth, -barHeight * 0.2);
      this.ctx.globalAlpha = 1;
    }
  }

  _renderIdleSpectrum() {
    const barCount = 64;
    const barWidth = this.width / barCount - 2;
    const time = Date.now() / 1000;

    for (let i = 0; i < barCount; i++) {
      const wave = Math.sin(time * 2 + i * 0.3) * 0.5 + 0.5;
      const barHeight = wave * 20 + 4;
      const hue = (i / barCount) * 300;

      this.ctx.fillStyle = `hsla(${hue}, 60%, 40%, 0.4)`;
      const x = i * (barWidth + 2) + 1;
      this.ctx.fillRect(x, this.height - barHeight, barWidth, barHeight);
    }

    // "Waiting for audio" text
    this.ctx.fillStyle = 'rgba(152, 152, 176, 0.5)';
    this.ctx.font = '14px monospace';
    this.ctx.textAlign = 'center';
    this.ctx.fillText('Play something to see the visualization', this.width / 2, this.height / 2);
    this.ctx.textAlign = 'left';
  }

  /* ---- Waveform ---- */
  _renderWaveform() {
    const timeData = this.audio.getTimeDomainData();
    if (!timeData.length) {
      this._renderIdleWaveform();
      return;
    }

    const sliceWidth = this.width / timeData.length;

    // Draw filled waveform
    this.ctx.beginPath();
    this.ctx.moveTo(0, this.height / 2);

    for (let i = 0; i < timeData.length; i++) {
      const v = timeData[i] / 128.0;
      const y = (v * this.height * this.intensity) / 2;
      this.ctx.lineTo(i * sliceWidth, y);
    }

    this.ctx.lineTo(this.width, this.height / 2);

    // Gradient fill
    const gradient = this.ctx.createLinearGradient(0, 0, this.width, 0);
    gradient.addColorStop(0, 'rgba(255, 45, 85, 0.3)');
    gradient.addColorStop(0.25, 'rgba(255, 107, 53, 0.3)');
    gradient.addColorStop(0.5, 'rgba(255, 214, 10, 0.3)');
    gradient.addColorStop(0.75, 'rgba(52, 211, 153, 0.3)');
    gradient.addColorStop(1, 'rgba(129, 140, 248, 0.3)');
    this.ctx.fillStyle = gradient;
    this.ctx.fill();

    // Draw line
    this.ctx.beginPath();
    for (let i = 0; i < timeData.length; i++) {
      const v = timeData[i] / 128.0;
      const y = (v * this.height * this.intensity) / 2;
      if (i === 0) this.ctx.moveTo(0, y);
      else this.ctx.lineTo(i * sliceWidth, y);
    }

    const lineGrad = this.ctx.createLinearGradient(0, 0, this.width, 0);
    lineGrad.addColorStop(0, '#ff2d55');
    lineGrad.addColorStop(0.25, '#ff6b35');
    lineGrad.addColorStop(0.5, '#ffd60a');
    lineGrad.addColorStop(0.75, '#34d399');
    lineGrad.addColorStop(1, '#818cf8');

    this.ctx.strokeStyle = lineGrad;
    this.ctx.lineWidth = 2;
    this.ctx.stroke();

    // Center line
    this.ctx.strokeStyle = 'rgba(129, 140, 248, 0.2)';
    this.ctx.lineWidth = 1;
    this.ctx.setLineDash([4, 4]);
    this.ctx.beginPath();
    this.ctx.moveTo(0, this.height / 2);
    this.ctx.lineTo(this.width, this.height / 2);
    this.ctx.stroke();
    this.ctx.setLineDash([]);
  }

  _renderIdleWaveform() {
    const time = Date.now() / 1000;
    this.ctx.beginPath();
    for (let x = 0; x < this.width; x++) {
      const y = this.height / 2 + Math.sin(x * 0.02 + time * 2) * 15 +
        Math.sin(x * 0.01 + time * 1.5) * 10;
      if (x === 0) this.ctx.moveTo(x, y);
      else this.ctx.lineTo(x, y);
    }
    this.ctx.strokeStyle = 'rgba(129, 140, 248, 0.3)';
    this.ctx.lineWidth = 2;
    this.ctx.stroke();

    this.ctx.fillStyle = 'rgba(152, 152, 176, 0.5)';
    this.ctx.font = '14px monospace';
    this.ctx.textAlign = 'center';
    this.ctx.fillText('Play something to see the waveform', this.width / 2, this.height / 2 - 30);
    this.ctx.textAlign = 'left';
  }

  /* ---- Chromatic Circle ---- */
  _renderChromaticCircle() {
    const freqData = this.audio.getFrequencyData();
    const cx = this.width / 2;
    const cy = this.height / 2;
    const maxRadius = Math.min(cx, cy) - 20;
    const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const noteColors = [
      '#ff2d55', '#ff4d6a', '#ff6b35', '#ff8a50',
      '#ffd60a', '#ffe040', '#34d399', '#4eeab0',
      '#818cf8', '#9ba3ff', '#c084fc', '#d4a3ff'
    ];

    // Background circle
    this.ctx.beginPath();
    this.ctx.arc(cx, cy, maxRadius + 5, 0, Math.PI * 2);
    this.ctx.strokeStyle = 'rgba(42, 42, 74, 0.5)';
    this.ctx.lineWidth = 1;
    this.ctx.stroke();

    // Analyze energy per note
    const noteEnergy = new Float32Array(12);
    if (freqData.length) {
      const binCount = freqData.length;
      const nyquist = 22050; // Approximate
      for (let i = 0; i < binCount; i++) {
        const freq = (i / binCount) * nyquist;
        if (freq < 20 || freq > 5000) continue;
        // Determine which note this frequency maps to
        const noteNum = Math.round(12 * Math.log2(freq / 261.63)) % 12;
        const idx = ((noteNum % 12) + 12) % 12;
        noteEnergy[idx] += freqData[i] / 255;
      }
      // Normalize
      const maxEnergy = Math.max(...noteEnergy, 1);
      for (let i = 0; i < 12; i++) {
        noteEnergy[i] = (noteEnergy[i] / maxEnergy) * this.intensity;
        // Smooth
        this.chromaticAngles[i] = this.chromaticAngles[i] * 0.85 + noteEnergy[i] * 0.15;
      }
    }

    // Draw note segments
    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2 - Math.PI / 2;
      const nextAngle = ((i + 1) / 12) * Math.PI * 2 - Math.PI / 2;
      const energy = this.chromaticAngles[i];
      const radius = maxRadius * 0.3 + maxRadius * 0.7 * Math.max(0.1, energy);

      // Filled segment
      this.ctx.beginPath();
      this.ctx.moveTo(cx, cy);
      this.ctx.arc(cx, cy, radius, angle, nextAngle);
      this.ctx.closePath();
      this.ctx.fillStyle = noteColors[i] + Math.floor(40 + energy * 180).toString(16).padStart(2, '0');
      this.ctx.fill();

      // Note label
      const labelRadius = maxRadius + 15;
      const midAngle = (angle + nextAngle) / 2;
      const lx = cx + Math.cos(midAngle) * labelRadius;
      const ly = cy + Math.sin(midAngle) * labelRadius;
      this.ctx.fillStyle = energy > 0.3 ? noteColors[i] : 'rgba(152, 152, 176, 0.6)';
      this.ctx.font = `${energy > 0.3 ? 'bold ' : ''}11px monospace`;
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.fillText(notes[i], lx, ly);
    }

    // Center dot
    this.ctx.beginPath();
    this.ctx.arc(cx, cy, 4, 0, Math.PI * 2);
    this.ctx.fillStyle = 'rgba(129, 140, 248, 0.6)';
    this.ctx.fill();

    this.ctx.textAlign = 'left';
    this.ctx.textBaseline = 'alphabetic';
  }

  /* ---- Particle Field ---- */
  _initParticles() {
    this.particles = [];
    for (let i = 0; i < 200; i++) {
      this.particles.push({
        x: Math.random() * this.width,
        y: Math.random() * this.height,
        vx: (Math.random() - 0.5) * 2,
        vy: (Math.random() - 0.5) * 2,
        size: Math.random() * 3 + 1,
        hue: Math.random() * 300,
        life: 1,
      });
    }
  }

  _renderParticleField() {
    const freqData = this.audio.getFrequencyData();
    const bands = this.audio.getBandEnergy();

    // Background fade
    this.ctx.fillStyle = 'rgba(10, 10, 15, 0.15)';
    this.ctx.fillRect(0, 0, this.width, this.height);

    if (!this.particles.length) this._initParticles();

    const bassForce = bands.bass * this.intensity * 5;
    const midForce = bands.mid * this.intensity * 3;
    const highForce = bands.high * this.intensity * 2;

    for (const p of this.particles) {
      // Physics influenced by audio
      p.vx += (Math.random() - 0.5) * bassForce * 0.5;
      p.vy += (Math.random() - 0.5) * bassForce * 0.5;
      p.vx *= 0.98;
      p.vy *= 0.98;
      p.x += p.vx;
      p.y += p.vy;

      // Wrap around
      if (p.x < 0) p.x = this.width;
      if (p.x > this.width) p.x = 0;
      if (p.y < 0) p.y = this.height;
      if (p.y > this.height) p.y = 0;

      // Size pulsing with mid frequencies
      const size = p.size + midForce * 2;

      // Color shifting with high frequencies
      const hue = (p.hue + highForce * 50) % 360;

      // Draw particle
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
      this.ctx.fillStyle = `hsla(${hue}, 80%, 60%, ${0.3 + bands.bass * 0.5})`;
      this.ctx.fill();

      // Glow
      if (size > 2) {
        this.ctx.beginPath();
        this.ctx.arc(p.x, p.y, size * 2, 0, Math.PI * 2);
        this.ctx.fillStyle = `hsla(${hue}, 80%, 60%, 0.1)`;
        this.ctx.fill();
      }
    }

    // Draw connections between nearby particles when bass hits
    if (bands.bass > 0.3) {
      for (let i = 0; i < this.particles.length; i++) {
        for (let j = i + 1; j < this.particles.length; j++) {
          const dx = this.particles[i].x - this.particles[j].x;
          const dy = this.particles[i].y - this.particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 60) {
            this.ctx.beginPath();
            this.ctx.moveTo(this.particles[i].x, this.particles[i].y);
            this.ctx.lineTo(this.particles[j].x, this.particles[j].y);
            this.ctx.strokeStyle = `rgba(129, 140, 248, ${0.1 * (1 - dist / 60)})`;
            this.ctx.lineWidth = 0.5;
            this.ctx.stroke();
          }
        }
      }
    }
  }

  /* ---- Spectrogram ---- */
  _renderSpectrogram() {
    const freqData = this.audio.getFrequencyData();
    if (!freqData.length) return;

    // Store current column
    const column = new Uint8Array(freqData);
    this.spectrogramData.push(column);

    // Only keep enough columns to fill the screen
    const maxColumns = Math.ceil(this.width / 2);
    if (this.spectrogramData.length > maxColumns) {
      this.spectrogramData.shift();
    }

    // Render all columns
    this.ctx.clearRect(0, 0, this.width, this.height);

    const colWidth = 2;
    const binHeight = this.height / freqData.length;

    for (let col = 0; col < this.spectrogramData.length; col++) {
      const data = this.spectrogramData[col];
      const x = col * colWidth;

      for (let bin = 0; bin < data.length; bin++) {
        const value = data[bin] / 255;
        if (value < 0.01) continue;

        const y = this.height - (bin * binHeight) - binHeight;
        const hue = bin / data.length * 300;
        const alpha = value * this.intensity;

        this.ctx.fillStyle = `hsla(${hue}, 85%, ${30 + value * 40}%, ${alpha})`;
        this.ctx.fillRect(x, y, colWidth, binHeight + 1);
      }
    }

    // Time cursor
    const cursorX = this.spectrogramData.length * colWidth;
    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    this.ctx.lineWidth = 1;
    this.ctx.beginPath();
    this.ctx.moveTo(cursorX, 0);
    this.ctx.lineTo(cursorX, this.height);
    this.ctx.stroke();
  }
}

window.Visualizer = Visualizer;
