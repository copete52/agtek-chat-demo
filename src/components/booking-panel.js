/**
 * Booking Panel Component
 * Embeds Calendly's real scheduling widget as an iframe.
 * Prefills visitor info (name, email) when available.
 * Listens for the calendly.event_scheduled postMessage to detect confirmation.
 */

const DEFAULT_CALENDLY_URL = 'https://calendly.com/yairneumann11/30min';

export class BookingPanel {
  constructor(config = {}) {
    this.container = null;
    this._onEvent = null;
    this._schedulingUrl = config.schedulingUrl || DEFAULT_CALENDLY_URL;
    this._visitorInfo = config.visitorInfo || {};
    this._customAnswers = config.customAnswers || '';
    this._messageHandler = null;
  }

  /**
   * Mount the booking panel into a container
   * @param {HTMLElement} container
   * @param {Function} onEvent - callback(eventName, data)
   */
  async mount(container, onEvent = () => {}) {
    this.container = container;
    this._onEvent = onEvent;

    // Build Calendly URL with prefill params
    const url = new URL(this._schedulingUrl);
    url.searchParams.set('hide_gdpr_banner', '1');
    url.searchParams.set('background_color', '1a1a24');
    url.searchParams.set('text_color', 'e0e0e0');
    url.searchParams.set('primary_color', '006cfa');

    // Prefill visitor info if available
    const name = this._visitorInfo.name || '';
    const email = this._visitorInfo.email || '';
    if (name) url.searchParams.set('name', name);
    if (email) url.searchParams.set('email', email);
    if (this._customAnswers) url.searchParams.set('a1', this._customAnswers);

    this.container.innerHTML = `
      <div class="kre-booking">
        <div class="kre-booking__header">
          <h3>Book a Meeting</h3>
          <p>Pick a time that works for you</p>
        </div>
        <div class="kre-booking__embed">
          <iframe
            src="${url.toString()}"
            width="100%"
            height="100%"
            frameborder="0"
            title="Schedule a meeting"
            allow="payment"
          ></iframe>
        </div>
      </div>
    `;

    // Listen for Calendly postMessage events
    this._messageHandler = (e) => {
      if (e.data?.event === 'calendly.event_scheduled') {
        this._onScheduled(e.data.payload);
      }
    };
    window.addEventListener('message', this._messageHandler);
  }

  /**
   * Update visitor info for prefill (call before mount, or re-mount)
   */
  setVisitorInfo(info) {
    this._visitorInfo = { ...this._visitorInfo, ...info };
  }

  _onScheduled(payload) {
    // Replace iframe with confirmation
    this.container.innerHTML = `
      <div class="kre-booking kre-booking--confirmed">
        <div class="kre-booking__check">
          <svg viewBox="0 0 48 48" width="48" height="48" fill="none">
            <circle cx="24" cy="24" r="22" fill="#22c55e"/>
            <path d="M15 24l6 6 12-12" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
        <h3>Meeting Booked!</h3>
        <p class="kre-booking__note">A calendar invitation has been sent to your email.</p>
        <button class="kre-booking__done-btn">Back to Chat</button>
      </div>
    `;

    this.container.querySelector('.kre-booking__done-btn')?.addEventListener('click', () => {
      this._onEvent?.('booking:done', {});
    });

    this._onEvent?.('booking:confirmed', { calendly: payload });
  }

  destroy() {
    if (this._messageHandler) {
      window.removeEventListener('message', this._messageHandler);
      this._messageHandler = null;
    }
    if (this.container) this.container.innerHTML = '';
    this.container = null;
  }
}
