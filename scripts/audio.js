const SOUND_PATTERNS = {
  chime: {
    start: [{ frequency: 523.25, offset: 0, duration: 0.12, type: "sine" }],
    alarm: [
      { frequency: 659.25, offset: 0, duration: 0.45, type: "sine" },
      { frequency: 783.99, offset: 0.18, duration: 0.55, type: "sine" },
      { frequency: 1046.5, offset: 0.42, duration: 0.85, type: "sine" },
    ],
  },
  bell: {
    start: [{ frequency: 880, offset: 0, duration: 0.1, type: "triangle" }],
    alarm: [
      { frequency: 880, offset: 0, duration: 0.8, type: "triangle" },
      { frequency: 1760, offset: 0, duration: 0.55, type: "sine", gain: 0.35 },
      { frequency: 880, offset: 0.9, duration: 0.8, type: "triangle" },
      { frequency: 1760, offset: 0.9, duration: 0.55, type: "sine", gain: 0.35 },
    ],
  },
  pulse: {
    start: [{ frequency: 620, offset: 0, duration: 0.08, type: "square", gain: 0.35 }],
    alarm: Array.from({ length: 6 }, (_, index) => ({
      frequency: index % 2 ? 740 : 520,
      offset: index * 0.2,
      duration: 0.12,
      type: "square",
      gain: 0.25,
    })),
  },
  gentle: {
    start: [{ frequency: 440, offset: 0, duration: 0.18, type: "sine", gain: 0.35 }],
    alarm: [
      { frequency: 440, offset: 0, duration: 0.7, type: "sine", gain: 0.35 },
      { frequency: 554.37, offset: 0.35, duration: 0.7, type: "sine", gain: 0.35 },
      { frequency: 659.25, offset: 0.7, duration: 0.9, type: "sine", gain: 0.35 },
    ],
  },
};

export class SoundEngine {
  constructor() {
    this.context = null;
    this.activeNodes = [];
  }

  async ensureContext() {
    if (!this.context) this.context = new (window.AudioContext || window.webkitAudioContext)();
    if (this.context.state === "suspended") await this.context.resume();
    return this.context;
  }

  async play(kind, style = "chime", volume = 0.7) {
    const context = await this.ensureContext();
    this.stop();
    const pattern = SOUND_PATTERNS[style]?.[kind] ?? SOUND_PATTERNS.chime[kind];
    const startAt = context.currentTime + 0.02;

    pattern.forEach((note) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const noteStart = startAt + note.offset;
      const noteGain = Math.min(0.4, volume * 0.38 * (note.gain ?? 1));

      oscillator.type = note.type;
      oscillator.frequency.setValueAtTime(note.frequency, noteStart);
      gain.gain.setValueAtTime(0.0001, noteStart);
      gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, noteGain), noteStart + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, noteStart + note.duration);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start(noteStart);
      oscillator.stop(noteStart + note.duration + 0.03);
      this.activeNodes.push(oscillator);
      oscillator.addEventListener("ended", () => {
        this.activeNodes = this.activeNodes.filter((node) => node !== oscillator);
      });
    });
  }

  stop() {
    this.activeNodes.forEach((node) => {
      try { node.stop(); } catch { /* already stopped */ }
    });
    this.activeNodes = [];
  }
}
