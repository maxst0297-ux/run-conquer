/* ============================================================
   Garmin integration — shared helpers (no external deps)
   ------------------------------------------------------------
   • OAuth 1.0a (HMAC-SHA1) signing with Node's built-in crypto
   • Supabase access via the PostgREST endpoint (raw fetch)

   Files in /api starting with "_" are NOT exposed as routes,
   so this is a private helper module.

   Required Vercel environment variables:
     GARMIN_CONSUMER_KEY
     GARMIN_CONSUMER_SECRET
     SUPABASE_URL                  e.g. https://xxxx.supabase.co
     SUPABASE_SERVICE_ROLE_KEY     (server-only secret!)
     APP_URL                       e.g. https://run-conquer.vercel.app
   ============================================================ */
import crypto from 'crypto';

export function env(name) {
  const v = process.env[name];
  if (!v) throw new Error('Missing env var: ' + name);
  return v;
}
export function hasGarminKeys() {
  return !!(process.env.GARMIN_CONSUMER_KEY && process.env.GARMIN_CONSUMER_SECRET);
}

/* RFC-3986 percent encoding (stricter than encodeURIComponent) */
function enc(s) {
  return encodeURIComponent(String(s))
    .replace(/[!*'()]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase());
}

/* Build an OAuth 1.0a Authorization header and return it as a string.
   `extra` may contain oauth_callback / oauth_verifier / oauth_token. */
export function oauthHeader(method, fullUrl, { tokenSecret = '', extra = {} } = {}) {
  const url = new URL(fullUrl);
  const baseUrl = url.origin + url.pathname;

  const oauth = {
    oauth_consumer_key: env('GARMIN_CONSUMER_KEY'),
    oauth_nonce: crypto.randomBytes(16).toString('hex'),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_version: '1.0',
    ...extra
  };

  // signature base must include query-string params too
  const allParams = { ...oauth };
  url.searchParams.forEach((val, key) => { allParams[key] = val; });

  const paramString = Object.keys(allParams).sort()
    .map(k => enc(k) + '=' + enc(allParams[k]))
    .join('&');

  const baseString = [method.toUpperCase(), enc(baseUrl), enc(paramString)].join('&');
  const signingKey = enc(env('GARMIN_CONSUMER_SECRET')) + '&' + enc(tokenSecret);
  const signature = crypto.createHmac('sha1', signingKey).update(baseString).digest('base64');

  oauth.oauth_signature = signature;

  // header contains only oauth_* params
  const header = 'OAuth ' + Object.keys(oauth).sort()
    .map(k => enc(k) + '="' + enc(oauth[k]) + '"')
    .join(', ');
  return header;
}

/* Perform an OAuth-1.0a-signed request to Garmin. */
export async function signedFetch(method, fullUrl, { tokenSecret = '', extra = {}, headers = {} } = {}) {
  const auth = oauthHeader(method, fullUrl, { tokenSecret, extra });
  return fetch(fullUrl, { method, headers: { ...headers, Authorization: auth } });
}

/* ── Supabase (PostgREST) helpers — service role, server only ── */
function sbHeaders(extra = {}) {
  const key = env('SUPABASE_SERVICE_ROLE_KEY');
  return { apikey: key, Authorization: 'Bearer ' + key, 'Content-Type': 'application/json', ...extra };
}
export async function sbSelect(table, query = '') {
  const url = `${env('SUPABASE_URL')}/rest/v1/${table}${query ? '?' + query : ''}`;
  const r = await fetch(url, { headers: sbHeaders() });
  if (!r.ok) throw new Error('Supabase select failed: ' + r.status + ' ' + await r.text());
  return r.json();
}
export async function sbUpsert(table, rows, onConflict) {
  const url = `${env('SUPABASE_URL')}/rest/v1/${table}` + (onConflict ? `?on_conflict=${onConflict}` : '');
  const r = await fetch(url, {
    method: 'POST',
    headers: sbHeaders({ Prefer: 'resolution=merge-duplicates,return=minimal' }),
    body: JSON.stringify(Array.isArray(rows) ? rows : [rows])
  });
  if (!r.ok) throw new Error('Supabase upsert failed: ' + r.status + ' ' + await r.text());
  return true;
}
export async function sbDelete(table, query) {
  const url = `${env('SUPABASE_URL')}/rest/v1/${table}?${query}`;
  const r = await fetch(url, { method: 'DELETE', headers: sbHeaders({ Prefer: 'return=minimal' }) });
  if (!r.ok) throw new Error('Supabase delete failed: ' + r.status + ' ' + await r.text());
  return true;
}

/* Validate a Supabase user JWT (sent from the browser) and return the user id. */
export async function userIdFromJwt(accessToken) {
  if (!accessToken) return null;
  const r = await fetch(`${env('SUPABASE_URL')}/auth/v1/user`, {
    headers: { apikey: env('SUPABASE_SERVICE_ROLE_KEY'), Authorization: 'Bearer ' + accessToken }
  });
  if (!r.ok) return null;
  const u = await r.json();
  return u?.id || null;
}
