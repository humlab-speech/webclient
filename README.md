# VISP Webclient

Angular SPA for the **Visible Speech (VISP)** platform — an academic
speech-annotation and transcription tool. This is the browser-facing UI
that researchers use to manage projects, upload audio, launch analysis
tools, and queue transcriptions.

### What it does

- Authenticate via Shibboleth (federated academic SSO)
- Create / edit / delete speech-recording projects
- Upload audio files (drag-and-drop)
- Launch embedded tools in iframes (RStudio, Jupyter, EMU-webApp, Octra,
  Speech Recorder)
- Queue speech-to-text transcription via WhisperX
- Manage project members, bundle assignments, and invite codes

Communication is **WebSocket-first** — a single persistent connection to
session-manager handles most data operations. Only file uploads and a
session check use HTTP.

## Tech stack

| Layer | Technology |
|-------|-----------|
| Framework | Angular 20 (TypeScript) |
| UI components | Angular Material 20, ngx-datatable |
| Build system | esbuild via `@angular/build:application` |
| Styling | SCSS + Angular Material theme |
| Guided tours | shepherd.js |
| Speech recorder | speechrecorderng (Angular-native) |

## Building

Builds run inside a Node.js container — no local `node`/`npm` required:

```bash
# From the deployment repository root:
./visp.py build webclient
```

Output goes to `dist/` which is bind-mounted into Apache (dev mode) or baked
into the Apache image (prod mode).

## Architecture

- **Source:** `src/` — Angular TypeScript + HTML templates
- **PHP API:** `api/api.php` — REST API served by Apache (not part of the
  Angular build; bind-mounted separately in dev mode)
- **Entry point:** `src/index.php` — server-rendered by Apache's PHP module,
  injects Shibboleth session variables into `window.visp`

## Related

- [visible-speech-deployment](https://github.com/humlab-speech/visible-speech-deployment) —
  orchestration, quadlets, build system
- [session-manager](https://github.com/humlab-speech/session-manager) —
  WebSocket backend for container management
