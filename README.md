# WhatApp — Pesan Instan Nomor Virtual & E2EE

Aplikasi perpesanan instan bergaya WhatsApp dengan:
- **Login Akun Google -> Nomor Virtual Acak**: Setiap sesi login akun Google menghasilkan nomor virtual acak (`+62 899-XXXX-XXXX`) yang dapat diacak ulang kapan saja. Email Google terisolasi di `/users/{uid}/private/info` dan tidak pernah tampil ke pengguna lain.
- **Enkripsi End-to-End (E2EE)**: Pertukaran kunci ECDH P-256 + HKDF-SHA-256 + AES-256-GCM (IV 96-bit acak per pesan) via Web Crypto API.
- **Telepon Suara & Video Call Real-Time**: Panggilan suara dan video peer-to-peer WebRTC (DTLS-SRTP) dengan pensinyalan Firestore.
- **Kontak & Profil**: Simpan kontak berdasarkan nomor virtual dengan nama khusus & catatan, serta foto profil.

## Rilis APK Otomatis di GitHub

Workflow `.github/workflows/android-release.yml` telah disiapkan untuk membangun APK Android (`WhatApp-<tag>.apk`) lengkap dengan ikon aplikasi via Capacitor dan menerbitkan GitHub Release secara otomatis:

```bash
git init
git add .
git commit -m "Initial WhatApp release"
git branch -M main
git remote add origin https://github.com/<username>/<repo>.git
git push -u origin main
git tag v1.0.0
git push origin v1.0.0
```
