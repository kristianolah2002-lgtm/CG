// ── calendar: calendar sync ──
// Deploy WITHOUT JWT verification (calendar apps can't sign in); the feed link itself is the key.
//  GET  ?t=<private link id>    → your CapturaGo bookings as an .ics calendar (Google, Apple, Outlook subscribe to it)
//  POST { action: 'sync' }      → (signed in) read your own calendar's busy days now
const FEED_STATUSES = 'paid,confirmed,delivered,completed,disputed';

function createHandler(deps) {
  const ctx = makeCtx(deps);
  const post = wrap(async (req) => {
    const user = await ctx.getUser(req);
    const body = await readJson(req);
    if (body.action !== 'sync') throw new HttpError(400, 'Unknown action.');
    const [row] = await ctx.db(`calendar_imports?user_id=eq.${user.id}&select=user_id,url,last_synced_at`);
    if (!row) throw new HttpError(404, 'Connect your calendar first.');
    if (row.last_synced_at && ctx.nowMs() - Date.parse(row.last_synced_at) < 60000) throw new HttpError(429, 'Synced a moment ago — try again in a minute.');
    const out = await syncCalendarImport(ctx, deps, row);
    if (out.skipped) throw new HttpError(409, 'Your calendar link was just changed. Please try again.');
    return json(out);
  });
  return async (req) => {
    if (req.method === 'GET' || req.method === 'HEAD') {
      const text = (status, msg) => new Response(req.method === 'HEAD' ? null : msg, { status, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' } });
      try {
        const t = new URL(req.url).searchParams.get('t') || '';
        if (!UUID_RE.test(t)) return text(404, 'Calendar not found.');
        const [feed] = await ctx.db(`calendar_feeds?token=eq.${t}&select=user_id`);
        if (!feed) return text(404, 'Calendar not found. Copy your calendar link again from CapturaGo.');
        const uid = feed.user_id;
        const rows = await ctx.db(`bookings?or=(client_user_id.eq.${uid},creator_user_id.eq.${uid})&status=in.(${FEED_STATUSES})`
          + `&shoot_date=gte.${ctx.isoInDays(-60)}&shoot_date=lte.${ctx.isoInDays(400)}`
          + '&select=id,creator_user_id,client_user_id,client_name,package_name,shoot_date,status,booking_type,time_slot,meeting_point,meeting_time,surprise,shoot_city,photographers(name,city)'
          + '&order=shoot_date.asc&limit=500');
        const ics = buildIcsFeed(rows, uid, ctx.siteUrl, ctx.nowMs());
        return new Response(req.method === 'HEAD' ? null : ics, { status: 200, headers: { 'Content-Type': 'text/calendar; charset=utf-8', 'Content-Disposition': 'inline; filename="capturago.ics"',
          'Cache-Control': 'private, max-age=900', 'X-Robots-Tag': 'noindex' } });
      } catch (e) {
        console.error('[calendar feed]', e);
        return text(500, 'The calendar is not available right now.');
      }
    }
    return post(req);
  };
}

startServer(createHandler);
