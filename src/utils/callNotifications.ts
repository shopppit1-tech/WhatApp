import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';

let activeWakeLock: WakeLockSentinel | null = null;
const NATIVE_CALL_CHANNEL_ID = 'whatapp_incoming_calls';
const NATIVE_CALL_SOUND = 'whatapp_call';

function nativeNotificationId(callId: string): number {
  let hash = 2166136261;
  for (let index = 0; index < callId.length; index += 1) {
    hash = Math.imul(hash ^ callId.charCodeAt(index), 16777619);
  }
  return (hash >>> 0) & 0x7fffffff;
}

async function ensureNativeCallChannel(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await LocalNotifications.createChannel({
      id: NATIVE_CALL_CHANNEL_ID,
      name: 'Panggilan masuk',
      description: 'Peringatan panggilan suara dan video WhatApp',
      importance: 5,
      visibility: 1,
      vibration: true,
      sound: NATIVE_CALL_SOUND,
    });
  } catch {
    // The OS may keep the user's existing channel settings.
  }
}

export function isNotificationSupported(): boolean {
  return Capacitor.isNativePlatform() ||
    (typeof window !== 'undefined' && 'Notification' in window);
}

export function getNotificationPermission(): NotificationPermission | 'unsupported' {
  if (Capacitor.isNativePlatform()) return 'default';
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
  return Notification.permission;
}

export async function requestCallNotificationPermission(): Promise<
  NotificationPermission | 'unsupported'
> {
  if (Capacitor.isNativePlatform()) {
    try {
      const current = await LocalNotifications.checkPermissions();
      const permission = current.display === 'granted'
        ? current
        : await LocalNotifications.requestPermissions();
      if (permission.display === 'granted') await ensureNativeCallChannel();
      if (permission.display === 'granted') return 'granted';
      if (permission.display === 'denied') return 'denied';
      return 'default';
    } catch {
      return 'default';
    }
  }

  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
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
  const title = `${params.callType === 'video' ? 'Video Call' : 'Panggilan Suara'} Masuk`;
  const body = `${params.callerAlias} (${params.callerVirtualNumber})`;
  const tag = `whatapp-call-${params.callId}`;

  if (Capacitor.isNativePlatform()) {
    try {
      const permission = await LocalNotifications.checkPermissions();
      if (permission.display !== 'granted') return;
      await ensureNativeCallChannel();
      await LocalNotifications.schedule({
        notifications: [
          {
            id: nativeNotificationId(params.callId),
            title,
            body,
            channelId: NATIVE_CALL_CHANNEL_ID,
            sound: NATIVE_CALL_SOUND,
            ongoing: true,
            autoCancel: false,
            extra: { callId: params.callId },
            schedule: { at: new Date(Date.now() + 50) },
          },
        ],
      });
      return;
    } catch {
      // Continue to the browser API fallback when the native plugin is unavailable.
    }
    return;
  }

  if (
    typeof window === 'undefined' ||
    !('Notification' in window) ||
    Notification.permission !== 'granted'
  ) return;

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
      // Fall back to standard Notification API below.
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
    // Ignore environments where window.Notification is disallowed.
  }
}

export async function dismissCallNotification(callId?: string | null): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    try {
      if (callId) {
        const id = nativeNotificationId(callId);
        await LocalNotifications.cancel({ notifications: [{ id }] }).catch(() => {});
        const delivered = await LocalNotifications.getDeliveredNotifications();
        const matching = delivered.notifications.filter((notification) => notification.id === id);
        if (matching.length > 0) {
          await LocalNotifications.removeDeliveredNotifications({ notifications: matching });
        }
      } else {
        await LocalNotifications.removeAllDeliveredNotifications();
      }
    } catch {
      // Ignore notification cleanup errors.
    }
  }

  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    if (!reg || !reg.getNotifications) return;
    const notifications = await reg.getNotifications(
      callId ? { tag: `whatapp-call-${callId}` } : undefined
    );
    notifications.forEach((notification) => notification.close());
  } catch {
    // Ignore.
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
    // Screen Wake Lock may fail if tab is hidden or unsupported.
  }
}

export async function releaseCallWakeLock(): Promise<void> {
  if (!activeWakeLock) return;
  try {
    await activeWakeLock.release();
  } catch {
    // Ignore.
  } finally {
    activeWakeLock = null;
  }
}
