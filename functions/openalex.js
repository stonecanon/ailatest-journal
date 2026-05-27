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

  const apiUrl = `https://api.openalex.org/works?${qs}&mailto=jiantaoweng@gmail.com`;

  try {
    const resp = await fetch(apiUrl, {
      headers: { 'Accept': 'application/json' },
    });

    const body = await resp.text();

    return new Response(body, {
      status: resp.status,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=60',
      },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
