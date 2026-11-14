import { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  Check,
  CheckCheck,
  Copy,
  Image as ImageIcon,
  Info,
  Lock,
  Mic,
  Pause,
  Phone,
  Play,
  Reply,
  Search,
  Send,
  Smile,
  Square,
  Video,
  X,
} from 'lucide-react';
import type { ChatThread, DecryptedMessage, DirectoryProfile } from '../types/chat';
import {
  decodeEnvelopeContent,
  formatDateDivider,
  formatDurationSec,
  formatTimeClock,
  isSameDay,
} from '../utils/chatHelpers';
import { Avatar } from './Avatar';
import whatappLogo from '../assets/images/whatapp_logo_1794610455639.jpg';

const QUICK_EMOJIS = ['👍', '❤️', '😂', '🙏', '🔥', '🔐', '✅', '🎉', '😎', '🤝', '🚀', '🛡️'];

interface ChatConversationPaneProps {
  thread: ChatThread | null;
  peer: DirectoryProfile | undefined;
  profilesByUid: Record<string, DirectoryProfile>;
  currentUser: DirectoryProfile;
  messages: DecryptedMessage[];
  peerTyping: boolean;
  onBackMobile: () => void;
  onSendMessage: (
    text: string,
    opts?: { msgType?: 'text' | 'image' | 'voice'; replyToId?: string }
  ) => Promise<void>;
  onOpenEncryption: () => void;
  onStartCall: (callType: 'audio' | 'video') => void;
  readReceiptsEnabled?: boolean;
}

export function ChatConversationPane({
  thread,
  peer,
  profilesByUid,
  currentUser,
  messages,
  peerTyping,
  onBackMobile,
  onSendMessage,
  onOpenEncryption,
  onStartCall,
  readReceiptsEnabled = true,
}: ChatConversationPaneProps) {
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [replyTo, setReplyTo] = useState<DecryptedMessage | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showSearchBar, setShowSearchBar] = useState(false);
  const [messageSearch, setMessageSearch] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [recordSec, setRecordSec] = useState(0);
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [activeMsgId, setActiveMsgId] = useState<string | null>(null);

  const feedEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordTimerRef = useRef<number | null>(null);

  useEffect(() => {
    feedEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [thread?.chatId, messages.length]);

  useEffect(() => {
    setReplyTo(null);
    setShowSearchBar(false);
    setMessageSearch('');
    setShowEmojiPicker(false);
    setActiveMsgId(null);
  }, [thread?.chatId]);

  useEffect(() => {
    return () => {
      if (recordTimerRef.current) window.clearInterval(recordTimerRef.current);
    };
  }, []);

  if (!thread) {
    return (
      <section
        aria-label="Obrolan sedang dimuat"
        className="flex flex-1 flex-col items-center justify-center bg-[#F0F2F5] dark:bg-[#222E35] p-4 md:p-10 text-center border-b-[6px] border-[#00A884]"
      >
        <div className="md:hidden flex flex-col items-center gap-4" aria-live="polite">
          <span className="w-8 h-8 rounded-full border-2 border-[#00A884]/30 border-t-[#00A884] animate-spin" aria-hidden="true" />
          <p className="text-sm text-[#54656F] dark:text-[#AEBAC1]">Memuat obrolan…</p>
          <button
            type="button"
            onClick={onBackMobile}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white dark:bg-[#202C33] text-sm text-[#111B21] dark:text-[#E9EDEF]"
          >
            <ArrowLeft className="w-4 h-4" aria-hidden="true" />
            Kembali ke obrolan
          </button>
        </div>
        <div className="hidden md:flex flex-col items-center justify-center text-center">
          <img
            src={whatappLogo}
            alt="Logo WhatApp"
            referrerPolicy="no-referrer"
            className="w-20 h-20 rounded-2xl shadow-md object-cover mb-5"
          />
          <h2 className="text-2xl font-bold text-[#111B21] dark:text-[#E9EDEF] tracking-tight">
            WhatApp
          </h2>
          <div className="mt-4 flex items-center gap-2 text-xs text-[#667781] dark:text-[#8696A0]">
            <Lock className="w-3.5 h-3.5 text-[#00A884]" aria-hidden="true" />
            <span>Pesan dan panggilan terenkripsi end-to-end.</span>
          </div>
        </div>
      </section>
    );
  }

  const headerName = peer?.alias || thread.title;
  const headerSubtitle = peerTyping
    ? 'sedang mengetik...'
    : thread.type === 'group'
      ? `${thread.participantUids.length} peserta`
      : peer?.virtualNumber || '';

  const filteredMessages = messageSearch.trim()
    ? messages.filter((m) =>
        m.plaintext.toLowerCase().includes(messageSearch.trim().toLowerCase())
      )
    : messages;

  const messageMap = Object.fromEntries(messages.map((m) => [m.id, m]));

  async function handleSendText(e?: React.FormEvent) {
    e?.preventDefault();
    const trimmed = draft.trim();
    if (!trimmed || sending) return;
    setSending(true);
    setSendError(null);
    try {
      await onSendMessage(trimmed, { msgType: 'text', replyToId: replyTo?.id });
      setDraft('');
      setReplyTo(null);
      setShowEmojiPicker(false);
    } catch {
      setSendError('Pesan gagal dikirim. Periksa koneksi dan coba lagi.');
    } finally {
      setSending(false);
    }
  }

  function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = async () => {
        const canvas = document.createElement('canvas');
        const maxW = 320;
        const scale = Math.min(1, maxW / img.width);
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const compressedUrl = canvas.toDataURL('image/jpeg', 0.55);
        const payload = JSON.stringify({
          __sandiwa_media: true,
          kind: 'image',
          text: file.name || 'Foto Terenkripsi',
          mediaDataUrl: compressedUrl,
        });
        await onSendMessage(payload, { msgType: 'image', replyToId: replyTo?.id });
        setReplyTo(null);
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  }

  async function toggleVoiceRecording() {
    if (isRecording) {
      if (recordTimerRef.current) {
        window.clearInterval(recordTimerRef.current);
        recordTimerRef.current = null;
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
        mediaRecorderRef.current.stream.getTracks().forEach((t) => t.stop());
      }
      const duration = Math.max(1, recordSec);
      setIsRecording(false);
      setRecordSec(0);
      const payload = JSON.stringify({
        __sandiwa_media: true,
        kind: 'voice',
        text: `Pesan suara (${formatDurationSec(duration)})`,
        durationSec: duration,
      });
      await onSendMessage(payload, { msgType: 'voice', replyToId: replyTo?.id });
      setReplyTo(null);
      return;
    }

    setIsRecording(true);
    setRecordSec(1);
    recordTimerRef.current = window.setInterval(() => {
      setRecordSec((prev) => prev + 1);
    }, 1000);

    try {
      if (navigator.mediaDevices?.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const recorder = new MediaRecorder(stream);
        mediaRecorderRef.current = recorder;
        recorder.start();
      }
    } catch {
      // Allow graceful encrypted voice-note timer fallback when mic permission is absent
    }
  }

  function handlePlayVoice(msgId: string, durationSec = 4) {
    if (playingVoiceId === msgId) {
      setPlayingVoiceId(null);
      return;
    }
    setPlayingVoiceId(msgId);
    window.setTimeout(() => {
      setPlayingVoiceId((curr) => (curr === msgId ? null : curr));
    }, Math.min(durationSec, 8) * 1000);
  }

  function handleCopyMessage(msg: DecryptedMessage) {
    const decoded = decodeEnvelopeContent(msg.plaintext);
    navigator.clipboard?.writeText(decoded.text);
    setCopiedId(msg.id);
    window.setTimeout(() => setCopiedId(null), 1500);
  }

  return (
    <section
      aria-label={`Percakapan dengan ${headerName}`}
      className="flex-1 flex flex-col h-full min-w-0 bg-[#EFEAE2] dark:bg-[#0B141A]"
    >
      {/* Top Chat Header */}
      <header className="h-[62px] px-3 md:px-4 bg-[#F0F2F5] dark:bg-[#202C33] border-b border-black/8 dark:border-white/10 flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            type="button"
            onClick={onBackMobile}
            aria-label="Kembali ke daftar obrolan"
            className="md:hidden min-h-[40px] min-w-[40px] rounded-full flex items-center justify-center text-[#54656F] dark:text-[#AEBAC1] hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
          >
            <ArrowLeft className="w-5 h-5" aria-hidden="true" />
          </button>

          <button
            type="button"
            onClick={() => onOpenEncryption()}
            aria-label={`Lihat info enkripsi ${headerName}`}
            className="flex items-center gap-3 min-w-0 text-left cursor-pointer"
          >
            <Avatar
              name={headerName}
              src={peer?.avatarUrl}
              bg={peer?.avatarBg || '#00A884'}
              size="md"
              isGroup={thread.type === 'group'}
            />
            <div className="min-w-0">
              <h2 className="text-[15px] font-semibold text-[#111B21] dark:text-[#E9EDEF] truncate">
                {headerName}
              </h2>
              <p
                className={`text-xs truncate font-mono tabular-nums ${
                  peerTyping
                    ? 'text-[#00A884] font-medium'
                    : 'text-[#54656F] dark:text-[#8696A0]'
                }`}
              >
                {headerSubtitle}
              </p>
            </div>
          </button>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {thread.type === 'direct' && (
            <>
              <button
                type="button"
                disabled={!peer}
                onClick={() => onStartCall('video')}
                aria-label="Panggilan video"
                title="Panggilan video"
                className="min-h-[40px] min-w-[40px] rounded-full flex items-center justify-center text-[#54656F] dark:text-[#AEBAC1] hover:bg-black/5 dark:hover:bg-white/5 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
              >
                <Video className="w-5 h-5" aria-hidden="true" />
              </button>
              <button
                type="button"
                disabled={!peer}
                onClick={() => onStartCall('audio')}
                aria-label="Panggilan suara"
                title="Panggilan suara"
                className="min-h-[40px] min-w-[40px] rounded-full flex items-center justify-center text-[#54656F] dark:text-[#AEBAC1] hover:bg-black/5 dark:hover:bg-white/5 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
              >
                <Phone className="w-5 h-5" aria-hidden="true" />
              </button>
            </>
          )}

          <button
            type="button"
            onClick={() => setShowSearchBar((v) => !v)}
            aria-label="Cari pesan dalam obrolan"
            title="Cari pesan"
            className="min-h-[40px] min-w-[40px] rounded-full flex items-center justify-center text-[#54656F] dark:text-[#AEBAC1] hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
          >
            <Search className="w-5 h-5" aria-hidden="true" />
          </button>

          <button
            type="button"
            onClick={() => onOpenEncryption()}
            aria-label="Info kontak"
            title="Info kontak"
            className="min-h-[40px] min-w-[40px] rounded-full flex items-center justify-center text-[#54656F] dark:text-[#AEBAC1] hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
          >
            <Info className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>
      </header>

      {/* Optional Search Inside Chat Bar */}
      {showSearchBar && (
        <div className="px-4 py-2 bg-white dark:bg-[#111B21] border-b border-black/8 dark:border-white/10 flex items-center gap-2 shrink-0">
          <Search className="w-4 h-4 text-[#667781]" aria-hidden="true" />
          <input
            type="search"
            value={messageSearch}
            onChange={(e) => setMessageSearch(e.target.value)}
            aria-label="Cari teks pesan"
            placeholder="Cari pesan..."
            autoFocus
            className="flex-1 bg-transparent text-sm text-[#111B21] dark:text-[#E9EDEF] focus:outline-none"
          />
          <button
            type="button"
            onClick={() => {
              setMessageSearch('');
              setShowSearchBar(false);
            }}
            aria-label="Tutup pencarian pesan"
            className="p-1 text-[#54656F] dark:text-[#AEBAC1] hover:text-[#111B21] cursor-pointer"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      )}

      {/* Message Feed */}
      <div
        data-testid="message-feed"
        className="flex-1 overflow-y-auto px-3 sm:px-6 md:px-10 py-4 space-y-2 wa-chat-bg-light dark:wa-chat-bg-dark"
      >
        {/* Classic WhatsApp E2EE Yellow Notice */}
        <div className="flex justify-center mb-3">
          <button
            type="button"
            onClick={() => onOpenEncryption()}
            className="max-w-md px-4 py-2 rounded-xl bg-[#FFEECD] dark:bg-[#182229] text-[#54656F] dark:text-[#FFD279] text-xs text-center shadow-xs hover:brightness-98 transition cursor-pointer"
          >
            <span className="inline-flex items-center gap-1.5 font-medium">
              <Lock className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span>Pesan dan panggilan terenkripsi end-to-end.</span>
            </span>
          </button>
        </div>

        {filteredMessages.map((msg, idx) => {
          const prev = idx > 0 ? filteredMessages[idx - 1] : null;
          const showDate = !prev || !isSameDay(prev.createdAtMs, msg.createdAtMs);
          const isMine = msg.senderUid === currentUser.uid;
          const senderProfile = profilesByUid[msg.senderUid];
          const decoded = decodeEnvelopeContent(msg.plaintext);
          const repliedMsg = msg.replyToId ? messageMap[msg.replyToId] : undefined;
          const repliedDecoded = repliedMsg ? decodeEnvelopeContent(repliedMsg.plaintext) : null;

          return (
            <div key={msg.id} className="space-y-2">
              {showDate && (
                <div className="flex justify-center my-3">
                  <span className="px-3 py-1 rounded-lg bg-white/90 dark:bg-[#182229] text-[#54656F] dark:text-[#8696A0] text-[11px] font-medium shadow-xs">
                    {formatDateDivider(msg.createdAtMs)}
                  </span>
                </div>
              )}

              <div className={`flex ${isMine ? 'justify-end' : 'justify-start'} group`}>
                <div
                  onClick={() => setActiveMsgId((curr) => (curr === msg.id ? null : msg.id))}
                  className={`relative max-w-[85%] sm:max-w-[70%] lg:max-w-[60%] rounded-xl px-3 py-2 shadow-xs ${
                    isMine
                      ? 'bg-[#D9FDD3] dark:bg-[#005C4B] text-[#111B21] dark:text-[#E9EDEF] rounded-tr-xs'
                      : 'bg-white dark:bg-[#202C33] text-[#111B21] dark:text-[#E9EDEF] rounded-tl-xs'
                  }`}
                >
                  {/* Group Sender Label with Virtual Number */}
                  {thread.type === 'group' && !isMine && (
                    <p className="text-[11px] font-semibold text-[#008069] dark:text-[#00A884] mb-0.5 flex items-center gap-1.5">
                      <span>{senderProfile?.alias || 'Anonim'}</span>
                      <span className="font-mono font-normal text-[10px] opacity-75">
                        {msg.senderVirtualNumber}
                      </span>
                    </p>
                  )}

                  {/* Reply Quote Preview */}
                  {repliedMsg && repliedDecoded && (
                    <div className="mb-1.5 px-2.5 py-1.5 rounded-lg bg-black/5 dark:bg-black/25 text-xs">
                      <p className="font-semibold text-[#008069] dark:text-[#00A884]">
                        {repliedMsg.senderUid === currentUser.uid
                          ? 'Anda'
                          : profilesByUid[repliedMsg.senderUid]?.alias || repliedMsg.senderVirtualNumber}
                      </p>
                      <p className="text-[#54656F] dark:text-[#AEBAC1] truncate">
                        {repliedDecoded.text}
                      </p>
                    </div>
                  )}

                  {/* Message Body by Kind */}
                  {decoded.kind === 'image' && decoded.mediaDataUrl ? (
                    <div className="space-y-1.5">
                      <img
                        src={decoded.mediaDataUrl}
                        alt={decoded.text || 'Gambar terenkripsi'}
                        className="rounded-lg max-h-64 w-auto object-cover"
                      />
                      <p className="text-xs opacity-80">{decoded.text}</p>
                    </div>
                  ) : decoded.kind === 'voice' ? (
                    <div className="flex items-center gap-3 min-w-[200px] py-1">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handlePlayVoice(msg.id, decoded.durationSec);
                        }}
                        aria-label={playingVoiceId === msg.id ? 'Jeda pesan suara' : 'Putar pesan suara'}
                        className="w-9 h-9 rounded-full bg-[#00A884] text-white flex items-center justify-center shrink-0 cursor-pointer"
                      >
                        {playingVoiceId === msg.id ? (
                          <Pause className="w-4 h-4" aria-hidden="true" />
                        ) : (
                          <Play className="w-4 h-4 ml-0.5" aria-hidden="true" />
                        )}
                      </button>
                      <div className="flex-1">
                        <div className="flex items-center gap-0.5 h-5" aria-hidden="true">
                          {[35, 65, 90, 50, 80, 100, 45, 70, 85, 40, 60, 30].map((h, i) => (
                            <span
                              key={i}
                              style={{ height: `${h}%` }}
                              className={`w-1 rounded-full ${
                                playingVoiceId === msg.id
                                  ? 'bg-[#00A884]'
                                  : 'bg-[#8696A0]/60'
                              }`}
                            />
                          ))}
                        </div>
                        <p className="text-[11px] font-mono tabular-nums text-[#54656F] dark:text-[#AEBAC1] mt-0.5">
                          {formatDurationSec(decoded.durationSec || 4)}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-[14.5px] leading-[1.45] whitespace-pre-wrap break-words">
                      {msg.plaintext}
                    </p>
                  )}

                  {/* Footer: Timestamp + Checkmarks + Quick Actions */}
                  <div className="mt-1 flex items-center justify-end gap-1.5">
                    <div
                      className={`flex items-center gap-1 mr-1 transition-opacity ${
                        activeMsgId === msg.id
                          ? 'opacity-100'
                          : 'opacity-0 group-hover:opacity-100 focus-within:opacity-100'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setReplyTo(msg);
                        }}
                        aria-label="Balas pesan ini"
                        title="Balas"
                        className="p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 text-[#54656F] dark:text-[#AEBAC1] cursor-pointer"
                      >
                        <Reply className="w-3.5 h-3.5" aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCopyMessage(msg);
                        }}
                        aria-label="Salin teks pesan"
                        title="Salin"
                        className="p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 text-[#54656F] dark:text-[#AEBAC1] cursor-pointer"
                      >
                        {copiedId === msg.id ? (
                          <Check className="w-3.5 h-3.5 text-[#00A884]" aria-hidden="true" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                        )}
                      </button>
                    </div>

                    <span className="text-[11px] font-mono tabular-nums text-[#667781] dark:text-[#8696A0]">
                      {formatTimeClock(msg.createdAtMs)}
                    </span>

                    {isMine &&
                      (() => {
                        const effectiveStatus =
                          !readReceiptsEnabled && msg.status === 'read' ? 'delivered' : msg.status;
                        if (effectiveStatus === 'read') {
                          return (
                            <span title="Dibaca" className="inline-flex items-center">
                              <CheckCheck
                                className="w-4 h-4 text-[#53BDEB]"
                                aria-label="Dibaca"
                              />
                            </span>
                          );
                        }
                        if (effectiveStatus === 'delivered') {
                          return (
                            <span title="Terkirim ke perangkat" className="inline-flex items-center">
                              <CheckCheck
                                className="w-4 h-4 text-[#667781] dark:text-[#8696A0]"
                                aria-label="Terkirim ke perangkat"
                              />
                            </span>
                          );
                        }
                        return (
                          <span title="Terkirim" className="inline-flex items-center">
                            <Check
                              className="w-4 h-4 text-[#667781] dark:text-[#8696A0]"
                              aria-label="Terkirim"
                            />
                          </span>
                        );
                      })()}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        <div ref={feedEndRef} />
      </div>

      {/* Reply Bar */}
      {replyTo && (
        <div className="px-4 py-2 bg-[#F0F2F5] dark:bg-[#202C33] border-t border-black/8 dark:border-white/10 flex items-center justify-between gap-3 shrink-0">
          <div className="min-w-0 flex-1 pl-3 py-1 rounded-lg bg-white/80 dark:bg-[#111B21]">
            <p className="text-xs font-semibold text-[#008069] dark:text-[#00A884]">
              Membalas{' '}
              {replyTo.senderUid === currentUser.uid
                ? 'diri sendiri'
                : profilesByUid[replyTo.senderUid]?.alias || replyTo.senderVirtualNumber}
            </p>
            <p className="text-xs text-[#54656F] dark:text-[#AEBAC1] truncate">
              {decodeEnvelopeContent(replyTo.plaintext).text}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setReplyTo(null)}
            aria-label="Batalkan balasan"
            className="p-2 text-[#54656F] dark:text-[#AEBAC1] hover:text-[#111B21] cursor-pointer"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      )}

      {/* Composer Bar */}
      <footer className="relative px-3 py-2.5 bg-[#F0F2F5] dark:bg-[#202C33] border-t border-black/8 dark:border-white/10 shrink-0 mb-[60px] md:mb-0">
        {sendError && (
          <p role="alert" className="mb-2 rounded-lg bg-red-100 px-3 py-2 text-xs text-red-800 dark:bg-red-950/60 dark:text-red-200">
            {sendError}
          </p>
        )}
        {showEmojiPicker && (
          <div
            role="dialog"
            aria-label="Pemilih emoji"
            className="absolute bottom-full left-3 mb-2 p-2.5 rounded-xl bg-white dark:bg-[#233138] shadow-lg border border-black/8 dark:border-white/10 flex flex-wrap gap-1.5 max-w-xs z-20"
          >
            {QUICK_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => setDraft((prev) => prev + emoji)}
                className="w-9 h-9 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 text-lg flex items-center justify-center cursor-pointer"
              >
                {emoji}
              </button>
            ))}
          </div>
        )}

        <form onSubmit={handleSendText} className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowEmojiPicker((v) => !v)}
            aria-label="Pilih emoji"
            title="Emoji"
            className="min-h-[42px] min-w-[42px] rounded-full flex items-center justify-center text-[#54656F] dark:text-[#AEBAC1] hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
          >
            <Smile className="w-5 h-5" aria-hidden="true" />
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageSelect}
            className="hidden"
            aria-label="Unggah gambar terenkripsi"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            aria-label="Kirim gambar terenkripsi"
            title="Kirim gambar E2EE"
            className="min-h-[42px] min-w-[42px] rounded-full flex items-center justify-center text-[#54656F] dark:text-[#AEBAC1] hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
          >
            <ImageIcon className="w-5 h-5" aria-hidden="true" />
          </button>

          {isRecording ? (
            <div className="flex-1 px-4 py-2.5 rounded-xl bg-white dark:bg-[#2A3942] flex items-center justify-between text-sm">
              <span className="text-red-600 dark:text-red-400 font-medium">
                Merekam pesan suara...
              </span>
              <span className="font-mono tabular-nums text-[#111B21] dark:text-[#E9EDEF]">
                {formatDurationSec(recordSec)}
              </span>
            </div>
          ) : (
            <input
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              aria-label="Ketik pesan"
              placeholder="Ketik pesan"
              className="flex-1 px-4 py-2.5 rounded-xl bg-white dark:bg-[#2A3942] text-sm text-[#111B21] dark:text-[#E9EDEF] placeholder:text-[#667781] dark:placeholder:text-[#8696A0] focus:outline-none focus:ring-2 focus:ring-[#00A884]/40"
            />
          )}

          {draft.trim().length > 0 ? (
            <button
              type="submit"
              disabled={sending}
              aria-label="Kirim pesan"
              className="min-h-[42px] min-w-[42px] rounded-full bg-[#00A884] hover:bg-[#008F72] text-white flex items-center justify-center transition-colors cursor-pointer"
            >
              <Send className="w-5 h-5" aria-hidden="true" />
            </button>
          ) : (
            <button
              type="button"
              onClick={toggleVoiceRecording}
              aria-label={isRecording ? 'Berhenti dan kirim pesan suara' : 'Rekam pesan suara'}
              title={isRecording ? 'Kirim pesan suara' : 'Rekam suara'}
              className={`min-h-[42px] min-w-[42px] rounded-full flex items-center justify-center transition-colors cursor-pointer ${
                isRecording
                  ? 'bg-red-600 text-white hover:bg-red-700'
                  : 'text-[#54656F] dark:text-[#AEBAC1] hover:bg-black/5 dark:hover:bg-white/5'
              }`}
            >
              {isRecording ? (
                <Square className="w-4 h-4" aria-hidden="true" />
              ) : (
                <Mic className="w-5 h-5" aria-hidden="true" />
              )}
            </button>
          )}
        </form>
      </footer>
    </section>
  );
}
