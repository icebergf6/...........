import React, { useState, useMemo, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import {
  BookOpen,
  Compass,
  CheckCircle2,
  Clock,
  Wallet,
  Server,
  Trophy,
  Bell,
  ShieldCheck,
  ArrowRight,
  Search,
  ExternalLink,
  Zap,
  CheckSquare,
  DollarSign,
  Layers,
  Lightbulb,
  Sparkles,
  RefreshCw,
  AlertTriangle,
  Calendar,
  ChevronRight,
  Users,
  MessageSquare,
  Lock,
  Download,
  Scale,
  Check,
  Copy,
  Calculator,
  UserCheck,
  Briefcase,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { formatRupiah } from '../lib/supabase';

// ============================================================================
// DATA TERSTRUKTUR UNTUK 7 SUB-HALAMAN & FITUR PENCARIAN GLOBAL
// ============================================================================

const STUDIO_RULES = [
  {
    id: 'rule-1',
    code: 'PASAL 01',
    severity: 'high',
    severityLabel: 'Wajib & Mengikat',
    badgeBg: '#fee2e2',
    badgeColor: '#991b1b',
    borderColor: '#ef4444',
    title: 'Tabel Prospek Mandiri Per-User & Kepemilikan Klien (Client Ownership)',
    summary:
      'Setiap hunter memiliki tabel prospek independen yang terisolasi dari hunter lain, sementara sistem deteksi duplikat otomatis mencegah tabrakan prospek.',
    points: [
      {
        subtitle: '1.1 Isolasi Tabel Prospek Mandiri (Independent Table)',
        text: 'Setiap anggota tim (User) memiliki tabel prospek masing-masing yang bersifat independen. Pekerjaan dan daftar prospek User A tidak dapat dilihat oleh User B, namun seluruhnya terintegrasi penuh ke panel supervisi Admin dan skor Leaderboard publik.',
      },
      {
        subtitle: '1.2 Deteksi Duplikat Otomatis & Prinsip First-Input',
        text: 'Saat menginput prospek baru, sistem otomatis memeriksa apakah nomor WhatsApp atau bisnis tersebut sudah didaftarkan oleh hunter lain. Hunter yang pertama kali menginput prospek adalah pemilik sah (Owner PIC) dan memiliki masa proteksi aktif 14 hari.',
      },
      {
        subtitle: '1.3 Aturan Gugur Hak (14-Day Grace Period Expiry)',
        text: 'Apabila prospek berstatus Baru atau Follow Up dibiarkan tanpa ada satupun update Log Touchpoint selama lebih dari 14 hari kalender, Admin berhak mencabut kepemilikan dan mengalihkannya ke hunter lain yang lebih aktif.',
      },
    ],
    sanction:
      'Sanksi Pelanggaran: Hunter yang terbukti menyerobot prospek aktif milik rekan tim lain akan dikenakan pembatalan komisi (0%) pada deal tersebut, dan 100% hak komisi dikembalikan kepada penginput pertama.',
  },
  {
    id: 'rule-2',
    code: 'PASAL 02',
    severity: 'medium',
    severityLabel: 'Disiplin Harian',
    badgeBg: '#e0f2fe',
    badgeColor: '#0369a1',
    borderColor: '#0284c7',
    title: 'Disiplin Timer Jam Kerja (Minimal 3 Jam) & Kebebasan Overwork (Attendance Policy)',
    summary:
      'Menetapkan jam kerja minimum harian 3 jam efektif dengan dukungan penuh lembur (overwork) tanpa batas dan multi-mode timer.',
    points: [
      {
        subtitle: '2.1 Target Standar Harian (Minimal 3 Jam Kerja Efektif & Kebebasan Overwork)',
        text: 'Setiap anggota tim memiliki kuota standar minimal 3 jam kerja efektif per hari. Timer mendukung mode Stopwatch bebas, Pomodoro 25/5, Countdown Kustom, dan Hitung Mundur Sisa Target 3 Jam. Setiap anggota tim berhak melakukan overwork (lembur) tanpa batas kuota, dan seluruh jam lembur terekam penuh di statistik profil dan Leaderboard.',
      },
      {
        subtitle: '2.2 Kewajiban Jeda (Pause) Saat Istirahat',
        text: 'Timer wajib ditekan Jeda (Pause) saat istirahat makan, ibadah, atau urusan pribadi di luar pekerjaan studio demi menjaga akurasi dan objektivitas data waktu kerja.',
      },
      {
        subtitle: '2.3 Korelasi Waktu Kerja & Integritas Data',
        text: 'Setiap penambahan prospek dan pembaruan log touchpoint disinkronisasikan secara real-time dengan status timer aktif untuk memvalidasi keaslian jam kerja dan produktivitas harian.',
      },
    ],
    sanction:
      'Sanksi Pelanggaran: Menyalakan timer tanpa aktivitas produktif (idle running) atau memalsukan jam kerja akan berakibat pada pembatalan jam kerja yang bersangkutan pada evaluasi mingguan studio.',
  },
  {
    id: 'rule-3',
    code: 'PASAL 03',
    severity: 'success',
    severityLabel: 'Standar Komersial',
    badgeBg: '#dcfce7',
    badgeColor: '#166534',
    borderColor: '#16a34a',
    title: 'Ketentuan Harga Dasar, Batas Diskon, & Syarat DP 50%',
    summary:
      'Menjaga margin keuntungan studio dan mencegah perang harga tidak sehat di bawah standar operasional.',
    points: [
      {
        subtitle: '3.1 Harga Minimum Paket Website (Floor Price)',
        text: 'Landing Page UMKM/Promo minimal Rp 1.500.000 • Website Company Profile Bisnis minimal Rp 3.000.000 • Website Custom / Katalog E-Commerce minimal Rp 5.000.000.',
      },
      {
        subtitle: '3.2 Wewenang Diskon Maksimal 10%',
        text: 'Hunter hanya diperbolehkan memberikan diskon negosiasi maksimal 10% dari harga penawaran. Diskon lebih dari 10% wajib mendapat persetujuan Admin terlebih dahulu.',
      },
      {
        subtitle: '3.3 Syarat Wajib DP Minimal 50% Sebelum Produksi',
        text: 'Status prospek baru boleh diubah ke Deal dan masuk antrean pengerjaan tim web apabila klien telah mentransfer DP minimal 50% ke rekening resmi studio.',
      },
    ],
    sanction:
      'Catatan Penting: Pengerjaan desain atau koding dilarang dimulai apabila status pembayaran masih Belum DP.',
  },
  {
    id: 'rule-4',
    code: 'PASAL 04',
    severity: 'warning',
    severityLabel: 'Aturan Keuangan',
    badgeBg: '#fef3c7',
    badgeColor: '#92400e',
    borderColor: '#d97706',
    title: 'Skema Perhitungan & Jadwal Pencairan Komisi Hunter',
    summary:
      'Transparansi penuh perhitungan komisi berbasis uang kas masuk nyata (Real Cash-In).',
    points: [
      {
        subtitle: '4.1 Perhitungan Berbasis Real Cash-In',
        text: 'Komisi hunter (default 15%) dihitung langsung dari uang tunai yang sudah masuk ke rekening studio. Saat klien membayar DP 50%, komisi 15% dari nilai DP langsung tercatat sebagai hak komisi hunter.',
      },
      {
        subtitle: '4.2 Jadwal Rekonsiliasi & Transfer Komisi',
        text: 'Admin melakukan verifikasi mutasi bank dan mencairkan komisi yang berstatus siap bayar setiap hari Jumat sore ke rekening yang terdaftar di halaman Profile masing-masing anggota.',
      },
      {
        subtitle: '4.3 Klausul Pembatalan / Refund Klien',
        text: 'Apabila proyek batal di tengah jalan karena kesalahan fatal hunter (misal menjanjikan fitur yang tidak mungkin dikerjakan), maka komisi yang telah cair pada proyek tersebut wajib dikompensasikan pada deal berikutnya.',
      },
    ],
    sanction:
      'Jaminan Studio: Setiap rupiah uang masuk klien yang telah diverifikasi Admin dijamin memperbarui saldo komisi Anda secara real-time.',
  },
  {
    id: 'rule-5',
    code: 'PASAL 05',
    severity: 'info',
    severityLabel: 'SLA & Keamanan',
    badgeBg: '#f3e8ff',
    badgeColor: '#6b21a8',
    borderColor: '#9333ea',
    title: 'Batas Maksimal 3x Revisi, Managed Hosting, & Kerahasiaan Kredensial',
    summary:
      'Mengatur batasan ruang lingkup pengerjaan proyek serta keamanan password server klien.',
    points: [
      {
        subtitle: '5.1 Kuota Maksimal 3 Putaran Revisi',
        text: 'Setiap proyek memiliki jatah maksimal 3 kali revisi. Hunter wajib mengarahkan klien untuk merangkum poin revisi sekaligus dalam satu daftar tertulis (bukan dicicil sedikit demi sedikit).',
      },
      {
        subtitle: '5.2 Aturan Pembedaan Full Managed vs Beli Putus',
        text: 'Klien yang memilih Full Managed wajib dicatat tanggal jatuh tempo perpanjangannya di menu Managed Hosting. Klien Beli Putus diserahkan seluruh aksesnya setelah lunas tanpa kewajiban maintenance bulanan/tahunan.',
      },
      {
        subtitle: '5.3 Isolasi Kredensial Server & CMS',
        text: 'Data login cPanel, VPS, dan WP-Admin klien bersifat sangat rahasia. Sistem mengenkripsi dan membatasi tampilan kredensial hanya untuk Admin, Pembuat Prospek, dan PIC Project yang ditugaskan.',
      },
    ],
    sanction:
      'Sanksi Keamanan: Membocorkan kredensial server klien atau mengekspor database prospek untuk kepentingan di luar A-Tier Studio akan berujung pada penonaktifan akun (Suspended) secara permanen.',
  },
  {
    id: 'rule-6',
    code: 'PASAL 06',
    severity: 'info',
    severityLabel: 'Tata Kelola Akun',
    badgeBg: '#eff6ff',
    badgeColor: '#1d4ed8',
    borderColor: '#3b82f6',
    title: 'Tata Kelola Status Akun, Skorsing Berbatas Waktu & Pemulihan Otomatis (Lifecycle)',
    summary:
      'Menetapkan siklus hidup akun tim, masa tenggang skorsing sementara berbatas waktu, dan mekanisme pemulihan otomatis (Auto-Reactivation).',
    points: [
      {
        subtitle: '6.1 Status Akun (Aktif, Percobaan, & Nonaktif Sementara)',
        text: 'Manajemen berhak menetapkan status akun anggota tim: Active (Aktif Penuh), Probation (Masa Percobaan), atau Suspended (Nonaktif Sementara) dengan tanggal tenggat berakhir jika terjadi evaluasi disiplin kerja atau cuti berkala.',
      },
      {
        subtitle: '6.2 Pemulihan Otomatis Tanpa Registrasi Ulang (Auto-Reactivation)',
        text: 'Akun yang dinonaktifkan sementara dengan tenggat waktu akan secara otomatis dipulihkan (auto-reactivated) oleh sistem tepat saat waktu tenggat habis. Anggota tim dapat langsung login kembali seperti biasa tanpa perlu membuat akun baru.',
      },
      {
        subtitle: '6.3 Sanksi Penonaktifan Permanen & Penghapusan Akun',
        text: 'Pelanggaran berat terhadap etika studio seperti pencurian database prospek, membocorkan kredensial cPanel klien, atau kecurangan data akan berujung pada penonaktifan permanen atau penghapusan akun secara definitif dari sistem.',
      },
    ],
    sanction:
      'Jaminan Perlindungan: Hak komisi dari deal sah yang telah selesai tetap diakui dan diselesaikan secara profesional sesuai ketentuan studio.',
  },
];

const DAILY_WORKFLOW_STEPS = [
  {
    id: 'step-1',
    session: 'SESI 1 • 08:30 – 10:00 WIB (90 Menit Pertama)',
    title: 'Check-In Timer & Riset 5–10 Prospek Baru Terfokus',
    focusTag: 'Riset & Prospecting',
    route: '/attendance',
    routeLabel: 'Buka Absen & Timer',
    color: '#2563eb',
    bgLight: '#eff6ff',
    tasks: [
      'Buka halaman Absen & Stopwatch, pilih mode timer (Stopwatch bebas, Pomodoro, Countdown Kustom, atau Sisa Target 3 Jam) dengan tag "Riset & Prospecting", lalu klik Mulai Kerja.',
      'Buka halaman Database Prospek Mandiri, periksa daftar prospek dengan jadwal follow-up yang jatuh tempo hari ini.',
      'Lakukan riset 5–10 bisnis potensial di Google Maps / Instagram yang websitenya lambat atau belum mobile-friendly, lalu input ke tabel prospek pribadi Anda.',
    ],
  },
  {
    id: 'step-2',
    session: 'SESI 2 • 10:00 – 11:30 WIB (Pencapaian Target 3 Jam)',
    title: 'Outreach WhatsApp Terarah & Selesaikan Target Minimal 3 Jam',
    focusTag: 'Outreach WhatsApp',
    route: '/prospects',
    routeLabel: 'Buka Prospek Tim',
    color: '#0284c7',
    bgLight: '#f0f9ff',
    tasks: [
      'Lanjutkan timer kerja Anda untuk mengakumulasi waktu kerja menuju kuota minimal 3 jam kerja efektif hari ini.',
      'Buka Drawer Detail prospek baru, klik tombol WhatsApp untuk menyapa pemilik bisnis menggunakan template chat teruji dari Playbook.',
      'Catat hasil percakapan di kolom Log Touchpoint dan atur preset jadwal follow-up berikutnya (+1 Hari atau +3 Hari).',
      'Saat akumulasi timer mencapai 3 jam, sistem menampilkan floating banner selamat karena target minimal harian Anda resmi terpenuhi!',
    ],
  },
  {
    id: 'step-3',
    session: 'ISTIRAHAT • 11:30 – 13:00 WIB',
    title: 'Jeda Timer (Istirahat Siang & Ibadah)',
    focusTag: 'Jeda Istirahat',
    route: '/attendance',
    routeLabel: 'Jeda Timer',
    color: '#d97706',
    bgLight: '#fffbeb',
    tasks: [
      'Tekan tombol Jeda (Pause) pada halaman Timer atau lewat indikator waktu melayang di bilah atas layar.',
      'Pastikan status timer berubah menjadi Paused saat beristirahat agar pencatatan waktu kerja tetap akurat dan objektif.',
    ],
  },
  {
    id: 'step-4',
    session: 'SESI 4 • SESI OVERWORK / EKSTRA CLOSING (Sangat Didukung)',
    title: 'Sesi Overwork Bebas: Follow-Up Intensif, Closing Deal, & Terbitkan Invoice',
    focusTag: 'Closing & Overwork',
    route: '/deals',
    routeLabel: 'Buka Deal & Keuangan',
    color: '#16a34a',
    bgLight: '#f0fdf4',
    tasks: [
      'Nyalakan kembali timer untuk melakukan overwork (lembur) tanpa batas kuota — seluruh waktu ekstra otomatis tercatat dan melipatgandakan skor Leaderboard.',
      'Sapa kembali prospek hangat yang merespons penawaran pagi tadi untuk merundingkan paket website.',
      'Ketika klien sepakat order, buka menu Klien Deal & Keuangan lalu klik "+ Tambah Klien Deal". Gunakan Tab "Ambil Dari Database Prospek" untuk mentransfer data prospek ke deal secara instan dengan satu klik!',
      'Terbitkan tagihan resmi berlogo studio melalui tombol Invoice dan kirimkan ke klien untuk pembayaran DP 50%.',
      'Sebelum menutup laptop/HP, klik tombol "Isi Ringkasan Otomatis" di halaman Absensi untuk merangkum seluruh hasil kerja harian dalam 1 detik.',
    ],
  },
];

const FEATURE_MODULES = [
  {
    id: 'mod-1',
    number: '01',
    role: 'Semua Tim',
    roleBadge: 'pill-linkedin',
    title: 'Absensi, Multi-Mode Timer Realtime & Overwork',
    path: '/attendance',
    icon: Clock,
    purpose:
      'Mencatat jam kerja presisi dengan 4 pilihan mode timer, memantau target harian minimal 3 jam, kebebasan lembur (overwork) tanpa batas, dan rekap otomatis.',
    steps: [
      'Pilih 1 dari 4 Mode Timer: (1) Stopwatch Bebas, (2) Pomodoro 25/5 Menit, (3) Countdown Kustom Menit Bebas, atau (4) Hitung Mundur Sisa Target 3 Jam.',
      'Pilih Tag Fokus Kerja (Riset & Prospecting, Outreach WA, Follow-up, Delivery Web, Meeting, atau QC) lalu klik "Mulai Kerja".',
      'Pantau progres target harian: kartu KPI otomatis menghitung persentase menuju target minimal 3 jam kerja efektif.',
      'Bebas melakukan Overwork (lembur): setelah melewati kuota 3 jam, timer terus berjalan menghitung jam lembur Anda untuk meningkatkan skor MVP.',
      'Klik tombol "Isi Ringkasan Otomatis" di sore hari untuk menghasilkan rangkuman kerja harian lengkap (durasi, prospek, touchpoint, deal) dalam 1 detik.',
    ],
    proTip:
      'Indikator timer berjalan aktif juga tampil di navbar bagian atas sehingga Anda dapat memantau waktu kerja saat berpindah ke halaman lain.',
  },
  {
    id: 'mod-2',
    number: '02',
    role: 'Sales Hunter',
    roleBadge: 'pill-gmaps',
    title: 'Database Prospek Mandiri (Per-User) & Side-Peek Drawer',
    path: '/prospects',
    icon: Users,
    purpose:
      'Mengelola prospek kerja mandiri terisolasi per individu (data User A aman dari User B) dengan deteksi duplikat aman dan proteksi kepemilikan 14 hari.',
    steps: [
      'Klik "+ Tambah Prospek" di pojok kanan atas untuk menambahkan calon klien baru ke tabel kerja mandiri Anda.',
      'Ketik nomor WhatsApp atau nama bisnis — sistem dilengkapi "Privacy-Safe Duplicate Detector" yang otomatis memperingatkan jika klien tersebut sudah terdaftar sebelumnya.',
      'Klik salah satu baris prospek pada tabel untuk membuka "Drawer Detail Prospek" di sisi kanan layar.',
      'Di dalam Drawer, gunakan tombol preset jadwal Follow-Up ("Hari Ini", "Besok", "+3 Hari", "+1 Minggu") dan catat setiap riwayat chat di bagian "Log Aktivitas Touchpoint".',
      'Gunakan tombol "Export CSV / Excel" untuk mengunduh laporan prospek pribadi Anda yang rapi sewaktu-waktu.',
    ],
    proTip:
      'Seluruh prospek dan aktivitas touchpoint yang Anda kelola otomatis menyumbang poin ke Leaderboard kompetisi tim secara real-time dan transparan.',
  },
  {
    id: 'mod-3',
    number: '03',
    role: 'Hunter & Finance',
    roleBadge: 'status-deal',
    title: 'Klien Deal, Modal Dual-Tab Prospek, & Invoice Generator',
    path: '/deals',
    icon: Wallet,
    purpose:
      'Mengelola klien closing, memindahkan data prospek ke deal secara instan dengan modal 2-tab, bagi hasil komisi otomatis, dan penerbitan invoice resmi.',
    steps: [
      'Klik tombol "+ Tambah Klien Deal" di halaman Klien Deal & Keuangan — modal pop-up dilengkapi 2 Tab di bagian atas:',
      '• Tab 1 (Input Manual): Mengisi data proyek secara langsung untuk klien baru atau repeat order.',
      '• Tab 2 (Ambil Dari Database Prospek): Menampilkan daftar prospek Anda secara lengkap. Cukup klik tombol satu-klik "Pilih Prospek Ini", seluruh data (Nama, WhatsApp, Industri, Nilai Estimasi, dan Catatan) langsung terisi otomatis!',
      'Pilih Tipe Manajemen Klien: "Full Managed (Hosting & Domain Kami)" atau "Beli Putus (Hanya Jasa Web / Lepas)".',
      'Sistem secara otomatis menghitung hak Komisi Hunter (15% dari uang masuk kas) dan Alokasi Kas Studio (25%).',
      'Klik tombol "Invoice" pada baris klien untuk mencetak tagihan resmi berlogo studio ke format PDF siap kirim ke WhatsApp klien.',
    ],
    proTip:
      'Memindahkan data dari Tab Prospek ke Deal menghemat waktu penginputan hingga 90% dan sepenuhnya mengeliminasi risiko salah ketik nomor WhatsApp klien.',
  },
  {
    id: 'mod-4',
    number: '04',
    role: 'Hunter & Admin',
    roleBadge: 'pill-facebook',
    title: 'Full Managed Hosting & Perpanjangan Domain',
    path: '/managed-hosting',
    icon: Server,
    purpose:
      'Memantau khusus klien Deal yang berlangganan server cloud, domain, dan pemeliharaan rutin di bawah wewenang studio.',
    steps: [
      'Pantau kartu ringkasan di atas halaman: Total Klien Full Managed, Total Kas Terkumpul, Net Profit Bersih Studio, serta jumlah domain yang Segera Habis (H-30) atau Sudah Expired.',
      'Klik tombol "Edit" (ikon pensil) pada baris klien untuk mengatur nama domain, paket layanan, siklus tagihan (Tahunan / Bulanan), tanggal jatuh tempo, harga tagihan klien, dan modal server studio.',
      'Klik tombol "WA" untuk mengirim pesan pengingat perpanjangan via WhatsApp yang sudah terisi otomatis dengan nama domain, tanggal jatuh tempo, nominal tagihan, dan nomor rekening bank studio.',
      'Saat klien membayar perpanjangan, klik tombol "+1 Thn" atau "+1 Bln" — sistem otomatis memajukan tanggal jatuh tempo ke periode berikutnya dan menambahkan profit ke riwayat pembayaran seumur hidup.',
    ],
    proTip:
      'Algoritma tanggal telah dilengkapi proteksi akhir bulan (misal jatuh tempo 31 Januari saat diperpanjang +1 Bulan akan jatuh tepat di 28/29 Februari tanpa melompat ke Maret).',
  },
  {
    id: 'mod-5',
    number: '05',
    role: 'Tim Delivery / PIC',
    roleBadge: 'pill-website',
    title: 'Delivery Checklist 6 Tahap & Kredensial Terisolasi',
    path: '/deals',
    icon: Layers,
    purpose:
      'Memantau progres teknis pembangunan website dari tahap pengumpulan materi hingga Go-Live serta mengamankan password hosting klien.',
    steps: [
      'Buka Drawer Detail pada klien berstatus Deal atau melalui halaman Klien Deal & Keuangan.',
      'Centang 6 tahapan produksi secara berurutan: (1) Konten & Copywriting, (2) Wireframe, (3) UI Design, (4) Koding & Integrasi, (5) Quality Control, dan (6) Live Production.',
      'Isi tautan "Staging / Preview Web" dan "Live Website URL" (dilengkapi filter keamanan URL untuk mencegah link berbahaya).',
      'Gunakan tombol (+) dan (-) pada bagian "Jatah Revisi Klien" setiap kali klien mengajukan revisi (batas standar 3x revisi).',
      'Simpan catatan login cPanel / WordPress pada kolom Kredensial Hosting — kolom ini otomatis disensor (••••••••) bagi anggota tim yang tidak berkepentingan.',
    ],
    proTip:
      'Ketika tahapan ke-6 (Live Production) dicentang, pencapaian "Website Go-Live" anggota tim di halaman Leaderboard akan langsung bertambah!',
  },
  {
    id: 'mod-6',
    number: '06',
    role: 'Semua Tim',
    roleBadge: 'status-followup',
    title: 'Leaderboard Kompetisi Tim & Head-to-Head',
    path: '/leaderboard',
    icon: Trophy,
    purpose:
      'Menampilkan peringkat performa seluruh anggota tim secara transparan berdasarkan metrik kerja nyata di seluruh modul CRM.',
    steps: [
      'Pilih filter periode waktu: Hari Ini, 7 Hari Terakhir, Bulan Ini, atau Semua Waktu.',
      'Pilih kategori klasemen: Skor MVP Keseluruhan, Total Uang Masuk, Jumlah Closing Deal, Prospek Ditambahkan, Aktivitas Follow-Up, Website Go-Live, atau Durasi Jam Kerja.',
      'Gunakan fitur "Head-to-Head Comparison" di bagian tengah untuk membandingkan statistik dua anggota tim secara berdampingan pada 9 indikator sekaligus.',
    ],
    proTip:
      'Seluruh metrik performa dihitung otomatis secara objektif dari data riil absensi, prospek, dan transaksi yang berhasil diverifikasi studio.',
  },
  {
    id: 'mod-7',
    number: '07',
    role: 'Semua Tim',
    roleBadge: 'pill-instagram',
    title: 'Pusat Notifikasi & Floating Alert Pop-Up',
    path: '/notifications',
    icon: Bell,
    purpose:
      'Memberikan peringatan dini untuk jadwal follow-up yang terlewat, domain klien yang segera expired, penugasan project baru, dan pengumuman deal.',
    steps: [
      'Klik ikon Lonceng di bilah atas (navbar) kapan saja untuk melihat daftar notifikasi terbaru tanpa meninggalkan halaman yang sedang dibuka.',
      'Saat ada peringatan penting (seperti jadwal follow-up jatuh tempo hari ini), pop-up melayang akan muncul di pojok kanan bawah layar.',
      'Buka halaman Pusat Notifikasi (/notifications) untuk menyaring notifikasi berdasarkan kategori (Follow-Up, Keuangan & Deal, Proyek, Hosting, atau Absensi).',
    ],
    proTip:
      'Klik tombol tindakan pada kartu notifikasi untuk langsung melompat ke halaman prospek atau klien yang membutuhkan penanganan segera.',
  },
  {
    id: 'mod-8',
    number: '08',
    role: 'Khusus Admin',
    roleBadge: 'status-batal',
    title: 'Admin Command Center (7 Sub-Menu Pengendali)',
    path: '/admin',
    icon: ShieldCheck,
    purpose:
      'Pusat kendali pemilik studio untuk mendaftarkan akun tim baru, mengaudit keaslian prospek harian, mengelola karir user, dan mengatur parameter finansial.',
    steps: [
      'Tab 1 (Anggota Tim & Akses): Buat akun anggota tim baru dengan username & password langsung tanpa registrasi publik.',
      'Tab 2 (Manajemen Project): Tugaskan PIC pengembang web dan pantau status tahapan pengerjaan seluruh proyek klien.',
      'Tab 3 (User Berkelanjutan): Atur jenjang karir (Junior, Senior, Core Partner), target jam/prospek personal, dan persentase komisi khusus per anggota.',
      'Tab 4 (Audit Keaslian Kerja): Periksa korelasi waktu input prospek terhadap stopwatch absensi dan deteksi nomor WhatsApp duplikat.',
      'Tab 5, 6, & 7: Kelola log absensi manual, tandai pencairan komisi hunter (Paid), serta atur rekening bank studio & backup JSON.',
    ],
    proTip:
      'Gunakan tombol "Verifikasi Semua Hari Ini" pada tab Audit setelah memeriksa sampel prospek harian anggota tim.',
  },
];

const PLAYBOOK_SCRIPTS = [
  {
    id: 'script-1',
    category: 'Cold Outreach',
    badgeClass: 'pill-gmaps',
    title: '1. Script Pembuka Prospek dari Google Maps (Tingkat Balasan Tinggi)',
    whenToUse:
      'Gunakan untuk menyapa pemilik bisnis di Google Maps yang memiliki banyak ulasan bagus tetapi belum punya website atau websitenya lambat.',
    text: `Halo selamat siang Kak [Nama Pemilik / Admin Bisnis], salam kenal saya [Nama Anda] dari Tim A-Tier Web Design Studio 🙏✨

Saya sempat melihat profil Google Maps [Nama Bisnis] dan sangat terkesan dengan ulasan positif bintang 5 dari para pelanggan Kakak.

Kebetulan tim kami sedang meninjau tampilan informasi [Nama Bisnis] saat dicari lewat handphone, dan kami melihat peluang besar untuk meningkatkan kesan profesional brand Kakak sekaligus mempermudah pelanggan baru melakukan reservasi/pemesanan langsung ke WhatsApp.

Apakah berkenan jika saya kirimkan gambaran singkat / preview konsep website modern khusus untuk [Nama Bisnis]? Gratis dan tanpa komitmen apa pun kok Kak. Terima kasih banyak sebelumnya Kak! 😊`,
  },
  {
    id: 'script-2',
    category: 'Cold Outreach',
    badgeClass: 'pill-instagram',
    title: '2. Script Pembuka Bisnis Aktif di Instagram / TikTok',
    whenToUse:
      'Gunakan untuk brand lokal, klinik, cafe, atau jasa profesional yang aktif posting di sosmed tetapi link di bio-nya hanya mengarah ke chat biasa.',
    text: `Halo Kak Admin [Nama Brand], selamat siang! Salam kenal saya [Nama Anda] dari A-Tier Web Design Studio ✨

Kami barusan mampir ke Instagram @[Username IG] dan suka sekali dengan katalog produk/layanan yang ditampilkan—sangat rapi dan menarik.

Sedikit masukan membangun Kak: sering kali calon pembeli dari luar Instagram mencari nama [Nama Brand] di Google untuk melihat daftar layanan lengkap dan portofolio resmi sebelum yakin menghubungi WA.

Kami sudah menyiapkan 1 draf konsep halaman website resmi yang selaras dengan warna identitas @[Username IG]. Boleh saya kirimkan link preview-nya ke sini untuk Kakak lihat-lihat dulu? Terima kasih Kak! 🙏`,
  },
  {
    id: 'script-3',
    category: 'Follow-Up',
    badgeClass: 'status-followup',
    title: '3. Script Follow-Up Halus H+3 (Setelah Chat Pertama Belum Dibalas)',
    whenToUse:
      'Kirimkan tepat 3 hari setelah pesan pertama apabila prospek sudah centang biru namun belum sempat membalas.',
    text: `Halo selamat siang Kak [Nama Klien], semoga aktivitas bisnis di [Nama Bisnis] minggu ini berjalan lancar dan ramai ya Kak 🙏

Melanjutkan pesan saya beberapa hari lalu, saya izin melampirkan ringkasan 3 poin yang bisa membuat [Nama Bisnis] tampil lebih unggul dibanding kompetitor di pencarian Google lokal:
1. Tampilan mobile-friendly super cepat (terbuka di bawah 2 detik)
2. Tombol integrasi order/konsultasi langsung ke WhatsApp CS
3. Optimasi SEO dasar agar mudah ditemukan pelanggan sekitar

Kapan kira-kira Kakak ada waktu luang 5 menit untuk melihat contoh demonya? Santai saja Kak, ditunggu kabarnya ya! 😊`,
  },
  {
    id: 'script-4',
    category: 'Handling Objection',
    badgeClass: 'status-batal',
    title: '4. Menjawab Keberatan: "Biayanya Kemahalan / Ada yang Nawarin 500 Ribu"',
    whenToUse:
      'Gunakan saat calon klien membandingkan harga paket studio dengan jasa pembuatan web template murah di luar sana.',
    text: `Paham sekali Kak, wajar banget jika Kakak mempertimbangkan efisiensi biaya 🙏

Sebagai informasi transparan, jasa 500 ribuan umumnya menggunakan template instan gratis yang dipakai ribuan web lain, server berbagi (shared hosting) yang sering lambat/down saat dibuka pelanggan, dan lepas tangan ketika ada kendala teknis.

Di A-Tier Studio, investasi yang Kakak keluarkan sudah mencakup:
✅ Desain eksklusif menyesuaikan kredibilitas brand [Nama Bisnis]
✅ Struktur kecepatan tinggi yang disukai mesin pencari Google
✅ Cloud server cepat dengan keamanan SSL penuh
✅ Garansi pendampingan teknis sehingga Kakak cukup fokus mengurus bisnis tanpa pusing urusan error website.

Untuk membantu kelancaran cashflow, pembayarannya pun bertahap Kak: cukup DP 50% di awal dan pelunasan 50% setelah website selesai dan Kakak setujui hasilnya. Apakah skema ini cukup membantu untuk Kakak?`,
  },
  {
    id: 'script-5',
    category: 'Handling Objection',
    badgeClass: 'status-negosiasi',
    title: '5. Menjawab Keberatan: "Saya Diskusikan Dulu Sama Partner / Pikir-Pikir Dulu"',
    whenToUse:
      'Gunakan agar prospek tidak menghilang (ghosting) setelah mengatakan ingin berdiskusi internal.',
    text: `Siap Kak [Nama Klien], keputusan yang tepat untuk mendiskusikannya terlebih dahulu dengan partner agar semuanya selaras 👍

Supaya Kakak dan partner lebih mudah membayangkan hasil akhirnya saat berdiskusi nanti, bagaimana jika saya buatkan 1 ringkasan PDF penawaran resmi beserta estimasi jadwal pengerjaannya?

Kira-kira hari [Sebutkan Hari, misal: Kamis sore] saya izin menyapa Kakak kembali untuk menanyakan hasil diskusinya ya Kak. Terima kasih banyak Kak! 🙏✨`,
  },
  {
    id: 'script-6',
    category: 'Closing & Billing',
    badgeClass: 'status-deal',
    title: '6. Script Konfirmasi Deal & Pengiriman Invoice DP 50%',
    whenToUse:
      'Gunakan segera setelah klien menyatakan setuju memesan website agar momentum closing langsung terkonversi menjadi transfer DP.',
    text: `Terima kasih banyak atas kepercayaannya kepada A-Tier Web Design Studio, Kak [Nama Klien]! Kami sangat antusias membantu mewujudkan website resmi [Nama Bisnis] 🎉

Berikut kami lampirkan Invoice Resmi untuk pembayaran Down Payment (DP 50%) sebesar [Nominal DP] guna mengamankan slot pengerjaan minggu ini.

Pembayaran dapat ditransfer melalui rekening resmi kami yang tertera pada invoice. Setelah transfer berhasil, mohon kesediaannya mengirimkan bukti transfer ke chat ini agar Tim Produksi kami dapat langsung memulai tahap Wireframe & Desain hari ini.

Terima kasih banyak Kak, selamat berpartner! 🙏🚀`,
  },
  {
    id: 'script-7',
    category: 'Retensi & Hosting',
    badgeClass: 'pill-website',
    title: '7. Script Penawaran Perpanjangan Managed Hosting & Domain Tahunan',
    whenToUse:
      'Gunakan 30 hari hingga 7 hari sebelum masa aktif domain dan server hosting klien berakhir.',
    text: `Halo selamat pagi/siang Kak [Nama Klien], semoga bisnis [Nama Brand] semakin sukses dan lancar berkah ya Kak! 🙏✨

Izin menginformasikan bahwa masa aktif layanan Cloud Server Hosting & Domain resmi [domainklien.com] akan memasuki periode perpanjangan tahunan pada tanggal [Tanggal Jatuh Tempo].

Agar website tetap aktif 24/7 tanpa gangguan akses bagi para pelanggan Kakak, berikut rincian biaya perpanjangan tahunan (mencakup sewa server cloud cepat, perpanjangan nama domain, sertifikat keamanan SSL, dan pemeliharaan teknis rutin):
📌 Total Investasi Tahunan: [Nominal Tagihan]

Pembayaran dapat ditransfer ke rekening resmi studio kami:
🏦 [Nama Bank]: [Nomor Rekening] a.n [Nama Pemilik]

Mohon konfirmasinya jika dana sudah dialokasikan ya Kak. Terima kasih banyak atas kepercayaan berkelanjutan Kakak bersama A-Tier Studio! 🚀`,
  },
  {
    id: 'script-8',
    category: 'Follow Up Hangat',
    badgeClass: 'status-followup',
    title: '8. Script Re-Engage Prospek Lama yang Sempat Tertunda (Follow-Up Hangat)',
    whenToUse:
      'Gunakan untuk menyapa kembali prospek yang 1–2 bulan lalu sempat tertarik namun menunda eksekusi karena kesibukan.',
    text: `Halo selamat siang Kak [Nama Klien], apa kabar bisnis [Nama Brand]? Semoga orderan dan pelanggan makin ramai ya Kak 🙏😊

Saya izin menyapa kembali sekalian mengabarkan bahwa tim A-Tier Studio baru saja merilis beberapa portofolio website terbaru untuk industri [Nama Industri/Bisnis Klien] dengan fitur direct WhatsApp ordering yang terbukti meningkatkan konversi penjualan.

Mengingat beberapa waktu lalu Kakak sempat berencana memperbarui website [Nama Brand], apakah bulan ini momentum yang tepat untuk kita wujudkan? 

Kebetulan kami sedang membuka slot desain minggu ini dengan bonus gratis konsultasi copywriting. Jika Kakak berkenan, saya bisa kirimkan mockup konsep terbarunya siang ini. Bagaimana menurut Kakak? ✨`,
  },
];

const FAQ_ITEMS = [
  {
    id: 'faq-1',
    category: 'Export & Laporan',
    q: 'Mengapa file hasil Export Excel (.xls) sangat rapi dan angka nol nomor WhatsApp tidak hilang?',
    a: 'Sistem A-Tier CRM menggunakan engine generator XML/HTML Spreadsheet Workbook berstandar Microsoft Office dengan deklarasi CSS khusus mso-number-format:"\\@". Hal ini memaksa Excel membaca nomor telepon dan kode sebagai teks murni (bukan rumus ilmiah seperti 6.28E+11) serta otomatis membentuk header tabel berwarna biru, garis border sel, dan baris zebra yang siap dipresentasikan.',
  },
  {
    id: 'faq-2',
    category: 'Autentikasi & Akses',
    q: 'Mengapa tidak ada tombol Daftar Akun Baru (Sign Up) di halaman Login?',
    a: 'Untuk menjaga keamanan rahasia dagang dan database prospek studio, pendaftaran publik ditutup sepenuhnya (Admin-Only Provisioning). Apabila ada anggota tim baru, Admin akan mendaftarkan username, email, dan password melalui halaman Admin Command Center, lalu menyerahkan kredensial siap pakai tersebut kepada anggota tim.',
  },
  {
    id: 'faq-3',
    category: 'Autentikasi & Akses',
    q: 'Apakah saya bisa login cukup dengan mengetikkan Username tanpa menghafal alamat email?',
    a: 'Ya! Form login telah terintegrasi dengan fungsi pencarian profil pintar. Anda dapat mengetikkan Username (contoh: leo_syafiq atau rina_hunter) maupun alamat email lengkap, lalu sistem otomatis mencocokkannya dengan akun autentikasi Supabase Anda.',
  },
  {
    id: 'faq-4',
    category: 'Operasional Prospek',
    q: 'Bagaimana cara kerja normalisasi nomor WhatsApp otomatis saat saya klik tombol chat WA?',
    a: 'Banyak klien mencantumkan nomor telepon lokal dengan awalan nol (contoh: 0812-3456-7890) atau tanda baca spasi/strip. Fungsi normalizeWhatsAppNumber di sistem secara otomatis membersihkan karakter simbol dan mengubah awalan "0" menjadi kode negara Indonesia "62" sehingga tautan https://wa.me/6281234567890 selalu berhasil membuka ruang chat WhatsApp tanpa error.',
  },
  {
    id: 'faq-5',
    category: 'Keuangan & Hosting',
    q: 'Apa perbedaan memilih "Full Managed" vs "Beli Putus" saat mengubah prospek menjadi Deal?',
    a: 'Jika Anda memilih "Full Managed", klien tersebut otomatis masuk ke halaman khusus Managed Hosting (/managed-hosting) untuk dipantau tanggal jatuh tempo domain/server-nya setiap tahun atau bulan. Sebaliknya, jika memilih "Beli Putus (Project Only)", sistem menandai proyek tersebut sebagai lepas manajemen setelah selesai dibuat dan tidak akan memunculkan tagihan perpanjangan berulang.',
  },
  {
    id: 'faq-6',
    category: 'Keamanan Data',
    q: 'Siapa saja yang dapat melihat kolom Kredensial Hosting / Password CMS pada detail proyek?',
    a: 'Kolom kredensial dilindungi oleh kebijakan keamanan berlapis (Zero In-Memory Leak). Hanya 3 pihak yang dapat melihat dan mengubah isinya: (1) Administrator Studio, (2) Sales Hunter pembuat prospek tersebut, dan (3) PIC Project yang ditugaskan menangani pembuatan webnya. Anggota tim lain hanya akan melihat teks tersensor (••••••••).',
  },
  {
    id: 'faq-7',
    category: 'Klien Deal & Keuangan',
    q: 'Bagaimana cara memindahkan prospek menjadi Klien Deal secara instan tanpa ketik ulang?',
    a: 'Buka menu Klien Deal & Keuangan (/deals), lalu klik tombol "+ Tambah Klien Deal". Pada jendela pop-up modal, klik tab kedua "Ambil Dari Database Prospek". Anda akan melihat tabel seluruh prospek Anda lengkap dengan status dan kontaknya. Cukup klik tombol biru "Pilih Prospek Ini" pada baris prospek yang diinginkan, maka seluruh informasi (Nama Klien, Nomor WhatsApp, Nama Bisnis, Estimasi Nilai, dan Catatan) akan otomatis tersalin ke form deal dalam satu detik!',
  },
  {
    id: 'faq-8',
    category: 'Absensi & Stopwatch',
    q: 'Berapa target jam kerja harian minimal dan apakah saya boleh lembur (overwork)?',
    a: 'Target standar harian studio adalah MINIMAL 3 JAM kerja efektif per hari. Setiap anggota tim diberikan kebebasan penuh untuk melakukan overwork (lembur) tanpa batasan kuota. Seluruh waktu kerja ekstra yang Anda luangkan akan terekam otomatis di statistik profil serta menambah skor peringkat Anda di Leaderboard Kompetisi Tim.',
  },
  {
    id: 'faq-9',
    category: 'Absensi & Stopwatch',
    q: 'Apa saja 4 pilihan Mode Timer yang tersedia di halaman Absensi?',
    a: 'Sistem menyediakan 4 mode timer fleksibel: (1) Stopwatch Bebas (hitung maju standar), (2) Pomodoro Mode (siklus 25 menit fokus kerja dan 5 menit istirahat dengan bunyi bel otomatis), (3) Countdown Kustom (atur hitung mundur sesuai menit target Anda sendiri), dan (4) Hitung Mundur Sisa Target (menghitung mundur sisa jam yang dibutuhkan untuk menuntaskan kuota minimal 3 jam hari ini).',
  },
  {
    id: 'faq-10',
    category: 'Autentikasi & Akun',
    q: 'Apa yang terjadi jika akun dinonaktifkan sementara dan bagaimana pemulihannya?',
    a: 'Jika sebuah akun dinonaktifkan sementara (Suspended with Expiry Date) oleh manajemen karena masa evaluasi atau cuti berkala, sistem secara otomatis mencatat tanggal tenggat waktu berakhirnya dalam format UTC. Tepat saat masa tenggat habis, sistem akan secara otomatis memulihkan (auto-reactivate) akses akun tersebut. User dapat langsung login kembali seperti biasa tanpa harus mendaftar ulang atau menghubungi admin.',
  },
];

export default function GuidePage() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin';

  // Navigasi Sub-Halaman Utama
  const [activeSubPage, setActiveSubPage] = useState('rules');
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL'); // 'ALL' | 'Hunter' | 'Delivery' | 'Admin'
  const [copiedId, setCopiedId] = useState('');

  // Sembunyikan dan amankan SOP & Audit Admin dari user biasa
  useEffect(() => {
    if (!isAdmin && activeSubPage === 'admin_sop') {
      setActiveSubPage('rules');
    }
  }, [isAdmin, activeSubPage]);

  // State Simulasi Checklist Alur Kerja Harian (Interaktif 4 Sesi)
  const [completedSteps, setCompletedSteps] = useState({
    'step-1': true,
    'step-2': false,
    'step-3': false,
    'step-4': false,
  });

  // State Kalkulator Simulasi Komisi & Bagi Hasil Studio (Interaktif)
  const [simProjectValue, setSimProjectValue] = useState(4000000);
  const [simDpPercent, setSimDpPercent] = useState(50);
  const [simHunterRate, setSimHunterRate] = useState(15);

  // State Kalkulator Simulasi Passive Income Managed Hosting (Interaktif)
  const [simHostingClients, setSimHostingClients] = useState(25);
  const [simHostingPrice, setSimHostingPrice] = useState(1500000);
  const [simHostingCost, setSimHostingCost] = useState(450000);

  function handleCopyText(text, id) {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(''), 2500);
  }

  function toggleWorkflowStep(stepId) {
    setCompletedSteps((prev) => ({
      ...prev,
      [stepId]: !prev[stepId],
    }));
  }

  // Perhitungan Kalkulator Komisi
  const commSimResult = useMemo(() => {
    const val = Math.max(0, Number(simProjectValue) || 0);
    const dpPct = Math.min(100, Math.max(0, Number(simDpPercent) || 0));
    const ratePct = Math.min(50, Math.max(0, Number(simHunterRate) || 0));

    const dpAmount = Math.round(val * (dpPct / 100));
    const remainingAmount = Math.max(0, val - dpAmount);

    const hunterOnDp = Math.round(dpAmount * (ratePct / 100));
    const hunterOnRemaining = Math.round(remainingAmount * (ratePct / 100));
    const hunterTotal = hunterOnDp + hunterOnRemaining;

    const treasuryOnDp = Math.round(dpAmount * 0.25);
    const treasuryTotal = Math.round(val * 0.25);

    const prodSharePct = Math.max(0, 100 - ratePct - 25);
    const prodOnDp = Math.max(0, dpAmount - hunterOnDp - treasuryOnDp);
    const prodTotal = Math.max(0, val - hunterTotal - treasuryTotal);

    return {
      val,
      dpAmount,
      remainingAmount,
      hunterOnDp,
      hunterOnRemaining,
      hunterTotal,
      treasuryOnDp,
      treasuryTotal,
      prodSharePct,
      prodOnDp,
      prodTotal,
    };
  }, [simProjectValue, simDpPercent, simHunterRate]);

  // Perhitungan Kalkulator Hosting
  const hostingSimResult = useMemo(() => {
    const clients = Math.max(0, Number(simHostingClients) || 0);
    const price = Math.max(0, Number(simHostingPrice) || 0);
    const cost = Math.max(0, Number(simHostingCost) || 0);
    const netPerClient = Math.max(0, price - cost);
    const marginPct = price > 0 ? Math.round((netPerClient / price) * 100) : 0;
    const totalGrossYearly = clients * price;
    const totalCostYearly = clients * cost;
    const totalNetYearly = clients * netPerClient;
    const monthlyEquivalent = Math.round(totalNetYearly / 12);

    return {
      clients,
      price,
      cost,
      netPerClient,
      marginPct,
      totalGrossYearly,
      totalCostYearly,
      totalNetYearly,
      monthlyEquivalent,
    };
  }, [simHostingClients, simHostingPrice, simHostingCost]);

  // Saring Modul: Modul khusus Admin hanya tersedia jika role === 'admin'
  const availableModules = useMemo(() => {
    if (isAdmin) return FEATURE_MODULES;
    return FEATURE_MODULES.filter((m) => m.role !== 'Khusus Admin');
  }, [isAdmin]);

  // Filter Modul berdasarkan Role dan ketersediaan hak akses
  const filteredModules = useMemo(() => {
    if (roleFilter === 'ALL') return availableModules;
    if (roleFilter === 'Hunter') {
      return availableModules.filter((m) =>
        ['Semua Tim', 'Sales Hunter', 'Hunter & Finance', 'Hunter & Admin'].includes(m.role)
      );
    }
    if (roleFilter === 'Delivery') {
      return availableModules.filter((m) =>
        ['Semua Tim', 'Tim Delivery / PIC', 'Hunter & Finance'].includes(m.role)
      );
    }
    if (roleFilter === 'Admin' && isAdmin) {
      return availableModules.filter((m) =>
        ['Semua Tim', 'Khusus Admin', 'Hunter & Admin'].includes(m.role)
      );
    }
    return availableModules;
  }, [roleFilter, availableModules, isAdmin]);

  // Pencarian Global Lintas Sub-Halaman
  const globalSearchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return null;

    const matchedRules = STUDIO_RULES.filter(
      (r) =>
        r.title.toLowerCase().includes(q) ||
        r.summary.toLowerCase().includes(q) ||
        r.points.some((p) => p.subtitle.toLowerCase().includes(q) || p.text.toLowerCase().includes(q))
    );

    const matchedModules = availableModules.filter(
      (m) =>
        m.title.toLowerCase().includes(q) ||
        m.purpose.toLowerCase().includes(q) ||
        m.steps.some((s) => s.toLowerCase().includes(q))
    );

    const matchedScripts = PLAYBOOK_SCRIPTS.filter(
      (s) =>
        s.title.toLowerCase().includes(q) ||
        s.whenToUse.toLowerCase().includes(q) ||
        s.text.toLowerCase().includes(q)
    );

    const matchedFaqs = FAQ_ITEMS.filter(
      (f) => f.q.toLowerCase().includes(q) || f.a.toLowerCase().includes(q)
    );

    const totalMatches =
      matchedRules.length + matchedModules.length + matchedScripts.length + matchedFaqs.length;

    return {
      totalMatches,
      matchedRules,
      matchedModules,
      matchedScripts,
      matchedFaqs,
    };
  }, [searchQuery, availableModules]);

  const completedStepsCount = Object.values(completedSteps).filter(Boolean).length;
  const workflowProgressPct = Math.round((completedStepsCount / DAILY_WORKFLOW_STEPS.length) * 100);

  const SUB_TABS = [
    {
      id: 'rules',
      step: '1',
      label: 'Aturan & Kode Etik',
      count: STUDIO_RULES.length,
      icon: Scale,
    },
    {
      id: 'workflow',
      step: '2',
      label: 'SOP Alur Kerja 3 Jam',
      count: DAILY_WORKFLOW_STEPS.length,
      icon: Zap,
    },
    {
      id: 'features',
      step: '3',
      label: isAdmin ? 'Panduan 8 Modul CRM' : 'Panduan 7 Modul CRM',
      count: availableModules.length,
      icon: Compass,
    },
    {
      id: 'finance',
      step: '4',
      label: 'Kalkulator Komisi & Hosting',
      count: 2,
      icon: Calculator,
    },
    {
      id: 'playbook',
      step: '5',
      label: 'Playbook & Script WA',
      count: PLAYBOOK_SCRIPTS.length,
      icon: MessageSquare,
    },
    ...(isAdmin
      ? [
          {
            id: 'admin_sop',
            step: '6',
            label: 'SOP & Audit Admin',
            count: 4,
            icon: ShieldCheck,
          },
        ]
      : []),
    {
      id: 'faq',
      step: isAdmin ? '7' : '6',
      label: 'FAQ & Solusi Teknis',
      count: FAQ_ITEMS.length,
      icon: Lightbulb,
    },
  ];

  return (
    <div>
      {/* ===================================================================== */}
      {/* 1. PAGE HEADER (KONSISTEN DENGAN GAYA NOTION WORKSPACE)               */}
      {/* ===================================================================== */}
      <div className="d-flex flex-wrap align-items-start justify-content-between gap-3 mb-4">
        <div>
          <div className="d-flex flex-wrap align-items-center gap-2 mb-1">
            <span
              className="p-2 rounded-2 d-inline-flex align-items-center justify-content-center"
              style={{ backgroundColor: '#eff6ff', color: '#1d4ed8' }}
            >
              <BookOpen size={20} />
            </span>
            <h1 className="notion-page-title mb-0">
              Buku Panduan, Aturan Studio &amp; SOP Sistem
            </h1>
            <span className="notion-pill pill-whatsapp">
              ● Manual Book v2.5
            </span>
          </div>
          <p className="notion-page-subtitle mb-0">
            Dokumentasi resmi penggunaan seluruh fitur A-Tier CRM, aturan disiplin kerja, simulasi bagi hasil komisi, dan skrip negosiasi WhatsApp.
          </p>
        </div>

        {/* Search Input Bar */}
        <div className="d-flex align-items-center gap-2" style={{ minWidth: '280px' }}>
          <div className="position-relative flex-grow-1">
            <Search
              size={14}
              className="position-absolute text-muted"
              style={{ top: '50%', left: '11px', transform: 'translateY(-50%)' }}
            />
            <input
              type="text"
              className="notion-input w-100 ps-4 pe-4"
              placeholder="Cari aturan, modul, script WA, komisi..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                type="button"
                className="btn btn-sm p-0 border-0 bg-transparent text-muted position-absolute"
                style={{ top: '50%', right: '10px', transform: 'translateY(-50%)' }}
                onClick={() => setSearchQuery('')}
                title="Bersihkan pencarian"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* 2. RINGKASAN EKSEKUTIF KPI / ATURAN INTI STUDIO (4 KARTU)             */}
      {/* ===================================================================== */}
      <div className="row g-3 mb-4">
        <div className="col-6 col-lg-3">
          <div
            className="notion-card h-100"
            style={{ backgroundColor: '#f8fafc', borderColor: '#cbd5e1' }}
          >
            <div className="notion-stat-label">
              <Clock size={14} className="text-primary" />
              <span>Target Harian Hunter</span>
            </div>
            <div className="notion-stat-value">
              Min 3 Jam{' '}
              <span className="text-muted fw-normal" style={{ fontSize: '13.5px' }}>
                + Overwork Bebas
              </span>
            </div>
            <div className="text-muted mt-1" style={{ fontSize: '11.5px' }}>
              4 mode timer &amp; tercatat otomatis di Leaderboard
            </div>
          </div>
        </div>

        <div className="col-6 col-lg-3">
          <div
            className="notion-card h-100"
            style={{ backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' }}
          >
            <div className="notion-stat-label" style={{ color: '#166534' }}>
              <DollarSign size={14} />
              <span>Komisi Sales Hunter</span>
            </div>
            <div className="notion-stat-value" style={{ color: '#166534' }}>
              15%{' '}
              <span className="fw-normal" style={{ fontSize: '13.5px', color: '#15803d' }}>
                Real Cash-In
              </span>
            </div>
            <div className="mt-1" style={{ fontSize: '11.5px', color: '#15803d' }}>
              Cair saat DP masuk &amp; saat pelunasan
            </div>
          </div>
        </div>

        <div className="col-6 col-lg-3">
          <div
            className="notion-card h-100"
            style={{ backgroundColor: '#eff6ff', borderColor: '#bfdbfe' }}
          >
            <div className="notion-stat-label" style={{ color: '#1e40af' }}>
              <ShieldCheck size={14} />
              <span>Proteksi Hak Prospek</span>
            </div>
            <div className="notion-stat-value" style={{ color: '#1e3a8a' }}>
              14 Hari{' '}
              <span className="fw-normal" style={{ fontSize: '13.5px', color: '#1d4ed8' }}>
                Anti-Serobot
              </span>
            </div>
            <div className="mt-1" style={{ fontSize: '11.5px', color: '#1e40af' }}>
              Milik penginput pertama nomor WA aktif
            </div>
          </div>
        </div>

        <div className="col-6 col-lg-3">
          <div
            className="notion-card h-100"
            style={{ backgroundColor: '#fffbeb', borderColor: '#fde68a' }}
          >
            <div className="notion-stat-label" style={{ color: '#92400e' }}>
              <Layers size={14} />
              <span>Standar Produksi &amp; SLA</span>
            </div>
            <div className="notion-stat-value" style={{ color: '#92400e' }}>
              DP 50%{' '}
              <span className="fw-normal" style={{ fontSize: '13.5px', color: '#b45309' }}>
                &amp; Maks 3x Revisi
              </span>
            </div>
            <div className="mt-1" style={{ fontSize: '11.5px', color: '#b45309' }}>
              6 tahapan checklist delivery terukur
            </div>
          </div>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* 3. NAVIGASI 7 SUB-HALAMAN (FULL-WIDTH SEGMENTED BAR RAPI)             */}
      {/* ===================================================================== */}
      <div
        className="d-flex flex-wrap gap-2 p-2 rounded-3 mb-4 bg-light border"
        style={{ borderColor: 'var(--notion-border)' }}
      >
        {SUB_TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = !globalSearchResults && activeSubPage === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setSearchQuery('');
                setActiveSubPage(tab.id);
              }}
              className="btn btn-sm d-inline-flex align-items-center gap-2 px-3 py-2 rounded-2 border-0"
              style={{
                backgroundColor: isActive ? '#2f2f2f' : '#ffffff',
                color: isActive ? '#ffffff' : 'var(--notion-text)',
                fontWeight: isActive ? 600 : 500,
                fontSize: '12.5px',
                boxShadow: isActive
                  ? '0 2px 6px rgba(0,0,0,0.12)'
                  : '0 1px 2px rgba(0,0,0,0.03)',
                transition: 'all 0.15s ease',
              }}
            >
              <Icon size={14} className={isActive ? 'text-white' : 'text-primary'} />
              <span>
                {tab.step}. {tab.label}
              </span>
              <span
                className="badge rounded-pill"
                style={{
                  backgroundColor: isActive ? 'rgba(255,255,255,0.2)' : '#f1f1ef',
                  color: isActive ? '#ffffff' : 'var(--notion-text-muted)',
                  fontSize: '10.5px',
                }}
              >
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* ===================================================================== */}
      {/* MODE PENCARIAN GLOBAL (AKTIF KETIKA USER MENGETIK KATA KUNCI)         */}
      {/* ===================================================================== */}
      {globalSearchResults ? (
        <div className="notion-card mb-4">
          <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 pb-3 mb-3 border-bottom">
            <div className="d-flex align-items-center gap-2">
              <Search size={18} className="text-primary" />
              <h2 className="h6 fw-bold mb-0">
                Hasil Pencarian untuk &ldquo;{searchQuery}&rdquo; ({globalSearchResults.totalMatches} Ditemukan)
              </h2>
            </div>
            <button
              type="button"
              className="btn-notion-outline py-1 px-2"
              style={{ fontSize: '12px' }}
              onClick={() => setSearchQuery('')}
            >
              Tutup Pencarian
            </button>
          </div>

          {globalSearchResults.totalMatches === 0 ? (
            <div className="text-center py-5 text-muted">
              <div className="fw-semibold mb-1">Tidak ditemukan topik yang cocok</div>
              <div style={{ fontSize: '12.5px' }}>
                Coba gunakan kata kunci lain seperti: <code>komisi</code>, <code>dp</code>, <code>revisi</code>, <code>hosting</code>, <code>wa</code>, atau <code>prospek</code>.
              </div>
            </div>
          ) : (
            <div className="d-flex flex-column gap-4">
              {globalSearchResults.matchedRules.length > 0 && (
                <div>
                  <div className="fw-bold text-danger mb-2" style={{ fontSize: '13px' }}>
                    📜 Ditemukan di Buku Aturan Studio ({globalSearchResults.matchedRules.length})
                  </div>
                  <div className="d-flex flex-column gap-2">
                    {globalSearchResults.matchedRules.map((rule) => (
                      <div key={rule.id} className="p-3 rounded-2 border bg-light d-flex flex-wrap align-items-center justify-content-between gap-2">
                        <div>
                          <span className="badge bg-danger me-2">{rule.code}</span>
                          <span className="fw-bold" style={{ fontSize: '13.5px' }}>{rule.title}</span>
                          <div className="text-muted mt-1" style={{ fontSize: '12px' }}>{rule.summary}</div>
                        </div>
                        <button
                          type="button"
                          className="btn-notion-outline py-1 px-2"
                          style={{ fontSize: '12px' }}
                          onClick={() => {
                            setSearchQuery('');
                            setActiveSubPage('rules');
                          }}
                        >
                          Buka Aturan &rarr;
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {globalSearchResults.matchedModules.length > 0 && (
                <div>
                  <div className="fw-bold text-primary mb-2" style={{ fontSize: '13px' }}>
                    🎯 Ditemukan di Panduan Modul Fitur ({globalSearchResults.matchedModules.length})
                  </div>
                  <div className="d-flex flex-column gap-2">
                    {globalSearchResults.matchedModules.map((mod) => (
                      <div key={mod.id} className="p-3 rounded-2 border bg-light d-flex flex-wrap align-items-center justify-content-between gap-2">
                        <div>
                          <span className="badge bg-primary me-2">MODUL {mod.number}</span>
                          <span className="fw-bold" style={{ fontSize: '13.5px' }}>{mod.title}</span>
                          <div className="text-muted mt-1" style={{ fontSize: '12px' }}>{mod.purpose}</div>
                        </div>
                        <button
                          type="button"
                          className="btn-notion-outline py-1 px-2"
                          style={{ fontSize: '12px' }}
                          onClick={() => {
                            setSearchQuery('');
                            setActiveSubPage('features');
                          }}
                        >
                          Lihat Cara Pakai &rarr;
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {globalSearchResults.matchedScripts.length > 0 && (
                <div>
                  <div className="fw-bold text-success mb-2" style={{ fontSize: '13px' }}>
                    💬 Ditemukan di Sales Playbook &amp; Script WA ({globalSearchResults.matchedScripts.length})
                  </div>
                  <div className="d-flex flex-column gap-2">
                    {globalSearchResults.matchedScripts.map((sc) => (
                      <div key={sc.id} className="p-3 rounded-2 border bg-light d-flex flex-wrap align-items-center justify-content-between gap-2">
                        <div>
                          <span className="fw-bold" style={{ fontSize: '13.5px' }}>{sc.title}</span>
                          <div className="text-muted mt-1" style={{ fontSize: '12px' }}>{sc.whenToUse}</div>
                        </div>
                        <button
                          type="button"
                          className="btn-notion-outline py-1 px-2"
                          style={{ fontSize: '12px' }}
                          onClick={() => {
                            setSearchQuery('');
                            setActiveSubPage('playbook');
                          }}
                        >
                          Buka Script &rarr;
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {globalSearchResults.matchedFaqs.length > 0 && (
                <div>
                  <div className="fw-bold text-secondary mb-2" style={{ fontSize: '13px' }}>
                    💡 Ditemukan di Tanya Jawab / FAQ ({globalSearchResults.matchedFaqs.length})
                  </div>
                  <div className="d-flex flex-column gap-2">
                    {globalSearchResults.matchedFaqs.map((fq) => (
                      <div key={fq.id} className="p-3 rounded-2 border bg-light">
                        <div className="fw-bold mb-1" style={{ fontSize: '13px' }}>Q: {fq.q}</div>
                        <div className="text-secondary" style={{ fontSize: '12.5px' }}>A: {fq.a}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      ) : null}

      {/* ===================================================================== */}
      {/* SUB-HALAMAN 1: BUKU ATURAN & KODE ETIK STUDIO (RULES & POLICIES)      */}
      {/* ===================================================================== */}
      {!globalSearchResults && activeSubPage === 'rules' && (
        <div className="d-flex flex-column gap-3">
          <div
            className="notion-card"
            style={{
              backgroundColor: '#fef2f2',
              borderColor: '#fecaca',
              borderLeft: '4px solid #dc2626',
            }}
          >
            <div className="d-flex flex-wrap align-items-center justify-content-between gap-2">
              <div className="d-flex align-items-center gap-2">
                <Scale size={20} className="text-danger flex-shrink-0" />
                <div>
                  <h2 className="h6 fw-bold mb-0" style={{ color: '#991b1b' }}>
                    Buku Peraturan Resmi &amp; Kode Etik Operasional A-Tier Studio
                  </h2>
                  <div style={{ fontSize: '12.5px', color: '#b91c1c' }}>
                    Seluruh pasal di bawah berlaku mengikat bagi Sales Hunter, Tim Produksi/Delivery, dan Administrator.
                  </div>
                </div>
              </div>
              <span className="notion-pill status-batal">
                6 Pasal Utama
              </span>
            </div>
          </div>

          {STUDIO_RULES.map((rule) => (
            <div
              key={rule.id}
              className="notion-card"
              style={{ borderLeft: `4px solid ${rule.borderColor}` }}
            >
              {/* Card Header */}
              <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 pb-2 mb-3 border-bottom">
                <div className="d-flex align-items-center gap-2">
                  <span
                    className="notion-pill fw-bold"
                    style={{
                      backgroundColor: rule.badgeBg,
                      color: rule.badgeColor,
                    }}
                  >
                    {rule.code}
                  </span>
                  <h3 className="h6 fw-bold mb-0" style={{ fontSize: '15px' }}>
                    {rule.title}
                  </h3>
                </div>
                <span
                  className="notion-pill"
                  style={{
                    backgroundColor: '#f1f1ef',
                    color: 'var(--notion-text-muted)',
                  }}
                >
                  {rule.severityLabel}
                </span>
              </div>

              <p className="text-muted mb-3" style={{ fontSize: '13px' }}>
                {rule.summary}
              </p>

              {/* Rule Sub-Points Grid */}
              <div className="row g-3 mb-3">
                {rule.points.map((pt, idx) => (
                  <div className="col-12 col-md-4" key={idx}>
                    <div
                      className="p-3 rounded-2 border h-100"
                      style={{ backgroundColor: '#fbfbfa', borderColor: 'var(--notion-border)' }}
                    >
                      <div className="fw-bold mb-1" style={{ fontSize: '13px', color: 'var(--notion-text)' }}>
                        {pt.subtitle}
                      </div>
                      <div className="text-secondary" style={{ fontSize: '12.5px', lineHeight: 1.6 }}>
                        {pt.text}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Sanction / Warning Footer */}
              <div
                className="p-2 px-3 rounded-2 d-flex align-items-center gap-2"
                style={{
                  backgroundColor: rule.badgeBg,
                  color: rule.badgeColor,
                  fontSize: '12px',
                  fontWeight: 500,
                }}
              >
                <AlertTriangle size={15} className="flex-shrink-0" />
                <span>{rule.sanction}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ===================================================================== */}
      {/* SUB-HALAMAN 2: SOP ALUR KERJA HARIAN 3 JAM (INTERACTIVE CHECKLIST)    */}
      {/* ===================================================================== */}
      {!globalSearchResults && activeSubPage === 'workflow' && (
        <div className="d-flex flex-column gap-3">
          {/* Interactive Progress Banner */}
          <div className="notion-card">
            <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-3">
              <div>
                <h2 className="h6 fw-bold mb-1 d-flex align-items-center gap-2">
                  <Zap size={18} className="text-primary" />
                  <span>SOP Alur Kerja Efisien 3 Jam (Rutinitas Target Harian &amp; Sesi Overwork)</span>
                </h2>
                <div className="text-muted" style={{ fontSize: '12.5px' }}>
                  Centang simulasi langkah di bawah untuk mengikuti alur kerja produktif mencapai target minimal 3 jam dan sesi overwork lembur.
                </div>
              </div>

              <div className="d-flex align-items-center gap-2">
                <span className="notion-pill pill-whatsapp">
                  {completedStepsCount} / {DAILY_WORKFLOW_STEPS.length} Sesi Selesai ({workflowProgressPct}%)
                </span>
                <button
                  type="button"
                  className="btn-notion-outline py-1 px-2"
                  style={{ fontSize: '12px' }}
                  onClick={() =>
                    setCompletedSteps({
                      'step-1': false,
                      'step-2': false,
                      'step-3': false,
                      'step-4': false,
                    })
                  }
                >
                  Reset Simulasi
                </button>
              </div>
            </div>

            {/* Progress Bar */}
            <div
              className="w-100 rounded-pill overflow-hidden"
              style={{ height: '8px', backgroundColor: '#e2e8f0' }}
            >
              <div
                style={{
                  width: `${workflowProgressPct}%`,
                  height: '100%',
                  backgroundColor: '#16a34a',
                  transition: 'width 0.25s ease',
                }}
              />
            </div>
          </div>

          {/* Pipeline Conversion Visual Bar */}
          <div className="notion-card">
            <div className="fw-bold mb-3 d-flex align-items-center gap-2" style={{ fontSize: '13.5px' }}>
              <Layers size={16} className="text-primary" />
              <span>Urutan Perubahan Status Prospek di Pipeline CRM</span>
            </div>
            <div className="row g-2 align-items-stretch">
              {[
                { step: '1. Baru', desc: 'Baru selesai diriset dari GMaps / IG', cls: 'status-baru' },
                { step: '2. Dihubungi', desc: 'Pesan pembuka WA sudah dikirim', cls: 'status-dihubungi' },
                { step: '3. Follow Up', desc: 'Menunggu respon / jadwal sapa ulang', cls: 'status-followup' },
                { step: '4. Negosiasi', desc: 'Diskusi fitur, mockup, & harga paket', cls: 'status-negosiasi' },
                { step: '5. Deal (Closing)', desc: 'DP minimal 50% masuk & komisi cair!', cls: 'status-deal' },
              ].map((st, idx) => (
                <div className="col-12 col-md" key={idx}>
                  <div className="p-3 rounded-2 border h-100 bg-light d-flex flex-column justify-content-between">
                    <div>
                      <span className={`notion-pill ${st.cls} mb-2`}>{st.step}</span>
                      <div className="text-secondary" style={{ fontSize: '12px' }}>
                        {st.desc}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 5 Step Timeline Cards */}
          {DAILY_WORKFLOW_STEPS.map((item) => {
            const isDone = Boolean(completedSteps[item.id]);
            return (
              <div
                key={item.id}
                className="notion-card"
                style={{
                  borderLeft: `4px solid ${isDone ? '#16a34a' : item.color}`,
                  backgroundColor: isDone ? '#f8fafc' : '#ffffff',
                }}
              >
                <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 pb-2 mb-3 border-bottom">
                  <div className="d-flex flex-wrap align-items-center gap-2">
                    <input
                      type="checkbox"
                      className="form-check-input mt-0"
                      style={{ width: '17px', height: '17px', cursor: 'pointer' }}
                      checked={isDone}
                      onChange={() => toggleWorkflowStep(item.id)}
                    />
                    <span
                      className="notion-pill fw-semibold"
                      style={{ backgroundColor: item.bgLight, color: item.color }}
                    >
                      {item.session}
                    </span>
                    <h3
                      className={`h6 fw-bold mb-0 ${isDone ? 'text-decoration-line-through text-muted' : ''}`}
                      style={{ fontSize: '14.5px' }}
                    >
                      {item.title}
                    </h3>
                  </div>

                  <div className="d-flex align-items-center gap-2">
                    <span className="notion-pill pill-other">
                      Tag: {item.focusTag}
                    </span>
                    <NavLink
                      to={item.route}
                      className="btn-notion-outline py-1 px-2 text-decoration-none"
                      style={{ fontSize: '12px' }}
                    >
                      <span>{item.routeLabel}</span>
                      <ArrowRight size={12} />
                    </NavLink>
                  </div>
                </div>

                <div className="d-flex flex-column gap-2">
                  {item.tasks.map((task, idx) => (
                    <div key={idx} className="d-flex align-items-start gap-2" style={{ fontSize: '13px' }}>
                      <CheckCircle2
                        size={15}
                        className="mt-1 flex-shrink-0"
                        style={{ color: isDone ? '#16a34a' : item.color }}
                      />
                      <span className="text-secondary">{task}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ===================================================================== */}
      {/* SUB-HALAMAN 3: PANDUAN LENGKAP 8 MODUL FITUR                          */}
      {/* ===================================================================== */}
      {!globalSearchResults && activeSubPage === 'features' && (
        <div className="d-flex flex-column gap-3">
          {/* Role Filter Bar */}
          <div className="notion-card d-flex flex-wrap align-items-center justify-content-between gap-2">
            <div>
              <h2 className="h6 fw-bold mb-0">Panduan Penggunaan {availableModules.length} Modul Utama A-Tier CRM</h2>
              <div className="text-muted" style={{ fontSize: '12.5px' }}>
                Saring modul sesuai peran Anda untuk mempelajari langkah penggunaan setiap halaman secara detail.
              </div>
            </div>

            <div className="d-flex flex-wrap gap-2">
              {[
                { id: 'ALL', label: `Semua Modul (${availableModules.length})` },
                { id: 'Hunter', label: 'Sales Hunter' },
                { id: 'Delivery', label: 'Delivery / PIC Web' },
                ...(isAdmin ? [{ id: 'Admin', label: 'Administrator' }] : []),
              ].map((rf) => (
                <button
                  key={rf.id}
                  type="button"
                  onClick={() => setRoleFilter(rf.id)}
                  className={roleFilter === rf.id ? 'btn-notion-primary py-1 px-3' : 'btn-notion-outline py-1 px-3'}
                  style={{ fontSize: '12px' }}
                >
                  {rf.label}
                </button>
              ))}
            </div>
          </div>

          {/* Module Cards Grid */}
          <div className="row g-3">
            {filteredModules.map((mod) => {
              const Icon = mod.icon;
              return (
                <div className="col-12 col-lg-6" key={mod.id}>
                  <div className="notion-card h-100 d-flex flex-column justify-content-between">
                    <div>
                      {/* Card Header */}
                      <div className="d-flex align-items-start justify-content-between gap-2 pb-2 mb-3 border-bottom">
                        <div className="d-flex align-items-center gap-2">
                          <span
                            className="p-2 rounded-2 d-inline-flex align-items-center justify-content-center"
                            style={{ backgroundColor: '#f1f5f9', color: '#1e293b' }}
                          >
                            <Icon size={18} />
                          </span>
                          <div>
                            <div className="d-flex align-items-center gap-2">
                              <span className="text-muted fw-bold" style={{ fontSize: '11px' }}>
                                MODUL {mod.number}
                              </span>
                              <span className={`notion-pill ${mod.roleBadge}`} style={{ fontSize: '11px' }}>
                                {mod.role}
                              </span>
                            </div>
                            <h3 className="h6 fw-bold mb-0 mt-1" style={{ fontSize: '14.5px' }}>
                              {mod.title}
                            </h3>
                          </div>
                        </div>

                        <NavLink
                          to={mod.path}
                          className="btn-notion-outline py-1 px-2 text-decoration-none flex-shrink-0"
                          style={{ fontSize: '11.5px' }}
                        >
                          <span>Buka</span>
                          <ArrowRight size={12} />
                        </NavLink>
                      </div>

                      {/* Purpose */}
                      <p className="text-muted mb-3" style={{ fontSize: '12.5px' }}>
                        {mod.purpose}
                      </p>

                      {/* Numbered Steps */}
                      <div className="d-flex flex-column gap-2 mb-3">
                        {mod.steps.map((st, idx) => (
                          <div
                            key={idx}
                            className="p-2 px-3 rounded-2 border d-flex align-items-start gap-2"
                            style={{ backgroundColor: '#fbfbfa', fontSize: '12.5px' }}
                          >
                            <span
                              className="badge rounded-pill bg-dark text-white mt-1 flex-shrink-0"
                              style={{ fontSize: '10px' }}
                            >
                              {idx + 1}
                            </span>
                            <span className="text-secondary" style={{ lineHeight: 1.55 }}>
                              {st}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Pro Tip Footer */}
                    <div
                      className="p-2 px-3 rounded-2 d-flex align-items-center gap-2 mt-2"
                      style={{
                        backgroundColor: '#eff6ff',
                        border: '1px solid #bfdbfe',
                        color: '#1e40af',
                        fontSize: '12px',
                      }}
                    >
                      <Sparkles size={14} className="flex-shrink-0" />
                      <span>
                        <strong>Tips Efisien:</strong> {mod.proTip}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* SUB-HALAMAN 4: KALKULATOR INTERAKTIF KOMISI & MANAGED HOSTING         */}
      {/* ===================================================================== */}
      {!globalSearchResults && activeSubPage === 'finance' && (
        <div className="d-flex flex-column gap-4">
          {/* Interactive Commission Simulator */}
          <div className="notion-card">
            <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 pb-3 mb-3 border-bottom">
              <div className="d-flex align-items-center gap-2">
                <Calculator size={18} className="text-success" />
                <div>
                  <h2 className="h6 fw-bold mb-0">
                    Kalkulator Interaktif Simulasi Komisi Hunter &amp; Bagi Hasil Studio
                  </h2>
                  <div className="text-muted" style={{ fontSize: '12.5px' }}>
                    Ubah angka di bawah atau klik preset paket untuk melihat simulasi pencairan komisi saat DP masuk dan saat lunas.
                  </div>
                </div>
              </div>

              <div className="d-flex flex-wrap gap-2">
                {[
                  { label: 'Landing Page (1,5 Jt)', val: 1500000 },
                  { label: 'Company Profile (3 Jt)', val: 3000000 },
                  { label: 'Web Bisnis Pro (5 Jt)', val: 5000000 },
                  { label: 'Custom E-Comm (10 Jt)', val: 10000000 },
                ].map((preset) => (
                  <button
                    key={preset.val}
                    type="button"
                    className={
                      Number(simProjectValue) === preset.val
                        ? 'btn-notion-primary py-1 px-2'
                        : 'btn-notion-outline py-1 px-2'
                    }
                    style={{ fontSize: '11.5px' }}
                    onClick={() => setSimProjectValue(preset.val)}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Simulator Inputs */}
            <div className="row g-3 mb-4">
              <div className="col-12 col-md-4">
                <label className="form-label fw-semibold mb-1" style={{ fontSize: '12.5px' }}>
                  Nilai Kontrak Proyek (IDR)
                </label>
                <input
                  type="number"
                  step="100000"
                  min="0"
                  className="notion-input w-100"
                  value={simProjectValue}
                  onChange={(e) => setSimProjectValue(e.target.value)}
                />
              </div>

              <div className="col-12 col-md-4">
                <label className="form-label fw-semibold mb-1 d-flex justify-content-between" style={{ fontSize: '12.5px' }}>
                  <span>Persentase DP Masuk Awal</span>
                  <span className="text-primary fw-bold">{simDpPercent}% ({formatRupiah(commSimResult.dpAmount)})</span>
                </label>
                <input
                  type="range"
                  className="form-range mt-2"
                  min="30"
                  max="100"
                  step="10"
                  value={simDpPercent}
                  onChange={(e) => setSimDpPercent(e.target.value)}
                />
              </div>

              <div className="col-12 col-md-4">
                <label className="form-label fw-semibold mb-1 d-flex justify-content-between" style={{ fontSize: '12.5px' }}>
                  <span>Rate Komisi Hunter (%)</span>
                  <span className="text-success fw-bold">{simHunterRate}%</span>
                </label>
                <input
                  type="range"
                  className="form-range mt-2"
                  min="10"
                  max="25"
                  step="1"
                  value={simHunterRate}
                  onChange={(e) => setSimHunterRate(e.target.value)}
                />
              </div>
            </div>

            {/* Simulator Output Table */}
            <div className="notion-table-wrapper">
              <table className="notion-table">
                <thead>
                  <tr>
                    <th>Pos Alokasi Dana</th>
                    <th>Persentase</th>
                    <th>Saat DP Masuk ({simDpPercent}% = {formatRupiah(commSimResult.dpAmount)})</th>
                    <th>Saat Pelunasan ({100 - simDpPercent}% = {formatRupiah(commSimResult.remainingAmount)})</th>
                    <th>Total Saat Lunas (100%)</th>
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ backgroundColor: '#f0fdf4' }}>
                    <td className="fw-bold text-success">1. Komisi Sales Hunter</td>
                    <td>
                      <span className="notion-pill status-deal">{simHunterRate}%</span>
                    </td>
                    <td className="fw-bold text-success">{formatRupiah(commSimResult.hunterOnDp)}</td>
                    <td className="fw-bold text-success">{formatRupiah(commSimResult.hunterOnRemaining)}</td>
                    <td className="fw-bold text-success">{formatRupiah(commSimResult.hunterTotal)}</td>
                  </tr>
                  <tr>
                    <td className="fw-semibold text-primary">2. Kas Cadangan Studio (Treasury)</td>
                    <td>
                      <span className="notion-pill pill-linkedin">25%</span>
                    </td>
                    <td>{formatRupiah(commSimResult.treasuryOnDp)}</td>
                    <td>{formatRupiah(commSimResult.treasuryTotal - commSimResult.treasuryOnDp)}</td>
                    <td className="fw-bold text-primary">{formatRupiah(commSimResult.treasuryTotal)}</td>
                  </tr>
                  <tr>
                    <td className="fw-semibold text-secondary">3. Tim Produksi, Koding &amp; Server Awal</td>
                    <td>
                      <span className="notion-pill pill-other">{commSimResult.prodSharePct}%</span>
                    </td>
                    <td>{formatRupiah(commSimResult.prodOnDp)}</td>
                    <td>{formatRupiah(commSimResult.prodTotal - commSimResult.prodOnDp)}</td>
                    <td className="fw-bold">{formatRupiah(commSimResult.prodTotal)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Interactive Managed Hosting Recurring Revenue Simulator */}
          <div className="notion-card">
            <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 pb-3 mb-3 border-bottom">
              <div className="d-flex align-items-center gap-2">
                <Server size={18} className="text-primary" />
                <div>
                  <h2 className="h6 fw-bold mb-0">
                    Simulasi Pendapatan Pasif (Recurring Revenue) Full Managed Hosting
                  </h2>
                  <div className="text-muted" style={{ fontSize: '12.5px' }}>
                    Hitung potensi keuntungan bersih tahunan studio dari klien yang mempercayakan perpanjangan hosting &amp; domain.
                  </div>
                </div>
              </div>
              <NavLink to="/managed-hosting" className="btn-notion-outline py-1 px-2 text-decoration-none" style={{ fontSize: '12px' }}>
                <span>Ke Halaman Managed Hosting</span>
                <ArrowRight size={12} />
              </NavLink>
            </div>

            <div className="row g-3 mb-4">
              <div className="col-12 col-md-4">
                <label className="form-label fw-semibold mb-1" style={{ fontSize: '12.5px' }}>
                  Jumlah Klien Full Managed Aktif
                </label>
                <input
                  type="number"
                  min="1"
                  max="500"
                  className="notion-input w-100"
                  value={simHostingClients}
                  onChange={(e) => setSimHostingClients(e.target.value)}
                />
              </div>

              <div className="col-12 col-md-4">
                <label className="form-label fw-semibold mb-1" style={{ fontSize: '12.5px' }}>
                  Biaya Tagihan Klien / Tahun (IDR)
                </label>
                <input
                  type="number"
                  step="100000"
                  className="notion-input w-100"
                  value={simHostingPrice}
                  onChange={(e) => setSimHostingPrice(e.target.value)}
                />
              </div>

              <div className="col-12 col-md-4">
                <label className="form-label fw-semibold mb-1" style={{ fontSize: '12.5px' }}>
                  Modal Server &amp; Domain Studio / Tahun
                </label>
                <input
                  type="number"
                  step="50000"
                  className="notion-input w-100"
                  value={simHostingCost}
                  onChange={(e) => setSimHostingCost(e.target.value)}
                />
              </div>
            </div>

            <div className="row g-3">
              <div className="col-12 col-md-4">
                <div className="p-3 rounded-2 border bg-light h-100">
                  <div className="text-muted" style={{ fontSize: '12px' }}>
                    Profit Bersih per 1 Klien / Tahun
                  </div>
                  <div className="fs-4 fw-bold text-dark mt-1">
                    {formatRupiah(hostingSimResult.netPerClient)}
                  </div>
                  <div className="text-success fw-semibold mt-1" style={{ fontSize: '11.5px' }}>
                    Margin Keuntungan: {hostingSimResult.marginPct}%
                  </div>
                </div>
              </div>

              <div className="col-12 col-md-4">
                <div className="p-3 rounded-2 border bg-light h-100">
                  <div className="text-muted" style={{ fontSize: '12px' }}>
                    Total Omset Perpanjangan ({hostingSimResult.clients} Klien)
                  </div>
                  <div className="fs-4 fw-bold text-primary mt-1">
                    {formatRupiah(hostingSimResult.totalGrossYearly)}
                  </div>
                  <div className="text-muted mt-1" style={{ fontSize: '11.5px' }}>
                    Total Modal Server: {formatRupiah(hostingSimResult.totalCostYearly)}
                  </div>
                </div>
              </div>

              <div className="col-12 col-md-4">
                <div
                  className="p-3 rounded-2 border h-100"
                  style={{ backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' }}
                >
                  <div className="fw-semibold" style={{ fontSize: '12px', color: '#166534' }}>
                    Total Net Profit Pasif Studio / Tahun
                  </div>
                  <div className="fs-4 fw-bold text-success mt-1">
                    {formatRupiah(hostingSimResult.totalNetYearly)}
                  </div>
                  <div style={{ fontSize: '11.5px', color: '#15803d' }} className="mt-1">
                    Setara +{formatRupiah(hostingSimResult.monthlyEquivalent)} / bulan bersih!
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* SUB-HALAMAN 5: SALES PLAYBOOK & 6 SCRIPT WHATSAPP SIAP COPY           */}
      {/* ===================================================================== */}
      {!globalSearchResults && activeSubPage === 'playbook' && (
        <div className="d-flex flex-column gap-3">
          <div className="notion-card">
            <h2 className="h6 fw-bold mb-1 d-flex align-items-center gap-2">
              <MessageSquare size={18} className="text-primary" />
              <span>Sales Playbook: {PLAYBOOK_SCRIPTS.length} Template Chat WhatsApp &amp; Penanganan Keberatan Klien</span>
            </h2>
            <div className="text-muted" style={{ fontSize: '12.5px' }}>
              Klik tombol <strong>Copy Script</strong> di pojok kanan kartu, lalu ganti teks di dalam tanda kurung siku <code>[...]</code> sesuai nama bisnis klien Anda.
            </div>
          </div>

          <div className="row g-3">
            {PLAYBOOK_SCRIPTS.map((sc) => {
              const isCopied = copiedId === sc.id;
              return (
                <div className="col-12 col-lg-6" key={sc.id}>
                  <div className="notion-card h-100 d-flex flex-column justify-content-between">
                    <div>
                      <div className="d-flex align-items-start justify-content-between gap-2 pb-2 mb-2 border-bottom">
                        <div>
                          <span className={`notion-pill ${sc.badgeClass} mb-1`}>
                            {sc.category}
                          </span>
                          <h3 className="h6 fw-bold mb-0 mt-1" style={{ fontSize: '14px' }}>
                            {sc.title}
                          </h3>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleCopyText(sc.text, sc.id)}
                          className={
                            isCopied
                              ? 'btn btn-sm btn-success py-1 px-2 d-inline-flex align-items-center gap-1 flex-shrink-0'
                              : 'btn-notion-outline py-1 px-2 flex-shrink-0'
                          }
                          style={{ fontSize: '11.5px' }}
                        >
                          {isCopied ? <Check size={13} /> : <Copy size={13} />}
                          <span>{isCopied ? 'Tersalin!' : 'Copy Script'}</span>
                        </button>
                      </div>

                      <p className="text-muted mb-2" style={{ fontSize: '12px' }}>
                        <strong>Kapan digunakan:</strong> {sc.whenToUse}
                      </p>
                    </div>

                    <div
                      className="p-3 rounded-2 border font-monospace text-secondary"
                      style={{
                        backgroundColor: '#fbfbfa',
                        fontSize: '11.5px',
                        whiteSpace: 'pre-wrap',
                        lineHeight: 1.6,
                      }}
                    >
                      {sc.text}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* SUB-HALAMAN 6: SOP & HAK AKSES KHUSUS ADMINISTRATOR (HANYA UNTUK ADMIN)*/}
      {/* ===================================================================== */}
      {!globalSearchResults && isAdmin && activeSubPage === 'admin_sop' && (
        <div className="d-flex flex-column gap-3">
          <div className="notion-card d-flex flex-wrap align-items-center justify-content-between gap-2">
            <div>
              <h2 className="h6 fw-bold mb-1 d-flex align-items-center gap-2">
                <ShieldCheck size={18} className="text-danger" />
                <span>Standar Operasional Khusus Administrator &amp; Studio Owner</span>
              </h2>
              <div className="text-muted" style={{ fontSize: '12.5px' }}>
                Panduan tata kelola akun tim, verifikasi anti-fraud harian, dan pengaturan parameter keuangan studio.
              </div>
            </div>
            {isAdmin && (
              <NavLink to="/admin" className="btn-notion-primary text-decoration-none">
                <ShieldCheck size={14} />
                <span>Buka Admin Command Center</span>
              </NavLink>
            )}
          </div>

          <div className="row g-3">
            <div className="col-12 col-md-6">
              <div className="notion-card h-100">
                <div className="d-flex align-items-center gap-2 mb-2">
                  <span className="notion-pill pill-linkedin">SOP ADMIN #1</span>
                  <h3 className="h6 fw-bold mb-0">Pendaftaran Kredensial Anggota Tim Baru</h3>
                </div>
                <p className="text-muted mb-3" style={{ fontSize: '12.5px' }}>
                  Karena halaman registrasi publik telah dihapus demi keamanan, rekrutmen tim baru dilakukan melalui tahapan berikut:
                </p>
                <ol className="text-secondary ps-3 mb-0" style={{ fontSize: '12.5px', lineHeight: 1.7 }}>
                  <li>Buka menu <strong>Admin Command Center</strong> (/admin) &rarr; Tab 1: <strong>Anggota Tim &amp; Akses</strong>.</li>
                  <li>Klik tombol <strong>Tambah Anggota Tim</strong> di pojok kanan atas.</li>
                  <li>Isi Username unik (contoh: <code>budi_hunter</code>), alamat email, password minimal 6 karakter, dan pilih Role (<code>user</code> untuk Hunter atau <code>admin</code>).</li>
                  <li>Sistem otomatis mendaftarkan user ke Supabase Auth menggunakan sesi terisolasi tanpa membuat Admin ter-logout.</li>
                  <li>Serahkan username dan password tersebut kepada anggota tim untuk login.</li>
                </ol>
              </div>
            </div>

            <div className="col-12 col-md-6">
              <div className="notion-card h-100">
                <div className="d-flex align-items-center gap-2 mb-2">
                  <span className="notion-pill status-batal">SOP ADMIN #2</span>
                  <h3 className="h6 fw-bold mb-0">Audit Keaslian Kerja Harian (Anti-Fraud)</h3>
                </div>
                <p className="text-muted mb-3" style={{ fontSize: '12.5px' }}>
                  Dilakukan setiap sore untuk memastikan prospek yang diinput tim benar-benar hasil riset nyata:
                </p>
                <ol className="text-secondary ps-3 mb-0" style={{ fontSize: '12.5px', lineHeight: 1.7 }}>
                  <li>Buka menu <strong>Audit Keaslian Kerja</strong> (/admin/audit) dan pilih tanggal hari ini.</li>
                  <li>Periksa kolom <strong>Korelasi Stopwatch</strong>: pastikan berstatus hijau (<em>Saat Jam Stopwatch Aktif</em>).</li>
                  <li>Periksa kolom <strong>Deteksi Duplikat</strong>: sistem otomatis menandai merah apabila ada nomor WhatsApp atau nama bisnis yang sama diinput ulang.</li>
                  <li>Klik tombol nomor WhatsApp pada sampel prospek untuk memverifikasi keaktifan nomor bisnis, lalu klik tombol <strong>Verifikasi Semua Hari Ini</strong>.</li>
                </ol>
              </div>
            </div>

            <div className="col-12 col-md-6">
              <div className="notion-card h-100">
                <div className="d-flex align-items-center gap-2 mb-2">
                  <span className="notion-pill status-followup">SOP ADMIN #3</span>
                  <h3 className="h6 fw-bold mb-0">Manajemen Karir &amp; Lifecycle Anggota Tim</h3>
                </div>
                <p className="text-muted mb-3" style={{ fontSize: '12.5px' }}>
                  Mengatur kenaikan tier, target khusus, atau penonaktifan akun anggota tim:
                </p>
                <ol className="text-secondary ps-3 mb-0" style={{ fontSize: '12.5px', lineHeight: 1.7 }}>
                  <li>Buka menu <strong>User Berkelanjutan</strong> (/admin/users-lifecycle).</li>
                  <li>Klik tombol <strong>Kelola Karir &amp; Target</strong> pada baris anggota tim.</li>
                  <li>Sesuaikan Status Akun (<code>Active</code>, <code>Probation</code>, atau <code>Suspended</code>) dan Tier (<code>Junior Hunter</code>, <code>Senior Hunter</code>, <code>Core Partner</code>).</li>
                  <li>Anda dapat memberikan <strong>Rate Komisi Kustom</strong> (misal 20% untuk Senior Hunter atau 0% untuk staf gaji tetap).</li>
                </ol>
              </div>
            </div>

            <div className="col-12 col-md-6">
              <div className="notion-card h-100">
                <div className="d-flex align-items-center gap-2 mb-2">
                  <span className="notion-pill status-deal">SOP ADMIN #4</span>
                  <h3 className="h6 fw-bold mb-0">Rekonsiliasi Komisi &amp; Pengaturan Rekening Studio</h3>
                </div>
                <p className="text-muted mb-3" style={{ fontSize: '12.5px' }}>
                  Mengelola pencairan komisi mingguan dan daftar rekening bank pada invoice:
                </p>
                <ol className="text-secondary ps-3 mb-0" style={{ fontSize: '12.5px', lineHeight: 1.7 }}>
                  <li>Buka Tab 6 (<strong>Komisi &amp; Bagi Hasil</strong>) di halaman Admin untuk melihat daftar komisi hunter yang berstatus <em>Siap Cair</em>.</li>
                  <li>Setelah mentransfer dana ke rekening hunter, klik tombol <strong>Tandai Sudah Dibayar (Paid)</strong>.</li>
                  <li>Untuk menambah atau mengubah nomor rekening bank studio (BCA, Mandiri, SeaBank, PayPal, GoPay) yang tercetak di Invoice, buka halaman <strong>Klien Deal &amp; Keuangan</strong> lalu klik tombol pengaturan rekening.</li>
                </ol>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* SUB-HALAMAN 7: TANYA JAWAB (FAQ) & TROUBLESHOOTING TEKNIS             */}
      {/* ===================================================================== */}
      {!globalSearchResults && activeSubPage === 'faq' && (
        <div className="d-flex flex-column gap-3">
          <div className="notion-card">
            <h2 className="h6 fw-bold mb-1 d-flex align-items-center gap-2">
              <Lightbulb size={18} className="text-warning" />
              <span>Tanya Jawab Teknis (FAQ) &amp; Tips Produktivitas</span>
            </h2>
            <div className="text-muted" style={{ fontSize: '12.5px' }}>
              Jawaban lengkap atas pertanyaan operasional yang paling sering ditanyakan oleh anggota tim.
            </div>
          </div>

          <div className="row g-3">
            {FAQ_ITEMS.map((item, idx) => (
              <div className="col-12 col-lg-6" key={item.id}>
                <div className="notion-card h-100">
                  <div className="d-flex align-items-center justify-content-between mb-2">
                    <span className="notion-pill pill-other">
                      {item.category}
                    </span>
                    <span className="text-muted fw-bold" style={{ fontSize: '11.5px' }}>
                      FAQ #{idx + 1}
                    </span>
                  </div>
                  <h3 className="h6 fw-bold mb-2" style={{ fontSize: '14px', lineHeight: 1.45 }}>
                    {item.q}
                  </h3>
                  <p className="text-secondary mb-0" style={{ fontSize: '12.5px', lineHeight: 1.65 }}>
                    {item.a}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
