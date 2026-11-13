import { useEffect, useState } from 'react';
import {
  Check,
  Copy,
  Lock,
  Phone,
  UserPlus,
  Video,
  X,
} from 'lucide-react';
import type {
  ChatThread,
  DirectoryProfile,
  SavedContact,
} from '../types/chat';
import { Avatar } from './Avatar';

interface EncryptionDrawerProps {
  open: boolean;
  onClose: () => void;
  thread: ChatThread | null;
  peer: DirectoryProfile | undefined;
  savedContact?: SavedContact;
  onSaveContact?: (params: {
    contactUid: string;
    customName: string;
    virtualNumber: string;
    notes: string;
  }) => Promise<void>;
  onStartCall?: (callType: 'audio' | 'video') => void;
}

export function EncryptionDrawer({
  open,
  onClose,
  thread,
  peer,
  savedContact,
  onSaveContact,
  onStartCall,
}: EncryptionDrawerProps) {
  const [copiedNum, setCopiedNum] = useState(false);
  const [editingContact, setEditingContact] = useState(false);
  const [customName, setCustomName] = useState('');
  const [notes, setNotes] = useState('');
  const [savingContact, setSavingContact] = useState(false);

  useEffect(() => {
    setEditingContact(false);
    setCustomName(savedContact?.customName || peer?.alias || '');
    setNotes(savedContact?.notes || '');
  }, [peer?.uid, savedContact?.customName, savedContact?.notes, open]);

  if (!open || !thread) return null;

  const displayName = savedContact?.customName || peer?.alias || thread.title;

  function copyVirtualNumber() {
    if (!peer?.virtualNumber) return;
    navigator.clipboard?.writeText(peer.virtualNumber);
    setCopiedNum(true);
    window.setTimeout(() => setCopiedNum(false), 1500);
  }

  async function handleSaveInlineContact(e: React.FormEvent) {
    e.preventDefault();
    if (!peer || !onSaveContact || !customName.trim()) return;
    setSavingContact(true);
    try {
      await onSaveContact({
        contactUid: peer.uid,
        customName: customName.trim(),
        virtualNumber: peer.virtualNumber,
        notes: notes.trim(),
      });
      setEditingContact(false);
    } finally {
      setSavingContact(false);
    }
  }

  return (
    <aside
      aria-label="Info Kontak"
      className="fixed inset-y-0 right-0 z-40 w-full sm:w-[360px] bg-white dark:bg-[#111B21] border-l border-black/10 dark:border-white/10 shadow-2xl flex flex-col"
    >
      <header className="h-[62px] px-4 bg-[#F0F2F5] dark:bg-[#202C33] border-b border-black/8 dark:border-white/10 flex items-center gap-3 shrink-0">
        <button
          type="button"
          onClick={onClose}
          aria-label="Tutup info kontak"
          className="min-h-[40px] min-w-[40px] rounded-full flex items-center justify-center text-[#54656F] dark:text-[#AEBAC1] hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
        >
          <X className="w-5 h-5" aria-hidden="true" />
        </button>
        <h2 className="text-base font-semibold text-[#111B21] dark:text-[#E9EDEF]">
          Info Kontak
        </h2>
      </header>

      <div className="flex-1 overflow-y-auto p-5 space-y-6">
        {/* Contact Header */}
        <div className="flex flex-col items-center text-center pb-5 border-b border-black/8 dark:border-white/10">
          <Avatar
            name={displayName}
            src={peer?.avatarUrl}
            bg={peer?.avatarBg || '#00A884'}
            size="xl"
            isGroup={thread.type === 'group'}
          />
          <h3 className="mt-3 text-lg font-bold text-[#111B21] dark:text-[#E9EDEF]">
            {displayName}
          </h3>

          {peer ? (
            <div className="mt-1 flex items-center gap-2">
              <span className="text-sm font-mono tabular-nums text-[#008069] dark:text-[#00A884]">
                {peer.virtualNumber}
              </span>
              <button
                type="button"
                onClick={copyVirtualNumber}
                aria-label="Salin nomor virtual kontak"
                className="p-1 rounded hover:bg-black/5 dark:hover:bg-white/5 text-[#54656F] dark:text-[#AEBAC1] cursor-pointer"
              >
                {copiedNum ? (
                  <Check className="w-3.5 h-3.5 text-[#00A884]" aria-hidden="true" />
                ) : (
                  <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                )}
              </button>
            </div>
          ) : (
            <p className="mt-1 text-xs text-[#667781] dark:text-[#8696A0]">
              Grup · {thread.participantUids.length} peserta
            </p>
          )}

          {peer && (
            <div className="mt-4 w-full flex items-center gap-2">
              {onStartCall && (
                <>
                  <button
                    type="button"
                    onClick={() => onStartCall('audio')}
                    className="flex-1 py-2 px-3 rounded-xl bg-[#F0F2F5] dark:bg-[#202C33] hover:bg-[#D9FDD3] dark:hover:bg-[#005C4B] text-xs font-semibold text-[#111B21] dark:text-[#E9EDEF] flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Phone className="w-3.5 h-3.5 text-[#00A884]" aria-hidden="true" />
                    <span>Telepon</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onStartCall('video')}
                    className="flex-1 py-2 px-3 rounded-xl bg-[#F0F2F5] dark:bg-[#202C33] hover:bg-[#D9FDD3] dark:hover:bg-[#005C4B] text-xs font-semibold text-[#111B21] dark:text-[#E9EDEF] flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Video className="w-3.5 h-3.5 text-[#00A884]" aria-hidden="true" />
                    <span>Video</span>
                  </button>
                </>
              )}
              {onSaveContact && (
                <button
                  type="button"
                  onClick={() => setEditingContact((v) => !v)}
                  className="flex-1 py-2 px-3 rounded-xl bg-[#00A884]/12 text-[#008069] dark:text-[#00A884] text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <UserPlus className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>{savedContact ? 'Edit' : 'Simpan'}</span>
                </button>
              )}
            </div>
          )}

          {editingContact && peer && (
            <form
              onSubmit={handleSaveInlineContact}
              className="mt-4 w-full text-left p-3.5 rounded-xl bg-[#F0F2F5] dark:bg-[#202C33] space-y-2.5"
            >
              <input
                type="text"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                maxLength={60}
                required
                aria-label="Nama kontak"
                placeholder="Nama kontak"
                className="w-full px-3 py-2 rounded-lg bg-white dark:bg-[#111B21] text-xs text-[#111B21] dark:text-[#E9EDEF] focus:outline-none"
              />
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                maxLength={160}
                aria-label="Catatan kontak"
                placeholder="Catatan (opsional)"
                className="w-full px-3 py-2 rounded-lg bg-white dark:bg-[#111B21] text-xs text-[#111B21] dark:text-[#E9EDEF] focus:outline-none"
              />
              <button
                type="submit"
                disabled={savingContact}
                className="w-full py-2 rounded-lg bg-[#00A884] text-white text-xs font-semibold cursor-pointer"
              >
                {savingContact ? 'Menyimpan...' : 'Simpan Kontak'}
              </button>
            </form>
          )}
        </div>

        {/* Bio & Notes */}
        {(peer?.bio || savedContact?.notes) && (
          <div className="space-y-3 pb-5 border-b border-black/8 dark:border-white/10 text-xs">
            {peer?.bio && (
              <div>
                <p className="text-[#667781] dark:text-[#8696A0]">Info</p>
                <p className="text-sm text-[#111B21] dark:text-[#E9EDEF] mt-0.5">{peer.bio}</p>
              </div>
            )}
            {savedContact?.notes && (
              <div>
                <p className="text-[#667781] dark:text-[#8696A0]">Catatan</p>
                <p className="text-sm text-[#111B21] dark:text-[#E9EDEF] mt-0.5">
                  {savedContact.notes}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Clean End-to-End Encryption Row */}
        <div className="flex items-start gap-3 text-xs">
          <Lock className="w-4 h-4 text-[#00A884] mt-0.5 shrink-0" aria-hidden="true" />
          <div>
            <p className="text-sm font-semibold text-[#111B21] dark:text-[#E9EDEF]">Enkripsi</p>
            <p className="text-[#54656F] dark:text-[#8696A0] mt-0.5">
              Pesan dan panggilan terenkripsi end-to-end.
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
}
