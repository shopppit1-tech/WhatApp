// Incoming call system notifications (Service Worker + Notification API fallback) and Screen Wake Lock.

let activeWakeLock: WakeLockSentinel | null = null;

export function isNotificationSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export function getNotificationPermission(): NotificationPermission | 'unsupported' {
  if (!isNotificationSupported()) return 'unsupported';
  return Notification.permission;
}

export async function requestCallNotificationPermission(): Promise<
  NotificationPermission | 'unsupported'
> {
  if (!isNotificationSupported()) return 'unsupported';
  if (Notification.permission === 'granted') return 'granted';
  try {
    return await Notification.requestPermission();
  } catch {
    return Notification.permission;
  }
}

export async function showIncomingCallNotification(params: {
  callId: string;
  callerAlias: string;
  callerVirtualNumber: string;
  callType: 'audio' | 'video';
}): Promise<void> {
  if (!isNotificationSupported() || Notification.permission !== 'granted') return;

  const title = `${params.callType === 'video' ? 'Video Call' : 'Panggilan Suara'} Masuk`;
  const body = `${params.callerAlias} (${params.callerVirtualNumber})`;
  const tag = `whatapp-call-${params.callId}`;

  if ('serviceWorker' in navigator) {
    try {
      const reg = await navigator.serviceWorker.ready;
      if (reg && 'showNotification' in reg) {
        const options: NotificationOptions & {
          renotify?: boolean;
          vibrate?: number[];
          actions?: { action: string; title: string }[];
        } = {
          body,
          icon: '/pwa-192x192.png',
          badge: '/pwa-192x192.png',
          tag,
          renotify: true,
          requireInteraction: true,
          vibrate: [700, 350, 700, 350, 700],
          data: { callId: params.callId },
          actions: [
            { action: 'accept', title: 'Terima' },
            { action: 'reject', title: 'Tolak' },
          ],
        };
        await reg.showNotification(title, options);
        return;
      }
    } catch {
      // Fall back to standard Notification API below
    }
  }

  try {
    const notif = new Notification(title, {
      body,
      icon: '/pwa-192x192.png',
      tag,
      requireInteraction: true,
    });
    notif.onclick = () => {
      window.focus();
      notif.close();
    };
  } catch {
    // Ignore environments where window.Notification constructor is disallowed
  }
}

export async function dismissCallNotification(callId?: string | null): Promise<void> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    if (!reg || !reg.getNotifications) return;
    const notifications = await reg.getNotifications(
      callId ? { tag: `whatapp-call-${callId}` } : undefined
    );
    notifications.forEach((n) => n.close());
  } catch {
    // Ignore
  }
}

export async function acquireCallWakeLock(): Promise<void> {
  if (typeof navigator === 'undefined' || !('wakeLock' in navigator)) return;
  if (activeWakeLock && !activeWakeLock.released) return;
  try {
    activeWakeLock = await navigator.wakeLock.request('screen');
    activeWakeLock.addEventListener('release', () => {
      activeWakeLock = null;
    });
  } catch {
    // Screen Wake Lock may fail if tab is currently hidden or unsupported
  }
}

export async function releaseCallWakeLock(): Promise<void> {
  if (!activeWakeLock) return;
  try {
    await activeWakeLock.release();
  } catch {
    // Ignore
  } finally {
    activeWakeLock = null;
  }
}
