/**
 * AILatest Journal — OpenAlex API proxy
 *
 * Proxies /openalex?search=... requests to api.openalex.org.
 * Runs as a Cloudflare Pages Function — deployed with git push.
 * Required because api.openalex.org may be inaccessible from user browsers in China.
 */
export async function onRequest({ request }) {
  const url = new URL(request.url);
  const qs = url.search.slice(1); // remove leading '?'

  if (!qs) {
    return new Response(JSON.stringify({ error: 'missing query' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const targetParams = new URLSearchParams(qs);
  if (!targetParams.has('mailto')) targetParams.set('mailto', 'support@ailatest.org');
  const apiUrl = `https://api.openalex.org/works?${targetParams.toString()}`;
  const cache = caches.default;
  const cacheKey = new Request(apiUrl, request);

  if (request.method === 'GET') {
    const cached = await cache.match(cacheKey);
    if (cached) {
      const headers = new Headers(cached.headers);
      headers.set('X-OpenAlex-Cache', 'HIT');
      return new Response(cached.body, {
        status: cached.status,
        statusText: cached.statusText,
        headers,
      });
    }
  }

  try {
    const resp = await fetch(apiUrl, {
      headers: { 'Accept': 'application/json' },
    });

    const body = await resp.text();
    const proxyResp = new Response(body, {
      status: resp.status,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': resp.ok ? 'public, max-age=300' : 'no-store',
        'X-OpenAlex-Cache': 'MISS',
      },
    });

    if (request.method === 'GET' && resp.ok) {
      await cache.put(cacheKey, proxyResp.clone());
    }

    return proxyResp;
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 502,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
      },
    });
  }
}
