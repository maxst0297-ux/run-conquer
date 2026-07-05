/* ============================================================
   POST /api/garmin/webhook
   Handles Activity API (GPS tracks) and Health API (dailies, sleep).
   Both PUSH (inline data) and PING (callbackURL) delivery styles.
   ============================================================ */
import { signedFetch, sbSelect, sbUpsert } from './_lib.js';

export const config = { api: { bodyParser: true } };

function extractItems(body) {
  if (!body || typeof body !== 'object') return [];
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

async function resolveUserId(garminUserId) {
  const conn = await sbSelect('garmin_connections',
    `garmin_user_id=eq.${encodeURIComponent(garminUserId)}&select=user_id,access_token,access_secret`);
  return conn.length ? conn[0] : null;
}

async function processActivities(body) {
  const items = extractItems(body);
  let stored = 0;
  for (const item of items) {
    try {
      const garminUserId = item.userId || item.userAccessToken;
      if (!garminUserId) continue;
      const conn = await resolveUserId(garminUserId);
      if (!conn) continue;
      const { user_id, access_token, access_secret } = conn;

      let detail = item;
      if (!item.samples && item.callbackURL) {
        /* Nur Garmin-eigene Hosts abrufen — verhindert SSRF über gefälschte
           Webhook-Payloads mit beliebiger callbackURL. */
        let cbHost = '';
        try { cbHost = new URL(item.callbackURL).hostname; } catch { /* invalid URL */ }
        if (!/(^|\.)garmin\.com$/i.test(cbHost)) { console.warn('webhook: callbackURL-Host abgelehnt:', cbHost); continue; }
        const r = await signedFetch('GET', item.callbackURL,
          { tokenSecret: access_secret, extra: { oauth_token: access_token } });
        if (!r.ok) continue;
        const payload = await r.json();
        detail = (extractItems(payload)[0]) || payload;
      }

      const summary = detail.summary || detail;
      const track = buildTrack(detail.samples);
      const externalId = String(detail.activityId || detail.summaryId || summary.startTimeInSeconds);

      await sbUpsert('garmin_activities', {
        user_id, garmin_user_id: garminUserId, external_id: externalId,
        activity_type: summary.activityType || null,
        start_time: summary.startTimeInSeconds
          ? new Date(summary.startTimeInSeconds * 1000).toISOString() : null,
        duration_seconds: summary.durationInSeconds ?? null,
        distance_meters: summary.distanceInMeters ?? null,
        track, created_at: new Date().toISOString()
      }, 'user_id,external_id');
      stored++;
    } catch (e) { console.error('activity webhook error', e); }
  }
  return stored;
}

async function processDailies(body) {
  const items = body.dailies || [];
  let stored = 0;
  for (const d of items) {
    try {
      const garminUserId = d.userId || d.userAccessToken;
      if (!garminUserId) continue;
      const conn = await resolveUserId(garminUserId);
      if (!conn) continue;

      const date = d.calendarDateLocal || (d.startTimeInSeconds
        ? new Date(d.startTimeInSeconds * 1000).toISOString().slice(0, 10) : null);
      if (!date) continue;

      await sbUpsert('garmin_health_summaries', {
        user_id: conn.user_id,
        garmin_user_id: garminUserId,
        summary_date: date,
        steps: d.steps ?? null,
        distance_meters: d.distanceInMeters ?? null,
        active_calories: d.activeKilocalories ?? null,
        total_calories: d.bmrKilocalories != null && d.activeKilocalories != null
          ? d.bmrKilocalories + d.activeKilocalories : null,
        avg_stress: d.averageStressLevel ?? null,
        resting_hr: d.restingHeartRateInBeatsPerMinute ?? null,
        max_hr: d.maxHeartRateInBeatsPerMinute ?? null,
      }, 'user_id,summary_date');
      stored++;
    } catch (e) { console.error('dailies webhook error', e); }
  }
  return stored;
}

async function processSleeps(body) {
  const items = body.sleeps || [];
  let stored = 0;
  for (const s of items) {
    try {
      const garminUserId = s.userId || s.userAccessToken;
      if (!garminUserId) continue;
      const conn = await resolveUserId(garminUserId);
      if (!conn) continue;

      const date = s.calendarDateLocal || (s.startTimeInSeconds
        ? new Date(s.startTimeInSeconds * 1000).toISOString().slice(0, 10) : null);
      if (!date) continue;

      await sbUpsert('garmin_health_summaries', {
        user_id: conn.user_id,
        garmin_user_id: garminUserId,
        summary_date: date,
        sleep_seconds: s.durationInSeconds ?? null,
        deep_sleep_secs: s.deepSleepDurationInSeconds ?? null,
        rem_sleep_secs: s.remSleepInSeconds ?? null,
      }, 'user_id,summary_date');
      stored++;
    } catch (e) { console.error('sleeps webhook error', e); }
  }
  return stored;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') { res.status(405).end(); return; }
  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }

  const [acts, dailies, sleeps] = await Promise.all([
    processActivities(body),
    processDailies(body),
    processSleeps(body),
  ]);

  res.status(200).json({ activities: acts, dailies, sleeps });
}
