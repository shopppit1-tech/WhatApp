import { useState } from 'react';
import { Phone, PhoneIncoming, PhoneMissed, PhoneOutgoing, Video } from 'lucide-react';
import type { DirectoryProfile } from '../types/chat';
import type { CallSessionDoc } from '../services/webrtcCallService';
import { formatChatListTime, formatDurationSec } from '../utils/chatHelpers';
import { Avatar } from './Avatar';

interface CallsPaneProps {
  callSessions: CallSessionDoc[];
  directory: DirectoryProfile[];
  currentUserUid: string;
  onStartCall: (peer: DirectoryProfile, callType: 'audio' | 'video') => void;
}

export function CallsPane({
  callSessions,
  directory,
  currentUserUid,
  onStartCall,
}: CallsPaneProps) {
  const [mobileView, setMobileView] = useState<'history' | 'contacts'>('history');
  const profilesByUid = Object.fromEntries(directory.map((p) => [p.uid, p]));
  const callablePeers = directory.filter((p) => p.uid !== currentUserUid);

  return (
    <div className="flex-1 flex h-full overflow-hidden">
      {/* Left Call Log */}
      <aside
        className={`${
          mobileView === 'contacts' ? 'hidden md:flex' : 'flex'
        } w-full md:w-[350px] lg:w-[400px] shrink-0 bg-white dark:bg-[#111B21] border-r border-black/8 dark:border-white/10 flex-col`}
      >
        <header className="px-4 py-3.5 border-b border-black/5 dark:border-white/5 space-y-2.5">
          <h1 className="text-xl font-bold text-[#111B21] dark:text-[#E9EDEF]">Panggilan</h1>
          <div className="md:hidden flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setMobileView('history')}
              className="flex-1 py-1.5 px-3 rounded-lg text-xs font-medium bg-[#D9FDD3] dark:bg-[#005C4B] text-[#008069] dark:text-white cursor-pointer"
            >
              Riwayat
            </button>
            <button
              type="button"
              onClick={() => setMobileView('contacts')}
              className="flex-1 py-1.5 px-3 rounded-lg text-xs font-medium bg-[#F0F2F5] dark:bg-[#202C33] text-[#54656F] dark:text-[#8696A0] cursor-pointer"
            >
              Kontak ({callablePeers.length})
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto divide-y divide-black/5 dark:divide-white/5 pb-20 md:pb-2">
          {callSessions.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-sm font-medium text-[#111B21] dark:text-[#E9EDEF]">
                Belum ada riwayat panggilan
              </p>
              {callablePeers.length > 0 && (
                <button
                  type="button"
                  onClick={() => setMobileView('contacts')}
                  className="md:hidden mt-4 px-4 py-2 rounded-lg bg-[#00A884] text-white text-xs font-semibold hover:bg-[#008F72] cursor-pointer"
                >
                  Pilih Kontak Panggilan
                </button>
              )}
            </div>
          ) : (
            callSessions.map((session) => {
              const isOutgoing = session.callerUid === currentUserUid;
              const peerUid = isOutgoing ? session.calleeUid : session.callerUid;
              const peerProfile = profilesByUid[peerUid];
              const peerAlias =
                peerProfile?.alias || (isOutgoing ? session.calleeAlias : session.callerAlias);
              const peerVirtual = isOutgoing
                ? session.calleeVirtualNumber
                : session.callerVirtualNumber;
              const missed = session.status === 'missed' || session.status === 'rejected';

              return (
                <div
                  key={session.callId}
                  className="px-4 py-3 flex items-center justify-between gap-3 hover:bg-[#F5F6F6] dark:hover:bg-[#202C33]"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar
                      name={peerAlias}
                      src={peerProfile?.avatarUrl}
                      bg={peerProfile?.avatarBg || '#00A884'}
                      size="md"
                    />
                    <div className="min-w-0">
                      <p
                        className={`text-sm font-semibold truncate ${
                          missed
                            ? 'text-red-600 dark:text-red-400'
                            : 'text-[#111B21] dark:text-[#E9EDEF]'
                        }`}
                      >
                        {peerAlias}
                      </p>
                      <div className="flex items-center gap-1.5 text-xs text-[#667781] dark:text-[#8696A0] font-mono tabular-nums">
                        {missed ? (
                          <PhoneMissed className="w-3.5 h-3.5 text-red-500 shrink-0" aria-hidden="true" />
                        ) : isOutgoing ? (
                          <PhoneOutgoing className="w-3.5 h-3.5 text-[#00A884] shrink-0" aria-hidden="true" />
                        ) : (
                          <PhoneIncoming className="w-3.5 h-3.5 text-[#00A884] shrink-0" aria-hidden="true" />
                        )}
                        <span className="truncate">{peerVirtual}</span>
                        <span aria-hidden="true">·</span>
                        <span>
                          {session.durationSec > 0
                            ? formatDurationSec(session.durationSec)
                            : formatChatListTime(session.createdAtMs)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {peerProfile && (
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => onStartCall(peerProfile, 'audio')}
                        aria-label={`Telepon suara ${peerAlias}`}
                        className="min-h-[38px] min-w-[38px] rounded-full flex items-center justify-center text-[#008069] dark:text-[#00A884] hover:bg-[#00A884]/10 cursor-pointer"
                      >
                        <Phone className="w-4 h-4" aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onStartCall(peerProfile, 'video')}
                        aria-label={`Video call ${peerAlias}`}
                        className="min-h-[38px] min-w-[38px] rounded-full flex items-center justify-center text-[#008069] dark:text-[#00A884] hover:bg-[#00A884]/10 cursor-pointer"
                      >
                        <Video className="w-4 h-4" aria-hidden="true" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </aside>

      {/* Right Directory Quick-Dial */}
      <section
        className={`${
          mobileView === 'contacts' ? 'flex' : 'hidden md:flex'
        } flex-1 flex-col bg-[#F0F2F5] dark:bg-[#222E35] p-4 sm:p-8 pb-24 md:pb-8 overflow-y-auto`}
      >
        <div className="md:hidden mb-4 flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setMobileView('history')}
            className="flex-1 py-1.5 px-3 rounded-lg text-xs font-medium bg-white dark:bg-[#111B21] text-[#54656F] dark:text-[#8696A0] cursor-pointer"
          >
            Riwayat
          </button>
          <button
            type="button"
            onClick={() => setMobileView('contacts')}
            className="flex-1 py-1.5 px-3 rounded-lg text-xs font-medium bg-[#D9FDD3] dark:bg-[#005C4B] text-[#008069] dark:text-white cursor-pointer"
          >
            Kontak ({callablePeers.length})
          </button>
        </div>
        <div className="max-w-2xl mx-auto w-full space-y-6">
          <div>
            <h2 className="text-xl font-bold text-[#111B21] dark:text-[#E9EDEF]">
              Kontak Panggilan
            </h2>
          </div>

          {callablePeers.length === 0 ? (
            <div className="p-8 rounded-2xl bg-white dark:bg-[#111B21] border border-black/8 dark:border-white/10 text-center">
              <p className="text-sm font-medium text-[#111B21] dark:text-[#E9EDEF]">
                Belum ada kontak aktif
              </p>
            </div>
          ) : (
            <div className="bg-white dark:bg-[#111B21] rounded-2xl border border-black/8 dark:border-white/10 divide-y divide-black/5 dark:divide-white/5 overflow-hidden">
              {callablePeers.map((peer) => (
                <div
                  key={peer.uid}
                  className="px-5 py-3.5 flex items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar name={peer.alias} src={peer.avatarUrl} bg={peer.avatarBg} size="md" />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[#111B21] dark:text-[#E9EDEF] truncate">
                        {peer.alias}
                      </p>
                      <p className="text-xs font-mono tabular-nums text-[#008069] dark:text-[#00A884] truncate">
                        {peer.virtualNumber}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => onStartCall(peer, 'audio')}
                      className="px-3.5 py-2 rounded-lg bg-[#F0F2F5] dark:bg-[#202C33] hover:bg-[#D9FDD3] dark:hover:bg-[#005C4B] text-xs font-semibold text-[#111B21] dark:text-[#E9EDEF] flex items-center gap-1.5 cursor-pointer"
                    >
                      <Phone className="w-3.5 h-3.5 text-[#00A884]" aria-hidden="true" />
                      <span>Telepon</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onStartCall(peer, 'video')}
                      className="px-3.5 py-2 rounded-lg bg-[#00A884] hover:bg-[#008F72] text-xs font-semibold text-white flex items-center gap-1.5 cursor-pointer"
                    >
                      <Video className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Video Call</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
