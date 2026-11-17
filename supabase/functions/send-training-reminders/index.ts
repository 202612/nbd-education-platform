// Runs once a day (via the pg_cron job in
// supabase/migrations/0043_training_reminder_cron.sql). Finds every
// scheduled-training entry due tomorrow that hasn't had a reminder sent yet,
// skips anything the person has already finished, and emails the rest via
// Resend. Needs two secrets set before it'll actually send anything:
//   supabase secrets set RESEND_API_KEY=re_xxx REMINDER_FROM_EMAIL="NBD Education <education@yourdomain.ie>"
// RESEND_API_KEY comes from resend.com once Chloe's domain is verified
// there — until then this function runs, finds nothing to send real email
// for, and just logs a clear reason why.

import { createClient } from "npm:@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const FROM_EMAIL = Deno.env.get("REMINDER_FROM_EMAIL");
const SITE_URL = Deno.env.get("SITE_URL") || "https://nbd-education-platform.vercel.app";

Deno.serve(async () => {
  if (!RESEND_API_KEY || !FROM_EMAIL) {
    const msg = "Reminder emails are not configured yet — set RESEND_API_KEY and REMINDER_FROM_EMAIL as function secrets once the sending domain is ready.";
    console.log(msg);
    return new Response(JSON.stringify({ sent: 0, skipped: 0, note: msg }), { headers: { "Content-Type": "application/json" } });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // One reminder, sent the day before the date the person picked.
  const tomorrow = new Date();
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  const tomorrowStr = tomorrow.toISOString().slice(0, 10);

  const { data: due, error } = await supabase
    .from("training_schedule")
    .select("id, assigned_to, brand_id, scheduled_date, app_users:assigned_to(name, email), brands(name, steps:brand_steps(id))")
    .eq("scheduled_date", tomorrowStr)
    .is("reminder_sent_at", null);

  if (error) {
    console.error(error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { "Content-Type": "application/json" } });
  }

  let sent = 0, skipped = 0;
  for (const row of due || []) {
    const stepIds = (row.brands?.steps || []).map((s: { id: string }) => s.id);
    if (stepIds.length === 0) { skipped++; continue; }

    const { count } = await supabase
      .from("step_progress")
      .select("step_id", { count: "exact", head: true })
      .eq("user_id", row.assigned_to)
      .in("step_id", stepIds);

    // Already finished before the reminder would even go out — skip it.
    if ((count || 0) >= stepIds.length) { skipped++; continue; }

    const person = row.app_users as unknown as { name: string; email: string } | null;
    const brand = row.brands as unknown as { name: string } | null;
    if (!person?.email || !brand?.name) { skipped++; continue; }

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: person.email,
        subject: `Reminder: ${brand.name} training is due tomorrow`,
        html: `
          <p>Hi ${person.name.split(" ")[0]},</p>
          <p>Just a reminder that you scheduled <strong>${brand.name}</strong> training for tomorrow.</p>
          <p><a href="${SITE_URL}">Pick up where you left off →</a></p>
        `,
      }),
    });

    if (res.ok) {
      sent++;
      await supabase.from("training_schedule").update({ reminder_sent_at: new Date().toISOString() }).eq("id", row.id);
    } else {
      console.error("Resend error for", person.email, await res.text());
      skipped++;
    }
  }

  return new Response(JSON.stringify({ sent, skipped }), { headers: { "Content-Type": "application/json" } });
});
