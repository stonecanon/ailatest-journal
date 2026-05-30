export async function onRequest(ctx) {
  const url = new URL(ctx.request.url);
  const path = url.pathname;
  if (path.startsWith('/journal/')) {
    return new Response('CATCHALL: path=' + path + ' params=' + JSON.stringify(ctx.params), {
      headers: { 'Content-Type': 'text/plain' }
    });
  }
  // Pass through to static assets for non-journal routes
  return ctx.env.ASSETS.fetch(ctx.request);
}
