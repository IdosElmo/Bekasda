import { useState } from 'react';
import { LogOut } from 'lucide-react';
import { isAuthAvailable, useAuth, signInWithGoogle, signOut, displayName } from '../lib/auth.js';

function GoogleIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 48 48" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3l5.7-5.7C34.2 6.1 29.3 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.6-.4-3.9z"/>
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3l5.7-5.7C34.2 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"/>
      <path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C41.4 35.4 44 30.1 44 24c0-1.3-.1-2.6-.4-3.9z"/>
    </svg>
  );
}

export default function AuthButton() {
  const { user, loading } = useAuth();
  const [busy, setBusy] = useState(false);

  if (!isAuthAvailable || loading) return null;

  if (!user) {
    return (
      <button
        type="button"
        onClick={async () => {
          setBusy(true);
          try {
            await signInWithGoogle();
          } catch {
            setBusy(false);
          }
        }}
        disabled={busy}
        className="flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-white/20 active:scale-95 disabled:opacity-60"
      >
        <GoogleIcon />
        התחברות
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {user.user_metadata?.avatar_url ? (
        <img
          src={user.user_metadata.avatar_url}
          alt=""
          referrerPolicy="no-referrer"
          className="h-6 w-6 rounded-full ring-1 ring-white/20"
        />
      ) : null}
      <span className="max-w-24 truncate text-xs text-slate-300">{displayName(user)}</span>
      <button
        type="button"
        onClick={() => signOut()}
        title="התנתקות"
        className="rounded-full bg-white/10 p-1.5 text-slate-300 transition hover:bg-white/20 active:scale-95"
      >
        <LogOut size={13} />
      </button>
    </div>
  );
}
