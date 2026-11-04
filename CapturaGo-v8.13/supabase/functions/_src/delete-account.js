// ── delete-account: a signed-in user permanently deletes their own account ──
// Required by the App Store (5.1.1(v)) and Google Play, and a GDPR right (Art. 17).
// Body: { confirm: "DELETE" }
// Refused while money is in flight (paid / confirmed / delivered / disputed bookings).
// Deletes: their reviews, their listing (+ inquiries and favourites via cascade),
// their uploaded photos and the login itself. Keeps booking records (accounting law),
// with the account link removed automatically (ON DELETE SET NULL).
const ACTIVE = ['paid', 'confirmed', 'delivered', 'disputed'];
const BUCKET = 'photographer-covers';

async function deleteUserFiles(ctx, deps, userId) {
  const base = String(ctx.env('SUPABASE_URL', '')).replace(/\/$/, '');
  const key = ctx.env('SUPABASE_SERVICE_ROLE_KEY', '');
  const headers = { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
  const list = await deps.fetch(`${base}/storage/v1/object/list/${BUCKET}`, {
    method: 'POST', headers, body: JSON.stringify({ prefix: userId, limit: 1000, offset: 0 }),
  });
  if (!list.ok) throw new Error(`Could not list your photos (${list.status}).`);
  const files = (await list.json()) || [];
  const paths = files.filter((f) => f && f.name).map((f) => `${userId}/${f.name}`);
  if (!paths.length) return 0;
  const del = await deps.fetch(`${base}/storage/v1/object/${BUCKET}`, {
    method: 'DELETE', headers, body: JSON.stringify({ prefixes: paths }),
  });
  if (!del.ok) throw new Error(`Could not delete your photos (${del.status}).`);
  return paths.length;
}

function createHandler(deps) {
  const ctx = makeCtx(deps);
  return wrap(async (req) => {
    const user = await ctx.getUser(req);
    const body = await readJson(req);
    if (body.confirm !== 'DELETE') throw new HttpError(400, 'Type DELETE to confirm.');

    const active = await ctx.db(`bookings?or=(client_user_id.eq.${user.id},creator_user_id.eq.${user.id})&status=in.(${ACTIVE.join(',')})&select=id&limit=1`);
    if (active.length) throw new HttpError(409, 'You have an active booking. Complete or cancel it first, then delete your account.');

    // Photos delivered TO this person are deleted with their account (photos they delivered as a creator stay with their clients)
    const mine = await ctx.db(`bookings?client_user_id=eq.${user.id}&select=id&limit=5000`);
    await purgeBookingPhotos(ctx, deps, (mine || []).map((b) => b.id));

    // Unpaid checkouts can't be paid any more (a late payment is auto-refunded by the webhook)
    await ctx.db(`bookings?client_user_id=eq.${user.id}&status=eq.pending_payment`, { method: 'PATCH', body: { status: 'cancelled' }, prefer: 'return=minimal' });

    await ctx.db(`reviews?user_id=eq.${user.id}`, { method: 'DELETE', prefer: 'return=minimal' });
    try {
      await ctx.db(`photographers?user_id=eq.${user.id}`, { method: 'DELETE', prefer: 'return=minimal' });
    } catch (e) {
      if (/active bookings/i.test(e.message || '')) throw new HttpError(409, 'You have an active booking. Complete or cancel it first, then delete your account.');
      throw e;
    }
    await deleteUserFiles(ctx, deps, user.id);

    const base = String(ctx.env('SUPABASE_URL', '')).replace(/\/$/, '');
    const key = ctx.env('SUPABASE_SERVICE_ROLE_KEY', '');
    const r = await deps.fetch(`${base}/auth/v1/admin/users/${user.id}`, {
      method: 'DELETE', headers: { apikey: key, Authorization: `Bearer ${key}` },
    });
    if (!r.ok) {
      console.error('[delete-account] auth delete failed', r.status, await r.text().catch(() => ''));
      throw new HttpError(500, 'Your data was removed, but the login could not be deleted. Please email hello@capturago.com and we will finish it.');
    }
    return json({ deleted: true });
  });
}

startServer(createHandler);
