# QR Studio

[![TypeScript](https://img.shields.io/badge/TypeScript-7.0-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Vite](https://img.shields.io/badge/Vite-8.x-646CFF?logo=vite&logoColor=white)](https://vite.dev)
[![PWA](https://img.shields.io/badge/PWA-offline_ready-5A0FC8?logo=pwa&logoColor=white)](https://vite-pwa-org.netlify.app)
[![Vitest](https://img.shields.io/badge/Tests-37_passed-success?logo=vitest&logoColor=white)](#pengembangan)
[![Vercel](https://img.shields.io/badge/Deploy-Vercel-000000?logo=vercel&logoColor=white)](#deploy-ke-vercel)
[![Demo](https://img.shields.io/badge/Demo-qr.solusikoding.com-0b6e4f?logo=googlechrome&logoColor=white)](https://qr.solusikoding.com/)

**Stack:** TypeScript (vanilla, tanpa framework) · Vite · vite-plugin-pwa · [qrcode](https://github.com/soldair/node-qrcode) untuk encoding · [jsQR](https://github.com/cozmo/jsQR) + `BarcodeDetector` untuk decoding · [fflate](https://github.com/101arrowz/fflate) untuk ekspor ZIP · Plus Jakarta Sans · Vitest

PWA pembuat kode QR. Tanpa login, tanpa server, tanpa pelacakan: setiap kode QR dibuat, diberi gaya, dicek, dan diekspor langsung di browser.

🌐 **Coba demo:** [qr.solusikoding.com](https://qr.solusikoding.com/)

## Fitur

- **10 jenis konten**: link, teks, WiFi, kontak (vCard 3.0), email, SMS, telepon, WhatsApp, lokasi, acara kalender
- **Gaya**: warna, gradien linear/radial, 5 bentuk modul, bentuk finder, warna finder terpisah, logo dengan kenaikan error correction otomatis, bingkai berlabel, pengaturan quiet zone dan error correction, preset bawaan maupun simpanan
- **Cek scan**: setiap pratinjau di-decode ulang (`BarcodeDetector` bawaan platform lebih dulu, jsQR sebagai cadangan) dan hasilnya tampil sebagai chip lolos/gagal
- **Ekspor**: PNG, SVG, JPG, WebP (512–4096 px), salin gambar, Web Share, cetak, salin payload; `Ctrl/⌘ + S` untuk mengunduh
- **Banyak sekaligus**: tempel baris atau unggah CSV/TSV → ZIP (maks. 500 baris), dengan error per baris dan laporan `yang-gagal.txt`
- **Pemindai**: kamera (ganti kamera, senter), unggah gambar, drag & drop, tempel; hasil WiFi/kontak/acara punya aksi khusus
- **Riwayat**: hanya tersimpan lokal, pencarian, pulihkan, backup/restore dalam JSON
- **PWA**: offline, bisa di-install, share target, app shortcut, notifikasi pembaruan; tema terang/gelap/otomatis

## Tampilan

- Semua halaman punya struktur yang sama: header halaman (judul, deskripsi satu baris, aksi) lalu kartu-kartu dengan judul bagian bernomor bila halamannya berupa urutan langkah
- **Desktop**: navigasi di atas; di halaman Buat, panel pratinjau dan ekspor tetap menempel di kanan sementara langkah-langkah di kiri bisa di-scroll; Banyak dan Pindai memakai tata letak dua kolom
- **Mobile**: tab bar di bawah agar mudah dijangkau jempol; di halaman Buat, hasil dan tombol unduh muncul tepat setelah langkah konten, opsi gaya di bawahnya; bar mengambang "Lihat hasil / Unduh" muncul begitu QR sudah ada dan pratinjau berada di luar layar
- Pindai selalu menampilkan panel hasil, dengan tampilan kosong sampai ada yang dipindai; Riwayat punya pencarian dan menyembunyikan aksi backup/hapus saat masih kosong
- Satu set design token di `src/style.css` (hijau brand `#0b6e4f` dari ikon aplikasi, dasar netral hangat) dipakai untuk tema terang maupun gelap
- Scrollbar halaman disembunyikan supaya lebar layout tidak bergeser saat pindah antara halaman pendek dan panjang

## Edge case yang ditangani

Penebakan dan pemblokiran skema URL (`javascript:`, `data:` …), peringatan http dan punycode · escaping WiFi/vCard/iCal · normalisasi nomor Indonesia untuk WhatsApp (`08…`, `+62`, `0062`, tanpa kode negara) · parsing link Google Maps dan penjelasan untuk short link · desimal dengan koma · waktu lokal → UTC untuk acara, acara seharian, waktu selesai sebelum mulai · batas kapasitas byte per level error correction · peringatan kontras, warna terbalik, latar transparan, dan quiet zone tipis · peringatan kode terlalu padat dan ukuran cetak minimum · alignment pattern tetap solid pada gaya titik agar tetap terbaca · batas ukuran canvas untuk iOS · WebP jatuh ke PNG bila tidak didukung · deteksi fitur clipboard/share · fallback kuota storage (logo dibuang lebih dulu) · sanitasi gaya dari storage dan backup yang diimpor · pesan izin kamera, kamera sedang dipakai, dan konteks tidak aman.

## Pengembangan

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # unit test + test round-trip encode/decode
npm run build      # cek tipe lalu build ke dist/
npm run icons      # buat ulang ikon PWA (butuh ImageMagick)
```

## Deploy ke Vercel

Impor repository di Vercel (framework preset: Vite) atau jalankan `npx vercel --prod`. `vercel.json` sudah mengatur build command, CSP ketat, `Permissions-Policy` untuk kamera/geolokasi, dan header no-cache untuk service worker.

## Dukung & Donasi

Jika proyek ini bermanfaat bagi Anda, dukung pengembangannya melalui **QRIS**:

<p align="center">
  <img src="docs/qris.png" width="240" alt="QRIS Donasi - RZ Printing" />
  <br>
  <em>Scan QRIS menggunakan BCA, Mandiri, BRI, GoPay, OVO, DANA, ShopeePay, atau mobile banking lainnya.</em>
</p>

## Kontak

Dikembangkan oleh **rizalahmaddd**:
- **WhatsApp**: [+62 857-7777-5477](https://wa.me/6285777775477)
- **GitHub**: [@rizalahmaddd](https://github.com/rizalahmaddd)
- **Lokasi**: Kota Malang, Jawa Timur, Indonesia
