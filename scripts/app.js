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
  preparation: { label: "Preparation", shortLabel: "Preparation", compactLabel: "Prep", durationKey: "preparationSeconds" },
  presentation: { label: "Presentation", shortLabel: "Presentation", compactLabel: "PPT", durationKey: "presentationSeconds" },
  session: { label: "Full session", shortLabel: "Session", compactLabel: "Session", durationKey: "sessionSeconds" },
};

const phaseNames = ["preparation", "presentation"];
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

function renderCorner(slot, name) {
  const snapshot = timers[name].snapshot();
  const corner = $(`#cornerClock${slot}`);
  const action = $(`#cornerAction${slot}`);

  renderDisplay($(`#cornerDisplay${slot}`), name, snapshot);
  const cornerLabel = $(`#cornerLabel${slot}`);
  cornerLabel.textContent = timerConfig[name].shortLabel;
  cornerLabel.dataset.compactLabel = timerConfig[name].compactLabel;
  $(`#cornerTarget${slot}`).textContent = formatDuration(snapshot.durationMs);
  $(`#cornerProgress${slot}`).style.transform = `scaleX(${Math.max(0, snapshot.progress)})`;
  corner.dataset.timer = name;
  corner.setAttribute("aria-label", `${timerConfig[name].label} timer`);
  corner.classList.toggle("is-warning", snapshot.state === "running" && snapshot.remainingMs <= 60_000);
  corner.classList.toggle("is-complete", snapshot.state === "complete");

  const showAction = name !== "session" && timers.session.state !== "complete";
  action.hidden = !showAction;
  action.dataset.timer = name;
  if (showAction) {
    const isComplete = snapshot.state === "complete";
    $("span", action).textContent = isComplete ? "Restart" : snapshot.state === "paused" ? "Resume" : "Start";
    $("path", action).setAttribute("d", isComplete ? "M4 4v6h6M5.6 15a7 7 0 1 0 .4-7.5L4 10" : "m8 5 11 7-11 7V5Z");
    action.setAttribute("aria-label", `${$("span", action).textContent} ${timerConfig[name].label.toLowerCase()} timer`);
  }
}

function renderViews() {
  if (!timers.preparation || !timers.presentation || !timers.session) return;

  const activePhase = phaseNames.find((name) => timers[name].state === "running");
  const mainName = activePhase ?? "session";
  const cornerNames = mainName === "session"
    ? phaseNames
    : ["session", phaseNames.find((name) => name !== mainName)];
  const mainSnapshot = timers[mainName].snapshot();
  const stage = $("#mainStage");

  renderDisplay($("#mainDisplay"), mainName, mainSnapshot);
  $("#mainTitle").textContent = timerConfig[mainName].label;
  $("#mainTarget").textContent = formatDuration(mainSnapshot.durationMs);
  $("#mainState").textContent = stateLabels[mainSnapshot.state];
  $("#mainProgress").style.transform = `scaleX(${Math.max(0, mainSnapshot.progress)})`;
  stage.dataset.activeTimer = mainName;
  stage.classList.toggle("is-warning", mainSnapshot.state === "running" && mainSnapshot.remainingMs <= 60_000);
  stage.classList.toggle("is-complete", mainSnapshot.state === "complete");

  renderCorner("A", cornerNames[0]);
  renderCorner("B", cornerNames[1]);

  Object.entries(timers).forEach(([name, timer]) => {
    $(`#${name}State`).textContent = stateLabels[timer.state];
  });

}

function tickLoop() {
  Object.values(timers).forEach((timer) => timer.tick());
  renderMainControls();
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
  renderMainControls();
}

function pauseTimers(timerNames) {
  timerNames.forEach((name) => timers[name].pause());
  renderMainControls();
}

function resetTimers(timerNames) {
  timerNames.forEach((name) => {
    const key = timerConfig[name].durationKey;
    const durationMs = settings[key] * 1000;
    timers[name].reset(durationMs);
  });
  dismissAlarm();
  renderViews();
  renderMainControls();
  if (!Object.values(timers).some((timer) => timer.state === "running")) releaseWakeLock();
}

function toggleMainTimer() {
  const activePhase = phaseNames.find((name) => timers[name].state === "running");
  const mainName = activePhase ?? "session";
  if (timers[mainName].state === "running") {
    pauseTimers([mainName]);
  } else if (mainName === "session" && timers.session.state === "ready") {
    activatePhase(settings.autoStartPhase);
  } else if (timers[mainName].state !== "complete") {
    startTimers([mainName]);
  }
}

function activatePhase(name) {
  if (!phaseNames.includes(name) || timers.session.state === "complete") return;

  phaseNames.forEach((phaseName) => {
    if (phaseName !== name && timers[phaseName].state === "running") timers[phaseName].pause();
  });
  if (timers[name].state === "complete") timers[name].reset(settings[timerConfig[name].durationKey] * 1000);

  const timersToStart = [];
  if (timers.session.state !== "running") timersToStart.push("session");
  if (timers[name].state !== "running") timersToStart.push(name);
  startTimers(timersToStart);
}

function renderMainControls() {
  const activePhase = phaseNames.find((name) => timers[name].state === "running");
  const mainName = activePhase ?? "session";
  const mainTimer = timers[mainName];
  const button = $("#mainActionButton");
  const isRunning = mainTimer.state === "running";
  const autoStartLabel = timerConfig[settings.autoStartPhase].label.toLowerCase();
  const label = mainTimer.state === "complete"
    ? "Finished"
    : isRunning
      ? `Pause ${timerConfig[mainName].label.toLowerCase()}`
      : mainTimer.state === "paused"
        ? "Resume session"
        : `Start ${autoStartLabel} + session`;

  $("span", button).textContent = label;
  button.disabled = mainTimer.state === "complete";
  $("svg path", button).setAttribute("d", isRunning ? "M7 5h4v14H7V5Zm6 0h4v14h-4V5Z" : "m8 5 11 7-11 7V5Z");
}

function handleComplete(name) {
  if (name === "session") {
    phaseNames.forEach((phaseName) => {
      if (timers[phaseName].state === "running") timers[phaseName].pause();
    });
  }
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
  setTimeout(() => $("#preparationMinutes").focus(), 50);
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
  ["preparation", "presentation", "session"].forEach((name) => {
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
  $(`input[name="autoStartPhase"][value="${settings.autoStartPhase}"]`).checked = true;
}

function secondsFromInputs(name) {
  const minutes = Math.max(0, Math.min(599, Number($(`#${name}Minutes`).value) || 0));
  const seconds = Math.max(0, Math.min(59, Number($(`#${name}Seconds`).value) || 0));
  return minutes * 60 + seconds;
}

function saveForm(event) {
  event.preventDefault();
  const preparationSeconds = secondsFromInputs("preparation");
  const presentationSeconds = secondsFromInputs("presentation");
  const sessionSeconds = secondsFromInputs("session");
  if (!preparationSeconds || !presentationSeconds || !sessionSeconds) {
    const emptyName = ["preparation", "presentation", "session"].find((name) => !secondsFromInputs(name));
    $(`#${emptyName}Minutes`).setCustomValidity("Set a duration greater than zero.");
    $(`#${emptyName}Minutes`).reportValidity();
    $(`#${emptyName}Minutes`).setCustomValidity("");
    return;
  }
  settings = {
    version: settings.version,
    preparationSeconds,
    presentationSeconds,
    sessionSeconds,
    autoStartPhase: $('input[name="autoStartPhase"]:checked').value,
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

$("#mainActionButton").addEventListener("click", toggleMainTimer);
["A", "B"].forEach((slot) => {
  $(`#cornerAction${slot}`).addEventListener("click", (event) => activatePhase(event.currentTarget.dataset.timer));
});
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
  if (event.code === "Space") { event.preventDefault(); toggleMainTimer(); }
  if (event.key.toLowerCase() === "r") resetTimers(Object.keys(timers));
  if (event.key.toLowerCase() === "f") toggleFullscreen();
  if (event.key.toLowerCase() === "s") openSettings();
});

document.documentElement.dataset.theme = settings.visualTheme;
renderViews();
renderMainControls();
