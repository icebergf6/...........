import { createClient } from '@supabase/supabase-js';

export const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
export const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
    supabaseAnonKey &&
    !supabaseUrl.includes('your-project-id') &&
    !supabaseAnonKey.includes('your-anon-key-here')
);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

export const SOCIAL_PLATFORMS = [
  { value: 'Google Maps', label: 'Google Maps', badgeClass: 'pill-gmaps' },
  { value: 'Instagram', label: 'Instagram', badgeClass: 'pill-instagram' },
  { value: 'TikTok', label: 'TikTok', badgeClass: 'pill-tiktok' },
  { value: 'Facebook', label: 'Facebook', badgeClass: 'pill-facebook' },
  { value: 'LinkedIn', label: 'LinkedIn', badgeClass: 'pill-linkedin' },
  { value: 'WhatsApp', label: 'WhatsApp', badgeClass: 'pill-whatsapp' },
  { value: 'Website', label: 'Website / Direktori', badgeClass: 'pill-website' },
  { value: 'Lainnya', label: 'Lainnya', badgeClass: 'pill-other' },
];

export const PROSPECT_STATUSES = [
  { value: 'Baru', label: 'Baru', badgeClass: 'status-baru' },
  { value: 'Dihubungi', label: 'Dihubungi', badgeClass: 'status-dihubungi' },
  { value: 'Follow Up', label: 'Follow Up', badgeClass: 'status-followup' },
  { value: 'Negosiasi', label: 'Negosiasi', badgeClass: 'status-negosiasi' },
  { value: 'Deal', label: 'Deal (Klien)', badgeClass: 'status-deal' },
  { value: 'Batal', label: 'Batal / Skip', badgeClass: 'status-batal' },
];

export const PAYMENT_STATUSES = [
  { value: 'Belum DP', label: 'Belum DP', badgeClass: 'pay-belum' },
  { value: 'DP Masuk', label: 'DP Masuk', badgeClass: 'pay-dp' },
  { value: 'Lunas', label: 'Lunas', badgeClass: 'pay-lunas' },
];

export function getPlatformBadgeClass(platform) {
  const found = SOCIAL_PLATFORMS.find((p) => p.value === platform);
  return found ? found.badgeClass : 'pill-other';
}

export function getStatusBadgeClass(status) {
  const found = PROSPECT_STATUSES.find((s) => s.value === status);
  return found ? found.badgeClass : 'status-baru';
}

export function getPaymentBadgeClass(paymentStatus) {
  const found = PAYMENT_STATUSES.find((p) => p.value === paymentStatus);
  return found ? found.badgeClass : 'pay-belum';
}

export const CURRENCIES = [
  { value: 'IDR', label: 'IDR (Rp - Rupiah)', symbol: 'Rp', code: 'IDR' },
  { value: 'USD', label: 'USD ($ - US Dollar)', symbol: '$', code: 'USD' },
];

export function formatRupiah(amount) {
  const num = Number(amount) || 0;
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(num);
}

export function formatUSD(amount) {
  const num = Number(amount) || 0;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(num);
}

export function formatCurrency(amount, currency = 'IDR') {
  if (currency === 'USD') {
    return formatUSD(amount);
  }
  return formatRupiah(amount);
}

export const PAYMENT_PROVIDERS = [
  {
    value: 'PayPal',
    label: 'PayPal (Bank Luar Negeri)',
    type: 'international',
    badgeClass: 'pill-linkedin',
    placeholder: 'Email akun PayPal (contoh: billing@studio.com)',
  },
  {
    value: 'SeaBank',
    label: 'SeaBank / Sibank',
    type: 'local_bank',
    badgeClass: 'pill-website',
    placeholder: 'Nomor rekening SeaBank (contoh: 9012xxxxxxx)',
  },
  {
    value: 'BCA',
    label: 'Bank BCA',
    type: 'local_bank',
    badgeClass: 'pill-facebook',
    placeholder: 'Nomor rekening BCA',
  },
  {
    value: 'BRI',
    label: 'Bank BRI',
    type: 'local_bank',
    badgeClass: 'pill-gmaps',
    placeholder: 'Nomor rekening BRI',
  },
  {
    value: 'Mandiri',
    label: 'Bank Mandiri',
    type: 'local_bank',
    badgeClass: 'status-followup',
    placeholder: 'Nomor rekening Mandiri',
  },
  {
    value: 'BNI',
    label: 'Bank BNI',
    type: 'local_bank',
    badgeClass: 'status-dihubungi',
    placeholder: 'Nomor rekening BNI',
  },
  {
    value: 'GoPay',
    label: 'GoPay',
    type: 'ewallet',
    badgeClass: 'pill-gmaps',
    placeholder: 'Nomor HP GoPay (08xxxxxxxx)',
  },
  {
    value: 'OVO',
    label: 'OVO',
    type: 'ewallet',
    badgeClass: 'status-negosiasi',
    placeholder: 'Nomor HP OVO',
  },
  {
    value: 'Dana',
    label: 'Dana',
    type: 'ewallet',
    badgeClass: 'pill-facebook',
    placeholder: 'Nomor HP Dana',
  },
  {
    value: 'Lainnya',
    label: 'Bank / E-Wallet Lainnya',
    type: 'other',
    badgeClass: 'pill-other',
    placeholder: 'Nomor rekening / ID transfer',
  },
];

export const INITIAL_DEMO_PAYMENT_ACCOUNTS = [];

export function toLocalDateString(val) {
  if (!val) return '';
  if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(val.trim())) {
    return val.trim();
  }
  const d = new Date(val);
  if (isNaN(d.getTime())) return '';
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getTodayDateString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getOffsetDateString(daysOffset) {
  const d = new Date();
  d.setDate(d.getDate() + daysOffset);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function formatDurationHMS(totalSeconds) {
  const sec = Math.max(0, Math.floor(Number(totalSeconds) || 0));
  const hours = Math.floor(sec / 3600);
  const minutes = Math.floor((sec % 3600) / 60);
  const seconds = sec % 60;
  return [hours, minutes, seconds]
    .map((v) => String(v).padStart(2, '0'))
    .join(':');
}

export const DEFAULT_COMMISSION_RATES = {
  hunter: 0.15, // 15% untuk sales hunter penutup deal
  designerDev: 0.6, // 60% untuk tim pengerjaan web
  studioTreasury: 0.25, // 25% untuk kas operasional studio
};

export const STUDIO_SETTINGS_KEY = 'atier_crm_studio_settings_v1';

export const WORK_FOCUS_TAGS = [
  { value: 'Hunting Prospek', label: '🔍 Hunting Prospek' },
  { value: 'Follow-Up WA', label: '💬 Follow-Up & Negosiasi' },
  { value: 'Desain UI/UX', label: '🎨 Desain Layout & Visual Web' },
  { value: 'Coding & Revisi', label: '💻 Coding & Revisi Web' },
  { value: 'Riset & Admin', label: '📊 Riset & Administrasi' },
];

export const DEAL_MANAGEMENT_TYPES = [
  {
    value: 'full_managed',
    label: '🏢 Full Managed (Hosting & Domain dari Kami)',
    shortLabel: '🏢 Full Managed (Hosting + Domain Kami)',
    badgeClass: 'bg-primary-subtle text-primary border border-primary-subtle',
    description:
      'Website, domain & cloud hosting dikelola penuh di bawah manajemen studio (termasuk tagihan perpanjangan berkala).',
  },
  {
    value: 'project_only',
    label: '⚡ Project Saja / Redesign Lepas (Beli Putus)',
    shortLabel: '⚡ Project / Redesign Saja (Lepas Wewenang)',
    badgeClass: 'bg-warning-subtle text-warning-emphasis border border-warning-subtle',
    description:
      'Hanya pengerjaan web / redesign satu kali bayar. Hosting & domain milik klien sendiri dan tidak di bawah wewenang manajemen kita selanjutnya.',
  },
];

export function sanitizeSafeUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return '';
  const trimmed = rawUrl.trim();
  if (!trimmed) return '';
  const withProto = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const parsed = new URL(withProto);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return parsed.href;
    }
    return '';
  } catch {
    return '';
  }
}

export function getStudioSettings() {
  try {
    const raw = localStorage.getItem(STUDIO_SETTINGS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        studioName: parsed.studioName || 'A-TIER WEB DESIGN STUDIO',
        studioContact:
          parsed.studioContact ||
          'Email: billing@atier-studio.com | WhatsApp: +62 812-3456-7801',
        hunterRate:
          typeof parsed.hunterRate === 'number'
            ? parsed.hunterRate
            : DEFAULT_COMMISSION_RATES.hunter,
        designerDevRate:
          typeof parsed.designerDevRate === 'number'
            ? parsed.designerDevRate
            : DEFAULT_COMMISSION_RATES.designerDev,
        studioTreasuryRate:
          typeof parsed.studioTreasuryRate === 'number'
            ? parsed.studioTreasuryRate
            : DEFAULT_COMMISSION_RATES.studioTreasury,
        usdExchangeRate: Number(parsed.usdExchangeRate) || 16000,
        dailyTargetHours:
          Number(parsed.dailyTargetHours) > 0
            ? Number(parsed.dailyTargetHours)
            : 3,
        dailyTargetProspects:
          Number(parsed.dailyTargetProspects) > 0
            ? Number(parsed.dailyTargetProspects)
            : 10,
      };
    }
  } catch (e) {
    // ignore storage errors
  }
  return {
    studioName: 'A-TIER WEB DESIGN STUDIO',
    studioContact:
      'Email: billing@atier-studio.com | WhatsApp: +62 812-3456-7801',
    hunterRate: DEFAULT_COMMISSION_RATES.hunter,
    designerDevRate: DEFAULT_COMMISSION_RATES.designerDev,
    studioTreasuryRate: DEFAULT_COMMISSION_RATES.studioTreasury,
    usdExchangeRate: 16000,
    dailyTargetHours: 3,
    dailyTargetProspects: 10,
  };
}

export function saveStudioSettings(settings) {
  const current = getStudioSettings();
  const merged = { ...current, ...settings };
  localStorage.setItem(STUDIO_SETTINGS_KEY, JSON.stringify(merged));
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('atier-studio-settings-updated', { detail: merged }));
  }
  if (isSupabaseConfigured && supabase) {
    supabase
      .from('studio_settings')
      .upsert(
        {
          id: 1,
          studio_name: merged.studioName,
          studio_contact: merged.studioContact,
          hunter_rate: Number(merged.hunterRate) || DEFAULT_COMMISSION_RATES.hunter,
          designer_dev_rate:
            Number(merged.designerDevRate) || DEFAULT_COMMISSION_RATES.designerDev,
          studio_treasury_rate:
            Number(merged.studioTreasuryRate) ||
            DEFAULT_COMMISSION_RATES.studioTreasury,
          usd_exchange_rate: Number(merged.usdExchangeRate) || 16000,
          daily_target_hours: Number(merged.dailyTargetHours) || 3,
          daily_target_prospects: Number(merged.dailyTargetProspects) || 10,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'id' }
      )
      .then(({ error }) => {
        if (error) console.error('Failed to sync studio settings to Supabase:', error);
      });
  }
  return merged;
}

export async function syncStudioSettingsFromSupabase() {
  if (!isSupabaseConfigured || !supabase) return getStudioSettings();
  try {
    const { data, error } = await supabase
      .from('studio_settings')
      .select('*')
      .eq('id', 1)
      .single();
    if (!error && data) {
      const synced = {
        studioName: data.studio_name || 'A-TIER WEB DESIGN STUDIO',
        studioContact:
          data.studio_contact ||
          'Email: billing@atier-studio.com | WhatsApp: +62 812-3456-7801',
        hunterRate:
          data.hunter_rate !== null && data.hunter_rate !== undefined
            ? Number(data.hunter_rate)
            : DEFAULT_COMMISSION_RATES.hunter,
        designerDevRate:
          data.designer_dev_rate !== null && data.designer_dev_rate !== undefined
            ? Number(data.designer_dev_rate)
            : DEFAULT_COMMISSION_RATES.designerDev,
        studioTreasuryRate:
          data.studio_treasury_rate !== null &&
          data.studio_treasury_rate !== undefined
            ? Number(data.studio_treasury_rate)
            : DEFAULT_COMMISSION_RATES.studioTreasury,
        usdExchangeRate: Number(data.usd_exchange_rate) || 16000,
        dailyTargetHours: Number(data.daily_target_hours) || 3,
        dailyTargetProspects: Number(data.daily_target_prospects) || 10,
      };
      localStorage.setItem(STUDIO_SETTINGS_KEY, JSON.stringify(synced));
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('atier-studio-settings-updated', { detail: synced })
        );
      }
      return synced;
    }
  } catch (err) {
    console.error('Failed to fetch studio settings from Supabase:', err);
  }
  return getStudioSettings();
}

export const DELIVERY_CHECKLIST_ITEMS = [
  { id: 'content', label: '1. Pengumpulan Konten & Aset Klien' },
  { id: 'wireframe', label: '2. Wireframe & Moodboard Struktur' },
  { id: 'ui_design', label: '3. Desain Visual & Antarmuka Web' },
  { id: 'code', label: '4. Frontend Coding & Responsif' },
  { id: 'qc', label: '5. Quality Check & Revisi Klien' },
  { id: 'live', label: '6. Peluncuran Web (Go Live) & Pelunasan' },
];

export function getFollowUpStatus(dateStr, prospectStatus) {
  if (!dateStr) return null;
  if (prospectStatus === 'Deal' || prospectStatus === 'Batal') return null;
  const dStr = toLocalDateString(dateStr);
  if (!dStr) return null;
  const todayStr = getTodayDateString();
  if (dStr < todayStr) return 'overdue';
  if (dStr === todayStr) return 'today';
  return 'upcoming';
}

export function getFollowUpBadgeMeta(dateStr, prospectStatus) {
  const status = getFollowUpStatus(dateStr, prospectStatus);
  if (!status) return null;
  if (status === 'overdue') {
    return {
      status,
      label: 'Terlewat',
      pillClass: 'bg-danger-subtle text-danger border border-danger-subtle',
      color: '#b91c1c',
      dotColor: '#ef4444',
    };
  }
  if (status === 'today') {
    return {
      status,
      label: 'Hari Ini',
      pillClass: 'bg-warning-subtle text-warning-emphasis border border-warning-subtle',
      color: '#b45309',
      dotColor: '#f59e0b',
    };
  }
  return {
    status,
    label: 'Mendatang',
    pillClass: 'bg-success-subtle text-success border border-success-subtle',
    color: '#15803d',
    dotColor: '#22c55e',
  };
}

export function calculateCommission(client, customRate) {
  const settings = getStudioSettings();
  const rate =
    typeof customRate === 'number'
      ? customRate
      : typeof client?.commission?.hunter_rate === 'number'
      ? client.commission.hunter_rate
      : settings.hunterRate;

  const isUsd = (client?.currency || 'IDR') === 'USD';
  const val = Number(client?.project_value) || 0;
  const dp = Number(client?.dp_amount) || 0;
  const cashIn = client?.payment_status === 'Lunas' ? (val > 0 ? val : dp) : dp;

  // Komisi hunter dihitung dari cash in yang sudah diterima (DP / Lunas)
  const hunterAmount = Math.round(cashIn * rate);
  const potentialTotal = Math.round(val * rate);

  return {
    currency: isUsd ? 'USD' : 'IDR',
    hunterRate: rate,
    hunterAmount,
    potentialTotal,
    cashIn,
    projectValue: val,
    status:
      client?.commission?.status ||
      (client?.payment_status === 'Lunas'
        ? 'ready'
        : dp > 0
        ? 'ready'
        : 'pending'),
  };
}

export function exportToExcel(filename, rows, columnConfig, sheetTitle = 'Data CRM') {
  if (!rows || !rows.length) {
    alert('Tidak ada data yang dapat diekspor.');
    return;
  }

  const cleanTitle = (filename || 'export-data')
    .replace(/\.(csv|xlsx|xls)$/i, '')
    .replace(/[-_]/g, ' ')
    .toUpperCase();

  const exportDate = new Date().toLocaleString('id-ID', {
    dateStyle: 'full',
    timeStyle: 'short',
  });

  const headersHtml = columnConfig
    .map((col) => {
      const h = (col.header || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      return `<th>${h}</th>`;
    })
    .join('');

  const rowsHtml = rows
    .map((row, idx) => {
      const rowClass = idx % 2 === 0 ? 'row-even' : 'row-odd';
      const cellsHtml = columnConfig
        .map((col) => {
          let val =
            typeof col.transform === 'function'
              ? col.transform(row)
              : row[col.key];
          if (val === null || val === undefined) val = '';
          const strVal = String(val);

          // Deteksi apakah data berupa angka/nominal murni atau teks/nomor telepon/ID
          const isNumeric =
            typeof val === 'number' &&
            !Number.isNaN(val) &&
            !/(phone|wa|whatsapp|nomor|id|kode|tanggal|date)/i.test(col.key || '') &&
            !/(phone|wa|whatsapp|nomor|id|kode|tanggal|date)/i.test(col.header || '');

          const safeStr = strVal
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');

          if (isNumeric) {
            return `<td class="num-cell">${safeStr}</td>`;
          }

          // Format teks untuk nomor WA, tanggal, nama klien, dsb. agar Excel tidak merusaknya
          return `<td class="text-cell">${safeStr}</td>`;
        })
        .join('');
      return `<tr class="${rowClass}">${cellsHtml}</tr>`;
    })
    .join('\r\n');

  const excelHtml = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta http-equiv="content-type" content="application/vnd.ms-excel; charset=UTF-8">
<!--[if gte mso 9]>
<xml>
  <x:ExcelWorkbook>
    <x:ExcelWorksheets>
      <x:ExcelWorksheet>
        <x:Name>${sheetTitle.slice(0, 31)}</x:Name>
        <x:WorksheetOptions>
          <x:DisplayGridlines/>
        </x:WorksheetOptions>
      </x:ExcelWorksheet>
    </x:ExcelWorksheets>
  </x:ExcelWorkbook>
</xml>
<![endif]-->
<style>
  body { font-family: 'Segoe UI', Calibri, Arial, sans-serif; font-size: 11pt; color: #1e293b; background-color: #ffffff; }
  table { border-collapse: collapse; width: 100%; margin-top: 8px; }
  .title-header { font-size: 15pt; font-weight: bold; color: #0f172a; padding: 6px 0; }
  .sub-header { font-size: 9.5pt; color: #64748b; padding-bottom: 12px; }
  th {
    background-color: #2563eb;
    color: #ffffff;
    font-weight: 700;
    font-size: 10.5pt;
    text-align: left;
    padding: 10px 14px;
    border: 1px solid #1d4ed8;
    white-space: nowrap;
  }
  td {
    padding: 8px 12px;
    border: 1px solid #e2e8f0;
    font-size: 10pt;
    vertical-align: middle;
  }
  .row-even { background-color: #f8fafc; }
  .row-odd { background-color: #ffffff; }
  .text-cell { mso-number-format: "\\@"; }
  .num-cell { mso-number-format: "#,##0"; text-align: right; }
</style>
</head>
<body>
  <div class="title-header">A-TIER WEB DESIGN CRM — ${cleanTitle}</div>
  <div class="sub-header">Tanggal Unduh: ${exportDate} • Total Data: ${rows.length} Baris</div>
  <table>
    <thead>
      <tr>${headersHtml}</tr>
    </thead>
    <tbody>
      ${rowsHtml}
    </tbody>
  </table>
</body>
</html>`;

  const blob = new Blob([excelHtml], {
    type: 'application/vnd.ms-excel;charset=utf-8;',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  const cleanName = filename.replace(/\.(csv|xlsx|xls)$/i, '');
  link.download = `${cleanName}.xls`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// Alias exportToCSV to exportToExcel so all pages output cleanly formatted Excel
export const exportToCSV = exportToExcel;

export function formatDurationHuman(totalSeconds) {
  const sec = Math.max(0, Math.floor(Number(totalSeconds) || 0));
  const hours = Math.floor(sec / 3600);
  const minutes = Math.floor((sec % 3600) / 60);
  const seconds = sec % 60;
  if (hours > 0) {
    return `${hours}j ${minutes}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds}d`;
  }
  return `${seconds} detik`;
}

export const RENEWAL_CYCLES = [
  { value: 'Yearly', label: 'Tahunan (Per 1 Tahun)', shortLabel: '/ Tahun' },
  { value: 'Monthly', label: 'Bulanan (Per 1 Bulan)', shortLabel: '/ Bulan' },
];

/**
 * Menghitung status masa aktif perpanjangan domain/hosting/maintenance
 * @param {string|object} dueDateOrProspect YYYY-MM-DD atau objek prospek
 * @param {boolean} renewalEnabled
 * @param {string} managementType 'full_managed' | 'project_only'
 */
export function getRenewalStatus(
  dueDateOrProspect,
  renewalEnabled = true,
  managementType = 'full_managed'
) {
  let dueDateStr = dueDateOrProspect;
  let isEnabled = renewalEnabled;
  let mType = managementType;

  if (dueDateOrProspect && typeof dueDateOrProspect === 'object') {
    dueDateStr = dueDateOrProspect.renewal_due_date;
    isEnabled = dueDateOrProspect.renewal_enabled;
    mType =
      dueDateOrProspect.management_type ||
      (isEnabled === false ? 'project_only' : 'full_managed');
  }

  if (mType === 'project_only') {
    return {
      status: 'project_only',
      label: '⚡ Beli Putus (Lepas Manajemen)',
      daysText: 'Hanya Project/Redesign — Tanpa Langganan',
      diffDays: null,
      pillClass: 'bg-warning-subtle text-warning-emphasis border border-warning-subtle',
      dotColor: '#d97706',
    };
  }

  if (!isEnabled || !dueDateStr) {
    return {
      status: 'unconfigured',
      label: 'Belum Diatur',
      daysText: 'Belum ada jadwal',
      diffDays: null,
      pillClass: 'bg-light text-secondary border',
      dotColor: '#9ca3af',
    };
  }

  const todayStr = getTodayDateString();
  const todayDate = new Date(todayStr + 'T00:00:00');
  const dueDate = new Date(dueDateStr + 'T00:00:00');

  if (Number.isNaN(dueDate.getTime())) {
    return {
      status: 'unconfigured',
      label: 'Tanggal Invalid',
      daysText: '-',
      diffDays: null,
      pillClass: 'bg-light text-secondary border',
      dotColor: '#9ca3af',
    };
  }

  const diffMs = dueDate.getTime() - todayDate.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return {
      status: 'expired',
      label: 'Sudah Expired',
      daysText: `Lewat ${Math.abs(diffDays)} hari`,
      diffDays,
      pillClass: 'bg-danger-subtle text-danger border border-danger-subtle',
      dotColor: '#ef4444',
    };
  }

  if (diffDays <= 30) {
    return {
      status: 'expiring_soon',
      label: diffDays === 0 ? 'Jatuh Tempo Hari Ini' : 'Segera Habis',
      daysText: diffDays === 0 ? 'Hari Ini!' : `${diffDays} hari lagi`,
      diffDays,
      pillClass: 'bg-warning-subtle text-warning-emphasis border border-warning-subtle',
      dotColor: '#f59e0b',
    };
  }

  return {
    status: 'active',
    label: 'Aktif Aman',
    daysText: `${diffDays} hari lagi`,
    diffDays,
    pillClass: 'bg-success-subtle text-success border border-success-subtle',
    dotColor: '#22c55e',
  };
}

/**
 * Memajukan tanggal jatuh tempo perpanjangan (+1 Tahun atau +1 Bulan)
 * Menggunakan perhitungan hari batas bulan untuk mencegah luapan tanggal (misal 31 Jan -> 28 Feb)
 */
export function getNextRenewalDate(currentDueDateStr, cycle = 'Yearly') {
  const baseStr = currentDueDateStr || getTodayDateString();
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(baseStr).trim());
  let year, month, day;

  if (match) {
    year = parseInt(match[1], 10);
    month = parseInt(match[2], 10);
    day = parseInt(match[3], 10);
  } else {
    const d = new Date(baseStr + 'T00:00:00');
    const validDate = Number.isNaN(d.getTime()) ? new Date() : d;
    year = validDate.getFullYear();
    month = validDate.getMonth() + 1;
    day = validDate.getDate();
  }

  if (cycle === 'Monthly') {
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  } else {
    year += 1;
  }

  // Batasi hari ke tanggal maksimum pada bulan tujuan (misal Feb 2026 -> max 28 hari)
  const maxDays = new Date(year, month, 0).getDate();
  const cappedDay = Math.min(day, maxDays);

  const yStr = String(year);
  const mStr = String(month).padStart(2, '0');
  const dStr = String(cappedDay).padStart(2, '0');
  return `${yStr}-${mStr}-${dStr}`;
}

/**
 * Normalisasi nomor WhatsApp: konversi prefix lokal 08xx menjadi standar internasional 628xx
 */
export function normalizeWhatsAppNumber(raw) {
  if (!raw) return '';
  const digits = String(raw).replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('0')) {
    return '62' + digits.slice(1);
  }
  return digits;
}

export const INITIAL_DEMO_PROSPECTS = [];

export function getInitialDemoAttendanceLogs() {
  return [];
}

/**
 * Web Audio API Synthesizer: membunyikan nada lonceng (chime) lembut tanpa perlu file mp3 eksternal
 */
export function playSynthesizedChime(type = 'success') {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();

    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    const now = ctx.currentTime;

    if (type === 'break' || type === 'pomodoro_break') {
      // 3 nada santai naik-turun untuk istirahat (E5 -> G5 -> C6)
      const freqs = [659.25, 783.99, 1046.5];
      freqs.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.18);
        gain.gain.setValueAtTime(0, now + idx * 0.18);
        gain.gain.linearRampToValueAtTime(0.15, now + idx * 0.18 + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.18 + 0.7);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + idx * 0.18);
        osc.stop(now + idx * 0.18 + 0.75);
      });
    } else if (type === 'alert' || type === 'idle') {
      // 2 nada pengingat perhatian (A4 -> E5)
      const freqs = [440.0, 659.25];
      freqs.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + idx * 0.22);
        gain.gain.setValueAtTime(0, now + idx * 0.22);
        gain.gain.linearRampToValueAtTime(0.18, now + idx * 0.22 + 0.04);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.22 + 0.6);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + idx * 0.22);
        osc.stop(now + idx * 0.22 + 0.65);
      });
    } else {
      // Default: 2 nada lonceng sukses jernih (D5 -> A5 -> D6)
      const freqs = [587.33, 880.0, 1174.66];
      freqs.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.15);
        gain.gain.setValueAtTime(0, now + idx * 0.15);
        gain.gain.linearRampToValueAtTime(0.2, now + idx * 0.15 + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.15 + 0.85);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + idx * 0.15);
        osc.stop(now + idx * 0.15 + 0.9);
      });
    }

    setTimeout(() => {
      try {
        ctx.close();
      } catch {}
    }, 1500);
  } catch (err) {
    // Non-blocking fallback jika browser memblokir audio autoplay
    console.warn('Audio chime playback omitted:', err);
  }
}

/**
 * Minta izin notifikasi desktop browser (Web Notification API)
 */
export async function requestDesktopNotificationPermission() {
  if (!('Notification' in window)) return 'unsupported';
  if (Notification.permission === 'granted') return 'granted';
  try {
    const perm = await Notification.requestPermission();
    return perm;
  } catch {
    return Notification.permission;
  }
}

/**
 * Tampilkan notifikasi desktop browser
 */
export function showDesktopNotification(title, options = {}) {
  try {
    if (!('Notification' in window) || Notification.permission !== 'granted') {
      return null;
    }
    const notif = new Notification(title, {
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      ...options,
    });
    if (options.onClickUrl) {
      notif.onclick = () => {
        window.focus();
        window.location.href = options.onClickUrl;
      };
    }
    return notif;
  } catch (err) {
    console.warn('Desktop notification omitted:', err);
    return null;
  }
}
