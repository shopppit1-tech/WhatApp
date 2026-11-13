import { useEffect, useRef, useState } from 'react';
import {
  Bell,
  Camera,
  Check,
  Copy,
  Eye,
  EyeOff,
  LogOut,
  Moon,
  RefreshCw,
  Sun,
  Trash2,
} from 'lucide-react';
import type { DirectoryProfile } from '../types/chat';
import {
  getNotificationPermission,
  requestCallNotificationPermission,
} from '../utils/callNotifications';
import { Avatar } from './Avatar';
import { PWAInstallButton } from './PWAInstallButton';

interface PrivacyPaneProps {
  currentUser: DirectoryProfile;
  googleEmail: string;
  darkMode: boolean;
  onToggleDarkMode: () => void;
  readReceiptsEnabled: boolean;
  onToggleReadReceipts: () => Promise<void>;
  onRotateVirtualNumber: () => Promise<void>;
  onUpdateProfile: (alias: string, bio: string, avatarUrl?: string) => Promise<void>;
  onLogout: () => Promise<void>;
}

export function PrivacyPane({
  currentUser,
  googleEmail,
  darkMode,
  onToggleDarkMode,
  readReceiptsEnabled,
  onToggleReadReceipts,
  onRotateVirtualNumber,
  onUpdateProfile,
  onLogout,
}: PrivacyPaneProps) {
  const [alias, setAlias] = useState(currentUser.alias);
  const [bio, setBio] = useState(currentUser.bio);
  const [avatarUrl, setAvatarUrl] = useState(currentUser.avatarUrl || '');
  const [showEmail, setShowEmail] = useState(false);
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [rotatingNum, setRotatingNum] = useState(false);
  const [togglingReceipts, setTogglingReceipts] = useState(false);
  const [notifPerm, setNotifPerm] = useState<NotificationPermission | 'unsupported'>(() =>
    getNotificationPermission()
  );
  const [feedback, setFeedback] = useState<string | null>(null);

  const photoInputRef = useRef<HTMLInputElement>(null);

  async function handleEnableCallNotifications() {
    const result = await requestCallNotificationPermission();
    setNotifPerm(result);
    if (result === 'granted') {
      setFeedback('Notifikasi panggilan masuk aktif.');
    } else if (result === 'denied') {
      setFeedback('Izin notifikasi diblokir browser. Aktifkan lewat setelan situs.');
    } else {
      setFeedback('Ketuk Izinkan pada dialog notifikasi browser.');
    }
  }

  useEffect(() => {
    setAlias(currentUser.alias);
    setBio(currentUser.bio);
    setAvatarUrl(currentUser.avatarUrl || '');
  }, [currentUser.alias, currentUser.bio, currentUser.avatarUrl]);

  function copyVirtualNumber() {
    navigator.clipboard?.writeText(currentUser.virtualNumber);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = async () => {
        const size = 160;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const minSide = Math.min(img.width, img.height);
        const sx = (img.width - minSide) / 2;
        const sy = (img.height - minSide) / 2;
        ctx.drawImage(img, sx, sy, minSide, minSide, 0, 0, size, size);

        const dataUrl = canvas.toDataURL('image/jpeg', 0.65);
        setAvatarUrl(dataUrl);
        setSaving(true);
        setFeedback(null);
        try {
          await onUpdateProfile(alias.trim() || currentUser.alias, bio.trim(), dataUrl);
          setFeedback('Foto profil diperbarui.');
        } finally {
          setSaving(false);
        }
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  }

  async function handleRemovePhoto() {
    setAvatarUrl('');
    setSaving(true);
    setFeedback(null);
    try {
      await onUpdateProfile(alias.trim() || currentUser.alias, bio.trim(), '');
      setFeedback('Foto profil dihapus.');
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!alias.trim() || saving) return;
    setSaving(true);
    setFeedback(null);
    try {
      await onUpdateProfile(alias.trim(), bio.trim(), avatarUrl);
      setFeedback('Profil diperbarui.');
    } finally {
      setSaving(false);
    }
  }

  async function handleRotateNum() {
    setRotatingNum(true);
    setFeedback(null);
    try {
      await onRotateVirtualNumber();
      setFeedback('Nomor virtual baru aktif.');
    } finally {
      setRotatingNum(false);
    }
  }

  async function handleToggleReadReceipts() {
    if (togglingReceipts) return;
    setTogglingReceipts(true);
    setFeedback(null);
    try {
      await onToggleReadReceipts();
    } finally {
      setTogglingReceipts(false);
    }
  }

  return (
    <div className="flex-1 h-full overflow-y-auto bg-[#F0F2F5] dark:bg-[#0B141A] p-4 sm:p-8 pb-24 md:pb-8">
      <div className="max-w-2xl mx-auto space-y-5">
        <header className="flex items-center justify-between gap-4">
          <h1 className="text-2xl font-bold text-[#111B21] dark:text-[#E9EDEF]">
            Profil
          </h1>
          <button
            type="button"
            onClick={onLogout}
            className="px-4 py-2 rounded-lg bg-red-600/10 hover:bg-red-600/20 text-red-600 dark:text-red-400 text-xs font-semibold flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <LogOut className="w-4 h-4" aria-hidden="true" />
            <span>Keluar</span>
          </button>
        </header>

        {feedback && (
          <div
            role="status"
            className="px-4 py-3 rounded-xl bg-[#D9FDD3] dark:bg-[#005C4B] text-[#008069] dark:text-[#E9EDEF] text-xs font-medium"
          >
            {feedback}
          </div>
        )}

        {/* Avatar & Virtual Number Card */}
        <section className="bg-white dark:bg-[#111B21] rounded-2xl p-6 border border-black/8 dark:border-white/10 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="relative">
                <Avatar
                  name={currentUser.alias}
                  src={avatarUrl || undefined}
                  bg={currentUser.avatarBg}
                  size="xl"
                />
                <input
                  ref={photoInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarUpload}
                  className="hidden"
                  aria-label="Unggah foto profil"
                />
                <button
                  type="button"
                  onClick={() => photoInputRef.current?.click()}
                  aria-label="Ubah foto profil"
                  title="Ubah foto profil"
                  className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-[#00A884] text-white flex items-center justify-center shadow-md hover:bg-[#008F72] cursor-pointer"
                >
                  <Camera className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>

              <div>
                <p className="text-xs text-[#667781] dark:text-[#8696A0]">Nomor Virtual</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span
                    data-testid="my-virtual-number"
                    className="text-xl font-bold font-mono tabular-nums text-[#008069] dark:text-[#00A884]"
                  >
                    {currentUser.virtualNumber}
                  </span>
                  <button
                    type="button"
                    onClick={copyVirtualNumber}
                    aria-label="Salin nomor virtual saya"
                    className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 text-[#54656F] dark:text-[#AEBAC1] cursor-pointer"
                  >
                    {copied ? (
                      <Check className="w-4 h-4 text-[#00A884]" aria-hidden="true" />
                    ) : (
                      <Copy className="w-4 h-4" aria-hidden="true" />
                    )}
                  </button>
                </div>
                {avatarUrl && (
                  <button
                    type="button"
                    onClick={handleRemovePhoto}
                    className="mt-1.5 text-[11px] text-red-600 dark:text-red-400 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Trash2 className="w-3 h-3" aria-hidden="true" />
                    <span>Hapus foto</span>
                  </button>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={handleRotateNum}
              disabled={rotatingNum}
              className="px-4 py-2.5 rounded-xl bg-[#00A884] hover:bg-[#008F72] disabled:opacity-60 text-white text-xs font-semibold flex items-center justify-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <RefreshCw
                className={`w-4 h-4 ${rotatingNum ? 'animate-spin' : ''}`}
                aria-hidden="true"
              />
              <span>Acak Nomor Baru</span>
            </button>
          </div>

          <div className="pt-4 border-t border-black/8 dark:border-white/10 flex items-center justify-between gap-4 text-xs">
            <div>
              <p className="font-medium text-[#111B21] dark:text-[#E9EDEF]">Akun Google</p>
              <p className="font-mono text-[#54656F] dark:text-[#8696A0] mt-0.5">
                {showEmail ? googleEmail : '••••••••••••@gmail.com'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowEmail((v) => !v)}
              aria-label={showEmail ? 'Sembunyikan email' : 'Tampilkan email'}
              className="p-2 rounded-lg bg-[#F0F2F5] dark:bg-[#202C33] text-[#54656F] dark:text-[#AEBAC1] cursor-pointer"
            >
              {showEmail ? (
                <EyeOff className="w-4 h-4" aria-hidden="true" />
              ) : (
                <Eye className="w-4 h-4" aria-hidden="true" />
              )}
            </button>
          </div>
        </section>

        {/* Alias & Bio Form */}
        <form
          onSubmit={handleSaveProfile}
          className="bg-white dark:bg-[#111B21] rounded-2xl p-6 border border-black/8 dark:border-white/10 space-y-4"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="alias-input"
                className="block text-xs font-medium text-[#54656F] dark:text-[#8696A0] mb-1.5"
              >
                Nama
              </label>
              <input
                id="alias-input"
                type="text"
                value={alias}
                onChange={(e) => setAlias(e.target.value)}
                maxLength={60}
                required
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#F0F2F5] dark:bg-[#202C33] text-sm text-[#111B21] dark:text-[#E9EDEF] focus:outline-none focus:ring-2 focus:ring-[#00A884]/40"
              />
            </div>

            <div>
              <label
                htmlFor="bio-input"
                className="block text-xs font-medium text-[#54656F] dark:text-[#8696A0] mb-1.5"
              >
                Info
              </label>
              <input
                id="bio-input"
                type="text"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                maxLength={160}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#F0F2F5] dark:bg-[#202C33] text-sm text-[#111B21] dark:text-[#E9EDEF] focus:outline-none focus:ring-2 focus:ring-[#00A884]/40"
              />
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 rounded-xl bg-[#111B21] dark:bg-[#00A884] text-white text-xs font-semibold hover:opacity-90 disabled:opacity-60 cursor-pointer"
            >
              {saving ? 'Menyimpan...' : 'Simpan Profil'}
            </button>
          </div>
        </form>

        {/* Privacy & Appearance Preferences */}
        <section className="bg-white dark:bg-[#111B21] rounded-2xl border border-black/8 dark:border-white/10 divide-y divide-black/5 dark:divide-white/5 overflow-hidden">
          <div className="p-6 flex items-center justify-between gap-4">
            <p className="text-sm font-semibold text-[#111B21] dark:text-[#E9EDEF]">
              Laporan Dibaca
            </p>
            <button
              type="button"
              role="switch"
              aria-checked={readReceiptsEnabled}
              aria-label="Laporan Dibaca"
              disabled={togglingReceipts}
              onClick={handleToggleReadReceipts}
              className={`relative inline-flex h-7 w-12 min-h-[28px] shrink-0 items-center rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00A884] disabled:opacity-60 cursor-pointer ${
                readReceiptsEnabled
                  ? 'bg-[#00A884]'
                  : 'bg-[#CBD5E1] dark:bg-[#2A3942]'
              }`}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-xs transition-transform ${
                  readReceiptsEnabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          <div className="p-6 flex items-center justify-between gap-4">
            <p className="text-sm font-semibold text-[#111B21] dark:text-[#E9EDEF]">
              Notifikasi Panggilan
            </p>
            <button
              type="button"
              onClick={handleEnableCallNotifications}
              disabled={notifPerm === 'granted' || notifPerm === 'unsupported'}
              className={`min-h-[40px] px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 cursor-pointer disabled:cursor-default ${
                notifPerm === 'granted'
                  ? 'bg-[#D9FDD3] dark:bg-[#005C4B] text-[#008069] dark:text-[#E9EDEF]'
                  : 'bg-[#F0F2F5] dark:bg-[#202C33] text-[#111B21] dark:text-[#E9EDEF] hover:bg-black/5 dark:hover:bg-white/5'
              }`}
            >
              <Bell className="w-4 h-4 text-[#00A884]" aria-hidden="true" />
              <span>
                {notifPerm === 'granted'
                  ? 'Aktif'
                  : notifPerm === 'denied'
                    ? 'Diblokir'
                    : notifPerm === 'unsupported'
                      ? 'Tidak Didukung'
                      : 'Aktifkan'}
              </span>
            </button>
          </div>

          <div className="p-6 flex items-center justify-between gap-4">
            <p className="text-sm font-semibold text-[#111B21] dark:text-[#E9EDEF]">Tema</p>
            <button
              type="button"
              onClick={onToggleDarkMode}
              className="min-h-[40px] px-4 py-2 rounded-xl bg-[#F0F2F5] dark:bg-[#202C33] text-xs font-semibold text-[#111B21] dark:text-[#E9EDEF] flex items-center gap-2 cursor-pointer"
            >
              {darkMode ? (
                <>
                  <Sun className="w-4 h-4 text-[#00A884]" aria-hidden="true" />
                  <span>Terang</span>
                </>
              ) : (
                <>
                  <Moon className="w-4 h-4 text-[#008069]" aria-hidden="true" />
                  <span>Gelap</span>
                </>
              )}
            </button>
          </div>
        </section>

        <div className="flex justify-end">
          <PWAInstallButton />
        </div>
      </div>
    </div>
  );
}
