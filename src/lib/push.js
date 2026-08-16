// Tier 2 — Web Push subscriptions. Requires:
//  - VITE_VAPID_PUBLIC_KEY at build time (the public half of a VAPID keypair)
//  - the push_subscriptions table (supabase/upgrade-push.sql)
//  - the notify-turn Edge Function + a Database Webhook on rooms updates
// Without any of those, everything here degrades to a no-op.

import { supabaseClient } from './backend.js';

const VAPID_PUBLIC_KEY = (import.meta.env.VITE_VAPID_PUBLIC_KEY ?? '').trim();

export const isPushSupported =
  typeof window !== 'undefined' &&
  'serviceWorker' in navigator &&
  'PushManager' in window;

export const isPushConfigured = Boolean(VAPID_PUBLIC_KEY) && Boolean(supabaseClient) && isPushSupported;

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  return Uint8Array.from([...raw].map((ch) => ch.charCodeAt(0)));
}

async function getRegistration() {
  return navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`);
}

// Subscribes this browser to push and stores the subscription keyed by the
// player id. Safe to call repeatedly — re-upserts keep player_id current
// (e.g. after signing in). Returns true on success.
export async function subscribeToPush(playerId) {
  if (!isPushConfigured || !playerId || Notification.permission !== 'granted') return false;
  try {
    const registration = await getRegistration();
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });
    const { error } = await supabaseClient.from('push_subscriptions').upsert({
      endpoint: subscription.endpoint,
      player_id: playerId,
      subscription: subscription.toJSON(),
    });
    return !error;
  } catch {
    return false;
  }
}

export async function hasPushSubscription() {
  if (!isPushConfigured) return false;
  try {
    const registration = await navigator.serviceWorker.getRegistration(import.meta.env.BASE_URL);
    const subscription = await registration?.pushManager.getSubscription();
    return Boolean(subscription);
  } catch {
    return false;
  }
}
