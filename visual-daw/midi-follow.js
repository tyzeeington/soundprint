/* ============================================
   SoundPrint Visual DAW - MIDI Follow
   Web MIDI input listener. Routes incoming
   notes/CC into the audio engine so visuals
   react to any MIDI synth/DAW track.
   ============================================ */

class MidiFollower {
  constructor() {
    this.access = null;
    this.inputs = [];
    this.activeInput = null;
    this.enabled = false;
    this.callbacks = {
      noteOn: null,
      noteOff: null,
      cc: null,
      pitchBend: null,
      inputsChanged: null,
    };
  }

  isSupported() {
    return typeof navigator !== 'undefined' && !!navigator.requestMIDIAccess;
  }

  async init() {
    if (!this.isSupported()) {
      throw new Error('Web MIDI API not supported in this browser. Try Chrome, Edge, or Opera.');
    }
    if (this.access) return;
    this.access = await navigator.requestMIDIAccess({ sysex: false });
    this._refreshInputs();
    this.access.onstatechange = () => this._refreshInputs();
  }

  _refreshInputs() {
    this.inputs = Array.from(this.access.inputs.values());
    if (this.callbacks.inputsChanged) this.callbacks.inputsChanged(this.inputs);
    if (this.activeInput && !this.inputs.find(i => i.id === this.activeInput.id)) {
      this.disable();
    }
  }

  selectInput(id) {
    this.disable();
    if (!id) return;
    const input = this.inputs.find(i => i.id === id);
    if (input) {
      this.activeInput = input;
      this.enable();
    }
  }

  enable() {
    if (!this.activeInput) return false;
    this.activeInput.onmidimessage = (msg) => this._handle(msg);
    this.enabled = true;
    return true;
  }

  disable() {
    if (this.activeInput) {
      try { this.activeInput.onmidimessage = null; } catch (e) { /* noop */ }
    }
    this.activeInput = null;
    this.enabled = false;
  }

  _handle(msg) {
    const [status, d1, d2] = msg.data;
    const cmd = status & 0xf0;
    const ch = status & 0x0f;
    if (cmd === 0x90 && d2 > 0) {
      this.callbacks.noteOn && this.callbacks.noteOn(d1, d2 / 127, ch);
    } else if (cmd === 0x80 || (cmd === 0x90 && d2 === 0)) {
      this.callbacks.noteOff && this.callbacks.noteOff(d1, ch);
    } else if (cmd === 0xb0) {
      this.callbacks.cc && this.callbacks.cc(d1, d2 / 127, ch);
    } else if (cmd === 0xe0) {
      const bend = ((d2 << 7) | d1) - 8192;
      this.callbacks.pitchBend && this.callbacks.pitchBend(bend / 8192, ch);
    }
  }

  on(event, cb) {
    if (!(event in this.callbacks)) return;
    this.callbacks[event] = cb;
  }

  static midiNoteToFreq(note) {
    return 440 * Math.pow(2, (note - 69) / 12);
  }

  static midiNoteToName(note) {
    const names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    return names[note % 12] + (Math.floor(note / 12) - 1);
  }
}

window.MidiFollower = MidiFollower;
