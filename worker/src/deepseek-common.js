/**
 * Shared helpers for DeepSeek-backed endpoints (/chat, /pick):
 * CORS, JSON responses, the DeepSeek client and the journal-data loader.
 */

const DEEPSEEK_BASE = 'https://api.deepseek.com/v1';
const DEFAULT_JOURNALS_URL = 'https://journal.ailatest.org/data/journals.json.gz';

export const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type, X-AJ-Install',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}

export async function deepseekChat(apiKey, messages, opts = {}) {
  const body = {
    model: opts.model || 'deepseek-chat',
    messages,
    temperature: opts.temperature ?? 0.1,
  };
  if (opts.maxTokens) body.max_tokens = opts.maxTokens;
  if (opts.tools) {
    body.tools = opts.tools;
    body.tool_choice = opts.toolChoice || 'auto';
  }
  if (opts.jsonOutput) body.response_format = { type: 'json_object' };

  const res = await fetch(`${DEEPSEEK_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // trim: a secret pasted with a stray newline/space must not break auth
      'Authorization': `Bearer ${String(apiKey || '').trim()}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`DeepSeek ${res.status}: ${(await res.text()).slice(0, 240)}`);
  }
  return res.json();
}

let journalsCache = null;
let journalsLoadPromise = null;

export async function loadJournals(env) {
  if (journalsCache) return journalsCache;
  if (!journalsLoadPromise) {
    journalsLoadPromise = (async () => {
      const url = env.JOURNALS_URL || DEFAULT_JOURNALS_URL;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`journal data ${res.status}`);
      const text = await new Response(res.body.pipeThrough(new DecompressionStream('gzip'))).text();
      const data = JSON.parse(text);
      if (!Array.isArray(data)) throw new Error('journal data is not an array');
      journalsCache = data;
      return journalsCache;
    })().catch(e => {
      journalsLoadPromise = null; // allow retry on next request
      throw e;
    });
  }
  return journalsLoadPromise;
}
