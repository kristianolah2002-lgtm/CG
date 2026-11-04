// ── phone: add a mobile number for text reminders on the shoot day (SMS or WhatsApp) ──
// action "start": the person agrees to the reminders and gets a 6-digit code by SMS (limits in the database:
//   one a minute, 5 a day per account, 8 a day per number); action "verify": checks the code (5 tries, 10 minutes).
// The code is never stored — only a keyed hash bound to the account. Changing settings or removing the number
// is done by the person directly (set_phone_prefs / remove_my_phone).
async function codeHash(ctx, userId, code) {
  const secret = ctx.env('PHONE_CODE_SECRET', '') || ctx.env('SUPABASE_SERVICE_ROLE_KEY', '');
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${userId}:${code}`));
  return Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, '0')).join('');
}
function newCode() {   // 000000–999999, without modulo bias
  const buf = new Uint32Array(1);
  for (;;) { crypto.getRandomValues(buf); if (buf[0] < 4294000000) return String(buf[0] % 1000000).padStart(6, '0'); }
}

function createHandler(deps) {
  const ctx = makeCtx(deps);
  return wrap(async (req) => {
    const user = await ctx.getUser(req);
    const body = await readJson(req);
    const action = String(body.action || '');

    if (action === 'start') {
      if (body.consent !== true) throw new HttpError(400, 'Please agree to receive text reminders.');
      const phone = normPhone(body.phone);
      if (!phone) throw new HttpError(400, 'Enter your mobile number with the country code, e.g. +421 900 123 456.');
      const channel = body.channel === 'whatsapp' ? 'whatsapp' : 'sms';
      if (!textsConfigured(ctx)) throw new HttpError(503, 'Text reminders aren\'t available yet.');
      const code = newCode();
      const r = await ctx.db('rpc/phone_code_start', { method: 'POST', body: { p_user: user.id, p_phone: phone, p_channel: channel, p_code_hash: await codeHash(ctx, user.id, code) } });
      if (r === 'wait') throw new HttpError(429, 'Please wait a minute before asking for a new code.');
      if (r === 'limit') throw new HttpError(429, 'Too many codes today. Please try again tomorrow.');
      if (r !== 'ok') throw new HttpError(400, 'Enter your mobile number with the country code, e.g. +421 900 123 456.');
      const lang = await mailLang(ctx, user.id, user.email);
      const sent = await sendText(ctx, deps, phone, 'sms', L(lang, 'Your CapturaGo code: {code}. It expires in 10 minutes. Never share it with anyone.', { code }));
      if (!sent) throw new HttpError(502, 'We couldn\'t send a text to this number. Please check it and try again.');
      return json({ sent: true, phone: maskPhone(phone) });
    }

    if (action === 'verify') {
      const code = String(body.code || '').replace(/\D/g, '');
      if (!/^\d{6}$/.test(code)) throw new HttpError(400, 'Enter the 6-digit code from the text.');
      const r = await ctx.db('rpc/phone_code_check', { method: 'POST', body: { p_user: user.id, p_code_hash: await codeHash(ctx, user.id, code) } });
      if (r === 'ok') return json({ verified: true });
      if (r === 'wrong') throw new HttpError(400, 'That code isn\'t right. Please check the text and try again.');
      if (r === 'expired') throw new HttpError(400, 'The code has expired. Ask for a new one.');
      if (r === 'tries') throw new HttpError(429, 'Too many wrong codes. Ask for a new one.');
      throw new HttpError(400, 'Ask for a code first.');
    }

    throw new HttpError(400, 'Unknown action.');
  });
}

startServer(createHandler);
