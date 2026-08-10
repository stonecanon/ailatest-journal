/**
 * Return only the visitor's country code for the language bootstrap.
 * Cloudflare Pages exposes the country on request.cf; CF-IPCountry is kept
 * as a fallback for local/proxied deployments. The response is deliberately
 * uncacheable so one visitor's language can never be served to another.
 */
export async function onRequest({ request }) {
  const raw = request?.cf?.country || request?.headers?.get('CF-IPCountry') || '';
  const country = String(raw).trim().toUpperCase();
  const safeCountry = /^[A-Z]{2}$/.test(country) ? country : '';

  return new Response(JSON.stringify({
    country: safeCountry,
    language: safeCountry === 'CN' ? 'zh-CN' : 'en',
  }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
      'Pragma': 'no-cache',
      'Vary': 'CF-IPCountry',
    },
  });
}
