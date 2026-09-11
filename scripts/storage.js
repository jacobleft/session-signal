const STORAGE_KEY = "session-signal-settings-v1";
const SETTINGS_VERSION = 2;

export const DEFAULT_SETTINGS = Object.freeze({
  version: SETTINGS_VERSION,
  preparationSeconds: 2 * 60,
  presentationSeconds: 5 * 60,
  sessionSeconds: 20 * 60,
  soundStyle: "chime",
  alarmDurationSeconds: 8,
  volume: 0.7,
  startSound: true,
  visualTheme: "light",
});

const LEGACY_THEMES = {
  "control-room": "sunset",
  paper: "light",
  contrast: "high-contrast",
};

export function loadSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    const stored = { ...DEFAULT_SETTINGS, ...saved };
    if (saved?.version !== SETTINGS_VERSION) stored.visualTheme = "light";
    stored.visualTheme = LEGACY_THEMES[stored.visualTheme] ?? stored.visualTheme;
    return stored;
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...settings, version: SETTINGS_VERSION }));
}
