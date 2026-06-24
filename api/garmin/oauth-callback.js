/* ============================================================
   GET /api/garmin/oauth-callback?oauth_token=…&oauth_verifier=…
   Step 2 of the Garmin OAuth 1.0a flow:
     • exchange the request token for a long-lived access token
     • look up the Garmin user id
     • store the connection (garmin user ↔ supabase user) + tokens
     • redirect back into the app
   ============================================================ */
import { signedFetch, sbSelect, sbUpsert, sbDelete, env } from './_lib.js';

const ACCESS_TOKEN_URL = 'https://connectapi.garmin.com/oauth-service/oauth/access_token';
const USER_ID_URL = 'https://apis.garmin.com/wellness-api/rest/user/id';

export default async function handler(req, res) {
  const appUrl = process.env.APP_URL || '/';
  try {
    const { oauth_token: reqToken, oauth_verifier: verifier } = req.query;
    if (!reqToken || !verifier) return res.redirect(`${appUrl}?garmin=error`);

    // recover the pending request-token secret + user id
    const pending = await sbSelect('garmin_oauth_pending',
      `request_token=eq.${encodeURIComponent(reqToken)}&select=request_secret,user_id`);
    if (!pending.length) return res.redirect(`${appUrl}?garmin=expired`);
    const { request_secret: reqSecret, user_id: userId } = pending[0];

    // exchange for the access token
    const r = await signedFetch('POST', ACCESS_TOKEN_URL, {
      tokenSecret: reqSecret,
      extra: { oauth_token: reqToken, oauth_verifier: verifier }
    });
    if (!r.ok) {
      console.error('access_token failed', r.status, await r.text());
      return res.redirect(`${appUrl}?garmin=error`);
    }
    const params = new URLSearchParams(await r.text());
    const accToken = params.get('oauth_token');
    const accSecret = params.get('oauth_token_secret');
    if (!accToken || !accSecret) return res.redirect(`${appUrl}?garmin=error`);

    // fetch the Garmin user id (so webhooks can map back to this account)
    const uidRes = await signedFetch('GET', USER_ID_URL, {
      tokenSecret: accSecret,
      extra: { oauth_token: accToken }
    });
    let garminUserId = null;
    if (uidRes.ok) {
      try { garminUserId = (await uidRes.json()).userId; } catch { /* ignore */ }
    }
    if (!garminUserId) {
      console.error('user/id failed', uidRes.status);
      return res.redirect(`${appUrl}?garmin=error`);
    }

    // persist the connection
    await sbUpsert('garmin_connections', {
      user_id: userId,
      garmin_user_id: garminUserId,
      access_token: accToken,
      access_secret: accSecret,
      connected_at: new Date().toISOString()
    }, 'garmin_user_id');

    // tidy up the pending row
    try { await sbDelete('garmin_oauth_pending', `request_token=eq.${encodeURIComponent(reqToken)}`); } catch {}

    res.redirect(`${appUrl}?garmin=connected`);
  } catch (e) {
    console.error('oauth-callback error', e);
    res.redirect(`${appUrl}?garmin=error`);
  }
}
