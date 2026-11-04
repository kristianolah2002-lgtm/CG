// ── push: "New message from …" on the other person's phone, right after a chat message is sent ──
// Deploy WITH JWT verification. Called by the sender's app or website after sending. Body: { conversation_id }.
// Safe to call any number of times: it only pushes when the caller sent the latest message (in the last 10 minutes),
// the conversation isn't blocked, the other person hasn't read it yet, and they got no push since they last read
// (one push per unread streak — the same rule as the email after 10 minutes). The message text is never sent.
const FRESH_MS = 10 * 60000;

function createHandler(deps) {
  const ctx = makeCtx(deps);
  return wrap(async (req) => {
    const user = await ctx.getUser(req);
    const body = await readJson(req);
    const id = String(body.conversation_id || '');
    if (!UUID_RE.test(id)) throw new HttpError(404, 'Conversation not found.');
    const [c] = await ctx.db(`conversations?id=eq.${id}&select=id,client_user_id,creator_user_id,client_name,last_message_at,last_sender_id,client_read_at,creator_read_at,client_pushed_at,creator_pushed_at,blocked_by,photographers(name)`);
    if (!c || (c.client_user_id !== user.id && c.creator_user_id !== user.id)) throw new HttpError(404, 'Conversation not found.');
    const skip = (why) => json({ sent: false, reason: why });
    if (c.last_sender_id !== user.id) return skip('not_last_sender');
    if (c.blocked_by) return skip('blocked');
    if (ctx.nowMs() - Date.parse(c.last_message_at) > FRESH_MS) return skip('old');
    const toCreator = c.client_user_id === user.id;
    const to = toCreator ? c.creator_user_id : c.client_user_id;
    const readAt = toCreator ? c.creator_read_at : c.client_read_at;
    const pushedAt = toCreator ? c.creator_pushed_at : c.client_pushed_at;
    if (Date.parse(readAt) >= Date.parse(c.last_message_at)) return skip('read');
    if (pushedAt && Date.parse(pushedAt) > Date.parse(readAt)) return skip('already_pushed');
    // Claim the push first (only one of two quick calls wins), then send
    const col = toCreator ? 'creator_pushed_at' : 'client_pushed_at';
    const cond = pushedAt ? `${col}=eq.${encodeURIComponent(pushedAt)}` : `${col}=is.null`;
    const claimed = await ctx.db(`conversations?id=eq.${id}&${cond}`, { method: 'PATCH', body: { [col]: new Date(ctx.nowMs()).toISOString() } });
    if (!claimed || !claimed.length) return skip('already_pushed');
    const l = await mailLang(ctx, to, null);
    const sender = toCreator ? (c.client_name || L(l, 'A traveller')) : ((c.photographers && c.photographers.name) || L(l, 'Your creator'));
    const sent = await sendPush(ctx, deps, to, L(l, 'New message from {name}', { name: sender }), L(l, '{name} sent you a message on CapturaGo.', { name: sender }),
      { url: `/chat/${id}`, conversation_id: id });
    return json({ sent: sent > 0 });
  });
}
