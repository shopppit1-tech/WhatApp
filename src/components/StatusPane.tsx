import { useState } from 'react';
import { Plus, Send, X } from 'lucide-react';
import type { DirectoryProfile, StatusItem } from '../types/chat';
import { formatChatListTime } from '../utils/chatHelpers';
import { Avatar } from './Avatar';

const STATUS_COLORS = ['#008069', '#027EB5', '#6B5CE7', '#C25975', '#1F2937'] as const;

interface StatusPaneProps {
  statuses: StatusItem[];
  currentUser: DirectoryProfile;
  onPublishStatus: (caption: string, bgColor: string) => Promise<void>;
}

export function StatusPane({ statuses, currentUser, onPublishStatus }: StatusPaneProps) {
  const [selectedStatus, setSelectedStatus] = useState<StatusItem | null>(
    statuses[0] || null
  );
  const [composing, setComposing] = useState(false);
  const [caption, setCaption] = useState('');
  const [bgColor, setBgColor] = useState<string>(STATUS_COLORS[0]);
  const [submitting, setSubmitting] = useState(false);

  async function handlePublish(e: React.FormEvent) {
    e.preventDefault();
    if (!caption.trim() || submitting) return;
    setSubmitting(true);
    try {
      await onPublishStatus(caption.trim(), bgColor);
      setCaption('');
      setComposing(false);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex-1 flex h-full overflow-hidden">
      {/* Left List */}
      <aside className="w-full md:w-[350px] lg:w-[400px] shrink-0 bg-white dark:bg-[#111B21] border-r border-black/8 dark:border-white/10 flex flex-col">
        <header className="px-4 py-3.5 flex items-center justify-between border-b border-black/5 dark:border-white/5">
          <h1 className="text-xl font-bold text-[#111B21] dark:text-[#E9EDEF]">Status</h1>
          <button
            type="button"
            onClick={() => setComposing(true)}
            aria-label="Buat status baru"
            className="min-h-[40px] px-3 rounded-lg bg-[#00A884] text-white text-xs font-semibold flex items-center gap-1.5 hover:bg-[#008F72] cursor-pointer"
          >
            <Plus className="w-4 h-4" aria-hidden="true" />
            <span>Buat Status</span>
          </button>
        </header>

        <div className="flex-1 overflow-y-auto divide-y divide-black/5 dark:divide-white/5 pb-16 md:pb-2">
          {statuses.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-sm font-medium text-[#111B21] dark:text-[#E9EDEF]">
                Belum ada status
              </p>
            </div>
          ) : (
            statuses.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setComposing(false);
                  setSelectedStatus(item);
                }}
                className={`w-full px-4 py-3 flex items-center gap-3 text-left transition-colors cursor-pointer ${
                  selectedStatus?.id === item.id
                    ? 'bg-[#F0F2F5] dark:bg-[#2A3942]'
                    : 'hover:bg-[#F5F6F6] dark:hover:bg-[#202C33]'
                }`}
              >
                <div className="p-0.5 rounded-full ring-2 ring-[#00A884]">
                  <Avatar name={item.alias} bg={item.avatarBg} size="md" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-[#111B21] dark:text-[#E9EDEF] truncate">
                    {item.alias}
                  </p>
                  <p className="text-xs font-mono tabular-nums text-[#667781] dark:text-[#8696A0] truncate">
                    {item.virtualNumber} · {formatChatListTime(item.createdAtMs)}
                  </p>
                </div>
              </button>
            ))
          )}
        </div>
      </aside>

      {/* Right Viewer / Composer */}
      <section className="hidden md:flex flex-1 items-center justify-center bg-[#0B141A] p-8 relative">
        {composing ? (
          <form
            onSubmit={handlePublish}
            style={{ backgroundColor: bgColor }}
            className="w-full max-w-lg rounded-2xl p-8 text-white shadow-2xl space-y-6"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-mono opacity-80">{currentUser.virtualNumber}</p>
                <h2 className="text-lg font-bold">Status Baru</h2>
              </div>
              <button
                type="button"
                onClick={() => setComposing(false)}
                aria-label="Batal buat status"
                className="p-2 rounded-full hover:bg-white/15 cursor-pointer"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>

            <textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              rows={4}
              maxLength={280}
              required
              aria-label="Teks status"
              placeholder="Ketik status..."
              className="w-full bg-black/20 rounded-xl p-4 text-base placeholder:text-white/60 focus:outline-none focus:ring-2 focus:ring-white/40 resize-none"
            />

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {STATUS_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setBgColor(color)}
                    aria-label={`Pilih warna latar ${color}`}
                    style={{ backgroundColor: color }}
                    className={`w-7 h-7 rounded-full border-2 cursor-pointer ${
                      bgColor === color ? 'border-white scale-110' : 'border-white/30'
                    }`}
                  />
                ))}
              </div>
              <button
                type="submit"
                disabled={submitting || !caption.trim()}
                className="px-5 py-2.5 rounded-xl bg-white text-[#111B21] font-semibold text-sm flex items-center gap-2 hover:bg-white/90 disabled:opacity-60 cursor-pointer"
              >
                <Send className="w-4 h-4" aria-hidden="true" />
                <span>{submitting ? 'Mengirim...' : 'Terbitkan'}</span>
              </button>
            </div>
          </form>
        ) : selectedStatus ? (
          <div
            style={{ backgroundColor: selectedStatus.bgColor }}
            className="w-full max-w-lg min-h-[340px] rounded-2xl p-8 text-white shadow-2xl flex flex-col justify-between"
          >
            <div className="flex items-center gap-3">
              <Avatar name={selectedStatus.alias} bg={selectedStatus.avatarBg} size="md" />
              <div>
                <p className="font-semibold text-base">{selectedStatus.alias}</p>
                <p className="text-xs font-mono opacity-85">{selectedStatus.virtualNumber}</p>
              </div>
            </div>

            <p className="text-xl md:text-2xl font-medium leading-relaxed text-center my-8">
              {selectedStatus.caption}
            </p>

            <p className="text-xs opacity-75 text-right font-mono tabular-nums">
              {formatChatListTime(selectedStatus.createdAtMs)}
            </p>
          </div>
        ) : (
          <div className="text-center text-white/70 max-w-sm">
            <p className="text-base font-medium">Pilih atau buat status</p>
          </div>
        )}
      </section>
    </div>
  );
}
