// Optional Google sign-in via Supabase Auth. Signing in is never required —
// guests play with an anonymous per-browser id; signed-in players use their
// account id, so their games and history follow them across devices.

import { useEffect, useState } from 'react';
import { supabaseClient } from './backend.js';
import { getPlayerId } from './storage.js';

export const isAuthAvailable = Boolean(supabaseClient);

export function signInWithGoogle() {
  return supabaseClient.auth.signInWithOAuth({
    provider: 'google',
    // Back to the app root (works for GitHub Pages project paths).
    options: { redirectTo: window.location.origin + window.location.pathname },
  });
}

export function signOut() {
  return supabaseClient.auth.signOut();
}

export function useAuth() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(isAuthAvailable);

  useEffect(() => {
    if (!supabaseClient) return undefined;
    supabaseClient.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
      setLoading(false);
    });
    const { data: sub } = supabaseClient.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  return { user, loading };
}

// The id used to key rooms: the signed-in account when available, otherwise
// the anonymous browser id.
export function effectivePlayerId(user) {
  return user?.id ?? getPlayerId();
}

// All ids that may appear on this player's rooms (account + guest id), so
// games played before signing in still show up.
export function myPlayerIds(user) {
  return [...new Set([user?.id, getPlayerId()].filter(Boolean))];
}

export function displayName(user) {
  return user?.user_metadata?.full_name
    ?? user?.user_metadata?.name
    ?? user?.email?.split('@')[0]
    ?? '';
}
