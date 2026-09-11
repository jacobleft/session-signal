const STORAGE_KEY = "session-signal-settings-v1";

export const DEFAULT_SETTINGS = Object.freeze({
  presentationSeconds: 5 * 60,
  sessionSeconds: 20 * 60,
  soundStyle: "chime",
  volume: 0.7,
  startSound: true,
  visualTheme: "control-room",
});

export function loadSettings() {
  try {
    return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem(STORAGE_KEY)) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}
