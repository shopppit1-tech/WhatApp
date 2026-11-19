import { Capacitor } from '@capacitor/core';
import {
  PushNotifications,
  type PushNotificationSchema,
  type Token,
} from '@capacitor/push-notifications';
import { deleteDoc, doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from './firebase';

let initialized = false;
let activeUid: string | null = null;
let removeListeners: (() => Promise<void>)[] = [];

function tokenDocumentId(token: string): string {
  let hash = 2166136261;
  for (let index = 0; index < token.length; index += 1) {
    hash = Math.imul(hash ^ token.charCodeAt(index), 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

async function saveToken(uid: string, token: string): Promise<void> {
  const tokenId = tokenDocumentId(token);
  await setDoc(
    doc(db, 'users', uid, 'devices', tokenId),
    {
      uid,
      fcmToken: token,
      platform: Capacitor.getPlatform(),
      enabled: true,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

export async function registerPushNotifications(uid: string): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;
  if (initialized && activeUid === uid) return true;

  const permission = await PushNotifications.checkPermissions();
  const granted = permission.receive === 'granted'
    ? permission
    : await PushNotifications.requestPermissions();
  if (granted.receive !== 'granted') return false;

  if (!initialized) {
    const registration = await PushNotifications.addListener(
      'registration',
      (token: Token) => {
        if (activeUid) saveToken(activeUid, token.value).catch(() => {});
      },
    );
    const error = await PushNotifications.addListener('registrationError', () => {});
    const received = await PushNotifications.addListener(
      'pushNotificationReceived',
      (_notification: PushNotificationSchema) => {
        // Background notifications are rendered by the native Android service.
        // Foreground updates arrive through the existing Firestore listeners.
      },
    );
    const action = await PushNotifications.addListener('pushNotificationActionPerformed', () => {
      // Opening the app is enough; the existing call-session listener opens CallModal.
    });
    removeListeners = [
      registration.remove,
      error.remove,
      received.remove,
      action.remove,
    ];
    initialized = true;
  }

  activeUid = uid;
  await PushNotifications.register();
  return true;
}

export async function unregisterPushNotifications(): Promise<void> {
  activeUid = null;
  for (const remove of removeListeners) await remove().catch(() => {});
  removeListeners = [];
  initialized = false;
}

export async function disablePushToken(uid: string, token: string): Promise<void> {
  await deleteDoc(doc(db, 'users', uid, 'devices', tokenDocumentId(token))).catch(() => {});
}
