export async function onRequest(ctx) {
  return new Response('slug=' + JSON.stringify(ctx.params.slug) + ' url=' + ctx.request.url, {
    headers: { 'Content-Type': 'text/plain' }
  });
}
