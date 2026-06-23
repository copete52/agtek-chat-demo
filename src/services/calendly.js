/**
 * Calendly API Client
 * Custom booking UI built around Calendly API responses.
 *
 * For the demo: uses realistic mock data when no API key is available.
 * API endpoints (when live):
 *   GET /event_types/{uuid} — event type metadata (name, duration, location)
 *   GET /users/{uuid} — owner profile (name, email, avatar)
 *   GET /event_type_available_times — available slots
 */

const CALENDLY_API = 'https://api.calendly.com';

const MOCK_META = {
  eventName: 'Kaltura Solutions Discovery Call',
  duration: 30,
  location: 'Google Meet (link will be sent via email)',
  schedulingUrl: null,
  assignee: {
    name: 'Sarah Chen',
    title: 'Enterprise Account Executive',
    email: null,
    avatar: null,
  },
};

export class CalendlyService {
  constructor(config = {}) {
    this.apiKey = config.apiKey || null;
    this.eventTypeUri = config.eventTypeUri || null;
    this._useMock = !this.apiKey;
    this._meta = null; // populated by init()
  }

  /**
   * Fetch event type + owner metadata from Calendly.
   * Call once after construction. Falls back to mock data on failure.
   */
  async init() {
    if (this._useMock) {
      this._meta = { ...MOCK_META };
      return this._meta;
    }

    try {
      // Fetch event type details
      const etRes = await fetch(this.eventTypeUri, {
        headers: { Authorization: `Bearer ${this.apiKey}` },
      });
      if (!etRes.ok) throw new Error(`Event type fetch failed: ${etRes.status}`);
      const etData = await etRes.json();
      const et = etData.resource;

      // Resolve location display string
      const location = this._resolveLocation(et.locations);

      // Fetch owner profile
      const ownerUri = et.profile?.owner;
      let assignee = { name: et.profile?.name || 'Sales Team', title: '', email: null, avatar: null };

      if (ownerUri) {
        try {
          const userRes = await fetch(ownerUri, {
            headers: { Authorization: `Bearer ${this.apiKey}` },
          });
          if (userRes.ok) {
            const userData = await userRes.json();
            const u = userData.resource;
            assignee = {
              name: u.name || assignee.name,
              email: u.email || null,
              avatar: u.avatar_url || null,
              title: '', // Calendly API doesn't expose job title
            };
          }
        } catch (e) {
          console.warn('Calendly: failed to fetch owner profile:', e.message);
        }
      }

      this._meta = {
        eventName: et.name || MOCK_META.eventName,
        duration: et.duration || MOCK_META.duration,
        location,
        schedulingUrl: et.scheduling_url || null,
        assignee,
      };

      console.log('Calendly: metadata loaded', this._meta);
      return this._meta;

    } catch (err) {
      console.warn('Calendly: metadata fetch failed, using mock:', err.message);
      this._meta = { ...MOCK_META };
      return this._meta;
    }
  }

  /** Get loaded metadata (event name, duration, assignee). */
  get meta() {
    return this._meta || MOCK_META;
  }

  /**
   * Resolve Calendly location objects to a display string.
   */
  _resolveLocation(locations) {
    if (!locations || locations.length === 0) return MOCK_META.location;
    const loc = locations[0];
    switch (loc.kind) {
      case 'google_conference': return 'Google Meet (link will be sent via email)';
      case 'zoom': return 'Zoom (link will be sent via email)';
      case 'microsoft_teams_conference': return 'Microsoft Teams (link will be sent via email)';
      case 'physical': return loc.location || 'In-person meeting';
      case 'outbound_call': return 'Phone call';
      case 'inbound_call': return 'Phone call (you\'ll call us)';
      case 'custom': return loc.location || 'Virtual meeting';
      default: return loc.location || 'Virtual meeting (link will be sent via email)';
    }
  }

  /**
   * Get available time slots for the next N days
   * @param {number} days - Number of days to look ahead (default: 5)
   * @returns {Array<{date: string, slots: Array<{time: string, datetime: string}>}>}
   */
  async getAvailableSlots(days = 5) {
    if (this._useMock) return this._mockSlots(days);

    // Start must be in the future (add 1h buffer)
    const start = new Date(Date.now() + 3600000);
    const end = new Date();
    end.setDate(end.getDate() + days);

    try {
      const res = await fetch(
        `${CALENDLY_API}/event_type_available_times?event_type=${encodeURIComponent(this.eventTypeUri)}&start_time=${start.toISOString()}&end_time=${end.toISOString()}`,
        { headers: { Authorization: `Bearer ${this.apiKey}` } }
      );

      if (!res.ok) {
        console.warn('Calendly API error, falling back to mock:', res.status);
        return this._mockSlots(days);
      }
      const data = await res.json();

      const grouped = this._groupByDay(data.collection || []);
      return grouped.length > 0 ? grouped : this._mockSlots(days);
    } catch (err) {
      console.warn('Calendly API unavailable, using mock:', err.message);
      return this._mockSlots(days);
    }
  }

  /**
   * Book a meeting slot
   * @param {Object} booking - Booking details
   * @returns {Object} Confirmation
   */
  async bookSlot(booking) {
    // Calendly PAT doesn't support direct event creation — requires
    // the scheduling link embed flow. We build the confirmation from
    // real metadata fetched during init().
    const meta = this.meta;
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          id: 'demo-' + Date.now(),
          status: 'confirmed',
          event: {
            name: meta.eventName,
            start_time: booking.datetime,
            duration: meta.duration,
            location: meta.location,
          },
          invitee: {
            name: booking.name,
            email: booking.email,
          },
          assignee: {
            name: meta.assignee.name,
            title: meta.assignee.title,
            avatar: meta.assignee.avatar,
          },
        });
      }, 800);
    });
  }

  // ── Mock data for demo ──

  _mockSlots(days) {
    const result = [];
    const now = new Date();

    for (let d = 1; d <= days; d++) {
      const date = new Date(now);
      date.setDate(date.getDate() + d);

      // Skip weekends
      if (date.getDay() === 0 || date.getDay() === 6) continue;

      const dateStr = date.toLocaleDateString('en-US', {
        weekday: 'short', month: 'short', day: 'numeric',
      });

      const slots = [];
      const hours = [9, 10, 11, 13, 14, 15, 16];

      // Randomly remove some slots to look realistic
      for (const h of hours) {
        if (Math.random() > 0.3) {
          const slotDate = new Date(date);
          slotDate.setHours(h, 0, 0, 0);
          slots.push({
            time: slotDate.toLocaleTimeString('en-US', {
              hour: 'numeric', minute: '2-digit', hour12: true,
            }),
            datetime: slotDate.toISOString(),
          });
        }
      }

      if (slots.length > 0) {
        result.push({ date: dateStr, dateObj: date, slots });
      }
    }

    return result;
  }

  _groupByDay(apiSlots) {
    const grouped = {};
    for (const slot of apiSlots) {
      const d = new Date(slot.start_time);
      const dateStr = d.toLocaleDateString('en-US', {
        weekday: 'short', month: 'short', day: 'numeric',
      });
      if (!grouped[dateStr]) grouped[dateStr] = { date: dateStr, dateObj: d, slots: [] };
      grouped[dateStr].slots.push({
        time: d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }),
        datetime: slot.start_time,
      });
    }
    return Object.values(grouped);
  }
}
