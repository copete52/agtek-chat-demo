/**
 * Kaltura Avatar SDK Wrapper
 *
 * Uses the Kaltura Avatar SDK (iframe-based, clientId + flowId auth).
 * The avatar has its own conversational AI brain — context is injected
 * via Dynamic Page Prompt (DPP) on the SHOWING_AGENT event.
 *
 * No KS, no partnerId, no WebRTC — just clientId + flowId.
 */

// ── Inline Kaltura Avatar SDK v1.0.0 (MIT License) ──
// Source: https://github.com/zoharbabin/kaltura-avatar-sdk
const AvatarEvents = Object.freeze({
  SHOWING_JOIN_MEETING: 'showing-join-meeting',
  JOIN_MEETING_CLICKED: 'join-meeting-clicked',
  SHOWING_AGENT: 'showing-agent',
  AGENT_TALKED: 'agent-talked',
  USER_TRANSCRIPTION: 'user-transcription',
  PRONUNCIATION_SCORE: 'pronunciation-score',
  PERMISSIONS_DENIED: 'permissions-denied',
  CONVERSATION_ENDED: 'conversation-ended',
  LOAD_AGENT_ERROR: 'load-agent-error',
});

const AvatarState = Object.freeze({
  UNINITIALIZED: 'uninitialized',
  INITIALIZING: 'initializing',
  READY: 'ready',
  IN_CONVERSATION: 'in-conversation',
  ENDED: 'ended',
  ERROR: 'error',
});

const SDK_DEFAULT_CONFIG = {
  apiBaseUrl: 'https://api.avatar.us.kaltura.ai',
  meetBaseUrl: 'https://meet.avatar.us.kaltura.ai',
  debug: false,
  iframeClass: 'kaltura-avatar-iframe',
  iframeStyles: {
    width: '100%',
    height: '100%',
    border: 'none',
    borderRadius: '12px',
  },
};

class KalturaAvatarSDK {
  constructor(options = {}) {
    if (!options.clientId) throw new Error('clientId is required');
    if (!options.flowId) throw new Error('flowId is required');
    this._clientId = options.clientId;
    this._flowId = options.flowId;
    this._config = { ...SDK_DEFAULT_CONFIG, ...options.config };
    this._container = null;
    this._iframe = null;
    this._state = AvatarState.UNINITIALIZED;
    this._assets = null;
    this._listeners = new Map();
    this._onMessage = this._handleMessage.bind(this);
    this._transcript = [];
    this._transcriptEnabled = true;
    if (options.container) this.setContainer(options.container);
  }

  setContainer(container) {
    if (typeof container === 'string') {
      this._container = document.querySelector(container);
      if (!this._container) throw new Error(`Container not found: ${container}`);
    } else if (container instanceof HTMLElement) {
      this._container = container;
    } else {
      throw new Error('Container must be HTMLElement or selector string');
    }
    return this;
  }

  async init() {
    if (this._state !== AvatarState.UNINITIALIZED) return this._assets;
    this._setState(AvatarState.INITIALIZING);
    try {
      const url = `${this._config.apiBaseUrl}/clients/${this._clientId}/flow/${this._flowId}/sdk-assets`;
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      this._assets = await response.json();
      window.addEventListener('message', this._onMessage);
      this._setState(AvatarState.READY);
      this._emit('ready', { assets: this._assets });
      return this._assets;
    } catch (error) {
      this._setState(AvatarState.ERROR);
      this._emit('error', { message: error.message });
      throw error;
    }
  }

  async start(options = {}) {
    if (!this._container) throw new Error('Container not set. Call setContainer() first.');
    if (this._state === AvatarState.UNINITIALIZED) await this.init();
    if (this._state !== AvatarState.READY && this._state !== AvatarState.ENDED) return this._iframe;
    this._transcript = [];
    this._iframe = this._createIframe(options.styles);
    this._container.innerHTML = '';
    this._container.appendChild(this._iframe);
    this._setState(AvatarState.IN_CONVERSATION);
    this._emit('started', { iframe: this._iframe });
    return this._iframe;
  }

  end() {
    if (this._iframe) {
      this._iframe.src = 'about:blank';
      this._iframe.remove();
      this._iframe = null;
    }
    this._setState(AvatarState.ENDED);
    this._emit('ended', {});
  }

  destroy() {
    this.end();
    window.removeEventListener('message', this._onMessage);
    this._listeners.clear();
    this._assets = null;
    this._setState(AvatarState.UNINITIALIZED);
  }

  injectPrompt(text) {
    if (!text || typeof text !== 'string') return false;
    return this._postToIframe({ type: 'eself-dynamic-prompt-message', content: text });
  }

  on(event, callback) {
    if (!this._listeners.has(event)) this._listeners.set(event, new Set());
    this._listeners.get(event).add(callback);
    return () => this.off(event, callback);
  }

  off(event, callback) {
    const listeners = this._listeners.get(event);
    if (listeners) listeners.delete(callback);
  }

  getState() { return this._state; }
  getAssets() { return this._assets; }
  getAvatarInfo() { return this._assets?.avatar || null; }
  getIframe() { return this._iframe; }

  getTranscript() { return [...this._transcript]; }
  clearTranscript() { this._transcript = []; }

  _createIframe(customStyles = {}) {
    const iframe = document.createElement('iframe');
    iframe.id = 'kaltura-avatar-iframe';
    iframe.className = this._config.iframeClass;
    iframe.src = this._assets.talk_url;
    iframe.frameBorder = '0';
    iframe.sandbox = 'allow-same-origin allow-scripts allow-forms';
    iframe.allow = [
      `camera ${this._config.meetBaseUrl}`,
      `microphone ${this._config.meetBaseUrl}`,
      `display-capture ${this._config.meetBaseUrl}`,
    ].join('; ');
    Object.assign(iframe.style, this._config.iframeStyles, customStyles);
    return iframe;
  }

  _postToIframe(message) {
    if (!this._iframe?.contentWindow) return false;
    this._iframe.contentWindow.postMessage(message, '*');
    return true;
  }

  _handleMessage(event) {
    const { data } = event;
    if (!data || data.issuer !== 'eself-conversation-events') return;
    if (data.event) this._emit(data.event, data.data || {});
    if (this._transcriptEnabled) {
      if (data.event === AvatarEvents.AGENT_TALKED) {
        const text = data.data?.agentContent || data.data;
        if (text && typeof text === 'string') {
          this._transcript.push({ role: 'Avatar', text, timestamp: new Date() });
        }
      } else if (data.event === AvatarEvents.USER_TRANSCRIPTION) {
        const text = data.data?.userTranscription || data.data;
        if (text && typeof text === 'string') {
          this._transcript.push({ role: 'User', text, timestamp: new Date() });
        }
      }
    }
    if (data.event === AvatarEvents.CONVERSATION_ENDED) this._setState(AvatarState.ENDED);
    else if (data.event === AvatarEvents.LOAD_AGENT_ERROR) this._setState(AvatarState.ERROR);
  }

  _setState(newState) {
    const oldState = this._state;
    this._state = newState;
    if (oldState !== newState) this._emit('stateChange', { from: oldState, to: newState });
  }

  _emit(event, data) {
    const listeners = this._listeners.get(event);
    if (listeners) listeners.forEach(cb => { try { cb(data); } catch (e) { console.error(e); } });
    const wc = this._listeners.get('*');
    if (wc) wc.forEach(cb => { try { cb({ event, data }); } catch (e) { console.error(e); } });
  }
}

KalturaAvatarSDK.Events = AvatarEvents;
KalturaAvatarSDK.State = AvatarState;

// ── End inline SDK ──

/** Delay after SHOWING_AGENT before injecting DPP */
const DPP_INJECTION_DELAY_MS = 500;
/** Delay after SHOWING_AGENT before injecting chat history (after DPP) */
const HISTORY_INJECTION_DELAY_MS = 1100;

export class AvatarService {
  constructor(config = {}) {
    this._clientId = config.clientId || '';
    this._flowId = config.flowId || '';
    this._sdk = null;
    this._container = null;
    this._onEvent = null;
    this._ready = false;
    this._speaking = false;
    this._state = 'offline';
    this._dppContext = null;
    this._chatHistory = null; // plain-text chat transcript to inject on SHOWING_AGENT
  }

  /**
   * Initialize the avatar SDK and mount into the given container.
   * @param {HTMLElement} container
   * @param {Function} onEvent — callback(eventName, data)
   */
  async init(container, onEvent = () => {}) {
    this._container = container;
    this._onEvent = onEvent;

    if (!this._clientId || !this._flowId) {
      console.warn('[Avatar] No clientId/flowId — cannot initialize');
      this._onEvent('avatar:error', { message: 'Missing clientId or flowId' });
      return;
    }

    try {
      this._sdk = new KalturaAvatarSDK({
        clientId: this._clientId,
        flowId: this._flowId,
        container,
      });

      // State tracking
      this._sdk.on('stateChange', ({ from, to }) => {
        this._state = to;
        console.log('[Avatar] state:', from, '→', to);
      });

      // Avatar visible — inject DPP then chat history after delays
      this._sdk.on(AvatarEvents.SHOWING_AGENT, () => {
        console.log('[Avatar] SHOWING_AGENT — avatar visible');
        this._ready = true;
        this._onEvent('avatar:ready');

        if (this._dppContext) {
          setTimeout(() => {
            console.log('[Avatar] Injecting DPP context');
            this._sdk.injectPrompt(this._dppContext);
          }, DPP_INJECTION_DELAY_MS);
        }

        if (this._chatHistory) {
          setTimeout(() => {
            console.log('[Avatar] Injecting chat history');
            this._sdk.injectPrompt(this._chatHistory);
          }, HISTORY_INJECTION_DELAY_MS);
        }
      });

      // Avatar spoke
      this._sdk.on(AvatarEvents.AGENT_TALKED, (data) => {
        const text = data?.agentContent || (typeof data === 'string' ? data : null);
        if (text) {
          this._speaking = true;
          this._onEvent('avatar:spoke', { text });
          // Speaking ends when next event arrives; approximate with timeout
          setTimeout(() => {
            this._speaking = false;
          }, 500);
        }
      });

      // User speech transcribed
      this._sdk.on(AvatarEvents.USER_TRANSCRIPTION, (data) => {
        const text = data?.userTranscription || (typeof data === 'string' ? data : null);
        if (text) {
          this._onEvent('avatar:user-spoke', { text });
        }
      });

      // Conversation ended
      this._sdk.on(AvatarEvents.CONVERSATION_ENDED, () => {
        console.log('[Avatar] CONVERSATION_ENDED');
        this._onEvent('avatar:ended');
      });

      // Error
      this._sdk.on(AvatarEvents.LOAD_AGENT_ERROR, () => {
        console.error('[Avatar] LOAD_AGENT_ERROR');
        this._onEvent('avatar:error', { message: 'Failed to load avatar agent' });
      });

      this._sdk.on('error', ({ message }) => {
        console.error('[Avatar] SDK error:', message);
        this._onEvent('avatar:error', { message });
      });

      // Init + start — SDK loads assets then creates iframe
      await this._sdk.start();

    } catch (err) {
      console.error('[Avatar] init failed:', err.message);
      this._onEvent('avatar:error', { message: err.message });
    }
  }

  /**
   * Set DPP context to inject when avatar becomes ready.
   * Call before init() or while waiting for SHOWING_AGENT.
   * @param {string} contextJson — JSON string for DPP injection
   */
  setDPPContext(contextJson) {
    this._dppContext = contextJson;
    // If already ready, inject immediately
    if (this._ready && this._sdk) {
      console.log('[Avatar] Injecting DPP immediately (already ready)');
      this._sdk.injectPrompt(contextJson);
    }
  }

  /**
   * Set plain-text chat history to inject when avatar becomes ready (after DPP).
   * @param {string} historyText
   */
  setChatHistory(historyText) {
    this._chatHistory = historyText;
  }

  /**
   * Inject a prompt into the active conversation.
   * @param {string} text
   * @returns {boolean}
   */
  injectPrompt(text) {
    if (!this._sdk) return false;
    return this._sdk.injectPrompt(text);
  }

  /** Get SDK transcript */
  getTranscript() {
    return this._sdk ? this._sdk.getTranscript() : [];
  }

  get isReady() { return this._ready; }
  get isSpeaking() { return this._speaking; }
  get state() { return this._state; }

  /** End the conversation (keeps SDK alive for restart) */
  end() {
    if (this._sdk) {
      try { this._sdk.end(); } catch (e) { /* ignore */ }
    }
    this._ready = false;
    this._speaking = false;
  }

  /** Full cleanup */
  destroy() {
    if (this._sdk) {
      try { this._sdk.destroy(); } catch (e) { /* ignore */ }
      this._sdk = null;
    }
    this._ready = false;
    this._speaking = false;
    this._container = null;
    this._dppContext = null;
  }
}
