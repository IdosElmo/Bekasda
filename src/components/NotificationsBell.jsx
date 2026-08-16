import { useEffect, useState } from 'react';
import { Bell, BellRing, BellOff } from 'lucide-react';
import { localNotificationsSupported, notificationPermission, requestNotificationPermission } from '../lib/notifications.js';
import { isPushConfigured, subscribeToPush, hasPushSubscription } from '../lib/push.js';
import { useAuth, effectivePlayerId } from '../lib/auth.js';

// Header bell: one tap asks for notification permission and (when push is
// configured) subscribes this device, so players hear about their turn.
export default function NotificationsBell() {
  const { user } = useAuth();
  const [status, setStatus] = useState('idle'); // idle | on | denied
  const [busy, setBusy] = useState(false);

  useEffect(() => {
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

  if (!localNotificationsSupported && !isPushConfigured) return null;

  async function enable() {
    setBusy(true);
    try {
      const permission = await requestNotificationPermission();
      if (permission !== 'granted') {
        setStatus(permission === 'denied' ? 'denied' : 'idle');
        return;
      }
      await subscribeToPush(effectivePlayerId(user));
      setStatus('on');
    } finally {
      setBusy(false);
    }
  }

  if (status === 'on') {
    return (
      <span className="flex items-center gap-1 rounded-full bg-mint-400/15 px-2.5 py-1.5 text-xs text-mint-400" title="התראות פעילות">
        <BellRing size={13} />
      </span>
    );
  }
  if (status === 'denied') {
    return (
      <span
        className="flex items-center gap-1 rounded-full bg-white/5 px-2.5 py-1.5 text-xs text-slate-500"
        title="התראות נחסמו — אפשר לאפשר מחדש בהגדרות האתר של הדפדפן"
      >
        <BellOff size={13} />
      </span>
    );
  }
  return (
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
  );
}
