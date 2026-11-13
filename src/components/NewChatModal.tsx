import { useState } from 'react';
import { MessageSquarePlus, Search, Users, X } from 'lucide-react';
import type { DirectoryProfile } from '../types/chat';
import { normalizeVirtualDigits } from '../utils/virtualNumber';
import { Avatar } from './Avatar';

interface NewChatModalProps {
  open: boolean;
  onClose: () => void;
  directory: DirectoryProfile[];
  currentUserUid: string;
  onStartDirectChat: (peer: DirectoryProfile) => Promise<void>;
  onCreateGroup: (title: string, memberUids: string[]) => Promise<void>;
}

export function NewChatModal({
  open,
  onClose,
  directory,
  currentUserUid,
  onStartDirectChat,
  onCreateGroup,
}: NewChatModalProps) {
  const [mode, setMode] = useState<'direct' | 'group'>('direct');
  const [search, setSearch] = useState('');
  const [groupTitle, setGroupTitle] = useState('');
  const [selectedUids, setSelectedUids] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  if (!open) return null;

  const peers = directory.filter((p) => p.uid !== currentUserUid);
  const queryNorm = normalizeVirtualDigits(search);
  const queryText = search.trim().toLowerCase();

  const filteredPeers = peers.filter((p) => {
    if (!queryText) return true;
    return (
      p.alias.toLowerCase().includes(queryText) ||
      p.virtualNumber.toLowerCase().includes(queryText) ||
      (queryNorm.length >= 3 && p.virtualNumberDigits.includes(queryNorm))
    );
  });

  function toggleUid(uid: string) {
    setSelectedUids((prev) =>
      prev.includes(uid) ? prev.filter((id) => id !== uid) : [...prev, uid]
    );
  }

  async function handleGroupSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!groupTitle.trim() || selectedUids.length === 0 || submitting) return;
    setSubmitting(true);
    try {
      await onCreateGroup(groupTitle.trim(), selectedUids);
      setGroupTitle('');
      setSelectedUids([]);
      onClose();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Obrolan atau grup baru"
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4"
    >
      <div className="w-full max-w-md bg-white dark:bg-[#111B21] rounded-2xl shadow-2xl border border-black/10 dark:border-white/10 overflow-hidden flex flex-col max-h-[85vh]">
        <header className="px-5 py-4 bg-[#008069] dark:bg-[#202C33] text-white flex items-center justify-between">
          <h2 className="text-base font-semibold">
            {mode === 'direct' ? 'Obrolan Baru' : 'Grup Baru'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup modal obrolan baru"
            className="p-1.5 rounded-full hover:bg-white/15 cursor-pointer"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </header>

        {/* Segmented Mode Switcher */}
        <div className="p-3 border-b border-black/8 dark:border-white/10 flex gap-2">
          <button
            type="button"
            onClick={() => setMode('direct')}
            className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-colors ${
              mode === 'direct'
                ? 'bg-[#D9FDD3] dark:bg-[#005C4B] text-[#008069] dark:text-white'
                : 'bg-[#F0F2F5] dark:bg-[#202C33] text-[#54656F] dark:text-[#AEBAC1]'
            }`}
          >
            <MessageSquarePlus className="w-4 h-4" aria-hidden="true" />
            <span>Chat Baru</span>
          </button>
          <button
            type="button"
            onClick={() => setMode('group')}
            className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-colors ${
              mode === 'group'
                ? 'bg-[#D9FDD3] dark:bg-[#005C4B] text-[#008069] dark:text-white'
                : 'bg-[#F0F2F5] dark:bg-[#202C33] text-[#54656F] dark:text-[#AEBAC1]'
            }`}
          >
            <Users className="w-4 h-4" aria-hidden="true" />
            <span>Grup Baru</span>
          </button>
        </div>

        {mode === 'group' && (
          <form onSubmit={handleGroupSubmit} className="p-3 border-b border-black/8 dark:border-white/10 space-y-2.5">
            <input
              type="text"
              value={groupTitle}
              onChange={(e) => setGroupTitle(e.target.value)}
              aria-label="Nama grup terenkripsi"
              placeholder="Nama grup (mis. Tim Proyek Privat)"
              maxLength={80}
              required
              className="w-full px-3.5 py-2 rounded-lg bg-[#F0F2F5] dark:bg-[#202C33] text-sm text-[#111B21] dark:text-[#E9EDEF] focus:outline-none focus:ring-2 focus:ring-[#00A884]/40"
            />
            <div className="flex items-center justify-between text-xs text-[#667781] dark:text-[#8696A0]">
              <span>{selectedUids.length} peserta dipilih</span>
              <button
                type="submit"
                disabled={!groupTitle.trim() || selectedUids.length === 0 || submitting}
                className="px-4 py-1.5 rounded-lg bg-[#00A884] disabled:opacity-50 text-white font-semibold hover:bg-[#008F72] cursor-pointer"
              >
                {submitting ? 'Membuat...' : 'Buat Grup'}
              </button>
            </div>
          </form>
        )}

        {/* Search Input */}
        <div className="p-3 border-b border-black/5 dark:border-white/5">
          <div className="relative flex items-center">
            <Search className="w-4 h-4 text-[#667781] absolute left-3" aria-hidden="true" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Cari kontak dengan nomor virtual"
              placeholder="Cari nomor virtual (+62 899...) atau alias"
              className="w-full pl-9 pr-3 py-2 rounded-lg bg-[#F0F2F5] dark:bg-[#202C33] text-sm text-[#111B21] dark:text-[#E9EDEF] focus:outline-none"
            />
          </div>
        </div>

        {/* Directory List */}
        <div className="flex-1 overflow-y-auto divide-y divide-black/5 dark:divide-white/5">
          {filteredPeers.length === 0 ? (
            <p className="p-6 text-center text-xs text-[#667781] dark:text-[#8696A0]">
              Belum ada kontak lain yang tersedia.
            </p>
          ) : (
            filteredPeers.map((peer) => {
              const checked = selectedUids.includes(peer.uid);
              return (
                <button
                  key={peer.uid}
                  type="button"
                  onClick={async () => {
                    if (mode === 'direct') {
                      await onStartDirectChat(peer);
                      onClose();
                    } else {
                      toggleUid(peer.uid);
                    }
                  }}
                  className="w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-[#F5F6F6] dark:hover:bg-[#202C33] transition-colors cursor-pointer"
                >
                  <Avatar
                    name={peer.alias}
                    src={peer.avatarUrl}
                    bg={peer.avatarBg}
                    size="md"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-[#111B21] dark:text-[#E9EDEF] truncate">
                        {peer.alias}
                      </p>
                      <span className="text-[11px] font-mono tabular-nums text-[#008069] dark:text-[#00A884] shrink-0">
                        {peer.virtualNumber}
                      </span>
                    </div>
                    <p className="text-xs text-[#667781] dark:text-[#8696A0] truncate">
                      {peer.bio}
                    </p>
                  </div>

                  {mode === 'group' && (
                    <input
                      type="checkbox"
                      checked={checked}
                      readOnly
                      aria-label={`Pilih ${peer.alias}`}
                      className="w-4 h-4 accent-[#00A884]"
                    />
                  )}
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
