import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import type { User } from 'firebase/auth';
import type {
  ChatThread,
  DirectoryProfile,
  EcPublicKeyJwk,
  EncryptedMessagePayload,
  MessageStatus,
  MessageType,
  SavedContact,
  StatusItem,
} from '../types/chat';
import { clampString } from '../utils/chatHelpers';
import {
  createDeterministicChatId,
  createRandomId,
  generateVirtualAlias,
  normalizeVirtualDigits,
  pickAvatarColor,
} from '../utils/virtualNumber';
import { db, handleFirestoreError, OperationType } from './firebase';

function tsToMs(val: unknown): number {
  if (val instanceof Timestamp) {
    return val.toMillis();
  }
  if (val && typeof val === 'object' && 'toMillis' in val && typeof (val as { toMillis: () => number }).toMillis === 'function') {
    return (val as { toMillis: () => number }).toMillis();
  }
  return Date.now();
}

export async function syncUserOnGoogleLogin(
  user: User,
  virtualNumber: string,
  publicKey: EcPublicKeyJwk,
  customAlias?: string,
  customBio?: string,
  customAvatarUrl?: string
): Promise<DirectoryProfile> {
  const uid = user.uid;
  const email = clampString(user.email || 'user@sandiwa.local', 256);
  const displayName = clampString(user.displayName || 'Pengguna Google', 100);
  const vNum = clampString(virtualNumber, 32);
  const vDigits = clampString(normalizeVirtualDigits(vNum), 20);
  const alias = clampString(customAlias || generateVirtualAlias(vNum), 60);
  const bio = clampString(customBio ?? 'Tersedia', 160);
  const avatarBg = pickAvatarColor(uid);
  const avatarUrlInput =
    customAvatarUrl !== undefined ? clampString(customAvatarUrl, 24576) : undefined;

  const privatePath = `users/${uid}/private/info`;
  const privateRef = doc(db, 'users', uid, 'private', 'info');
  try {
    const existingPrivate = await getDoc(privateRef);
    if (existingPrivate.exists()) {
      await updateDoc(privateRef, {
        email,
        displayName,
        currentVirtualNumber: vNum,
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(privateRef, {
        uid,
        email,
        displayName,
        currentVirtualNumber: vNum,
        readReceiptsEnabled: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, privatePath);
  }

  const dirPath = `directory/${uid}`;
  const dirRef = doc(db, 'directory', uid);
  try {
    const existingDir = await getDoc(dirRef);
    if (existingDir.exists()) {
      const existingData = existingDir.data();
      const keptAlias = customAlias ? alias : clampString(String(existingData?.alias || alias), 60);
      const keptBio = customBio !== undefined ? bio : clampString(String(existingData?.bio || bio), 160);
      const keptAvatarUrl =
        avatarUrlInput !== undefined
          ? avatarUrlInput
          : clampString(String(existingData?.avatarUrl || ''), 24576);
      await updateDoc(dirRef, {
        virtualNumber: vNum,
        virtualNumberDigits: vDigits,
        alias: keptAlias,
        bio: keptBio,
        avatarBg,
        avatarUrl: keptAvatarUrl,
        publicKey: {
          kty: publicKey.kty,
          crv: publicKey.crv,
          x: publicKey.x,
          y: publicKey.y,
        },
        isDiscoverable: true,
        updatedAt: serverTimestamp(),
      });
      return {
        uid,
        virtualNumber: vNum,
        virtualNumberDigits: vDigits,
        alias: keptAlias,
        bio: keptBio,
        avatarBg,
        avatarUrl: keptAvatarUrl || undefined,
        publicKey,
        isDiscoverable: true,
        online: true,
        lastSeenLabel: 'online',
      };
    } else {
      const initialAvatarUrl = avatarUrlInput ?? '';
      await setDoc(dirRef, {
        uid,
        virtualNumber: vNum,
        virtualNumberDigits: vDigits,
        alias,
        bio,
        avatarBg,
        avatarUrl: initialAvatarUrl,
        publicKey: {
          kty: publicKey.kty,
          crv: publicKey.crv,
          x: publicKey.x,
          y: publicKey.y,
        },
        isDiscoverable: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, dirPath);
  }

  return {
    uid,
    virtualNumber: vNum,
    virtualNumberDigits: vDigits,
    alias,
    bio,
    avatarBg,
    avatarUrl: avatarUrlInput || undefined,
    publicKey,
    isDiscoverable: true,
    online: true,
    lastSeenLabel: 'online',
  };
}

export function subscribeDirectory(
  onData: (profiles: DirectoryProfile[]) => void
): Unsubscribe {
  const path = 'directory';
  const q = query(collection(db, 'directory'), where('isDiscoverable', '==', true));
  return onSnapshot(
    q,
    (snapshot) => {
      const list: DirectoryProfile[] = [];
      snapshot.forEach((docSnap) => {
        const d = docSnap.data();
        if (d.publicKey && d.uid && d.virtualNumber) {
          list.push({
            uid: String(d.uid),
            virtualNumber: String(d.virtualNumber),
            virtualNumberDigits: String(d.virtualNumberDigits || ''),
            alias: String(d.alias || 'Anonim'),
            bio: String(d.bio || ''),
            avatarBg: String(d.avatarBg || '#00A884'),
            avatarUrl: d.avatarUrl ? String(d.avatarUrl) : undefined,
            publicKey: d.publicKey as EcPublicKeyJwk,
            isDiscoverable: Boolean(d.isDiscoverable),
            online: true,
            lastSeenLabel: 'terhubung',
          });
        }
      });
      onData(list);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

export function subscribeSavedContacts(
  myUid: string,
  onData: (contacts: SavedContact[]) => void
): Unsubscribe {
  const path = `users/${myUid}/contacts`;
  const q = query(
    collection(db, 'users', myUid, 'contacts'),
    where('ownerUid', '==', myUid)
  );
  return onSnapshot(
    q,
    (snapshot) => {
      const list: SavedContact[] = [];
      snapshot.forEach((docSnap) => {
        const d = docSnap.data();
        list.push({
          ownerUid: String(d.ownerUid || myUid),
          contactUid: String(d.contactUid || docSnap.id),
          customName: String(d.customName || ''),
          virtualNumber: String(d.virtualNumber || ''),
          notes: String(d.notes || ''),
          createdAtMs: tsToMs(d.createdAt),
        });
      });
      list.sort((a, b) => a.customName.localeCompare(b.customName, 'id'));
      onData(list);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

export async function upsertSavedContact(params: {
  ownerUid: string;
  contactUid: string;
  customName: string;
  virtualNumber: string;
  notes: string;
}): Promise<void> {
  const path = `users/${params.ownerUid}/contacts/${params.contactUid}`;
  const ref = doc(db, 'users', params.ownerUid, 'contacts', params.contactUid);
  try {
    const existing = await getDoc(ref);
    if (existing.exists()) {
      await updateDoc(ref, {
        customName: clampString(params.customName, 60),
        virtualNumber: clampString(params.virtualNumber, 32),
        notes: clampString(params.notes, 160),
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(ref, {
        ownerUid: params.ownerUid,
        contactUid: params.contactUid,
        customName: clampString(params.customName, 60),
        virtualNumber: clampString(params.virtualNumber, 32),
        notes: clampString(params.notes, 160),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteSavedContact(
  ownerUid: string,
  contactUid: string
): Promise<void> {
  const path = `users/${ownerUid}/contacts/${contactUid}`;
  try {
    await deleteDoc(doc(db, 'users', ownerUid, 'contacts', contactUid));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export function subscribeMyChats(
  myUid: string,
  onData: (threads: ChatThread[]) => void
): Unsubscribe {
  const path = 'chats';
  const q = query(
    collection(db, 'chats'),
    where('participantUids', 'array-contains', myUid)
  );
  return onSnapshot(
    q,
    (snapshot) => {
      const threads: ChatThread[] = [];
      snapshot.forEach((docSnap) => {
        const d = docSnap.data();
        const participants: string[] = Array.isArray(d.participantUids)
          ? d.participantUids.map(String)
          : [];
        const type = d.type === 'group' ? 'group' : 'direct';
        const peerUid =
          type === 'direct' ? participants.find((p) => p !== myUid) : undefined;
        threads.push({
          chatId: String(d.chatId || docSnap.id),
          type,
          title: String(d.title || 'Obrolan Terenkripsi'),
          createdBy: String(d.createdBy || ''),
          participantUids: participants,
          peerUid,
          lastMessageCiphertext: String(d.lastMessageCiphertext || ''),
          lastMessageIv: String(d.lastMessageIv || ''),
          lastMessageSenderUid: String(d.lastMessageSenderUid || ''),
          lastMessageStatus: (d.lastMessageStatus as MessageStatus) || 'sent',
          lastMessagePreview: d.lastMessageCiphertext
            ? 'Pesan terenkripsi end-to-end'
            : 'Mulai obrolan terenkripsi',
          lastMessageAtMs: tsToMs(d.lastMessageAt),
          unreadCount: 0,
          pinned: false,
        });
      });
      threads.sort((a, b) => b.lastMessageAtMs - a.lastMessageAtMs);
      onData(threads);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

export async function ensureDirectChatRoom(
  myUid: string,
  peerUid: string,
  peerAlias: string
): Promise<string> {
  const chatId = createDeterministicChatId(myUid, peerUid);
  const path = `chats/${chatId}`;
  const chatRef = doc(db, 'chats', chatId);
  const myChatsQuery = query(
    collection(db, 'chats'),
    where('participantUids', 'array-contains', myUid)
  );
  try {
    const existingChats = await getDocs(myChatsQuery);
    if (existingChats.docs.some((chat) => chat.id === chatId)) return chatId;

    const participants = [myUid, peerUid].sort();
    try {
      await setDoc(chatRef, {
        chatId,
        type: 'direct',
        title: clampString(peerAlias, 80),
        createdBy: myUid,
        participantUids: participants,
        lastMessageCiphertext: '',
        lastMessageIv: '',
        lastMessageSenderUid: '',
        lastMessageStatus: 'sent',
        lastMessageAt: serverTimestamp(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (createError) {
      // Another device may have created the deterministic room after our query.
      const latestChats = await getDocs(myChatsQuery).catch(() => null);
      if (latestChats?.docs.some((chat) => chat.id === chatId)) return chatId;
      throw createError;
    }
    return chatId;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function createGroupChatRoom(
  myUid: string,
  title: string,
  memberUids: string[]
): Promise<string> {
  const chatId = createRandomId('grp');
  const path = `chats/${chatId}`;
  const participants = Array.from(new Set([myUid, ...memberUids])).slice(0, 20);
  if (participants.length < 2) {
    throw new Error('Grup membutuhkan minimal 2 peserta.');
  }
  try {
    await setDoc(doc(db, 'chats', chatId), {
      chatId,
      type: 'group',
      title: clampString(title || 'Grup Privasi Baru', 80),
      createdBy: myUid,
      participantUids: participants,
      lastMessageCiphertext: '',
      lastMessageIv: '',
      lastMessageSenderUid: '',
      lastMessageStatus: 'sent',
      lastMessageAt: serverTimestamp(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return chatId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export function subscribeChatMessages(
  chatId: string,
  myUid: string,
  onData: (messages: EncryptedMessagePayload[]) => void
): Unsubscribe {
  const path = `chats/${chatId}/messages`;
  const q = query(
    collection(db, 'chats', chatId, 'messages'),
    where('participantUids', 'array-contains', myUid)
  );
  return onSnapshot(
    q,
    (snapshot) => {
      const list: EncryptedMessagePayload[] = [];
      snapshot.forEach((docSnap) => {
        const d = docSnap.data();
        list.push({
          id: docSnap.id,
          senderUid: String(d.senderUid || ''),
          senderVirtualNumber: String(d.senderVirtualNumber || ''),
          participantUids: Array.isArray(d.participantUids) ? d.participantUids.map(String) : [],
          ciphertext: String(d.ciphertext || ''),
          iv: String(d.iv || ''),
          aad: String(d.aad || ''),
          algo: 'ECDH-P256-AES-256-GCM',
          msgType: (d.msgType as MessageType) || 'text',
          replyToId: String(d.replyToId || ''),
          status: (d.status as 'sent' | 'delivered' | 'read') || 'sent',
          createdAtMs: tsToMs(d.createdAt),
        });
      });
      list.sort((a, b) => a.createdAtMs - b.createdAtMs);
      onData(list);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

export async function sendEncryptedFirestoreMessage(params: {
  chatId: string;
  senderUid: string;
  senderVirtualNumber: string;
  participantUids: string[];
  ciphertext: string;
  iv: string;
  aad: string;
  msgType: MessageType;
  replyToId?: string;
}): Promise<string> {
  const msgId = createRandomId('msg');
  const msgPath = `chats/${params.chatId}/messages/${msgId}`;
  try {
    await setDoc(doc(db, 'chats', params.chatId, 'messages', msgId), {
      senderUid: params.senderUid,
      senderVirtualNumber: clampString(params.senderVirtualNumber, 32),
      participantUids: params.participantUids,
      ciphertext: clampString(params.ciphertext, 16384),
      iv: clampString(params.iv, 64),
      aad: clampString(params.aad, 256),
      algo: 'ECDH-P256-AES-256-GCM',
      msgType: params.msgType,
      replyToId: clampString(params.replyToId || '', 128),
      status: 'sent',
      createdAt: serverTimestamp(),
    });

    await updateDoc(doc(db, 'chats', params.chatId), {
      lastMessageCiphertext: clampString(params.ciphertext, 1024),
      lastMessageIv: clampString(params.iv, 64),
      lastMessageSenderUid: params.senderUid,
      lastMessageStatus: 'sent',
      lastMessageAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return msgId;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, msgPath);
  }
}

export async function markFirestoreMessageStatus(
  chatId: string,
  messageId: string,
  status: 'delivered' | 'read'
): Promise<void> {
  const path = `chats/${chatId}/messages/${messageId}`;
  try {
    await updateDoc(doc(db, 'chats', chatId, 'messages', messageId), {
      status,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function markChatLastMessageStatus(
  chatId: string,
  status: 'delivered' | 'read'
): Promise<void> {
  const path = `chats/${chatId}`;
  try {
    await updateDoc(doc(db, 'chats', chatId), {
      lastMessageStatus: status,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export function subscribeReadReceiptsSetting(
  uid: string,
  onChange: (enabled: boolean) => void
): Unsubscribe {
  const path = `users/${uid}/private/info`;
  return onSnapshot(
    doc(db, 'users', uid, 'private', 'info'),
    (docSnap) => {
      if (!docSnap.exists()) {
        onChange(true);
        return;
      }
      const d = docSnap.data();
      onChange(d.readReceiptsEnabled !== false);
    },
    (error) => {
      handleFirestoreError(error, OperationType.GET, path);
    }
  );
}

export async function updateReadReceiptsSetting(
  uid: string,
  enabled: boolean
): Promise<void> {
  const path = `users/${uid}/private/info`;
  try {
    await updateDoc(doc(db, 'users', uid, 'private', 'info'), {
      readReceiptsEnabled: enabled,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export function subscribePublicStatuses(
  onData: (statuses: StatusItem[]) => void
): Unsubscribe {
  const path = 'statuses';
  const q = query(collection(db, 'statuses'), where('isPublic', '==', true));
  return onSnapshot(
    q,
    (snapshot) => {
      const items: StatusItem[] = [];
      snapshot.forEach((docSnap) => {
        const d = docSnap.data();
        items.push({
          id: docSnap.id,
          ownerUid: String(d.ownerUid || ''),
          virtualNumber: String(d.virtualNumber || ''),
          alias: String(d.alias || 'Anonim'),
          avatarBg: String(d.avatarBg || '#00A884'),
          caption: String(d.caption || ''),
          bgColor: String(d.bgColor || '#008069'),
          isPublic: Boolean(d.isPublic),
          createdAtMs: tsToMs(d.createdAt),
        });
      });
      items.sort((a, b) => b.createdAtMs - a.createdAtMs);
      onData(items);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

export async function publishFirestoreStatus(params: {
  ownerUid: string;
  virtualNumber: string;
  alias: string;
  caption: string;
  bgColor: string;
}): Promise<void> {
  const statusId = createRandomId('sts');
  const path = `statuses/${statusId}`;
  try {
    await setDoc(doc(db, 'statuses', statusId), {
      ownerUid: params.ownerUid,
      virtualNumber: clampString(params.virtualNumber, 32),
      alias: clampString(params.alias, 60),
      caption: clampString(params.caption, 280),
      bgColor: clampString(params.bgColor, 32),
      isPublic: true,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}
