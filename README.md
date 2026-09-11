# Session Signal

A large-format session timer with mutually exclusive preparation and presentation phase timers for interviews and timed sessions.

## Features

- Continuous full-session count-up timer plus preparation and presentation phase timers
- Only one phase timer can run at a time; the session can continue with neither phase active
- Starting a fresh session automatically starts the selected phase; presentation is the default
- The active phase becomes the main display while inactive phases stay in the corner
- The main readout uses plain-zero Courier-style monospaced numerals so digit changes do not shift the display
- Start, resume, or restart either phase without resetting the session clock
- A visible reset-all control replaces the main action when the session finishes
- Configurable minutes and seconds for each timer
- Four synthesized alarm styles, 4/8/15-second alarm lengths, volume control, start cue, and alarm preview
- Four light themes, four dark themes, and a dedicated high-contrast theme
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
| Space | Start or pause the main timer |
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
