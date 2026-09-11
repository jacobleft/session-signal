# Session Signal

A large-format dual countdown timer for interviews, presentations, and timed sessions. One master control starts a presentation timer and a full-session timer at the same moment.

## Features

- Two synchronized, independently controllable countdown timers
- Configurable minutes and seconds for each timer
- Four synthesized alarm styles, volume control, start cue, and alarm preview
- Control-room, paper-light, and high-contrast visual themes
- Full-screen mode, keyboard shortcuts, screen wake lock, and responsive layout
- Settings saved in the browser; no account or backend required

## Run locally

Because this is a dependency-free static site, serve the folder locally:

```bash
python3 -m http.server 4173
```

Then open <http://localhost:4173>.

## Keyboard shortcuts

| Key | Action |
| --- | --- |
| Space | Start or pause both timers |
| R | Reset both timers |
| F | Enter or leave full screen |
| S | Open settings |
| Escape | Close settings |

## Architecture

- `scripts/timer.js` — countdown state and time formatting
- `scripts/audio.js` — Web Audio sound patterns
- `scripts/storage.js` — saved settings and defaults
- `scripts/app.js` — interface orchestration and browser APIs
- `styles/theme.css` — swappable color systems
- `styles/app.css` — responsive layout and components

## Browser note

Browsers require a user interaction before playing audio. Start the timer or preview a sound once before relying on the alarm. The app requests a screen wake lock while a timer is running when the browser supports it; the computer must remain awake and the page must remain open for alarms to be dependable.
