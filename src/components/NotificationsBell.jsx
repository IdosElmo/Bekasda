import { useEffect, useState } from 'react';
import { Bell, BellRing, BellOff, Share, X } from 'lucide-react';
import { localNotificationsSupported, notificationPermission, requestNotificationPermission } from '../lib/notifications.js';
import { isPushConfigured, subscribeToPush, hasPushSubscription } from '../lib/push.js';
import { useAuth, effectivePlayerId } from '../lib/auth.js';

const isIOS = typeof navigator !== 'undefined' && /iphone|ipad|ipod/i.test(navigator.userAgent);
const isStandalone =
  typeof window !== 'undefined' &&
  (window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true);

// iOS only allows web notifications for sites installed to the home screen;
// in a Safari tab the permission request silently returns "denied".
const needsInstall = isIOS && !isStandalone;

// Header bell: one tap asks for notification permission and (when push is
// configured) subscribes this device, so players hear about their turn.
export default function NotificationsBell() {
  const { user } = useAuth();
  const [status, setStatus] = useState('idle'); // idle | on | denied
  const [busy, setBusy] = useState(false);
  const [hint, setHint] = useState(null); // null | 'install' | 'blocked'

  useEffect(() => {
    if (needsInstall) return;
    const permission = notificationPermission();
    if (permission === 'denied') setStatus('denied');
    else if (permission === 'granted') setStatus('on');
  }, []);

  // Keep the stored subscription's player id fresh (guest id → account id).
  useEffect(() => {
    if (status !== 'on') return;
    hasPushSubscription().then((subscribed) => {
      if (subscribed || notificationPermission() === 'granted') {
        subscribeToPush(effectivePlayerId(user));
      }
    });
  }, [status, user?.id]);

  if (!localNotificationsSupported && !isPushConfigured && !needsInstall) return null;

  async function enable() {
    if (needsInstall) {
      setHint('install');
      return;
    }
    setBusy(true);
    try {
      await requestNotificationPermission();
      // Re-read the persisted state — some browsers "return" denied without
      // actually recording a decision (no prompt was shown at all).
      const permission = notificationPermission();
      if (permission === 'granted') {
        await subscribeToPush(effectivePlayerId(user));
        setStatus('on');
        setHint(null);
      } else if (permission === 'denied') {
        setStatus('denied');
        setHint('blocked');
      } else {
        setStatus('idle'); // prompt dismissed — leave the button inviting
      }
    } finally {
      setBusy(false);
    }
  }

  const hintPanel = hint && (
    <div className="absolute end-0 top-full z-50 mt-2 w-64 rounded-2xl bg-night-800 p-3 text-start shadow-2xl ring-1 ring-white/15">
      <button
        type="button"
        onClick={() => setHint(null)}
        className="absolute start-2 top-2 text-slate-500 hover:text-white"
        aria-label="סגירה"
      >
        <X size={13} />
      </button>
      {hint === 'install' ? (
        <p className="text-xs leading-relaxed text-slate-200">
          באייפון, התראות עובדות רק אחרי התקנת המשחק:
          לחצו על כפתור השיתוף <Share size={12} className="inline text-sky-300" /> בספארי
          ובחרו <b>"הוספה למסך הבית"</b>.
          אחר כך פתחו את בקסדה מהאייקון ולחצו שוב על הפעמון 🔔
        </p>
      ) : (
        <p className="text-xs leading-relaxed text-slate-200">
          התראות נחסמו לאתר הזה. כדי לאפשר אותן מחדש, פתחו את הגדרות האתר
          בדפדפן (סמל המנעול ליד הכתובת) ואפשרו התראות.
        </p>
      )}
    </div>
  );

  if (status === 'on') {
    return (
      <span className="flex items-center gap-1 rounded-full bg-mint-400/15 px-2.5 py-1.5 text-xs text-mint-400" title="התראות פעילות">
        <BellRing size={13} />
      </span>
    );
  }

  if (status === 'denied') {
    return (
      <span className="relative">
        <button
          type="button"
          onClick={() => setHint(hint ? null : 'blocked')}
          className="flex items-center gap-1 rounded-full bg-white/5 px-2.5 py-1.5 text-xs text-slate-500 transition hover:bg-white/10"
          title="התראות נחסמו"
        >
          <BellOff size={13} />
        </button>
        {hintPanel}
      </span>
    );
  }

  return (
    <span className="relative">
      <button
        type="button"
        onClick={enable}
        disabled={busy}
        title="קבלו התראה כשמגיע תורכם"
        className="flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-white/20 active:scale-95 disabled:opacity-60"
      >
        <Bell size={13} />
        התראות
      </button>
      {hintPanel}
    </span>
  );
}
