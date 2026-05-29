/**
 * Proxy OpenAlex API calls via journal.ailatest.org
 * Avoids ad-blockers that block api.openalex.org directly.
 *
 * Usage: /api/openalex/works?search=xxx&per_page=200
 *   → https://api.openalex.org/works?search=xxx&per_page=200
 */
export async function onRequest({ request, params }) {
  const url = new URL(request.url);
  const path = Array.isArray(params.path)
    ? params.path.join('/')
    : (params.path || '');

  const targetUrl = new URL(`https://api.openalex.org/${path}`);
  targetUrl.search = url.search;

  const headers = new Headers(request.headers);
  headers.delete('host');

  const resp = await fetch(new Request(targetUrl.toString(), {
    method: request.method,
    headers,
    body: request.body,
    redirect: 'manual',
  }));

  // Clone to make headers mutable (needed for CORS)
  const respHeaders = new Headers(resp.headers);

  return new Response(resp.body, {
    status: resp.status,
    statusText: resp.statusText,
    headers: respHeaders,
  });
}
