# VISP Webclient

Angular SPA for the Visible Speech platform. Served as static files by the
Apache container.

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
