import { useState } from 'react';
import {
  ArrowLeft,
  Check,
  Copy,
  Edit3,
  MessageSquare,
  Phone,
  Search,
  Trash2,
  UserPlus,
  Users,
  Video,
  X,
} from 'lucide-react';
import type { DirectoryProfile, SavedContact } from '../types/chat';
import { normalizeVirtualDigits } from '../utils/virtualNumber';
import { Avatar } from './Avatar';

interface ContactsPaneProps {
  currentUser: DirectoryProfile;
  directory: DirectoryProfile[];
  savedContacts: SavedContact[];
  onSaveContact: (params: {
    contactUid: string;
    customName: string;
    virtualNumber: string;
    notes: string;
  }) => Promise<void>;
  onDeleteContact: (contactUid: string) => Promise<void>;
  onStartChat: (peer: DirectoryProfile) => Promise<void>;
  onStartCall: (peer: DirectoryProfile, callType: 'audio' | 'video') => void;
}

export function ContactsPane({
  currentUser,
  directory,
  savedContacts,
  onSaveContact,
  onDeleteContact,
  onStartChat,
  onStartCall,
}: ContactsPaneProps) {
  const [subTab, setSubTab] = useState<'saved' | 'directory'>('saved');
  const [search, setSearch] = useState('');
  const [selectedUid, setSelectedUid] = useState<string | null>(
    savedContacts[0]?.contactUid || null
  );
  const [showForm, setShowForm] = useState(false);
  const [mobileShowDetail, setMobileShowDetail] = useState(false);

  // Add / Edit Contact Form State
  const [virtualInput, setVirtualInput] = useState('');
  const [customName, setCustomName] = useState('');
  const [notes, setNotes] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [copiedNum, setCopiedNum] = useState(false);

  const directoryByUid = Object.fromEntries(directory.map((p) => [p.uid, p]));
  const savedByUid = Object.fromEntries(savedContacts.map((c) => [c.contactUid, c]));

  const otherDirectoryPeers = directory.filter((p) => p.uid !== currentUser.uid);

  const normalizedSearch = search.trim().toLowerCase();
  const digitsSearch = normalizeVirtualDigits(search);

  const filteredSaved = savedContacts.filter((c) => {
    if (!normalizedSearch) return true;
    const dir = directoryByUid[c.contactUid];
    return (
      c.customName.toLowerCase().includes(normalizedSearch) ||
      c.virtualNumber.toLowerCase().includes(normalizedSearch) ||
      (dir?.alias || '').toLowerCase().includes(normalizedSearch) ||
      (digitsSearch.length >= 3 &&
        normalizeVirtualDigits(c.virtualNumber).includes(digitsSearch))
    );
  });

  const filteredDirectory = otherDirectoryPeers.filter((p) => {
    if (!normalizedSearch) return true;
    return (
      p.alias.toLowerCase().includes(normalizedSearch) ||
      p.virtualNumber.toLowerCase().includes(normalizedSearch) ||
      (digitsSearch.length >= 3 && p.virtualNumberDigits.includes(digitsSearch))
    );
  });

  function openAddForm(prefillPeer?: DirectoryProfile) {
    setFormError(null);
    if (prefillPeer) {
      const existing = savedByUid[prefillPeer.uid];
      setVirtualInput(prefillPeer.virtualNumber);
      setCustomName(existing?.customName || prefillPeer.alias);
      setNotes(existing?.notes || '');
    } else {
      setVirtualInput('');
      setCustomName('');
      setNotes('');
    }
    setShowForm(true);
    setMobileShowDetail(true);
  }

  async function handleFormSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    const targetDigits = normalizeVirtualDigits(virtualInput);
    if (targetDigits.length < 5) {
      setFormError('Masukkan nomor virtual yang valid (mis. +62 899-XXXX-XXXX).');
      return;
    }

    const matchedPeer = otherDirectoryPeers.find(
      (p) => p.virtualNumberDigits === targetDigits
    );
    if (!matchedPeer) {
      setFormError(
        'Nomor virtual tersebut belum terdaftar di direktori aktif saat ini.'
      );
      return;
    }

    if (!customName.trim()) {
      setFormError('Nama kontak wajib diisi.');
      return;
    }

    setSaving(true);
    try {
      await onSaveContact({
        contactUid: matchedPeer.uid,
        customName: customName.trim(),
        virtualNumber: matchedPeer.virtualNumber,
        notes: notes.trim(),
      });
      setSelectedUid(matchedPeer.uid);
      setShowForm(false);
      setSubTab('saved');
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : 'Gagal menyimpan profil kontak.'
      );
    } finally {
      setSaving(false);
    }
  }

  const selectedDir = selectedUid ? directoryByUid[selectedUid] : undefined;
  const selectedSaved = selectedUid ? savedByUid[selectedUid] : undefined;

  function copyNumber(num: string) {
    navigator.clipboard?.writeText(num);
    setCopiedNum(true);
    window.setTimeout(() => setCopiedNum(false), 1500);
  }

  return (
    <div className="flex-1 flex h-full overflow-hidden">
      {/* Left Contacts List */}
      <aside
        className={`${
          mobileShowDetail ? 'hidden md:flex' : 'flex'
        } w-full md:w-[350px] lg:w-[400px] shrink-0 bg-white dark:bg-[#111B21] border-r border-black/8 dark:border-white/10 flex-col`}
      >
        <header className="px-4 pt-3.5 pb-2.5 flex items-center justify-between gap-2">
          <div>
            <h1 className="text-xl font-bold text-[#111B21] dark:text-[#E9EDEF]">Kontak</h1>
            <p className="text-xs text-[#667781] dark:text-[#8696A0]">
              {savedContacts.length} kontak tersimpan · {otherDirectoryPeers.length} aktif
            </p>
          </div>
          <button
            type="button"
            onClick={() => openAddForm()}
            className="px-3 py-2 rounded-lg bg-[#00A884] hover:bg-[#008F72] text-white text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <UserPlus className="w-4 h-4" aria-hidden="true" />
            <span>Tambah Kontak</span>
          </button>
        </header>

        {/* Search */}
        <div className="px-3 pb-2">
          <div className="relative flex items-center">
            <Search
              className="w-4 h-4 text-[#54656F] dark:text-[#8696A0] absolute left-3.5 pointer-events-none"
              aria-hidden="true"
            />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Cari kontak atau nomor virtual"
              placeholder="Cari nama kontak atau nomor virtual"
              className="w-full pl-10 pr-4 py-2 rounded-lg bg-[#F0F2F5] dark:bg-[#202C33] text-sm text-[#111B21] dark:text-[#E9EDEF] focus:outline-none focus:ring-2 focus:ring-[#00A884]/40"
            />
          </div>
        </div>

        {/* Sub-Tabs */}
        <div className="px-3 pb-2.5 flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setSubTab('saved')}
            className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-medium whitespace-nowrap cursor-pointer transition-colors ${
              subTab === 'saved'
                ? 'bg-[#D9FDD3] dark:bg-[#005C4B] text-[#008069] dark:text-white'
                : 'bg-[#F0F2F5] dark:bg-[#202C33] text-[#54656F] dark:text-[#8696A0]'
            }`}
          >
            Kontak Tersimpan ({savedContacts.length})
          </button>
          <button
            type="button"
            onClick={() => setSubTab('directory')}
            className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-medium whitespace-nowrap cursor-pointer transition-colors ${
              subTab === 'directory'
                ? 'bg-[#D9FDD3] dark:bg-[#005C4B] text-[#008069] dark:text-white'
                : 'bg-[#F0F2F5] dark:bg-[#202C33] text-[#54656F] dark:text-[#8696A0]'
            }`}
          >
            Direktori ({otherDirectoryPeers.length})
          </button>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto divide-y divide-black/5 dark:divide-white/5 pb-16 md:pb-2">
          {subTab === 'saved' ? (
            filteredSaved.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-sm font-medium text-[#111B21] dark:text-[#E9EDEF]">
                  Belum ada kontak tersimpan
                </p>
                <button
                  type="button"
                  onClick={() => openAddForm()}
                  className="mt-4 px-4 py-2 rounded-lg bg-[#00A884] text-white text-xs font-semibold hover:bg-[#008F72] cursor-pointer"
                >
                  Tambah Kontak
                </button>
              </div>
            ) : (
              filteredSaved.map((c) => {
                const dir = directoryByUid[c.contactUid];
                const isSelected = selectedUid === c.contactUid && !showForm;
                return (
                  <button
                    key={c.contactUid}
                    type="button"
                    onClick={() => {
                      setShowForm(false);
                      setSelectedUid(c.contactUid);
                      setMobileShowDetail(true);
                    }}
                    className={`w-full px-4 py-3 flex items-center gap-3 text-left transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-[#F0F2F5] dark:bg-[#2A3942]'
                        : 'hover:bg-[#F5F6F6] dark:hover:bg-[#202C33]'
                    }`}
                  >
                    <Avatar
                      name={c.customName}
                      src={dir?.avatarUrl}
                      bg={dir?.avatarBg || '#00A884'}
                      size="md"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-[#111B21] dark:text-[#E9EDEF] truncate">
                        {c.customName}
                      </p>
                      <p className="text-xs font-mono tabular-nums text-[#008069] dark:text-[#00A884] truncate">
                        {dir?.virtualNumber || c.virtualNumber}
                      </p>
                    </div>
                  </button>
                );
              })
            )
          ) : filteredDirectory.length === 0 ? (
            <div className="p-8 text-center text-xs text-[#667781] dark:text-[#8696A0]">
              Tidak ada pengguna lain di direktori virtual saat ini.
            </div>
          ) : (
            filteredDirectory.map((peer) => {
              const saved = savedByUid[peer.uid];
              const isSelected = selectedUid === peer.uid && !showForm;
              return (
                <button
                  key={peer.uid}
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    setSelectedUid(peer.uid);
                    setMobileShowDetail(true);
                  }}
                  className={`w-full px-4 py-3 flex items-center gap-3 text-left transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-[#F0F2F5] dark:bg-[#2A3942]'
                      : 'hover:bg-[#F5F6F6] dark:hover:bg-[#202C33]'
                  }`}
                >
                  <Avatar
                    name={saved?.customName || peer.alias}
                    src={peer.avatarUrl}
                    bg={peer.avatarBg}
                    size="md"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-[#111B21] dark:text-[#E9EDEF] truncate">
                        {saved?.customName || peer.alias}
                      </p>
                      {saved && (
                        <span className="text-[11px] text-[#008069] dark:text-[#00A884] font-medium shrink-0">
                          Tersimpan
                        </span>
                      )}
                    </div>
                    <p className="text-xs font-mono tabular-nums text-[#667781] dark:text-[#8696A0] truncate">
                      {peer.virtualNumber}
                    </p>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </aside>

      {/* Right Contact Profile / Add Contact Form */}
      <section
        className={`${
          mobileShowDetail ? 'flex' : 'hidden md:flex'
        } flex-1 h-full overflow-y-auto bg-[#F0F2F5] dark:bg-[#0B141A] p-4 sm:p-8 pb-24 md:pb-8 flex-col items-center justify-start`}
      >
        <div className="w-full max-w-lg md:hidden mb-3">
          <button
            type="button"
            onClick={() => {
              setShowForm(false);
              setMobileShowDetail(false);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white dark:bg-[#111B21] border border-black/8 dark:border-white/10 text-xs font-semibold text-[#111B21] dark:text-[#E9EDEF] cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" aria-hidden="true" />
            <span>Kembali ke kontak</span>
          </button>
        </div>

        {showForm ? (
          <form
            onSubmit={handleFormSubmit}
            className="w-full max-w-lg bg-white dark:bg-[#111B21] rounded-2xl p-6 sm:p-8 border border-black/8 dark:border-white/10 shadow-sm space-y-5 my-auto"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-[#111B21] dark:text-[#E9EDEF]">
                Simpan Kontak
              </h2>
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setMobileShowDetail(false);
                }}
                aria-label="Tutup form kontak"
                className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/5 text-[#54656F] dark:text-[#AEBAC1] cursor-pointer"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>

            {formError && (
              <div
                role="alert"
                className="p-3 rounded-xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 text-xs text-red-700 dark:text-red-300"
              >
                {formError}
              </div>
            )}

            <div>
              <label
                htmlFor="contact-virtual-number"
                className="block text-xs font-medium text-[#54656F] dark:text-[#8696A0] mb-1.5"
              >
                Nomor Virtual Tujuan
              </label>
              <input
                id="contact-virtual-number"
                type="text"
                value={virtualInput}
                onChange={(e) => setVirtualInput(e.target.value)}
                placeholder="+62 899-XXXX-XXXX"
                required
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#F0F2F5] dark:bg-[#202C33] font-mono text-sm text-[#111B21] dark:text-[#E9EDEF] focus:outline-none focus:ring-2 focus:ring-[#00A884]/40"
              />
              {otherDirectoryPeers.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {otherDirectoryPeers.slice(0, 5).map((p) => (
                    <button
                      key={p.uid}
                      type="button"
                      onClick={() => {
                        setVirtualInput(p.virtualNumber);
                        if (!customName) setCustomName(p.alias);
                      }}
                      className="text-[11px] px-2.5 py-1 rounded-lg bg-[#F0F2F5] dark:bg-[#202C33] hover:bg-[#D9FDD3] dark:hover:bg-[#005C4B] text-[#111B21] dark:text-[#E9EDEF] font-mono cursor-pointer"
                    >
                      {p.alias} ({p.virtualNumber})
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label
                htmlFor="contact-custom-name"
                className="block text-xs font-medium text-[#54656F] dark:text-[#8696A0] mb-1.5"
              >
                Nama Kontak
              </label>
              <input
                id="contact-custom-name"
                type="text"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                maxLength={60}
                placeholder="Mis. Budi Kantor"
                required
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#F0F2F5] dark:bg-[#202C33] text-sm text-[#111B21] dark:text-[#E9EDEF] focus:outline-none focus:ring-2 focus:ring-[#00A884]/40"
              />
            </div>

            <div>
              <label
                htmlFor="contact-notes"
                className="block text-xs font-medium text-[#54656F] dark:text-[#8696A0] mb-1.5"
              >
                Catatan Profil (Opsional)
              </label>
              <input
                id="contact-notes"
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                maxLength={160}
                placeholder="Mis. Tim keamanan · Hubungi malam hari"
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#F0F2F5] dark:bg-[#202C33] text-sm text-[#111B21] dark:text-[#E9EDEF] focus:outline-none focus:ring-2 focus:ring-[#00A884]/40"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setMobileShowDetail(false);
                }}
                className="px-4 py-2 rounded-xl bg-[#F0F2F5] dark:bg-[#202C33] text-xs font-semibold text-[#54656F] dark:text-[#AEBAC1] cursor-pointer"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2 rounded-xl bg-[#00A884] hover:bg-[#008F72] disabled:opacity-60 text-white text-xs font-semibold cursor-pointer"
              >
                {saving ? 'Menyimpan...' : 'Simpan Kontak'}
              </button>
            </div>
          </form>
        ) : selectedDir ? (
          <div className="w-full max-w-lg bg-white dark:bg-[#111B21] rounded-2xl p-6 sm:p-8 border border-black/8 dark:border-white/10 shadow-sm space-y-6 my-auto">
            <div className="flex flex-col items-center text-center">
              <Avatar
                name={selectedSaved?.customName || selectedDir.alias}
                src={selectedDir.avatarUrl}
                bg={selectedDir.avatarBg}
                size="xl"
              />
              <h2 className="mt-4 text-xl font-bold text-[#111B21] dark:text-[#E9EDEF]">
                {selectedSaved?.customName || selectedDir.alias}
              </h2>
              {selectedSaved && (
                <p className="text-xs text-[#667781] dark:text-[#8696A0] mt-0.5">
                  Alias Direktori: {selectedDir.alias}
                </p>
              )}

              <div className="mt-2 flex items-center gap-2">
                <span className="text-sm font-mono tabular-nums text-[#008069] dark:text-[#00A884]">
                  {selectedDir.virtualNumber}
                </span>
                <button
                  type="button"
                  onClick={() => copyNumber(selectedDir.virtualNumber)}
                  aria-label="Salin nomor virtual kontak"
                  className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 text-[#54656F] dark:text-[#AEBAC1] cursor-pointer"
                >
                  {copiedNum ? (
                    <Check className="w-4 h-4 text-[#00A884]" aria-hidden="true" />
                  ) : (
                    <Copy className="w-4 h-4" aria-hidden="true" />
                  )}
                </button>
              </div>
            </div>

            {/* Quick Action Buttons */}
            <div className="grid grid-cols-3 gap-2.5">
              <button
                type="button"
                onClick={() => onStartChat(selectedDir)}
                className="py-3 px-3 rounded-xl bg-[#00A884] hover:bg-[#008F72] text-white text-xs font-semibold flex flex-col items-center gap-1.5 cursor-pointer"
              >
                <MessageSquare className="w-4 h-4" aria-hidden="true" />
                <span>Pesan</span>
              </button>
              <button
                type="button"
                onClick={() => onStartCall(selectedDir, 'audio')}
                className="py-3 px-3 rounded-xl bg-[#F0F2F5] dark:bg-[#202C33] hover:bg-[#D9FDD3] dark:hover:bg-[#005C4B] text-[#111B21] dark:text-[#E9EDEF] text-xs font-semibold flex flex-col items-center gap-1.5 cursor-pointer"
              >
                <Phone className="w-4 h-4 text-[#00A884]" aria-hidden="true" />
                <span>Telepon</span>
              </button>
              <button
                type="button"
                onClick={() => onStartCall(selectedDir, 'video')}
                className="py-3 px-3 rounded-xl bg-[#F0F2F5] dark:bg-[#202C33] hover:bg-[#D9FDD3] dark:hover:bg-[#005C4B] text-[#111B21] dark:text-[#E9EDEF] text-xs font-semibold flex flex-col items-center gap-1.5 cursor-pointer"
              >
                <Video className="w-4 h-4 text-[#00A884]" aria-hidden="true" />
                <span>Video Call</span>
              </button>
            </div>

            {/* Profile Details */}
            <div className="space-y-3 pt-4 border-t border-black/8 dark:border-white/10 text-xs">
              <div>
                <p className="text-[#667781] dark:text-[#8696A0]">Info</p>
                <p className="text-sm text-[#111B21] dark:text-[#E9EDEF] mt-0.5">
                  {selectedDir.bio || 'Tidak ada info'}
                </p>
              </div>
              {selectedSaved?.notes && (
                <div>
                  <p className="text-[#667781] dark:text-[#8696A0]">Catatan</p>
                  <p className="text-sm text-[#111B21] dark:text-[#E9EDEF] mt-0.5">
                    {selectedSaved.notes}
                  </p>
                </div>
              )}
            </div>

            {/* Save / Edit / Delete Contact */}
            <div className="pt-4 border-t border-black/8 dark:border-white/10 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => openAddForm(selectedDir)}
                className="flex-1 py-2.5 px-4 rounded-xl bg-[#F0F2F5] dark:bg-[#202C33] hover:bg-black/8 dark:hover:bg-white/10 text-xs font-semibold text-[#111B21] dark:text-[#E9EDEF] flex items-center justify-center gap-2 cursor-pointer"
              >
                <Edit3 className="w-4 h-4 text-[#00A884]" aria-hidden="true" />
                <span>{selectedSaved ? 'Edit Kontak' : 'Simpan Kontak'}</span>
              </button>

              {selectedSaved && (
                <button
                  type="button"
                  onClick={async () => {
                    await onDeleteContact(selectedSaved.contactUid);
                    setSelectedUid(null);
                    setMobileShowDetail(false);
                  }}
                  aria-label="Hapus kontak tersimpan"
                  className="py-2.5 px-4 rounded-xl bg-red-600/10 hover:bg-red-600/20 text-red-600 dark:text-red-400 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" aria-hidden="true" />
                  <span>Hapus</span>
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="hidden md:flex flex-col items-center justify-center text-center max-w-sm my-auto">
            <div className="w-16 h-16 rounded-full bg-[#00A884]/15 text-[#00A884] flex items-center justify-center mb-4">
              <Users className="w-8 h-8" aria-hidden="true" />
            </div>
            <h2 className="text-lg font-bold text-[#111B21] dark:text-[#E9EDEF]">
              Kontak
            </h2>
          </div>
        )}
      </section>
    </div>
  );
}
