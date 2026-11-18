# Deploy WhatApp ke cPanel Starter

Repo ini berisi frontend React/Vite dan backend Node.js terpisah untuk FCM. Frontend disajikan sebagai file statis; Node.js hanya dipakai untuk API push. Jangan taruh service-account JSON di `public_html` atau di GitHub.

## Yang sudah disiapkan

- `public/fcm-sw.js`: handler notifikasi FCM latar belakang untuk PWA.
- `server/app.js`: API yang memverifikasi Firebase ID token, menyimpan token perangkat secara privat, memvalidasi panggilan/pesan di Firestore, lalu mengirim FCM.
- `public/.htaccess`: fallback URL React dan pengecualian rute `/api`.
- Firebase Admin membaca Firestore database ID yang dikonfigurasi pada server, termasuk bila bukan `(default)`.

## Nilai Firebase yang perlu diisi sekali

1. Di Firebase Console, buka **Project settings → Cloud Messaging** dan salin **Web Push certificates → Key pair** (public VAPID key). Ini bukan private key.
2. Di Firebase Console, buat/unduh private key service account yang memiliki izin untuk membaca/menulis Firestore dan mengirim FCM. Simpan file JSON di direktori privat di luar `public_html`, misalnya `/home/CPANEL_USERNAME/private/whatapp-firebase-admin.json`; jangan commit atau bagikan file ini.
3. Pastikan FCM HTTP v1 API aktif. Tambahkan `whatapp.my.id` di Firebase Authentication → Settings → Authorized domains.

## Build frontend

Jalankan di folder repo:

```bash
npm ci --legacy-peer-deps
npm run build
```

Upload seluruh isi folder `dist/` ke `public_html/` domain `whatapp.my.id`, termasuk `.htaccess`, `sw.js`, `fcm-sw.js`, dan aset. Pastikan SSL aktif. Bila `.htaccess` tidak disalin oleh File Manager, unggah manual dari `public/.htaccess`.

## Backend Node.js di cPanel

1. Buka **Setup Node.js App** dan buat aplikasi Node.js 24 dengan application root di luar `public_html` (contoh `whatapp-api`), application URL `/api`, startup file `app.js`.
2. Unggah isi folder `server/` ke application root, lalu jalankan **Run NPM Install** dari layar aplikasi.
3. Tambahkan environment variables berikut pada aplikasi:

```text
FIREBASE_PROJECT_ID = nilai projectId dari firebase-applet-config.json
FIREBASE_DATABASE_ID = nilai firestoreDatabaseId dari firebase-applet-config.json
FIREBASE_VAPID_PUBLIC_KEY = public VAPID key dari Firebase Cloud Messaging
GOOGLE_APPLICATION_CREDENTIALS = path absolut ke file service-account di luar public_html
ALLOWED_ORIGINS = https://whatapp.my.id
```

4. Restart aplikasi Node.js. Buka `https://whatapp.my.id/api/health`; `configured` dan `vapidKeyConfigured` harus bernilai `true`.
5. Login ke situs dengan Google dan izinkan notifikasi. Setelah itu token perangkat terdaftar pada koleksi `pushTokens` oleh backend.

API hanya mengirim notifikasi setelah memverifikasi pemanggil dan membaca ulang dokumen panggilan/pesan di Firestore. Isi pesan tidak dikirim ke FCM; notifikasi pesan bersifat generik.

## Batasan dan pemeriksaan

- Integrasi ini menargetkan **web/PWA** pada `whatapp.my.id`. Build APK Android saat ini memakai notifikasi lokal dan belum mendaftarkan token FCM native.
- Firebase Console perlu VAPID public key dan service-account credentials sebelum push benar-benar terkirim.
- Jika `configured` masih `false`, periksa environment variables cPanel. Jangan menyalin service-account JSON ke `public_html`.

## Dokumentasi resmi

- [Menerima FCM pada aplikasi web](https://firebase.google.com/docs/cloud-messaging/web/receive-messages)
- [Mengirim FCM dengan Firebase Admin SDK](https://firebase.google.com/docs/cloud-messaging/send/admin-sdk)
- [Memasang aplikasi Node.js di cPanel](https://docs.cpanel.net/knowledge-base/web-services/how-to-install-a-node.js-application/)
