export interface EcPublicKeyJwk {
  kty: 'EC';
  crv: 'P-256';
  x: string;
  y: string;
}

export interface EcPrivateKeyJwk extends EcPublicKeyJwk {
  d: string;
}

export interface DirectoryProfile {
  uid: string;
  virtualNumber: string;
  virtualNumberDigits: string;
  alias: string;
  bio: string;
  avatarBg: string;
  avatarUrl?: string;
  publicKey: EcPublicKeyJwk;
  isDiscoverable: boolean;
  online?: boolean;
  lastSeenLabel?: string;
}

export interface PrivateUserInfo {
  uid: string;
  email: string;
  displayName: string;
  currentVirtualNumber: string;
  readReceiptsEnabled?: boolean;
}

export type MessageType = 'text' | 'image' | 'voice' | 'system';
export type MessageStatus = 'sent' | 'delivered' | 'read';

export interface EncryptedMessagePayload {
  id: string;
  senderUid: string;
  senderVirtualNumber: string;
  participantUids: string[];
  ciphertext: string;
  iv: string;
  aad: string;
  algo: 'ECDH-P256-AES-256-GCM';
  msgType: MessageType;
  replyToId: string;
  status: MessageStatus;
  createdAtMs: number;
}

export interface DecryptedMessage extends EncryptedMessagePayload {
  plaintext: string;
  mediaDataUrl?: string;
  durationSec?: number;
  decryptionError?: boolean;
}

export interface ChatThread {
  chatId: string;
  type: 'direct' | 'group';
  title: string;
  createdBy: string;
  participantUids: string[];
  peerUid?: string;
  lastMessageCiphertext: string;
  lastMessageIv: string;
  lastMessageSenderUid: string;
  lastMessageStatus?: MessageStatus;
  lastMessagePreview: string;
  lastMessageAtMs: number;
  unreadCount: number;
  pinned?: boolean;
}

export interface StatusItem {
  id: string;
  ownerUid: string;
  virtualNumber: string;
  alias: string;
  avatarUrl?: string;
  avatarBg: string;
  caption: string;
  bgColor: string;
  isPublic: boolean;
  createdAtMs: number;
}

export interface CallRecord {
  id: string;
  peerUid: string;
  peerAlias: string;
  peerVirtualNumber: string;
  peerAvatarUrl?: string;
  peerAvatarBg: string;
  callType: 'audio' | 'video';
  direction: 'incoming' | 'outgoing' | 'missed';
  durationSec: number;
  timestampMs: number;
}

export interface SavedContact {
  ownerUid: string;
  contactUid: string;
  customName: string;
  virtualNumber: string;
  notes: string;
  createdAtMs: number;
}

export type NavSection = 'chats' | 'contacts' | 'status' | 'calls' | 'privacy';
export type ChatFilter = 'all' | 'unread' | 'groups';
