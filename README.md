# HPE Webpage Agent — KRE Widget Demo

A replica of the HPE Private Cloud Solutions page with the KRE (Kaltura Revenue Engagement) widget embedded. Used for side-by-side demos against the live HPE site.

---

## Quick start

```bash
npm install
npm run dev
```

The dev server starts at **http://localhost:3104** and opens a browser tab automatically.

| Command | Purpose |
|---|---|
| `npm run dev` | Dev server with hot reload |
| `npm run build` | Production bundle → `dist/` |
| `npm run preview` | Preview the production build locally |

---

## Demo tip

Open the app side-by-side with the live HPE page to show the contrast:

**Live HPE page:** https://www.hpe.com/us/en/private-cloud-solutions.html

The demo page is a faithful replica — same nav, hero, sections, and footer — with the KRE widget layered on top as the only addition.

---

## Swapping the avatar

The widget supports two avatar modes. The active mode is controlled by a single setting (`avatarIframeUrl`) in the `hpeSettings` object at the bottom of [index.html](index.html).

### Mode 1 — Genie / Unisphere iframe (current default)

This loads the Kaltura Genie conversational AI via an embedded Unisphere workspace iframe.

```js
const hpeSettings = {
  avatarIframeUrl: 'genie-embed',   // <-- this line enables Genie mode
  // ...
};
```

When `avatarIframeUrl` is set to any truthy value, `_renderAvatarFullMode()` in [src/kre-runtime.js](src/kre-runtime.js) skips the Avatar SDK entirely and mounts the Genie iframe instead.

### Mode 2 — Kaltura Avatar SDK (video avatar with voice)

This loads a photorealistic video avatar using the Kaltura Avatar SDK (clientId + flowId auth — no Kaltura Session needed).

To switch to this mode, **remove** (or comment out) the `avatarIframeUrl` line from `hpeSettings`:

```js
const hpeSettings = {
  // avatarIframeUrl: 'genie-embed',   // comment this out
  // ...
};
```

The widget will then fall back to the baked-in defaults in `KRE_DEFAULTS`:

```js
avatarClientId: '69162413e12c8dcd118d76a7',
avatarFlowId:   'agent-33',
```

You can override these per-embed by adding them to `hpeSettings`:

```js
const hpeSettings = {
  // avatarIframeUrl: 'genie-embed',   // removed
  avatarClientId: 'your-client-id',
  avatarFlowId:   'your-flow-id',
  // ...
};
```

### How the switch works in code

The branch is at [src/kre-runtime.js](src/kre-runtime.js) in `_renderAvatarFullMode()`:

```js
if (this._settings.avatarIframeUrl) {
  // Genie / Unisphere iframe path
} else {
  // Kaltura Avatar SDK path (clientId + flowId)
}
```

No other code changes are needed — setting or unsetting `avatarIframeUrl` is the entire swap.

---

## Admin panel

Press the **Admin** button in the top-right nav (or `Ctrl+Shift+K`) to open the real-time intent scoring panel. It shows engagement score, detected buying signals, Groq intent analysis, and the full per-turn scoring log.

---

## Project structure

```
index.html                  Main demo page (HPE page replica + widget bootstrap)
src/
  kre-runtime.js            Core widget runtime — chat, avatar, booking modes
  services/
    avatar.js               Kaltura Avatar SDK wrapper
    genie.js                Genie search / RAG backend
    groq.js                 Groq LLM intent enrichment
    pathfactory.js          PathFactory chat client
    calendly.js             Calendly booking integration
  components/
    admin-panel.js          Real-time intent scoring panel
    booking-panel.js        Calendly booking overlay
  styles/
    widget.css              Widget component styles
    admin.css               Admin panel styles
    kre-theme.js            CSS variable tokens
images/
  hpe-avatar-icon.png       Widget launcher icon
vite.config.js              Vite config (port 3104)
```
