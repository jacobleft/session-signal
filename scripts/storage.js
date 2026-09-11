const STORAGE_KEY = "session-signal-settings-v1";

export const DEFAULT_SETTINGS = Object.freeze({
  presentationSeconds: 5 * 60,
  sessionSeconds: 20 * 60,
  soundStyle: "chime",
  volume: 0.7,
  startSound: true,
  visualTheme: "sunset",
});

const LEGACY_THEMES = {
  "control-room": "sunset",
  paper: "light",
  contrast: "business",
};

export function loadSettings() {
  try {
    const stored = { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem(STORAGE_KEY)) };
    stored.visualTheme = LEGACY_THEMES[stored.visualTheme] ?? stored.visualTheme;
    return stored;
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}
