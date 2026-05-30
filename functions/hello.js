export async function onRequest(ctx) {
  return new Response('Function works! URL: ' + ctx.request.url, {
    headers: { 'Content-Type': 'text/plain' }
  });
}
