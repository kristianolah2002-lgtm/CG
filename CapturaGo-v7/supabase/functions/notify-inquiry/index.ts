// ================================================================
// CapturaGo — Email Notification Edge Function
// File: supabase/functions/notify-inquiry/index.ts
//
// SETUP:
// 1. Go to resend.com → create free account → get API key
// 2. In Supabase → Settings → Edge Functions → Add secret:
//    Name: RESEND_API_KEY  Value: (your Resend key)
// 3. Deploy this function:
//    supabase functions deploy notify-inquiry
// 4. In Supabase → Database → Webhooks → Create webhook:
//    Table: inquiries  |  Event: INSERT
//    URL: https://[your-project].supabase.co/functions/v1/notify-inquiry
// ================================================================

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_KEY = Deno.env.get("RESEND_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const FROM_EMAIL = "CapturaGo <noreply@capturago.com>";

const e = (s: unknown) => String(s ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;");

serve(async (req) => {
  try {
    const payload = await req.json();
    const inquiry = payload.record;
    if (!inquiry) return new Response("No record", { status: 400 });

    // Get the creator's details
    const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const { data: creator } = await db
      .from("photographers")
      .select("name, email, city")
      .eq("id", inquiry.photographer_id)
      .single();

    if (!creator?.email) return new Response("Creator not found", { status: 404 });

    const shootDate = inquiry.shoot_date
      ? new Date(inquiry.shoot_date).toLocaleDateString("en-GB", { day:"numeric", month:"long", year:"numeric" })
      : "Not specified";

    const shootType = {
      photo: "Photography",
      video: "Videography",
      edit: "Photo/Video editing",
      guide: "Location guide + shoot",
    }[inquiry.shoot_type] || "Not specified";

    // Email to the CREATOR
    await sendEmail({
      to: creator.email,
      subject: `New inquiry from ${e(inquiry.sender_name)} — CapturaGo`,
      html: `
        <div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#1a1a1a">
          <div style="background:#1e1409;padding:24px 28px;border-radius:12px 12px 0 0">
            <h1 style="color:#f7b766;font-size:22px;margin:0;font-weight:400">
              ✦ CapturaGo
            </h1>
          </div>
          <div style="background:#fff;padding:28px;border:1px solid #e5e5e5;border-top:none;border-radius:0 0 12px 12px">
            <h2 style="font-size:20px;margin:0 0 8px">You have a new inquiry! 📬</h2>
            <p style="color:#666;margin:0 0 24px">Someone wants to book you through CapturaGo.</p>

            <table style="width:100%;border-collapse:collapse;font-size:14px">
              <tr style="border-bottom:1px solid #f0f0f0">
                <td style="padding:10px 0;color:#888;width:130px">From</td>
                <td style="padding:10px 0;font-weight:500">${e(inquiry.sender_name)}</td>
              </tr>
              <tr style="border-bottom:1px solid #f0f0f0">
                <td style="padding:10px 0;color:#888">Reply to</td>
                <td style="padding:10px 0">
                  <a href="mailto:${e(inquiry.sender_email)}" style="color:#f7b766">${e(inquiry.sender_email)}</a>
                </td>
              </tr>
              <tr style="border-bottom:1px solid #f0f0f0">
                <td style="padding:10px 0;color:#888">Service</td>
                <td style="padding:10px 0">${shootType}</td>
              </tr>
              <tr style="border-bottom:1px solid #f0f0f0">
                <td style="padding:10px 0;color:#888">Date</td>
                <td style="padding:10px 0">${shootDate}</td>
              </tr>
              <tr>
                <td style="padding:10px 0;color:#888;vertical-align:top">Message</td>
                <td style="padding:10px 0;line-height:1.6">${e(inquiry.message)}</td>
              </tr>
            </table>

            <div style="margin-top:24px;padding:16px;background:#fef9f0;border-radius:8px;border:1px solid #fde8c0">
              <p style="margin:0;font-size:13px;color:#854f0b">
                💡 <strong>Reply quickly.</strong> Clients who don't hear back within a few hours often book someone else.
                Just reply directly to <strong>${e(inquiry.sender_email)}</strong>.
              </p>
            </div>

            <div style="margin-top:24px;text-align:center">
              <a href="https://capturago.com/dashboard.html"
                 style="background:#f7b766;color:#1a0e06;padding:12px 28px;border-radius:999px;text-decoration:none;font-weight:600;font-size:14px">
                View in dashboard →
              </a>
            </div>
          </div>
          <p style="text-align:center;font-size:12px;color:#aaa;margin-top:16px">
            CapturaGo · No commission · No gatekeeping · Just talent<br/>
            <a href="https://capturago.com" style="color:#aaa">capturago.com</a>
          </p>
        </div>
      `
    });

    // Confirmation email to the CLIENT
    await sendEmail({
      to: inquiry.sender_email,
      subject: `Your inquiry to ${e(creator.name)} was sent — CapturaGo`,
      html: `
        <div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#1a1a1a">
          <div style="background:#1e1409;padding:24px 28px;border-radius:12px 12px 0 0">
            <h1 style="color:#f7b766;font-size:22px;margin:0;font-weight:400">✦ CapturaGo</h1>
          </div>
          <div style="background:#fff;padding:28px;border:1px solid #e5e5e5;border-top:none;border-radius:0 0 12px 12px">
            <h2 style="font-size:20px;margin:0 0 8px">Your inquiry was sent! ✓</h2>
            <p style="color:#666;margin:0 0 20px">
              We've notified <strong>${e(creator.name)}</strong> in ${e(creator.city)}.
              They'll reply directly to this email address.
            </p>
            <div style="background:#f8f8f8;border-radius:8px;padding:16px;font-size:14px;color:#444">
              <strong>Your message:</strong><br/>
              <span style="color:#666;line-height:1.6">${e(inquiry.message)}</span>
            </div>
            <p style="margin-top:20px;font-size:13px;color:#888;line-height:1.6">
              Most creators respond within a few hours.
              CapturaGo charges zero commission — any pricing you agree on goes directly to ${e(creator.name)}.
            </p>
            <div style="margin-top:24px;text-align:center">
              <a href="https://capturago.com"
                 style="background:#f7b766;color:#1a0e06;padding:12px 28px;border-radius:999px;text-decoration:none;font-weight:600;font-size:14px">
                Browse more creators →
              </a>
            </div>
          </div>
          <p style="text-align:center;font-size:12px;color:#aaa;margin-top:16px">
            CapturaGo · <a href="https://capturago.com" style="color:#aaa">capturago.com</a>
          </p>
        </div>
      `
    });

    return new Response(JSON.stringify({ ok: true }), {
      headers: { "Content-Type": "application/json" }
    });

  } catch (err) {
    console.error("[notify-inquiry error]", err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
});

async function sendEmail({ to, subject, html }) {
  if (!RESEND_KEY) {
    console.warn("RESEND_API_KEY not set — email not sent");
    return;
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${RESEND_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ from: FROM_EMAIL, to, subject, html })
  });
  if (!res.ok) {
    const body = await res.text();
    console.error("[Resend error]", res.status, body);
  }
}
