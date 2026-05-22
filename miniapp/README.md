# LADA Mini App scaffold

This folder is a static Telegram Mini App shell. Serve the repo root so the app can also fetch
the current booking catalog from `data/catalog.json`.

## Current flow

1. Set `MINI_APP_URL` in the bot `.env` to the public HTTPS URL of `index.html`.
2. Start the bot and send `/start` or `/miniapp`.
3. Open the reply keyboard button `Открыть Mini App`.
4. Pick a service, slot and contact inside the app.
5. Submit the booking request to the existing bot flow.

The reply keyboard launch path is kept because `Telegram.WebApp.sendData()` returns data to
the existing bot without adding a separate Mini App backend.

## Local preview

Run a local static server from the repo root:

```sh
python3 -m http.server 8000
```

Then open `/miniapp/` in the browser. For a public development URL, expose the same repo-root
server through an HTTPS tunnel or deploy the repo root to a static host until a permanent host is
chosen.

Cloudflare Quick Tunnel can expose the local preview while it is running:

```sh
cloudflared tunnel --url http://127.0.0.1:8000
```

Use the generated HTTPS URL plus `/miniapp/` as `MINI_APP_URL`.

## Next implementation steps

1. Add hair photo handling or a follow-up photo prompt after Mini App submission.
2. Move availability lookup from optimistic client slots to a Mini App backend endpoint.
3. Decide whether booking submission stays on `sendData()` or moves to a backend endpoint that
   validates `Telegram.WebApp.initData`.
