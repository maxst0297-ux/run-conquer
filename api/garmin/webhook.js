/* ============================================================
   POST /api/garmin/webhook
   Garmin calls this automatically after every synced activity.
   Handles both delivery styles:
     • PUSH  — full activity (with GPS samples) in the body
     • PING  — only a callbackURL we must fetch (signed) to get data
   Writes the GPS track to Supabase, mapped to the right user.

   No HMAC on Garmin pings — security relies on the secret URL plus
   verifying the garmin user id maps to a known connection.
   ============================================================ */
import { signedFetch, sbSelect, sbUpsert } from './_lib.js';

export const config = { api: { bodyParser: true } };

function extractItems(body) {
  if (!body || typeof body !== 'object') return [];
  // Garmin nests activity payloads under various keys depending on tier
  return body.activityDetails || body.activities ||
         body.activityDetailsSummaries || body.activityDetailSummaries || [];
}

function buildTrack(samples) {
  if (!Array.isArray(samples)) return [];
  return samples
    .filter(s => s && s.latitudeInDegree != null && s.longitudeInDegree != null)
    .map(s => ({
      lat: s.latitudeInDegree,
      lng: s.longitudeInDegree,
      ele: s.elevationInMeters ?? null,
      time: s.startTimeInSeconds ?? null
    }));
}

export default async function handler(req, res) {
  if (req.method !== 'POST') { res.status(405).end(); return; }
  // Acknowledge fast; Garmin retries on non-200.
  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }

  const items = extractItems(body);
  let stored = 0;

  for (const item of items) {
    try {
      const garminUserId = item.userId || item.userAccessToken;
      if (!garminUserId) continue;

      const conn = await sbSelect('garmin_connections',
        `garmin_user_id=eq.${encodeURIComponent(garminUserId)}&select=user_id,access_token,access_secret`);
      if (!conn.length) continue;            // unknown / disconnected user
      const { user_id, access_token, access_secret } = conn[0];

      // get the detail: inline samples (PUSH) or fetch callbackURL (PING)
      let detail = item;
      if (!item.samples && item.callbackURL) {
        const r = await signedFetch('GET', item.callbackURL, {
          tokenSecret: access_secret, extra: { oauth_token: access_token }
        });
        if (!r.ok) { console.error('callbackURL fetch', r.status); continue; }
        const payload = await r.json();
        detail = (extractItems(payload)[0]) || payload;
      }

      const summary = detail.summary || detail;
      const track = buildTrack(detail.samples);
      const externalId = String(detail.activityId || detail.summaryId || summary.startTimeInSeconds);

      await sbUpsert('garmin_activities', {
        user_id,
        garmin_user_id: garminUserId,
        external_id: externalId,
        activity_type: summary.activityType || null,
        start_time: summary.startTimeInSeconds
          ? new Date(summary.startTimeInSeconds * 1000).toISOString() : null,
        duration_seconds: summary.durationInSeconds ?? null,
        distance_meters: summary.distanceInMeters ?? null,
        track,
        created_at: new Date().toISOString()
      }, 'user_id,external_id');
      stored++;
    } catch (e) {
      console.error('webhook item error', e);  // keep processing the rest
    }
  }

  res.status(200).json({ received: items.length, stored });
}
