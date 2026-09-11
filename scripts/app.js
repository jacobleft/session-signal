import { CountdownTimer, formatDuration } from "./timer.js";
import { SoundEngine } from "./audio.js";
import { loadSettings, saveSettings } from "./storage.js";

const $ = (selector, scope = document) => scope.querySelector(selector);

let settings = loadSettings();
const THEME_IDS = ["light", "corporate", "winter", "lemonade", "sunset", "dracula", "business", "coffee", "high-contrast"];
if (!THEME_IDS.includes(settings.visualTheme)) settings.visualTheme = "light";
const sound = new SoundEngine();
let animationFrame = null;
let wakeLock = null;

const timerConfig = {
  presentation: { label: "Presentation", shortLabel: "Presentation", durationKey: "presentationSeconds" },
  session: { label: "Full session", shortLabel: "Session", durationKey: "sessionSeconds" },
};

const stateLabels = { ready: "Ready", running: "Running", paused: "Paused", complete: "Time up" };

const timers = Object.fromEntries(
  Object.entries(timerConfig).map(([name, config]) => [
    name,
    new CountdownTimer({
      durationMs: settings[config.durationKey] * 1000,
      onTick: () => renderViews(),
      onComplete: () => handleComplete(name),
    }),
  ]),
);

function renderDisplay(display, name, snapshot) {
  display.textContent = formatDuration(snapshot.elapsedMs);
  display.classList.toggle("has-hours", display.textContent.split(":").length === 3);
  display.setAttribute(
    "aria-label",
    `${timerConfig[name].label}: ${display.textContent} elapsed of ${formatDuration(snapshot.durationMs)}`,
  );
}

function renderViews() {
  if (!timers.presentation || !timers.session) return;

  const mainName = timers.presentation.state === "complete" ? "session" : "presentation";
  const cornerName = mainName === "presentation" ? "session" : "presentation";
  const mainSnapshot = timers[mainName].snapshot();
  const cornerSnapshot = timers[cornerName].snapshot();
  const stage = $("#mainStage");
  const corner = $("#cornerClock");

  renderDisplay($("#mainDisplay"), mainName, mainSnapshot);
  $("#mainTitle").textContent = timerConfig[mainName].label;
  $("#mainTarget").textContent = formatDuration(mainSnapshot.durationMs);
  $("#mainState").textContent = stateLabels[mainSnapshot.state];
  $("#mainProgress").style.transform = `scaleX(${Math.max(0, mainSnapshot.progress)})`;
  stage.dataset.activeTimer = mainName;
  stage.classList.toggle("is-warning", mainSnapshot.state === "running" && mainSnapshot.remainingMs <= 60_000);
  stage.classList.toggle("is-complete", mainSnapshot.state === "complete");

  renderDisplay($("#cornerDisplay"), cornerName, cornerSnapshot);
  $("#cornerLabel").textContent = timerConfig[cornerName].shortLabel;
  $("#cornerTarget").textContent = formatDuration(cornerSnapshot.durationMs);
  $("#cornerProgress").style.transform = `scaleX(${Math.max(0, cornerSnapshot.progress)})`;
  corner.setAttribute("aria-label", `${timerConfig[cornerName].label} timer`);
  corner.classList.toggle("is-warning", cornerSnapshot.state === "running" && cornerSnapshot.remainingMs <= 60_000);
  corner.classList.toggle("is-complete", cornerSnapshot.state === "complete");

  Object.entries(timers).forEach(([name, timer]) => {
    $(`#${name}State`).textContent = stateLabels[timer.state];
  });

  $("#restartPresentationButton").hidden = !(
    timers.presentation.state === "complete" && timers.session.state !== "complete"
  );
}

function tickLoop() {
  Object.values(timers).forEach((timer) => timer.tick());
  renderMasterControls();
  if (Object.values(timers).some((timer) => timer.state === "running")) {
    animationFrame = requestAnimationFrame(tickLoop);
  } else {
    animationFrame = null;
    releaseWakeLock();
  }
}

function ensureTickLoop() {
  if (!animationFrame) animationFrame = requestAnimationFrame(tickLoop);
}

function startTimers(timerNames, withCue = true) {
  const started = timerNames.map((name) => timers[name].start()).some(Boolean);
  if (!started) return;
  if (withCue && settings.startSound) sound.play("start", settings.soundStyle, settings.volume);
  dismissAlarm();
  requestWakeLock();
  ensureTickLoop();
  renderViews();
  renderMasterControls();
}

function pauseTimers(timerNames) {
  timerNames.forEach((name) => timers[name].pause());
  renderMasterControls();
}

function resetTimers(timerNames) {
  timerNames.forEach((name) => {
    const key = timerConfig[name].durationKey;
    const durationMs = settings[key] * 1000;
    timers[name].reset(durationMs);
  });
  dismissAlarm();
  renderViews();
  renderMasterControls();
  if (!Object.values(timers).some((timer) => timer.state === "running")) releaseWakeLock();
}

function toggleBoth() {
  const names = Object.keys(timers);
  if (names.some((name) => timers[name].state === "running")) pauseTimers(names);
  else startTimers(names);
}

function restartPresentation() {
  timers.presentation.reset(settings.presentationSeconds * 1000);
  startTimers(["presentation"]);
}

function renderMasterControls() {
  const anyRunning = Object.values(timers).some((timer) => timer.state === "running");
  const allComplete = Object.values(timers).every((timer) => timer.state === "complete");
  const button = $("#startBothButton");
  $("span", button).textContent = anyRunning ? "Pause" : allComplete ? "Finished" : "Start";
  button.disabled = allComplete;
  $("svg path", button).setAttribute("d", anyRunning ? "M7 5h4v14H7V5Zm6 0h4v14h-4V5Z" : "m8 5 11 7-11 7V5Z");
}

function handleComplete(name) {
  renderViews();
  sound.play("alarm", settings.soundStyle, settings.volume, settings.alarmDurationSeconds);
  $("#alarmTitle").textContent = "Time is up";
  $("#alarmMessage").textContent = `${timerConfig[name].label} timer finished`;
  $("#alarmBanner").hidden = false;
  if (navigator.vibrate) navigator.vibrate([220, 120, 220]);
}

function dismissAlarm() {
  sound.stop();
  $("#alarmBanner").hidden = true;
}

async function requestWakeLock() {
  const chip = $("#wakeStatus");
  if (!("wakeLock" in navigator)) {
    chip.classList.add("is-unsupported");
    return;
  }
  try {
    wakeLock = await navigator.wakeLock.request("screen");
    chip.classList.add("is-active");
    chip.setAttribute("aria-label", "Screen wake lock active");
    wakeLock.addEventListener("release", () => {
      chip.classList.remove("is-active");
      chip.setAttribute("aria-label", "Screen wake lock inactive");
    }, { once: true });
  } catch {
    chip.classList.remove("is-active");
  }
}

async function releaseWakeLock() {
  if (wakeLock) await wakeLock.release().catch(() => {});
  wakeLock = null;
}

function openSettings() {
  populateSettingsForm();
  $("#drawerBackdrop").hidden = false;
  $("#settingsDrawer").classList.add("is-open");
  $("#settingsDrawer").setAttribute("aria-hidden", "false");
  $("#settingsButton").setAttribute("aria-expanded", "true");
  setTimeout(() => $("#presentationMinutes").focus(), 50);
}

function closeSettings() {
  sound.stop();
  document.documentElement.dataset.theme = settings.visualTheme;
  $("#settingsDrawer").classList.remove("is-open");
  $("#settingsDrawer").setAttribute("aria-hidden", "true");
  $("#settingsButton").setAttribute("aria-expanded", "false");
  setTimeout(() => { $("#drawerBackdrop").hidden = true; }, 250);
  $("#settingsButton").focus();
}

function populateSettingsForm() {
  ["presentation", "session"].forEach((name) => {
    const total = settings[timerConfig[name].durationKey];
    $(`#${name}Minutes`).value = Math.floor(total / 60);
    $(`#${name}Seconds`).value = total % 60;
  });
  $("#soundStyle").value = settings.soundStyle;
  $("#alarmDuration").value = String(settings.alarmDurationSeconds);
  $("#volume").value = Math.round(settings.volume * 100);
  $("#volumeOutput").textContent = `${Math.round(settings.volume * 100)}%`;
  $("#startSound").checked = settings.startSound;
  $("#visualTheme").value = settings.visualTheme;
}

function secondsFromInputs(name) {
  const minutes = Math.max(0, Math.min(599, Number($(`#${name}Minutes`).value) || 0));
  const seconds = Math.max(0, Math.min(59, Number($(`#${name}Seconds`).value) || 0));
  return minutes * 60 + seconds;
}

function saveForm(event) {
  event.preventDefault();
  const presentationSeconds = secondsFromInputs("presentation");
  const sessionSeconds = secondsFromInputs("session");
  if (!presentationSeconds || !sessionSeconds) {
    const emptyName = !presentationSeconds ? "presentation" : "session";
    $(`#${emptyName}Minutes`).setCustomValidity("Set a duration greater than zero.");
    $(`#${emptyName}Minutes`).reportValidity();
    $(`#${emptyName}Minutes`).setCustomValidity("");
    return;
  }
  settings = {
    version: settings.version,
    presentationSeconds,
    sessionSeconds,
    soundStyle: $("#soundStyle").value,
    alarmDurationSeconds: Number($("#alarmDuration").value),
    volume: Number($("#volume").value) / 100,
    startSound: $("#startSound").checked,
    visualTheme: $("#visualTheme").value,
  };
  saveSettings(settings);
  document.documentElement.dataset.theme = settings.visualTheme;
  resetTimers(Object.keys(timers));
  closeSettings();
}

async function toggleFullscreen() {
  if (!document.fullscreenElement) await document.documentElement.requestFullscreen?.();
  else await document.exitFullscreen?.();
}

$("#startBothButton").addEventListener("click", toggleBoth);
$("#restartPresentationButton").addEventListener("click", restartPresentation);
$("#dismissAlarmButton").addEventListener("click", dismissAlarm);
$("#settingsButton").addEventListener("click", openSettings);
$("#closeSettingsButton").addEventListener("click", closeSettings);
$("#drawerBackdrop").addEventListener("click", closeSettings);
$("#settingsForm").addEventListener("submit", saveForm);
$("#volume").addEventListener("input", (event) => { $("#volumeOutput").textContent = `${event.target.value}%`; });
$("#previewSoundButton").addEventListener("click", () => sound.play(
  "alarm",
  $("#soundStyle").value,
  Number($("#volume").value) / 100,
  Math.min(2.5, Number($("#alarmDuration").value)),
));
$("#visualTheme").addEventListener("change", (event) => { document.documentElement.dataset.theme = event.target.value; });
$("#fullscreenButton").addEventListener("click", toggleFullscreen);

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && Object.values(timers).some((timer) => timer.state === "running")) {
    Object.values(timers).forEach((timer) => timer.tick());
    requestWakeLock();
    ensureTickLoop();
  }
});

document.addEventListener("keydown", (event) => {
  const isTyping = ["INPUT", "SELECT", "TEXTAREA"].includes(document.activeElement?.tagName);
  if (event.key === "Escape" && $("#settingsDrawer").classList.contains("is-open")) closeSettings();
  if (isTyping || $("#settingsDrawer").classList.contains("is-open")) return;
  if (event.code === "Space") { event.preventDefault(); toggleBoth(); }
  if (event.key.toLowerCase() === "r") resetTimers(Object.keys(timers));
  if (event.key.toLowerCase() === "f") toggleFullscreen();
  if (event.key.toLowerCase() === "s") openSettings();
});

document.documentElement.dataset.theme = settings.visualTheme;
renderViews();
renderMasterControls();
