/**
 * Groq Enrichment Service
 * Takes a PathFactory RAG answer and rewrites it conversationally
 * using Llama 3.3 70B via Groq's OpenAI-compatible API.
 *
 * Responsibilities:
 * - Rewrite RAG answers in a warm, conversational tone
 * - Naturally collect lead info (name, email, company, role) one field per turn
 * - Output a JSON lead block at the end of each response for parsing
 * - Track conversation history for multi-turn context
 */

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const DEFAULT_MODEL = 'llama-3.3-70b-versatile';

const DEFAULT_SYSTEM_PROMPT = `You are a friendly AGTEK AI sales assistant on agtek.com.

You receive two inputs each turn:
1. RAG_ANSWER: A factual answer from our knowledge base about AGTEK products
2. VISITOR_MESSAGE: What the visitor just said

Your job:
- Rewrite the RAG answer in a warm, conversational tone (keep it concise — 2-3 short paragraphs max)
- Keep ALL factual claims from the RAG answer — do not invent product features
- Naturally weave in ONE lead-capture question per turn (don't repeat ones already answered)
- Track what you know about the visitor and personalize when possible

Lead fields to collect (one at a time, naturally):
- Name → "By the way, who am I chatting with today?"
- Company → "What company are you with? I can tailor my recommendations."
- Email → "I can send you a summary of this — what's the best email?"
- Role → "What's your role? It helps me focus on what matters most to you."

Rules:
- If a KNOWN_LEAD line is provided, those fields are ALREADY known — do NOT ask for them again. Only ask for fields that are still null.
- NEVER ask for more than one field per response
- NEVER be pushy — if they deflect, move on and try later
- Prioritize being helpful over collecting data
- If visitor volunteers info unprompted, acknowledge it warmly
- Wrap your lead-capture question in **bold** markdown (e.g., **By the way, who am I chatting with today?**)

At the END of every response, output a JSON block on its own line:
{"lead":{"email":null,"firstName":null,"lastName":null,"company":null,"role":null,"intent":"exploring","summary":null},"intentScore":{"level":"exploring","score":0.1,"confidence":0.5,"negative":0.0,"reasoning":"visitor just arrived","categories":[]}}

Update the JSON with whatever you've learned so far.

For the "lead.intent" field: set to exploring, evaluating, or high-intent based on their questions.

For the "intentScore" object — analyze buying intent from the FULL conversation:
- level: "exploring" | "evaluating" | "high_intent" | "disengaged"
- score: 0.0–1.0 (how likely this visitor is a real buyer)
- confidence: 0.0–1.0 (how sure you are of your assessment)
- negative: 0.0–1.0 (how much disengagement or "not ready" signal you detect)
- reasoning: one sentence explaining your assessment
- categories: array of detected signal categories from the visitor's message. Pick from: "pricing", "contact", "evaluation", "timeline", "competitive", "integration", "scale". Include ALL that apply to this turn. Examples:
  - "how much does AGTEK cost?" → ["pricing"]
  - "can I get a demo and pricing?" → ["evaluation", "pricing"]
  - "how does AGTEK compare to alternatives for a 1000-acre project?" → ["competitive", "scale"]
  - "can someone call me to discuss a pilot?" → ["contact", "evaluation"]
  - "what APIs do you have?" → ["integration"]
  - Generic questions with no buying signal → []

IMPORTANT — scoring rules (follow these EXACTLY):
- ANY mention of pricing, cost, quote, budget, or "how much" → score 0.6+ and level "evaluating" MINIMUM. Pricing questions are ALWAYS strong buying signals.
- ANY request for demo, trial, POC, pilot → score 0.7+ and level "high_intent"
- ANY request to talk to sales, schedule a call, contact someone → score 0.8+ and level "high_intent"
- Generic feature questions with no buying signal → score 0.2–0.4, level "exploring"
- Comparing vendors, asking about integrations → score 0.4–0.6, level "evaluating"
- "just browsing", "not ready", hedging, student/academic → high negative (0.5+), level "disengaged"

CRITICAL: Do NOT under-score pricing or demo requests. A visitor asking "what is the price" is at LEAST evaluating (0.6+), never exploring (0.3).

If you receive a VISITOR_CONTEXT line, use it to subtly personalize responses (e.g., mention relevant use cases for their industry, reference enterprise-scale features for large companies). NEVER reveal that you know the visitor's company name or details unless they volunteered it themselves. If the lead.company is already filled, skip asking for company.

RAG_ANSWER QUALITY RULES — follow these exactly:
- If RAG_ANSWER contains phrases like "I don't have", "unable to", "reach out to", "contact support", or is under 80 characters, treat it as thin/missing context.
- When RAG_ANSWER is thin: draw on your own knowledge of AGTEK products to give a helpful, factual answer. AGTEK makes earthwork takeoff and construction management software: Gradework (3D earthwork takeoff, quantity calculations, machine-ready models), Highway (DOT/roadway projects, corridors, cross-sections), Reveal (drone imagery, point cloud processing, progress tracking), Mobile Apps (field apps for iOS/Android, real-time production tracking), Trackwork (GPS machine tracking, production reporting), and Mavic 3E drone integration. Be specific and accurate.
- NEVER say "I don't have information about that" or "I can't answer that" — always provide value, then offer to connect with a specialist for deeper details.
- NEVER suggest the visitor contact support or sales as the only answer — give them something useful first.`;

export class GroqEnrichmentService {
  constructor(config = {}) {
    this._apiKey = config.apiKey || '';
    this._model = config.model || DEFAULT_MODEL;
    this._systemPrompt = config.systemPrompt || DEFAULT_SYSTEM_PROMPT;
    this._history = []; // { role: 'user'|'assistant', text: string }
    this._lead = {
      email: null,
      firstName: null,
      lastName: null,
      company: null,
      role: null,
      intent: 'exploring',
      summary: null,
    };
    this._intentScore = null; // latest structured intent from LLM
    this._visitorContext = ''; // Demandbase or other visitor enrichment
    this._enabled = !!config.apiKey;
  }

  /** Whether the enrichment layer is active (has API key) */
  get enabled() { return this._enabled; }

  /** Current lead data */
  get lead() { return { ...this._lead }; }

  /** Latest structured intent score from LLM (null if Groq unavailable/failed) */
  get intentScore() { return this._intentScore; }

  /** Visitor context string injected into Groq prompts (e.g., from Demandbase) */
  get visitorContext() { return this._visitorContext; }
  set visitorContext(ctx) { this._visitorContext = ctx || ''; }

  /** Pre-fill a lead field (e.g., from Demandbase) — won't overwrite if already captured */
  prefillLead(key, value) {
    if (value && !this._lead[key]) {
      this._lead[key] = value;
    }
  }

  /**
   * Enrich a PathFactory RAG answer with conversational tone + lead capture.
   * @param {string} visitorMessage - What the visitor just said
   * @param {string} ragAnswer - The raw PathFactory answer
   * @returns {{ enrichedText: string, lead: object }} Enriched response + updated lead
   */
  async enrich(visitorMessage, ragAnswer) {
    if (!this._enabled) {
      console.debug('[KRE:Groq] disabled (no API key)');
      return { enrichedText: ragAnswer, lead: this._lead, intentScore: null };
    }

    // Build proper multi-turn messages array
    const messages = [
      { role: 'system', content: this._systemPrompt },
    ];

    // Replay full conversation history as proper turns
    for (const h of this._history) {
      if (h.role === 'user') {
        messages.push({ role: 'user', content: `VISITOR_MESSAGE: ${h.text}\nRAG_ANSWER: ${h.rag || '(no RAG answer)'}` });
      } else {
        messages.push({ role: 'assistant', content: h.text });
      }
    }

    // Detect thin RAG answers so Groq knows to lean on its own knowledge
    const thinRagPatterns = /i don'?t have|unable to|i cannot|i can'?t|reach out to|contact (sales|support|us)|no (specific|detailed?) (information|details)|not (enough|sufficient)/i;
    const ragIsThin = !ragAnswer || ragAnswer.trim().length < 80 || thinRagPatterns.test(ragAnswer);
    const ragQualityNote = ragIsThin ? 'NOTE: The knowledge base returned limited information for this query. Use your own knowledge of AGTEK products to give a helpful, specific answer.\n' : '';

    // Current turn — include visitor context and known lead fields
    const ctxLine = this._visitorContext ? `VISITOR_CONTEXT: ${this._visitorContext}\n` : '';
    const knownFields = Object.entries(this._lead)
      .filter(([k, v]) => v && k !== 'intent' && k !== 'summary')
      .map(([k, v]) => `${k}=${v}`);
    const leadLine = knownFields.length ? `KNOWN_LEAD: ${knownFields.join(', ')}\n` : '';
    messages.push({
      role: 'user',
      content: `${ctxLine}${leadLine}${ragQualityNote}VISITOR_MESSAGE: ${visitorMessage}\nRAG_ANSWER: ${ragAnswer}\n\nWrite your enriched response (end with the JSON block):`,
    });

    console.debug('[KRE:Groq] enrich() sending', messages.length, 'messages to', this._model);

    try {
      const resp = await fetch(GROQ_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this._apiKey}`,
        },
        body: JSON.stringify({
          model: this._model,
          messages,
          temperature: 0.7,
          max_tokens: 800,
        }),
      });

      if (!resp.ok) {
        const err = await resp.text();
        console.warn('[KRE:Groq] API error', resp.status, err);
        this._intentScore = null;
        return { enrichedText: ragAnswer, lead: this._lead, intentScore: null };
      }

      const data = await resp.json();
      const rawText = data.choices?.[0]?.message?.content || ragAnswer;
      console.debug('[KRE:Groq] raw response length:', rawText.length);

      // Parse lead JSON from response
      const cleanText = this._parseLeadBlock(rawText);
      console.debug('[KRE:Groq] parsed intentScore:', this._intentScore);
      console.debug('[KRE:Groq] parsed lead:', this._lead);

      // Update conversation history — store RAG for proper multi-turn replay
      this._history.push({ role: 'user', text: visitorMessage, rag: ragAnswer });
      this._history.push({ role: 'assistant', text: rawText });

      return { enrichedText: cleanText, lead: { ...this._lead }, intentScore: this._intentScore };

    } catch (err) {
      console.warn('[KRE:Groq] network error:', err.message);
      this._intentScore = null;
      return { enrichedText: ragAnswer, lead: this._lead, intentScore: null };
    }
  }

  /**
   * Extract and merge lead + intentScore JSON block from response text.
   * Uses brace-counting to handle arbitrarily nested JSON (regex can't).
   * Returns the text without the JSON block.
   */
  _parseLeadBlock(text) {
    // Find the last top-level JSON object that contains "lead"
    // Scan backwards — the JSON is always at the end of the response
    const jsonStr = this._extractTrailingJson(text);
    console.debug('[KRE:Groq] _parseLeadBlock → JSON extracted:', jsonStr ? `${jsonStr.length} chars` : 'NULL');
    if (jsonStr) {
      try {
        const parsed = JSON.parse(jsonStr);
        console.debug('[KRE:Groq] parsed keys:', Object.keys(parsed));
        if (parsed.lead) {
          for (const [k, v] of Object.entries(parsed.lead)) {
            if (v && v !== 'null' && v !== null) {
              this._lead[k] = v;
            }
          }
        }
        if (parsed.intentScore && typeof parsed.intentScore === 'object') {
          this._intentScore = {
            level: parsed.intentScore.level || 'exploring',
            score: Math.max(0, Math.min(1, Number(parsed.intentScore.score) || 0)),
            confidence: Math.max(0, Math.min(1, Number(parsed.intentScore.confidence) || 0.5)),
            negative: Math.max(0, Math.min(1, Number(parsed.intentScore.negative) || 0)),
            reasoning: parsed.intentScore.reasoning || '',
            categories: Array.isArray(parsed.intentScore.categories) ? parsed.intentScore.categories : [],
          };
          console.debug('[KRE:Groq] intentScore parsed OK:', this._intentScore);
        } else {
          console.warn('[KRE:Groq] NO intentScore in JSON — keys were:', Object.keys(parsed));
        }
      } catch (e) {
        console.warn('[KRE:Groq] JSON parse error:', e.message, '— raw:', jsonStr.slice(0, 200));
      }
      // Strip the JSON from displayed text
      return text.slice(0, text.lastIndexOf(jsonStr)).trim();
    }
    return text.trim();
  }

  /** Extract the last balanced JSON object from text using brace counting */
  _extractTrailingJson(text) {
    // Find the last '}' in the text
    let end = text.lastIndexOf('}');
    if (end === -1) return null;

    // Walk backwards counting braces to find the matching '{'
    let depth = 0;
    let inString = false;
    let escaped = false;
    for (let i = end; i >= 0; i--) {
      const ch = text[i];
      if (escaped) { escaped = false; continue; }
      // Note: scanning backwards, so \ before a char means i-1 is \
      if (i > 0 && text[i - 1] === '\\') { escaped = true; }
      if (ch === '"' && !escaped) inString = !inString;
      if (inString) continue;
      if (ch === '}') depth++;
      if (ch === '{') depth--;
      if (depth === 0) {
        const candidate = text.slice(i, end + 1);
        // Verify it contains "lead" to avoid grabbing random JSON
        if (candidate.includes('"lead"')) return candidate;
        return null;
      }
    }
    return null;
  }

  /** Reset conversation and lead state */
  reset() {
    this._history = [];
    this._lead = {
      email: null,
      firstName: null,
      lastName: null,
      company: null,
      role: null,
      intent: 'exploring',
      summary: null,
    };
    this._intentScore = null;
  }
}
