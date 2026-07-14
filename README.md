# AGTEK Chat Demo — KRE Widget

A demo of the KRE (Kaltura Revenue Engagement) widget embedded on a replica AGTEK earthworks product page. Built to show how an AI-powered chat widget can drive buyer intent scoring, lead capture, and real-time sales intelligence alongside a live product conversation.

Originally derived from an HPE Private Cloud demo. Substantially rebuilt for the AGTEK use case.

---

## Quick start

```bash
npm install
npm run dev
```

Dev server starts at **http://localhost:3104** (will auto-increment if that port is taken).

| Command | Purpose |
|---|---|
| `npm run dev` | Dev server with hot reload |
| `npm run build` | Production bundle → `dist/` |
| `npm run preview` | Preview the production build locally |

---

## What this demo shows

A visitor lands on the AGTEK product page and opens the chat widget. The widget does three things simultaneously:

1. **Answers product questions** via PathFactory Chat Factory (RAG-backed AI)
2. **Scores intent in real time** — fusing keyword signals, PathFactory engagement data, and Groq LLM analysis into a single 0–100 engagement score
3. **Captures lead data from natural conversation** — the avatar and chat both extract name, company, role, and email without a form, and surface that in the admin panel the moment it's spoken

---

## Key features added for AGTEK

### Groq-powered intent scoring + lead capture

The original demo used keyword matching and PathFactory engagement scores only. This version adds a Groq LLM layer that runs on every user turn (both text chat and avatar voice):

- **Intent scoring**: Groq analyzes the full conversation context and returns a 0–1 score, confidence level (`exploring` / `evaluating` / `high_intent`), detected signal categories, and a plain-English reasoning summary
- **Lead extraction**: Groq extracts name, company, role, and email from natural conversation — no form, no explicit questions required
- **Signal fusion**: Groq score (55% weight) is fused with PathFactory engagement (25%) and keyword signals (20%). Falls back gracefully to PF + keywords if Groq is unavailable

All of this happens silently in the background. The visitor just has a conversation.

### Avatar voice conversations feed the scoring pipeline

Avatar voice conversations run through the same Groq enrichment pipeline as text chat. When the avatar speaks and the visitor responds by voice, those transcribed turns are:

- Analyzed for buying signals
- Run through Groq for intent scoring and lead extraction
- Pushed to the admin panel in real time

This means a voice conversation with the avatar is just as trackable as a text chat session — name, company, intent signals, and score all update live as the visitor speaks.

### Real-time admin panel (Live tab)

Press **Ctrl+Shift+K** on the demo page to open the admin panel. The **Live** tab shows:

- Engagement score (0–100) with intent level label
- Detected buying signal categories (pricing, evaluation, timeline, competitive, integration, scale)
- Full Groq intent analysis: score, confidence, level, and plain-English reasoning
- Extracted lead data: name, company, role, email — captured as they surface in conversation
- Per-turn scoring breakdown with the full signal history

This is the "demo within the demo" — show the admin panel on a second screen while someone talks to the widget and watch the scoring update in real time.

### Genie video search integration

Every chat response triggers a parallel Kaltura Genie search. Relevant AGTEK product video clips appear in the sidebar with thumbnail, timestamp, and click-to-play. Powered by a 1-year Kaltura Session scoped to the AGTEK partner account.

### Escalation trigger

When a visitor's intent crosses the high-intent threshold (pricing inquiry, demo request, contact request, or sustained high engagement score), a contextual CTA bubble appears in the chat with options to start a voice conversation with the avatar or book a demo directly.

---

## Avatar modes

The widget supports two avatar modes, controlled by the `avatarIframeUrl` setting in `agtek.html`.

### Kaltura Avatar SDK (default)

A photorealistic video avatar using WebRTC. Authenticates with `clientId` + `flowId` — no Kaltura Session required. The avatar has its own conversational AI brain; context from the current chat session is injected via Dynamic Page Prompt (DPP) when the avatar becomes ready.

```js
// avatarIframeUrl not set → Avatar SDK activates
avatarClientId: '6931df33dd072609137dfe46',
avatarFlowId:   'agent-43',
```

### Genie / Unisphere iframe

Set `avatarIframeUrl: 'genie-embed'` in the page settings to load the Kaltura Genie conversational AI via Unisphere workspace iframe instead. No Avatar SDK is initialized in this mode.

---

## Admin panel

`Ctrl+Shift+K` — opens a floating panel with four tabs:

| Tab | Contents |
|---|---|
| **Live** | Real-time intent score, lead data, Groq analysis, signal history |
| **Settings** | Override any widget setting without redeploying |
| **Debug** | Per-turn scoring log with full signal breakdown |
| **About** | Version info |

---

## Environment variables

`.env` is gitignored. Create it locally from the values below. Set the same variables in Vercel for production.

| Variable | Required | Purpose |
|---|---|---|
| `VITE_GROQ_API_KEY` | Yes | Groq LLM for intent scoring and lead extraction |
| `VITE_GENIE_KS` | Yes | Kaltura Session for Genie video search |
| `VITE_GENIE_PARTNER_ID` | Yes | Kaltura partner ID for Genie and player |
| `VITE_PLAYER_UICONF_ID` | Yes | Kaltura player uiconf ID for video clips |

Without `VITE_GROQ_API_KEY`, intent scoring falls back to keyword + PathFactory signals only (functional, less accurate). Without the Genie keys, video clips are disabled.

---

## Project structure

```
agtek.html                  Demo page — AGTEK product page + widget bootstrap
src/
  kre-runtime.js            Core widget runtime — chat, avatar, booking, intent scoring
  services/
    avatar.js               Kaltura Avatar SDK wrapper (inline SDK + service layer)
    genie.js                Kaltura Genie video search
    groq.js                 Groq LLM enrichment — intent scoring + lead extraction
    pathfactory.js          PathFactory Chat Factory client
    calendly.js             Calendly booking integration
  components/
    admin-panel.js          Real-time admin panel (Live, Settings, Debug, About tabs)
    booking-panel.js        Calendly booking overlay with lead prefill
  styles/
    widget.css              Widget component styles
    admin.css               Admin panel styles
    kre-theme.js            CSS variable tokens
public/images/              AGTEK logos and icons
vercel.json                 Routes / to agtek.html
vite.config.js              Vite build config
```
