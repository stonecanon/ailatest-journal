export async function onRequest(ctx) {
  return new Response('Hello from Pages Function! slug param works: ' + JSON.stringify(ctx.params), {
    headers: { 'Content-Type': 'text/plain' }
  });
}
