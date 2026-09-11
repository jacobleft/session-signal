export class CountdownTimer {
  constructor({ durationMs, onTick, onComplete, now = () => Date.now() }) {
    this.now = now;
    this.onTick = onTick;
    this.onComplete = onComplete;
    this.durationMs = durationMs;
    this.remainingMs = durationMs;
    this.state = "ready";
    this.endsAt = null;
  }

  start() {
    if (this.state === "running" || this.remainingMs <= 0) return false;
    this.endsAt = this.now() + this.remainingMs;
    this.state = "running";
    return true;
  }

  pause() {
    if (this.state !== "running") return false;
    this.remainingMs = Math.max(0, this.endsAt - this.now());
    this.endsAt = null;
    this.state = "paused";
    this.onTick?.(this.snapshot());
    return true;
  }

  reset(durationMs = this.durationMs) {
    this.durationMs = durationMs;
    this.remainingMs = durationMs;
    this.endsAt = null;
    this.state = "ready";
    this.onTick?.(this.snapshot());
  }

  tick() {
    if (this.state === "running") {
      this.remainingMs = Math.max(0, this.endsAt - this.now());
      if (this.remainingMs <= 0) {
        this.state = "complete";
        this.endsAt = null;
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
      remainingMs: this.remainingMs,
      state: this.state,
      progress: this.durationMs ? this.remainingMs / this.durationMs : 0,
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
