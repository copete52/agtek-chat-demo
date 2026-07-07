/**
 * Admin Panel Component
 * Demo-only configuration dashboard showing KB, routing rules, integrations, and avatar config.
 * Mounted outside the widget Shadow DOM, in the host page.
 */

export class AdminPanel {
  constructor(config = {}) {
    this.container = null;
    this._activeTab = 'live';
    this._visible = false;
    this._liveData = config.liveData || {}; // real-time widget data
    this._settings = config.settings || {};  // branding config from runtime
  }

  mount(container) {
    this.container = container;
    this.container.style.display = 'none';
  }

  toggle() {
    this._visible = !this._visible;
    if (this.container) {
      this.container.style.display = this._visible ? 'block' : 'none';
    }
    if (this._visible) this._render();
  }

  updateLiveData(data) {
    this._liveData = { ...this._liveData, ...data };
    if (this._visible) this._renderTabContent();
  }

  _render() {
    if (!this.container) return;

    this.container.innerHTML = `
      <div class="admin-panel">
        <div class="admin-header">
          <h2>KRE Configuration Dashboard</h2>
          <span class="admin-badge">Demo Mode</span>
          <button class="admin-close" aria-label="Close admin panel">&times;</button>
        </div>
        <div class="admin-tabs">
          <button class="admin-tab ${this._activeTab === 'live' ? 'admin-tab--active' : ''}" data-tab="live">Live</button>
          <button class="admin-tab ${this._activeTab === 'kb' ? 'admin-tab--active' : ''}" data-tab="kb">Knowledge Base</button>
          <button class="admin-tab ${this._activeTab === 'routing' ? 'admin-tab--active' : ''}" data-tab="routing">Routing Rules</button>
          <button class="admin-tab ${this._activeTab === 'integrations' ? 'admin-tab--active' : ''}" data-tab="integrations">Integrations</button>
          <button class="admin-tab ${this._activeTab === 'avatar' ? 'admin-tab--active' : ''}" data-tab="avatar">Avatar Config</button>
          <button class="admin-tab ${this._activeTab === 'branding' ? 'admin-tab--active' : ''}" data-tab="branding">Branding</button>
        </div>
        <div class="admin-content" id="admin-tab-content"></div>
      </div>
    `;

    // Wire tabs
    this.container.querySelectorAll('.admin-tab').forEach((btn) => {
      btn.addEventListener('click', () => {
        this._activeTab = btn.dataset.tab;
        this.container.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('admin-tab--active'));
        btn.classList.add('admin-tab--active');
        this._renderTabContent();
      });
    });

    this.container.querySelector('.admin-close').addEventListener('click', () => this.toggle());

    this._renderTabContent();
  }

  _renderTabContent() {
    const el = this.container?.querySelector('#admin-tab-content');
    if (!el) return;

    switch (this._activeTab) {
      case 'live': el.innerHTML = this._renderLive(); break;
      case 'kb': el.innerHTML = this._renderKB(); break;
      case 'routing': el.innerHTML = this._renderRouting(); break;
      case 'integrations': el.innerHTML = this._renderIntegrations(); break;
      case 'avatar': el.innerHTML = this._renderAvatar(); break;
      case 'branding': el.innerHTML = this._renderBranding(); break;
    }
  }

  _renderLive() {
    const lead = this._liveData.lead || {};
    const score = this._liveData.engagementScore || 0;
    const intent = this._liveData.intentLevel || 'Exploring';
    const turns = this._liveData.turnCount || 0;
    const groq = this._liveData.groqIntent || null;
    const enriched = this._liveData.enrichmentEnabled;
    const queries = this._liveData.queries || [];
    const signals = this._liveData.detectedSignals || [];

    const fullName = [lead.firstName, lead.lastName].filter(Boolean).join(' ') || null;

    const fieldRow = (label, value) => {
      const filled = value && value !== 'null';
      const display = filled ? this._esc(value) : '<span style="color:#888;font-style:italic;">not yet captured</span>';
      const dot = filled ? '🟢' : '⬜';
      return `<tr><td>${dot} <strong>${label}</strong></td><td>${display}</td></tr>`;
    };

    return `
      <div class="admin-section">
        <h3>Live Session</h3>
        <p class="admin-desc">Real-time lead capture and intent scoring from the active conversation.</p>

        <div class="admin-cards">
          <div class="admin-stat-card">
            <div class="admin-stat-value">${Math.round(score * 100)}%</div>
            <div class="admin-stat-label">Engagement</div>
          </div>
          <div class="admin-stat-card">
            <div class="admin-stat-value">${intent}</div>
            <div class="admin-stat-label">Intent Level</div>
          </div>
          <div class="admin-stat-card">
            <div class="admin-stat-value">${turns}</div>
            <div class="admin-stat-label">Turns</div>
          </div>
          <div class="admin-stat-card">
            <div class="admin-stat-value admin-stat-value--${enriched ? 'green' : 'yellow'}">${enriched ? 'Active' : 'Fallback'}</div>
            <div class="admin-stat-label">Groq LLM</div>
          </div>
        </div>

        <h4>Lead Capture Progress</h4>
        <table class="admin-table admin-table--compact">
          <tbody>
            ${fieldRow('Name', fullName)}
            ${fieldRow('Email', lead.email)}
            ${fieldRow('Company', lead.company)}
            ${fieldRow('Role', lead.role)}
          </tbody>
        </table>

        ${groq ? `
        <h4 style="margin-top:20px;">Groq Intent Analysis</h4>
        <table class="admin-table admin-table--compact">
          <tbody>
            <tr><td><strong>Score</strong></td><td>${Math.round((groq.score || 0) * 100)}% (confidence: ${Math.round((groq.confidence || 0) * 100)}%)</td></tr>
            <tr><td><strong>Level</strong></td><td>${groq.level || '—'}</td></tr>
            <tr><td><strong>Reasoning</strong></td><td>${this._esc(groq.reasoning || '—')}</td></tr>
            <tr><td><strong>Categories</strong></td><td>${(groq.categories || []).join(', ') || '—'}</td></tr>
          </tbody>
        </table>` : ''}

        ${queries.length ? `
        <h4 style="margin-top:20px;">Recent Queries</h4>
        <div class="admin-query-log">
          ${queries.map(q => `<div class="admin-query-item"><span class="admin-query-icon">Q</span> ${this._esc(q)}</div>`).join('')}
        </div>` : ''}

        ${signals.length ? `
        <h4 style="margin-top:20px;">Detected Signals</h4>
        <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:8px;">
          ${signals.map(s => `<span class="admin-badge admin-badge--blue">${this._esc(s)}</span>`).join('')}
        </div>` : ''}
      </div>
    `;
  }

  _renderKB() {
    return `
      <div class="admin-section">
        <h3>Content Knowledge Base</h3>
        <p class="admin-desc">PathFactory ChatFactory indexes your website content for AI-powered conversations.</p>

        <div class="admin-cards">
          <div class="admin-stat-card">
            <div class="admin-stat-value">agtek.com</div>
            <div class="admin-stat-label">Source Domain</div>
          </div>
          <div class="admin-stat-card">
            <div class="admin-stat-value">247</div>
            <div class="admin-stat-label">Indexed Pages</div>
          </div>
          <div class="admin-stat-card">
            <div class="admin-stat-value">2h ago</div>
            <div class="admin-stat-label">Last Crawl</div>
          </div>
          <div class="admin-stat-card">
            <div class="admin-stat-value admin-stat-value--green">Healthy</div>
            <div class="admin-stat-label">Index Status</div>
          </div>
        </div>

        <h4>Content Pools</h4>
        <table class="admin-table">
          <thead>
            <tr><th>Pool Name</th><th>Articles</th><th>Last Updated</th><th>Status</th></tr>
          </thead>
          <tbody>
            <tr><td>Product Pages</td><td>62</td><td>Apr 16, 2026</td><td><span class="admin-badge admin-badge--green">Active</span></td></tr>
            <tr><td>Blog & Resources</td><td>128</td><td>Apr 16, 2026</td><td><span class="admin-badge admin-badge--green">Active</span></td></tr>
            <tr><td>Solutions Pages</td><td>34</td><td>Apr 15, 2026</td><td><span class="admin-badge admin-badge--green">Active</span></td></tr>
            <tr><td>Case Studies</td><td>23</td><td>Apr 14, 2026</td><td><span class="admin-badge admin-badge--green">Active</span></td></tr>
          </tbody>
        </table>

        <h4>Recent Queries</h4>
        <div class="admin-query-log">
          ${(this._liveData.queries || ['How does Gradework handle 3D earthwork takeoff?', 'What drone integration does AGTEK support?']).map(q =>
            `<div class="admin-query-item"><span class="admin-query-icon">Q</span> ${this._esc(q)}</div>`
          ).join('')}
        </div>
      </div>
    `;
  }

  _renderRouting() {
    const score = this._liveData.engagementScore || 0;
    const intent = this._liveData.intentLevel || 'Exploring';
    const turns = this._liveData.turnCount || 0;

    return `
      <div class="admin-section">
        <h3>Lead Routing Rules</h3>
        <p class="admin-desc">Configure how visitors are routed based on engagement signals and intent detection.</p>

        <div class="admin-live-panel">
          <h4>Live Session Data</h4>
          <div class="admin-cards">
            <div class="admin-stat-card">
              <div class="admin-stat-value">${Math.round(score * 100)}%</div>
              <div class="admin-stat-label">Engagement Score</div>
            </div>
            <div class="admin-stat-card">
              <div class="admin-stat-value">${intent}</div>
              <div class="admin-stat-label">Intent Level</div>
            </div>
            <div class="admin-stat-card">
              <div class="admin-stat-value">${turns}</div>
              <div class="admin-stat-label">Conversation Turns</div>
            </div>
          </div>
        </div>

        <h4>Routing Flow</h4>
        <div class="admin-flow">
          <div class="admin-flow__step ${score < 0.4 ? 'admin-flow__step--active' : ''}">
            <div class="admin-flow__node">1</div>
            <div class="admin-flow__detail">
              <strong>Exploring</strong>
              <p>Score &lt; 40% — Self-serve content recommendations</p>
            </div>
          </div>
          <div class="admin-flow__arrow">&darr;</div>
          <div class="admin-flow__step ${score >= 0.4 && score < 0.7 ? 'admin-flow__step--active' : ''}">
            <div class="admin-flow__node">2</div>
            <div class="admin-flow__detail">
              <strong>Evaluating</strong>
              <p>Score 40-70% — Proactive content + follow-up suggestions</p>
            </div>
          </div>
          <div class="admin-flow__arrow">&darr;</div>
          <div class="admin-flow__step ${score >= 0.7 ? 'admin-flow__step--active' : ''}">
            <div class="admin-flow__node">3</div>
            <div class="admin-flow__detail">
              <strong>High Intent</strong>
              <p>Score &ge; 70% + 2+ turns — Offer AI Avatar or meeting booking</p>
            </div>
          </div>
          <div class="admin-flow__branch">
            <div class="admin-flow__branch-item">
              <span class="admin-flow__branch-icon">🤖</span>
              <div>
                <strong>AI Avatar</strong>
                <p>Live conversation with AGTEK AI Avatar</p>
              </div>
            </div>
            <div class="admin-flow__branch-item">
              <span class="admin-flow__branch-icon">📅</span>
              <div>
                <strong>Meeting Booking</strong>
                <p>Schedule with sales via Calendly</p>
              </div>
            </div>
            <div class="admin-flow__branch-item">
              <span class="admin-flow__branch-icon">👤</span>
              <div>
                <strong>Human Handoff</strong>
                <p>Transfer to live sales rep</p>
              </div>
            </div>
          </div>
        </div>

        <h4>Threshold Configuration</h4>
        <table class="admin-table">
          <thead><tr><th>Parameter</th><th>Value</th><th>Description</th></tr></thead>
          <tbody>
            <tr><td>Escalation Score</td><td><code>0.70</code></td><td>Minimum engagement score to trigger escalation</td></tr>
            <tr><td>Min Turns</td><td><code>2</code></td><td>Minimum conversation turns before escalation</td></tr>
            <tr><td>Cooldown</td><td><code>60s</code></td><td>Wait time before re-showing escalation prompt</td></tr>
            <tr><td>Avatar Priority</td><td><code>High</code></td><td>Prefer avatar over direct booking</td></tr>
          </tbody>
        </table>
      </div>
    `;
  }

  _renderIntegrations() {
    return `
      <div class="admin-section">
        <h3>CRM & Marketing Integrations</h3>
        <p class="admin-desc">Real-time sync of engagement data, lead scoring, and meeting outcomes.</p>

        <div class="admin-integration">
          <div class="admin-integration__header">
            <div class="admin-integration__logo">
              <svg viewBox="0 0 32 32" width="24" height="24"><circle cx="16" cy="16" r="14" fill="#00A1E0"/><text x="16" y="21" text-anchor="middle" fill="#fff" font-size="14" font-weight="bold">S</text></svg>
            </div>
            <div>
              <strong>Salesforce</strong>
              <span class="admin-badge admin-badge--green">Connected</span>
            </div>
          </div>
          <table class="admin-table admin-table--compact">
            <thead><tr><th>KRE Field</th><th>&rarr;</th><th>SFDC Field</th></tr></thead>
            <tbody>
              <tr><td>Engagement Score</td><td>&rarr;</td><td>Lead Score (0-100)</td></tr>
              <tr><td>Intent Signal</td><td>&rarr;</td><td>Lead Status</td></tr>
              <tr><td>Conversation Topics</td><td>&rarr;</td><td>Description</td></tr>
              <tr><td>Content Viewed</td><td>&rarr;</td><td>Custom: Last_Content_Viewed__c</td></tr>
              <tr><td>Meeting Booked</td><td>&rarr;</td><td>Task + Activity</td></tr>
              <tr><td>Avatar Transcript</td><td>&rarr;</td><td>Note Attachment</td></tr>
            </tbody>
          </table>
        </div>

        <div class="admin-integration">
          <div class="admin-integration__header">
            <div class="admin-integration__logo">
              <svg viewBox="0 0 32 32" width="24" height="24"><circle cx="16" cy="16" r="14" fill="#5C4C9F"/><text x="16" y="21" text-anchor="middle" fill="#fff" font-size="14" font-weight="bold">M</text></svg>
            </div>
            <div>
              <strong>Marketo</strong>
              <span class="admin-badge admin-badge--green">Connected</span>
            </div>
          </div>
          <table class="admin-table admin-table--compact">
            <thead><tr><th>Trigger</th><th>Action</th></tr></thead>
            <tbody>
              <tr><td>High Intent Detected (score &ge; 70%)</td><td>Enroll in "High Intent Nurture" campaign</td></tr>
              <tr><td>Avatar Conversation Completed</td><td>Enroll in "Post-Avatar Follow-up" drip</td></tr>
              <tr><td>Meeting Booked</td><td>Enroll in "Pre-Meeting Prep" sequence</td></tr>
              <tr><td>3+ Content Pieces Viewed</td><td>Add to "Engaged Prospects" smart list</td></tr>
            </tbody>
          </table>
        </div>

        <div class="admin-integration">
          <div class="admin-integration__header">
            <div class="admin-integration__logo">
              <svg viewBox="0 0 32 32" width="24" height="24"><circle cx="16" cy="16" r="14" fill="#006BFF"/><text x="16" y="21" text-anchor="middle" fill="#fff" font-size="14" font-weight="bold">C</text></svg>
            </div>
            <div>
              <strong>Calendly</strong>
              <span class="admin-badge admin-badge--green">Connected</span>
            </div>
          </div>
          <table class="admin-table admin-table--compact">
            <thead><tr><th>Setting</th><th>Value</th></tr></thead>
            <tbody>
              <tr><td>Event Type</td><td>Solutions Discovery Call (30 min)</td></tr>
              <tr><td>Round-Robin Assignees</td><td>Sarah Chen, Michael Torres, Lisa Park</td></tr>
              <tr><td>Availability Window</td><td>Mon-Fri 9AM-5PM EST</td></tr>
              <tr><td>Buffer Time</td><td>15 min between meetings</td></tr>
            </tbody>
          </table>
        </div>

        <h4 style="margin-top: 24px;">Simulated Lead Record</h4>
        <div class="admin-lead-card">
          <div class="admin-lead-header">
            <strong>New Lead Created in Salesforce</strong>
            <span class="admin-badge admin-badge--blue">Just Now</span>
          </div>
          <table class="admin-table admin-table--compact">
            <tbody>
              ${(() => {
                const l = this._liveData.lead || {};
                const name = [l.firstName, l.lastName].filter(Boolean).join(' ') || 'Website Visitor';
                const company = l.company || '—';
                const email = l.email || '—';
                const role = l.role || '—';
                const topics = (this._liveData.queries || []).join(', ') || '—';
                return `
                  <tr><td><strong>Name</strong></td><td>${this._esc(name)}</td></tr>
                  <tr><td><strong>Email</strong></td><td>${this._esc(email)}</td></tr>
                  <tr><td><strong>Company</strong></td><td>${this._esc(company)}</td></tr>
                  <tr><td><strong>Role</strong></td><td>${this._esc(role)}</td></tr>
                  <tr><td><strong>Source</strong></td><td>KRE AI SDR Widget</td></tr>
                  <tr><td><strong>Lead Score</strong></td><td>${Math.round((this._liveData.engagementScore || 0) * 100)}</td></tr>
                  <tr><td><strong>Intent</strong></td><td>${this._liveData.intentLevel || 'Exploring'}</td></tr>
                  <tr><td><strong>Topics</strong></td><td>${this._esc(topics)}</td></tr>
                  <tr><td><strong>Status</strong></td><td>Marketing Qualified Lead (MQL)</td></tr>
                `;
              })()}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  _renderAvatar() {
    return `
      <div class="admin-section">
        <h3>AI Avatar Configuration</h3>
        <p class="admin-desc">Configure the Kaltura AI Avatar for live visitor conversations.</p>

        <div class="admin-cards">
          <div class="admin-stat-card">
            <div class="admin-stat-value">Active</div>
            <div class="admin-stat-label">Avatar Status</div>
          </div>
          <div class="admin-stat-card">
            <div class="admin-stat-value">6510092</div>
            <div class="admin-stat-label">Partner ID</div>
          </div>
          <div class="admin-stat-card">
            <div class="admin-stat-value">WebRTC</div>
            <div class="admin-stat-label">Streaming Protocol</div>
          </div>
        </div>

        <h4>Persona Prompt</h4>
        <div class="admin-code-block">
          <pre>You are an AGTEK AI Sales Assistant. You help website visitors
understand AGTEK's earthwork takeoff and construction management
software. Be conversational, knowledgeable, and helpful. Focus
on understanding their project type and recommending the right
AGTEK solution.

Key behaviors:
- Ask clarifying questions about their project type (grading, highway, drone survey)
- Reference specific AGTEK products relevant to their needs (Gradework, Highway, Reveal, Trackwork)
- Offer to book a demo when the visitor seems ready
- Maintain a professional but approachable tone</pre>
        </div>

        <h4>Dynamic Page Prompt (DPP)</h4>
        <p class="admin-desc">Contextual information injected at conversation start based on visitor journey.</p>
        <table class="admin-table">
          <thead><tr><th>DPP Field</th><th>Source</th><th>Example</th></tr></thead>
          <tbody>
            <tr><td>Visitor Questions</td><td>Chat history</td><td>"earthwork takeoff, GPS machine control"</td></tr>
            <tr><td>Intent Level</td><td>PathFactory intent signal</td><td>"High Intent"</td></tr>
            <tr><td>Engagement Score</td><td>PathFactory engagement</td><td>"78%"</td></tr>
            <tr><td>Content Viewed</td><td>Recommendation clicks</td><td>"3 product pages"</td></tr>
          </tbody>
        </table>

        <h4>SDK Configuration</h4>
        <table class="admin-table">
          <thead><tr><th>Parameter</th><th>Value</th></tr></thead>
          <tbody>
            <tr><td>SDK Version</td><td>Latest (CDN)</td></tr>
            <tr><td>Endpoint</td><td>https://static.avatar.us.kaltura.ai/sdk/</td></tr>
            <tr><td>Auth Method</td><td>Kaltura Session (KS)</td></tr>
            <tr><td>Video Quality</td><td>720p (adaptive)</td></tr>
            <tr><td>Language</td><td>English (US)</td></tr>
            <tr><td>Fallback</td><td>Animated avatar with text transcript</td></tr>
          </tbody>
        </table>
      </div>
    `;
  }

  _renderBranding() {
    const s = this._settings;
    const row = (label, val) => `<tr><td>${this._esc(label)}</td><td><code>${this._esc(val || '(default)')}</code></td></tr>`;
    return `
      <div class="admin-section">
        <h3>Widget Branding & Copy</h3>
        <p class="admin-desc">All user-facing text is configurable per demo — change via <code>Ctrl+Shift+K</code> → Branding tab, or <code>window.__KRE_CONFIG__</code>.</p>

        <h4>Identity</h4>
        <table class="admin-table">
          <thead><tr><th>Setting</th><th>Current Value</th></tr></thead>
          <tbody>
            ${row('Brand Name', s.brandName)}
            ${row('Header Title', s.headerTitle)}
            ${row('Header Status', s.headerStatus)}
            ${row('Primary Color', s.primaryColor || '#006efa (default)')}
            ${row('Footer', s.footerText)}
          </tbody>
        </table>

        <h4>Welcome Screen</h4>
        <table class="admin-table">
          <thead><tr><th>Setting</th><th>Current Value</th></tr></thead>
          <tbody>
            ${row('Heading', s.welcomeHeading)}
            ${row('Message', s.welcomeMessage)}
            ${row('Input Placeholder', s.inputPlaceholder)}
          </tbody>
        </table>

        <h4>Buttons & CTAs</h4>
        <table class="admin-table">
          <thead><tr><th>Setting</th><th>Current Value</th></tr></thead>
          <tbody>
            ${row('Book Button', s.bookBtnLabel)}
            ${row('Book Subtext', s.bookBtnSubtext)}
            ${row('Avatar Button', s.avatarBtnLabel)}
            ${row('Avatar Subtext', s.avatarBtnSubtext)}
            ${row('Avatar View Title', s.avatarViewTitle)}
          </tbody>
        </table>

        <h4>Escalation</h4>
        <table class="admin-table">
          <thead><tr><th>Setting</th><th>Current Value</th></tr></thead>
          <tbody>
            ${row('Label', s.escalationLabel)}
            ${row('Message', s.escalationText)}
          </tbody>
        </table>

        <h4>Starter Questions</h4>
        <table class="admin-table">
          <thead><tr><th>#</th><th>Question</th></tr></thead>
          <tbody>
            ${row('Chat 1', s.starterQ1)}
            ${row('Chat 2', s.starterQ2)}
            ${row('Chat 3', s.starterQ3)}
            ${row('Chat 4', s.starterQ4)}
            ${row('Avatar 1', s.avatarChip1)}
            ${row('Avatar 2', s.avatarChip2)}
            ${row('Avatar 3', s.avatarChip3)}
          </tbody>
        </table>
      </div>
    `;
  }

  _esc(str) {
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }

  destroy() {
    if (this.container) this.container.innerHTML = '';
    this.container = null;
  }
}
