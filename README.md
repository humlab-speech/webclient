# VISP Webclient

Angular SPA for the **Visible Speech (VISP)** platform — an academic
speech-annotation and transcription tool. This is the browser-facing UI
that researchers use to manage projects, upload audio, launch analysis
tools, and queue transcriptions.

### What it does

- Authenticate via Shibboleth (federated academic SSO)
- Create / edit / delete speech-recording projects
- Upload audio files (drag-and-drop)
- Launch embedded tools in iframes (Jupyter at `/app`, Artic (EMU-webApp) at `/artic`,
  Tratt at `/tratt`); the Speech Recorder is a native SPA route (`/spr`)
- Queue speech-to-text transcription via WhisperX
- Manage project members, bundle assignments, and invite codes

Communication is **WebSocket-first** — a single persistent connection to
session-manager handles most data operations. HTTP carries the rest: the PHP API at
`/api/v1/` (upload + delete, session check, sign-out, project/session helpers,
`.../session/please` session launches, file download) and the Speech Recorder API at
`/spr/api/v1/` (proxied to wsrng-server).

## Tech stack

| Layer | Technology |
|-------|-----------|
| Framework | Angular 18 (TypeScript) |
| UI components | Angular Material 18, ngx-datatable |
| Build system | webpack via `@angular-builders/custom-webpack:browser` (`webpack.dev.js`, used by the `visp.dev` config) |
| Styling | SCSS + Angular Material theme |
| Guided tours | shepherd.js |
| Speech recorder | speechrecorderng (Angular-native) |

## Building

Builds run inside a Node.js container — no local `node`/`npm` required:

```bash
# From the deployment repository root:
./visp.py build webclient            # default config: visp.dev
./visp.py build webclient --config visp
```

The build first runs `composer install` (PHP vendor files are copied into `dist/` by
angular.json's asset pipeline), then `ng build` on Node 22. Output goes to `dist/` which
is bind-mounted into Apache (dev mode) or baked into the Apache image (prod mode). There is
no supported host dev-server flow for the full platform — dev works by editing `src/` and
rebuilding `dist/`.

## Architecture

- **Source:** `src/` — Angular TypeScript + HTML templates
- **PHP API:** `api/api.php` — REST API served by Apache. Note: `angular.json` also
  **copies `api/**` into `dist/api/` at build time**, so `dist/` carries a snapshot; in
  prod that baked copy is what runs (rebuild required), while dev overlays the live
  `api/` source over `dist/api/` with a second bind-mount.
- **Entry point:** `src/index.php` — server-rendered by Apache's PHP module,
  injects Shibboleth session variables into `window.visp`

Behavior notes worth knowing:

- A session's recording script is chosen explicitly (never guessed) and is **locked**
  once the session holds recordings; the lock has a deliberate way out — the control
  unlocks when the session's stored script is no longer among the selectable ones
  (`sessionScriptIsLocked`).
- A bundle assignment refused server-side does not report "saved".
- SPR prompt item codes are numbered from the backend's high-water mark, so codes never
  repeat after edits.
- Bundle deletion UI (trash icon) is hidden for users who cannot delete server-side:
  the `deleteBundles` permission is derived from `canDeleteProject`
  (ProjectAdmin or SysAdmin), not a seeded role flag.

## Related

- [visible-speech-deployment](https://github.com/humlab-speech/visible-speech-deployment) —
  orchestration, quadlets, build system
- [session-manager](https://github.com/humlab-speech/session-manager) —
  WebSocket backend for container management
