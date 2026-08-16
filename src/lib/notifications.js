// Notifications, two tiers:
//  Tier 1 — local browser Notification while a tab is open (this file).
//  Tier 2 — Web Push via service worker, works with the app closed (push.js).

export const localNotificationsSupported =
  typeof window !== 'undefined' && 'Notification' in window;

export function notificationPermission() {
  return localNotificationsSupported ? Notification.permission : 'unsupported';
}

export async function requestNotificationPermission() {
  if (!localNotificationsSupported) return 'unsupported';
  try {
    return await Notification.requestPermission();
  } catch {
    return 'denied';
  }
}

// Fires a local notification, only when the page isn't visible (no point
// otherwise) and permission is granted. `tag` collapses duplicates with the
// service-worker push for the same event.
export function notifyLocal({ title, body, tag, url }) {
  if (!localNotificationsSupported || Notification.permission !== 'granted') return;
  if (!document.hidden) return;
  try {
    const notification = new Notification(title, { body, tag, dir: 'rtl', lang: 'he' });
    notification.onclick = () => {
      window.focus();
      if (url) window.location.hash = url;
      notification.close();
    };
  } catch {
    /* some platforms (Android Chrome tabs) throw for page-context
       notifications; the service-worker push covers those */
  }
}
