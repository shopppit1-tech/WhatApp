import { Check, CheckCheck, MessageSquarePlus, Pin, Search, UserPlus, Users } from 'lucide-react';
import type { ChatFilter, ChatThread, DirectoryProfile } from '../types/chat';
import { formatChatListTime } from '../utils/chatHelpers';
import { Avatar } from './Avatar';

interface ChatListPaneProps {
  threads: ChatThread[];
  activeChatId: string | null;
  onSelectChat: (chatId: string) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  filter: ChatFilter;
  onFilterChange: (f: ChatFilter) => void;
  profilesByUid: Record<string, DirectoryProfile>;
  currentUser: DirectoryProfile;
  onOpenNewChat: () => void;
  onOpenContacts: () => void;
  onOpenPrivacy: () => void;
  readReceiptsEnabled?: boolean;
}

export function ChatListPane({
  threads,
  activeChatId,
  onSelectChat,
  searchQuery,
  onSearchChange,
  filter,
  onFilterChange,
  profilesByUid,
  currentUser,
  onOpenNewChat,
  onOpenContacts,
  onOpenPrivacy,
  readReceiptsEnabled = true,
}: ChatListPaneProps) {
  const normalizedQuery = searchQuery.trim().toLowerCase();

  const filteredThreads = threads.filter((thread) => {
    if (filter === 'unread' && thread.unreadCount === 0) return false;
    if (filter === 'groups' && thread.type !== 'group') return false;

    if (!normalizedQuery) return true;
    const peer = thread.peerUid ? profilesByUid[thread.peerUid] : undefined;
    const displayName = (peer?.alias || thread.title).toLowerCase();
    const virtualNum = (peer?.virtualNumber || '').toLowerCase();
    const preview = thread.lastMessagePreview.toLowerCase();
    return (
      displayName.includes(normalizedQuery) ||
      virtualNum.includes(normalizedQuery) ||
      preview.includes(normalizedQuery)
    );
  });

  return (
    <aside
      aria-label="Daftar obrolan"
      className="w-full md:w-[350px] lg:w-[400px] shrink-0 h-full bg-white dark:bg-[#111B21] border-r border-black/8 dark:border-white/10 flex flex-col"
    >
      {/* Top Header */}
      <header className="px-4 pt-3.5 pb-2.5 flex items-center justify-between gap-3 shrink-0">
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-[#111B21] dark:text-[#E9EDEF]">
            Obrolan
          </h1>
          <button
            type="button"
            onClick={onOpenPrivacy}
            className="text-xs font-mono tabular-nums text-[#008069] dark:text-[#00A884] hover:underline truncate block cursor-pointer"
            title="Nomor virtual Anda"
          >
            {currentUser.virtualNumber}
          </button>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={onOpenContacts}
            aria-label="Tambah kontak profil"
            title="Tambah kontak"
            className="min-h-[40px] min-w-[40px] rounded-full flex items-center justify-center text-[#54656F] dark:text-[#AEBAC1] hover:bg-[#F0F2F5] dark:hover:bg-[#202C33] transition-colors cursor-pointer"
          >
            <UserPlus className="w-5 h-5" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={onOpenNewChat}
            aria-label="Mulai obrolan atau grup baru"
            title="Obrolan baru"
            className="min-h-[40px] min-w-[40px] rounded-full flex items-center justify-center text-[#54656F] dark:text-[#AEBAC1] hover:bg-[#F0F2F5] dark:hover:bg-[#202C33] transition-colors cursor-pointer"
          >
            <MessageSquarePlus className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>
      </header>

      {/* Search Bar */}
      <div className="px-3 pb-2 shrink-0">
        <div className="relative flex items-center">
          <Search
            className="w-4 h-4 text-[#54656F] dark:text-[#8696A0] absolute left-3.5 pointer-events-none"
            aria-hidden="true"
          />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            aria-label="Cari obrolan atau nomor virtual"
            placeholder="Cari atau mulai obrolan baru"
            className="w-full pl-10 pr-4 py-2 rounded-lg bg-[#F0F2F5] dark:bg-[#202C33] text-sm text-[#111B21] dark:text-[#E9EDEF] placeholder:text-[#667781] dark:placeholder:text-[#8696A0] focus:outline-none focus:ring-2 focus:ring-[#00A884]/40"
          />
        </div>
      </div>

      {/* Filter Segmented Controls */}
      <div className="px-3 pb-2.5 flex items-center gap-1.5 shrink-0" role="tablist" aria-label="Filter obrolan">
        {(
          [
            { id: 'all', label: 'Semua' },
            { id: 'unread', label: 'Belum dibaca' },
            { id: 'groups', label: 'Grup' },
          ] as const
        ).map((tab) => {
          const active = filter === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onFilterChange(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                active
                  ? 'bg-[#D9FDD3] dark:bg-[#005C4B] text-[#008069] dark:text-[#E9EDEF]'
                  : 'bg-[#F0F2F5] dark:bg-[#202C33] text-[#54656F] dark:text-[#8696A0] hover:bg-black/8 dark:hover:bg-white/10'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Chat List */}
      <div className="flex-1 overflow-y-auto divide-y divide-black/5 dark:divide-white/5 pb-16 md:pb-2">
        {filteredThreads.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <p className="text-sm font-medium text-[#111B21] dark:text-[#E9EDEF]">
              Belum ada obrolan
            </p>
            <button
              type="button"
              onClick={onOpenNewChat}
              className="mt-4 px-4 py-2 rounded-lg bg-[#00A884] text-white text-xs font-semibold hover:bg-[#008F72] transition-colors cursor-pointer"
            >
              Mulai Obrolan Baru
            </button>
          </div>
        ) : (
          filteredThreads.map((thread) => {
            const peer = thread.peerUid ? profilesByUid[thread.peerUid] : undefined;
            const displayName = peer?.alias || thread.title;
            const isSelected = thread.chatId === activeChatId;
            const isSentByMe = thread.lastMessageSenderUid === currentUser.uid;

            return (
              <button
                key={thread.chatId}
                type="button"
                onClick={() => onSelectChat(thread.chatId)}
                aria-label={`Buka obrolan dengan ${displayName}`}
                className={`w-full px-3.5 py-3 flex items-center gap-3 text-left transition-colors cursor-pointer ${
                  isSelected
                    ? 'bg-[#F0F2F5] dark:bg-[#2A3942]'
                    : 'hover:bg-[#F5F6F6] dark:hover:bg-[#202C33]'
                }`}
              >
                <Avatar
                  name={displayName}
                  src={peer?.avatarUrl}
                  bg={peer?.avatarBg || '#00A884'}
                  size="lg"
                  isGroup={thread.type === 'group'}
                />

                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="text-[15px] font-semibold text-[#111B21] dark:text-[#E9EDEF] truncate">
                        {displayName}
                      </span>
                      {thread.type === 'group' && (
                        <Users
                          className="w-3.5 h-3.5 text-[#667781] dark:text-[#8696A0] shrink-0"
                          aria-hidden="true"
                        />
                      )}
                    </div>
                    <span
                      className={`text-[11px] tabular-nums shrink-0 ${
                        thread.unreadCount > 0
                          ? 'text-[#00A884] font-semibold'
                          : 'text-[#667781] dark:text-[#8696A0]'
                      }`}
                    >
                      {formatChatListTime(thread.lastMessageAtMs)}
                    </span>
                  </div>

                  {peer?.virtualNumber && (
                    <p className="text-[11px] font-mono tabular-nums text-[#667781] dark:text-[#8696A0] truncate">
                      {peer.virtualNumber}
                    </p>
                  )}

                  <div className="flex items-center justify-between gap-2 mt-0.5">
                    <div className="flex items-center gap-1 min-w-0 text-[13px] text-[#54656F] dark:text-[#8696A0]">
                      {isSentByMe &&
                        (() => {
                          const rawStatus = thread.lastMessageStatus || 'sent';
                          const effectiveStatus =
                            !readReceiptsEnabled && rawStatus === 'read' ? 'delivered' : rawStatus;
                          if (effectiveStatus === 'read') {
                            return (
                              <CheckCheck
                                className="w-4 h-4 text-[#53BDEB] shrink-0"
                                aria-label="Dibaca"
                              />
                            );
                          }
                          if (effectiveStatus === 'delivered') {
                            return (
                              <CheckCheck
                                className="w-4 h-4 text-[#667781] dark:text-[#8696A0] shrink-0"
                                aria-label="Terkirim ke perangkat"
                              />
                            );
                          }
                          return (
                            <Check
                              className="w-4 h-4 text-[#667781] dark:text-[#8696A0] shrink-0"
                              aria-label="Terkirim"
                            />
                          );
                        })()}
                      <span className="truncate">{thread.lastMessagePreview}</span>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {thread.pinned && (
                        <Pin
                          className="w-3.5 h-3.5 text-[#8696A0] rotate-45"
                          aria-hidden="true"
                        />
                      )}
                      {thread.unreadCount > 0 && (
                        <span className="min-w-[20px] h-[20px] px-1.5 rounded-full bg-[#25D366] text-[#111B21] text-[11px] font-bold flex items-center justify-center tabular-nums">
                          {thread.unreadCount}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>

      {/* Subtle E2EE Footer */}
      <div className="hidden md:flex items-center justify-center gap-1.5 py-2.5 px-4 border-t border-black/5 dark:border-white/5 text-[11px] text-[#667781] dark:text-[#8696A0] shrink-0">
        <Check className="w-3 h-3 text-[#00A884]" aria-hidden="true" />
        <span>Terenkripsi end-to-end</span>
      </div>
    </aside>
  );
}
