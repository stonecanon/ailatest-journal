/**
 * OpenAlex API proxy — bypasses China's GFW for api.openalex.org
 *
 * Usage: /openalex/works?search=...&per_page=30&sort=...
 * Proxies to: https://api.openalex.org/works?search=...&per_page=30&sort=...
 */
export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);

  // Extract the path after /openalex/
  const path = url.pathname.replace(/^\/openalex\//, '') || '';

  // Build the upstream URL — pass through query params
  const upstreamUrl = `https://api.openalex.org/${path}${url.search}`;

  // Forward headers (Accept for JSON response)
  const headers = {
    'Accept': 'application/json',
    'User-Agent': 'AILatest/1.0 (mailto:support@ailatest.org)',
  };

  try {
    const resp = await fetch(upstreamUrl, { headers });
    const body = await resp.text();

    return new Response(body, {
      status: resp.status,
      headers: {
        'Content-Type': resp.headers.get('content-type') || 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=60, s-maxage=120',
      },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 502,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }
}
