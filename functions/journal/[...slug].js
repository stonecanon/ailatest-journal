export async function onRequest(ctx) {
  const url = new URL(ctx.request.url);
  return new Response('pages func works! params=' + JSON.stringify(ctx.params) + ' path=' + url.pathname, {
    headers: { 'Content-Type': 'text/plain' }
  });
}
