# Binary
The binary is in the repo above at human-touch-1.0.0.ablx

# human-touch

Adds random timing, velocity, and duration variation (jitter) to MIDI notes in
Ableton Live to make them feel more human. Built with `@ableton-extensions/sdk`.

Right-click a MIDI clip or ClipSlot → **Human Touch Jitter…** → adjust
sliders → **Apply** to randomize the selected clip's notes.

## Project structure

```
src/extension.ts       # Entry point — exports activate()
src/html.d.ts          # *.html module declaration for TypeScript
ui/interface.html      # WebView dialog (vite dev server for rapid iteration)
vendor/                # Vendored SDK + CLI tarballs
build.ts               # esbuild bundler (inlines .html as text)
vite.config.ts         # Vite dev server for UI work (root: ui/, port 5173)
manifest.json          # Extension metadata read by Live
dist/                  # Build output (gitignored)
```

## Requirements

- **Node.js >= 24.14.1**
- **Ableton Live Beta** with **Developer Mode** enabled in *Preferences → Extensions*
- The **Extension Host** module path in `.env` (per-machine, gitignored):
  `EXTENSION_HOST_PATH=/Applications/Ableton Live 12 Beta.app/Contents/Helpers/ExtensionHost/ExtensionHostNodeModule.node`

## Setup

```sh
npm install
```

Edit `.env` if the scaffolded `EXTENSION_HOST_PATH` doesn't match your Live
install.

## Scripts

| Command | Description |
|---|---|
| `npm start` | Dev build → launch in Live's Extension Host |
| `npm run build` | Production bundle (minified, no sourcemaps) |
| `npm run build:dev` | Dev bundle (sourcemaps, not minified) |
| `npm run package` | Production build → `.ablx` archive for distribution |

## Development

### Extension logic

Edit `src/extension.ts`. The entry point registers one command
(`human-touch.jitter`) and wires it as a context-menu action on both
`"MidiClip"` and `"ClipSlot"` scopes. When triggered, it:

1. Resolves the handle to a `MidiClip` (or drills into a `ClipSlot`).
2. Opens a modal dialog (`ui/interface.html` inlined via esbuild) with
   timing/velocity/duration sliders.
3. On **Apply**, maps over `clip.notes` in a transaction, adding per-note
   random offsets.

Key SDK concepts used:
- `context.getObjectFromHandle(handle, Class)` — resolve a handle
- `context.ui.showModalDialog(url, width, height)` — blocking modal
- `context.withinTransaction(() => …)` — one undo step
- `instanceof` narrowing on `MidiClip` / `ClipSlot`

### UI development

Run `vite dev` (or `npx vite`) for hot-reload of the dialog HTML. The
`ui/interface.html` is a standalone page during dev (the `window.webkit`
bridge is only available inside Live's WebView — test final behavior by
running in Live).

### Debugging

`console.log/warn/error` output goes to **ExtensionHost.txt**:
macOS: `~/Library/Preferences/Ableton/Live x.x.x/ExtensionHost.txt`
Windows: `%APPDATA%\Ableton\Live x.x.x\Preferences\ExtensionHost.txt`

### Packaging

```sh
npm run package
```

Produces `human-touch-1.0.0.ablx` in the project root. Users drop this into
Live's Extensions preferences.
