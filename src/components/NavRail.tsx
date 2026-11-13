import {
  CircleDot,
  Contact,
  MessageSquare,
  Moon,
  Phone,
  Shield,
  Sun,
} from 'lucide-react';
import type { DirectoryProfile, NavSection } from '../types/chat';
import { Avatar } from './Avatar';

interface NavRailProps {
  activeTab: NavSection;
  onSelectTab: (tab: NavSection) => void;
  totalUnread: number;
  darkMode: boolean;
  onToggleDarkMode: () => void;
  currentUser: DirectoryProfile;
}

export function NavRail({
  activeTab,
  onSelectTab,
  totalUnread,
  darkMode,
  onToggleDarkMode,
  currentUser,
}: NavRailProps) {
  const navItems: {
    id: NavSection;
    label: string;
    icon: typeof MessageSquare;
    badge?: number;
  }[] = [
    { id: 'chats', label: 'Obrolan', icon: MessageSquare, badge: totalUnread },
    { id: 'contacts', label: 'Kontak', icon: Contact },
    { id: 'status', label: 'Status', icon: CircleDot },
    { id: 'calls', label: 'Panggilan', icon: Phone },
    { id: 'privacy', label: 'Profil', icon: Shield },
  ];

  return (
    <>
      {/* Desktop Left Vertical Rail */}
      <nav
        aria-label="Navigasi utama"
        className="hidden md:flex flex-col items-center justify-between w-[64px] shrink-0 py-3 bg-[#F0F2F5] dark:bg-[#202C33] border-r border-black/8 dark:border-white/10"
      >
        <div className="flex flex-col items-center gap-2">
          {navItems
            .filter((item) => item.id !== 'privacy')
            .map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelectTab(item.id)}
                  aria-label={item.label}
                  aria-current={isActive ? 'page' : undefined}
                  title={item.label}
                  className={`relative w-11 h-11 rounded-full flex items-center justify-center transition-colors cursor-pointer ${
                    isActive
                      ? 'bg-[#D9FDD3] dark:bg-[#2A3942] text-[#008069] dark:text-[#00A884]'
                      : 'text-[#54656F] dark:text-[#AEBAC1] hover:bg-black/5 dark:hover:bg-white/5'
                  }`}
                >
                  <Icon className="w-5 h-5" aria-hidden="true" />
                  {item.badge !== undefined && item.badge > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-[#25D366] text-[#111B21] text-[10px] font-bold flex items-center justify-center tabular-nums">
                      {item.badge > 99 ? '99+' : item.badge}
                    </span>
                  )}
                </button>
              );
            })}
        </div>

        <div className="flex flex-col items-center gap-3">
          <button
            type="button"
            onClick={onToggleDarkMode}
            aria-label={darkMode ? 'Aktifkan mode terang' : 'Aktifkan mode gelap'}
            title={darkMode ? 'Mode Terang' : 'Mode Gelap'}
            className="w-11 h-11 rounded-full flex items-center justify-center text-[#54656F] dark:text-[#AEBAC1] hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
          >
            {darkMode ? (
              <Sun className="w-5 h-5" aria-hidden="true" />
            ) : (
              <Moon className="w-5 h-5" aria-hidden="true" />
            )}
          </button>

          <button
            type="button"
            onClick={() => onSelectTab('privacy')}
            aria-label="Profil"
            aria-current={activeTab === 'privacy' ? 'page' : undefined}
            title={`Profil · ${currentUser.alias} (${currentUser.virtualNumber})`}
            className={`rounded-full p-0.5 transition-all cursor-pointer ${
              activeTab === 'privacy'
                ? 'ring-2 ring-[#00A884] bg-[#D9FDD3] dark:bg-[#2A3942]'
                : 'hover:ring-2 hover:ring-[#00A884]'
            }`}
          >
            <Avatar
              name={currentUser.alias}
              src={currentUser.avatarUrl}
              bg={currentUser.avatarBg}
              size="sm"
            />
          </button>
        </div>
      </nav>

      {/* Mobile Bottom Tab Bar (<= 15% viewport cap) */}
      <nav
        aria-label="Navigasi seluler"
        className="md:hidden fixed bottom-0 left-0 right-0 z-30 h-[60px] bg-white/95 dark:bg-[#202C33]/95 backdrop-blur-md border-t border-black/8 dark:border-white/10 grid grid-cols-5 items-center"
      >
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectTab(item.id)}
              aria-label={item.label}
              aria-current={isActive ? 'page' : undefined}
              className={`relative h-full flex flex-col items-center justify-center gap-0.5 transition-colors cursor-pointer ${
                isActive
                  ? 'text-[#008069] dark:text-[#00A884]'
                  : 'text-[#54656F] dark:text-[#AEBAC1]'
              }`}
            >
              <div className="relative">
                <Icon className="w-5 h-5" aria-hidden="true" />
                {item.badge !== undefined && item.badge > 0 && (
                  <span className="absolute -top-1.5 -right-2.5 min-w-[16px] h-[16px] px-1 rounded-full bg-[#25D366] text-[#111B21] text-[10px] font-bold flex items-center justify-center tabular-nums">
                    {item.badge}
                  </span>
                )}
              </div>
              <span className="text-[10px] font-medium whitespace-nowrap">{item.label}</span>
            </button>
          );
        })}
      </nav>
    </>
  );
}
