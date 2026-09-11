export class CountdownTimer {
  constructor({ durationMs, onTick, onComplete, now = () => Date.now() }) {
    this.now = now;
    this.onTick = onTick;
    this.onComplete = onComplete;
    this.durationMs = durationMs;
    this.elapsedMs = 0;
    this.state = "ready";
    this.startedAt = null;
  }

  start() {
    if (this.state === "running" || this.elapsedMs >= this.durationMs) return false;
    this.startedAt = this.now() - this.elapsedMs;
    this.state = "running";
    return true;
  }

  pause() {
    if (this.state !== "running") return false;
    this.elapsedMs = Math.min(this.durationMs, this.now() - this.startedAt);
    this.startedAt = null;
    this.state = "paused";
    this.onTick?.(this.snapshot());
    return true;
  }

  reset(durationMs = this.durationMs) {
    this.durationMs = durationMs;
    this.elapsedMs = 0;
    this.startedAt = null;
    this.state = "ready";
    this.onTick?.(this.snapshot());
  }

  tick() {
    if (this.state === "running") {
      this.elapsedMs = Math.min(this.durationMs, this.now() - this.startedAt);
      if (this.elapsedMs >= this.durationMs) {
        this.state = "complete";
        this.startedAt = null;
        this.onTick?.(this.snapshot());
        this.onComplete?.(this.snapshot());
        return;
      }
    }
    this.onTick?.(this.snapshot());
  }

  snapshot() {
    return {
      durationMs: this.durationMs,
      elapsedMs: this.elapsedMs,
      remainingMs: Math.max(0, this.durationMs - this.elapsedMs),
      state: this.state,
      progress: this.durationMs ? this.elapsedMs / this.durationMs : 0,
    };
  }
}

export function formatDuration(milliseconds) {
  const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const minuteString = hours ? String(minutes).padStart(2, "0") : String(minutes).padStart(2, "0");
  return hours
    ? `${String(hours).padStart(2, "0")}:${minuteString}:${String(seconds).padStart(2, "0")}`
    : `${minuteString}:${String(seconds).padStart(2, "0")}`;
}
