import React, { useState, useMemo } from 'react';
import {
  Server,
  Globe,
  Calendar,
  DollarSign,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ArrowUpRight,
  MessageSquare,
  FileText,
  Search,
  Filter,
  Download,
  Edit,
  ShieldCheck,
  ExternalLink,
  Lock,
  RefreshCw,
  Plus,
  History,
  TrendingUp,
  Info,
} from 'lucide-react';
import { useProspects } from '../context/ProspectsContext';
import { useAuth } from '../context/AuthContext';
import { usePaymentAccounts } from '../context/PaymentAccountsContext';
import InvoiceModal from '../components/Finance/InvoiceModal';
import {
  formatCurrency,
  getRenewalStatus,
  getNextRenewalDate,
  getTodayDateString,
  getOffsetDateString,
  exportToExcel,
  sanitizeSafeUrl,
  toLocalDateString,
  normalizeWhatsAppNumber,
} from '../lib/supabase';

export default function ManagedHostingPage() {
  const { dealClients, updateProspect, loading } = useProspects();
  const { profile } = useAuth();
  const { paymentAccounts } = usePaymentAccounts();

  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL' | 'expiring_soon' | 'expired' | 'active' | 'unconfigured'
  const [cycleFilter, setCycleFilter] = useState('ALL'); // 'ALL' | 'Yearly' | 'Monthly'
  const [searchQuery, setSearchQuery] = useState('');

  // Modals state
  const [editingClient, setEditingClient] = useState(null);
  const [hostingForm, setHostingForm] = useState({
    domain: '',
    renewal_service_name: '',
    renewal_cycle: 'Yearly',
    renewal_due_date: '',
    renewal_price: 1500000,
    renewal_cost: 450000,
    credentials: '',
  });

  const [historyModalClient, setHistoryModalClient] = useState(null);
  const [invoiceClient, setInvoiceClient] = useState(null);
  const [actionFeedback, setActionFeedback] = useState('');
  const [renewingId, setRenewingId] = useState(null);

  const isAdmin = profile?.role === 'admin';
  const todayStr = getTodayDateString();

  function showFeedback(msg) {
    setActionFeedback(msg);
    setTimeout(() => setActionFeedback(''), 4000);
  }

  // Filter only clients that are Full Managed (Hosting & Domain under our management)
  const fullManagedClients = useMemo(() => {
    return (dealClients || []).filter((p) => {
      // Must be Deal and explicitly full_managed (or default full_managed)
      const isDeal = p.status === 'Deal';
      const isFullManaged = p.management_type !== 'project_only';
      return isDeal && isFullManaged;
    });
  }, [dealClients]);

  // Summary Metrics
  const metrics = useMemo(() => {
    let totalCollected = 0;
    let totalNetProfit = 0;
    let countExpiringSoon = 0;
    let countExpired = 0;
    let countActiveSafe = 0;

    fullManagedClients.forEach((c) => {
      totalCollected += Number(c.renewal_total_collected) || 0;
      totalNetProfit += Number(c.renewal_total_net_profit) || 0;

      const rInfo = getRenewalStatus(c.renewal_due_date, c.renewal_enabled ?? true, 'full_managed');
      if (rInfo.status === 'expired') countExpired++;
      else if (rInfo.status === 'expiring_soon') countExpiringSoon++;
      else if (rInfo.status === 'active') countActiveSafe++;
    });

    return {
      totalClients: fullManagedClients.length,
      totalCollected,
      totalNetProfit,
      countExpiringSoon,
      countExpired,
      countActiveSafe,
      attentionNeeded: countExpired + countExpiringSoon,
    };
  }, [fullManagedClients]);

  // Filtered Clients
  const filteredClients = useMemo(() => {
    return fullManagedClients.filter((c) => {
      const rInfo = getRenewalStatus(c.renewal_due_date, c.renewal_enabled ?? true, 'full_managed');

      let matchesStatus = true;
      if (statusFilter !== 'ALL') {
        matchesStatus = rInfo.status === statusFilter;
      }

      let matchesCycle = true;
      if (cycleFilter !== 'ALL') {
        matchesCycle = (c.renewal_cycle || 'Yearly') === cycleFilter;
      }

      let matchesSearch = true;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const clientName = (c.client_name || '').toLowerCase();
        const domain = (c.delivery_assets?.domain || '').toLowerCase();
        const pic = (c.created_by_username || '').toLowerCase();
        const service = (c.renewal_service_name || '').toLowerCase();
        matchesSearch =
          clientName.includes(q) ||
          domain.includes(q) ||
          pic.includes(q) ||
          service.includes(q);
      }

      return matchesStatus && matchesCycle && matchesSearch;
    });
  }, [fullManagedClients, statusFilter, cycleFilter, searchQuery]);

  // Open Edit Modal
  function handleOpenEditModal(client) {
    setEditingClient(client);
    setHostingForm({
      domain: client.delivery_assets?.domain || '',
      renewal_service_name:
        client.renewal_service_name ||
        'Perpanjangan Domain & Cloud Hosting Tahunan',
      renewal_cycle: client.renewal_cycle || 'Yearly',
      renewal_due_date: client.renewal_due_date || '',
      renewal_price:
        client.renewal_price !== undefined ? client.renewal_price : 1500000,
      renewal_cost:
        client.renewal_cost !== undefined ? client.renewal_cost : 450000,
      credentials: client.delivery_assets?.credentials || '',
    });
  }

  // Save Edit Form
  async function handleSaveHostingForm(e) {
    e.preventDefault();
    if (!editingClient) return;

    const priceNum = Math.max(0, Number(hostingForm.renewal_price) || 0);
    const costNum = Math.max(0, Number(hostingForm.renewal_cost) || 0);

    const prevAssets = editingClient.delivery_assets || {};
    const nextAssets = {
      ...prevAssets,
      domain: hostingForm.domain.trim(),
      credentials: hostingForm.credentials.trim(),
    };

    await updateProspect(editingClient.id, {
      management_type: 'full_managed',
      renewal_enabled: true,
      renewal_cycle: hostingForm.renewal_cycle,
      renewal_service_name:
        hostingForm.renewal_service_name.trim() ||
        'Perpanjangan Domain & Cloud Hosting Tahunan',
      renewal_price: priceNum,
      renewal_cost: costNum,
      renewal_due_date: hostingForm.renewal_due_date || null,
      delivery_assets: nextAssets,
    });

    setEditingClient(null);
    showFeedback(`Pengaturan hosting & domain ${editingClient.client_name} berhasil disimpan!`);
  }

  // 1-Click Renew (+1 Period)
  async function handleRenewOnePeriod(client) {
    if (renewingId) return;
    const curr = client.currency || 'IDR';
    const cycle = client.renewal_cycle || 'Yearly';
    const price = Number(client.renewal_price) || 0;
    const cost = Number(client.renewal_cost) || 0;
    const netProfit = Math.max(0, price - cost);
    const nextDueDate = getNextRenewalDate(
      client.renewal_due_date || getTodayDateString(),
      cycle
    );

    const isConfirmed = window.confirm(
      `Konfirmasi perpanjangan ${cycle === 'Monthly' ? '1 Bulan' : '1 Tahun'} untuk ${client.client_name}?\n` +
      `Tagihan: ${formatCurrency(price, curr)}\n` +
      `Modal Server: ${formatCurrency(cost, curr)}\n` +
      `Net Profit Studio: ${formatCurrency(netProfit, curr)}\n` +
      `Masa aktif baru akan diperpanjang s/d: ${nextDueDate}`
    );
    if (!isConfirmed) return;

    setRenewingId(client.id);
    try {
      const newLog = {
        id: 'rnw-' + Date.now(),
        date: getTodayDateString(),
        cycle,
        price,
        cost,
        net_profit: netProfit,
        note: `Perpanjangan ${cycle === 'Monthly' ? 'Bulanan' : 'Tahunan'} Berhasil. Aktif s/d ${nextDueDate}`,
      };

      const prevHistory = Array.isArray(client.renewal_history)
        ? client.renewal_history
        : [];

      await updateProspect(client.id, {
        renewal_enabled: true,
        renewal_price: price,
        renewal_cost: cost,
        renewal_due_date: nextDueDate,
        renewal_total_collected: (Number(client.renewal_total_collected) || 0) + price,
        renewal_total_net_profit: (Number(client.renewal_total_net_profit) || 0) + netProfit,
        renewal_history: [newLog, ...prevHistory],
      });

      showFeedback(
        `Perpanjangan ${client.client_name} berhasil dicatat! Masa aktif baru: ${nextDueDate}`
      );
    } finally {
      setRenewingId(null);
    }
  }

  // WhatsApp Reminder Generator
  function handleSendWAReminder(client) {
    const cleanWa = normalizeWhatsAppNumber(client.whatsapp_number);
    if (!cleanWa) {
      alert('Klien ini belum memiliki nomor WhatsApp yang tercatat.');
      return;
    }

    const domainName = client.delivery_assets?.domain || client.client_name;
    const dueDateStr = client.renewal_due_date || 'Segera';
    const curr = client.currency || 'IDR';
    const priceStr = formatCurrency(client.renewal_price, curr);
    const serviceName = client.renewal_service_name || 'Perpanjangan Domain & Cloud Hosting';

    const defaultBank = paymentAccounts[0];
    const bankInfo = defaultBank
      ? `\nPembayaran dapat ditransfer ke:\n🏦 ${defaultBank.provider_name} - ${defaultBank.account_number}\na.n ${defaultBank.account_name}\n`
      : '';

    const text =
      `Halo Kak *${client.client_name}*,\n\n` +
      `Kami dari Tim *A-Tier Web Design Studio* ingin menginformasikan bahwa layanan *${serviceName}* untuk domain *${domainName}* akan jatuh tempo pada tanggal *${dueDateStr}*.\n\n` +
      `Detail Tagihan:\n` +
      `• Layanan: ${serviceName}\n` +
      `• Domain: ${domainName}\n` +
      `• Nominal: ${priceStr}\n` +
      `${bankInfo}\n` +
      `Mohon konfirmasi jika pembayaran sudah selesai agar masa aktif server & domain website tetap aktif aman tanpa kendala. Terima kasih! 🙏✨`;

    const waUrl = `https://wa.me/${cleanWa}?text=${encodeURIComponent(text)}`;
    window.open(waUrl, '_blank', 'noopener,noreferrer');
  }

  // Export to Excel Workbook (.xls)
  function handleExportExcel() {
    exportToExcel(
      `rekap-full-managed-hosting-${todayStr}`,
      filteredClients,
      [
        { header: 'Nama Klien', key: 'client_name' },
        { header: 'PIC Hunter', transform: (r) => `@${r.created_by_username || 'tim'}` },
        { header: 'Domain Website', transform: (r) => r.delivery_assets?.domain || '-' },
        { header: 'Paket Layanan', transform: (r) => r.renewal_service_name || 'Hosting & Domain Tahunan' },
        { header: 'Siklus', transform: (r) => (r.renewal_cycle === 'Monthly' ? 'Bulanan' : 'Tahunan') },
        { header: 'Jatuh Tempo', key: 'renewal_due_date' },
        {
          header: 'Status Masa Aktif',
          transform: (r) => getRenewalStatus(r.renewal_due_date, r.renewal_enabled, 'full_managed').label,
        },
        { header: 'Sisa Waktu', transform: (r) => getRenewalStatus(r.renewal_due_date, r.renewal_enabled, 'full_managed').daysText },
        { header: 'Mata Uang', key: 'currency' },
        { header: 'Biaya Tagihan Klien', key: 'renewal_price' },
        { header: 'Modal Server Studio', key: 'renewal_cost' },
        {
          header: 'Net Profit per Periode',
          transform: (r) => Math.max(0, (Number(r.renewal_price) || 0) - (Number(r.renewal_cost) || 0)),
        },
        { header: 'Total Terkumpul (Lifetime)', key: 'renewal_total_collected' },
        { header: 'Total Net Profit (Lifetime)', key: 'renewal_total_net_profit' },
        { header: 'WhatsApp Klien', key: 'whatsapp_number' },
      ],
      'Full Managed Hosting'
    );
  }

  return (
    <div>
      {/* Page Header */}
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-4">
        <div>
          <div className="d-flex align-items-center gap-2 mb-1">
            <span
              className="p-2 rounded-2 d-inline-flex"
              style={{ backgroundColor: '#e0f2fe', color: '#0369a1' }}
            >
              <Server size={20} />
            </span>
            <h1 className="notion-page-title mb-0">
              Full Managed Hosting &amp; Domain
            </h1>
          </div>
          <p className="notion-page-subtitle mb-0">
            Pusat pemantauan server cloud, domain, siklus jatuh tempo, dan pendapatan langganan rutin dari seluruh klien Full Managed Studio.
          </p>
        </div>

        <div className="d-flex align-items-center gap-2">
          <button
            type="button"
            className="btn-notion-outline"
            onClick={handleExportExcel}
            title="Download rekap Excel rapi"
          >
            <Download size={14} />
            <span>Export Excel (.xls)</span>
          </button>
        </div>
      </div>

      {actionFeedback && (
        <div
          className="alert alert-success py-2 px-3 mb-4 d-flex align-items-center gap-2"
          style={{ fontSize: '13px' }}
        >
          <CheckCircle2 size={16} className="text-success flex-shrink-0" />
          <span>{actionFeedback}</span>
        </div>
      )}

      {/* Summary KPI Cards */}
      <div className="row g-3 mb-4">
        <div className="col-12 col-sm-6 col-xl-3">
          <div className="notion-card h-100">
            <div className="d-flex align-items-center justify-content-between mb-2">
              <span className="text-muted" style={{ fontSize: '12px' }}>
                Klien Full Managed
              </span>
              <span
                className="p-2 rounded"
                style={{ backgroundColor: '#f1f5f9', color: '#475569' }}
              >
                <Server size={15} />
              </span>
            </div>
            <div className="fs-3 fw-bold" style={{ letterSpacing: '-0.02em' }}>
              {metrics.totalClients}
            </div>
            <div className="text-muted mt-1" style={{ fontSize: '11.5px' }}>
              <span className="text-success fw-semibold">
                {metrics.countActiveSafe} Aktif Aman
              </span>{' '}
              • {metrics.attentionNeeded} Butuh Perhatian
            </div>
          </div>
        </div>

        <div className="col-12 col-sm-6 col-xl-3">
          <div className="notion-card h-100">
            <div className="d-flex align-items-center justify-content-between mb-2">
              <span className="text-muted" style={{ fontSize: '12px' }}>
                Total Kas Masuk Terkumpul
              </span>
              <span
                className="p-2 rounded"
                style={{ backgroundColor: '#dcfce7', color: '#166534' }}
              >
                <DollarSign size={15} />
              </span>
            </div>
            <div className="fs-3 fw-bold text-success" style={{ letterSpacing: '-0.02em' }}>
              {formatCurrency(metrics.totalCollected, 'IDR')}
            </div>
            <div className="text-muted mt-1" style={{ fontSize: '11.5px' }}>
              Total akumulasi tagihan perpanjangan klien
            </div>
          </div>
        </div>

        <div className="col-12 col-sm-6 col-xl-3">
          <div className="notion-card h-100">
            <div className="d-flex align-items-center justify-content-between mb-2">
              <span className="text-muted" style={{ fontSize: '12px' }}>
                Net Profit Bersih Studio
              </span>
              <span
                className="p-2 rounded"
                style={{ backgroundColor: '#fef3c7', color: '#92400e' }}
              >
                <TrendingUp size={15} />
              </span>
            </div>
            <div className="fs-3 fw-bold text-primary" style={{ letterSpacing: '-0.02em' }}>
              {formatCurrency(metrics.totalNetProfit, 'IDR')}
            </div>
            <div className="text-muted mt-1" style={{ fontSize: '11.5px' }}>
              Keuntungan bersih setelah modal server &amp; domain
            </div>
          </div>
        </div>

        <div className="col-12 col-sm-6 col-xl-3">
          <div className="notion-card h-100">
            <div className="d-flex align-items-center justify-content-between mb-2">
              <span className="text-muted" style={{ fontSize: '12px' }}>
                Jatuh Tempo &amp; Expired
              </span>
              <span
                className="p-2 rounded"
                style={{
                  backgroundColor: metrics.countExpired > 0 ? '#fee2e2' : '#fef3c7',
                  color: metrics.countExpired > 0 ? '#b91c1c' : '#b45309',
                }}
              >
                <AlertTriangle size={15} />
              </span>
            </div>
            <div className="d-flex align-items-baseline gap-2">
              <span
                className="fs-3 fw-bold"
                style={{
                  color: metrics.countExpired > 0 ? '#dc2626' : '#d97706',
                  letterSpacing: '-0.02em',
                }}
              >
                {metrics.attentionNeeded}
              </span>
              <span className="text-muted" style={{ fontSize: '12px' }}>
                Klien
              </span>
            </div>
            <div className="text-muted mt-1" style={{ fontSize: '11.5px' }}>
              <span className="text-danger fw-semibold">{metrics.countExpired} Expired</span> •{' '}
              <span className="text-warning-emphasis fw-semibold">{metrics.countExpiringSoon} Segera Habis</span>
            </div>
          </div>
        </div>
      </div>

      {/* Filter & Search Toolbar */}
      <div className="notion-card p-3 mb-4">
        <div className="row g-2 align-items-center">
          <div className="col-12 col-md-5">
            <div className="position-relative">
              <Search
                size={14}
                className="position-absolute text-muted"
                style={{ top: '10px', left: '12px' }}
              />
              <input
                type="text"
                className="notion-input w-100 ps-5"
                placeholder="Cari domain, nama klien, atau PIC hunter..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          <div className="col-6 col-md-4">
            <div className="d-flex align-items-center gap-2">
              <Filter size={14} className="text-muted flex-shrink-0" />
              <select
                className="notion-select w-100"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="ALL">Semua Status Masa Aktif</option>
                <option value="expiring_soon">⚡ Segera Habis (&lt;= 30 Hari)</option>
                <option value="expired">⚠️ Sudah Expired</option>
                <option value="active">✓ Aktif Aman</option>
                <option value="unconfigured">Belum Diatur</option>
              </select>
            </div>
          </div>

          <div className="col-6 col-md-3">
            <select
              className="notion-select w-100"
              value={cycleFilter}
              onChange={(e) => setCycleFilter(e.target.value)}
            >
              <option value="ALL">Semua Siklus Bayar</option>
              <option value="Yearly">Tahunan (Yearly)</option>
              <option value="Monthly">Bulanan (Monthly)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Client List Table */}
      <div className="notion-card p-0 overflow-hidden mb-4">
        <div className="p-3 border-bottom d-flex align-items-center justify-content-between">
          <div className="fw-bold d-flex align-items-center gap-2" style={{ fontSize: '14px' }}>
            <Server size={16} className="text-primary" />
            <span>Daftar Klien Full Managed Hosting ({filteredClients.length})</span>
          </div>
          <span className="text-muted" style={{ fontSize: '12px' }}>
            Diperbarui secara realtime dari database Supabase
          </span>
        </div>

        {filteredClients.length === 0 ? (
          <div className="p-5 text-center text-muted">
            <Server size={32} className="mb-2 text-muted opacity-50" />
            <div className="fw-medium mb-1">Tidak ada klien Full Managed yang cocok</div>
            <div style={{ fontSize: '12.5px' }}>
              {fullManagedClients.length === 0
                ? 'Belum ada klien Deal yang memilih opsi Full Managed. Tambahkan di menu Keuangan & Deal atau Prospek.'
                : 'Coba ubah kata kunci pencarian atau filter status di atas.'}
            </div>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table notion-table align-middle mb-0">
              <thead>
                <tr>
                  <th style={{ minWidth: '220px' }}>Klien &amp; Domain</th>
                  <th style={{ minWidth: '180px' }}>Paket &amp; Siklus</th>
                  <th style={{ minWidth: '170px' }}>Jatuh Tempo</th>
                  <th style={{ minWidth: '170px' }}>Biaya &amp; Profit</th>
                  <th style={{ minWidth: '140px' }}>Status Masa Aktif</th>
                  <th style={{ minWidth: '140px' }}>Riwayat</th>
                  <th style={{ minWidth: '180px', textAlign: 'right' }}>Aksi Kelola</th>
                </tr>
              </thead>
              <tbody>
                {filteredClients.map((client) => {
                  const curr = client.currency || 'IDR';
                  const domain = client.delivery_assets?.domain || '';
                  const safeLiveUrl = sanitizeSafeUrl(
                    client.delivery_assets?.live_url || (domain ? `https://${domain}` : '')
                  );
                  const cycle = client.renewal_cycle || 'Yearly';
                  const price = Number(client.renewal_price) || 0;
                  const cost = Number(client.renewal_cost) || 0;
                  const netProfit = Math.max(0, price - cost);

                  const rStatus = getRenewalStatus(
                    client.renewal_due_date,
                    client.renewal_enabled ?? true,
                    'full_managed'
                  );

                  const historyCount = Array.isArray(client.renewal_history)
                    ? client.renewal_history.length
                    : 0;

                  return (
                    <tr key={client.id}>
                      {/* Klien & Domain */}
                      <td>
                        <div className="fw-bold" style={{ fontSize: '13.5px' }}>
                          {client.client_name}
                        </div>
                        <div className="d-flex align-items-center gap-1 mt-1">
                          {domain ? (
                            <>
                              <Globe size={12} className="text-primary flex-shrink-0" />
                              <span className="font-monospace text-primary fw-medium" style={{ fontSize: '12px' }}>
                                {domain}
                              </span>
                              {safeLiveUrl && (
                                <a
                                  href={safeLiveUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-muted hover-primary"
                                  title="Buka website langsung"
                                >
                                  <ExternalLink size={12} />
                                </a>
                              )}
                            </>
                          ) : (
                            <span className="text-muted" style={{ fontSize: '11.5px' }}>
                              Domain belum diset
                            </span>
                          )}
                        </div>
                        <div className="text-muted mt-1" style={{ fontSize: '11px' }}>
                          PIC: <span className="fw-medium text-dark">@{client.created_by_username || 'tim'}</span>
                        </div>
                      </td>

                      {/* Paket & Siklus */}
                      <td>
                        <div className="fw-medium" style={{ fontSize: '12.5px' }}>
                          {client.renewal_service_name || 'Hosting & Domain Tahunan'}
                        </div>
                        <div className="d-flex align-items-center gap-1 mt-1">
                          <span
                            className="notion-pill"
                            style={{
                              backgroundColor: cycle === 'Monthly' ? '#f3e8ff' : '#e0e7ff',
                              color: cycle === 'Monthly' ? '#6b21a8' : '#3730a3',
                              fontSize: '11px',
                            }}
                          >
                            {cycle === 'Monthly' ? 'Siklus Bulanan' : 'Siklus Tahunan'}
                          </span>
                        </div>
                      </td>

                      {/* Jatuh Tempo */}
                      <td>
                        <div className="d-flex align-items-center gap-1 fw-semibold" style={{ fontSize: '13px' }}>
                          <Calendar size={13} className="text-muted flex-shrink-0" />
                          <span>{toLocalDateString(client.renewal_due_date) || 'Belum Diatur'}</span>
                        </div>
                        <div className="mt-1" style={{ fontSize: '11.5px' }}>
                          <span className="fw-medium" style={{ color: rStatus.dotColor }}>
                            {rStatus.daysText}
                          </span>
                        </div>
                      </td>

                      {/* Biaya & Profit */}
                      <td>
                        <div className="fw-bold" style={{ fontSize: '13px' }}>
                          {formatCurrency(price, curr)}
                          <span className="text-muted fw-normal" style={{ fontSize: '11px' }}>
                            {' '}{cycle === 'Monthly' ? '/bln' : '/thn'}
                          </span>
                        </div>
                        <div className="text-muted mt-1" style={{ fontSize: '11px' }}>
                          Modal: {formatCurrency(cost, curr)}
                        </div>
                        <div className="text-success fw-semibold mt-1" style={{ fontSize: '11.5px' }}>
                          Profit: +{formatCurrency(netProfit, curr)}
                        </div>
                      </td>

                      {/* Status Masa Aktif */}
                      <td>
                        <span className={`notion-pill ${rStatus.pillClass}`}>
                          ● {rStatus.label}
                        </span>
                      </td>

                      {/* Riwayat */}
                      <td>
                        <button
                          type="button"
                          className="btn btn-sm p-1 px-2 border rounded bg-white text-muted d-flex align-items-center gap-1"
                          style={{ fontSize: '11.5px' }}
                          onClick={() => setHistoryModalClient(client)}
                          title="Lihat riwayat perpanjangan klien ini"
                        >
                          <History size={13} className="text-primary" />
                          <span>{historyCount} Bayar</span>
                        </button>
                      </td>

                      {/* Aksi Kelola */}
                      <td style={{ textAlign: 'right' }}>
                        <div className="d-flex align-items-center justify-content-end gap-1">
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-success d-inline-flex align-items-center gap-1 py-1 px-2"
                            style={{ fontSize: '12px' }}
                            disabled={renewingId === client.id}
                            onClick={() => handleRenewOnePeriod(client)}
                            title={`Catat perpanjangan +1 ${cycle === 'Monthly' ? 'Bulan' : 'Tahun'}`}
                          >
                            <RefreshCw size={12} className={renewingId === client.id ? 'spin-anim' : ''} />
                            <span>
                              {renewingId === client.id
                                ? 'Memproses...'
                                : `+1 ${cycle === 'Monthly' ? 'Bln' : 'Thn'}`}
                            </span>
                          </button>

                          <button
                            type="button"
                            className="btn btn-sm btn-outline-primary d-inline-flex align-items-center gap-1 py-1 px-2"
                            style={{ fontSize: '12px' }}
                            onClick={() => handleSendWAReminder(client)}
                            title="Kirim pengingat WhatsApp tagihan perpanjangan"
                          >
                            <MessageSquare size={12} />
                            <span>WA</span>
                          </button>

                          <button
                            type="button"
                            className="btn btn-sm btn-outline-secondary d-inline-flex align-items-center gap-1 py-1 px-2"
                            style={{ fontSize: '12px' }}
                            onClick={() => setInvoiceClient(client)}
                            title="Buat invoice tagihan perpanjangan"
                          >
                            <FileText size={12} />
                            <span>Invoice</span>
                          </button>

                          <button
                            type="button"
                            className="btn btn-sm btn-outline-dark d-inline-flex align-items-center gap-1 py-1 px-2"
                            style={{ fontSize: '12px' }}
                            onClick={() => handleOpenEditModal(client)}
                            title="Edit detail hosting, domain &amp; kredensial"
                          >
                            <Edit size={12} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit Layanan Domain & Hosting Modal */}
      {editingClient && (
        <div
          className="modal fade show d-block"
          style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1050 }}
        >
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 shadow">
              <div className="modal-header border-bottom py-2 px-3">
                <div className="fw-bold d-flex align-items-center gap-2" style={{ fontSize: '14px' }}>
                  <Server size={16} className="text-primary" />
                  <span>Pengaturan Hosting &amp; Domain: {editingClient.client_name}</span>
                </div>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setEditingClient(null)}
                />
              </div>

              <form onSubmit={handleSaveHostingForm}>
                <div className="modal-body p-3">
                  <div className="mb-3">
                    <label className="form-label fw-medium mb-1" style={{ fontSize: '12.5px' }}>
                      Domain Klien
                    </label>
                    <input
                      type="text"
                      className="notion-input w-100"
                      placeholder="contoh: kopisenjaroastery.id"
                      value={hostingForm.domain}
                      onChange={(e) =>
                        setHostingForm((prev) => ({ ...prev, domain: e.target.value }))
                      }
                    />
                  </div>

                  <div className="mb-3">
                    <label className="form-label fw-medium mb-1" style={{ fontSize: '12.5px' }}>
                      Nama Paket Layanan
                    </label>
                    <input
                      type="text"
                      className="notion-input w-100"
                      placeholder="Perpanjangan Domain & Cloud Hosting Tahunan"
                      value={hostingForm.renewal_service_name}
                      onChange={(e) =>
                        setHostingForm((prev) => ({
                          ...prev,
                          renewal_service_name: e.target.value,
                        }))
                      }
                      required
                    />
                  </div>

                  <div className="row g-2 mb-3">
                    <div className="col-6">
                      <label className="form-label fw-medium mb-1" style={{ fontSize: '12.5px' }}>
                        Siklus Perpanjangan
                      </label>
                      <select
                        className="notion-select w-100"
                        value={hostingForm.renewal_cycle}
                        onChange={(e) =>
                          setHostingForm((prev) => ({
                            ...prev,
                            renewal_cycle: e.target.value,
                          }))
                        }
                      >
                        <option value="Yearly">Tahunan (Yearly)</option>
                        <option value="Monthly">Bulanan (Monthly)</option>
                      </select>
                    </div>

                    <div className="col-6">
                      <label className="form-label fw-medium mb-1" style={{ fontSize: '12.5px' }}>
                        Tanggal Jatuh Tempo
                      </label>
                      <input
                        type="date"
                        className="notion-input w-100"
                        value={hostingForm.renewal_due_date}
                        onChange={(e) =>
                          setHostingForm((prev) => ({
                            ...prev,
                            renewal_due_date: e.target.value,
                          }))
                        }
                        required
                      />
                    </div>
                  </div>

                  <div className="row g-2 mb-3">
                    <div className="col-6">
                      <label className="form-label fw-medium mb-1" style={{ fontSize: '12.5px' }}>
                        Harga Tagihan Klien ({editingClient.currency || 'IDR'})
                      </label>
                      <input
                        type="number"
                        className="notion-input w-100"
                        value={hostingForm.renewal_price}
                        onChange={(e) =>
                          setHostingForm((prev) => ({
                            ...prev,
                            renewal_price: e.target.value,
                          }))
                        }
                        min="0"
                        required
                      />
                    </div>

                    <div className="col-6">
                      <label className="form-label fw-medium mb-1" style={{ fontSize: '12.5px' }}>
                        Modal Server ({editingClient.currency || 'IDR'})
                      </label>
                      <input
                        type="number"
                        className="notion-input w-100"
                        value={hostingForm.renewal_cost}
                        onChange={(e) =>
                          setHostingForm((prev) => ({
                            ...prev,
                            renewal_cost: e.target.value,
                          }))
                        }
                        min="0"
                        required
                      />
                    </div>
                  </div>

                  <div className="mb-2">
                    <label className="form-label fw-medium mb-1" style={{ fontSize: '12.5px' }}>
                      Catatan Kredensial Server / CMS (Opsional)
                    </label>
                    <textarea
                      className="notion-input w-100"
                      rows={2}
                      placeholder="cPanel / Cloudflare / WP-Admin access..."
                      value={hostingForm.credentials}
                      onChange={(e) =>
                        setHostingForm((prev) => ({
                          ...prev,
                          credentials: e.target.value,
                        }))
                      }
                    />
                  </div>
                </div>

                <div className="modal-footer border-top py-2 px-3">
                  <button
                    type="button"
                    className="btn-notion-outline"
                    onClick={() => setEditingClient(null)}
                  >
                    Batal
                  </button>
                  <button type="submit" className="btn-notion-primary">
                    Simpan Perubahan
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Riwayat Pembayaran Perpanjangan Modal */}
      {historyModalClient && (
        <div
          className="modal fade show d-block"
          style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1050 }}
        >
          <div className="modal-dialog modal-dialog-centered modal-lg">
            <div className="modal-content border-0 shadow">
              <div className="modal-header border-bottom py-2 px-3">
                <div className="fw-bold d-flex align-items-center gap-2" style={{ fontSize: '14px' }}>
                  <History size={16} className="text-primary" />
                  <span>Riwayat Perpanjangan: {historyModalClient.client_name}</span>
                </div>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setHistoryModalClient(null)}
                />
              </div>

              <div className="modal-body p-3">
                <div className="row g-2 mb-3">
                  <div className="col-6">
                    <div className="p-2 border rounded bg-light">
                      <div className="text-muted" style={{ fontSize: '11px' }}>
                        Total Terkumpul (Lifetime)
                      </div>
                      <div className="fw-bold text-success" style={{ fontSize: '15px' }}>
                        {formatCurrency(
                          historyModalClient.renewal_total_collected,
                          historyModalClient.currency || 'IDR'
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="col-6">
                    <div className="p-2 border rounded bg-light">
                      <div className="text-muted" style={{ fontSize: '11px' }}>
                        Total Net Profit Bersih (Lifetime)
                      </div>
                      <div className="fw-bold text-primary" style={{ fontSize: '15px' }}>
                        {formatCurrency(
                          historyModalClient.renewal_total_net_profit,
                          historyModalClient.currency || 'IDR'
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {(!historyModalClient.renewal_history || historyModalClient.renewal_history.length === 0) ? (
                  <div className="p-4 text-center text-muted" style={{ fontSize: '12.5px' }}>
                    Belum ada riwayat perpanjangan yang tercatat untuk klien ini. Klik tombol <strong>+1 Periode</strong> untuk mencatat perpanjangan pertama.
                  </div>
                ) : (
                  <div className="table-responsive">
                    <table className="table notion-table align-middle mb-0">
                      <thead>
                        <tr>
                          <th>Tanggal Bayar</th>
                          <th>Siklus</th>
                          <th>Tagihan Klien</th>
                          <th>Modal Server</th>
                          <th>Net Profit</th>
                          <th>Catatan</th>
                        </tr>
                      </thead>
                      <tbody>
                        {historyModalClient.renewal_history.map((log, idx) => (
                          <tr key={log.id || idx}>
                            <td className="fw-medium">{log.date}</td>
                            <td>
                              <span className="notion-pill bg-light border">
                                {log.cycle || 'Yearly'}
                              </span>
                            </td>
                            <td className="fw-bold text-success">
                              {formatCurrency(log.price, historyModalClient.currency || 'IDR')}
                            </td>
                            <td className="text-muted">
                              {formatCurrency(log.cost, historyModalClient.currency || 'IDR')}
                            </td>
                            <td className="fw-bold text-primary">
                              +{formatCurrency(log.net_profit, historyModalClient.currency || 'IDR')}
                            </td>
                            <td className="text-muted" style={{ fontSize: '12px' }}>
                              {log.note || '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="modal-footer border-top py-2 px-3">
                <button
                  type="button"
                  className="btn-notion-outline"
                  onClick={() => setHistoryModalClient(null)}
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Invoice Modal for Renewal */}
      {invoiceClient && (
        <InvoiceModal
          isOpen={Boolean(invoiceClient)}
          onClose={() => setInvoiceClient(null)}
          client={invoiceClient}
          initialInvoiceType="renewal"
        />
      )}
    </div>
  );
}
