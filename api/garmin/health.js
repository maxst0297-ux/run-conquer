/* ============================================================
   GET /api/garmin/health?token=<supabase access token>&days=<n>
   Returns last N days of Garmin Health summaries (steps, HR, sleep…)
   ============================================================ */
import { sbSelect, userIdFromJwt } from './_lib.js';

export default async function handler(req, res) {
  try {
    const userId = await userIdFromJwt(req.query.token);
    if (!userId) return res.status(401).json({ error: 'unauthorized' });

    const days = Math.min(Math.max(parseInt(req.query.days) || 7, 1), 30);
    const since = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);

    const data = await sbSelect('garmin_health_summaries',
      `user_id=eq.${userId}&summary_date=gte.${since}&order=summary_date.desc` +
      `&select=summary_date,steps,distance_meters,active_calories,total_calories,` +
      `avg_stress,resting_hr,max_hr,sleep_seconds,deep_sleep_secs,rem_sleep_secs`);

    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({ data });
  } catch (e) {
    console.error('health error', e);
    res.status(500).json({ error: 'server' });
  }
}
