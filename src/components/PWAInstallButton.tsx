import { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    setIsInstalled(isStandalone);

    const ua = window.navigator.userAgent.toLowerCase();
    setIsIOS(/iphone|ipad|ipod/.test(ua));

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  async function install(): Promise<boolean> {
    if (!deferredPrompt) return false;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsInstalled(true);
      setDeferredPrompt(null);
      return true;
    }
    return false;
  }

  return {
    isInstallable: !!deferredPrompt,
    isInstalled,
    isIOS,
    install,
  };
}

export function PWAInstallButton() {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSModal, setShowIOSModal] = useState(false);

  if (isInstalled) return null;

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={install}
        className="min-h-[40px] px-4 py-2 rounded-xl bg-[#00A884] hover:bg-[#008F72] text-white text-xs font-semibold flex items-center gap-2 whitespace-nowrap cursor-pointer"
      >
        <Download className="w-4 h-4" aria-hidden="true" />
        <span>Pasang</span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowIOSModal(true)}
          className="min-h-[40px] px-4 py-2 rounded-xl bg-[#F0F2F5] dark:bg-[#202C33] text-[#111B21] dark:text-[#E9EDEF] text-xs font-semibold flex items-center gap-2 whitespace-nowrap cursor-pointer"
        >
          <Download className="w-4 h-4 text-[#00A884]" aria-hidden="true" />
          <span>Pasang di iOS</span>
        </button>

        {showIOSModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-[#111B21] p-6 shadow-xl border border-black/10 dark:border-white/10">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-[#111B21] dark:text-[#E9EDEF]">
                  Pasang WhatApp di iPhone
                </h3>
                <button
                  type="button"
                  onClick={() => setShowIOSModal(false)}
                  aria-label="Tutup"
                  className="p-1.5 rounded-full hover:bg-black/5 dark:hover:bg-white/5 text-[#54656F] dark:text-[#AEBAC1] cursor-pointer"
                >
                  <X className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>
              <p className="mt-3 text-xs text-[#54656F] dark:text-[#AEBAC1] leading-relaxed">
                1. Ketuk tombol <strong>Bagikan</strong> di Safari.
                <br />
                2. Pilih <strong>Tambahkan ke Layar Utama</strong>.
              </p>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
}
