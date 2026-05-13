export async function onRequest({ request, params }) {
  const sourceUrl = new URL(request.url);
  const path = Array.isArray(params.path)
    ? params.path.join('/')
    : (params.path || '');
  const targetUrl = new URL(`https://api.ailatest.org/${path}`);
  targetUrl.search = sourceUrl.search;

  const headers = new Headers(request.headers);
  headers.delete('host');

  return fetch(new Request(targetUrl.toString(), {
    method: request.method,
    headers,
    body: request.body,
    redirect: 'manual',
  }));
}
