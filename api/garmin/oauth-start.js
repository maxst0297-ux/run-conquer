/* ============================================================
   GET /api/garmin/oauth-start?token=<supabase access token>
   Step 1 of the Garmin OAuth 1.0a flow:
     • get a request token from Garmin
     • stash its secret (keyed by request token) against the user
     • redirect the user to Garmin's consent screen
   ============================================================ */
import { signedFetch, sbUpsert, userIdFromJwt, hasGarminKeys, env } from './_lib.js';

const REQUEST_TOKEN_URL = 'https://connectapi.garmin.com/oauth-service/oauth/request_token';
const CONFIRM_URL = 'https://connect.garmin.com/oauthConfirm';

export default async function handler(req, res) {
  try {
    if (!hasGarminKeys()) {
      return res.status(503).send('Garmin ist noch nicht konfiguriert (API-Keys fehlen).');
    }
    const accessToken = req.query.token;
    const userId = await userIdFromJwt(accessToken);
    if (!userId) return res.status(401).send('Nicht eingeloggt.');

    const callback = `${env('APP_URL')}/api/garmin/oauth-callback`;

    // request token (oauth_callback passed as a signed param)
    const r = await signedFetch('POST', REQUEST_TOKEN_URL, { extra: { oauth_callback: callback } });
    if (!r.ok) {
      console.error('request_token failed', r.status, await r.text());
      return res.status(502).send('Garmin-Verbindung fehlgeschlagen (request token).');
    }
    const params = new URLSearchParams(await r.text());
    const reqToken = params.get('oauth_token');
    const reqSecret = params.get('oauth_token_secret');
    if (!reqToken || !reqSecret) return res.status(502).send('Ungültige Antwort von Garmin.');

    // stash pending request token → user mapping (so the callback can finish)
    await sbUpsert('garmin_oauth_pending', {
      request_token: reqToken,
      request_secret: reqSecret,
      user_id: userId,
      created_at: new Date().toISOString()
    }, 'request_token');

    // send the user to Garmin's consent page
    const confirm = `${CONFIRM_URL}?oauth_token=${encodeURIComponent(reqToken)}` +
      `&oauth_callback=${encodeURIComponent(callback)}`;
    res.writeHead(302, { Location: confirm });
    res.end();
  } catch (e) {
    console.error('oauth-start error', e);
    res.status(500).send('Serverfehler.');
  }
}
