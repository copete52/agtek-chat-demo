/**
 * PathFactory ChatFactory API client
 * Provides AI chat with RAG over corp.kaltura.com content
 */

// Defaults — Kaltura demo content pool on corp.kaltura.com
/*
const DEFAULTS = {
  baseUrl:       'https://jukebox.pathfactory.com/api/public/v3/cf_headless',
  clientId:      'LB-14D000BB-11275',
  orgId:         '37116a20-6c86-4cd3-a7db-dbcb6819deb5',
  contentPoolId: 'd2477ec3-15ca-4243-bdec-b1d9bcc3b9ac',
  contextUuid:   '081bdb89-de8b-407e-bd7b-aa9111027cbd',
  cfBaseUrl:     'https://kaltura.pathfactory.com',
};
*/

// Micron demo content
const DEFAULTS = {
  baseUrl:       'https://jukebox.pathfactory.com/api/public/v3/cf_headless',
  clientId:      'LB-D286F944-11192',
  orgId:         'ddf8afdc-c7cf-4c7c-a4b5-ef9b4255eee4',
  contentPoolId: '9a53208c-e13c-4ec7-ac5b-6c4dba1b9dd5',
  contextUuid:   'cc21e804-2521-4223-a244-45d591f6f03a',
  cfBaseUrl:     'https://micron.pathfactory.com',
};


function uuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export class PathFactoryClient {
  constructor(config = {}) {
    this._baseUrl       = config.pfBaseUrl       || DEFAULTS.baseUrl;
    this._clientId      = config.pfClientId      || DEFAULTS.clientId;
    this._orgId         = config.pfOrgId         || DEFAULTS.orgId;
    this._contentPoolId = config.pfContentPoolId || DEFAULTS.contentPoolId;
    this._contextUuid   = config.pfContextUuid   || DEFAULTS.contextUuid;
    this._cfBaseUrl     = config.pfCfBaseUrl     || DEFAULTS.cfBaseUrl;
    this.token = null;
    this.visitorId = uuid();
    this.sessionId = uuid();
    this.turnCount = 0;
  }

  async onboard() {
    const url = `${this._baseUrl}/onboard?client_id=${this._clientId}&context_uuid=${this._contextUuid}&cf_base_url=${encodeURIComponent(this._cfBaseUrl)}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Onboard failed: ${res.status}`);
    return res.json();
  }

  async authenticate() {
    const res = await fetch(`${this._baseUrl}/authenticate?client_id=${this._clientId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        matching_content_pool_id: this._contentPoolId,
        recom_content_pool_id: this._contentPoolId,
        organization_id: this._orgId,
        visitor_id: this.visitorId,
        session_id: this.sessionId,
        context_uuid: this._contextUuid,
        cf_base_url: this._cfBaseUrl,
      }),
    });
    if (!res.ok) throw new Error(`Auth failed: ${res.status}`);
    const data = await res.json();
    this.token = data.token || data;
    return this.token;
  }

  async init() {
    await this.onboard();
    await this.authenticate();
    return this;
  }

  async converse(query) {
    if (!this.token) throw new Error('Not authenticated');

    this.turnCount++;

    const res = await fetch(`${this._baseUrl}/conversation?client_id=${this._clientId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: this.token,
      },
      body: JSON.stringify({
        query,
        user_role: '',
        stream: false,
        with_recommendation: true,
        with_response: true,
        user_type: 'BUYER',
        query_source: 'BY_SUGGESTION',
        regeneration_type: 'DEFAULT',
      }),
    });

    if (!res.ok) throw new Error(`Conversation failed: ${res.status}`);
    return this._parse(await res.json());
  }

  _parse(data) {
    const c = data.conversation || data;
    return {
      id: c.id,
      answer: c.response?.[0]?.response || '',
      responseScore: c.response?.[0]?.responseScore || 0,
      recommendations: (c.recommendations?.contentDatas || []).map((r) => ({
        id: r.id,
        title: r.title,
        description: r.description,
        thumbnail: r.thumbnail,
        url: r.normalizedUrl ? `https://${r.normalizedUrl}` : (r.recommendedUrl || r.contentUrl),
        type: r.contentType,
        score: r.finalMatchScore,
      })),
      citations: (Array.isArray(c.citations) ? c.citations : []).map((ci) => ({
        title: ci.title,
        url: ci.normalizedUrl,
        thumbnail: ci.thumbnail,
        score: ci.score,
        explanation: ci.explanation,
      })),
      followUps: (c.queryVersions || []).slice(1), // skip rephrased original
      intent: c.intentSignal || {},
      engagementScore: c.engagementScore || 0,
      offers: c.offers || [],
    };
  }

  async suggest(query) {
    const res = await fetch(`${this._baseUrl}/auto_suggest?client_id=${this._clientId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: this.token },
      body: JSON.stringify({ query }),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.suggestions || [];
  }
}
