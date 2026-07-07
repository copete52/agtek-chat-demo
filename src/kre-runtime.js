/**
 * KRE Runtime — Kaltura Revenue Engagement Widget
 *
 * Built following Unisphere runtime conventions:
 * - Mounts into a target container via light DOM (CSS-prefixed with .kre-*)
 * - Uses PathFactory ChatFactory as the AI backend
 * - Supports multiple modes: chat, avatar, booking
 * - Exposes Unisphere-compatible lifecycle: mount, updateSettings, kill
 * - Publishes events via optional pub-sub service
 *
 * Widget name: kaltura.widget.kre
 * Runtime name: chat
 */

import { PathFactoryClient } from './services/pathfactory.js';
import { AvatarService } from './services/avatar.js';
import { BookingPanel } from './components/booking-panel.js';
import { GroqEnrichmentService } from './services/groq.js';
import { GenieSearchService } from './services/genie.js';
import { KRE_CSS_VARS } from './styles/kre-theme.js';
import WIDGET_CSS from './styles/widget.css?raw';
import ADMIN_CSS from './styles/admin.css?raw';

// ── TODO: Remove once competitor widget is removed from host page ──
(function() {
  const targetID = 'q-messenger-frame';
  const attemptRemoval = () => {
    const el = document.getElementById(targetID);
    if (el) { el.remove(); console.log(`[KRE] Removed competitor widget: ${targetID}`); return true; }
    return false;
  };
  if (attemptRemoval()) return;
  const obs = new MutationObserver((_, o) => { if (attemptRemoval()) o.disconnect(); });
  obs.observe(document.documentElement, { childList: true, subtree: true });
})();

// ── Baked-in defaults — zero-config embed ──
// All keys here are demo/prototype defaults; override via Ctrl+Shift+K or window.__KRE_CONFIG__
const KRE_DEFAULTS = {
  // Version
  kreVersion: '0.6.0',
  // Groq enrichment
  groqApiKey: import.meta.env.VITE_GROQ_API_KEY || '',
  // Avatar (Kaltura Avatar SDK — clientId + flowId auth, no KS needed)
  avatarClientId: '6931df33dd072609137dfe46',
  avatarFlowId: 'agent-43',
  // Genie — 1-year KS, expires April 2027
  /*
  genieKs: 'Y2U1NmNmMmQwOGE4ZWU2NjQ0MGRmMzg0YzIyM2Y5ZGM1ZWRlNTFmMHw4MTE0NDE7ODExNDQxOzE4MDgyODkzODg7MDsxNzc2NzUzMzg4LjIxNzY7MDtzdmlldzoqLGdlbmllaWQ6MzgxNzg1NjkyLHNldHJvbGU6UExBWUJBQ0tfQkFTRV9ST0xFLHdpZGdldDoxOzs=',
  geniePartnerId: '811441',
  playerPartnerId: '811441',
  playerUiconfId: '55937762',
  */
  
  // Genie for AGTEK — 1-year KS, expires June 2027, geniegpcid:2071
  genieKs: 'djJ8NjUxMDA5MnwzC5McOsnA88KfKuk-yMWgF7xPzW8r-NHL9OC3Ijz8VHM3Lh3bHOXui7jfJH8YVD_5zioQF189zX3lwohs_UCCO3yifeYS5AkQAFbSLGsJpZ7axnb37vIqEvSanrdD3U8jNOBf87OA2aHPjc6tcy_5gfVn4jKK5FgZamFR_6BXPA==',
  geniePartnerId: '6510092',
  playerPartnerId: '6510092',
  playerUiconfId: '57983212',
  
  // Booking
  calendlyUrl: 'https://calendly.com/yairneumann11/30min',
  calendlyApiKey: 'eyJraWQiOiIxY2UxZTEzNjE3ZGNmNzY2YjNjZWJjY2Y4ZGM1YmFmYThhNjVlNjg0MDIzZjdjMzJiZTgzNDliMjM4MDEzNWI0IiwidHlwIjoiUEFUIiwiYWxnIjoiRVMyNTYifQ.eyJpc3MiOiJodHRwczovL2F1dGguY2FsZW5kbHkuY29tIiwiaWF0IjoxNzc2MzM0NTEwLCJqdGkiOiIwNTIzZmMyMi0yMDE2LTRjOGQtODM1My1kNmE0NTdiNzM5NzEiLCJ1c2VyX3V1aWQiOiIyZjEzYzQ3ZC1hOGQwLTRmZjUtOTg0NS1kYWIyZDcyY2UyMGIiLCJzY29wZSI6ImF2YWlsYWJpbGl0eTpyZWFkIGF2YWlsYWJpbGl0eTp3cml0ZSBldmVudF90eXBlczpyZWFkIGV2ZW50X3R5cGVzOndyaXRlIGxvY2F0aW9uczpyZWFkIHJvdXRpbmdfZm9ybXM6cmVhZCBzaGFyZXM6d3JpdGUgc2NoZWR1bGVkX2V2ZW50czpyZWFkIHNjaGVkdWxlZF9ldmVudHM6d3JpdGUgc2NoZWR1bGluZ19saW5rczp3cml0ZSBncm91cHM6cmVhZCBvcmdhbml6YXRpb25zOnJlYWQgb3JnYW5pemF0aW9uczp3cml0ZSB1c2VyczpyZWFkIGFjdGl2aXR5X2xvZzpyZWFkIGRhdGFfY29tcGxpYW5jZTp3cml0ZSBvdXRnb2luZ19jb21tdW5pY2F0aW9uczpyZWFkIHdlYmhvb2tzOnJlYWQgd2ViaG9va3M6d3JpdGUifQ.VQqsqMArHDpxI2AS2Sg6d2xvxz6VPTOR29UYLSuv8hCr8w2F9bCFHIC08CRDOEMkBaWgdZBqZuy2hQLW2adVjg',
  calendlyEventType: 'https://api.calendly.com/event_types/78f6c3cc-8499-40ba-b1ee-9b92d6a4f26b',
  // Branding — all user-facing copy
  brandName:        'AGTEK',
  headerTitle:      'AGTEK AI Assistant',
  headerStatus:     'Online · AI Assistant',
  welcomeHeading:   'Hi there!',
  welcomeMessage:   'I\'m your AGTEK earthworks specialist. Ask me about Gradework, Highway, Reveal, Mobile Apps, or finding the right solution for your project.',
  inputPlaceholder: 'Ask about AGTEK products…',
  footerText:       'Powered by <strong>PathFactory</strong> + <strong>Kaltura AI</strong>',
  bookBtnLabel:     'Talk to a Specialist',
  bookBtnSubtext:   'Schedule with an AGTEK expert',
  avatarBtnLabel:   'Chat with virtual agent',
  avatarBtnSubtext: 'Start a voice conversation',
  avatarViewTitle:  'Chat with AGTEK AI Agent',
  escalationText:   'It looks like you\'re evaluating AGTEK solutions for a project. Would you like to connect with a product specialist?',
  escalationLabel:  'Ready for you',
  starterQ1:        'What products does AGTEK offer for earthwork takeoffs?',
  starterQ2:        'How does Gradework help me win more bids?',
  starterQ3:        'What is Reveal and how does AI help my workflow?',
  starterQ4:        'Tell me about AGTEK mobile apps for the field',
  avatarChip1:      'Tell me about Gradework',
  avatarChip2:      'How does Highway work for DOT projects?',
  avatarChip3:      'What makes AGTEK different from other takeoff tools?',
  primaryColor:     '#00a19a',
};

const SVG_CHAT = `<svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H5.17L4 17.17V4h16v12z"/><path d="M7 9h2v2H7zm4 0h2v2h-2zm4 0h2v2h-2z"/></svg>`;
const SVG_SEND = `<svg viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>`;
const SVG_CLOSE = `<svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>`;
const SVG_BACK = `<svg viewBox="0 0 24 24"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>`;
const SVG_AVATAR = `<svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/></svg>`;

// ── Intent scoring engine ──
const ESCALATION_TURNS = 2;

// Signal fusion weights — Groq is primary when available, fallback shifts weight to PF + keywords
const W_GROQ = 0.55, W_PF = 0.25, W_KW = 0.20;
const W_PF_FALLBACK = 0.55, W_KW_FALLBACK = 0.45;

// Keyword decay per turn (15% loss per turn of age)
const DECAY_PER_TURN = 0.85;

// ── Keyword detection: base + strong tiers ──
const BUYING_SIGNALS = [
  { category: 'pricing',     base: 0.20, strong: 0.35, escalate: true,
    keywords: /\b(pric\w*|cost\w*|budget\w*|licens\w*|subscript\w*|per.?seat|how much|afford\w*|invest\w*|spend\w*|roi|total cost|quote\w*)/i,
    strongRe: /\b(quote|proposal|budget.*\d|per\s+seat.*\d|pricing\s+tier)/i },
  { category: 'contact',     base: 0.25, strong: 0.40, escalate: true,
    keywords: /\b(talk to|speak with|contact|call me|reach out|get in touch|schedule|meet with|connect me|sales rep|account exec\w*)/i,
    strongRe: /\b(schedule.*(?:call|demo|meeting)|talk.*(?:sales|account))/i },
  { category: 'evaluation',  base: 0.22, strong: 0.35, escalate: true,
    keywords: /\b(poc|pilot|trial|demo|proof of concept|evaluat\w*|test drive|hands.?on|sandbox|free tier|benchmark)/i,
    strongRe: /\b(POC.*(?:timeline|scope)|pilot.*(?:team|users|start))/i },
  { category: 'timeline',    base: 0.15, strong: 0.28,
    keywords: /\b(timeline|when can|how soon|deadline|implement\w*|go.?live|launch|rollout|time.?frame|by when|ready|start date|onboard\w*)/i,
    strongRe: /\b(go.?live.*(?:Q[1-4]|month|week)|by\s+(?:end|next))/i },
  { category: 'competitive', base: 0.12, strong: 0.22,
    keywords: /\b(compar\w*|vs\.?|versus|alternativ\w*|competitor\w*|switch from|migrat\w*|replace|instead of|better than|differ\w* from|vimeo|brightcove|wistia|panopto)/i,
    strongRe: /\b(switch(?:ing)?\s+from|replace|migrate\s+from)/i },
  { category: 'integration', base: 0.10, strong: 0.18,
    keywords: /\b(integrat\w*|api|connect\w*|crm|salesforce|marketo|hubspot|sso|lti|webhook|sdk|embed\w*|lms|sap|workday|slack)/i,
    strongRe: /\b(API.*(?:docs|access|key)|integrate.*(?:Salesforce|HubSpot))/i },
  { category: 'scale',       base: 0.10, strong: 0.20,
    keywords: /\b(enterprise|scale|how many|concurren\w*|bandwidth|sla|uptime|reliability|region|global|compliance|gdpr|hipaa|soc)/i,
    strongRe: /\b((?:\d{2,})\s*(?:seats|users|licenses)|enterprise\s+(?:plan|tier))/i },
];

// Negative signals — push score down
const NEGATIVE_SIGNALS = [
  { pattern: /\b(just\s+(?:browsing|looking|curious|researching))\b/i, weight: -0.15 },
  { pattern: /\b(not\s+(?:ready|interested|looking\s+to\s+buy))\b/i, weight: -0.20 },
  { pattern: /\b(maybe\s+(?:later|next\s+(?:year|quarter)))\b/i, weight: -0.12 },
  { pattern: /\b(student|homework|school\s+project|academic)\b/i, weight: -0.25 },
  { pattern: /\b(no\s+budget|not\s+(?:in\s+)?(?:the\s+)?budget)\b/i, weight: -0.18 },
];

/**
 * Scan a user message for buying signals (graduated: base vs strong).
 * @returns {{ boost: number, signals: string[], categories: string[], negativeBoost: number }}
 */
function detectBuyingSignals(text) {
  if (!text) return { boost: 0, signals: [], categories: [], negativeBoost: 0 };
  const signals = [];
  const categories = [];
  let boost = 0;
  for (const sig of BUYING_SIGNALS) {
    const match = sig.keywords.test(text);
    if (match) {
      const isStrong = sig.strongRe?.test(text);
      const b = isStrong ? sig.strong : sig.base;
      boost += b;
      categories.push(sig.category);
      signals.push({ category: sig.category, boost: b, strength: isStrong ? 'strong' : 'base', escalate: !!sig.escalate });
    }
  }
  // Negative signals
  let negativeBoost = 0;
  for (const neg of NEGATIVE_SIGNALS) {
    if (neg.pattern.test(text)) negativeBoost += neg.weight;
  }
  negativeBoost = Math.max(negativeBoost, -0.35);

  return { boost: Math.min(boost, 0.65), signals, categories, negativeBoost };
}

// ── Intent Debug Logger ──
// Collects all intent data per turn; dumps via console.groupCollapsed + window.__KRE_INTENT_LOG__
const _intentLog = [];
function _ilog(turnNum, step, data) {
  if (!_intentLog[turnNum]) _intentLog[turnNum] = { turn: turnNum, steps: [] };
  _intentLog[turnNum].steps.push({ step, ts: Date.now(), ...data });
}
function _idump(turnNum) {
  const entry = _intentLog[turnNum];
  if (!entry) return;
  console.groupCollapsed(`%c[KRE INTENT] Turn ${turnNum}`, 'color:#7c3aed;font-weight:bold');
  for (const s of entry.steps) console.log(`  ${s.step}:`, s);
  console.groupEnd();
  // Always keep full log on window for copy-paste
  if (typeof window !== 'undefined') window.__KRE_INTENT_LOG__ = _intentLog;
}

/**
 * Check if any force-escalate categories are present.
 */
function hasEscalateCategories(categories) {
  return ['pricing', 'contact', 'evaluation'].some(c => categories.includes(c));
}

/**
 * Strip markdown/HTML to plain text for avatar speech synthesis.
 * Converts links to just their label, removes formatting markers.
 */
function stripMarkdown(text) {
  if (!text) return '';
  return text
    // [[text]](url) or [text](url) → text
    .replace(/\[{1,2}([^\]]+)\]{1,2}\([^)]+\)/g, '$1')
    // HTML tags
    .replace(/<[^>]+>/g, '')
    // Bold/italic markers
    .replace(/\*{1,2}(.+?)\*{1,2}/g, '$1')
    .replace(/_{1,2}(.+?)_{1,2}/g, '$1')
    // Inline code
    .replace(/`([^`]+)`/g, '$1')
    // Bullet markers
    .replace(/^[\s]*[-*]\s/gm, '')
    // Numbered list markers
    .replace(/^[\s]*\d+\.\s/gm, '')
    // Multiple spaces/newlines
    .replace(/\n{2,}/g, '. ')
    .replace(/\n/g, ' ')
    .trim();
}

/**
 * Lightweight markdown-to-HTML renderer for bot responses.
 * Handles: bold, italic, links, bullets, numbered lists, code, line breaks, paragraphs.
 */
function renderMarkdown(text) {
  if (!text) return '';
  // If text is already HTML (contains tags), do light cleanup only
  if (/<[a-z][\s\S]*>/i.test(text)) {
    return text
      .replace(/<a /g, '<a target="_blank" rel="noopener noreferrer" ')
      .replace(/\n/g, '');
  }

  let html = text;

  // Escape HTML entities
  html = html.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  // Code blocks (``` ... ```)
  html = html.replace(/```(\w*)\n?([\s\S]*?)```/g, (_, lang, code) =>
    `<pre><code>${code.trim()}</code></pre>`
  );

  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

  // Bold (**text** or __text__)
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/__(.+?)__/g, '<strong>$1</strong>');

  // Italic (*text* or _text_)
  html = html.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '<em>$1</em>');

  // Links [text](url) — also handles [[text]](url) from PathFactory
  html = html.replace(/\[{1,2}([^\]]+)\]{1,2}\(([^)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>'
  );

  // Process lines into paragraphs and lists
  const lines = html.split('\n');
  const blocks = [];
  let currentList = null;
  let listType = null;

  for (const line of lines) {
    const trimmed = line.trim();

    // Unordered list
    if (/^[-*]\s+/.test(trimmed)) {
      if (listType !== 'ul') {
        if (currentList) blocks.push(`</${listType}>`);
        currentList = [];
        listType = 'ul';
        blocks.push('<ul>');
      }
      blocks.push(`<li>${trimmed.replace(/^[-*]\s+/, '')}</li>`);
    }
    // Ordered list
    else if (/^\d+\.\s+/.test(trimmed)) {
      if (listType !== 'ol') {
        if (currentList) blocks.push(`</${listType}>`);
        currentList = [];
        listType = 'ol';
        blocks.push('<ol>');
      }
      blocks.push(`<li>${trimmed.replace(/^\d+\.\s+/, '')}</li>`);
    }
    // End of list
    else {
      if (currentList !== null) {
        blocks.push(`</${listType}>`);
        currentList = null;
        listType = null;
      }
      if (trimmed === '') {
        // Skip empty lines (handled by paragraph spacing)
      } else {
        blocks.push(`<p>${trimmed}</p>`);
      }
    }
  }
  if (currentList !== null) blocks.push(`</${listType}>`);

  return blocks.join('');
}

/**
 * Compute engagement score by fusing 3 signal sources:
 *   1. Groq LLM intent (primary when available)
 *   2. PathFactory engagement score (server-side)
 *   3. Client-side keyword signals (with decay)
 *
 * Falls back to PF+keywords when Groq is unavailable (rate limit, no key, error).
 *
 * @param {{ pfScore: number, groqIntent: object|null, currentBoost: number,
 *           negativeBoost: number, turnHistory: Array, turnCount: number }} params
 * @returns {number} 0–1
 */
function computeEngagement({ pfScore, groqIntent, currentBoost, negativeBoost, turnHistory, turnCount }) {
  // 1. Decayed keyword score — older signals lose weight
  let decayedBoost = 0;
  for (const entry of turnHistory) {
    const age = turnCount - entry.turn;
    if (age > 0) decayedBoost += entry.boost * Math.pow(DECAY_PER_TURN, age);
  }
  const totalKwScore = Math.min(decayedBoost + currentBoost, 0.85);
  const keywordNorm = Math.min(totalKwScore / 0.6, 1.0);

  // 2. Turn momentum — conversation depth matters
  const turnMomentum = Math.min(turnCount * 0.15, 0.4);
  const pfEffective = Math.max(pfScore, turnMomentum);

  // 3. Signal density bonus — multiple categories in one message
  const densityBonus = currentBoost > 0 ? Math.min(turnHistory.filter(h => h.turn === turnCount).length * 0.03, 0.10) : 0;

  // 4. Fuse signals — Groq primary when available, fallback otherwise
  let score;
  if (groqIntent && groqIntent.confidence > 0.3) {
    const groqScore = groqIntent.score;
    const negAdjust = groqIntent.negative * -0.3;
    score = W_GROQ * groqScore + W_PF * pfEffective + W_KW * keywordNorm + densityBonus + negAdjust;
    console.debug('[KRE] scoring FUSED: groq=%.2f pf=%.2f kw=%.2f neg=%.2f → %.2f',
      groqScore, pfEffective, keywordNorm, negAdjust, score);
  } else {
    // Fallback: no Groq (rate limit, disabled, error) — shift weight to PF + keywords
    score = W_PF_FALLBACK * pfEffective + W_KW_FALLBACK * keywordNorm + densityBonus + negativeBoost;
    console.debug('[KRE] scoring FALLBACK (no Groq): pf=%.2f kw=%.2f neg=%.2f → %.2f',
      pfEffective, keywordNorm, negativeBoost, score);
  }

  // 5. Turn ramp — soft ceiling early in conversation (multiplicative, not hard cap)
  const turnRamp = turnCount <= 1 ? 0.55 : turnCount <= 2 ? 0.85 : 1.0;
  score *= turnRamp;

  return Math.max(0, Math.min(score, 1.0));
}

/**
 * Corroborated escalation — requires 2-of-3 sources to agree on high intent.
 * Prevents single regex match from triggering escalation.
 */
function shouldEscalate({ score, groqIntent, turnCount, categories }) {
  // Fast-track: pricing, demo request, or contact request → escalate immediately
  if (hasEscalateCategories(categories)) return true;

  // Conservative path for other signals — multi-source corroboration
  if (turnCount < ESCALATION_TURNS) return false;
  if (score < 0.60) return false;

  let agree = 0;
  if (score >= 0.65) agree++;
  if (groqIntent?.level === 'high_intent') agree++;

  return agree >= 2 || score >= 0.85;
}

function getIntentLevel(score) {
  if (score >= 0.65) return 'high';
  if (score >= 0.35) return 'evaluating';
  return 'exploring';
}

function getIntentLabel(level) {
  switch (level) {
    case 'high': return 'High Intent';
    case 'evaluating': return 'Evaluating';
    default: return 'Exploring';
  }
}

export class KRERuntime {
  constructor(options = {}) {
    this._target = options.target || null;
    this._scriptSettings = { ...(options.settings || {}) }; // original script values (no cookies)
    // Merge: baked defaults < script settings < localStorage overrides
    this._settings = { ...KRE_DEFAULTS, ...this._scriptSettings, ...KRERuntime._readOverrides() };
    this._pubSub = options.pubSub || null;   // Unisphere pub-sub service
    this._storage = options.storage || null;  // Unisphere storage service

    this._pf = new PathFactoryClient(this._settings);
    this._enrichment = new GroqEnrichmentService({
      apiKey: this._settings.groqApiKey || '',
      model: this._settings.groqModel || undefined,
      systemPrompt: this._settings.enrichmentPrompt || undefined,
    });
    this._genie = new GenieSearchService({
      ks: this._settings.genieKs || '',
      partnerId: this._settings.geniePartnerId || '',
      baseUrl: this._settings.genieBaseUrl || undefined,
    });
    this._lastClips = [];
    this._activeClipIdx = -1;
    this._kPlayers = [];        // one KalturaPlayer instance per clip
    this._playerEls = [];       // one wrapper div per clip
    this._avatar = null;
    this._booking = null;
    this._messages = [];
    this._loading = false;
    this._ready = false;
    this._open = false;
    this._engagement = 0;
    this._intentLevel = 'exploring';
    this._lastFollowUps = [];
    this._lastCards = [];
    this._lastCitations = [];
    this._lastIntent = {};
    this._turnCount = 0;
    this._queries = [];
    this._escalationShown = false;
    this._escalationDismissed = false;
    this._detectedSignals = [];   // accumulated buying signal categories
    this._signalHistory = [];     // per-message signal log for admin panel
    this._intentLog = [];         // per-turn intent scoring breakdown for Live tab
    this._boostHistory = [];      // per-turn boost for decay: [{ turn, boost }]
    this._allCategories = [];     // all detected categories across turns (for corroboration)
    this._mode = 'chat'; // chat | avatar-full
    this._demandbaseProfile = null; // populated by Demandbase IP API
    this._bookingOverlayOpen = false;
    this._avatarReady = false;
    this._root = null;
    this._host = null;

    // Avatar config from settings (Kaltura Avatar SDK — clientId + flowId)
    this._avatarConfig = {
      clientId: this._settings.avatarClientId || '6931df33dd072609137dfe46',
      flowId: this._settings.avatarFlowId || 'agent-41',
    };
  }

  // ── Unisphere lifecycle ──

  async mount(container) {
    const target = container || this._target;
    if (!target) throw new Error('KRE: no target container');

    const host = typeof target === 'string' ? document.getElementById(target) || document.querySelector(target) : target;
    if (!host) throw new Error(`KRE: target "${target}" not found`);

    this._host = host;

    // Inject styles into light DOM (once)
    if (!document.getElementById('kre-widget-css')) {
      const style = document.createElement('style');
      style.id = 'kre-widget-css';
      style.textContent = WIDGET_CSS;
      document.head.appendChild(style);
    }

    if (!document.getElementById('kre-admin-css')) {
      const style = document.createElement('style');
      style.id = 'kre-admin-css';
      style.textContent = ADMIN_CSS;
      document.head.appendChild(style);
    }

    // Apply primary color override if set
    if (this._settings.primaryColor) {
      const colorStyle = document.createElement('style');
      colorStyle.id = 'kre-color-override';
      colorStyle.textContent = `.kre { --kre-primary: ${this._settings.primaryColor}; }`;
      document.head.appendChild(colorStyle);
    }

    // Create root element in light DOM
    this._root = document.createElement('div');
    this._root.className = 'kre';
    host.appendChild(this._root);

    this._renderLauncher();
    this._initBackend();
    this._registerConfigHotkey();
    this._injectDemandbase();
    this._pollDemandbase();
  }

  updateSettings(settings) {
    Object.assign(this._settings, settings);
  }

  kill() {
    if (this._avatar) this._avatar.destroy();
    if (this._booking) this._booking.destroy();
    this._destroyPlayers();
    if (this._root) { this._root.remove(); this._root = null; }
    this._pf = null;
  }

  /** Get live widget data for admin panel */
  getLiveData() {
    return {
      engagementScore: this._engagement,
      intentLevel: getIntentLabel(this._intentLevel),
      turnCount: this._turnCount,
      queries: this._queries.slice(-5),
      lastIntent: this._lastIntent,
      groqIntent: this._enrichment.intentScore,
      detectedSignals: this._detectedSignals,
      signalHistory: this._signalHistory,
      boostHistory: this._boostHistory,
      lead: this._enrichment.lead,
      enrichmentEnabled: this._enrichment.enabled,
      demandbaseProfile: this._demandbaseProfile,
      intentLog: this._intentLog,
    };
  }

  // ── Backend init ──

  async _initBackend() {
    try {
      await this._pf.init();
      this._ready = true;
      this._emit('kre:ready', {});
      if (this._open) this._updateStatus();
    } catch (err) {
      console.error('KRE: init failed', err);
      this._emit('kre:error', { error: err.message });
    }
  }

  // ── Render methods ──

  _renderLauncher() {
    this._root.innerHTML = `
      <button class="kre-launcher" aria-label="Open chat">${SVG_CHAT}</button>
    `;
    this._root.querySelector('.kre-launcher').addEventListener('click', () => this._toggle());
  }

  _toggle() {
    if (this._open) {
      this._closePlayer();
      // Close with animation
      const panel = this._root.querySelector('.kre-panel');
      if (panel) {
        panel.classList.add('kre-panel--closing');
        panel.addEventListener('animationend', () => {
          this._open = false;
          this._renderLauncher();
          this._emit('kre:close', {});
        }, { once: true });
      } else {
        this._open = false;
        this._renderLauncher();
        this._emit('kre:close', {});
      }
    } else {
      this._open = true;
      this._renderPanel();
      this._emit('kre:open', {});
    }
  }

  _renderPanel() {
    const scorePercent = Math.round(this._engagement * 100);
    this._root.innerHTML = `
      <button class="kre-launcher kre-launcher--close" aria-label="Close chat">${SVG_CLOSE}</button>
      <div class="kre-panel" role="dialog" aria-label="Chat with ${this._esc(this._settings.headerTitle)}">
        <div class="kre-header">
          <button class="kre-header__back" aria-label="Back to chat" hidden>${SVG_BACK}</button>
          <div class="kre-header__avatar">
            <img src="/images/logosmall.png" alt="AGTEK" width="36" height="36" style="border-radius:50%;object-fit:contain;background:#fff;padding:4px;" />
          </div>
          <div class="kre-header__info">
            <h3>${this._esc(this._settings.headerTitle)}</h3>
            <p class="kre-header__status">${this._ready ? this._esc(this._settings.headerStatus) : 'Connecting…'}</p>
          </div>
          <button class="kre-header__book" aria-label="${this._escAttr(this._settings.bookBtnLabel)}">${this._esc(this._settings.bookBtnLabel)}</button>
          <button class="kre-header__close" aria-label="Close chat">${SVG_CLOSE}</button>
        </div>
        <div class="kre-body-slot"></div>
        <div class="kre-booking-overlay">
          <button class="kre-booking-overlay__close" aria-label="Close booking">${SVG_CLOSE}</button>
          <div class="kre-booking-overlay__body"></div>
        </div>
      </div>
    `;

    // Wire events
    this._root.querySelector('.kre-launcher').addEventListener('click', () => this._toggle());
    this._root.querySelector('.kre-header__close').addEventListener('click', () => this._toggle());
    this._root.querySelector('.kre-header__back').addEventListener('click', () => this._switchMode('chat'));
    this._root.querySelector('.kre-header__book').addEventListener('click', () => this._toggleBookingOverlay());
    this._root.querySelector('.kre-booking-overlay__close').addEventListener('click', () => this._hideBookingOverlay());

    // Render current mode
    this._renderMode();
    this._updateIntent();
    this._updateScore();
  }

  _renderMode() {
    const body = this._root.querySelector('.kre-body-slot');
    if (!body) return;

    // Show/hide header back button based on mode
    const backBtn = this._root.querySelector('.kre-header__back');
    if (backBtn) backBtn.hidden = (this._mode === 'chat');

    // Toggle panel width for avatar-full
    const panel = this._root.querySelector('.kre-panel');
    if (panel) panel.classList.toggle('kre-panel--avatar-full', this._mode === 'avatar-full');

    switch (this._mode) {
      case 'chat':
        this._renderChatMode(body);
        break;
      case 'avatar-full':
        this._renderAvatarFullMode(body);
        break;
    }
  }

  _renderChatMode(body) {
    body.innerHTML = `
      <div class="kre-chat-layout">
        <div class="kre-chat-layout__sidebar">
          <div class="kre-sidebar__header">Video Clips</div>
          <div class="kre-clips-slot" role="region" aria-label="Related video clips"></div>
          <div class="kre-sidebar__divider"></div>
          <div class="kre-sidebar__header">Related Content</div>
          <div class="kre-cards-slot" role="region" aria-label="Recommended content"></div>
        </div>
        <div class="kre-chat-layout__main">
          <div class="kre-chat-layout__content">
            <div class="kre-messages" role="log" aria-live="polite" aria-label="Chat messages"></div>
            <div class="kre-chips-slot"></div>
            <div class="kre-input-bar">
              <input class="kre-input" type="text" aria-label="Type your message" placeholder="${this._ready ? this._escAttr(this._settings.inputPlaceholder) : 'Connecting…'}" ${!this._ready ? 'disabled' : ''} />
              <button class="kre-avatar-btn" aria-label="${this._escAttr(this._settings.avatarBtnLabel)}" title="${this._escAttr(this._settings.avatarBtnLabel)}">${SVG_AVATAR}</button>
              <button class="kre-send" aria-label="Send message" disabled>${SVG_SEND}</button>
            </div>
          </div>
          <div class="kre-footer">
            <span class="kre-footer__sep"></span>
            <span class="kre-footer__text">${this._settings.footerText} <span style="opacity:0.4;font-size:9px;margin-left:4px">v${this._esc(this._settings.kreVersion)}</span></span>
          </div>
        </div>
      </div>
    `;

    const input = body.querySelector('.kre-input');
    const send = body.querySelector('.kre-send');

    input.addEventListener('input', () => {
      send.disabled = !input.value.trim() || this._loading || !this._ready;
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this._send();
      }
      if (e.key === 'Escape') {
        this._toggle();
      }
    });
    send.addEventListener('click', () => this._send());

    // Avatar button → open avatar as overlay over chat
    body.querySelector('.kre-avatar-btn').addEventListener('click', () => {
      this._showAvatarOverlay();
    });

    // Show welcome or messages — welcome shows even if backend hasn't connected yet
    if (this._messages.length === 0) {
      this._renderWelcome();
    } else {
      this._renderMessages();
    }

    setTimeout(() => input.focus(), 100);
  }

  /**
   * Full-view avatar mode — Kaltura Avatar SDK iframe fills the video column.
   * Avatar has its own AI brain; user can type prompts via injectPrompt().
   */
  _renderAvatarFullMode(body) {
    if (this._settings.avatarIframeUrl) {
      const container = document.createElement('div');
      container.id = 'genie-container';
      container.style.cssText = 'width:100%;height:100%;';
      body.innerHTML = '';
      body.appendChild(container);

      const script = document.createElement('script');
      script.type = 'module';
      script.textContent = `
        (async () => {
          try {
            const { embeds } = await import('https://unisphere.nvp1.ovp.kaltura.com/v1/loader/index.esm.js');
            const { apis } = await embeds.workspace({
              env: 'us',
              apis: ['genieChat'],
              session: { widgetId: '1_ms7obdam', partnerId: 6521532 },
            });
            apis.genieChat.contained({ elementId: 'genie-container' });
          } catch (e) {
            console.error('Failed to create workspace:', e);
          }
        })();
      `;
      body.appendChild(script);
      return;
    }

    body.innerHTML = `
      <div class="kre-avatar-full">
        <div class="kre-avatar-full__col-video">
          <div class="kre-avatar-full__video" id="kre-avatar-full-mount">
            <div class="kre-avatar-full__status kre-avatar-full__status--connecting" id="kre-avatar-status">
              <span class="kre-avatar-full__status-dot"></span>
              <span class="kre-avatar-full__status-label">Loading avatar…</span>
            </div>
          </div>
        </div>
        <div class="kre-avatar-full__col-chat">
          <div class="kre-avatar-full__col-header">
            <h4>Conversation</h4>
            <p>${this._esc(this._settings.avatarViewTitle)}</p>
          </div>
          <div class="kre-avatar-full__transcript" id="kre-avatar-full-transcript"></div>
          <div class="kre-avatar-full__suggestions">
            <button class="kre-avatar-full__chip">${this._esc(this._settings.avatarChip1)}</button>
            <button class="kre-avatar-full__chip">${this._esc(this._settings.avatarChip2)}</button>
            <button class="kre-avatar-full__chip">${this._esc(this._settings.avatarChip3)}</button>
          </div>
          <div class="kre-avatar-full__controls">
            <div class="kre-avatar-full__cta-slot"></div>
            <button class="kre-avatar-full__book">\u{1F4C5} ${this._esc(this._settings.bookBtnLabel)}</button>
          </div>
          <div class="kre-input-bar kre-input-bar--dark">
            <input class="kre-input" type="text" aria-label="Type your message" placeholder="Ask the avatar…" />
            <button class="kre-send" aria-label="Send message" disabled>${SVG_SEND}</button>
          </div>
        </div>
      </div>
    `;

    body.querySelector('.kre-avatar-full__book').addEventListener('click', () => this._switchMode('booking'));

    // Suggestion chips → inject prompt into SDK
    body.querySelectorAll('.kre-avatar-full__chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const input = this._root.querySelector('.kre-input');
        if (input) {
          input.value = chip.textContent;
          this._sendFromAvatarFull();
        }
        const suggestions = this._root.querySelector('.kre-avatar-full__suggestions');
        if (suggestions) suggestions.style.display = 'none';
      });
    });

    const input = body.querySelector('.kre-input');
    const send = body.querySelector('.kre-send');

    input.addEventListener('input', () => {
      send.disabled = !input.value.trim();
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this._sendFromAvatarFull();
      }
    });
    send.addEventListener('click', () => this._sendFromAvatarFull());

    // Build DPP context for the avatar's AI brain
    const dppContext = this._buildAvatarDPP();

    // Initialize new Kaltura Avatar SDK
    const fullMount = body.querySelector('#kre-avatar-full-mount');
    if (this._avatar) this._avatar.destroy();
    this._avatar = new AvatarService(this._avatarConfig);
    this._avatar.setDPPContext(dppContext);
    this._avatar.init(fullMount, (event, data) => {
      this._emit(`kre:${event}`, data);

      if (event === 'avatar:ready') {
        const status = this._root.querySelector('#kre-avatar-status');
        if (status) {
          status.className = 'kre-avatar-full__status kre-avatar-full__status--listening';
          const label = status.querySelector('.kre-avatar-full__status-label');
          if (label) label.textContent = 'Listening';
        }
      }

      if (event === 'avatar:spoke') {
        // Show avatar response in transcript
        const transcript = this._root.querySelector('#kre-avatar-full-transcript');
        if (transcript && data?.text) {
          transcript.innerHTML += `<div class="kre-avatar-tline kre-avatar-tline--bot"><span class="kre-avatar-tline__label">AI Avatar</span>${this._esc(data.text)}</div>`;
          transcript.scrollTop = transcript.scrollHeight;
        }
        // Run signal detection on avatar responses for intent scoring
        if (data?.text) {
          this._detectAvatarSignals(data.text, 'avatar');
        }
        // Update status
        const status = this._root.querySelector('#kre-avatar-status');
        if (status) {
          status.className = 'kre-avatar-full__status kre-avatar-full__status--speaking';
          const label = status.querySelector('.kre-avatar-full__status-label');
          if (label) label.textContent = 'Speaking';
          setTimeout(() => {
            if (status) {
              status.className = 'kre-avatar-full__status kre-avatar-full__status--listening';
              const l2 = status.querySelector('.kre-avatar-full__status-label');
              if (l2) l2.textContent = 'Listening';
            }
          }, 1500);
        }
      }

      if (event === 'avatar:user-spoke') {
        // Show user speech in transcript
        const transcript = this._root.querySelector('#kre-avatar-full-transcript');
        if (transcript && data?.text) {
          transcript.innerHTML += `<div class="kre-avatar-tline kre-avatar-tline--user">${this._esc(data.text)}</div>`;
          transcript.scrollTop = transcript.scrollHeight;
          this._turnCount++;
          this._queries.push(data.text);
        }
        // Run signal detection on user speech
        if (data?.text) {
          this._detectAvatarSignals(data.text, 'user');
        }
      }

      if (event === 'avatar:ended') {
        const status = this._root.querySelector('#kre-avatar-status');
        if (status) {
          status.className = 'kre-avatar-full__status kre-avatar-full__status--ended';
          const label = status.querySelector('.kre-avatar-full__status-label');
          if (label) label.textContent = 'Conversation ended';
        }
      }

      if (event === 'avatar:error') {
        const status = this._root.querySelector('#kre-avatar-status');
        if (status) {
          status.className = 'kre-avatar-full__status kre-avatar-full__status--error';
          const label = status.querySelector('.kre-avatar-full__status-label');
          if (label) label.textContent = 'Error: ' + (data?.message || 'unknown');
        }
      }
    });

    setTimeout(() => input.focus(), 100);
  }

  /**
   * Build DPP (Dynamic Page Prompt) context JSON for the avatar's AI brain.
   * Includes product context, visitor info, conversation history, and signals.
   */
  _buildAvatarDPP() {
    const lead = this._enrichment?.lead || {};
    const visitorCtx = this._enrichment?.visitorContext || '';
    const signals = this._detectedSignals || [];
    const intentLabel = getIntentLabel(this._intentLevel);

    // Build conversation summary from chat mode (if any prior messages)
    let chatSummary = '';
    if (this._queries.length > 0) {
      chatSummary = `The visitor has already asked ${this._queries.length} question(s) in chat mode. Topics: ${this._queries.slice(-5).join('; ')}. Current intent: ${intentLabel}.`;
    }

    const dpp = {
      role: 'AGTEK AI Product Specialist',
      context: `You are a friendly AGTEK earthworks software specialist embedded on agtek.com. Your goal is to help contractors, estimators, and project managers find the right AGTEK products, answer technical questions, and guide interested prospects toward connecting with an AGTEK sales expert.`,
      product: 'AGTEK — leading earthworks software for the construction industry. Products include Gradework (takeoff & estimating), Highway (DOT projects), Materials, Underground, Reveal (AI-powered), Trackwork (production management), and mobile apps (FieldView, SiteView, DroneView). Part of the Hexagon family.',
      instructions: [
        'Be conversational, warm, and concise.',
        'Keep answers focused on AGTEK products, workflows, and use cases.',
        'If the visitor seems interested in pricing, demos, or evaluation, encourage them to book a meeting with an AGTEK specialist.',
        'Naturally collect lead information (name, company, role) when appropriate — one field at a time, never pushy.',
        'NEVER reference a company name from background data — only use company info the visitor has told you directly.',
      ],
    };

    if (visitorCtx) dpp.visitorContext = visitorCtx;
    if (lead.company) dpp.knownCompany = lead.company;
    if (lead.firstName) dpp.knownName = lead.firstName;
    if (lead.role) dpp.knownRole = lead.role;
    if (chatSummary) dpp.priorConversation = chatSummary;
    if (signals.length) dpp.detectedSignals = signals;

    return JSON.stringify(dpp);
  }

  _buildChatHistory() {
    const chatMessages = this._messages.filter(m => m.role === 'user' || m.role === 'bot');
    if (!chatMessages.length) return null;
    const lines = ['The following is the conversation so far. Use it as context for this conversation:'];
    for (const m of chatMessages) {
      const speaker = m.role === 'user' ? 'User' : 'Assistant';
      const text = m.html.replace(/<[^>]+>/g, '').trim();
      if (text) lines.push(`${speaker}: ${text}`);
    }
    return lines.join('\n');
  }

  /**
   * Run buying-signal detection on avatar conversation text (user or avatar speech).
   * Updates intent scoring and live data without Groq enrichment.
   */
  _detectAvatarSignals(text, speaker) {
    const { boost: keywordBoost, signals, categories, negativeBoost } = detectBuyingSignals(text);
    if (signals.length) {
      this._detectedSignals.push(...categories.filter(s => !this._detectedSignals.includes(s)));
      if (speaker === 'user') {
        this._signalHistory.push({ turn: this._turnCount, text, signals });
      }
    }
    this._allCategories.push(...categories.filter(c => !this._allCategories.includes(c)));
    if (keywordBoost > 0) this._boostHistory.push({ turn: this._turnCount, boost: keywordBoost });

    // Compute engagement without Groq (keyword + PF only)
    const _scoringInput = {
      pfScore: 0,
      groqIntent: null,
      currentBoost: keywordBoost,
      negativeBoost,
      turnHistory: this._boostHistory,
      turnCount: this._turnCount,
    };
    this._engagement = computeEngagement(_scoringInput);
    this._intentLevel = getIntentLevel(this._engagement);

    this._intentLog.push({
      turn: this._turnCount,
      ts: Date.now(),
      engagement: this._engagement,
      level: this._intentLevel,
      groqScore: null,
      groqLevel: null,
      groqConf: null,
      groqNeg: null,
      pfScore: 0,
      kwBoost: keywordBoost,
      negBoost: negativeBoost,
      signals: [...this._detectedSignals],
      reasoning: `Avatar mode — ${speaker} signal detection`,
    });
    this._emit('kre:livedata', this.getLiveData());
    this._updateAvatarCta();
  }

  /**
   * Send text prompt from avatar full-view input bar.
   * Injects the text into the SDK's conversation via injectPrompt().
   * The avatar AI handles the response natively.
   */
  _sendFromAvatarFull() {
    const input = this._root.querySelector('.kre-input');
    if (!input) return;
    const text = input.value.trim();
    if (!text) return;
    input.value = '';
    this._root.querySelector('.kre-send').disabled = true;

    // Show user message in transcript
    const transcript = this._root.querySelector('#kre-avatar-full-transcript');
    if (transcript) {
      transcript.innerHTML += `<div class="kre-avatar-tline kre-avatar-tline--user">${this._esc(text)}</div>`;
      transcript.scrollTop = transcript.scrollHeight;
    }

    this._turnCount++;
    this._queries.push(text);
    this._messages.push({ role: 'user', html: this._esc(text) });

    // Run signal detection for intent scoring
    this._detectAvatarSignals(text, 'user');

    // Inject prompt into the SDK — avatar handles the rest
    if (this._avatar) {
      this._avatar.injectPrompt(text);
    }

    input.focus();
  }

  /**
   * Update the contextual CTA in avatar full-view mode when signals are detected
   */
  _updateAvatarCta() {
    const slot = this._root.querySelector('.kre-avatar-full__cta-slot');
    if (!slot) return;

    if (this._detectedSignals.length === 0) { slot.innerHTML = ''; return; }

    let ctaText = 'Ready to continue the conversation with our team?';
    const signals = this._detectedSignals;
    if (signals.includes('pricing')) ctaText = 'Want a personalized quote?';
    else if (signals.includes('evaluation')) ctaText = 'Ready for a hands-on demo?';
    else if (signals.includes('timeline')) ctaText = 'Let\'s plan your timeline';

    slot.innerHTML = `
      <div class="kre-avatar-full__cta-nudge">${ctaText}</div>
    `;
  }

  _toggleBookingOverlay() {
    if (this._bookingOverlayOpen) {
      this._hideBookingOverlay();
    } else {
      this._showBookingOverlay();
    }
  }

  /** Build a text summary of the conversation for the Calendly notes field */
  _buildBookingSummary() {
    if (this._turnCount === 0) return '';

    const lead = this._enrichment.lead;
    const db = this._demandbaseProfile;
    const lines = [];

    // Visitor context
    const who = [];
    const name = [lead.firstName, lead.lastName].filter(Boolean).join(' ');
    if (name) who.push(name);
    if (lead.role) who.push(lead.role);
    if (lead.company) who.push(lead.company);
    else if (db?.company_name) who.push(db.company_name);
    if (who.length) lines.push(`Visitor: ${who.join(', ')}`);
    if (db?.industry) lines.push(`Industry: ${db.industry}`);
    if (db?.employee_range) lines.push(`Company size: ${db.employee_range}`);

    // Conversation topics — extract visitor questions
    lines.push('');
    lines.push('Topics discussed:');
    const userMsgs = this._messages.filter(m => m.role === 'user');
    for (const msg of userMsgs.slice(-5)) {
      const text = (msg.text || msg.html || '').replace(/<[^>]*>/g, '').trim();
      if (text) lines.push(`- ${text}`);
    }

    // Intent signals
    if (this._detectedSignals.length) {
      lines.push('');
      lines.push(`Buying signals: ${this._detectedSignals.join(', ')}`);
    }

    // Groq reasoning
    const gi = this._enrichment.intentScore;
    if (gi?.reasoning) {
      lines.push(`Intent: ${gi.level} (${Math.round(gi.score * 100)}%) — ${gi.reasoning}`);
    }

    // Action items
    lines.push('');
    lines.push('Action items:');
    if (this._detectedSignals.includes('pricing')) lines.push('- Provide custom pricing quote');
    if (this._detectedSignals.includes('evaluation') || this._detectedSignals.includes('contact'))
      lines.push('- Schedule product demo');
    if (this._detectedSignals.includes('integration')) lines.push('- Discuss integration requirements');
    if (this._detectedSignals.includes('competitive')) lines.push('- Prepare competitive comparison');
    if (this._detectedSignals.includes('scale')) lines.push('- Review scalability & deployment options');
    if (lead.company || db?.company_name) lines.push(`- Research ${lead.company || db.company_name} use case`);
    if (lines[lines.length - 1] === 'Action items:') lines.push('- Follow up on conversation topics');

    return lines.join('\n');
  }

  _showAvatarOverlay() {
    if (this._avatar) return; // already running

    const content = this._root.querySelector('.kre-chat-layout__content');
    if (!content) return;

    const overlay = document.createElement('div');
    overlay.className = 'kre-avatar-overlay';
    overlay.innerHTML = `
      <button class="kre-avatar-overlay__close" aria-label="Close avatar">${SVG_CLOSE}</button>
      <div class="kre-avatar-full__video" id="kre-avatar-full-mount">
        <div class="kre-avatar-full__status kre-avatar-full__status--connecting" id="kre-avatar-status">
          <span class="kre-avatar-full__status-dot"></span>
          <span class="kre-avatar-full__status-label">Loading avatar…</span>
        </div>
      </div>
    `;
    overlay.querySelector('.kre-avatar-overlay__close').addEventListener('click', () => this._hideAvatarOverlay());
    content.appendChild(overlay);

    const dppContext = this._buildAvatarDPP();
    const chatHistory = this._buildChatHistory();
    const fullMount = overlay.querySelector('#kre-avatar-full-mount');
    this._avatar = new AvatarService(this._avatarConfig);
    this._avatar.setDPPContext(dppContext);
    if (chatHistory) this._avatar.setChatHistory(chatHistory);
    this._avatar.init(fullMount, (event, data) => {
      this._emit(`kre:${event}`, data);

      if (event === 'avatar:ready') {
        const status = this._root.querySelector('#kre-avatar-status');
        if (status) {
          status.className = 'kre-avatar-full__status kre-avatar-full__status--listening';
          const label = status.querySelector('.kre-avatar-full__status-label');
          if (label) label.textContent = 'Listening';
        }
      }

      if (event === 'avatar:spoke') {
        if (data?.text) {
          this._detectAvatarSignals(data.text, 'avatar');
          this._messages.push({ role: 'bot', source: 'enriched', html: this._esc(data.text) });
          this._renderMessages();
        }
        const status = this._root.querySelector('#kre-avatar-status');
        if (status) {
          status.className = 'kre-avatar-full__status kre-avatar-full__status--speaking';
          const label = status.querySelector('.kre-avatar-full__status-label');
          if (label) label.textContent = 'Speaking';
          setTimeout(() => {
            if (status) {
              status.className = 'kre-avatar-full__status kre-avatar-full__status--listening';
              const l2 = status.querySelector('.kre-avatar-full__status-label');
              if (l2) l2.textContent = 'Listening';
            }
          }, 1500);
        }
      }

      if (event === 'avatar:user-spoke') {
        if (data?.text) {
          this._turnCount++;
          this._queries.push(data.text);
          this._messages.push({ role: 'user', html: this._esc(data.text) });
          this._detectAvatarSignals(data.text, 'user');
          this._renderMessages();
        }
      }

      if (event === 'avatar:ended') {
        this._hideAvatarOverlay();
      }

      if (event === 'avatar:error') {
        const status = this._root.querySelector('#kre-avatar-status');
        if (status) {
          status.className = 'kre-avatar-full__status kre-avatar-full__status--error';
          const label = status.querySelector('.kre-avatar-full__status-label');
          if (label) label.textContent = 'Error: ' + (data?.message || 'unknown');
        }
      }
    });
  }

  _hideAvatarOverlay() {
    const overlay = this._root.querySelector('.kre-avatar-overlay');
    if (this._avatar) {
      this._avatar.destroy();
      this._avatar = null;
    }
    if (overlay) overlay.remove();
  }

  _showBookingOverlay() {
    const overlay = this._root.querySelector('.kre-booking-overlay');
    if (!overlay) return;

    this._bookingOverlayOpen = true;
    overlay.classList.add('kre-booking-overlay--open');

    // Highlight header book button
    const btn = this._root.querySelector('.kre-header__book');
    if (btn) btn.classList.add('kre-header__book--active');

    // Mount booking panel if not already mounted
    const mount = overlay.querySelector('.kre-booking-overlay__body');
    if (!this._booking) {
      // Prefill booking form with lead data captured from enrichment
      const lead = this._enrichment.lead;
      const prefillName = [lead.firstName, lead.lastName].filter(Boolean).join(' ');

      // Build conversation summary for the "Please share anything..." field
      const summary = this._buildBookingSummary();

      this._booking = new BookingPanel({
        schedulingUrl: this._settings.calendlyUrl || null,
        visitorInfo: {
          name: prefillName,
          email: lead.email || '',
          company: lead.company || '',
        },
        customAnswers: summary,
      });
      this._booking.mount(mount, (event, data) => {
        this._emit(`kre:${event}`, data);
        if (event === 'booking:done') {
          this._hideBookingOverlay();
        }
      });
    }
  }

  _hideBookingOverlay() {
    const overlay = this._root.querySelector('.kre-booking-overlay');
    if (!overlay) return;

    this._bookingOverlayOpen = false;
    overlay.classList.remove('kre-booking-overlay--open');

    const btn = this._root.querySelector('.kre-header__book');
    if (btn) btn.classList.remove('kre-header__book--active');

    if (this._booking) {
      this._booking.destroy();
      this._booking = null;
    }
  }

  _switchMode(mode) {
    // If switching to "booking", open the overlay instead of changing mode
    if (mode === 'booking') {
      this._showBookingOverlay();
      return;
    }

    // Cleanup previous mode
    if (this._mode === 'avatar-full' && this._avatar) {
      this._avatar.destroy();
      this._avatar = null;
    }

    // Going to chat from avatar-full: destroy avatar
    if (mode === 'chat' && this._avatar) {
      this._avatar.destroy();
      this._avatar = null;
    }

    this._mode = mode;
    this._emit('kre:mode', { mode });

    // Add/remove panel expansion class for avatar full mode
    const panel = this._root.querySelector('.kre-panel');
    if (panel) {
      panel.classList.toggle('kre-panel--avatar-full', mode === 'avatar-full');
    }

    this._renderMode();

    // Hide escalation bubble when switching to avatar or booking
    if (mode !== 'chat') {
      const esc = this._root.querySelector('.kre-msg--escalation');
      if (esc) esc.remove();
    }
  }

  _renderWelcome() {
    const el = this._root.querySelector('.kre-messages');
    if (!el) return;
    el.innerHTML = `
      <div class="kre-welcome">
        <h2>${this._esc(this._settings.welcomeHeading)}</h2>
        <p>${this._esc(this._settings.welcomeMessage)}</p>
        <div class="kre-welcome__actions">
          <button class="kre-welcome-avatar">
            <span class="kre-welcome-avatar__icon">${SVG_AVATAR}</span>
            <span class="kre-welcome-avatar__text">
              <strong>${this._esc(this._settings.avatarBtnLabel)}</strong>
              <small>${this._esc(this._settings.avatarBtnSubtext)}</small>
            </span>
          </button>
          <button class="kre-welcome-booking">
            <span class="kre-welcome-booking__icon">📅</span>
            <span class="kre-welcome-booking__text">
              <strong>${this._esc(this._settings.bookBtnLabel)}</strong>
              <small>${this._esc(this._settings.bookBtnSubtext)}</small>
            </span>
          </button>
        </div>
        <div class="kre-starters">
          ${[this._settings.starterQ1, this._settings.starterQ2, this._settings.starterQ3, this._settings.starterQ4].filter(Boolean).map((q) => `<button class="kre-starter">${this._esc(q)}</button>`).join('')}
        </div>
      </div>
    `;
    el.querySelectorAll('.kre-starter').forEach((btn) => {
      btn.addEventListener('click', () => this._sendText(btn.textContent));
    });
    el.querySelector('.kre-welcome-avatar')?.addEventListener('click', () => {
      this._showAvatarOverlay();
    });
    el.querySelector('.kre-welcome-booking')?.addEventListener('click', () => {
      this._switchMode('booking');
    });
  }

  _renderMessages() {
    const el = this._root.querySelector('.kre-messages');
    if (!el) return;

    el.innerHTML = this._messages
      .map((m) => {
        const sourceClass = m.source ? ` kre-msg--${m.source}` : '';
        const sourceLabel = m.source === 'rag' ? '<div class="kre-msg__source">Knowledge Base</div>'
                          : m.source === 'enriched' ? '<div class="kre-msg__source kre-msg__source--enriched">AI Assistant</div>'
                          : '';
        let html = `<div class="kre-msg kre-msg--${m.role}${sourceClass}">${sourceLabel}${m.html}`;
        // Add citations below bot messages
        if (m.role === 'bot' && m.citations && m.citations.length > 0) {
          html += `<div class="kre-citations">`;
          html += m.citations.map((c) =>
            `<a class="kre-citation" href="${this._escAttr((c.url || '').startsWith('http') ? c.url : 'https://' + c.url)}" target="_blank" rel="noopener noreferrer" title="${this._escAttr(c.explanation || c.title || '')}"><span class="kre-citation__icon">📄</span>${this._esc(c.title || 'Source')}</a>`
          ).join('');
          html += `</div>`;
        }
        html += `</div>`;
        return html;
      })
      .join('');

    if (this._loading) {
      el.innerHTML += `<div class="kre-typing"><span></span><span></span><span></span></div>`;
    }

    // Make RAG bubbles expandable on click
    el.querySelectorAll('.kre-msg--rag').forEach((rag) => {
      rag.addEventListener('click', () => rag.classList.toggle('kre-msg--expanded'));
    });

    el.scrollTop = el.scrollHeight;
    this._renderClips();
    this._renderCards();
    this._renderChips();
    this._updateScore();
    this._updateIntent();
    this._checkEscalation();
  }

  _renderCards() {
    const slot = this._root.querySelector('.kre-cards-slot');
    if (!slot) return;
    const panel = this._root.querySelector('.kre-panel');

    const hasClips = this._lastClips && this._lastClips.length > 0;
    if (this._lastCards.length === 0 || this._loading) {
      slot.innerHTML = '';
      // Only collapse sidebar if no clips either
      if (!hasClips && panel) panel.classList.remove('kre-panel--with-cards');
      return;
    }

    // Widen panel to show sidebar
    if (panel) panel.classList.add('kre-panel--with-cards');

    // Show up to 6 cards in sidebar grid
    const maxCards = 6;

    slot.innerHTML = `
      <div class="kre-cards">
        ${this._lastCards.slice(0, maxCards).map((c, i) => `
          <a class="kre-card" style="animation-delay:${i * 60}ms" href="${this._escAttr(c.url)}" target="_blank" rel="noopener noreferrer">
            ${c.thumbnail ? `<img class="kre-card__thumb" src="${this._escAttr(c.thumbnail)}" alt="${this._escAttr(c.title)}" loading="lazy" />` : ''}
            <div class="kre-card__body"><h4>${this._esc(c.title)}</h4></div>
          </a>
        `).join('')}
      </div>
    `;
  }

  _renderClips() {
    const slot = this._root.querySelector('.kre-clips-slot');
    if (!slot) return;
    const panel = this._root.querySelector('.kre-panel');
    const headerEl = slot.previousElementSibling; // "Video Clips" header
    const divider = slot.nextElementSibling;       // .kre-sidebar__divider

    if (!this._lastClips || this._lastClips.length === 0 || this._loading) {
      slot.innerHTML = '';
      // Hide clips header + divider when no clips
      if (headerEl) headerEl.hidden = true;
      if (divider) divider.hidden = true;
      // Still show sidebar if cards exist
      if (!this._lastCards.length && panel) panel.classList.remove('kre-panel--with-cards');
      return;
    }

    // Show clips header + divider
    if (headerEl) headerEl.hidden = false;
    if (divider) divider.hidden = false;
    if (panel) panel.classList.add('kre-panel--with-cards');

    // Destroy previous players — thumbnails are lightweight, player loads on click
    this._destroyPlayers();

    const _fmtTime = (s) => {
      const m = Math.floor(s / 60);
      const sec = Math.floor(s % 60);
      return `${m}:${sec.toString().padStart(2, '0')}`;
    };

    slot.innerHTML = `
      <div class="kre-clips">
        ${this._lastClips.map((clip, i) => `
          <div class="kre-clip" data-clip-idx="${i}" style="animation-delay:${i * 80}ms">
            <div class="kre-clip__thumb-wrap" data-clip-idx="${i}">
              <img class="kre-clip__thumb" src="${this._escAttr(clip.thumbnailUrl)}" alt="${this._escAttr(clip.title)}" loading="lazy" />
              <div class="kre-clip__play-overlay">
                <svg class="kre-clip__play-icon" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
              </div>
              ${clip.startTime ? `<span class="kre-clip__timestamp">${_fmtTime(clip.startTime)}</span>` : ''}
            </div>
            <div id="kre-kplayer-${i}" class="kre-player__frame kre-player__frame--hidden"></div>
            <div class="kre-player__caption">${this._esc(clip.title)}</div>
          </div>
        `).join('')}
      </div>
    `;

    // Click thumbnail → load player for that clip
    slot.querySelectorAll('.kre-clip__thumb-wrap').forEach(wrap => {
      wrap.addEventListener('click', () => {
        const idx = parseInt(wrap.dataset.clipIdx, 10);
        this._playClip(idx);
      });
    });
  }

  // ── KalturaPlayer JS API — one player per clip (light DOM, no shadow DOM) ──

  /** Load the KalturaPlayer JS library once. */
  _loadPlayerLib() {
    if (this._playerLibPromise) return this._playerLibPromise;
    if (window.KalturaPlayer) {
      this._playerLibPromise = Promise.resolve();
      return this._playerLibPromise;
    }
    const pid = this._settings.playerPartnerId || this._settings.geniePartnerId || '';
    const uiconf = this._settings.playerUiconfId || '';
    if (!pid || !uiconf) {
      console.warn('[KRE] missing playerPartnerId or playerUiconfId — player disabled');
      this._playerLibPromise = Promise.reject(new Error('player config missing'));
      return this._playerLibPromise;
    }
    this._playerLibPromise = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = `https://cdnapisec.kaltura.com/p/${pid}/embedPlaykitJs/uiconf_id/${uiconf}/kaltura-player.js`;
      s.onload = () => { console.debug('[KRE] KalturaPlayer lib loaded'); resolve(); };
      s.onerror = () => reject(new Error('KalturaPlayer lib failed to load'));
      document.head.appendChild(s);
    });
    return this._playerLibPromise;
  }

  /**
   * Pause all players. Called on widget close.
   */
  _closePlayer() {
    for (const p of this._kPlayers) {
      try { p.pause(); } catch (_) {}
    }
    this._activeClipIdx = -1;
  }

  /**
   * Destroy all player instances. Called on widget kill / new query.
   */
  _destroyPlayers() {
    for (const p of this._kPlayers) {
      try { p.destroy(); } catch (_) {}
    }
    this._kPlayers = [];
    this._playerEls = [];
    this._activeClipIdx = -1;
  }

  /**
   * Lazy-load a single player when the user clicks a clip thumbnail.
   * Hides the thumbnail, shows the player frame, and auto-plays.
   */
  async _playClip(idx) {
    const clip = this._lastClips[idx];
    if (!clip) return;

    // If clicking the same clip that's already playing, toggle pause/play
    if (this._activeClipIdx === idx && this._kPlayers[idx]) {
      const p = this._kPlayers[idx];
      p.paused ? p.play() : p.pause();
      return;
    }

    // Pause any previously active player
    if (this._activeClipIdx >= 0 && this._kPlayers[this._activeClipIdx]) {
      try { this._kPlayers[this._activeClipIdx].pause(); } catch (_) {}
    }

    try {
      await this._loadPlayerLib();
    } catch (err) {
      console.error('[KRE] player lib failed:', err);
      return;
    }

    const targetId = `kre-kplayer-${idx}`;
    const thumbWrap = this._root.querySelector(`.kre-clip__thumb-wrap[data-clip-idx="${idx}"]`);
    const playerFrame = this._root.querySelector(`#${targetId}`);
    if (!playerFrame) return;

    // Hide thumbnail, show player
    if (thumbWrap) thumbWrap.style.display = 'none';
    playerFrame.classList.remove('kre-player__frame--hidden');

    // Create player if not already initialized for this clip
    if (!this._kPlayers[idx]) {
      const pid = Number(this._settings.playerPartnerId || this._settings.geniePartnerId);
      const uiconf = Number(this._settings.playerUiconfId);
      const ks = this._settings.genieKs || '';

      try {
        const player = window.KalturaPlayer.setup({
          targetId,
          provider: { partnerId: pid, uiConfId: uiconf, ks },
          playback: { autoplay: true, muted: false, playsinline: true },
        });
        this._kPlayers[idx] = player;

        await player.loadMedia(
          { entryId: clip.entryId },
          { startTime: clip.startTime || 0, ...(clip.endTime > 0 && { clipTo: clip.endTime }) }
        );
        console.debug('[KRE] clip #%d player loaded entry=%s @%ds', idx, clip.entryId, clip.startTime);
      } catch (err) {
        console.error('[KRE] clip #%d player error:', idx, err);
        // Revert to thumbnail on error
        if (thumbWrap) thumbWrap.style.display = '';
        playerFrame.classList.add('kre-player__frame--hidden');
        return;
      }
    } else {
      // Player already exists — just play
      try { this._kPlayers[idx].play(); } catch (_) {}
    }

    this._activeClipIdx = idx;
  }

  _renderChips() {
    const slot = this._root.querySelector('.kre-chips-slot');
    if (!slot) return;

    if (this._lastFollowUps.length === 0 || this._loading) {
      slot.innerHTML = '';
      return;
    }

    slot.innerHTML = `
      <div class="kre-chips">
        ${this._lastFollowUps.slice(0, 3).map((q, i) => `
          <button class="kre-chip" style="animation-delay:${i * 80}ms" title="${this._escAttr(q)}">${this._esc(q.length > 50 ? q.slice(0, 47) + '…' : q)}</button>
        `).join('')}
      </div>
    `;

    slot.querySelectorAll('.kre-chip').forEach((btn) => {
      btn.addEventListener('click', () => this._sendText(btn.title || btn.textContent));
    });
  }

  _updateScore() {
    const scorePercent = Math.round(this._engagement * 100);
    const fill = this._root.querySelector('.kre-score__fill');
    if (fill) fill.style.width = `${scorePercent}%`;
    const bar = this._root.querySelector('.kre-score');
    if (bar) {
      bar.setAttribute('aria-valuenow', scorePercent);
      bar.setAttribute('aria-label', `Engagement score: ${scorePercent}%`);
      bar.setAttribute('title', `Engagement: ${scorePercent}%`);
    }
  }

  _updateIntent() {
    if (this._turnCount === 0) return;

    const level = this._intentLevel;
    const label = getIntentLabel(level);
    const scorePercent = Math.round(this._engagement * 100);

    console.debug('[KRE] intent: %s (%d%) signals: %s', label, scorePercent, this._detectedSignals.join(', ') || 'none');

    // Pulse the header book button when there are buying signals
    const bookBtn = this._root?.querySelector('.kre-header__book');
    if (bookBtn) {
      bookBtn.classList.toggle('kre-header__book--intent', this._detectedSignals.length > 0);
      bookBtn.classList.toggle('kre-header__book--high', level === 'high');
    }
  }

  _checkEscalation() {
    const T = this._turnCount;
    _ilog(T, 'CHECK_ESCALATION', {
      dismissed: this._escalationDismissed,
      shown: this._escalationShown,
      mode: this._mode,
      allCategories: [...this._allCategories],
      engagement: this._engagement,
    });

    if (this._escalationDismissed) { _ilog(T, 'ESCALATION_SKIP', { reason: 'dismissed' }); return; }
    if (this._mode !== 'chat') { _ilog(T, 'ESCALATION_SKIP', { reason: 'mode=' + this._mode }); return; }

    const messages = this._root.querySelector('.kre-messages');
    if (!messages) { _ilog(T, 'ESCALATION_SKIP', { reason: 'no .kre-messages DOM' }); return; }

    // Re-inject escalation bubble after innerHTML re-render wiped the DOM
    if (this._escalationShown) {
      if (!messages.querySelector('.kre-msg--escalation')) {
        this._injectEscalationBubble(messages, false);
        _ilog(T, 'ESCALATION_REINJECT', { reason: 'DOM wiped, re-injecting' });
      }
      return;
    }

    const groqIntent = this._enrichment.intentScore;
    const escalationArgs = {
      score: this._engagement,
      groqIntent,
      turnCount: T,
      categories: [...this._allCategories],
    };
    const hasEscCats = hasEscalateCategories(this._allCategories);
    const result = shouldEscalate(escalationArgs);
    _ilog(T, 'ESCALATION_DECISION', {
      shouldEscalate: result,
      hasEscalateCategories: hasEscCats,
      args: escalationArgs,
    });
    if (!result) return;

    this._escalationShown = true;
    _ilog(T, 'ESCALATION_TRIGGERED', {});

    // Inject immediately — no delay, avoids DOM wipe race conditions
    this._injectEscalationBubble(messages, true);
    const bubbleEl = messages.querySelector('.kre-msg--escalation');
    _ilog(T, 'ESCALATION_INJECTED', {
      inDOM: !!bubbleEl,
      containerChildCount: messages.childElementCount,
      containerConnected: messages.isConnected,
      bubbleRect: bubbleEl ? bubbleEl.getBoundingClientRect() : null,
    });
  }

  /**
   * Inject escalation CTA bubble into the message flow.
   * @param {Element} container - .kre-messages element
   * @param {boolean} animate - whether to play entrance animation (false on re-inject)
   */
  _injectEscalationBubble(container, animate) {
    if (!container || this._escalationDismissed) return;
    // Prevent duplicate
    if (container.querySelector('.kre-msg--escalation')) return;

    const bubble = document.createElement('div');
    bubble.className = 'kre-msg kre-msg--escalation';
    bubble.style.opacity = '1'; // ensure visibility even if animation glitches
    if (!animate) bubble.style.animation = 'none';
    bubble.setAttribute('role', 'status');
    bubble.setAttribute('aria-label', 'Ready to take the next step?');
    bubble.innerHTML = `
      <div class="kre-escalation__inner">
        <button class="kre-escalation__dismiss" aria-label="Dismiss" title="Continue chatting">&times;</button>
        <div class="kre-escalation__label"><span class="kre-escalation__label-dot"></span> ${this._esc(this._settings.escalationLabel)}</div>
        <p class="kre-escalation__text">${this._esc(this._settings.escalationText)}</p>
        <div class="kre-escalation__btns">
          <button class="kre-escalation__btn kre-escalation__btn--avatar">${this._esc(this._settings.avatarBtnLabel)}</button>
          <button class="kre-escalation__btn kre-escalation__btn--booking">${this._esc(this._settings.bookBtnLabel)}</button>
        </div>
      </div>
    `;

    container.appendChild(bubble);
    container.scrollTop = container.scrollHeight;

    // ── DEBUG: confirm bubble is actually in DOM and visible ──
    requestAnimationFrame(() => {
      const rect = bubble.getBoundingClientRect();
      const cs = getComputedStyle(bubble);
      console.warn('[KRE:ESCALATION] bubble injected →', {
        inDOM: bubble.isConnected,
        rect: { x: rect.x, y: rect.y, w: rect.width, h: rect.height },
        display: cs.display,
        visibility: cs.visibility,
        opacity: cs.opacity,
        overflow: cs.overflow,
        parentDisplay: container ? getComputedStyle(container).display : '?',
        parentOverflow: container ? getComputedStyle(container).overflow : '?',
        parentRect: container ? container.getBoundingClientRect() : null,
      });
    });

    bubble.querySelector('.kre-escalation__btn--avatar').addEventListener('click', () => {
      this._switchMode('avatar-full');
    });
    bubble.querySelector('.kre-escalation__btn--booking').addEventListener('click', () => {
      this._switchMode('booking');
    });
    bubble.querySelector('.kre-escalation__dismiss').addEventListener('click', () => {
      this._escalationDismissed = true;
      bubble.classList.add('kre-msg--escalation-dismissed');
      bubble.addEventListener('animationend', () => bubble.remove(), { once: true });
    });

    if (animate) {
      this._emit('kre:escalation:shown', {
        engagement: this._engagement,
        intent: this._intentLevel,
        turns: this._turnCount,
      });
    }
  }

  _updateStatus() {
    const el = this._root.querySelector('.kre-header__status');
    if (el) el.textContent = this._ready ? this._settings.headerStatus : 'Connecting…';
    const input = this._root.querySelector('.kre-input');
    if (input && this._ready) {
      input.disabled = false;
      input.placeholder = this._settings.inputPlaceholder;
    }
  }

  // ── Messaging ──

  async _send() {
    const input = this._root.querySelector('.kre-input');
    if (!input) return;
    const text = input.value.trim();
    if (!text) return;
    input.value = '';
    this._root.querySelector('.kre-send').disabled = true;
    await this._sendText(text);
  }

  async _sendText(text) {
    if (this._loading || !this._ready) return;

    // Add user message
    this._messages.push({ role: 'user', html: this._esc(text) });
    this._loading = true;
    this._destroyPlayers();     // destroy all players — clips will change
    this._lastFollowUps = [];
    this._lastCards = [];
    this._lastClips = [];
    this._lastCitations = [];
    this._turnCount++;
    const T = this._turnCount;
    this._queries.push(text);
    _ilog(T, 'USER_MSG', { text, mode: this._mode });
    this._renderMessages();

    // Detect buying signals in user message (graduated: base vs strong)
    const { boost: keywordBoost, signals, categories, negativeBoost } = detectBuyingSignals(text);
    _ilog(T, 'KEYWORD_DETECT', { keywordBoost, categories, negativeBoost, signals });
    if (signals.length) {
      this._detectedSignals.push(...categories.filter(s => !this._detectedSignals.includes(s)));
      this._signalHistory.push({ turn: T, text, signals });
    }
    this._allCategories.push(...categories.filter(c => !this._allCategories.includes(c)));
    if (keywordBoost > 0) this._boostHistory.push({ turn: T, boost: keywordBoost });
    _ilog(T, 'CATEGORIES_AFTER_KW', { allCategories: [...this._allCategories] });

    this._emit('kre:message:sent', { query: text, turn: T, signals: categories });

    try {
      // Fire PathFactory + Genie in parallel
      const [pfSettled, genieSettled] = await Promise.allSettled([
        this._pf.converse(text),
        this._genie.enabled ? this._genie.search(text) : Promise.resolve({ clips: [] }),
      ]);

      const result = pfSettled.status === 'fulfilled' ? pfSettled.value : null;
      if (!result) throw pfSettled.reason || new Error('PathFactory failed');
      _ilog(T, 'PF_RESULT', { pfEngagement: result.engagementScore, hasAnswer: !!result.answer });

      // Store Genie video clips
      this._lastClips = genieSettled.status === 'fulfilled' ? (genieSettled.value?.clips || []) : [];

      // Enrich through Groq if enabled — show only the enriched response
      // Falls back to raw RAG answer if Groq is disabled or fails
      let groqIntent = null;
      _ilog(T, 'GROQ_CHECK', { enabled: this._enrichment.enabled });
      if (this._enrichment.enabled) {
        const { enrichedText, lead, intentScore } = await this._enrichment.enrich(text, result.answer);
        groqIntent = intentScore; // may be null on Groq failure
        _ilog(T, 'GROQ_RESULT', { intentScore: groqIntent, hasEnrichedText: !!enrichedText });
        this._messages.push({
          role: 'bot',
          html: renderMarkdown(enrichedText),
          source: 'enriched',
        });
        this._emit('kre:lead:updated', lead);

        // Use Groq categories as primary source (smarter than regex)
        if (groqIntent?.categories?.length) {
          const groqCats = groqIntent.categories;
          this._allCategories.push(...groqCats.filter(c => !this._allCategories.includes(c)));
          this._detectedSignals.push(...groqCats.filter(s => !this._detectedSignals.includes(s)));
          _ilog(T, 'GROQ_CATS_MERGED', { groqCats, allCategories: [...this._allCategories] });
        }
      } else {
        // No Groq — show raw RAG answer
        this._messages.push({
          role: 'bot',
          html: renderMarkdown(result.answer),
          citations: result.citations || [],
          source: 'rag',
        });
      }

      // Fused engagement scoring — Groq primary, PF + keywords fallback
      this._engagement = computeEngagement({
        pfScore: result.engagementScore || 0,
        groqIntent,
        currentBoost: keywordBoost,
        negativeBoost,
        turnHistory: this._boostHistory,
        turnCount: T,
      });
      this._intentLevel = getIntentLevel(this._engagement);
      _ilog(T, 'SCORE_COMPUTED', { engagement: this._engagement, intentLevel: this._intentLevel });
      this._intentLog.push({
        turn: T,
        ts: Date.now(),
        engagement: this._engagement,
        level: this._intentLevel,
        groqScore: groqIntent?.score ?? null,
        groqLevel: groqIntent?.level ?? null,
        groqConf: groqIntent?.confidence ?? null,
        groqNeg: groqIntent?.negative ?? null,
        pfScore: result.engagementScore || 0,
        kwBoost: keywordBoost,
        negBoost: negativeBoost,
        signals: [...this._detectedSignals],
        reasoning: groqIntent?.reasoning || '',
      });
      this._lastFollowUps = result.followUps;
      this._lastCards = result.recommendations;
      this._lastCitations = result.citations;
      this._lastIntent = result.intent;

      this._emit('kre:message:received', {
        engagement: this._engagement,
        intent: result.intent,
        intentLevel: this._intentLevel,
        groqIntent,
        recommendations: result.recommendations.length,
        citations: result.citations.length,
        clips: this._lastClips.length,
        turn: T,
        lead: this._enrichment.lead,
      });

      // Notify admin panel of live data
      this._emit('kre:livedata', this.getLiveData());

    } catch (err) {
      console.error('KRE: converse failed', err);
      _ilog(T, 'ERROR', { message: err.message });
      this._messages.push({ role: 'bot', html: '<em>Sorry, something went wrong. Please try again.</em>' });
      this._emit('kre:error', { error: err.message });
    } finally {
      _ilog(T, 'PRE_ESCALATION_CHECK', {
        allCategories: [...this._allCategories],
        engagement: this._engagement,
        escalationShown: this._escalationShown,
        escalationDismissed: this._escalationDismissed,
        mode: this._mode,
      });
      this._loading = false;
      this._renderMessages();
      _idump(T);
      // Re-enable input
      const input = this._root.querySelector('.kre-input');
      if (input) input.focus();
    }
  }

  // ── Utilities ──

  _emit(eventId, payload) {
    if (this._pubSub) {
      this._pubSub.emit({ id: eventId, version: '1.0', payload });
    }
    // Also dispatch a CustomEvent on the host for external listeners
    this._host?.dispatchEvent(new CustomEvent(eventId, { detail: payload, bubbles: true }));
  }

  _esc(str) {
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }

  _escAttr(str) {
    return str.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  // ── Demo helpers (accessible via window.__KRE_INSTANCE__) ──

  /** Force switch to avatar full-view */
  demoAvatar() { this._switchMode('avatar-full'); }

  /** Alias for demoAvatar */
  demoAvatarFull() { this._switchMode('avatar-full'); }

  /** Force switch to booking mode */
  demoBooking() { this._switchMode('booking'); }

  /** Force trigger escalation prompt (bypasses corroboration for demo) */
  demoEscalation() {
    this._engagement = 0.90;
    this._turnCount = 3;
    this._intentLevel = 'high';
    this._allCategories = ['pricing', 'evaluation']; // satisfy corroboration
    this._escalationShown = false;
    this._escalationDismissed = false;
    this._updateIntent();
    this._updateScore();
    this._checkEscalation();
  }

  // ── Demandbase visitor enrichment ──

  _injectDemandbase() {
    if (document.getElementById('kre-demandbase-tag')) return;
    const script = document.createElement('script');
    script.id = 'kre-demandbase-tag';
    script.src = 'https://tag.demandbase.com/5de711f47933a1cc.min.js';
    script.async = true;
    document.head.appendChild(script);
    console.debug('[KRE] Demandbase tag injected');
  }

  _pollDemandbase() {
    let attempts = 0;
    const interval = setInterval(() => {
      attempts++;
      const profile = window.Demandbase?.IpApi?.CompanyProfile;
      if (profile && profile.company_name) {
        clearInterval(interval);
        this._demandbaseProfile = profile;
        console.debug('[KRE] Demandbase profile:', profile.company_name);
        this._applyDemandbaseData(profile);
      } else if (attempts >= 20) {
        clearInterval(interval);
        console.debug('[KRE] Demandbase not available after 10s');
      }
    }, 500);
  }

  _applyDemandbaseData(profile) {
    // Only pass anonymous signals to Groq — never company name, website, or location
    // (company name leaked into lead-capture questions in prior builds)
    const parts = [];
    if (profile.industry) parts.push(`industry: ${profile.industry}`);
    if (profile.sub_industry) parts.push(`sub-industry: ${profile.sub_industry}`);
    if (profile.employee_range) parts.push(`company size: ${profile.employee_range}`);

    if (parts.length) {
      this._enrichment.visitorContext = `Visitor signals: ${parts.join(', ')}.`;
      console.debug('[KRE] Visitor context (anonymized):', this._enrichment.visitorContext);
    }

    // Intentionally NOT prefilling company from Demandbase — it leaks into
    // KNOWN_LEAD and causes Groq to ask "what's your role at [company]?"
    // Company must come from the visitor directly.
  }

  // ── Secret config overlay (Ctrl+Shift+K) ──

  static _STORAGE_KEY = 'kre_config';
  static _CONFIG_FIELDS = [
    // General
    { key: 'kreVersion',      label: 'KRE Version',        group: 'General' },
    // PathFactory
    { key: 'pfClientId',      label: 'PF Client ID',       group: 'PathFactory' },
    { key: 'pfOrgId',         label: 'PF Org ID',          group: 'PathFactory' },
    { key: 'pfContentPoolId', label: 'PF Content Pool ID', group: 'PathFactory' },
    { key: 'pfContextUuid',   label: 'PF Context UUID',    group: 'PathFactory' },
    { key: 'pfCfBaseUrl',     label: 'PF Base URL',        group: 'PathFactory' },
    // Genie / Player
    { key: 'genieKs',          label: 'Genie KS',          group: 'Genie & Player' },
    { key: 'geniePartnerId',   label: 'Genie Partner ID',  group: 'Genie & Player' },
    { key: 'playerPartnerId',  label: 'Player Partner ID', group: 'Genie & Player' },
    { key: 'playerUiconfId',   label: 'Player UIConf ID',  group: 'Genie & Player' },
    // Avatar (Kaltura Avatar SDK)
    { key: 'avatarClientId',   label: 'Avatar Client ID',   group: 'Avatar' },
    { key: 'avatarFlowId',     label: 'Avatar Flow ID',     group: 'Avatar' },
    // Enrichment
    { key: 'groqApiKey',       label: 'Groq API Key',       group: 'Enrichment' },
    // Booking
    { key: 'calendlyUrl',      label: 'Calendly URL',       group: 'Booking' },
    // Branding
    { key: 'brandName',        label: 'Brand Name',          group: 'Branding' },
    { key: 'headerTitle',      label: 'Header Title',        group: 'Branding' },
    { key: 'headerStatus',     label: 'Header Status',       group: 'Branding' },
    { key: 'welcomeHeading',   label: 'Welcome Heading',     group: 'Branding' },
    { key: 'welcomeMessage',   label: 'Welcome Message',     group: 'Branding', multiline: true },
    { key: 'inputPlaceholder', label: 'Input Placeholder',   group: 'Branding' },
    { key: 'footerText',       label: 'Footer HTML',         group: 'Branding' },
    { key: 'bookBtnLabel',     label: 'Book Button Label',   group: 'Branding' },
    { key: 'bookBtnSubtext',   label: 'Book Button Subtext', group: 'Branding' },
    { key: 'avatarBtnLabel',   label: 'Avatar Button Label', group: 'Branding' },
    { key: 'avatarBtnSubtext', label: 'Avatar Button Sub',   group: 'Branding' },
    { key: 'avatarViewTitle',  label: 'Avatar View Title',   group: 'Branding' },
    { key: 'escalationText',   label: 'Escalation Text',     group: 'Branding', multiline: true },
    { key: 'escalationLabel',  label: 'Escalation Label',    group: 'Branding' },
    { key: 'primaryColor',     label: 'Primary Color',       group: 'Branding' },
    { key: 'starterQ1',        label: 'Starter Question 1',  group: 'Starter Questions' },
    { key: 'starterQ2',        label: 'Starter Question 2',  group: 'Starter Questions' },
    { key: 'starterQ3',        label: 'Starter Question 3',  group: 'Starter Questions' },
    { key: 'starterQ4',        label: 'Starter Question 4',  group: 'Starter Questions' },
    { key: 'avatarChip1',      label: 'Avatar Chip 1',       group: 'Starter Questions' },
    { key: 'avatarChip2',      label: 'Avatar Chip 2',       group: 'Starter Questions' },
    { key: 'avatarChip3',      label: 'Avatar Chip 3',       group: 'Starter Questions' },
  ];

  /** Read saved overrides from localStorage */
  static _readOverrides() {
    try {
      const raw = localStorage.getItem(KRERuntime._STORAGE_KEY);
      if (!raw) return {};
      const overrides = JSON.parse(raw);
      if (Object.keys(overrides).length) {
        console.debug('[KRE] Saved overrides loaded:', Object.keys(overrides));
      }
      return overrides;
    } catch { return {}; }
  }

  /** Save all overrides to localStorage */
  static _saveOverrides(overrides) {
    try {
      const clean = Object.fromEntries(Object.entries(overrides).filter(([, v]) => v));
      if (Object.keys(clean).length) {
        localStorage.setItem(KRERuntime._STORAGE_KEY, JSON.stringify(clean));
      } else {
        localStorage.removeItem(KRERuntime._STORAGE_KEY);
      }
    } catch { /* storage unavailable */ }
  }

  /** Clear all overrides */
  static _clearOverrides() {
    try { localStorage.removeItem(KRERuntime._STORAGE_KEY); } catch { /* noop */ }
  }

  /** Build HTML for the Live tab in the config dialog */
  _buildLiveTabHtml() {
    const d = this.getLiveData();
    const scorePercent = Math.round(d.engagementScore * 100);
    const pad = 'padding:0 8px;'; // panel margins
    const secHdr = (text) => `<div style="${pad}font-size:10px;color:#6366f1;text-transform:uppercase;letter-spacing:1px;margin:16px 0 8px;padding-top:10px;border-top:1px solid #2a2a3a;">${text}</div>`;
    const row = (label, value, color) => `<div style="${pad}display:flex;justify-content:space-between;padding:5px 8px;font-size:12px;"><span style="color:#aaa;">${label}</span><span style="color:${color || '#e0e0e0'};font-weight:600;font-family:monospace;">${value}</span></div>`;
    const muted = (text) => `<span style="color:#555;font-style:italic;">${text}</span>`;

    const noData = d.turnCount === 0;

    // Intent dot color
    const dotColors = { Exploring: '#9ca3af', Evaluating: '#f59e0b', 'High Intent': '#22c55e' };
    const dotColor = noData ? '#444' : (dotColors[d.intentLevel] || '#9ca3af');

    // Signal pills
    const signalColors = { pricing: '#16a34a', timeline: '#d97706', evaluation: '#7c3aed', competitive: '#dc2626', integration: '#0891b2', scale: '#4f46e5', contact: '#e11d48' };
    const pills = d.detectedSignals.length
      ? d.detectedSignals.map(s => `<span style="font-size:10px;padding:2px 8px;border-radius:9999px;background:${signalColors[s] || '#6366f1'}20;color:${signalColors[s] || '#6366f1'};font-weight:600;text-transform:capitalize;">${s}</span>`).join(' ')
      : muted('none yet');

    // Lead fields
    const lead = d.lead || {};
    const leadName = [lead.firstName, lead.lastName].filter(Boolean).join(' ') || null;

    // Groq intent
    const gi = d.groqIntent;

    // Demandbase
    const db = d.demandbaseProfile;

    // Animation wrapper — each value gets a data-live-key; the refresh interval will detect changes and flash
    const anim = (key, content) => `<span data-live-key="${key}">${content}</span>`;

    let html = `<style>
      @keyframes kre-live-flash { 0%{background:#6366f140;} 100%{background:transparent;} }
      .kre-live-flash { animation: kre-live-flash 1.2s ease-out; border-radius:4px; }
      .kre-live-bar-fill { transition: width 0.8s cubic-bezier(0.4,0,0.2,1); }
      .kre-live-num { transition: color 0.3s; }
    </style>`;

    // Engagement
    html += secHdr('Engagement Score');
    if (noData) {
      html += `<div style="${pad}font-size:12px;color:#555;font-style:italic;margin:4px 8px 8px;">Awaiting first message&hellip;</div>`;
    } else {
      html += `<div style="${pad}display:flex;align-items:center;gap:10px;margin:4px 8px 10px;">
        <div style="flex:1;height:8px;background:#2a2a3a;border-radius:4px;overflow:hidden;">
          <div class="kre-live-bar-fill" style="height:100%;width:${scorePercent}%;background:linear-gradient(90deg,#22c55e,#006cfa,#8b5cf6);border-radius:4px;"></div>
        </div>
        <span class="kre-live-num" style="font-size:20px;font-weight:900;color:#fff;font-variant-numeric:tabular-nums;min-width:48px;text-align:right;" data-live-key="score">${scorePercent}%</span>
      </div>`;
    }

    // Intent
    html += secHdr('Intent Level');
    if (noData) {
      html += `<div style="${pad}display:flex;align-items:center;gap:8px;margin:4px 8px;">
        <span style="width:10px;height:10px;border-radius:50%;background:#444;display:inline-block;"></span>
        <span style="font-size:14px;color:#555;font-style:italic;">No data yet</span>
      </div>`;
    } else {
      html += `<div style="${pad}display:flex;align-items:center;gap:8px;margin:4px 8px;" data-live-key="intent">
        <span style="width:10px;height:10px;border-radius:50%;background:${dotColor};display:inline-block;${dotColor === '#22c55e' ? 'box-shadow:0 0 8px rgba(34,197,94,0.5);' : ''}transition:background 0.5s;"></span>
        <span style="font-size:14px;font-weight:700;color:${dotColor};transition:color 0.5s;">${d.intentLevel}</span>
      </div>`;
    }
    html += row('Turns', d.turnCount);

    // Signals
    html += secHdr('Detected Signals');
    html += `<div style="${pad}display:flex;gap:6px;flex-wrap:wrap;margin:4px 8px 10px;" data-live-key="signals">${pills}</div>`;

    // Lead
    html += secHdr('Lead Capture');
    html += row('Name', leadName || muted('not captured'));
    html += row('Email', lead.email || muted('not captured'));
    html += row('Company', lead.company || muted('not captured'), lead.company && db?.company_name === lead.company ? '#22c55e' : undefined);
    html += row('Role', lead.role || muted('not captured'));
    html += row('Intent', noData ? muted('awaiting') : (lead.intent || 'exploring'));

    // Groq reasoning
    if (gi) {
      html += secHdr('Groq Intent Analysis');
      html += row('Score', gi.score.toFixed(2), gi.score >= 0.6 ? '#22c55e' : gi.score >= 0.3 ? '#f59e0b' : '#9ca3af');
      html += row('Confidence', gi.confidence.toFixed(2));
      html += row('Negative', gi.negative.toFixed(2), gi.negative > 0.3 ? '#ef4444' : undefined);
      html += row('Level', gi.level);
      if (gi.reasoning) {
        html += `<div style="${pad}font-size:11px;color:#888;margin:4px 8px;font-style:italic;">"${this._esc(gi.reasoning)}"</div>`;
      }
      if (gi.categories?.length) {
        html += `<div style="${pad}display:flex;gap:4px;flex-wrap:wrap;margin:4px 8px;">${gi.categories.map(c => `<span style="font-size:10px;padding:2px 6px;border-radius:4px;background:#6366f120;color:#6366f1;">${c}</span>`).join('')}</div>`;
      }
    } else if (!noData) {
      html += secHdr('Groq Intent Analysis');
      html += `<div style="${pad}font-size:12px;color:#555;font-style:italic;margin:4px 8px;">Groq unavailable for this turn</div>`;
    }

    // Intent Scoring Log
    html += secHdr('Intent Scoring Log');
    const log = d.intentLog || [];
    if (log.length === 0) {
      html += `<div style="${pad}font-size:12px;color:#555;font-style:italic;margin:4px 8px;">No scoring events yet</div>`;
    } else {
      // Show most recent entries first, max 10
      const recent = log.slice(-10).reverse();
      html += `<div style="${pad}margin:4px 8px 8px;">`;
      for (const entry of recent) {
        const time = new Date(entry.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        const pct = Math.round(entry.engagement * 100);
        const lvlColor = entry.level === 'high' ? '#22c55e' : entry.level === 'medium' ? '#f59e0b' : '#9ca3af';
        const sigPills = entry.signals.length
          ? entry.signals.map(s => `<span style="font-size:9px;padding:1px 5px;border-radius:3px;background:${signalColors[s] || '#6366f1'}20;color:${signalColors[s] || '#6366f1'};">${s}</span>`).join(' ')
          : '';

        html += `<div style="padding:6px 8px;margin-bottom:4px;background:#1e1e2e;border-radius:6px;border-left:3px solid ${lvlColor};">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:3px;">
            <span style="font-size:11px;font-weight:700;color:#e0e0e0;">Turn ${entry.turn}</span>
            <span style="font-size:10px;color:#666;font-family:monospace;">${time}</span>
          </div>
          <div style="display:flex;gap:8px;font-size:10px;color:#aaa;flex-wrap:wrap;">
            <span>Score: <b style="color:#fff;">${pct}%</b></span>
            <span>Groq: <b style="color:#fff;">${entry.groqScore !== null ? (entry.groqScore * 100).toFixed(0) + '%' : 'n/a'}</b></span>
            <span>PF: <b style="color:#fff;">${(entry.pfScore * 100).toFixed(0)}%</b></span>
            <span>KW: <b style="color:#fff;">${entry.kwBoost.toFixed(2)}</b></span>
            ${entry.negBoost ? `<span>Neg: <b style="color:#ef4444;">${entry.negBoost.toFixed(2)}</b></span>` : ''}
          </div>
          ${sigPills ? `<div style="margin-top:4px;display:flex;gap:3px;flex-wrap:wrap;">${sigPills}</div>` : ''}
          ${entry.reasoning ? `<div style="font-size:10px;color:#777;margin-top:3px;font-style:italic;">${this._esc(entry.reasoning)}</div>` : ''}
        </div>`;
      }
      html += '</div>';
    }

    // Demandbase
    html += secHdr('Demandbase Company Profile');
    if (db) {
      if (db.company_name) html += row('Company', db.company_name, '#22c55e');
      if (db.industry) html += row('Industry', db.industry);
      if (db.sub_industry) html += row('Sub-Industry', db.sub_industry);
      if (db.employee_range) html += row('Employees', db.employee_range);
      if (db.revenue_range) html += row('Revenue', db.revenue_range);
      if (db.city || db.state) html += row('Location', [db.city, db.state, db.country].filter(Boolean).join(', '));
      if (db.web_site) html += row('Website', db.web_site);
      if (db.fortune_1000) html += row('Fortune 1000', 'Yes', '#f59e0b');
      if (db.forbes_2000) html += row('Forbes 2000', 'Yes', '#f59e0b');
    } else {
      html += `<div style="${pad}font-size:12px;color:#555;font-style:italic;margin:4px 8px;">Not available (loading or residential IP)</div>`;
    }

    return html;
  }

  /** Open the secret config dialog */
  _openConfigDialog() {
    // Prevent duplicate
    if (document.getElementById('kre-config-overlay')) return;

    const overlay = document.createElement('div');
    overlay.id = 'kre-config-overlay';
    overlay.style.cssText = `
      position:fixed; inset:0; z-index:999999; background:rgba(0,0,0,0.6);
      display:flex; align-items:center; justify-content:center; font-family:system-ui,sans-serif;
    `;

    const currentOverrides = KRERuntime._readOverrides();
    const scriptSettings = this._settings;

    // Split fields into two tabs: Services vs Branding
    const brandingGroups = new Set(['Branding', 'Starter Questions']);
    const servicesFields = KRERuntime._CONFIG_FIELDS.filter(f => !brandingGroups.has(f.group));
    const brandingFields = KRERuntime._CONFIG_FIELDS.filter(f => brandingGroups.has(f.group));

    const buildFieldsHtml = (fields) => {
      let lastGroup = '';
      return fields.map(({ key, label, group, multiline }) => {
        const cookieVal = currentOverrides[key] || '';
        const activeVal = (scriptSettings[key] || '').toString();
        const isOverride = !!cookieVal;
        const badge = isOverride
          ? '<span style="color:#f59e0b;font-size:9px;margin-left:6px;">OVERRIDE</span>'
          : (activeVal ? '<span style="color:#555;font-size:9px;margin-left:6px;">DEFAULT</span>' : '');
        const groupHeader = group !== lastGroup
          ? `<div style="font-size:10px;color:#6366f1;text-transform:uppercase;letter-spacing:1px;margin:14px 0 6px;padding-top:8px;border-top:1px solid #2a2a3a;">${group}</div>`
          : '';
        lastGroup = group;
        const inputStyle = `width:100%;padding:6px 8px;background:${isOverride ? '#1e1e3a' : '#1e1e2e'};color:#e0e0e0;border:1px solid ${isOverride ? '#6366f1' : '#444'};border-radius:4px;font-size:12px;font-family:monospace;box-sizing:border-box;`;
        const field = multiline
          ? `<textarea data-key="${key}" rows="2" placeholder="(not set)" style="${inputStyle}resize:vertical;">${this._esc(activeVal)}</textarea>`
          : `<input type="text" data-key="${key}" value="${this._escAttr(activeVal)}" placeholder="(not set)" style="${inputStyle}" />`;
        return `${groupHeader}<div style="margin-bottom:8px;"><label style="display:block;font-size:11px;color:#aaa;margin-bottom:2px;">${label}${badge}</label>${field}</div>`;
      }).join('');
    };

    const servicesHtml = buildFieldsHtml(servicesFields);
    const brandingHtml = buildFieldsHtml(brandingFields);

    const tabBtnStyle = (active) => `padding:8px 16px;border:none;border-bottom:2px solid ${active ? '#6366f1' : 'transparent'};background:transparent;color:${active ? '#fff' : '#888'};cursor:pointer;font-size:13px;font-weight:${active ? '600' : '400'};`;

    overlay.innerHTML = `
      <style>
        .kre-cfg-scroll::-webkit-scrollbar { width:6px; }
        .kre-cfg-scroll::-webkit-scrollbar-track { background:#1e1e2e;border-radius:3px; }
        .kre-cfg-scroll::-webkit-scrollbar-thumb { background:#3a3a5a;border-radius:3px; }
        .kre-cfg-scroll::-webkit-scrollbar-thumb:hover { background:#6366f1; }
        .kre-cfg-scroll { scrollbar-width:thin; scrollbar-color:#3a3a5a #1e1e2e; }
      </style>
      <div style="background:#16161e;border:1px solid #333;border-radius:12px;padding:24px;
        width:520px;max-width:90vw;max-height:85vh;display:flex;flex-direction:column;color:#e0e0e0;box-shadow:0 8px 32px rgba(0,0,0,0.5);">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
          <h3 style="margin:0;font-size:15px;color:#fff;">KRE Config Override</h3>
          <span style="font-size:10px;color:#666;background:#2a2a3a;padding:2px 8px;border-radius:4px;">Ctrl+Shift+K</span>
        </div>
        <div style="display:flex;border-bottom:1px solid #2a2a3a;margin-bottom:12px;" id="kre-cfg-tabs">
          <button data-cfg-tab="services" style="${tabBtnStyle(true)}">Services</button>
          <button data-cfg-tab="branding" style="${tabBtnStyle(false)}">Branding</button>
          <button data-cfg-tab="live" style="${tabBtnStyle(false)}">Live</button>
        </div>
        <p style="font-size:11px;color:#888;margin:0 0 12px;">
          Edit any field to override — saved to localStorage. Clear a field to revert. <span style="color:#555;">DEFAULT</span> = baked-in &nbsp; <span style="color:#f59e0b;">OVERRIDE</span> = saved.
        </p>
        <div class="kre-cfg-scroll" style="overflow-y:auto;flex:1;">
          <div id="kre-cfg-pane-services">${servicesHtml}</div>
          <div id="kre-cfg-pane-branding" style="display:none;">${brandingHtml}</div>
          <div id="kre-cfg-pane-live" style="display:none;">${this._buildLiveTabHtml()}</div>
        </div>
        <div style="display:flex;gap:8px;margin-top:12px;flex-shrink:0;">
          <button id="kre-cfg-export" style="padding:6px 10px;background:#1e293b;color:#94a3b8;border:1px solid #334155;
            border-radius:5px;cursor:pointer;font-size:11px;font-weight:600;" title="Export config as JSON file">Export</button>
          <button id="kre-cfg-import" style="padding:6px 10px;background:#1e293b;color:#94a3b8;border:1px solid #334155;
            border-radius:5px;cursor:pointer;font-size:11px;font-weight:600;" title="Import config from JSON file">Import</button>
          <input type="file" id="kre-cfg-import-file" accept=".json" style="display:none;" />
          <span style="flex:1;"></span>
          <span id="kre-cfg-io-status" style="font-size:10px;color:#666;align-self:center;"></span>
        </div>
        <div style="display:flex;gap:8px;margin-top:8px;flex-shrink:0;">
          <button id="kre-cfg-save" style="flex:1;padding:8px;background:#4f46e5;color:#fff;border:none;
            border-radius:6px;cursor:pointer;font-size:13px;font-weight:600;">Save & Reload</button>
          <button id="kre-cfg-reset" style="padding:8px 12px;background:#7f1d1d;color:#fca5a5;border:1px solid #991b1b;
            border-radius:6px;cursor:pointer;font-size:12px;">Reset to Defaults</button>
          <button id="kre-cfg-cancel" style="padding:8px 16px;background:transparent;color:#888;border:1px solid #444;
            border-radius:6px;cursor:pointer;font-size:12px;">Cancel</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    // Tab switching
    overlay.querySelectorAll('[data-cfg-tab]').forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = btn.dataset.cfgTab;
        overlay.querySelectorAll('[data-cfg-tab]').forEach(b => {
          const active = b.dataset.cfgTab === tab;
          b.style.cssText = tabBtnStyle(active);
        });
        overlay.querySelector('#kre-cfg-pane-services').style.display = tab === 'services' ? '' : 'none';
        overlay.querySelector('#kre-cfg-pane-branding').style.display = tab === 'branding' ? '' : 'none';
        const livePane = overlay.querySelector('#kre-cfg-pane-live');
        livePane.style.display = tab === 'live' ? '' : 'none';
        if (tab === 'live') {
          livePane.innerHTML = this._buildLiveTabHtml();
          overlay._liveSnapshot = livePane.innerHTML;
        }
        // Start/stop live refresh interval based on active tab
        if (tab === 'live' && !overlay._liveInterval) {
          overlay._liveInterval = setInterval(() => {
            if (!document.contains(overlay)) { clearInterval(overlay._liveInterval); return; }
            const pane = overlay.querySelector('#kre-cfg-pane-live');
            if (!pane || pane.style.display === 'none') return;
            const newHtml = this._buildLiveTabHtml();
            if (newHtml === overlay._liveSnapshot) return; // no changes — skip DOM update
            pane.innerHTML = newHtml;
            overlay._liveSnapshot = newHtml;
            // Flash changed elements
            pane.querySelectorAll('[data-live-key]').forEach(el => {
              el.classList.remove('kre-live-flash');
              void el.offsetWidth; // force reflow for re-trigger
              el.classList.add('kre-live-flash');
            });
          }, 1200);
        } else if (tab !== 'live' && overlay._liveInterval) {
          clearInterval(overlay._liveInterval);
          overlay._liveInterval = null;
        }
      });
    });

    // Close on overlay background click — clean up interval
    const closeOverlay = () => {
      if (overlay._liveInterval) clearInterval(overlay._liveInterval);
      overlay.remove();
    };
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeOverlay();
    });

    overlay.querySelector('#kre-cfg-cancel').addEventListener('click', closeOverlay);

    overlay.querySelector('#kre-cfg-save').addEventListener('click', () => {
      const overrides = {};
      for (const input of overlay.querySelectorAll('[data-key]')) {
        const key = input.dataset.key;
        const val = input.value.trim();
        const bakedDefault = (KRE_DEFAULTS[key] || '').toString();
        // Only save if different from baked default
        if (val && val !== bakedDefault) overrides[key] = val;
      }
      KRERuntime._saveOverrides(overrides);
      closeOverlay();
      window.location.reload();
    });

    overlay.querySelector('#kre-cfg-reset').addEventListener('click', () => {
      if (!confirm('Reset all settings to defaults? This clears all saved overrides.')) return;
      KRERuntime._clearOverrides();
      overlay.remove();
      window.location.reload();
    });

    // --- Export / Import ---
    const ioStatus = overlay.querySelector('#kre-cfg-io-status');
    const showStatus = (msg, color = '#94a3b8') => {
      ioStatus.textContent = msg;
      ioStatus.style.color = color;
      setTimeout(() => { ioStatus.textContent = ''; }, 3000);
    };

    overlay.querySelector('#kre-cfg-export').addEventListener('click', () => {
      const data = {};
      for (const input of overlay.querySelectorAll('[data-key]')) {
        const val = input.value.trim();
        if (val) data[input.dataset.key] = val;
      }
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const ver = data.kreVersion || this._settings.kreVersion || 'unknown';
      const date = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `kre-config-${ver}-${date}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showStatus('Exported!', '#22c55e');
    });

    const fileInput = overlay.querySelector('#kre-cfg-import-file');
    overlay.querySelector('#kre-cfg-import').addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', () => {
      const file = fileInput.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const data = JSON.parse(reader.result);
          let count = 0;
          for (const [key, val] of Object.entries(data)) {
            const input = overlay.querySelector(`[data-key="${key}"]`);
            if (input) { input.value = val; count++; }
          }
          showStatus(`Imported ${count} fields — review & Save`, '#22c55e');
        } catch (e) {
          showStatus('Invalid JSON file', '#ef4444');
        }
      };
      reader.readAsText(file);
      fileInput.value = ''; // allow re-import of same file
    });

    // Focus first input
    const first = overlay.querySelector('input');
    if (first) setTimeout(() => first.focus(), 50);
  }

  /** Register Ctrl+Shift+K key combo for config dialog */
  _registerConfigHotkey() {
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toUpperCase() === 'K') {
        e.preventDefault();
        this._openConfigDialog();
      }
    });
  }
}

/**
 * Auto-init: zero-config embed — just drop the <script> tag.
 * If __KRE_CONFIG__ exists, use it (for overrides). Otherwise, auto-create container and mount.
 */
if (typeof window !== 'undefined') {
  window.KRERuntime = KRERuntime;

  // Auto-init only for external embed pages (not when imported as a module by the demo page).
  // The demo page's inline script imports KRERuntime and creates its own instance.
  // We detect this by checking if any script on the page directly references KRERuntime.
  const isManualInit = document.currentScript === null; // ES module import = no currentScript, but inline also has none
  // Simplest reliable check: defer auto-init until DOMContentLoaded so manual init in index.html runs first
  const doAutoInit = () => {
    if (window.__KRE_INSTANCE__ || document.querySelector('.kre')) return; // already mounted
    const cfg = window.__KRE_CONFIG__ || {};
    let target = cfg.target;
    if (!target) {
      let container = document.getElementById('kre-widget-container');
      if (!container) {
        container = document.createElement('div');
        container.id = 'kre-widget-container';
        document.body.appendChild(container);
      }
      target = '#kre-widget-container';
    }
    const kre = new KRERuntime({ ...cfg, target, settings: { ...cfg.settings } });
    kre.mount(target);
    window.__KRE_INSTANCE__ = kre;
  };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', doAutoInit);
  } else {
    // DOM already ready — use microtask to let inline scripts run first
    Promise.resolve().then(doAutoInit);
  }
}

export default KRERuntime;
