/* ============================================================
   POST /api/garmin/disconnect?token=<supabase access token>
   Removes the user's Garmin connection. (Activities are kept.)
   ============================================================ */
import { sbSelect, sbDelete, signedFetch, userIdFromJwt } from './_lib.js';

const DEREGISTER_URL = 'https://apis.garmin.com/wellness-api/rest/user/registration';

export default async function handler(req, res) {
  if (req.method !== 'POST') { res.status(405).end(); return; }
  try {
    const userId = await userIdFromJwt(req.query.token);
    if (!userId) return res.status(401).json({ error: 'unauthorized' });

    const conn = await sbSelect('garmin_connections',
      `user_id=eq.${userId}&select=garmin_user_id,access_token,access_secret`);

    // best-effort deregister with Garmin so they stop sending pings
    if (conn.length) {
      try {
        await signedFetch('DELETE', DEREGISTER_URL, {
          tokenSecret: conn[0].access_secret, extra: { oauth_token: conn[0].access_token }
        });
      } catch (e) { console.warn('garmin deregister failed', e); }
    }

    await sbDelete('garmin_connections', `user_id=eq.${userId}`);
    res.status(200).json({ ok: true });
  } catch (e) {
    console.error('disconnect error', e);
    res.status(500).json({ error: 'server' });
  }
}
