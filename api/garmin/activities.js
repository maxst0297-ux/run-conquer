/* ============================================================
   GET /api/garmin/activities?token=<supabase access token>&since=<ISO>
   Returns the caller's Garmin connection status + recent activities
   (with GPS tracks) so the app can draw them on the map.
   ============================================================ */
import { sbSelect, userIdFromJwt, hasGarminKeys } from './_lib.js';

export default async function handler(req, res) {
  try {
    const userId = await userIdFromJwt(req.query.token);
    if (!userId) return res.status(401).json({ error: 'unauthorized' });

    const conn = await sbSelect('garmin_connections',
      `user_id=eq.${userId}&select=garmin_user_id,connected_at`);
    const connected = conn.length > 0;

    let activities = [];
    if (connected) {
      let q = `user_id=eq.${userId}&select=external_id,activity_type,start_time,` +
              `duration_seconds,distance_meters,track&order=start_time.desc&limit=50`;
      if (req.query.since) q += `&start_time=gt.${encodeURIComponent(req.query.since)}`;
      activities = await sbSelect('garmin_activities', q);
    }

    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({ configured: hasGarminKeys(), connected, activities });
  } catch (e) {
    console.error('activities error', e);
    res.status(500).json({ error: 'server' });
  }
}
