import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Wallet,
  TrendingUp,
  CheckCircle2,
  AlertCircle,
  Plus,
  Search,
  ArrowUpRight,
  Download,
  BarChart3,
  FileText,
  RefreshCw,
  CalendarClock,
  Globe,
  Copy,
  Check,
  Settings2,
  Sparkles,
  X,
  History,
} from 'lucide-react';
import { useProspects } from '../context/ProspectsContext';
import {
  formatRupiah,
  formatUSD,
  formatCurrency,
  getPlatformBadgeClass,
  getPaymentBadgeClass,
  PAYMENT_STATUSES,
  CURRENCIES,
  RENEWAL_CYCLES,
  DEAL_MANAGEMENT_TYPES,
  getRenewalStatus,
  getNextRenewalDate,
  getTodayDateString,
  getOffsetDateString,
  getStudioSettings,
  exportToCSV,
} from '../lib/supabase';
import AddProspectModal from '../components/Prospects/AddProspectModal';
import ProspectDetailDrawer from '../components/Prospects/ProspectDetailDrawer';
import PaymentAccountsList from '../components/Finance/PaymentAccountsList';
import InvoiceModal from '../components/Finance/InvoiceModal';
import AnalyticsModal from '../components/Finance/AnalyticsModal';

export default function DealsFinancePage() {
  const {
    prospects,
    allTeamProspects,
    dealClients,
    loading,
    addProspect,
    updateProspect,
    deleteProspect,
  } = useProspects();
  const [searchParams, setSearchParams] = useSearchParams();

  const [activeTab, setActiveTab] = useState('contracts'); // 'contracts' | 'renewals'
  const [searchQuery, setSearchQuery] = useState('');
  const [paymentFilter, setPaymentFilter] = useState('ALL');
  const [currencyFilter, setCurrencyFilter] = useState('ALL');
  const [managementFilter, setManagementFilter] = useState('ALL'); // 'ALL' | 'full_managed' | 'project_only'
  const [renewalStatusFilter, setRenewalStatusFilter] = useState('ALL'); // 'ALL' | 'expiring_soon' | 'expired' | 'active' | 'unconfigured' | 'project_only'

  // Deep-link support from Notifications (?tab=renewals&open=id)
  useEffect(() => {
    const tabParam = searchParams.get('tab');
    const openParam = searchParams.get('open');
    if (tabParam === 'renewals' || tabParam === 'contracts') {
      setActiveTab(tabParam);
    }
    if (openParam) {
      setSelectedDealId(openParam);
    }
    if (tabParam || openParam) {
      const next = new URLSearchParams(searchParams);
      next.delete('tab');
      next.delete('open');
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const [isAddDealOpen, setIsAddDealOpen] = useState(false);
  const [selectedDealId, setSelectedDealId] = useState(null);
  const [invoiceModalState, setInvoiceModalState] = useState({
    client: null,
    initialType: null,
  });
  const [isAnalyticsOpen, setIsAnalyticsOpen] = useState(false);

  // Modal Atur Langganan / Renewal
  const [editingRenewalClient, setEditingRenewalClient] = useState(null);
  const [renewalForm, setRenewalForm] = useState({
    management_type: 'full_managed',
    renewal_enabled: true,
    renewal_cycle: 'Yearly',
    renewal_service_name: 'Perpanjangan Domain & Cloud Hosting Tahunan',
    renewal_price: '',
    renewal_cost: '',
    renewal_due_date: '',
    domain: '',
  });
  const [copiedReminderId, setCopiedReminderId] = useState(null);
  const [renewFeedback, setRenewFeedback] = useState('');
  const [renewingClientId, setRenewingClientId] = useState(null);
  const [savingRenewalConfig, setSavingRenewalConfig] = useState(false);

  const selectedDeal = useMemo(
    () => dealClients.find((c) => c.id === selectedDealId) || null,
    [dealClients, selectedDealId]
  );

  const filteredDeals = useMemo(() => {
    return dealClients.filter((item) => {
      const q = searchQuery.toLowerCase();
      const matchSearch =
        !q ||
        (item.client_name || '').toLowerCase().includes(q) ||
        (item.social_handle || '').toLowerCase().includes(q) ||
        (item.created_by_username || '').toLowerCase().includes(q) ||
        (item.delivery_assets?.domain || '').toLowerCase().includes(q) ||
        (item.notes || '').toLowerCase().includes(q);

      const matchPay =
        paymentFilter === 'ALL' || item.payment_status === paymentFilter;

      const matchCurr =
        currencyFilter === 'ALL' || (item.currency || 'IDR') === currencyFilter;

      const itemMType =
        item.management_type === 'project_only' ? 'project_only' : 'full_managed';
      const matchMgmt =
        managementFilter === 'ALL' || itemMType === managementFilter;

      return matchSearch && matchPay && matchCurr && matchMgmt;
    });
  }, [dealClients, searchQuery, paymentFilter, currencyFilter, managementFilter]);

  const filteredRenewals = useMemo(() => {
    return dealClients.filter((item) => {
      const q = searchQuery.toLowerCase();
      const matchSearch =
        !q ||
        (item.client_name || '').toLowerCase().includes(q) ||
        (item.delivery_assets?.domain || '').toLowerCase().includes(q) ||
        (item.renewal_service_name || '').toLowerCase().includes(q) ||
        (item.social_handle || '').toLowerCase().includes(q);

      const matchCurr =
        currencyFilter === 'ALL' || (item.currency || 'IDR') === currencyFilter;

      const itemMType =
        item.management_type === 'project_only' ? 'project_only' : 'full_managed';
      const matchMgmt =
        managementFilter === 'ALL' || itemMType === managementFilter;

      const rStatus = getRenewalStatus(
        item.renewal_due_date,
        item.renewal_enabled,
        itemMType
      ).status;
      const matchRenewalStatus =
        renewalStatusFilter === 'ALL' || rStatus === renewalStatusFilter;

      return matchSearch && matchCurr && matchMgmt && matchRenewalStatus;
    });
  }, [dealClients, searchQuery, currencyFilter, managementFilter, renewalStatusFilter]);

  const financeSummary = useMemo(() => {
    let totalCashInIdr = 0;
    let totalCashInUsd = 0;
    let totalProjectValueIdr = 0;
    let totalProjectValueUsd = 0;
    let totalRemainingIdr = 0;
    let totalRemainingUsd = 0;
    let fullyPaidCount = 0;
    let dealsIdrCount = 0;
    let dealsUsdCount = 0;
    let fullManagedCount = 0;
    let projectOnlyCount = 0;

    // Recurring & Renewal metrics
    let activeSubscriptionsCount = 0;
    let expiringSoonCount = 0;
    let expiredCount = 0;
    let recurringPotentialIdr = 0;
    let recurringPotentialUsd = 0;
    let renewalCollectedIdr = 0;
    let renewalCollectedUsd = 0;
    let renewalNetProfitIdr = 0;
    let renewalNetProfitUsd = 0;

    dealClients.forEach((client) => {
      const isUsd = (client.currency || 'IDR') === 'USD';
      const isProjectOnly = client.management_type === 'project_only';
      if (isProjectOnly) projectOnlyCount += 1;
      else fullManagedCount += 1;

      const value = Number(client.project_value) || 0;
      const currentDp = Number(client.dp_amount) || 0;
      const dp =
        client.payment_status === 'Lunas'
          ? value > 0
            ? value
            : currentDp
          : currentDp;
      const rem = Math.max(0, value - dp);

      if (isUsd) {
        dealsUsdCount += 1;
        totalProjectValueUsd += value;
        totalCashInUsd += dp;
        totalRemainingUsd += rem;
      } else {
        dealsIdrCount += 1;
        totalProjectValueIdr += value;
        totalCashInIdr += dp;
        totalRemainingIdr += rem;
      }

      if (client.payment_status === 'Lunas') fullyPaidCount += 1;

      // Renewal calculations (hanya klien Full Managed)
      const rCollected = Number(client.renewal_total_collected) || 0;
      const rNet = Number(client.renewal_total_net_profit) || 0;
      if (isUsd) {
        renewalCollectedUsd += rCollected;
        renewalNetProfitUsd += rNet;
      } else {
        renewalCollectedIdr += rCollected;
        renewalNetProfitIdr += rNet;
      }

      if (!isProjectOnly && client.renewal_enabled) {
        activeSubscriptionsCount += 1;
        const rPrice = Number(client.renewal_price) || 0;
        const rCost = Number(client.renewal_cost) || 0;
        const netPerCycle = Math.max(0, rPrice - rCost);
        if (isUsd) {
          recurringPotentialUsd += netPerCycle;
        } else {
          recurringPotentialIdr += netPerCycle;
        }

        const rInfo = getRenewalStatus(
          client.renewal_due_date,
          client.renewal_enabled,
          client.management_type
        );
        if (rInfo.status === 'expiring_soon') expiringSoonCount += 1;
        if (rInfo.status === 'expired') expiredCount += 1;
      }
    });

    return {
      totalCashInIdr,
      totalCashInUsd,
      totalProjectValueIdr,
      totalProjectValueUsd,
      totalRemainingIdr,
      totalRemainingUsd,
      fullyPaidCount,
      dealsIdrCount,
      dealsUsdCount,
      fullManagedCount,
      projectOnlyCount,
      totalDeals: dealClients.length,
      activeSubscriptionsCount,
      expiringSoonCount,
      expiredCount,
      urgentRenewalCount: expiringSoonCount + expiredCount,
      recurringPotentialIdr,
      recurringPotentialUsd,
      renewalCollectedIdr,
      renewalCollectedUsd,
      renewalNetProfitIdr,
      renewalNetProfitUsd,
    };
  }, [dealClients]);

  async function handleQuickMarkLunas(e, client) {
    e.stopPropagation();
    const val = Number(client.project_value) || 0;
    const currentDp = Number(client.dp_amount) || 0;
    await updateProspect(client.id, {
      payment_status: 'Lunas',
      dp_amount: val > 0 ? val : currentDp > 0 ? currentDp : val,
    });
  }

  function openEditRenewalModal(e, client) {
    if (e) e.stopPropagation();
    const isUsd = (client.currency || 'IDR') === 'USD';
    const mType =
      client.management_type === 'project_only' ? 'project_only' : 'full_managed';
    setEditingRenewalClient(client);
    setRenewalForm({
      management_type: mType,
      renewal_enabled: mType === 'project_only' ? false : client.renewal_enabled ?? true,
      renewal_cycle: client.renewal_cycle || 'Yearly',
      renewal_service_name:
        client.renewal_service_name ||
        (isUsd
          ? 'Annual Domain, Cloud Hosting & Web Care Plan'
          : 'Perpanjangan Domain & Cloud Hosting Tahunan'),
      renewal_price:
        client.renewal_price !== undefined && client.renewal_price !== null
          ? String(client.renewal_price)
          : isUsd
          ? '150'
          : '1500000',
      renewal_cost:
        client.renewal_cost !== undefined && client.renewal_cost !== null
          ? String(client.renewal_cost)
          : isUsd
          ? '25'
          : '450000',
      renewal_due_date: client.renewal_due_date || getOffsetDateString(365),
      domain: client.delivery_assets?.domain || client.social_handle || '',
    });
  }

  async function handleSaveRenewalConfig(e) {
    e.preventDefault();
    if (!editingRenewalClient || savingRenewalConfig) return;
    setSavingRenewalConfig(true);

    try {
      const priceNum = Math.max(0, Number(renewalForm.renewal_price) || 0);
      const costNum = Math.max(0, Number(renewalForm.renewal_cost) || 0);
      const isProjectOnly = renewalForm.management_type === 'project_only';

      const existingAssets = editingRenewalClient.delivery_assets || {
        staging_url: '',
        live_url: '',
        domain: '',
        credentials: '',
        revision_count: 0,
        max_revisions: 3,
        checklist: {
          content: false,
          wireframe: false,
          ui_design: false,
          code: false,
          qc: false,
          live: false,
        },
      };

      await updateProspect(editingRenewalClient.id, {
        management_type: renewalForm.management_type || 'full_managed',
        renewal_enabled: isProjectOnly ? false : Boolean(renewalForm.renewal_enabled),
        renewal_cycle: renewalForm.renewal_cycle,
        renewal_service_name: isProjectOnly
          ? 'Project / Redesign Saja (Hosting Klien Sendiri)'
          : renewalForm.renewal_service_name.trim() ||
            'Perpanjangan Domain & Hosting',
        renewal_price: isProjectOnly ? 0 : priceNum,
        renewal_cost: isProjectOnly ? 0 : costNum,
        renewal_due_date: isProjectOnly ? null : renewalForm.renewal_due_date || null,
        delivery_assets: {
          ...existingAssets,
          domain: renewalForm.domain.trim(),
        },
      });

      setEditingRenewalClient(null);
      setRenewFeedback(
        `Pengaturan langganan ${editingRenewalClient.client_name} berhasil disimpan.`
      );
      setTimeout(() => setRenewFeedback(''), 3500);
    } finally {
      setSavingRenewalConfig(false);
    }
  }

  async function handleOneClickRenewCycle(e, client) {
    if (e) e.stopPropagation();
    if (renewingClientId === client.id) return;
    setRenewingClientId(client.id);

    try {
      const curr = client.currency || 'IDR';
      const cycle = client.renewal_cycle || 'Yearly';
      const rawPrice = Number(client.renewal_price);
      const price =
        client.renewal_price !== undefined &&
        client.renewal_price !== null &&
        client.renewal_price !== '' &&
        Number.isFinite(rawPrice) &&
        rawPrice >= 0
          ? rawPrice
          : curr === 'USD'
          ? 150
          : 1500000;
      const cost = Math.max(0, Number(client.renewal_cost) || 0);
      const netProfit = Math.max(0, price - cost);
      const nextDueDate = getNextRenewalDate(
        client.renewal_due_date || getTodayDateString(),
        cycle
      );

      const newEntry = {
        id: 'rnw-' + Date.now(),
        date: getTodayDateString(),
        cycle,
        price,
        cost,
        net_profit: netProfit,
        note: `Perpanjangan ${
          cycle === 'Monthly' ? '1 Bulan' : '1 Tahun'
        } Lunas (Aktif s/d ${nextDueDate})`,
      };

      const prevHistory = Array.isArray(client.renewal_history)
        ? client.renewal_history
        : [];

      await updateProspect(client.id, {
        renewal_enabled: true,
        renewal_price: price,
        renewal_cost: cost,
        renewal_due_date: nextDueDate,
        renewal_total_collected:
          (Number(client.renewal_total_collected) || 0) + price,
        renewal_total_net_profit:
          (Number(client.renewal_total_net_profit) || 0) + netProfit,
        renewal_history: [newEntry, ...prevHistory],
      });

      setRenewFeedback(
        `Perpanjangan ${client.client_name} berhasil dicatat! Jatuh tempo maju ke ${nextDueDate} & Kas Bersih Studio +${formatCurrency(
          netProfit,
          curr
        )}.`
      );
      setTimeout(() => setRenewFeedback(''), 4500);
    } finally {
      setRenewingClientId(null);
    }
  }

  function handleCopyRenewalReminderWA(e, client) {
    if (e) e.stopPropagation();
    const curr = client.currency || 'IDR';
    const isUsd = curr === 'USD';
    const studioName = getStudioSettings().studioName || 'A-Tier Web Studio';
    const domain =
      client.delivery_assets?.domain ||
      client.delivery_assets?.live_url ||
      client.social_handle ||
      client.client_name;
    const price =
      Number(client.renewal_price) || (isUsd ? 150 : 1500000);
    const due = client.renewal_due_date || getOffsetDateString(14);
    const cycleLabel =
      client.renewal_cycle === 'Monthly'
        ? isUsd
          ? 'Monthly'
          : 'Bulanan'
        : isUsd
        ? 'Annual (1 Year)'
        : 'Tahunan (1 Tahun)';
    const service =
      client.renewal_service_name ||
      (isUsd
        ? 'Domain, Cloud Hosting & Website Maintenance'
        : 'Perpanjangan Domain, Cloud Hosting & Maintenance Website');

    const message = isUsd
      ? `Hello *${client.client_name}* team,

Hope you are doing great! This is a friendly reminder from *${studioName}* regarding your website subscription:

• *Website / Domain:* ${domain}
• *Service Plan:* ${service} (${cycleLabel})
• *Renewal Due Date:* ${due}
• *Renewal Amount:* ${formatCurrency(price, 'USD')}

Please let us know once you are ready so we can send over the official renewal invoice and keep your website & server running smoothly without interruption. Thank you!`
      : `Halo Kak / Tim *${client.client_name}*,

Semoga bisnisnya semakin lancar! Kami dari *${studioName}* ingin menginformasikan pengingat masa aktif layanan website Anda:

• *Domain / Website:* ${domain}
• *Layanan:* ${service} (${cycleLabel})
• *Tanggal Jatuh Tempo:* ${due}
• *Biaya Perpanjangan:* ${formatCurrency(price, 'IDR')}

Mohon konfirmasinya agar kami dapat mengirimkan Invoice Perpanjangan resmi dan memastikan domain serta server website tetap aktif tanpa kendala. Terima kasih banyak!`;

    navigator.clipboard.writeText(message);
    setCopiedReminderId(client.id);
    setTimeout(() => setCopiedReminderId(null), 2200);
  }

  function handleExportDealsCSV() {
    if (activeTab === 'renewals') {
      exportToCSV('data-langganan-renewal-website', filteredRenewals, [
        { header: 'Nama Klien', key: 'client_name' },
        {
          header: 'Domain Website',
          transform: (r) => r.delivery_assets?.domain || r.social_handle || '-',
        },
        { header: 'Mata Uang', key: 'currency' },
        {
          header: 'Tipe Manajemen',
          transform: (r) =>
            r.management_type === 'project_only'
              ? 'Project / Redesign Saja (Lepas Manajemen)'
              : 'Full Managed (Hosting & Domain Studio)',
        },
        {
          header: 'Status Langganan',
          transform: (r) =>
            getRenewalStatus(
              r.renewal_due_date,
              r.renewal_enabled,
              r.management_type
            ).label,
        },
        { header: 'Siklus', key: 'renewal_cycle' },
        { header: 'Layanan', key: 'renewal_service_name' },
        { header: 'Jatuh Tempo', key: 'renewal_due_date' },
        { header: 'Harga Tagihan Klien', key: 'renewal_price' },
        { header: 'Modal Provider', key: 'renewal_cost' },
        {
          header: 'Laba Bersih per Siklus',
          transform: (r) =>
            Math.max(
              0,
              (Number(r.renewal_price) || 0) - (Number(r.renewal_cost) || 0)
            ),
        },
        {
          header: 'Total Kas Perpanjangan Terkumpul',
          key: 'renewal_total_collected',
        },
        {
          header: 'Total Laba Bersih Studio Terkumpul',
          key: 'renewal_total_net_profit',
        },
      ]);
      return;
    }

    exportToCSV('data-klien-deal-keuangan', filteredDeals, [
      { header: 'Nama Klien', key: 'client_name' },
      {
        header: 'Wewenang Manajemen',
        transform: (row) =>
          row.management_type === 'project_only'
            ? 'Project / Redesign Saja (Lepas Wewenang)'
            : 'Full Managed (Hosting & Domain Studio)',
      },
      { header: 'Sumber Platform', key: 'source_platform' },
      { header: 'Akun Sosmed / Web', key: 'social_handle' },
      { header: 'Ditambahkan Oleh', key: 'created_by_username' },
      { header: 'Mata Uang', key: 'currency' },
      { header: 'Nilai Kontrak', key: 'project_value' },
      { header: 'DP Masuk', key: 'dp_amount' },
      {
        header: 'Sisa Pelunasan',
        transform: (row) =>
          Math.max(
            0,
            (Number(row.project_value) || 0) - (Number(row.dp_amount) || 0)
          ),
      },
      { header: 'Status Pembayaran', key: 'payment_status' },
      { header: 'Tanggal Deal', key: 'deal_date' },
      { header: 'Catatan', key: 'notes' },
    ]);
  }

  return (
    <div>
      {/* Page Header */}
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-3">
        <div>
          <h1 className="notion-page-title">
            Klien Deal &amp; Keuangan Web Design
          </h1>
          <p className="notion-page-subtitle">
            Lacak uang masuk kontrak proyek, pantau perpanjangan tahunan/bulanan domain &amp; hosting (100% kas bersih studio), cetak invoice resmi, dan kelola rekening tim.
          </p>
        </div>

        <div className="d-flex flex-wrap align-items-center gap-2">
          <button
            type="button"
            className="btn-notion-outline"
            onClick={() => setIsAnalyticsOpen(true)}
            title="Buka laporan analitik bisnis & efektivitas platform"
          >
            <BarChart3 size={14} />
            <span>Analitik Bisnis</span>
          </button>

          <button
            type="button"
            className="btn-notion-outline"
            onClick={handleExportDealsCSV}
            title="Download rekapan keuangan ke CSV"
          >
            <Download size={14} />
            <span>Export CSV</span>
          </button>

          <button
            type="button"
            className="btn-notion-primary"
            onClick={() => setIsAddDealOpen(true)}
          >
            <Plus size={16} />
            <span>Tambah Klien Deal</span>
          </button>
        </div>
      </div>

      {/* Mode Switcher Tabs: Kontrak Proyek vs Langganan & Perpanjangan */}
      <div className="d-flex flex-wrap align-items-center gap-2 mb-4 pb-2 border-bottom">
        <button
          type="button"
          className={
            activeTab === 'contracts'
              ? 'btn-notion-primary py-1 px-3'
              : 'btn-notion-outline py-1 px-3'
          }
          onClick={() => setActiveTab('contracts')}
        >
          <Wallet size={14} />
          <span>Kontrak Proyek &amp; DP/Pelunasan ({dealClients.length})</span>
        </button>

        <button
          type="button"
          className={
            activeTab === 'renewals'
              ? 'btn-notion-primary py-1 px-3'
              : 'btn-notion-outline py-1 px-3'
          }
          onClick={() => setActiveTab('renewals')}
        >
          <RefreshCw size={14} />
          <span>
            Langganan Domain, Hosting &amp; Maintenance (
            {financeSummary.activeSubscriptionsCount})
          </span>
          {financeSummary.urgentRenewalCount > 0 && (
            <span
              className="badge rounded-pill bg-danger text-white ms-1"
              style={{ fontSize: '10px' }}
            >
              {financeSummary.urgentRenewalCount} Perlu Ditagih
            </span>
          )}
        </button>
      </div>

      {renewFeedback && (
        <div
          className="alert alert-success py-2 px-3 mb-3 d-flex align-items-center justify-content-between"
          style={{ fontSize: '13px', borderRadius: '8px' }}
        >
          <div className="d-flex align-items-center gap-2">
            <CheckCircle2 size={16} />
            <span>{renewFeedback}</span>
          </div>
          <button
            type="button"
            className="btn-close"
            style={{ fontSize: '10px' }}
            onClick={() => setRenewFeedback('')}
          />
        </div>
      )}

      {/* ==================== TAB 1: KONTRAK PROYEK & DP/PELUNASAN ==================== */}
      {activeTab === 'contracts' && (
        <>
          {/* Financial Summary Cards (Dual Currency IDR & USD) */}
          <div className="row g-3 mb-4">
            {/* Total Uang Masuk */}
            <div className="col-sm-6 col-lg-3">
              <div
                className="notion-card"
                style={{ backgroundColor: '#f4fbf7', borderColor: '#bbf7d0' }}
              >
                <div className="notion-stat-label" style={{ color: '#166534' }}>
                  <Wallet size={14} />
                  <span>Total Uang Masuk (DP + Lunas)</span>
                </div>
                <div
                  className="notion-stat-value"
                  style={{ color: '#166534', fontSize: '20px' }}
                >
                  {formatRupiah(financeSummary.totalCashInIdr)}
                </div>
                <div
                  className="d-flex align-items-center gap-1 mt-1 fw-semibold"
                  style={{ fontSize: '13px', color: '#15803d' }}
                >
                  <span
                    className="badge rounded-pill bg-success text-white py-1 px-2"
                    style={{ fontSize: '10px' }}
                  >
                    USD
                  </span>
                  <span>{formatUSD(financeSummary.totalCashInUsd)}</span>
                </div>
                <div className="mt-2 text-muted" style={{ fontSize: '11px' }}>
                  + Laba Perpanjangan:{' '}
                  <strong>
                    {formatRupiah(financeSummary.renewalNetProfitIdr)}
                  </strong>{' '}
                  / <strong>{formatUSD(financeSummary.renewalNetProfitUsd)}</strong>
                </div>
              </div>
            </div>

            {/* Total Nilai Proyek */}
            <div className="col-sm-6 col-lg-3">
              <div className="notion-card">
                <div className="notion-stat-label">
                  <TrendingUp size={14} />
                  <span>Total Nilai Proyek Deal</span>
                </div>
                <div className="notion-stat-value" style={{ fontSize: '20px' }}>
                  {formatRupiah(financeSummary.totalProjectValueIdr)}
                </div>
                <div
                  className="d-flex align-items-center gap-1 mt-1 fw-semibold text-primary"
                  style={{ fontSize: '13px' }}
                >
                  <span
                    className="badge rounded-pill bg-primary-subtle text-primary border border-primary-subtle py-1 px-2"
                    style={{ fontSize: '10px' }}
                  >
                    USD
                  </span>
                  <span>{formatUSD(financeSummary.totalProjectValueUsd)}</span>
                </div>
                <div className="text-muted mt-2" style={{ fontSize: '11px' }}>
                  {financeSummary.totalDeals} Proyek ({financeSummary.dealsIdrCount}{' '}
                  IDR, {financeSummary.dealsUsdCount} USD)
                </div>
              </div>
            </div>

            {/* Sisa Tagihan (Piutang) */}
            <div className="col-sm-6 col-lg-3">
              <div className="notion-card">
                <div className="notion-stat-label">
                  <AlertCircle size={14} className="text-warning" />
                  <span>Sisa Tagihan (Piutang)</span>
                </div>
                <div className="notion-stat-value" style={{ fontSize: '20px' }}>
                  {formatRupiah(financeSummary.totalRemainingIdr)}
                </div>
                <div
                  className="d-flex align-items-center gap-1 mt-1 fw-semibold"
                  style={{ fontSize: '13px', color: '#b45309' }}
                >
                  <span
                    className="badge rounded-pill bg-warning-subtle text-warning-emphasis border border-warning-subtle py-1 px-2"
                    style={{ fontSize: '10px' }}
                  >
                    USD
                  </span>
                  <span>{formatUSD(financeSummary.totalRemainingUsd)}</span>
                </div>
                <div className="text-muted mt-2" style={{ fontSize: '11px' }}>
                  Menunggu pelunasan klien
                </div>
              </div>
            </div>

            {/* Proyek Lunas */}
            <div className="col-sm-6 col-lg-3">
              <div className="notion-card">
                <div className="notion-stat-label">
                  <CheckCircle2 size={14} />
                  <span>Proyek Lunas 100%</span>
                </div>
                <div className="notion-stat-value" style={{ fontSize: '20px' }}>
                  {financeSummary.fullyPaidCount}{' '}
                  <span
                    className="text-muted fw-normal"
                    style={{ fontSize: '14px' }}
                  >
                    / {financeSummary.totalDeals} Klien
                  </span>
                </div>
                <div className="text-muted mt-2" style={{ fontSize: '11px' }}>
                  Klik baris klien untuk edit DP &amp; Valuta
                </div>
              </div>
            </div>
          </div>

          {/* Filter Tipe Kerjasama Deal (Full Managed vs Project Saja / Lepas Manajemen) */}
          <div className="d-flex flex-wrap align-items-center gap-2 mb-3">
            <button
              type="button"
              className={
                managementFilter === 'ALL'
                  ? 'btn btn-sm btn-dark rounded-pill px-3'
                  : 'btn btn-sm btn-outline-secondary rounded-pill px-3'
              }
              style={{ fontSize: '12px' }}
              onClick={() => setManagementFilter('ALL')}
            >
              Semua Deal ({dealClients.length})
            </button>
            <button
              type="button"
              className={
                managementFilter === 'full_managed'
                  ? 'btn btn-sm btn-primary rounded-pill px-3'
                  : 'btn btn-sm btn-outline-primary rounded-pill px-3'
              }
              style={{ fontSize: '12px' }}
              onClick={() => setManagementFilter('full_managed')}
            >
              🏢 Full Managed — Hosting &amp; Domain Kami ({financeSummary.fullManagedCount})
            </button>
            <button
              type="button"
              className={
                managementFilter === 'project_only'
                  ? 'btn btn-sm btn-warning rounded-pill px-3 fw-semibold'
                  : 'btn btn-sm btn-outline-warning text-dark rounded-pill px-3'
              }
              style={{ fontSize: '12px' }}
              onClick={() => setManagementFilter('project_only')}
            >
              ⚡ Project / Redesign Saja — Lepas Manajemen ({financeSummary.projectOnlyCount})
            </button>
          </div>

          {/* Filter & Search */}
          <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
            <div className="d-flex flex-wrap align-items-center gap-2 flex-grow-1">
              <div
                className="position-relative"
                style={{ minWidth: '220px', maxWidth: '340px', flex: '1 1 220px' }}
              >
                <Search
                  size={14}
                  className="position-absolute text-muted"
                  style={{
                    left: '11px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                  }}
                />
                <input
                  type="text"
                  className="notion-input w-100"
                  style={{ paddingLeft: '32px' }}
                  placeholder="Cari nama klien, sosmed, penginput..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              <select
                className="notion-select"
                value={currencyFilter}
                onChange={(e) => setCurrencyFilter(e.target.value)}
              >
                <option value="ALL">Semua Valuta (IDR &amp; USD)</option>
                {CURRENCIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.symbol} {c.label}
                  </option>
                ))}
              </select>

              <select
                className="notion-select"
                value={paymentFilter}
                onChange={(e) => setPaymentFilter(e.target.value)}
              >
                <option value="ALL">Semua Status Bayar</option>
                {PAYMENT_STATUSES.map((ps) => (
                  <option key={ps.value} value={ps.value}>
                    {ps.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="text-muted" style={{ fontSize: '12.5px' }}>
              Menampilkan <strong>{filteredDeals.length}</strong> klien deal
            </div>
          </div>

          {/* Desktop View: Table of Deal Clients & Financials (Screens >= 768px) */}
          <div className="notion-table-wrapper mb-4 d-none d-md-block">
            <div className="table-responsive">
              <table className="notion-table">
                <thead>
                  <tr>
                    <th style={{ minWidth: '190px' }}>Nama Klien</th>
                    <th style={{ minWidth: '175px' }}>Tipe Manajemen Web</th>
                    <th style={{ minWidth: '130px' }}>Sumber &amp; Sosmed</th>
                    <th style={{ minWidth: '115px' }}>Penginput</th>
                    <th style={{ minWidth: '85px' }}>Valuta</th>
                    <th style={{ minWidth: '130px' }}>Nilai Proyek</th>
                    <th style={{ minWidth: '130px' }}>DP Masuk</th>
                    <th style={{ minWidth: '125px' }}>Sisa Tagihan</th>
                    <th style={{ minWidth: '110px' }}>Status Bayar</th>
                    <th style={{ minWidth: '145px', textAlign: 'right' }}>
                      Aksi &amp; Invoice
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={10} className="text-center py-5 text-muted">
                        Memuat data keuangan klien deal...
                      </td>
                    </tr>
                  ) : filteredDeals.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="text-center py-5">
                        <div className="text-muted mb-2">
                          Belum ada klien deal yang cocok dengan filter.
                        </div>
                        <button
                          type="button"
                          className="btn-notion-outline"
                          onClick={() => setIsAddDealOpen(true)}
                        >
                          <Plus size={14} />
                          <span>Tambah Klien Deal Baru</span>
                        </button>
                      </td>
                    </tr>
                  ) : (
                    filteredDeals.map((client) => {
                      const curr = client.currency || 'IDR';
                      const isUsd = curr === 'USD';
                      const val = Number(client.project_value) || 0;
                      const dp =
                        client.payment_status === 'Lunas'
                          ? val
                          : Number(client.dp_amount) || 0;
                      const remaining = Math.max(0, val - dp);

                      return (
                        <tr
                          key={client.id}
                          className={
                            selectedDealId === client.id ? 'selected-row' : ''
                          }
                          onClick={() => setSelectedDealId(client.id)}
                        >
                          <td>
                            <div className="fw-semibold">{client.client_name}</div>
                            <div
                              className="text-muted"
                              style={{ fontSize: '11.5px' }}
                            >
                              {client.notes
                                ? client.notes.slice(0, 44) +
                                  (client.notes.length > 44 ? '...' : '')
                                : 'Proyek Web Design'}
                            </div>
                          </td>
                          <td onClick={(e) => e.stopPropagation()}>
                            <select
                              className={`notion-select fw-medium ${
                                client.management_type === 'project_only'
                                  ? 'bg-warning-subtle text-warning-emphasis border-warning-subtle'
                                  : 'bg-primary-subtle text-primary border-primary-subtle'
                              }`}
                              style={{ fontSize: '11px', padding: '3px 6px' }}
                              value={
                                client.management_type === 'project_only'
                                  ? 'project_only'
                                  : 'full_managed'
                              }
                              onChange={(e) =>
                                updateProspect(client.id, {
                                  management_type: e.target.value,
                                })
                              }
                              title="Ubah wewenang manajemen website klien ini"
                            >
                              <option value="full_managed">
                                🏢 Full Managed (Hosting Kami)
                              </option>
                              <option value="project_only">
                                ⚡ Project Saja (Lepas Manajemen)
                              </option>
                            </select>
                            <div
                              className="text-muted mt-1"
                              style={{ fontSize: '10.5px' }}
                            >
                              {client.management_type === 'project_only'
                                ? 'Beli putus — tidak di bawah manajemen studio'
                                : 'Hosting & domain dikelola penuh oleh tim'}
                            </div>
                          </td>
                          <td>
                            <span
                              className={`notion-pill ${getPlatformBadgeClass(
                                client.source_platform
                              )}`}
                            >
                              {client.source_platform}
                            </span>
                            <div
                              className="text-muted mt-1"
                              style={{ fontSize: '11.5px' }}
                            >
                              {client.social_handle}
                            </div>
                          </td>
                          <td>
                            <span className="notion-pill pill-other">
                              @{client.created_by_username || 'tim'}
                            </span>
                          </td>
                          <td>
                            <span
                              className="notion-pill"
                              style={{
                                backgroundColor: isUsd ? '#e0f2fe' : '#f1f1ef',
                                color: isUsd ? '#0369a1' : '#37352f',
                                fontWeight: 600,
                                fontSize: '11px',
                              }}
                            >
                              {isUsd ? '$ USD' : 'Rp IDR'}
                            </span>
                          </td>
                          <td className="fw-semibold">
                            {formatCurrency(val, curr)}
                          </td>
                          <td
                            className="fw-semibold"
                            style={{ color: '#166534' }}
                          >
                            {formatCurrency(dp, curr)}
                          </td>
                          <td
                            className="fw-medium"
                            style={{
                              color: remaining > 0 ? '#92400e' : '#787774',
                            }}
                          >
                            {formatCurrency(remaining, curr)}
                          </td>
                          <td>
                            <span
                              className={`notion-pill ${getPaymentBadgeClass(
                                client.payment_status
                              )}`}
                            >
                              {client.payment_status}
                            </span>
                          </td>
                          <td className="text-end">
                            <div className="d-flex align-items-center justify-content-end gap-1">
                              <button
                                type="button"
                                className="btn-notion-outline py-1 px-2 d-inline-flex align-items-center gap-1"
                                style={{ fontSize: '11.5px' }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setInvoiceModalState({
                                    client,
                                    initialType: null,
                                  });
                                }}
                                title="Buat invoice DP atau pelunasan untuk klien ini"
                              >
                                <FileText size={12} />
                                <span>Invoice</span>
                              </button>

                              {client.payment_status !== 'Lunas' ? (
                                <button
                                  type="button"
                                  className="btn-notion-outline py-1 px-2"
                                  style={{ fontSize: '11.5px' }}
                                  onClick={(e) => handleQuickMarkLunas(e, client)}
                                >
                                  <span>Lunas</span>
                                </button>
                              ) : (
                                <span
                                  className="text-muted d-inline-flex align-items-center gap-1 px-1"
                                  style={{ fontSize: '11.5px' }}
                                >
                                  <ArrowUpRight size={13} />
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile View: Hybrid Responsive Cards (Screens < 768px) */}
          <div className="mobile-card-list d-block d-md-none mb-5">
            {loading ? (
              <div className="notion-card text-center py-4 text-muted">
                Memuat data keuangan klien deal...
              </div>
            ) : filteredDeals.length === 0 ? (
              <div className="notion-card text-center py-4">
                <div className="text-muted mb-2">
                  Belum ada klien deal yang cocok dengan filter.
                </div>
                <button
                  type="button"
                  className="btn-notion-outline"
                  onClick={() => setIsAddDealOpen(true)}
                >
                  <Plus size={14} />
                  <span>Tambah Klien Deal Baru</span>
                </button>
              </div>
            ) : (
              filteredDeals.map((client) => {
                const curr = client.currency || 'IDR';
                const isUsd = curr === 'USD';
                const val = Number(client.project_value) || 0;
                const dp = Number(client.dp_amount) || 0;
                const remaining = Math.max(0, val - dp);
                const isFullManaged =
                  client.management_type !== 'project_only';

                return (
                  <div
                    key={client.id}
                    className="mobile-data-card"
                    style={{
                      borderLeft:
                        client.payment_status === 'Lunas'
                          ? '4px solid #16a34a'
                          : client.payment_status === 'DP Masuk'
                          ? '4px solid #d97706'
                          : '4px solid #dc2626',
                    }}
                  >
                    {/* Header */}
                    <div className="mobile-data-card-header">
                      <div className="flex-grow-1 overflow-hidden pe-2">
                        <div
                          className="mobile-data-card-title text-truncate"
                          onClick={() => setSelectedClientId(client.id)}
                          style={{ cursor: 'pointer' }}
                        >
                          {client.client_name}
                        </div>
                        <div className="d-flex flex-wrap align-items-center gap-1 mt-1">
                          <span
                            className={`badge rounded-pill ${
                              isFullManaged
                                ? 'bg-primary-subtle text-primary border border-primary-subtle'
                                : 'bg-warning-subtle text-warning-emphasis border border-warning-subtle'
                            }`}
                            style={{ fontSize: '10px' }}
                          >
                            {isFullManaged
                              ? '🏢 Full Managed'
                              : '⚡ Project Saja'}
                          </span>
                          <span
                            className={`notion-pill ${getPaymentBadgeClass(
                              client.payment_status
                            )}`}
                          >
                            {client.payment_status}
                          </span>
                          <span
                            className="notion-pill"
                            style={{
                              backgroundColor: isUsd ? '#e0f2fe' : '#f1f1ef',
                              color: isUsd ? '#0369a1' : '#37352f',
                              fontSize: '10px',
                            }}
                          >
                            {isUsd ? '$ USD' : 'Rp IDR'}
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSelectedClientId(client.id)}
                        className="btn btn-sm btn-light border py-1 px-2 flex-shrink-0"
                        style={{ fontSize: '11.5px' }}
                      >
                        Detail &rarr;
                      </button>
                    </div>

                    {/* Financial Numbers Grid */}
                    <div className="mobile-data-card-body">
                      <div className="p-2 rounded bg-light border d-flex justify-content-between align-items-center">
                        <div>
                          <div className="text-muted" style={{ fontSize: '11px' }}>
                            Nilai Kontrak
                          </div>
                          <div className="fw-bold" style={{ fontSize: '14px' }}>
                            {formatCurrency(val, curr)}
                          </div>
                        </div>
                        <div className="text-end">
                          <div className="text-muted" style={{ fontSize: '11px' }}>
                            DP Masuk
                          </div>
                          <div
                            className="fw-bold text-success"
                            style={{ fontSize: '14px' }}
                          >
                            {formatCurrency(dp, curr)}
                          </div>
                        </div>
                        {remaining > 0 && (
                          <div className="text-end">
                            <div className="text-muted" style={{ fontSize: '11px' }}>
                              Sisa Piutang
                            </div>
                            <div
                              className="fw-bold text-warning"
                              style={{ fontSize: '14px' }}
                            >
                              {formatCurrency(remaining, curr)}
                            </div>
                          </div>
                        )}
                      </div>

                      <div
                        className="d-flex align-items-center justify-content-between text-secondary"
                        style={{ fontSize: '12px' }}
                      >
                        <span>
                          Sumber: <strong>{client.source_platform}</strong> ({client.social_handle || '-'})
                        </span>
                        <span className="text-muted">
                          Hunter: @{client.created_by_username || 'tim'}
                        </span>
                      </div>
                    </div>

                    {/* Footer Actions */}
                    <div className="mobile-data-card-footer">
                      <div className="d-flex align-items-center gap-1">
                        <button
                          type="button"
                          className="btn btn-sm btn-light border py-1 px-2 d-inline-flex align-items-center gap-1"
                          style={{ fontSize: '11.5px' }}
                          onClick={(e) => {
                            e.stopPropagation();
                            setInvoiceModalState({
                              client,
                              initialType: null,
                            });
                          }}
                        >
                          <FileText size={12} />
                          <span>Invoice</span>
                        </button>

                        {client.payment_status !== 'Lunas' && (
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-success py-1 px-2"
                            style={{ fontSize: '11.5px', fontWeight: 600 }}
                            onClick={(e) => handleQuickMarkLunas(e, client)}
                          >
                            Tandai Lunas
                          </button>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => setSelectedClientId(client.id)}
                        className="btn btn-sm btn-link p-0 text-decoration-none text-muted"
                        style={{ fontSize: '12px' }}
                      >
                        Edit Proyek
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </>
      )}

      {/* ==================== TAB 2: LANGGANAN DOMAIN, HOSTING & MAINTENANCE ==================== */}
      {activeTab === 'renewals' && (
        <>
          {/* Recurring Revenue KPI Cards */}
          <div className="row g-3 mb-4">
            <div className="col-sm-6 col-lg-3">
              <div
                className="notion-card"
                style={{ backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' }}
              >
                <div className="notion-stat-label" style={{ color: '#166534' }}>
                  <Sparkles size={14} />
                  <span>Kas Bersih Perpanjangan (100% Studio)</span>
                </div>
                <div
                  className="notion-stat-value"
                  style={{ color: '#166534', fontSize: '20px' }}
                >
                  {formatRupiah(financeSummary.renewalNetProfitIdr)}
                </div>
                <div
                  className="d-flex align-items-center gap-1 mt-1 fw-semibold"
                  style={{ fontSize: '13px', color: '#15803d' }}
                >
                  <span
                    className="badge rounded-pill bg-success text-white py-1 px-2"
                    style={{ fontSize: '10px' }}
                  >
                    USD
                  </span>
                  <span>{formatUSD(financeSummary.renewalNetProfitUsd)}</span>
                </div>
                <div className="mt-2 text-muted" style={{ fontSize: '11px' }}>
                  Sudah dipotong modal server &amp; bebas potongan komisi hunter
                </div>
              </div>
            </div>

            <div className="col-sm-6 col-lg-3">
              <div className="notion-card">
                <div className="notion-stat-label">
                  <RefreshCw size={14} className="text-primary" />
                  <span>Potensi Margin Bersih / Siklus</span>
                </div>
                <div className="notion-stat-value" style={{ fontSize: '20px' }}>
                  {formatRupiah(financeSummary.recurringPotentialIdr)}
                </div>
                <div
                  className="d-flex align-items-center gap-1 mt-1 fw-semibold text-primary"
                  style={{ fontSize: '13px' }}
                >
                  <span
                    className="badge rounded-pill bg-primary-subtle text-primary border border-primary-subtle py-1 px-2"
                    style={{ fontSize: '10px' }}
                  >
                    USD
                  </span>
                  <span>{formatUSD(financeSummary.recurringPotentialUsd)}</span>
                </div>
                <div className="mt-2 text-muted" style={{ fontSize: '11px' }}>
                  Estimasi laba bersih dari {financeSummary.activeSubscriptionsCount} langganan aktif
                </div>
              </div>
            </div>

            <div className="col-sm-6 col-lg-3">
              <div
                className="notion-card"
                style={{
                  backgroundColor:
                    financeSummary.urgentRenewalCount > 0 ? '#fffbeb' : '#ffffff',
                  borderColor:
                    financeSummary.urgentRenewalCount > 0
                      ? '#fde68a'
                      : 'var(--notion-border)',
                }}
              >
                <div className="notion-stat-label">
                  <CalendarClock size={14} className="text-warning" />
                  <span>Perlu Segera Ditagih (≤ 30 Hari)</span>
                </div>
                <div className="notion-stat-value" style={{ fontSize: '20px' }}>
                  {financeSummary.expiringSoonCount}{' '}
                  <span
                    className="text-muted fw-normal"
                    style={{ fontSize: '13px' }}
                  >
                    Segera Habis
                  </span>
                </div>
                <div
                  className="mt-1 fw-semibold"
                  style={{
                    fontSize: '12.5px',
                    color:
                      financeSummary.expiredCount > 0 ? '#dc2626' : '#6b7280',
                  }}
                >
                  {financeSummary.expiredCount} Sudah Lewat Jatuh Tempo (Expired)
                </div>
                <div className="mt-2 text-muted" style={{ fontSize: '11px' }}>
                  Kirim WA Pengingat atau Invoice Renewal 1-Klik
                </div>
              </div>
            </div>

            <div className="col-sm-6 col-lg-3">
              <div className="notion-card">
                <div className="notion-stat-label">
                  <Globe size={14} />
                  <span>Total Kas Kotor Perpanjangan</span>
                </div>
                <div className="notion-stat-value" style={{ fontSize: '20px' }}>
                  {formatRupiah(financeSummary.renewalCollectedIdr)}
                </div>
                <div
                  className="d-flex align-items-center gap-1 mt-1 fw-semibold text-secondary"
                  style={{ fontSize: '13px' }}
                >
                  <span
                    className="badge rounded-pill bg-secondary text-white py-1 px-2"
                    style={{ fontSize: '10px' }}
                  >
                    USD
                  </span>
                  <span>{formatUSD(financeSummary.renewalCollectedUsd)}</span>
                </div>
                <div className="mt-2 text-muted" style={{ fontSize: '11px' }}>
                  Total pembayaran perpanjangan diterima
                </div>
              </div>
            </div>
          </div>

          {/* Filter & Search for Renewals */}
          <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
            <div className="d-flex flex-wrap align-items-center gap-2 flex-grow-1">
              <div
                className="position-relative"
                style={{ minWidth: '220px', maxWidth: '320px', flex: '1 1 220px' }}
              >
                <Search
                  size={14}
                  className="position-absolute text-muted"
                  style={{
                    left: '11px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                  }}
                />
                <input
                  type="text"
                  className="notion-input w-100"
                  style={{ paddingLeft: '32px' }}
                  placeholder="Cari klien, domain, atau paket layanan..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              <select
                className="notion-select"
                value={managementFilter}
                onChange={(e) => setManagementFilter(e.target.value)}
              >
                <option value="ALL">Semua Skema Klien Deal</option>
                <option value="full_managed">🏢 Full Managed (Hosting Kami)</option>
                <option value="project_only">⚡ Project / Redesign Saja (Lepas)</option>
              </select>

              <select
                className="notion-select"
                value={renewalStatusFilter}
                onChange={(e) => setRenewalStatusFilter(e.target.value)}
              >
                <option value="ALL">Semua Status Masa Aktif</option>
                <option value="expiring_soon">🟠 Segera Habis (≤ 30 Hari)</option>
                <option value="expired">🔴 Sudah Expired (Lewat Jatuh Tempo)</option>
                <option value="active">🟢 Aktif Aman (&gt; 30 Hari)</option>
                <option value="project_only">⚡ Beli Putus (Lepas Manajemen)</option>
                <option value="unconfigured">⚪ Belum Diatur Jadwal</option>
              </select>

              <select
                className="notion-select"
                value={currencyFilter}
                onChange={(e) => setCurrencyFilter(e.target.value)}
              >
                <option value="ALL">Semua Valuta (IDR &amp; USD)</option>
                {CURRENCIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.symbol} {c.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="text-muted" style={{ fontSize: '12.5px' }}>
              Menampilkan <strong>{filteredRenewals.length}</strong> klien
            </div>
          </div>

          {/* Desktop View: Table of Subscriptions & Domain/Hosting Renewals (Screens >= 768px) */}
          <div className="notion-table-wrapper mb-4 d-none d-md-block">
            <div className="table-responsive">
              <table className="notion-table">
                <thead>
                  <tr>
                    <th style={{ minWidth: '185px' }}>Klien &amp; Domain Website</th>
                    <th style={{ minWidth: '190px' }}>Paket Layanan &amp; Siklus</th>
                    <th style={{ minWidth: '150px' }}>Jatuh Tempo &amp; Status</th>
                    <th style={{ minWidth: '130px' }}>Tagihan Klien</th>
                    <th style={{ minWidth: '120px' }}>Modal Provider</th>
                    <th style={{ minWidth: '135px' }}>Margin Bersih Studio</th>
                    <th style={{ minWidth: '135px' }}>Histori Terkumpul</th>
                    <th style={{ minWidth: '250px', textAlign: 'right' }}>
                      Aksi Perpanjangan 1-Klik
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRenewals.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="text-center py-5 text-muted">
                        Tidak ada data langganan klien yang cocok dengan filter.
                      </td>
                    </tr>
                  ) : (
                    filteredRenewals.map((client) => {
                      const curr = client.currency || 'IDR';
                      const isProjectOnly =
                        client.management_type === 'project_only';
                      const rInfo = getRenewalStatus(
                        client.renewal_due_date,
                        client.renewal_enabled,
                        client.management_type
                      );
                      const price = Number(client.renewal_price) || 0;
                      const cost = Number(client.renewal_cost) || 0;
                      const netMargin = Math.max(0, price - cost);
                      const totalNet =
                        Number(client.renewal_total_net_profit) || 0;
                      const historyCount = Array.isArray(client.renewal_history)
                        ? client.renewal_history.length
                        : 0;
                      const domainName =
                        client.delivery_assets?.domain ||
                        client.delivery_assets?.live_url ||
                        client.social_handle ||
                        '-';

                      return (
                        <tr
                          key={client.id}
                          onClick={() => setSelectedDealId(client.id)}
                          style={{ cursor: 'pointer' }}
                        >
                          <td>
                            <div className="fw-semibold">{client.client_name}</div>
                            <div
                              className="d-flex align-items-center gap-1 text-primary mt-1"
                              style={{ fontSize: '11.5px' }}
                            >
                              <Globe size={11} />
                              <span>{domainName}</span>
                            </div>
                          </td>

                          <td>
                            {isProjectOnly ? (
                              <span
                                className="badge bg-warning-subtle text-warning-emphasis border border-warning-subtle px-2 py-1"
                                style={{ fontSize: '11px' }}
                              >
                                ⚡ Project / Redesign Saja (Hosting Klien)
                              </span>
                            ) : client.renewal_enabled ? (
                              <>
                                <div
                                  className="fw-medium"
                                  style={{ fontSize: '12.5px' }}
                                >
                                  {client.renewal_service_name ||
                                    'Domain & Hosting'}
                                </div>
                                <span
                                  className="badge bg-light text-dark border mt-1"
                                  style={{ fontSize: '10.5px' }}
                                >
                                  {client.renewal_cycle === 'Monthly'
                                    ? 'Siklus Bulanan'
                                    : 'Siklus Tahunan'}
                                </span>
                              </>
                            ) : (
                              <span
                                className="text-muted"
                                style={{ fontSize: '12px' }}
                              >
                                Belum diaktifkan
                              </span>
                            )}
                          </td>

                          <td>
                            <span
                              className={`badge rounded-pill px-2 py-1 ${rInfo.pillClass}`}
                              style={{ fontSize: '11px' }}
                            >
                              {rInfo.label} ({rInfo.daysText})
                            </span>
                            {client.renewal_due_date && (
                              <div
                                className="text-muted mt-1"
                                style={{ fontSize: '11.5px' }}
                              >
                                Due: <strong>{client.renewal_due_date}</strong>
                              </div>
                            )}
                          </td>

                          <td className="fw-semibold">
                            {client.renewal_enabled
                              ? formatCurrency(price, curr)
                              : '-'}
                          </td>

                          <td className="text-muted" style={{ fontSize: '12.5px' }}>
                            {client.renewal_enabled
                              ? formatCurrency(cost, curr)
                              : '-'}
                          </td>

                          <td>
                            {client.renewal_enabled ? (
                              <span
                                className="fw-bold"
                                style={{ color: '#166534', fontSize: '13px' }}
                              >
                                +{formatCurrency(netMargin, curr)}
                              </span>
                            ) : (
                              '-'
                            )}
                          </td>

                          <td>
                            <div
                              className="fw-semibold"
                              style={{ color: '#15803d', fontSize: '12.5px' }}
                            >
                              {formatCurrency(totalNet, curr)}
                            </div>
                            <div
                              className="text-muted"
                              style={{ fontSize: '11px' }}
                            >
                              {historyCount}x siklus diperpanjang
                            </div>
                          </td>

                          <td
                            className="text-end"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="d-flex flex-wrap align-items-center justify-content-end gap-1">
                              {!isProjectOnly && (
                                <>
                                  <button
                                    type="button"
                                    className="btn btn-sm btn-success py-1 px-2 d-inline-flex align-items-center gap-1"
                                    style={{ fontSize: '11px' }}
                                    onClick={(e) =>
                                      handleOneClickRenewCycle(e, client)
                                    }
                                    title="Perpanjang otomatis +1 siklus (majukan jatuh tempo & tambah kas bersih studio)"
                                  >
                                    <RefreshCw size={11} />
                                    <span>Perpanjang +1</span>
                                  </button>

                                  <button
                                    type="button"
                                    className="btn-notion-outline py-1 px-2 d-inline-flex align-items-center gap-1"
                                    style={{ fontSize: '11px' }}
                                    onClick={(e) =>
                                      handleCopyRenewalReminderWA(e, client)
                                    }
                                    title="Salin pesan WhatsApp pengingat perpanjangan"
                                  >
                                    {copiedReminderId === client.id ? (
                                      <>
                                        <Check size={11} className="text-success" />
                                        <span className="text-success fw-bold">
                                          WA Tersalin
                                        </span>
                                      </>
                                    ) : (
                                      <>
                                        <Copy size={11} />
                                        <span>WA</span>
                                      </>
                                    )}
                                  </button>

                                  <button
                                    type="button"
                                    className="btn-notion-outline py-1 px-2 d-inline-flex align-items-center gap-1"
                                    style={{ fontSize: '11px' }}
                                    onClick={() =>
                                      setInvoiceModalState({
                                        client,
                                        initialType: 'renewal',
                                      })
                                    }
                                    title="Cetak Invoice Perpanjangan Domain/Hosting"
                                  >
                                    <FileText size={11} />
                                    <span>Invoice</span>
                                  </button>
                                </>
                              )}

                              <button
                                type="button"
                                className="btn-notion-outline py-1 px-2 d-inline-flex align-items-center gap-1"
                                style={{ fontSize: '11px' }}
                                onClick={(e) => openEditRenewalModal(e, client)}
                                title="Atur skema manajemen, siklus, harga perpanjangan, modal server, dan jadwal expired"
                              >
                                <Settings2 size={11} />
                                <span>{isProjectOnly ? 'Ubah Skema' : 'Atur'}</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile View: Hybrid Responsive Cards for Renewals (Screens < 768px) */}
          <div className="mobile-card-list d-block d-md-none mb-5">
            {filteredRenewals.length === 0 ? (
              <div className="notion-card text-center py-4 text-muted">
                Tidak ada data langganan klien yang cocok dengan filter.
              </div>
            ) : (
              filteredRenewals.map((client) => {
                const curr = client.currency || 'IDR';
                const isProjectOnly =
                  client.management_type === 'project_only';
                const rInfo = getRenewalStatus(
                  client.renewal_due_date,
                  client.renewal_enabled,
                  client.management_type
                );
                const price = Number(client.renewal_price) || 0;
                const cost = Number(client.renewal_cost) || 0;
                const netMargin = Math.max(0, price - cost);

                return (
                  <div
                    key={client.id}
                    className="mobile-data-card"
                    style={{
                      borderLeft:
                        rInfo.status === 'expired'
                          ? '4px solid #dc2626'
                          : rInfo.status === 'expiring_soon'
                          ? '4px solid #d97706'
                          : isProjectOnly
                          ? '4px solid #94a3b8'
                          : '4px solid #16a34a',
                    }}
                  >
                    <div className="mobile-data-card-header">
                      <div className="flex-grow-1 overflow-hidden pe-2">
                        <div className="mobile-data-card-title text-truncate">
                          {client.client_name}
                        </div>
                        <div className="d-flex flex-wrap align-items-center gap-1 mt-1">
                          <span className={`badge rounded-pill ${rInfo.pillClass}`} style={{ fontSize: '10px' }}>
                            {rInfo.label}
                          </span>
                          {!isProjectOnly && client.renewal_due_date && (
                            <span className="text-muted" style={{ fontSize: '11px' }}>
                              Due: {client.renewal_due_date}
                            </span>
                          )}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => openEditRenewalModal(e, client)}
                        className="btn btn-sm btn-light border py-1 px-2 flex-shrink-0"
                        style={{ fontSize: '11.5px' }}
                      >
                        <Settings2 size={12} className="me-1" />
                        <span>Atur</span>
                      </button>
                    </div>

                    <div className="mobile-data-card-body">
                      {!isProjectOnly && (
                        <div className="p-2 rounded bg-light border d-flex justify-content-between align-items-center">
                          <div>
                            <div className="text-muted" style={{ fontSize: '11px' }}>
                              Tagihan Klien
                            </div>
                            <div className="fw-bold" style={{ fontSize: '13.5px' }}>
                              {formatCurrency(price, curr)} / {client.renewal_cycle || 'Yearly'}
                            </div>
                          </div>
                          <div className="text-end">
                            <div className="text-muted" style={{ fontSize: '11px' }}>
                              Laba Bersih Studio
                            </div>
                            <div className="fw-bold text-success" style={{ fontSize: '13.5px' }}>
                              +{formatCurrency(netMargin, curr)}
                            </div>
                          </div>
                        </div>
                      )}

                      <div className="text-secondary" style={{ fontSize: '12px' }}>
                        Domain: <strong>{client.delivery_assets?.domain || client.social_handle || '-'}</strong>
                      </div>
                    </div>

                    {!isProjectOnly && (
                      <div className="mobile-data-card-footer">
                        <div className="d-flex align-items-center gap-1">
                          <button
                            type="button"
                            className="btn btn-sm btn-success py-1 px-2 d-inline-flex align-items-center gap-1"
                            style={{ fontSize: '11px' }}
                            onClick={(e) => handleOneClickRenewCycle(e, client)}
                          >
                            <RefreshCw size={11} />
                            <span>Perpanjang +1</span>
                          </button>

                          <button
                            type="button"
                            className="btn btn-sm btn-light border py-1 px-2 d-inline-flex align-items-center gap-1"
                            style={{ fontSize: '11px' }}
                            onClick={(e) => handleCopyRenewalReminderWA(e, client)}
                          >
                            {copiedReminderId === client.id ? (
                              <span className="text-success fw-bold">Tersalin!</span>
                            ) : (
                              <>
                                <Copy size={11} />
                                <span>Copy WA</span>
                              </>
                            )}
                          </button>

                          <button
                            type="button"
                            className="btn btn-sm btn-light border py-1 px-2 d-inline-flex align-items-center gap-1"
                            style={{ fontSize: '11px' }}
                            onClick={() =>
                              setInvoiceModalState({
                                client,
                                initialType: 'renewal',
                              })
                            }
                          >
                            <FileText size={11} />
                            <span>Invoice</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </>
      )}

      {/* Metode Pembayaran & Rekening Tim (Maksimal 10 Akun) */}
      <PaymentAccountsList />

      {/* Modal Atur / Edit Langganan & Perpanjangan */}
      {editingRenewalClient && (
        <>
          <div
            className="notion-drawer-backdrop"
            onClick={() => setEditingRenewalClient(null)}
          />
          <div
            className="modal show d-block"
            tabIndex="-1"
            style={{ backgroundColor: 'rgba(15, 15, 15, 0.45)', zIndex: 1060 }}
          >
            <div className="modal-dialog modal-dialog-centered">
              <div
                className="modal-content border-0 shadow-lg"
                style={{ borderRadius: '10px' }}
              >
                <div className="modal-header py-2 px-3 border-bottom bg-light">
                  <div className="d-flex align-items-center gap-2">
                    <RefreshCw size={15} />
                    <span className="fw-semibold" style={{ fontSize: '13.5px' }}>
                      Atur Langganan &amp; Perpanjangan —{' '}
                      {editingRenewalClient.client_name}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="btn btn-sm p-1 text-muted border-0 bg-transparent"
                    onClick={() => setEditingRenewalClient(null)}
                  >
                    <X size={18} />
                  </button>
                </div>

                <form onSubmit={handleSaveRenewalConfig}>
                  <div className="modal-body p-3">
                    <div className="mb-3">
                      <label
                        className="form-label text-muted fw-semibold mb-1"
                        style={{ fontSize: '11.5px' }}
                      >
                        Skema Wewenang Manajemen Klien
                      </label>
                      <select
                        className="notion-select w-100"
                        value={renewalForm.management_type || 'full_managed'}
                        onChange={(e) => {
                          const nextType = e.target.value;
                          setRenewalForm((prev) => ({
                            ...prev,
                            management_type: nextType,
                            renewal_enabled: nextType !== 'project_only',
                          }));
                        }}
                      >
                        {DEAL_MANAGEMENT_TYPES.map((mt) => (
                          <option key={mt.value} value={mt.value}>
                            {mt.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    {renewalForm.management_type === 'project_only' ? (
                      <div className="alert alert-warning py-2 px-3 mb-3" style={{ fontSize: '12px' }}>
                        <strong>Skema Beli Putus (Project / Redesign Saja):</strong> Hosting &amp; domain tidak dikelola studio. Pelacak perpanjangan otomatis dinonaktifkan.
                      </div>
                    ) : (
                      <div className="form-check form-switch mb-3">
                        <input
                          className="form-check-input"
                          type="checkbox"
                          id="renewalEnabledSwitch"
                          checked={renewalForm.renewal_enabled}
                          onChange={(e) =>
                            setRenewalForm((prev) => ({
                              ...prev,
                              renewal_enabled: e.target.checked,
                            }))
                          }
                        />
                        <label
                          className="form-check-label fw-semibold"
                          htmlFor="renewalEnabledSwitch"
                          style={{ fontSize: '13px' }}
                        >
                          Aktifkan Pelacak Perpanjangan Domain/Hosting/Maintenance
                        </label>
                      </div>
                    )}

                    <div className="row g-2 mb-2">
                      <div className={renewalForm.management_type === 'project_only' ? 'col-12' : 'col-sm-6'}>
                        <label
                          className="form-label text-muted mb-1"
                          style={{ fontSize: '11.5px' }}
                        >
                          Domain / URL Website Live
                        </label>
                        <input
                          type="text"
                          className="notion-input w-100"
                          placeholder="contoh: luminadental.id"
                          value={renewalForm.domain}
                          onChange={(e) =>
                            setRenewalForm((prev) => ({
                              ...prev,
                              domain: e.target.value,
                            }))
                          }
                        />
                      </div>

                      {renewalForm.management_type !== 'project_only' && (
                        <div className="col-sm-6">
                          <label
                            className="form-label text-muted mb-1"
                            style={{ fontSize: '11.5px' }}
                          >
                            Siklus Tagihan
                          </label>
                          <select
                            className="notion-select w-100"
                            value={renewalForm.renewal_cycle}
                            onChange={(e) =>
                              setRenewalForm((prev) => ({
                                ...prev,
                                renewal_cycle: e.target.value,
                              }))
                            }
                          >
                            {RENEWAL_CYCLES.map((c) => (
                              <option key={c.value} value={c.value}>
                                {c.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>

                    {renewalForm.management_type !== 'project_only' && (
                      <>
                        <div className="mb-2">
                          <label
                            className="form-label text-muted mb-1"
                            style={{ fontSize: '11.5px' }}
                          >
                            Nama Paket Layanan Perpanjangan
                          </label>
                          <input
                            type="text"
                            className="notion-input w-100"
                            placeholder="Perpanjangan Domain .ID + Cloud Hosting Tahunan"
                            value={renewalForm.renewal_service_name}
                            onChange={(e) =>
                              setRenewalForm((prev) => ({
                                ...prev,
                                renewal_service_name: e.target.value,
                              }))
                            }
                          />
                        </div>

                        <div className="row g-2 mb-3">
                          <div className="col-sm-4">
                            <label
                              className="form-label text-muted mb-1"
                              style={{ fontSize: '11.5px' }}
                            >
                              Jatuh Tempo Berikutnya
                            </label>
                            <input
                              type="date"
                              className="notion-input w-100"
                              value={renewalForm.renewal_due_date}
                              onChange={(e) =>
                                setRenewalForm((prev) => ({
                                  ...prev,
                                  renewal_due_date: e.target.value,
                                }))
                              }
                            />
                          </div>

                          <div className="col-sm-4">
                            <label
                              className="form-label text-muted mb-1"
                              style={{ fontSize: '11.5px' }}
                            >
                              Harga Tagihan ({editingRenewalClient.currency || 'IDR'})
                            </label>
                            <input
                              type="number"
                              min="0"
                              step="any"
                              className="notion-input w-100"
                              value={renewalForm.renewal_price}
                              onChange={(e) =>
                                setRenewalForm((prev) => ({
                                  ...prev,
                                  renewal_price: e.target.value,
                                }))
                              }
                            />
                          </div>

                          <div className="col-sm-4">
                            <label
                              className="form-label text-muted mb-1"
                              style={{ fontSize: '11.5px' }}
                            >
                              Modal Provider ({editingRenewalClient.currency || 'IDR'})
                            </label>
                            <input
                              type="number"
                              min="0"
                              step="any"
                              className="notion-input w-100"
                              value={renewalForm.renewal_cost}
                              onChange={(e) =>
                                setRenewalForm((prev) => ({
                                  ...prev,
                                  renewal_cost: e.target.value,
                                }))
                              }
                            />
                          </div>
                        </div>

                        {/* Preview Laba Bersih Studio */}
                        <div
                          className="p-2 rounded mb-3 d-flex align-items-center justify-content-between"
                          style={{
                            backgroundColor: '#f0fdf4',
                            border: '1px solid #bbf7d0',
                            fontSize: '12.5px',
                          }}
                        >
                          <span className="text-success fw-medium">
                            Estimasi Laba Bersih Studio per Siklus (100% Kas Studio):
                          </span>
                          <span className="fw-bold text-success">
                            {formatCurrency(
                              Math.max(
                                0,
                                (Number(renewalForm.renewal_price) || 0) -
                                  (Number(renewalForm.renewal_cost) || 0)
                              ),
                              editingRenewalClient.currency || 'IDR'
                            )}
                          </span>
                        </div>
                      </>
                    )}

                    {/* Riwayat Perpanjangan Klien Ini */}
                    {Array.isArray(editingRenewalClient.renewal_history) &&
                      editingRenewalClient.renewal_history.length > 0 && (
                        <div>
                          <div
                            className="fw-semibold text-muted mb-1 d-flex align-items-center gap-1"
                            style={{ fontSize: '11.5px' }}
                          >
                            <History size={12} />
                            <span>
                              Riwayat Pembayaran Perpanjangan (
                              {editingRenewalClient.renewal_history.length}x)
                            </span>
                          </div>
                          <div
                            className="border rounded p-2 bg-light"
                            style={{ maxHeight: '130px', overflowY: 'auto' }}
                          >
                            {editingRenewalClient.renewal_history.map((h) => (
                              <div
                                key={h.id}
                                className="d-flex align-items-center justify-content-between py-1 border-bottom last-border-0"
                                style={{ fontSize: '11.5px' }}
                              >
                                <div>
                                  <span className="fw-semibold">{h.date}</span>{' '}
                                  — <span className="text-muted">{h.note}</span>
                                </div>
                                <span className="fw-bold text-success">
                                  +
                                  {formatCurrency(
                                    h.net_profit,
                                    editingRenewalClient.currency || 'IDR'
                                  )}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                  </div>

                  <div className="modal-footer py-2 px-3 border-top bg-light">
                    <button
                      type="button"
                      className="btn-notion-outline"
                      onClick={() => setEditingRenewalClient(null)}
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      className="btn-notion-primary"
                      disabled={savingRenewalConfig}
                    >
                      {savingRenewalConfig
                        ? 'Menyimpan...'
                        : 'Simpan Pengaturan Langganan'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Modal Tambah Klien Deal */}
      <AddProspectModal
        isOpen={isAddDealOpen}
        onClose={() => setIsAddDealOpen(false)}
        onAdd={addProspect}
        defaultStatus="Deal"
      />

      {/* Side-Peek Detail Drawer */}
      <ProspectDetailDrawer
        prospect={selectedDeal}
        onClose={() => setSelectedDealId(null)}
        onSave={updateProspect}
        onDelete={async (id) => {
          await deleteProspect(id);
          setSelectedDealId(null);
        }}
      />

      {/* Invoice Generator Modal */}
      <InvoiceModal
        isOpen={Boolean(invoiceModalState.client)}
        client={invoiceModalState.client}
        initialInvoiceType={invoiceModalState.initialType}
        onClose={() => setInvoiceModalState({ client: null, initialType: null })}
      />

      {/* Business Analytics Modal */}
      <AnalyticsModal
        isOpen={isAnalyticsOpen}
        onClose={() => setIsAnalyticsOpen(false)}
        prospects={allTeamProspects || prospects}
        dealClients={dealClients}
      />
    </div>
  );
}
