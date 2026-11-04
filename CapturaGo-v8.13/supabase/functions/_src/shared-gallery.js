// ── shared-gallery: view-only gallery for friends (link created by the traveller, expires) ──
// Deploy WITHOUT JWT verification (visitors aren't signed in). The 64-character random token is the key.
// Body: { token }. Returns temporary (1 hour) links to the photos — never names, emails or booking details.
const TOKEN_RE = /^[0-9a-f]{64}$/;

function createHandler(deps) {
  const ctx = makeCtx(deps);
  return wrap(async (req) => {
    const body = await readJson(req);
    const token = String(body.token || '').toLowerCase();
    const gone = new HttpError(404, 'This link has expired or was turned off. Ask for a new one.');
    if (!TOKEN_RE.test(token)) throw gone;
    const [share] = await ctx.db(`gallery_shares?token=eq.${token}&select=booking_id,expires_at,favorites_only,views`);
    if (!share || Date.parse(share.expires_at) <= ctx.nowMs()) throw gone;
    const [b] = await ctx.db(`bookings?id=eq.${share.booking_id}&select=id,photographer_id,status,booking_type,photos_ready_at,revisions_used,package_name,shoot_date,photographers(name,city,handle)`);
    if (!b) throw gone;
    const visible = b.booking_type === 'delivery'
      ? (b.status === 'delivered' || b.status === 'completed' || (b.revisions_used || 0) > 0)
      : (!!b.photos_ready_at || b.status === 'completed');
    if (!visible) throw gone;
    const fav = share.favorites_only ? '&favorite=is.true' : '';
    let rows;
    try {
      // Extra photos that are for sale and not bought yet are not shown to friends (PART 24)
      const [sale] = await ctx.db(`bookings?id=eq.${b.id}&select=extra_photo_cents`);
      const all = await ctx.db(`booking_photos?booking_id=eq.${b.id}${fav}&select=path,width,height,extra,unlocked_at&order=created_at.asc&limit=300`);
      rows = (all || []).filter((p) => !(sale && sale.extra_photo_cents && p.extra && !p.unlocked_at));
    } catch (e) {
      if (!/extra|unlocked_at|42703/.test(String(e && e.message))) throw e;   // database update not run yet
      rows = await ctx.db(`booking_photos?booking_id=eq.${b.id}${fav}&select=path,width,height&order=created_at.asc&limit=300`);
    }
    if (!rows || !rows.length) throw gone;
    const paths = rows.flatMap((p) => { const [dir, file] = p.path.split('/'); return [p.path, `${dir}/t_${file}`]; });
    const urls = await signDeliveryUrls(ctx, deps, paths, 3600);
    const photos = rows.map((p) => {
      const [dir, file] = p.path.split('/');
      const full = urls[p.path];
      return full ? { full, thumb: urls[`${dir}/t_${file}`] || full, w: p.width, h: p.height } : null;
    }).filter(Boolean);
    if (!photos.length) throw gone;
    await ctx.db(`gallery_shares?token=eq.${token}`, { method: 'PATCH', body: { views: (share.views || 0) + 1 }, prefer: 'return=minimal' }).catch(() => {});
    const c = b.photographers || {};
    return json({
      title: b.package_name || 'Photos',
      date: b.booking_type === 'delivery' ? null : b.shoot_date,
      // Friends who like the photos can book the same creator: the personal link also gives them the lower service fee
      creator: c.name ? { name: c.name, city: c.city || '', link: c.handle ? `${ctx.siteUrl}/c/${c.handle}` : (b.photographer_id ? `${ctx.siteUrl}/?creator=${b.photographer_id}` : null) } : null,
      expires_at: share.expires_at,
      favorites_only: !!share.favorites_only,
      photos,
    });
  });
}

startServer(createHandler);
