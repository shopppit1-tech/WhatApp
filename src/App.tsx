import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signInWithCredential,
  signOut,
  GoogleAuthProvider,
  type User,
} from 'firebase/auth';
import { Capacitor } from '@capacitor/core';
import { FirebaseAuthentication } from '@capacitor-firebase/authentication';
import { CallModal, type ActiveCallState } from './components/CallModal';
import { CallsPane } from './components/CallsPane';
import { ChatConversationPane } from './components/ChatConversationPane';
import { ChatListPane } from './components/ChatListPane';
import { ContactsPane } from './components/ContactsPane';
import { EncryptionDrawer } from './components/EncryptionDrawer';
import { LoginScreen } from './components/LoginScreen';
import { NavRail } from './components/NavRail';
import { NewChatModal } from './components/NewChatModal';
import { PrivacyPane } from './components/PrivacyPane';
import { StatusPane } from './components/StatusPane';
import {
  auth,
  googleProvider,
  validateFirestoreConnection,
} from './services/firebase';
import {
  createGroupChatRoom,
  deleteSavedContact,
  ensureDirectChatRoom,
  markChatLastMessageStatus,
  markFirestoreMessageStatus,
  publishFirestoreStatus,
  sendEncryptedFirestoreMessage,
  subscribeChatMessages,
  subscribeDirectory,
  subscribeMyChats,
  subscribePublicStatuses,
  subscribeReadReceiptsSetting,
  subscribeSavedContacts,
  syncUserOnGoogleLogin,
  updateReadReceiptsSetting,
  upsertSavedContact,
} from './services/firestoreChatService';
import {
  clearSessionVirtualNumber,
  getOrAssignSessionVirtualNumber,
  getOrCreateIdentityKeyPair,
} from './services/keyVault';
import { registerSW } from 'virtual:pwa-register';
import {
  finishCallSession,
  subscribeMyCallSessions,
  type CallSessionDoc,
} from './services/webrtcCallService';
import {
  requestCallNotificationPermission,
  showIncomingCallNotification,
} from './utils/callNotifications';
import { unlockCallAudio } from './utils/ringtone';
import type {
  ChatFilter,
  ChatThread,
  DecryptedMessage,
  DirectoryProfile,
  EncryptedMessagePayload,
  MessageStatus,
  NavSection,
  SavedContact,
  StatusItem,
} from './types/chat';
import { decodeEnvelopeContent } from './utils/chatHelpers';
import {
  decryptTextPayload,
  deriveGroupAesKey,
  deriveSharedAesKey,
  encryptTextPayload,
  type ExportedIdentityPair,
} from './utils/crypto';
import { createRandomId } from './utils/virtualNumber';

const STATUS_RANK: Record<MessageStatus, number> = {
  sent: 1,
  delivered: 2,
  read: 3,
};

export default function App() {
  const [authReady, setAuthReady] = useState(false);
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [currentUser, setCurrentUser] = useState<DirectoryProfile | null>(null);
  const [identityKeys, setIdentityKeys] = useState<ExportedIdentityPair | null>(null);
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [showAuthorizedDomainsLink, setShowAuthorizedDomainsLink] = useState(false);

  const [darkMode, setDarkMode] = useState<boolean>(() => {
    try {
      return localStorage.getItem('sandiwa_theme') === 'dark';
    } catch {
      return false;
    }
  });

  const [activeTab, setActiveTab] = useState<NavSection>('chats');
  const [chatFilter, setChatFilter] = useState<ChatFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [mobileShowChat, setMobileShowChat] = useState(false);

  const [directory, setDirectory] = useState<DirectoryProfile[]>([]);
  const [savedContacts, setSavedContacts] = useState<SavedContact[]>([]);
  const [rawThreads, setRawThreads] = useState<ChatThread[]>([]);
  const [decryptedThreads, setDecryptedThreads] = useState<ChatThread[]>([]);
  const [rawMessages, setRawMessages] = useState<EncryptedMessagePayload[]>([]);
  const [decryptedMessages, setDecryptedMessages] = useState<DecryptedMessage[]>([]);
  const [statuses, setStatuses] = useState<StatusItem[]>([]);
  const [callSessions, setCallSessions] = useState<CallSessionDoc[]>([]);

  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [encryptionOpen, setEncryptionOpen] = useState(false);
  const [activeCall, setActiveCall] = useState<ActiveCallState | null>(null);
  const [readReceiptsEnabled, setReadReceiptsEnabled] = useState(true);
  const [isPageVisible, setIsPageVisible] = useState(() =>
    typeof document === 'undefined' ? true : document.visibilityState === 'visible'
  );
  const [isDesktopViewport, setIsDesktopViewport] = useState(() =>
    typeof window === 'undefined' ? true : window.matchMedia('(min-width: 768px)').matches
  );

  const handledIncomingCallsRef = useRef<Set<string>>(new Set());
  const pendingMsgStatusRef = useRef<Record<string, MessageStatus>>({});
  const pendingChatStatusRef = useRef<Record<string, MessageStatus>>({});

  // Sync Tailwind dark class on <html>
  useEffect(() => {
    const root = document.documentElement;
    if (darkMode) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    try {
      localStorage.setItem('sandiwa_theme', darkMode ? 'dark' : 'light');
    } catch {
      // Ignore
    }
  }, [darkMode]);

  // Validate Firestore connectivity on boot
  useEffect(() => {
    validateFirestoreConnection();
  }, []);

  // Track tab visibility, responsive conversation pane visibility, unlock Web Audio, and register call notification SW
  useEffect(() => {
    registerSW({ immediate: true });

    const unlock = () => {
      unlockCallAudio();
    };
    const updateVisibility = () => {
      setIsPageVisible(document.visibilityState === 'visible');
    };
    const mq = window.matchMedia('(min-width: 768px)');
    const updateViewport = (e: MediaQueryListEvent) => {
      setIsDesktopViewport(e.matches);
    };
    window.addEventListener('pointerdown', unlock, { passive: true });
    window.addEventListener('keydown', unlock, { passive: true });
    document.addEventListener('visibilitychange', updateVisibility);
    window.addEventListener('focus', updateVisibility);
    mq.addEventListener('change', updateViewport);
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
      document.removeEventListener('visibilitychange', updateVisibility);
      window.removeEventListener('focus', updateVisibility);
      mq.removeEventListener('change', updateViewport);
    };
  }, []);

  // Handle incoming call notification clicks/actions from service worker
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
    const handleSwMessage = (event: MessageEvent) => {
      const data = event.data as {
        type?: string;
        action?: 'focus' | 'accept' | 'reject';
        callId?: string;
      };
      if (data?.type !== 'WHATAPP_CALL_ACTION' || !data.callId) return;

      if (data.action === 'accept') {
        setActiveCall((prev) =>
          prev && prev.callId === data.callId ? { ...prev, autoAccept: true } : prev
        );
      } else if (data.action === 'reject') {
        finishCallSession(data.callId, 'rejected', 0).catch(() => {});
        setActiveCall((prev) => (prev && prev.callId === data.callId ? null : prev));
      }
    };

    navigator.serviceWorker.addEventListener('message', handleSwMessage);
    return () => {
      navigator.serviceWorker.removeEventListener('message', handleSwMessage);
    };
  }, []);

  // Auth listener
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setFirebaseUser(null);
        setCurrentUser(null);
        setIdentityKeys(null);
        setRawThreads([]);
        setDecryptedThreads([]);
        setRawMessages([]);
        setDecryptedMessages([]);
        setSavedContacts([]);
        setCallSessions([]);
        setReadReceiptsEnabled(true);
        pendingMsgStatusRef.current = {};
        pendingChatStatusRef.current = {};
        setActiveChatId(null);
        setAuthReady(true);
        return;
      }

      setLoginLoading(true);
      setLoginError(null);
      try {
        const keys = await getOrCreateIdentityKeyPair(user.uid);
        const virtualNumber = getOrAssignSessionVirtualNumber(user.uid);
        const profile = await syncUserOnGoogleLogin(user, virtualNumber, keys.publicKey);
        setFirebaseUser(user);
        setIdentityKeys(keys);
        setCurrentUser(profile);
      } catch (err) {
        setLoginError(
          err instanceof Error
            ? `Gagal menyiapkan profil virtual terenkripsi: ${err.message}`
            : 'Gagal menyiapkan profil virtual.'
        );
      } finally {
        setLoginLoading(false);
        setAuthReady(true);
      }
    });
    return () => unsub();
  }, []);

  // Firestore real-time subscriptions once signed in
  useEffect(() => {
    if (!currentUser) return;

    const unsubDir = subscribeDirectory((profiles) => {
      setDirectory(profiles);
    });
    const unsubContacts = subscribeSavedContacts(currentUser.uid, (contacts) => {
      setSavedContacts(contacts);
    });
    const unsubChats = subscribeMyChats(currentUser.uid, (threads) => {
      setRawThreads(threads);
    });
    const unsubStatuses = subscribePublicStatuses((items) => {
      setStatuses(items);
    });
    const unsubCalls = subscribeMyCallSessions(currentUser.uid, (sessions) => {
      setCallSessions(sessions);
    });
    const unsubReceipts = subscribeReadReceiptsSetting(currentUser.uid, (enabled) => {
      setReadReceiptsEnabled(enabled);
    });

    return () => {
      unsubDir();
      unsubContacts();
      unsubChats();
      unsubStatuses();
      unsubCalls();
      unsubReceipts();
    };
  }, [currentUser?.uid]);

  const savedContactsByUid = useMemo(() => {
    const map: Record<string, SavedContact> = {};
    for (const c of savedContacts) {
      map[c.contactUid] = c;
    }
    return map;
  }, [savedContacts]);

  const mergedDirectory = useMemo(() => {
    return directory.map((p) => {
      const saved = savedContactsByUid[p.uid];
      return saved ? { ...p, alias: saved.customName } : p;
    });
  }, [directory, savedContactsByUid]);

  const profilesByUid = useMemo(() => {
    const map: Record<string, DirectoryProfile> = {};
    for (const p of mergedDirectory) {
      map[p.uid] = p;
    }
    if (currentUser) {
      map[currentUser.uid] = currentUser;
    }
    return map;
  }, [mergedDirectory, currentUser]);

  // Detect incoming ringing WebRTC calls
  useEffect(() => {
    if (!currentUser || activeCall) return;
    const ringing = callSessions.find(
      (s) =>
        s.calleeUid === currentUser.uid &&
        s.status === 'ringing' &&
        !handledIncomingCallsRef.current.has(s.callId)
    );
    if (!ringing) return;

    handledIncomingCallsRef.current.add(ringing.callId);
    const peerProfile: DirectoryProfile = profilesByUid[ringing.callerUid] || {
      uid: ringing.callerUid,
      virtualNumber: ringing.callerVirtualNumber,
      virtualNumberDigits: ringing.callerVirtualNumber.replace(/\D/g, ''),
      alias: ringing.callerAlias,
      bio: 'Pengguna Nomor Virtual',
      avatarBg: '#00A884',
      publicKey: currentUser.publicKey,
      isDiscoverable: true,
    };

    setActiveCall({
      mode: 'incoming',
      callId: ringing.callId,
      callType: ringing.callType,
      peer: peerProfile,
      incomingSession: ringing,
    });

    showIncomingCallNotification({
      callId: ringing.callId,
      callerAlias: peerProfile.alias,
      callerVirtualNumber: peerProfile.virtualNumber,
      callType: ringing.callType,
    }).catch(() => {});
  }, [callSessions, currentUser, activeCall, profilesByUid]);

  // Helper to derive chat symmetric AES-256-GCM key
  const deriveChatKey = useCallback(
    async (thread: ChatThread): Promise<CryptoKey | null> => {
      if (!identityKeys || !currentUser) return null;
      if (thread.type === 'group') {
        return deriveGroupAesKey(`group:${thread.chatId}`, thread.chatId);
      }
      const peerUid = thread.peerUid || thread.participantUids.find((u) => u !== currentUser.uid);
      const peer = peerUid ? profilesByUid[peerUid] : undefined;
      if (!peer) return null;
      return deriveSharedAesKey(identityKeys.privateKey, peer.publicKey, thread.chatId);
    },
    [identityKeys, currentUser, profilesByUid]
  );

  // Decrypt thread last-message previews
  useEffect(() => {
    let active = true;
    async function decryptThreadPreviews() {
      const next: ChatThread[] = [];
      for (const thread of rawThreads) {
        if (!thread.lastMessageCiphertext || !thread.lastMessageIv) {
          next.push(thread);
          continue;
        }
        try {
          const key = await deriveChatKey(thread);
          if (!key) {
            next.push(thread);
            continue;
          }
          const aad = `${thread.lastMessageSenderUid}:${thread.chatId}`;
          const plain = await decryptTextPayload(
            key,
            thread.lastMessageCiphertext,
            thread.lastMessageIv,
            aad
          );
          const decoded = decodeEnvelopeContent(plain);
          next.push({
            ...thread,
            lastMessagePreview:
              decoded.kind === 'image'
                ? '📷 Foto terenkripsi'
                : decoded.kind === 'voice'
                  ? `🎤 ${decoded.text}`
                  : decoded.text,
          });
        } catch {
          next.push({
            ...thread,
            lastMessagePreview: '🔒 Pesan terenkripsi (kunci sesi diperbarui)',
          });
        }
      }
      if (active) {
        setDecryptedThreads(next);
      }
    }
    decryptThreadPreviews();
    return () => {
      active = false;
    };
  }, [rawThreads, deriveChatKey]);

  // Subscribe to messages of active chat
  useEffect(() => {
    if (!activeChatId || !currentUser) {
      setRawMessages([]);
      setDecryptedMessages([]);
      return;
    }

    const unsub = subscribeChatMessages(activeChatId, currentUser.uid, (msgs) => {
      setRawMessages(msgs);
    });

    return () => unsub();
  }, [activeChatId, currentUser?.uid]);

  // Decrypt active chat messages
  const activeThread = useMemo(
    () => decryptedThreads.find((t) => t.chatId === activeChatId) || null,
    [decryptedThreads, activeChatId]
  );

  const isConversationVisible =
    isPageVisible && activeTab === 'chats' && (isDesktopViewport || mobileShowChat);

  // Mark background / closed chat previews as delivered when user is online
  useEffect(() => {
    if (!currentUser) return;
    for (const thread of rawThreads) {
      if (
        !thread.lastMessageCiphertext ||
        !thread.lastMessageSenderUid ||
        thread.lastMessageSenderUid === currentUser.uid
      ) {
        continue;
      }
      const currentStatus = thread.lastMessageStatus || 'sent';
      if (currentStatus !== 'sent') continue;

      if (thread.chatId === activeChatId && isConversationVisible && readReceiptsEnabled) {
        continue;
      }

      const chatKey = `${thread.chatId}:${thread.lastMessageIv || thread.lastMessageAtMs}`;
      const pending = pendingChatStatusRef.current[chatKey];
      if (pending && STATUS_RANK[pending] >= STATUS_RANK.delivered) continue;

      pendingChatStatusRef.current[chatKey] = 'delivered';
      markChatLastMessageStatus(thread.chatId, 'delivered').catch(() => {
        delete pendingChatStatusRef.current[chatKey];
      });
    }
  }, [rawThreads, currentUser, activeChatId, isConversationVisible, readReceiptsEnabled]);

  useEffect(() => {
    let active = true;
    async function decryptFeed() {
      if (!activeThread || !currentUser) {
        if (active) setDecryptedMessages([]);
        return;
      }
      const key = await deriveChatKey(activeThread);
      const out: DecryptedMessage[] = [];

      for (const msg of rawMessages) {
        if (!key) {
          out.push({
            ...msg,
            plaintext: '🔒 Menunggu kunci publik lawan bicara...',
            decryptionError: true,
          });
          continue;
        }
        try {
          const plain = await decryptTextPayload(key, msg.ciphertext, msg.iv, msg.aad);
          out.push({ ...msg, plaintext: plain });
        } catch {
          out.push({
            ...msg,
            plaintext: '🔒 Pesan ini dienkripsi dengan pasangan kunci sesi sebelumnya.',
            decryptionError: true,
          });
        }
      }

      if (active) {
        setDecryptedMessages(out);
      }
    }
    decryptFeed();
    return () => {
      active = false;
    };
  }, [rawMessages, activeThread, currentUser, deriveChatKey]);

  // Mark incoming messages & active thread preview delivered or read based on screen visibility & privacy toggle
  useEffect(() => {
    if (!activeThread || !currentUser) return;
    const canSendRead = isConversationVisible && readReceiptsEnabled;
    const targetStatus: 'delivered' | 'read' = canSendRead ? 'read' : 'delivered';

    for (const msg of rawMessages) {
      if (msg.senderUid === currentUser.uid) continue;
      if (STATUS_RANK[msg.status] >= STATUS_RANK[targetStatus]) continue;

      const msgKey = `${activeThread.chatId}:${msg.id}`;
      const pending = pendingMsgStatusRef.current[msgKey];
      if (pending && STATUS_RANK[pending] >= STATUS_RANK[targetStatus]) continue;

      pendingMsgStatusRef.current[msgKey] = targetStatus;
      markFirestoreMessageStatus(activeThread.chatId, msg.id, targetStatus).catch(() => {
        delete pendingMsgStatusRef.current[msgKey];
      });
    }

    if (
      activeThread.lastMessageCiphertext &&
      activeThread.lastMessageSenderUid &&
      activeThread.lastMessageSenderUid !== currentUser.uid
    ) {
      const currentChatStatus = activeThread.lastMessageStatus || 'sent';
      if (STATUS_RANK[currentChatStatus] < STATUS_RANK[targetStatus]) {
        const chatKey = `${activeThread.chatId}:${activeThread.lastMessageIv || activeThread.lastMessageAtMs}`;
        const pendingChat = pendingChatStatusRef.current[chatKey];
        if (!pendingChat || STATUS_RANK[pendingChat] < STATUS_RANK[targetStatus]) {
          pendingChatStatusRef.current[chatKey] = targetStatus;
          markChatLastMessageStatus(activeThread.chatId, targetStatus).catch(() => {
            delete pendingChatStatusRef.current[chatKey];
          });
        }
      }
    }
  }, [rawMessages, activeThread, currentUser, isConversationVisible, readReceiptsEnabled]);

  async function handleGoogleLogin() {
    unlockCallAudio();
    requestCallNotificationPermission().catch(() => {});
    setLoginLoading(true);
    setLoginError(null);
    setShowAuthorizedDomainsLink(false);
    try {
      if (Capacitor.isNativePlatform()) {
        const result = await FirebaseAuthentication.signInWithGoogle({
          skipNativeAuth: true,
        });
        const idToken = result.credential?.idToken;
        if (!idToken) {
          throw new Error('Token Google tidak diterima dari login native.');
        }
        await signInWithCredential(auth, GoogleAuthProvider.credential(idToken));
      } else {
        await signInWithPopup(auth, googleProvider);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setShowAuthorizedDomainsLink(
        message.toLowerCase().includes('unauthorized-domain') ||
          message.toLowerCase().includes('requested action is invalid')
      );
      setLoginError(
        err instanceof Error
          ? `Login Google dibatalkan atau gagal: ${err.message}`
          : 'Gagal masuk dengan akun Google.'
      );
      setLoginLoading(false);
    }
  }

  async function handleGoogleRedirect() {
    await handleGoogleLogin();
  }

  async function handleLogout() {
    if (firebaseUser) {
      clearSessionVirtualNumber(firebaseUser.uid);
    }
    await signOut(auth);
  }

  async function handleStartDirectChat(peer: DirectoryProfile) {
    if (!currentUser) return;
    const chatId = await ensureDirectChatRoom(currentUser.uid, peer.uid, peer.alias);
    setActiveChatId(chatId);
    setActiveTab('chats');
    setMobileShowChat(true);
  }

  async function handleCreateGroup(title: string, memberUids: string[]) {
    if (!currentUser) return;
    const chatId = await createGroupChatRoom(currentUser.uid, title, memberUids);
    setActiveChatId(chatId);
    setActiveTab('chats');
    setMobileShowChat(true);
  }

  async function handleSendMessage(
    plaintext: string,
    opts?: { msgType?: 'text' | 'image' | 'voice'; replyToId?: string }
  ) {
    if (!activeThread || !currentUser || !identityKeys) return;
    const sharedKey = await deriveChatKey(activeThread);
    if (!sharedKey) {
      throw new Error('Kunci publik lawan bicara belum tersedia.');
    }

    const aad = `${currentUser.uid}:${activeThread.chatId}`;
    const envelope = await encryptTextPayload(sharedKey, plaintext, aad);

    await sendEncryptedFirestoreMessage({
      chatId: activeThread.chatId,
      senderUid: currentUser.uid,
      senderVirtualNumber: currentUser.virtualNumber,
      participantUids: activeThread.participantUids,
      ciphertext: envelope.ciphertext,
      iv: envelope.iv,
      aad: envelope.aad,
      msgType: opts?.msgType || 'text',
      replyToId: opts?.replyToId,
    });
  }

  async function handleRotateVirtualNumber() {
    if (!firebaseUser || !identityKeys || !currentUser) return;
    const freshNum = getOrAssignSessionVirtualNumber(firebaseUser.uid, true);
    const updated = await syncUserOnGoogleLogin(
      firebaseUser,
      freshNum,
      identityKeys.publicKey,
      currentUser.alias,
      currentUser.bio,
      currentUser.avatarUrl
    );
    setCurrentUser(updated);
  }

  async function handleUpdateProfile(alias: string, bio: string, avatarUrl?: string) {
    if (!firebaseUser || !identityKeys || !currentUser) return;
    const updated = await syncUserOnGoogleLogin(
      firebaseUser,
      currentUser.virtualNumber,
      identityKeys.publicKey,
      alias,
      bio,
      avatarUrl
    );
    setCurrentUser(updated);
  }

  async function handleToggleReadReceipts() {
    if (!currentUser) return;
    const next = !readReceiptsEnabled;
    setReadReceiptsEnabled(next);
    await updateReadReceiptsSetting(currentUser.uid, next);
  }

  async function handleSaveContact(params: {
    contactUid: string;
    customName: string;
    virtualNumber: string;
    notes: string;
  }) {
    if (!currentUser) return;
    await upsertSavedContact({
      ownerUid: currentUser.uid,
      ...params,
    });
  }

  async function handleDeleteContact(contactUid: string) {
    if (!currentUser) return;
    await deleteSavedContact(currentUser.uid, contactUid);
  }

  async function handlePublishStatus(caption: string, bgColor: string) {
    if (!currentUser) return;
    await publishFirestoreStatus({
      ownerUid: currentUser.uid,
      virtualNumber: currentUser.virtualNumber,
      alias: currentUser.alias,
      caption,
      bgColor,
    });
  }

  function handleStartOutgoingCall(peer: DirectoryProfile, callType: 'audio' | 'video') {
    unlockCallAudio();
    requestCallNotificationPermission().catch(() => {});
    setActiveCall({
      mode: 'outgoing',
      callId: createRandomId('call'),
      callType,
      peer,
    });
  }

  if (!authReady) {
    return (
      <div className="min-h-screen bg-[#EFEAE2] dark:bg-[#0B141A] flex flex-col items-center justify-center gap-3 text-[#54656F] dark:text-[#8696A0]">
        <div className="w-10 h-10 rounded-full border-3 border-[#00A884] border-t-transparent animate-spin" />
        <p className="text-sm font-medium">Memuat WhatApp...</p>
      </div>
    );
  }

  if (!firebaseUser || !currentUser) {
    return (
      <LoginScreen
        onGoogleLogin={handleGoogleLogin}
        onGoogleRedirect={handleGoogleRedirect}
        loading={loginLoading}
        errorMsg={loginError}
        showAuthorizedDomainsLink={showAuthorizedDomainsLink}
      />
    );
  }

  const activePeer = activeThread?.peerUid ? profilesByUid[activeThread.peerUid] : undefined;
  const totalUnread = decryptedThreads.reduce((acc, t) => acc + t.unreadCount, 0);

  return (
    <div className="h-screen w-screen overflow-hidden bg-[#EFEAE2] dark:bg-[#0B141A] flex flex-col md:flex-row">
      <NavRail
        activeTab={activeTab}
        onSelectTab={(tab) => {
          setActiveTab(tab);
          if (tab !== 'chats') setMobileShowChat(false);
        }}
        totalUnread={totalUnread}
        darkMode={darkMode}
        onToggleDarkMode={() => setDarkMode((d) => !d)}
        currentUser={currentUser}
      />

      <main className="flex-1 flex h-full min-w-0 overflow-hidden">
        {activeTab === 'chats' && (
          <>
            <div
              className={`${
                mobileShowChat ? 'hidden md:flex' : 'flex'
              } w-full md:w-auto h-full shrink-0`}
            >
              <ChatListPane
                threads={decryptedThreads}
                activeChatId={activeChatId}
                onSelectChat={(chatId) => {
                  setActiveChatId(chatId);
                  setMobileShowChat(true);
                  setEncryptionOpen(false);
                }}
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                filter={chatFilter}
                onFilterChange={setChatFilter}
                profilesByUid={profilesByUid}
                currentUser={currentUser}
                onOpenNewChat={() => setShowNewChatModal(true)}
                onOpenContacts={() => setActiveTab('contacts')}
                onOpenPrivacy={() => setActiveTab('privacy')}
                readReceiptsEnabled={readReceiptsEnabled}
              />
            </div>

            <div
              className={`${
                mobileShowChat ? 'flex' : 'hidden md:flex'
              } flex-1 h-full min-w-0`}
            >
              <ChatConversationPane
                thread={activeThread}
                peer={activePeer}
                profilesByUid={profilesByUid}
                currentUser={currentUser}
                messages={decryptedMessages}
                peerTyping={false}
                onBackMobile={() => setMobileShowChat(false)}
                onSendMessage={handleSendMessage}
                onOpenEncryption={() => setEncryptionOpen(true)}
                onStartCall={(callType) => {
                  if (activePeer) {
                    handleStartOutgoingCall(activePeer, callType);
                  }
                }}
                readReceiptsEnabled={readReceiptsEnabled}
              />
            </div>
          </>
        )}

        {activeTab === 'contacts' && (
          <ContactsPane
            currentUser={currentUser}
            directory={directory}
            savedContacts={savedContacts}
            onSaveContact={handleSaveContact}
            onDeleteContact={handleDeleteContact}
            onStartChat={handleStartDirectChat}
            onStartCall={handleStartOutgoingCall}
          />
        )}

        {activeTab === 'status' && (
          <StatusPane
            statuses={statuses}
            currentUser={currentUser}
            onPublishStatus={handlePublishStatus}
          />
        )}

        {activeTab === 'calls' && (
          <CallsPane
            callSessions={callSessions}
            directory={mergedDirectory}
            currentUserUid={currentUser.uid}
            onStartCall={handleStartOutgoingCall}
          />
        )}

        {activeTab === 'privacy' && (
          <PrivacyPane
            currentUser={currentUser}
            googleEmail={firebaseUser.email || 'Akun Google Terverifikasi'}
            darkMode={darkMode}
            onToggleDarkMode={() => setDarkMode((d) => !d)}
            readReceiptsEnabled={readReceiptsEnabled}
            onToggleReadReceipts={handleToggleReadReceipts}
            onRotateVirtualNumber={handleRotateVirtualNumber}
            onUpdateProfile={handleUpdateProfile}
            onLogout={handleLogout}
          />
        )}
      </main>

      <EncryptionDrawer
        open={encryptionOpen}
        onClose={() => setEncryptionOpen(false)}
        thread={activeThread}
        peer={activePeer}
        savedContact={activePeer ? savedContactsByUid[activePeer.uid] : undefined}
        onSaveContact={handleSaveContact}
        onStartCall={(callType) => {
          if (activePeer) {
            handleStartOutgoingCall(activePeer, callType);
          }
        }}
      />

      <NewChatModal
        open={showNewChatModal}
        onClose={() => setShowNewChatModal(false)}
        directory={mergedDirectory}
        currentUserUid={currentUser.uid}
        onStartDirectChat={handleStartDirectChat}
        onCreateGroup={handleCreateGroup}
      />

      <CallModal
        activeCall={activeCall}
        currentUser={currentUser}
        onClose={() => setActiveCall(null)}
      />
    </div>
  );
}
