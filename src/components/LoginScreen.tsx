import { Lock, PhoneCall, ShieldCheck, Smartphone } from 'lucide-react';
import whatappLogo from '../assets/images/whatapp_logo_1794610455639.jpg';
import { PWAInstallButton } from './PWAInstallButton';

interface LoginScreenProps {
  onGoogleLogin: () => void;
  onGoogleRedirect: () => void;
  loading: boolean;
  errorMsg: string | null;
  showAuthorizedDomainsLink: boolean;
}

export function LoginScreen({
  onGoogleLogin,
  onGoogleRedirect,
  loading,
  errorMsg,
  showAuthorizedDomainsLink,
}: LoginScreenProps) {
  return (
    <div className="min-h-screen bg-[#EFEAE2] dark:bg-[#0B141A] flex flex-col">
      {/* Classic WhatsApp Web top emerald band */}
      <div className="h-48 md:h-56 bg-[#00A884] dark:bg-[#008069] w-full shrink-0 px-4 pt-6 md:pt-8">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-3 text-white">
          <div className="flex items-center gap-3">
            <img
              src={whatappLogo}
              alt="Logo WhatApp"
              referrerPolicy="no-referrer"
              className="w-10 h-10 rounded-xl shadow-sm object-cover"
            />
            <h1 className="text-xl font-bold tracking-tight whitespace-nowrap">WhatApp</h1>
          </div>
          <PWAInstallButton />
        </div>
      </div>

      {/* Floating Onboarding Card */}
      <main className="flex-1 px-4 -mt-28 md:-mt-32 pb-12 flex items-start justify-center">
        <div className="w-full max-w-4xl bg-white dark:bg-[#111B21] rounded-2xl shadow-xl border border-black/5 dark:border-white/10 overflow-hidden grid grid-cols-1 md:grid-cols-12">
          {/* Left Column */}
          <div className="order-2 md:order-1 md:col-span-7 p-6 md:p-10 flex flex-col justify-between gap-6">
            <div>
              <h2 className="text-xl md:text-[26px] font-bold text-[#111B21] dark:text-[#E9EDEF] leading-snug [text-wrap:balance]">
                Obrolan privat dengan nomor virtual acak
              </h2>

              <ul className="mt-6 space-y-4">
                <li className="flex items-center gap-3.5">
                  <div className="w-9 h-9 rounded-lg bg-[#00A884]/12 text-[#008069] dark:text-[#00A884] flex items-center justify-center shrink-0">
                    <Smartphone className="w-4 h-4" aria-hidden="true" />
                  </div>
                  <p className="text-sm font-medium text-[#111B21] dark:text-[#E9EDEF]">
                    Nomor virtual acak otomatis tiap login Google
                  </p>
                </li>

                <li className="flex items-center gap-3.5">
                  <div className="w-9 h-9 rounded-lg bg-[#00A884]/12 text-[#008069] dark:text-[#00A884] flex items-center justify-center shrink-0">
                    <ShieldCheck className="w-4 h-4" aria-hidden="true" />
                  </div>
                  <p className="text-sm font-medium text-[#111B21] dark:text-[#E9EDEF]">
                    Pesan teks, gambar &amp; suara terenkripsi end-to-end
                  </p>
                </li>

                <li className="flex items-center gap-3.5">
                  <div className="w-9 h-9 rounded-lg bg-[#00A884]/12 text-[#008069] dark:text-[#00A884] flex items-center justify-center shrink-0">
                    <PhoneCall className="w-4 h-4" aria-hidden="true" />
                  </div>
                  <p className="text-sm font-medium text-[#111B21] dark:text-[#E9EDEF]">
                    Telepon suara &amp; video call langsung
                  </p>
                </li>
              </ul>
            </div>

            <div className="pt-4 border-t border-black/8 dark:border-white/10 text-xs text-[#667781] dark:text-[#8696A0] flex items-center gap-2">
              <Lock className="w-3.5 h-3.5 text-[#00A884]" aria-hidden="true" />
              <span>Terenkripsi end-to-end</span>
            </div>
          </div>

          {/* Right Auth Action Column */}
          <div className="order-1 md:order-2 md:col-span-5 bg-[#F7F8FA] dark:bg-[#182229] p-6 md:p-10 flex flex-col justify-center border-b md:border-b-0 md:border-l border-black/8 dark:border-white/10">
            <h3 className="text-xl font-bold text-[#111B21] dark:text-[#E9EDEF] mb-5">
              Masuk ke WhatApp
            </h3>

            {errorMsg && (
              <div
                role="alert"
                className="mb-4 p-3 rounded-xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 text-xs text-red-700 dark:text-red-300"
              >
                {errorMsg}
              </div>
            )}

            {showAuthorizedDomainsLink && (
              <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
                Domain aplikasi ini belum diizinkan Firebase. Tambahkan domain ini di{' '}
                <a
                  href="https://console.firebase.google.com/project/gen-lang-client-0817260391/authentication/settings"
                  target="_blank"
                  rel="noreferrer"
                  className="font-semibold underline underline-offset-2"
                >
                  Authorized Domains Firebase
                </a>
                .
              </div>
            )}

            <button
              type="button"
              onClick={onGoogleLogin}
              disabled={loading}
              className="w-full min-h-[48px] px-5 py-3 rounded-xl bg-[#00A884] hover:bg-[#008F72] active:scale-[0.99] disabled:opacity-60 text-white font-semibold text-sm flex items-center justify-center gap-3 shadow-sm transition-all cursor-pointer"
            >
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  fill="currentColor"
                  d="M21.35 11.1h-9.17v2.73h6.51c-.33 3.81-3.5 5.44-6.5 5.44C8.36 19.27 5 16.25 5 12c0-4.1 3.2-7.27 7.2-7.27c3.09 0 4.9 1.97 4.9 1.97L19 4.72S16.56 2 12.1 2C6.42 2 2.03 6.8 2.03 12c0 5.05 4.13 10 10.22 10c5.35 0 9.25-3.67 9.25-9.09c0-1.15-.15-1.81-.15-1.81"
                />
              </svg>
              <span className="whitespace-nowrap">
                {loading ? 'Menghubungkan...' : 'Masuk dengan Akun Google'}
              </span>
            </button>

            {typeof window !== 'undefined' && window.top === window.self && (
              <button
                type="button"
                onClick={onGoogleRedirect}
                disabled={loading}
                className="mt-3 w-full min-h-[44px] px-5 py-2.5 rounded-xl border border-[#00A884] text-[#008069] dark:text-[#00A884] font-semibold text-sm hover:bg-[#00A884]/10 disabled:opacity-60 transition-colors cursor-pointer"
              >
                Alternatif Login HP (Halaman Penuh)
              </button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
