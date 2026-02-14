/* ============================================
   SoundPrint Visual DAW - Sign Language Controller
   Camera-based gesture detection and mapping
   to DAW controls using hand tracking
   ============================================ */

class SignLanguageController {
  constructor() {
    this.isEnabled = false;
    this.stream = null;
    this.video = document.getElementById('camera-feed');
    this.overlay = document.getElementById('gesture-overlay');
    this.overlayCtx = this.overlay.getContext('2d');
    this.statusEl = document.getElementById('gesture-status');
    this.gestureNameEl = document.getElementById('gesture-name');
    this.gestureActionEl = document.getElementById('gesture-action');

    // Gesture state
    this.currentGesture = null;
    this.gestureConfidence = 0;
    this.gestureHoldTime = 0;
    this.lastGestureTime = 0;
    this.cooldownMs = 500; // Prevent rapid-fire gestures

    // Gesture callbacks
    this.callbacks = {};

    // Hand tracking state (simulated without ML model)
    this.detectionLoop = null;
    this.handDetector = null;

    // Motion tracking for gesture detection
    this.prevFrame = null;
    this.motionHistory = [];
    this.handPosition = { x: 0.5, y: 0.5 };
    this.handVelocity = { x: 0, y: 0 };

    // Canvas for frame analysis
    this.analysisCanvas = document.createElement('canvas');
    this.analysisCanvas.width = 160;
    this.analysisCanvas.height = 120;
    this.analysisCtx = this.analysisCanvas.getContext('2d', { willReadFrequently: true });
  }

  // Define gesture mappings for DAW control
  static GESTURES = {
    OPEN_HAND: {
      name: 'Open Hand',
      icon: '\u270B',
      action: 'play',
      description: 'Play / Resume',
      aslLetter: null,
    },
    FIST: {
      name: 'Fist',
      icon: '\u270A',
      action: 'stop',
      description: 'Stop / Mute',
      aslLetter: 'S',
    },
    PEACE: {
      name: 'Peace Sign',
      icon: '\u270C',
      action: 'addTrack',
      description: 'Add New Track',
      aslLetter: 'V',
    },
    POINT_UP: {
      name: 'Point Up',
      icon: '\uD83D\uDC46',
      action: 'volumeUp',
      description: 'Volume Up',
      aslLetter: null,
    },
    POINT_DOWN: {
      name: 'Point Down',
      icon: '\uD83D\uDC47',
      action: 'volumeDown',
      description: 'Volume Down',
      aslLetter: null,
    },
    POINT_LEFT: {
      name: 'Point Left',
      icon: '\uD83D\uDC48',
      action: 'rewind',
      description: 'Rewind',
      aslLetter: null,
    },
    POINT_RIGHT: {
      name: 'Point Right',
      icon: '\uD83D\uDC49',
      action: 'forward',
      description: 'Skip Forward',
      aslLetter: null,
    },
    THUMBS_UP: {
      name: 'Thumbs Up',
      icon: '\uD83D\uDC4D',
      action: 'confirm',
      description: 'Confirm / OK',
      aslLetter: null,
    },
    OK_SIGN: {
      name: 'OK Sign',
      icon: '\uD83D\uDC4C',
      action: 'select',
      description: 'Select / Confirm',
      aslLetter: 'F',
    },
    WAVE: {
      name: 'Wave',
      icon: '\uD83D\uDC4B',
      action: 'clear',
      description: 'Clear Sequence',
      aslLetter: null,
    },
    // ASL letters for instrument selection
    ASL_A: {
      name: 'ASL "A"',
      icon: 'A',
      action: 'selectInstrument_0',
      description: 'Select Sine Pad',
      aslLetter: 'A',
    },
    ASL_B: {
      name: 'ASL "B"',
      icon: 'B',
      action: 'selectInstrument_1',
      description: 'Select Square Lead',
      aslLetter: 'B',
    },
    ASL_C: {
      name: 'ASL "C"',
      icon: 'C',
      action: 'selectInstrument_2',
      description: 'Select Saw Bass',
      aslLetter: 'C',
    },
    ASL_D: {
      name: 'ASL "D"',
      icon: 'D',
      action: 'selectInstrument_3',
      description: 'Select Triangle Bell',
      aslLetter: 'D',
    },
  };

  async enable() {
    if (this.isEnabled) return;

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 320 },
          height: { ideal: 240 },
          facingMode: 'user',
          frameRate: { ideal: 15 },
        },
      });

      this.video.srcObject = this.stream;
      this.isEnabled = true;
      this.statusEl.textContent = 'Detecting...';
      this.gestureActionEl.textContent = 'Show a gesture';

      // Resize overlay to match video
      this.video.addEventListener('loadedmetadata', () => {
        this.overlay.width = this.video.videoWidth;
        this.overlay.height = this.video.videoHeight;
      });

      // Start detection loop
      this._startDetection();

      document.getElementById('sign-status').textContent = 'Sign Language: Active';
      return true;
    } catch (err) {
      console.error('Camera access denied:', err);
      this.statusEl.textContent = 'Camera Denied';
      this.gestureActionEl.textContent = 'Grant camera permission';
      return false;
    }
  }

  disable() {
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
    this.video.srcObject = null;
    this.isEnabled = false;
    this.statusEl.textContent = 'Camera Off';
    this.gestureNameEl.textContent = '--';
    this.gestureActionEl.textContent = 'Enable camera to start';
    document.getElementById('sign-status').textContent = 'Sign Language: Disabled';

    if (this.detectionLoop) {
      clearInterval(this.detectionLoop);
      this.detectionLoop = null;
    }

    this.overlayCtx.clearRect(0, 0, this.overlay.width, this.overlay.height);
  }

  toggle() {
    if (this.isEnabled) {
      this.disable();
    } else {
      this.enable();
    }
    return this.isEnabled;
  }

  onGesture(action, callback) {
    this.callbacks[action] = callback;
  }

  _startDetection() {
    // Run detection at ~10fps for performance
    this.detectionLoop = setInterval(() => {
      if (!this.isEnabled) return;
      this._analyzeFrame();
    }, 100);
  }

  _analyzeFrame() {
    if (!this.video.videoWidth) return;

    // Draw current frame to analysis canvas
    this.analysisCtx.drawImage(
      this.video, 0, 0,
      this.analysisCanvas.width, this.analysisCanvas.height
    );

    const currentFrame = this.analysisCtx.getImageData(
      0, 0, this.analysisCanvas.width, this.analysisCanvas.height
    );

    if (this.prevFrame) {
      const motion = this._detectMotion(currentFrame, this.prevFrame);
      this.motionHistory.push(motion);
      if (this.motionHistory.length > 10) this.motionHistory.shift();

      // Detect skin-colored regions (simplified hand detection)
      const handRegion = this._detectSkinRegion(currentFrame);

      if (handRegion) {
        this.handPosition = handRegion.center;
        this._classifyGesture(handRegion, motion);
        this._drawHandOverlay(handRegion);
      }
    }

    this.prevFrame = currentFrame;
  }

  _detectMotion(current, previous) {
    const data1 = current.data;
    const data2 = previous.data;
    let totalMotion = 0;
    let motionX = 0;
    let motionY = 0;
    let motionPixels = 0;
    const w = current.width;
    const h = current.height;

    for (let i = 0; i < data1.length; i += 16) { // Sample every 4th pixel
      const diff = Math.abs(data1[i] - data2[i]) +
        Math.abs(data1[i + 1] - data2[i + 1]) +
        Math.abs(data1[i + 2] - data2[i + 2]);

      if (diff > 60) {
        const pixelIndex = i / 4;
        const px = (pixelIndex % w) / w;
        const py = Math.floor(pixelIndex / w) / h;
        motionX += px;
        motionY += py;
        motionPixels++;
        totalMotion += diff;
      }
    }

    return {
      total: totalMotion,
      pixels: motionPixels,
      centerX: motionPixels > 0 ? motionX / motionPixels : 0.5,
      centerY: motionPixels > 0 ? motionY / motionPixels : 0.5,
    };
  }

  _detectSkinRegion(frame) {
    const data = frame.data;
    const w = frame.width;
    const h = frame.height;
    let skinPixels = 0;
    let sumX = 0, sumY = 0;
    let minX = w, maxX = 0, minY = h, maxY = 0;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      // Simple skin color detection in RGB space
      if (r > 95 && g > 40 && b > 20 &&
          r > g && r > b &&
          (r - g) > 15 &&
          Math.abs(r - g) > 15 &&
          r - b > 15) {
        const px = (i / 4) % w;
        const py = Math.floor((i / 4) / w);
        skinPixels++;
        sumX += px;
        sumY += py;
        if (px < minX) minX = px;
        if (px > maxX) maxX = px;
        if (py < minY) minY = py;
        if (py > maxY) maxY = py;
      }
    }

    const skinRatio = skinPixels / (w * h / 4);

    if (skinPixels > 50 && skinRatio > 0.02) {
      return {
        center: {
          x: sumX / skinPixels / w,
          y: sumY / skinPixels / h,
        },
        bounds: {
          x: minX / w,
          y: minY / h,
          width: (maxX - minX) / w,
          height: (maxY - minY) / h,
        },
        size: skinRatio,
        pixelCount: skinPixels,
      };
    }

    return null;
  }

  _classifyGesture(handRegion, motion) {
    const now = Date.now();
    if (now - this.lastGestureTime < this.cooldownMs) return;

    // Use hand region properties and motion to determine gesture
    const { size, bounds, center } = handRegion;
    const motionAmount = motion.total;
    const recentMotion = this.motionHistory.reduce((sum, m) => sum + m.total, 0) /
      Math.max(1, this.motionHistory.length);

    let detectedGesture = null;

    // Wave detection: high sustained motion
    if (recentMotion > 50000 && this.motionHistory.length > 5) {
      detectedGesture = SignLanguageController.GESTURES.WAVE;
    }
    // Large hand region = open hand
    else if (size > 0.15 && bounds.width > 0.15 && bounds.height > 0.15) {
      detectedGesture = SignLanguageController.GESTURES.OPEN_HAND;
    }
    // Small compact region = fist
    else if (size > 0.03 && size < 0.10 &&
             bounds.width < 0.2 && bounds.height < 0.2 &&
             bounds.width / bounds.height > 0.6 && bounds.width / bounds.height < 1.4) {
      detectedGesture = SignLanguageController.GESTURES.FIST;
    }
    // Tall narrow = pointing up
    else if (bounds.height > bounds.width * 1.8 && center.y < 0.4) {
      detectedGesture = SignLanguageController.GESTURES.POINT_UP;
    }
    // Tall narrow low = pointing down
    else if (bounds.height > bounds.width * 1.8 && center.y > 0.6) {
      detectedGesture = SignLanguageController.GESTURES.POINT_DOWN;
    }
    // Wide = pointing sideways
    else if (bounds.width > bounds.height * 1.8) {
      if (center.x < 0.4) {
        detectedGesture = SignLanguageController.GESTURES.POINT_RIGHT; // Mirrored camera
      } else if (center.x > 0.6) {
        detectedGesture = SignLanguageController.GESTURES.POINT_LEFT;
      }
    }
    // Medium spread = peace sign / V
    else if (size > 0.08 && size < 0.14 && bounds.height > bounds.width * 1.2) {
      detectedGesture = SignLanguageController.GESTURES.PEACE;
    }

    if (detectedGesture) {
      // Need to hold gesture for a bit to confirm
      if (this.currentGesture === detectedGesture) {
        this.gestureHoldTime += 100;
      } else {
        this.currentGesture = detectedGesture;
        this.gestureHoldTime = 0;
      }

      // Update UI immediately
      this.gestureNameEl.textContent = detectedGesture.icon + ' ' + detectedGesture.name;
      this.gestureActionEl.textContent = detectedGesture.description;
      this.statusEl.textContent = this.gestureHoldTime > 300 ? 'Confirmed!' : 'Hold...';

      // Fire action after holding for 400ms
      if (this.gestureHoldTime >= 400) {
        this._fireGesture(detectedGesture);
        this.gestureHoldTime = 0;
        this.lastGestureTime = now;
        this.statusEl.textContent = 'Action sent!';
        setTimeout(() => {
          this.statusEl.textContent = 'Detecting...';
        }, 500);
      }
    }
  }

  _fireGesture(gesture) {
    const action = gesture.action;
    if (this.callbacks[action]) {
      this.callbacks[action](gesture);
    }

    // Flash the gesture display
    const el = document.getElementById('detected-gesture');
    el.style.boxShadow = '0 0 20px rgba(255, 214, 10, 0.5)';
    setTimeout(() => {
      el.style.boxShadow = 'none';
    }, 300);
  }

  _drawHandOverlay(handRegion) {
    const ctx = this.overlayCtx;
    const w = this.overlay.width;
    const h = this.overlay.height;

    ctx.clearRect(0, 0, w, h);

    if (!handRegion) return;

    const { bounds, center } = handRegion;

    // Draw bounding box (mirrored since camera is mirrored)
    ctx.strokeStyle = 'rgba(255, 214, 10, 0.7)';
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    ctx.strokeRect(
      (1 - bounds.x - bounds.width) * w,
      bounds.y * h,
      bounds.width * w,
      bounds.height * h
    );
    ctx.setLineDash([]);

    // Draw center point
    ctx.beginPath();
    ctx.arc((1 - center.x) * w, center.y * h, 5, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 214, 10, 0.8)';
    ctx.fill();

    // Draw detection confidence ring
    const confidence = Math.min(this.gestureHoldTime / 400, 1);
    ctx.beginPath();
    ctx.arc((1 - center.x) * w, center.y * h, 20,
      -Math.PI / 2,
      -Math.PI / 2 + Math.PI * 2 * confidence
    );
    ctx.strokeStyle = confidence >= 1 ? '#34d399' : '#ffd60a';
    ctx.lineWidth = 3;
    ctx.stroke();
  }

  // Get hand position for continuous control (e.g., panning, filter sweep)
  getHandPosition() {
    return this.handPosition;
  }
}

window.SignLanguageController = SignLanguageController;
