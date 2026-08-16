// notify-turn — Supabase Edge Function.
// Called by a Database Webhook on UPDATE of public.rooms; sends a Web Push
// notification to the player whose turn it became (or who won).
//
// Required secrets (Edge Functions → Secrets):
//   VAPID_PUBLIC_KEY   — public half of the VAPID keypair
//   VAPID_PRIVATE_KEY  — private half (never ship this to the client)
//   VAPID_SUBJECT      — contact URI, e.g. mailto:you@example.com
// Optional:
//   SITE_URL           — app root, default https://idoselmo.github.io/Bekasda/
//
// SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are injected automatically.
// Disable "Enforce JWT verification" for this function (or configure the
// webhook to send an Authorization header) so the webhook can reach it.

import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

webpush.setVapidDetails(
  Deno.env.get("VAPID_SUBJECT") ?? "mailto:admin@example.com",
  Deno.env.get("VAPID_PUBLIC_KEY")!,
  Deno.env.get("VAPID_PRIVATE_KEY")!,
);

const SITE_URL = (Deno.env.get("SITE_URL") ?? "https://idoselmo.github.io/Bekasda/").replace(/\/?$/, "/");

Deno.serve(async (req) => {
  const ok = (note: string) => new Response(JSON.stringify({ ok: true, note }), {
    headers: { "Content-Type": "application/json" },
  });

  let payload;
  try {
    payload = await req.json();
  } catch {
    return ok("no payload");
  }
  const record = payload?.record;
  const old = payload?.old_record;
  if (!record?.code || !old) return ok("not a rooms update");

  // Decide who to notify, and why.
  let targetId: string | null = null;
  let title = "";
  let body = "";
  if (old.status === "waiting" && record.status === "playing") {
    // Player 2 joined — player 1 opens the game.
    targetId = record.player1_id;
    title = "המשחק התחיל! 🪖";
    body = `${record.player2_name ?? "השחקן השני"} הצטרפ/ה — עכשיו תורך`;
  } else if (record.status === "playing" && record.current_turn !== old.current_turn) {
    targetId = record.current_turn === 1 ? record.player1_id : record.player2_id;
    const opponent = record.current_turn === 1 ? record.player2_name : record.player1_name;
    title = "תורך! 🪖";
    body = `${opponent ?? "היריב/ה"} שיחק/ה — עכשיו תורך`;
  } else if (old.status !== "finished" && record.status === "finished" && record.winner) {
    targetId = record.winner === 1 ? record.player1_id : record.player2_id;
    title = "ניצחת! 🏆";
    body = "ליריב/ה נגמרו המילים";
  }
  if (!targetId) return ok("nothing to notify");

  const { data: subs, error } = await supabase
    .from("push_subscriptions")
    .select("endpoint, subscription")
    .eq("player_id", targetId);
  if (error || !subs?.length) return ok("no subscriptions");

  const message = JSON.stringify({
    title,
    body,
    tag: `bekasda-${record.code}`,
    url: `${SITE_URL}#/room/${record.code}`,
  });

  const results = await Promise.allSettled(
    subs.map((s) => webpush.sendNotification(s.subscription, message)),
  );

  // Prune dead subscriptions (endpoint gone / expired).
  const dead = subs.filter((_, i) => {
    const r = results[i];
    return r.status === "rejected" && [404, 410].includes((r.reason as { statusCode?: number })?.statusCode ?? 0);
  });
  if (dead.length) {
    await supabase.from("push_subscriptions").delete().in("endpoint", dead.map((s) => s.endpoint));
  }

  const sent = results.filter((r) => r.status === "fulfilled").length;
  return ok(`sent ${sent}/${subs.length}, pruned ${dead.length}`);
});
