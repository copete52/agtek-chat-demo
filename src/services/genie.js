/**
 * Kaltura Genie Search Service
 * Calls /assistant/converse to retrieve relevant video clips for a query.
 * Parses NDJSON streaming response to extract clip citations with entry IDs,
 * timestamps, and source metadata.
 */

const DEFAULT_BASE = 'https://genie.nvp1.ovp.kaltura.com';
const MAX_CLIPS = 4;

export class GenieSearchService {
  constructor(config = {}) {
    this._ks = config.ks || '';
    this._partnerId = config.partnerId || '';
    this._baseUrl = config.baseUrl || DEFAULT_BASE;
    this._enabled = !!(this._ks && this._partnerId);
  }

  get enabled() { return this._enabled; }

  /**
   * Search for video clips related to a query.
   * @param {string} query - User's question
   * @returns {{ clips: Array<{ entryId, text, title, startTime, endTime, thumbnailUrl, type }> }}
   */
  async search(query) {
    if (!this._enabled) return { clips: [] };

    try {
      const resp = await fetch(`${this._baseUrl}/assistant/converse`, {
        method: 'POST',
        headers: {
          'Authorization': `KS ${this._ks}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userMessage: query,
          sse: false,
          model_type: 'fast',
        }),
      });

      if (!resp.ok) {
        console.warn('[KRE:Genie] converse failed:', resp.status);
        return { clips: [] };
      }

      const text = await resp.text();
      return this._parseNdjson(text);
    } catch (err) {
      console.warn('[KRE:Genie] search error:', err.message);
      return { clips: [] };
    }
  }

  /**
   * Parse NDJSON response from /assistant/converse.
   * Extracts clips from citation YAML blocks and the sources-tool segment.
   */
  _parseNdjson(text) {
    const lines = text.split('\n').filter(l => l.trim());
    const citations = [];   // { entry_id, start_time, end_time, type }
    const sources = {};     // entry_id → { title, type, duration }

    for (const line of lines) {
      let seg;
      try { seg = JSON.parse(line); } catch { continue; }

      if (seg.type !== 'unisphere-tool' || !seg.content) continue;

      // Parse sources-tool segment (final summary with titles)
      if (seg.metadata?.runtimeName === 'sources-tool') {
        this._parseSourcesYaml(seg.content, sources);
        continue;
      }

      // Parse citation clips from YAML blocks
      this._parseCitationYaml(seg.content, citations);
    }

    // Build clip list — merge citations with source metadata
    const seen = new Set();
    const clips = [];

    // Prefer video citations with timestamps over documents
    const sorted = citations
      .filter(c => c.entry_id && c.type !== 'DOCUMENT')
      .sort((a, b) => (b.end_time - b.start_time) - (a.end_time - a.start_time));

    for (const c of sorted) {
      const key = `${c.entry_id}:${c.start_time}:${c.end_time}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const src = sources[c.entry_id] || {};
      const startTime = c.start_time || 0;
      const endTime = c.end_time || 0;
      const thumbnailUrl = `https://www.kaltura.com/p/${this._partnerId}/thumbnail/entry_id/${c.entry_id}/vid_sec/${Math.max(startTime, 1)}/width/400/height/225`;

      clips.push({
        entryId: c.entry_id,
        text: src.title || '',
        title: src.title || c.entry_id,
        startTime,
        endTime,
        thumbnailUrl,
        type: src.type || c.type || 'video',
      });

      if (clips.length >= MAX_CLIPS) break;
    }

    // If we have fewer than MAX_CLIPS, add video sources not yet included
    if (clips.length < MAX_CLIPS) {
      for (const [entryId, src] of Object.entries(sources)) {
        if (clips.length >= MAX_CLIPS) break;
        if (src.type !== 'video') continue;
        if (seen.has(`${entryId}:0:0`)) continue;
        // Check if this entry is already in clips (any timestamp)
        if (clips.some(c => c.entryId === entryId)) continue;

        const thumbnailUrl = `https://www.kaltura.com/p/${this._partnerId}/thumbnail/entry_id/${entryId}/vid_sec/1/width/400/height/225`;
        clips.push({
          entryId,
          text: src.title,
          title: src.title,
          startTime: 0,
          endTime: 0,
          thumbnailUrl,
          type: 'video',
        });
      }
    }

    console.debug('[KRE:Genie] parsed', clips.length, 'clips from', citations.length, 'citations +', Object.keys(sources).length, 'sources');
    return { clips };
  }

  /** Extract citation clips from YAML-like content blocks */
  _parseCitationYaml(content, citations) {
    // Match entry_id, start_time, end_time, type from YAML blocks
    const clipBlocks = content.split('- start_index:');
    for (const block of clipBlocks) {
      const entryMatch = block.match(/entry_id:\s*(\S+)/);
      const startMatch = block.match(/start_time:\s*(\d+)/);
      const endMatch = block.match(/end_time:\s*(\d+)/);
      const typeMatch = block.match(/type:\s*(\S+)/);
      if (entryMatch) {
        citations.push({
          entry_id: entryMatch[1],
          start_time: parseInt(startMatch?.[1] || '0', 10),
          end_time: parseInt(endMatch?.[1] || '0', 10),
          type: typeMatch?.[1] || 'CAPTION',
        });
      }
    }
  }

  /** Parse the sources-tool YAML into a map of entry_id → metadata */
  _parseSourcesYaml(content, sources) {
    const entries = content.split(/^- /m).filter(e => e.includes('entry_id:'));
    for (const entry of entries) {
      const idMatch = entry.match(/entry_id:\s*(\S+)/);
      const titleMatch = entry.match(/title:\s*['"]?(.+?)['"]?\s*$/m);
      const typeMatch = entry.match(/type:\s*(\S+)/);
      const durMatch = entry.match(/duration:\s*(\d+)/);
      if (idMatch) {
        sources[idMatch[1]] = {
          title: (titleMatch?.[1] || '').replace(/^['"]|['"]$/g, ''),
          type: typeMatch?.[1] || 'video',
          duration: parseInt(durMatch?.[1] || '0', 10),
        };
      }
    }
  }
}
