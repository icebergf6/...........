import React, { useState, useMemo } from 'react';
import {
  Briefcase,
  Users,
  UserCheck,
  Wallet,
  DollarSign,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  Layers,
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  AlertCircle,
  Plus,
  Edit3,
  Sliders,
  Check,
  X,
  RefreshCw,
  Coins,
  ArrowUpRight,
  User,
  Sparkles,
  Percent,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useProspects } from '../context/ProspectsContext';
import {
  DELIVERY_CHECKLIST_ITEMS,
  formatCurrency,
  formatRupiah,
  sanitizeSafeUrl,
  normalizeWhatsAppNumber,
  getStudioSettings,
  exportToCSV,
} from '../lib/supabase';

export default function ProductionRevenuePage() {
  const { profile, teamUsers, user } = useAuth();
  const { dealClients, updateProspect, loading } = useProspects();

  // Search & Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [workModeFilter, setWorkModeFilter] = useState('ALL'); // 'ALL' | 'solo' | 'collab' | 'delegated'
  const [pipelineFilter, setPipelineFilter] = useState('ALL'); // 'ALL' | 'briefing' | 'design' | 'development' | 'review' | 'completed'
  const [payoutFilter, setPayoutFilter] = useState('ALL'); // 'ALL' | 'all_paid' | 'pending_hunter' | 'pending_dev'

  // Modal State for Project Assignment & Revenue Sharing Setup
  const [editingDeal, setEditingDeal] = useState(null);
  const [editForm, setEditForm] = useState({
    work_mode: 'solo', // 'solo' | 'collab' | 'delegated'
    selected_devs: [], // Array of usernames
    hunter_rate: 15, // percent
    dev_rate: 50, // percent
    studio_rate: 35, // percent
    dev_admin_split: 50, // percent of dev share for Admin if collab
    hunter_paid: false,
    dev_paid: false,
    project_status: 'briefing',
    staging_url: '',
    live_url: '',
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
    notes: '',
  });

  const [saving, setSaving] = useState(false);
  const [actionFeedback, setActionFeedback] = useState('');

  function showFeedback(msg) {
    setActionFeedback(msg);
    setTimeout(() => setActionFeedback(''), 3500);
  }

  // List of active non-admin & admin team members for assignment
  const availableTeamMembers = useMemo(() => {
    return (teamUsers || []).filter(
      (u) => u.status !== 'banned' && u.status !== 'inactive'
    );
  }, [teamUsers]);

  // Open Edit & Revenue Split Modal
  function handleOpenEditModal(deal) {
    const assets = deal.delivery_assets || {};
    const comm = deal.commission || {};

    const workMode = comm.work_mode || (deal.project_assignee ? (deal.project_assignee.includes('&') ? 'collab' : (deal.project_assignee.toLowerCase() === (profile?.username || 'admin').toLowerCase() ? 'solo' : 'delegated')) : 'solo');

    // Parse assignees
    let selectedDevs = [];
    if (Array.isArray(comm.dev_assignees) && comm.dev_assignees.length > 0) {
      selectedDevs = comm.dev_assignees;
    } else if (deal.project_assignee) {
      selectedDevs = deal.project_assignee
        .split('&')
        .map((s) => s.replace('@', '').trim())
        .filter((s) => s.toLowerCase() !== (profile?.username || 'admin').toLowerCase());
    }

    const hunterRatePct = comm.hunter_rate !== undefined ? Math.round(Number(comm.hunter_rate) * 100) : 15;
    const devRatePct = comm.dev_rate !== undefined ? Math.round(Number(comm.dev_rate) * 100) : 50;
    const studioRatePct = comm.studio_rate !== undefined ? Math.round(Number(comm.studio_rate) * 100) : Math.max(0, 100 - hunterRatePct - devRatePct);

    setEditForm({
      work_mode: workMode,
      selected_devs: selectedDevs,
      hunter_rate: hunterRatePct,
      dev_rate: devRatePct,
      studio_rate: studioRatePct,
      dev_admin_split: comm.dev_admin_split !== undefined ? Math.round(Number(comm.dev_admin_split) * 100) : 50,
      hunter_paid: comm.hunter_paid || comm.status === 'paid',
      dev_paid: comm.dev_paid || false,
      project_status: deal.project_status || 'briefing',
      staging_url: assets.staging_url || '',
      live_url: assets.live_url || '',
      credentials: assets.credentials || '',
      revision_count: Number(assets.revision_count) || 0,
      max_revisions: Number(assets.max_revisions) || 3,
      checklist: {
        content: Boolean(assets.checklist?.content),
        wireframe: Boolean(assets.checklist?.wireframe),
        ui_design: Boolean(assets.checklist?.ui_design),
        code: Boolean(assets.checklist?.code),
        qc: Boolean(assets.checklist?.qc),
        live: Boolean(assets.checklist?.live),
      },
      notes: deal.notes || '',
    });
    setEditingDeal(deal);
  }

  // Handle Quick Toggle Payout Status directly from row
  async function handleToggleHunterPayout(deal) {
    const comm = deal.commission || {};
    const currentlyPaid = Boolean(comm.hunter_paid || comm.status === 'paid');
    const nextPaid = !currentlyPaid;

    const nextCommission = {
      ...comm,
      hunter_paid: nextPaid,
      hunter_status: nextPaid ? 'paid' : 'unpaid',
      hunter_paid_at: nextPaid ? new Date().toISOString() : null,
      status: nextPaid ? 'paid' : 'unpaid', // sync with legacy commission.status
    };

    try {
      await updateProspect(deal.id, {
        commission: nextCommission,
      });
      showFeedback(`Status komisi hunter untuk "${deal.client_name}" ditandai: ${nextPaid ? 'Lunas Dibayar ✓' : 'Belum Cair'}`);
    } catch (err) {
      alert('Gagal mengubah status komisi hunter: ' + (err.message || 'Error'));
    }
  }

  async function handleToggleDevPayout(deal) {
    const comm = deal.commission || {};
    const currentlyPaid = Boolean(comm.dev_paid);
    const nextPaid = !currentlyPaid;

    const nextCommission = {
      ...comm,
      dev_paid: nextPaid,
      dev_status: nextPaid ? 'paid' : 'unpaid',
      dev_paid_at: nextPaid ? new Date().toISOString() : null,
    };

    try {
      await updateProspect(deal.id, {
        commission: nextCommission,
      });
      showFeedback(`Status bagi hasil developer untuk "${deal.client_name}" ditandai: ${nextPaid ? 'Lunas Dibayar ✓' : 'Belum Cair'}`);
    } catch (err) {
      alert('Gagal mengubah status bagi hasil developer: ' + (err.message || 'Error'));
    }
  }

  // Quick Checklist Stage Toggle on Table Row
  async function handleToggleChecklistStage(deal, stageKey) {
    const assets = deal.delivery_assets || {};
    const checklist = assets.checklist || {};
    const nextChecklist = {
      ...checklist,
      [stageKey]: !checklist[stageKey],
    };

    const nextAssets = {
      ...assets,
      checklist: nextChecklist,
    };

    // Auto promote project_status if stages complete
    let nextStatus = deal.project_status || 'briefing';
    if (nextChecklist.live) nextStatus = 'completed';
    else if (nextChecklist.qc) nextStatus = 'review';
    else if (nextChecklist.code) nextStatus = 'development';
    else if (nextChecklist.ui_design) nextStatus = 'design';

    try {
      await updateProspect(deal.id, {
        delivery_assets: nextAssets,
        project_status: nextStatus,
      });
    } catch (err) {
      console.error('Failed to update stage:', err);
    }
  }

  // Save Modal Form
  async function handleSaveDealSettings(e) {
    e.preventDefault();
    if (!editingDeal) return;
    setSaving(true);

    try {
      // Build Assignee string
      const adminUname = profile?.username || 'admin';
      let assigneeStr = '';
      if (editForm.work_mode === 'solo') {
        assigneeStr = `@${adminUname}`;
      } else if (editForm.work_mode === 'collab') {
        const teamDevs = editForm.selected_devs.map((d) => `@${d}`).join(' & ');
        assigneeStr = `@${adminUname}${teamDevs ? ' & ' + teamDevs : ''}`;
      } else {
        // delegated
        assigneeStr = editForm.selected_devs.map((d) => `@${d}`).join(' & ') || '@tim';
      }

      // Calculate amounts
      const projectVal = Number(editingDeal.project_value) || 0;
      const dpAmt = Number(editingDeal.dp_amount) || 0;
      const cashIn = editingDeal.payment_status === 'Lunas' ? projectVal : dpAmt;

      const hunterRateDecimal = (Number(editForm.hunter_rate) || 0) / 100;
      const devRateDecimal = (Number(editForm.dev_rate) || 0) / 100;
      const studioRateDecimal = (Number(editForm.studio_rate) || 0) / 100;

      const hunterAmtTotal = Math.round(projectVal * hunterRateDecimal);
      const hunterAmtCash = Math.round(cashIn * hunterRateDecimal);

      const devAmtTotal = Math.round(projectVal * devRateDecimal);
      const devAmtCash = Math.round(cashIn * devRateDecimal);

      const studioAmtTotal = Math.round(projectVal * studioRateDecimal);
      const studioAmtCash = Math.round(cashIn * studioRateDecimal);

      const updatedCommission = {
        work_mode: editForm.work_mode,
        hunter_username: editingDeal.created_by_username || 'tim',
        hunter_rate: hunterRateDecimal,
        hunter_amount: hunterAmtTotal,
        hunter_cash_in: hunterAmtCash,
        hunter_paid: editForm.hunter_paid,
        hunter_status: editForm.hunter_paid ? 'paid' : 'unpaid',
        dev_assignees: editForm.selected_devs,
        dev_rate: devRateDecimal,
        dev_amount: devAmtTotal,
        dev_cash_in: devAmtCash,
        dev_admin_split: (Number(editForm.dev_admin_split) || 50) / 100,
        dev_paid: editForm.dev_paid,
        dev_status: editForm.dev_paid ? 'paid' : 'unpaid',
        studio_rate: studioRateDecimal,
        studio_amount: studioAmtTotal,
        studio_cash_in: studioAmtCash,
        status: editForm.hunter_paid ? 'paid' : 'unpaid',
        updated_at: new Date().toISOString(),
      };

      const updatedAssets = {
        ...(editingDeal.delivery_assets || {}),
        staging_url: editForm.staging_url.trim(),
        live_url: editForm.live_url.trim(),
        credentials: editForm.credentials.trim(),
        revision_count: Number(editForm.revision_count) || 0,
        max_revisions: Number(editForm.max_revisions) || 3,
        checklist: editForm.checklist,
      };

      await updateProspect(editingDeal.id, {
        project_assignee: assigneeStr,
        project_status: editForm.project_status,
        commission: updatedCommission,
        delivery_assets: updatedAssets,
        notes: editForm.notes,
      });

      showFeedback(`Pengaturan penugasan & bagi hasil untuk "${editingDeal.client_name}" berhasil disimpan!`);
      setEditingDeal(null);
    } catch (err) {
      alert('Gagal menyimpan pengaturan: ' + (err.message || 'Error'));
    } finally {
      setSaving(false);
    }
  }

  // Filter Projects
  const filteredProjects = useMemo(() => {
    return dealClients.filter((d) => {
      // 1. Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const clientMatch = (d.client_name || '').toLowerCase().includes(q);
        const hunterMatch = (d.created_by_username || '').toLowerCase().includes(q);
        const assigneeMatch = (d.project_assignee || '').toLowerCase().includes(q);
        const domainMatch = (d.delivery_assets?.domain || '').toLowerCase().includes(q);
        if (!clientMatch && !hunterMatch && !assigneeMatch && !domainMatch) return false;
      }

      // 2. Work Mode Filter
      const comm = d.commission || {};
      const currentMode = comm.work_mode || (d.project_assignee?.includes('&') ? 'collab' : (d.project_assignee?.toLowerCase() === (profile?.username || 'admin').toLowerCase() ? 'solo' : 'delegated'));
      if (workModeFilter !== 'ALL' && currentMode !== workModeFilter) {
        return false;
      }

      // 3. Pipeline Filter
      const curStatus = d.project_status || 'briefing';
      if (pipelineFilter !== 'ALL' && curStatus !== pipelineFilter) {
        return false;
      }

      // 4. Payout Filter
      const isHunterPaid = Boolean(comm.hunter_paid || comm.status === 'paid');
      const isDevPaid = Boolean(comm.dev_paid);
      if (payoutFilter === 'all_paid' && (!isHunterPaid || !isDevPaid)) return false;
      if (payoutFilter === 'pending_hunter' && isHunterPaid) return false;
      if (payoutFilter === 'pending_dev' && isDevPaid) return false;

      return true;
    });
  }, [dealClients, searchQuery, workModeFilter, pipelineFilter, payoutFilter, profile?.username]);

  // Aggregate Financial Statistics
  const stats = useMemo(() => {
    let totalContractIDR = 0;
    let totalCashInIDR = 0;
    let totalHunterPayoutIDR = 0;
    let totalHunterPaidIDR = 0;
    let totalDevPayoutIDR = 0;
    let totalDevPaidIDR = 0;
    let totalStudioTreasuryIDR = 0;

    dealClients.forEach((d) => {
      const isIDR = (d.currency || 'IDR') === 'IDR';
      const pVal = Number(d.project_value) || 0;
      const dpAmt = Number(d.dp_amount) || 0;
      const cashIn = d.payment_status === 'Lunas' ? pVal : dpAmt;

      // Rate defaults
      const comm = d.commission || {};
      const hRate = comm.hunter_rate !== undefined ? Number(comm.hunter_rate) : 0.15;
      const dRate = comm.dev_rate !== undefined ? Number(comm.dev_rate) : 0.50;
      const sRate = comm.studio_rate !== undefined ? Number(comm.studio_rate) : Math.max(0, 1 - hRate - dRate);

      if (isIDR) {
        totalContractIDR += pVal;
        totalCashInIDR += cashIn;

        const hAmt = Math.round(cashIn * hRate);
        const dAmt = Math.round(cashIn * dRate);
        const sAmt = Math.round(cashIn * sRate);

        totalHunterPayoutIDR += hAmt;
        if (comm.hunter_paid || comm.status === 'paid') totalHunterPaidIDR += hAmt;

        totalDevPayoutIDR += dAmt;
        if (comm.dev_paid) totalDevPaidIDR += dAmt;

        totalStudioTreasuryIDR += sAmt;
      }
    });

    return {
      totalContractIDR,
      totalCashInIDR,
      totalHunterPayoutIDR,
      totalHunterPaidIDR,
      totalHunterPendingIDR: Math.max(0, totalHunterPayoutIDR - totalHunterPaidIDR),
      totalDevPayoutIDR,
      totalDevPaidIDR,
      totalDevPendingIDR: Math.max(0, totalDevPayoutIDR - totalDevPaidIDR),
      totalStudioTreasuryIDR,
    };
  }, [dealClients]);

  // Export to CSV
  function handleExportProductionCSV() {
    exportToCSV('laporan-produksi-dan-bagi-hasil-deal', filteredProjects, [
      { header: 'Klien', key: 'client_name' },
      { header: 'Hunter Penginput', key: 'created_by_username' },
      { header: 'Nilai Kontrak', transform: (r) => `${r.currency || 'IDR'} ${r.project_value}` },
      { header: 'Kas Masuk', transform: (r) => `${r.currency || 'IDR'} ${r.payment_status === 'Lunas' ? r.project_value : r.dp_amount}` },
      { header: 'Status Pembayaran', key: 'payment_status' },
      { header: 'Mode Penugasan', transform: (r) => r.commission?.work_mode || 'solo' },
      { header: 'Tim Eksekutor (Assignee)', key: 'project_assignee' },
      { header: 'Status Delivery', key: 'project_status' },
      { header: 'Komisi Hunter (%)', transform: (r) => `${Math.round((r.commission?.hunter_rate ?? 0.15) * 100)}%` },
      { header: 'Status Komisi Hunter', transform: (r) => r.commission?.hunter_paid ? 'Lunas Paid' : 'Belum Cair' },
      { header: 'Bagi Hasil Dev (%)', transform: (r) => `${Math.round((r.commission?.dev_rate ?? 0.50) * 100)}%` },
      { header: 'Status Bagi Hasil Dev', transform: (r) => r.commission?.dev_paid ? 'Lunas Paid' : 'Belum Cair' },
      { header: 'Kas Studio (%)', transform: (r) => `${Math.round((r.commission?.studio_rate ?? 0.35) * 100)}%` },
    ]);
  }

  return (
    <div>
      {/* Feedback Toast */}
      {actionFeedback && (
        <div
          className="position-fixed bottom-0 end-0 m-4 p-3 bg-dark text-white rounded-3 shadow-lg d-flex align-items-center gap-2"
          style={{ zIndex: 1090, fontSize: '13px', animation: 'fadeIn 0.2s ease' }}
        >
          <CheckCircle2 size={16} className="text-success" />
          <span>{actionFeedback}</span>
        </div>
      )}

      {/* Header Halaman */}
      <div className="d-flex flex-wrap align-items-start justify-content-between gap-3 mb-4">
        <div>
          <div className="d-flex flex-wrap align-items-center gap-2 mb-1">
            <span
              className="p-2 rounded-2 d-inline-flex align-items-center justify-content-center"
              style={{ backgroundColor: '#fef3c7', color: '#92400e' }}
            >
              <Coins size={20} />
            </span>
            <h1 className="notion-page-title mb-0">Produksi &amp; Bagi Hasil Deal</h1>
            <span className="notion-pill" style={{ backgroundColor: '#eff6ff', color: '#1d4ed8' }}>
              ● Admin Hub v2.5
            </span>
          </div>
          <p className="notion-page-subtitle mb-0">
            Pusat penugasan eksekusi website (Admin Sendiri, Kolaborasi, atau Delegasi Tim), pelacakan progres 6 tahap pengerjaan, dan pembagian komisi hunter vs developer secara dinamis per-deal.
          </p>
        </div>

        <div className="d-flex align-items-center gap-2">
          <button
            type="button"
            className="btn-notion-outline"
            onClick={handleExportProductionCSV}
            title="Download laporan pengerjaan & komisi ke CSV"
          >
            Export Laporan CSV
          </button>
        </div>
      </div>

      {/* KPI Cards: Revenue Sharing Overview */}
      <div className="row g-3 mb-4">
        <div className="col-sm-6 col-lg-3">
          <div className="notion-card h-100" style={{ backgroundColor: '#f8fafc', borderColor: '#cbd5e1' }}>
            <div className="notion-stat-label">
              <Briefcase size={14} className="text-primary" />
              <span>Total Kontrak &amp; Kas Masuk</span>
            </div>
            <div className="notion-stat-value">
              {formatRupiah(stats.totalCashInIDR)}
            </div>
            <div className="text-muted mt-1" style={{ fontSize: '11.5px' }}>
              Dari total kontrak {formatRupiah(stats.totalContractIDR)} ({dealClients.length} Proyek Deal)
            </div>
          </div>
        </div>

        <div className="col-sm-6 col-lg-3">
          <div className="notion-card h-100" style={{ backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' }}>
            <div className="notion-stat-label" style={{ color: '#166534' }}>
              <Users size={14} />
              <span>Komisi Sales Hunter</span>
            </div>
            <div className="notion-stat-value" style={{ color: '#166534' }}>
              {formatRupiah(stats.totalHunterPayoutIDR)}
            </div>
            <div className="d-flex align-items-center gap-2 mt-1" style={{ fontSize: '11.5px' }}>
              <span className="text-success fw-semibold">✓ Cair: {formatRupiah(stats.totalHunterPaidIDR)}</span>
              {stats.totalHunterPendingIDR > 0 && (
                <span className="text-warning-emphasis">⏳ Pending: {formatRupiah(stats.totalHunterPendingIDR)}</span>
              )}
            </div>
          </div>
        </div>

        <div className="col-sm-6 col-lg-3">
          <div className="notion-card h-100" style={{ backgroundColor: '#eff6ff', borderColor: '#bfdbfe' }}>
            <div className="notion-stat-label" style={{ color: '#1e40af' }}>
              <Sliders size={14} />
              <span>Bagi Hasil Pengerjaan Web (Dev)</span>
            </div>
            <div className="notion-stat-value" style={{ color: '#1e3a8a' }}>
              {formatRupiah(stats.totalDevPayoutIDR)}
            </div>
            <div className="d-flex align-items-center gap-2 mt-1" style={{ fontSize: '11.5px' }}>
              <span className="text-primary fw-semibold">✓ Cair: {formatRupiah(stats.totalDevPaidIDR)}</span>
              {stats.totalDevPendingIDR > 0 && (
                <span className="text-warning-emphasis">⏳ Pending: {formatRupiah(stats.totalDevPendingIDR)}</span>
              )}
            </div>
          </div>
        </div>

        <div className="col-sm-6 col-lg-3">
          <div className="notion-card h-100" style={{ backgroundColor: '#fffbeb', borderColor: '#fde68a' }}>
            <div className="notion-stat-label" style={{ color: '#92400e' }}>
              <Wallet size={14} />
              <span>Alokasi Cadangan Kas Studio</span>
            </div>
            <div className="notion-stat-value" style={{ color: '#92400e' }}>
              {formatRupiah(stats.totalStudioTreasuryIDR)}
            </div>
            <div className="mt-1" style={{ fontSize: '11.5px', color: '#b45309' }}>
              Net margin operasional studio setelah hunter &amp; developer
            </div>
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="notion-card mb-4">
        <div className="d-flex flex-wrap align-items-center justify-content-between gap-3">
          <div className="position-relative flex-grow-1" style={{ maxWidth: '320px' }}>
            <Search
              size={14}
              className="position-absolute text-muted"
              style={{ top: '50%', left: '10px', transform: 'translateY(-50%)' }}
            />
            <input
              type="text"
              className="notion-input w-100 ps-4"
              placeholder="Cari klien, hunter, dev eksekutor..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="d-flex flex-wrap align-items-center gap-2">
            {/* Filter Mode Penugasan */}
            <select
              className="notion-select"
              value={workModeFilter}
              onChange={(e) => setWorkModeFilter(e.target.value)}
              style={{ fontSize: '12px' }}
            >
              <option value="ALL">Semua Mode Kerja</option>
              <option value="solo">🛠️ Hanya Admin (Kerja Sendiri)</option>
              <option value="collab">🤝 Kolaborasi (Admin + Tim)</option>
              <option value="delegated">👥 Delegasi Penuh (Tim Pilihan)</option>
            </select>

            {/* Filter Pipeline */}
            <select
              className="notion-select"
              value={pipelineFilter}
              onChange={(e) => setPipelineFilter(e.target.value)}
              style={{ fontSize: '12px' }}
            >
              <option value="ALL">Semua Tahap Proyek</option>
              <option value="briefing">1. Briefing &amp; Konten</option>
              <option value="design">2. Desain Visual &amp; UI</option>
              <option value="development">3. Coding &amp; Integrasi</option>
              <option value="review">4. Review &amp; Revisi</option>
              <option value="completed">5. Live &amp; Handover</option>
            </select>

            {/* Filter Payout */}
            <select
              className="notion-select"
              value={payoutFilter}
              onChange={(e) => setPayoutFilter(e.target.value)}
              style={{ fontSize: '12px' }}
            >
              <option value="ALL">Semua Status Pencairan</option>
              <option value="pending_hunter">⏳ Komisi Hunter Belum Cair</option>
              <option value="pending_dev">⏳ Bagi Hasil Dev Belum Cair</option>
              <option value="all_paid">✓ Semua Sudah Cair (Lunas)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Desktop View: Tabel Proyek Deal, Penugasan & Bagi Hasil (Screens >= 768px) */}
      <div className="notion-table-wrapper mb-4 d-none d-md-block">
        <div className="table-responsive">
          <table className="notion-table">
            <thead>
              <tr>
                <th style={{ minWidth: '220px' }}>Klien &amp; Info Hunter Asal</th>
                <th style={{ minWidth: '190px' }}>Penugasan Pengerjaan (PIC Web)</th>
                <th style={{ minWidth: '240px' }}>Progres 6-Tahap &amp; Revisi</th>
                <th style={{ minWidth: '220px' }}>Kalkulator Bagi Hasil (Hunter / Dev / Studio)</th>
                <th style={{ minWidth: '160px', textAlign: 'right' }}>Aksi Pencairan &amp; Edit</th>
              </tr>
            </thead>
            <tbody>
              {filteredProjects.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-5 text-muted">
                    Tidak ada proyek deal yang cocok dengan kriteria filter saat ini.
                  </td>
                </tr>
              ) : (
                filteredProjects.map((deal) => {
                  const comm = deal.commission || {};
                  const assets = deal.delivery_assets || {};
                  const checklist = assets.checklist || {};
                  const completedStages = DELIVERY_CHECKLIST_ITEMS.filter((i) => Boolean(checklist[i.id])).length;
                  const progressPct = Math.round((completedStages / DELIVERY_CHECKLIST_ITEMS.length) * 100);

                  const curCurrency = deal.currency || 'IDR';
                  const projectVal = Number(deal.project_value) || 0;
                  const dpAmt = Number(deal.dp_amount) || 0;
                  const cashIn = deal.payment_status === 'Lunas' ? projectVal : dpAmt;

                  const hRate = comm.hunter_rate !== undefined ? Number(comm.hunter_rate) : 0.15;
                  const dRate = comm.dev_rate !== undefined ? Number(comm.dev_rate) : 0.50;
                  const sRate = comm.studio_rate !== undefined ? Number(comm.studio_rate) : Math.max(0, 1 - hRate - dRate);

                  const hAmt = Math.round(cashIn * hRate);
                  const dAmt = Math.round(cashIn * dRate);
                  const sAmt = Math.round(cashIn * sRate);

                  const isHunterPaid = Boolean(comm.hunter_paid || comm.status === 'paid');
                  const isDevPaid = Boolean(comm.dev_paid);

                  // Detect work mode badge
                  const mode = comm.work_mode || (deal.project_assignee?.includes('&') ? 'collab' : (deal.project_assignee?.toLowerCase() === (profile?.username || 'admin').toLowerCase() ? 'solo' : 'delegated'));

                  return (
                    <tr key={deal.id}>
                      {/* Kolom 1: Klien & Hunter Info */}
                      <td>
                        <div className="fw-bold text-dark" style={{ fontSize: '13.5px' }}>
                          {deal.client_name}
                        </div>
                        <div className="d-flex flex-wrap align-items-center gap-1 mt-1">
                          <span className="notion-pill" style={{ fontSize: '10.5px' }}>
                            {deal.source_platform}
                          </span>
                          <span
                            className={`badge rounded-pill ${
                              deal.payment_status === 'Lunas'
                                ? 'bg-success-subtle text-success border border-success-subtle'
                                : 'bg-warning-subtle text-warning-emphasis border border-warning-subtle'
                            }`}
                            style={{ fontSize: '10px' }}
                          >
                            {deal.payment_status || 'Belum DP'}
                          </span>
                        </div>
                        <div className="text-secondary mt-1" style={{ fontSize: '11.5px' }}>
                          Nilai: <strong>{formatCurrency(projectVal, curCurrency)}</strong>
                          {deal.payment_status !== 'Lunas' && (
                            <span> (DP: {formatCurrency(dpAmt, curCurrency)})</span>
                          )}
                        </div>
                        <div className="mt-1 d-inline-flex align-items-center gap-1 text-muted" style={{ fontSize: '11.5px' }}>
                          <span>Hunter Pembawa:</span>
                          <span className="badge bg-light text-dark border fw-semibold">
                            @{deal.created_by_username || 'tim'}
                          </span>
                        </div>
                      </td>

                      {/* Kolom 2: Penugasan Eksekutor */}
                      <td>
                        <div className="mb-1">
                          {mode === 'solo' && (
                            <span className="badge rounded-pill bg-dark text-white" style={{ fontSize: '10.5px' }}>
                              🛠️ Hanya Admin (Sendiri)
                            </span>
                          )}
                          {mode === 'collab' && (
                            <span className="badge rounded-pill bg-primary-subtle text-primary border border-primary-subtle" style={{ fontSize: '10.5px' }}>
                              🤝 Kolaborasi Admin &amp; Tim
                            </span>
                          )}
                          {mode === 'delegated' && (
                            <span className="badge rounded-pill bg-info-subtle text-info-emphasis border border-info-subtle" style={{ fontSize: '10.5px' }}>
                              👥 Delegasi Penuh ke Tim
                            </span>
                          )}
                        </div>

                        <div className="fw-semibold text-secondary" style={{ fontSize: '12px' }}>
                          PIC: {deal.project_assignee || `@${profile?.username || 'admin'}`}
                        </div>

                        <div className="text-muted mt-1" style={{ fontSize: '11px' }}>
                          Tahap: <span className="text-dark fw-semibold">{deal.project_status || 'briefing'}</span>
                        </div>

                        <button
                          type="button"
                          className="btn-notion-outline py-0 px-2 mt-2"
                          style={{ fontSize: '11px' }}
                          onClick={() => handleOpenEditModal(deal)}
                        >
                          <Edit3 size={11} />
                          <span>Atur Mode &amp; PIC</span>
                        </button>
                      </td>

                      {/* Kolom 3: Progress 6-Tahap & Revisi */}
                      <td>
                        <div className="d-flex align-items-center justify-content-between mb-1" style={{ fontSize: '11.5px' }}>
                          <span className="fw-semibold">Progres: {progressPct}%</span>
                          <span className="text-muted">{completedStages}/6 Selesai</span>
                        </div>
                        <div className="w-100 rounded-pill overflow-hidden mb-2" style={{ height: '6px', backgroundColor: '#e2e8f0' }}>
                          <div
                            style={{
                              width: `${progressPct}%`,
                              height: '100%',
                              backgroundColor: progressPct === 100 ? '#16a34a' : '#2563eb',
                              transition: 'width 0.2s ease',
                            }}
                          />
                        </div>

                        {/* Interactive mini-checkboxes for 6 stages */}
                        <div className="d-flex flex-wrap gap-1 mb-2">
                          {DELIVERY_CHECKLIST_ITEMS.map((item, idx) => {
                            const isDone = Boolean(checklist[item.id]);
                            return (
                              <button
                                key={item.id}
                                type="button"
                                className={`badge border-0 rounded px-1 py-0 ${
                                  isDone ? 'bg-success text-white' : 'bg-light text-muted border'
                                }`}
                                style={{ fontSize: '9.5px', cursor: 'pointer' }}
                                onClick={() => handleToggleChecklistStage(deal, item.id)}
                                title={`Klik untuk centang/batal: ${item.label}`}
                              >
                                {idx + 1}. {item.id} {isDone ? '✓' : ''}
                              </button>
                            );
                          })}
                        </div>

                        <div className="d-flex flex-wrap align-items-center gap-2 text-muted" style={{ fontSize: '11px' }}>
                          <span>Revisi: {assets.revision_count || 0}/{assets.max_revisions || 3}</span>
                          {assets.live_url && (
                            <a
                              href={sanitizeSafeUrl(assets.live_url)}
                              target="_blank"
                              rel="noreferrer"
                              className="text-primary text-decoration-none d-inline-flex align-items-center gap-1"
                            >
                              <span>Live</span>
                              <ExternalLink size={10} />
                            </a>
                          )}
                        </div>
                      </td>

                      {/* Kolom 4: Kalkulator Bagi Hasil */}
                      <td>
                        <div className="d-flex flex-column gap-1" style={{ fontSize: '11.5px' }}>
                          <div className="d-flex align-items-center justify-content-between">
                            <span className="text-muted">
                              Hunter ({Math.round(hRate * 100)}%):
                            </span>
                            <span className="fw-bold text-success">
                              {formatCurrency(hAmt, curCurrency)}
                            </span>
                          </div>

                          <div className="d-flex align-items-center justify-content-between">
                            <span className="text-muted">
                              Dev Web ({Math.round(dRate * 100)}%):
                            </span>
                            <span className="fw-bold text-primary">
                              {formatCurrency(dAmt, curCurrency)}
                            </span>
                          </div>

                          <div className="d-flex align-items-center justify-content-between border-top pt-1 mt-1">
                            <span className="text-muted">
                              Kas Studio ({Math.round(sRate * 100)}%):
                            </span>
                            <span className="fw-bold text-dark">
                              {formatCurrency(sAmt, curCurrency)}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Kolom 5: Aksi Pencairan */}
                      <td style={{ textAlign: 'right' }}>
                        <div className="d-flex flex-column align-items-end gap-1">
                          {/* Tombol Cairkan Hunter */}
                          <button
                            type="button"
                            onClick={() => handleToggleHunterPayout(deal)}
                            className={`btn btn-sm py-0 px-2 d-inline-flex align-items-center gap-1 ${
                              isHunterPaid ? 'btn-success text-white' : 'btn-outline-secondary'
                            }`}
                            style={{ fontSize: '11px' }}
                            title="Klik untuk mengubah status pencairan komisi sales hunter"
                          >
                            {isHunterPaid ? <Check size={11} /> : <Coins size={11} />}
                            <span>Hunter: {isHunterPaid ? 'Cair ✓' : 'Bayar'}</span>
                          </button>

                          {/* Tombol Cairkan Dev */}
                          <button
                            type="button"
                            onClick={() => handleToggleDevPayout(deal)}
                            className={`btn btn-sm py-0 px-2 d-inline-flex align-items-center gap-1 ${
                              isDevPaid ? 'btn-primary text-white' : 'btn-outline-secondary'
                            }`}
                            style={{ fontSize: '11px' }}
                            title="Klik untuk mengubah status pencairan bagi hasil developer/eksekutor"
                          >
                            {isDevPaid ? <Check size={11} /> : <Sliders size={11} />}
                            <span>Dev: {isDevPaid ? 'Cair ✓' : 'Bayar'}</span>
                          </button>

                          <button
                            type="button"
                            className="btn-notion-outline py-0 px-2 mt-1"
                            style={{ fontSize: '11px' }}
                            onClick={() => handleOpenEditModal(deal)}
                          >
                            <span>Detail &amp; Setup &rarr;</span>
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

      {/* Mobile View: Hybrid Responsive Cards for Production (Screens < 768px) */}
      <div className="mobile-card-list d-block d-md-none mb-4">
        {filteredProjects.length === 0 ? (
          <div className="notion-card text-center py-4 text-muted">
            Tidak ada proyek deal yang cocok dengan kriteria filter saat ini.
          </div>
        ) : (
          filteredProjects.map((deal) => {
            const comm = deal.commission || {};
            const assets = deal.delivery_assets || {};
            const checklist = assets.checklist || {};
            const completedStages = DELIVERY_CHECKLIST_ITEMS.filter((i) => Boolean(checklist[i.id])).length;
            const progressPct = Math.round((completedStages / DELIVERY_CHECKLIST_ITEMS.length) * 100);

            const curCurrency = deal.currency || 'IDR';
            const projectVal = Number(deal.project_value) || 0;
            const dpAmt = Number(deal.dp_amount) || 0;
            const cashIn = deal.payment_status === 'Lunas' ? projectVal : dpAmt;

            const hRate = comm.hunter_rate !== undefined ? Number(comm.hunter_rate) : 0.15;
            const dRate = comm.dev_rate !== undefined ? Number(comm.dev_rate) : 0.50;
            const sRate = comm.studio_rate !== undefined ? Number(comm.studio_rate) : Math.max(0, 1 - hRate - dRate);

            const hAmt = Math.round(cashIn * hRate);
            const dAmt = Math.round(cashIn * dRate);
            const sAmt = Math.round(cashIn * sRate);

            const isHunterPaid = Boolean(comm.hunter_paid || comm.status === 'paid');
            const isDevPaid = Boolean(comm.dev_paid);
            const mode = comm.work_mode || (deal.project_assignee?.includes('&') ? 'collab' : (deal.project_assignee?.toLowerCase() === (profile?.username || 'admin').toLowerCase() ? 'solo' : 'delegated'));

            return (
              <div
                key={deal.id}
                className="mobile-data-card"
                style={{
                  borderLeft:
                    mode === 'solo'
                      ? '4px solid #16a34a'
                      : mode === 'collab'
                      ? '4px solid #2563eb'
                      : '4px solid #d97706',
                }}
              >
                {/* Header */}
                <div className="mobile-data-card-header">
                  <div className="flex-grow-1 overflow-hidden pe-2">
                    <div className="mobile-data-card-title text-truncate">
                      {deal.client_name}
                    </div>
                    <div className="d-flex flex-wrap align-items-center gap-1 mt-1">
                      {mode === 'solo' && (
                        <span className="notion-pill" style={{ backgroundColor: '#dcfce7', color: '#166534', fontSize: '10px' }}>
                          👨‍💻 Kerjakan Sendiri
                        </span>
                      )}
                      {mode === 'collab' && (
                        <span className="notion-pill" style={{ backgroundColor: '#dbeafe', color: '#1e40af', fontSize: '10px' }}>
                          🤝 Kolaborasi
                        </span>
                      )}
                      {mode === 'delegated' && (
                        <span className="notion-pill" style={{ backgroundColor: '#fef3c7', color: '#92400e', fontSize: '10px' }}>
                          👥 Delegasi Penuh
                        </span>
                      )}
                      <span className="notion-pill pill-other" style={{ fontSize: '10px' }}>
                        {deal.project_assignee || 'Belum Ditugaskan'}
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleOpenEditModal(deal)}
                    className="btn btn-sm btn-light border py-1 px-2 flex-shrink-0"
                    style={{ fontSize: '11.5px' }}
                  >
                    Atur &rarr;
                  </button>
                </div>

                {/* Body */}
                <div className="mobile-data-card-body">
                  {/* Progress Bar 6-Tahap */}
                  <div>
                    <div className="d-flex justify-content-between align-items-center mb-1" style={{ fontSize: '11px' }}>
                      <span className="text-muted">Progres Pengerjaan</span>
                      <span className="fw-bold text-dark">{completedStages}/6 Tahap ({progressPct}%)</span>
                    </div>
                    <div className="progress" style={{ height: '6px' }}>
                      <div
                        className={`progress-bar ${progressPct === 100 ? 'bg-success' : 'bg-primary'}`}
                        style={{ width: `${progressPct}%` }}
                      />
                    </div>
                  </div>

                  {/* Financial & Split Breakdown */}
                  <div className="p-2 rounded bg-light border d-flex justify-content-between align-items-center">
                    <div>
                      <div className="text-muted" style={{ fontSize: '11px' }}>
                        Hunter ({Math.round(hRate * 100)}%)
                      </div>
                      <div className={`fw-bold ${isHunterPaid ? 'text-success' : 'text-dark'}`} style={{ fontSize: '13px' }}>
                        {formatCurrency(hAmt, curCurrency)}
                      </div>
                    </div>

                    <div className="text-center">
                      <div className="text-muted" style={{ fontSize: '11px' }}>
                        Dev ({Math.round(dRate * 100)}%)
                      </div>
                      <div className={`fw-bold ${isDevPaid ? 'text-primary' : 'text-dark'}`} style={{ fontSize: '13px' }}>
                        {formatCurrency(dAmt, curCurrency)}
                      </div>
                    </div>

                    <div className="text-end">
                      <div className="text-muted" style={{ fontSize: '11px' }}>
                        Studio ({Math.round(sRate * 100)}%)
                      </div>
                      <div className="fw-bold text-dark" style={{ fontSize: '13px' }}>
                        {formatCurrency(sAmt, curCurrency)}
                      </div>
                    </div>
                  </div>

                  <div className="d-flex align-items-center justify-content-between text-secondary" style={{ fontSize: '11.5px' }}>
                    <span>
                      Hunter: <strong>@{deal.created_by_username || 'tim'}</strong> ({deal.whatsapp_number || '-'})
                    </span>
                    <span className="text-muted">
                      Kontrak: {formatCurrency(projectVal, curCurrency)}
                    </span>
                  </div>
                </div>

                {/* Footer Payout Toggle Buttons */}
                <div className="mobile-data-card-footer">
                  <div className="d-flex align-items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleToggleHunterPayout(deal)}
                      className={`btn btn-sm py-1 px-2 d-inline-flex align-items-center gap-1 ${
                        isHunterPaid ? 'btn-success text-white' : 'btn-outline-secondary'
                      }`}
                      style={{ fontSize: '11px' }}
                    >
                      {isHunterPaid ? <Check size={11} /> : <Coins size={11} />}
                      <span>Hunter: {isHunterPaid ? 'Cair ✓' : 'Bayar'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleToggleDevPayout(deal)}
                      className={`btn btn-sm py-1 px-2 d-inline-flex align-items-center gap-1 ${
                        isDevPaid ? 'btn-primary text-white' : 'btn-outline-secondary'
                      }`}
                      style={{ fontSize: '11px' }}
                    >
                      {isDevPaid ? <Check size={11} /> : <Sliders size={11} />}
                      <span>Dev: {isDevPaid ? 'Cair ✓' : 'Bayar'}</span>
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleOpenEditModal(deal)}
                    className="btn btn-sm btn-link p-0 text-decoration-none text-muted"
                    style={{ fontSize: '12px' }}
                  >
                    Setup Tim &rarr;
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ===================================================================== */}
      {/* MODAL POPUP: SETUP PENUGASAN, TAHAPAN DELIVERY & BAGI HASIL DINAMIS   */}
      {/* ===================================================================== */}
      {editingDeal && (
        <div className="notion-modal-overlay" onClick={() => setEditingDeal(null)}>
          <div
            className="notion-modal-box"
            style={{ maxWidth: '780px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="d-flex align-items-center justify-content-between pb-3 mb-3 border-bottom">
              <div className="d-flex align-items-center gap-2">
                <span className="p-2 rounded-2 bg-light text-dark">
                  <Coins size={18} />
                </span>
                <div>
                  <h2 className="h6 fw-bold mb-0">
                    Atur Penugasan &amp; Bagi Hasil: {editingDeal.client_name}
                  </h2>
                  <div className="text-muted" style={{ fontSize: '12px' }}>
                    Hunter: @{editingDeal.created_by_username || 'tim'} • Kontrak {formatCurrency(editingDeal.project_value, editingDeal.currency)}
                  </div>
                </div>
              </div>

              <button
                type="button"
                className="btn btn-sm p-1 border-0 bg-transparent text-muted"
                onClick={() => setEditingDeal(null)}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveDealSettings}>
              {/* BAGIAN 1: 3 MODE PENUGASAN EKSEKUTOR WEB */}
              <div className="mb-4">
                <label className="form-label fw-bold mb-2" style={{ fontSize: '13px' }}>
                  1. Pilih Mode Pengerjaan Website (PIC Web)
                </label>
                <div className="row g-2">
                  <div className="col-12 col-md-4">
                    <div
                      className={`p-3 rounded-2 border h-100 ${
                        editForm.work_mode === 'solo' ? 'border-dark bg-light' : 'border'
                      }`}
                      style={{ cursor: 'pointer', transition: 'all 0.15s ease' }}
                      onClick={() => setEditForm((prev) => ({ ...prev, work_mode: 'solo' }))}
                    >
                      <div className="d-flex align-items-center justify-content-between mb-1">
                        <span className="fw-bold" style={{ fontSize: '13px' }}>🛠️ Kerjakan Sendiri</span>
                        <input
                          type="radio"
                          className="form-check-input mt-0"
                          checked={editForm.work_mode === 'solo'}
                          onChange={() => {}}
                        />
                      </div>
                      <div className="text-muted" style={{ fontSize: '11.5px' }}>
                        Hanya Anda (Admin) yang mengeksekusi web ini. 100% alokasi dev masuk ke Anda.
                      </div>
                    </div>
                  </div>

                  <div className="col-12 col-md-4">
                    <div
                      className={`p-3 rounded-2 border h-100 ${
                        editForm.work_mode === 'collab' ? 'border-primary bg-light' : 'border'
                      }`}
                      style={{ cursor: 'pointer', transition: 'all 0.15s ease' }}
                      onClick={() => setEditForm((prev) => ({ ...prev, work_mode: 'collab' }))}
                    >
                      <div className="d-flex align-items-center justify-content-between mb-1">
                        <span className="fw-bold text-primary" style={{ fontSize: '13px' }}>🤝 Kolaborasi</span>
                        <input
                          type="radio"
                          className="form-check-input mt-0"
                          checked={editForm.work_mode === 'collab'}
                          onChange={() => {}}
                        />
                      </div>
                      <div className="text-muted" style={{ fontSize: '11.5px' }}>
                        Admin bersama tim pilihan mengerjakan bersama. Dev share dibagi dua.
                      </div>
                    </div>
                  </div>

                  <div className="col-12 col-md-4">
                    <div
                      className={`p-3 rounded-2 border h-100 ${
                        editForm.work_mode === 'delegated' ? 'border-info bg-light' : 'border'
                      }`}
                      style={{ cursor: 'pointer', transition: 'all 0.15s ease' }}
                      onClick={() => setEditForm((prev) => ({ ...prev, work_mode: 'delegated' }))}
                    >
                      <div className="d-flex align-items-center justify-content-between mb-1">
                        <span className="fw-bold text-dark" style={{ fontSize: '13px' }}>👥 Delegasi Penuh</span>
                        <input
                          type="radio"
                          className="form-check-input mt-0"
                          checked={editForm.work_mode === 'delegated'}
                          onChange={() => {}}
                        />
                      </div>
                      <div className="text-muted" style={{ fontSize: '11.5px' }}>
                        Serahkan penuh ke anggota tim pilihan. 100% dev share masuk ke tim.
                      </div>
                    </div>
                  </div>
                </div>

                {/* Anggota Tim Pilihan (Jika Collab atau Delegated) */}
                {editForm.work_mode !== 'solo' && (
                  <div className="mt-3 p-3 rounded-2 border bg-light">
                    <label className="form-label fw-semibold mb-1" style={{ fontSize: '12px' }}>
                      Pilih Anggota Tim yang Ditugaskan:
                    </label>
                    <div className="d-flex flex-wrap gap-2 mt-1">
                      {availableTeamMembers.map((member) => {
                        const isSelected = editForm.selected_devs.includes(member.username);
                        return (
                          <button
                            key={member.id}
                            type="button"
                            className={`btn btn-sm d-inline-flex align-items-center gap-1 ${
                              isSelected ? 'btn-dark text-white' : 'btn-outline-secondary bg-white'
                            }`}
                            style={{ fontSize: '12px' }}
                            onClick={() => {
                              setEditForm((prev) => {
                                const devs = isSelected
                                  ? prev.selected_devs.filter((u) => u !== member.username)
                                  : [...prev.selected_devs, member.username];
                                return { ...prev, selected_devs: devs };
                              });
                            }}
                          >
                            {isSelected ? <Check size={12} /> : <Plus size={12} />}
                            <span>@{member.username}</span>
                            <span className="text-muted ms-1" style={{ fontSize: '10.5px' }}>
                              ({member.tier || 'Tim'})
                            </span>
                          </button>
                        );
                      })}
                    </div>
                    {editForm.selected_devs.length === 0 && (
                      <div className="text-danger mt-1" style={{ fontSize: '11.5px' }}>
                        * Harap pilih minimal 1 anggota tim untuk mode kolaborasi / delegasi.
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* BAGIAN 2: KALKULATOR DINAMIS REVENUE SPLIT */}
              <div className="mb-4 p-3 rounded-2 border bg-light">
                <div className="d-flex align-items-center justify-content-between mb-2">
                  <label className="form-label fw-bold mb-0" style={{ fontSize: '13px' }}>
                    2. Pengaturan Persentase Komisi &amp; Revenue Sharing Per-Deal
                  </label>
                  <span
                    className={`badge ${
                      Number(editForm.hunter_rate) + Number(editForm.dev_rate) + Number(editForm.studio_rate) === 100
                        ? 'bg-success'
                        : 'bg-danger'
                    }`}
                  >
                    Total: {Number(editForm.hunter_rate) + Number(editForm.dev_rate) + Number(editForm.studio_rate)}%
                  </span>
                </div>

                <div className="row g-3">
                  <div className="col-12 col-md-4">
                    <label className="form-label text-muted mb-1" style={{ fontSize: '11.5px' }}>
                      Komisi Sales Hunter (@{editingDeal.created_by_username || 'tim'})
                    </label>
                    <div className="input-group input-group-sm">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        className="notion-input w-100 fw-bold"
                        value={editForm.hunter_rate}
                        onChange={(e) => {
                          const val = Math.max(0, Math.min(100, Number(e.target.value) || 0));
                          setEditForm((prev) => ({
                            ...prev,
                            hunter_rate: val,
                            studio_rate: Math.max(0, 100 - val - prev.dev_rate),
                          }));
                        }}
                      />
                      <span className="input-group-text">%</span>
                    </div>
                    <div className="text-success mt-1 fw-semibold" style={{ fontSize: '11px' }}>
                      Est: {formatCurrency(Math.round(((Number(editingDeal.project_value) || 0) * editForm.hunter_rate) / 100), editingDeal.currency)}
                    </div>
                  </div>

                  <div className="col-12 col-md-4">
                    <label className="form-label text-muted mb-1" style={{ fontSize: '11.5px' }}>
                      Bagi Hasil Eksekusi Web (Dev)
                    </label>
                    <div className="input-group input-group-sm">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        className="notion-input w-100 fw-bold"
                        value={editForm.dev_rate}
                        onChange={(e) => {
                          const val = Math.max(0, Math.min(100, Number(e.target.value) || 0));
                          setEditForm((prev) => ({
                            ...prev,
                            dev_rate: val,
                            studio_rate: Math.max(0, 100 - prev.hunter_rate - val),
                          }));
                        }}
                      />
                      <span className="input-group-text">%</span>
                    </div>
                    <div className="text-primary mt-1 fw-semibold" style={{ fontSize: '11px' }}>
                      Est: {formatCurrency(Math.round(((Number(editingDeal.project_value) || 0) * editForm.dev_rate) / 100), editingDeal.currency)}
                    </div>
                  </div>

                  <div className="col-12 col-md-4">
                    <label className="form-label text-muted mb-1" style={{ fontSize: '11.5px' }}>
                      Alokasi Cadangan Kas Studio
                    </label>
                    <div className="input-group input-group-sm">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        className="notion-input w-100 fw-bold"
                        value={editForm.studio_rate}
                        onChange={(e) => {
                          const val = Math.max(0, Math.min(100, Number(e.target.value) || 0));
                          setEditForm((prev) => ({ ...prev, studio_rate: val }));
                        }}
                      />
                      <span className="input-group-text">%</span>
                    </div>
                    <div className="text-dark mt-1 fw-semibold" style={{ fontSize: '11px' }}>
                      Est: {formatCurrency(Math.round(((Number(editingDeal.project_value) || 0) * editForm.studio_rate) / 100), editingDeal.currency)}
                    </div>
                  </div>
                </div>

                {/* Status Pencairan Cepat di Modal */}
                <div className="d-flex flex-wrap align-items-center gap-4 mt-3 pt-2 border-top">
                  <div className="form-check form-switch mb-0">
                    <input
                      type="checkbox"
                      className="form-check-input"
                      id="modalHunterPaid"
                      checked={editForm.hunter_paid}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, hunter_paid: e.target.checked }))}
                    />
                    <label className="form-check-label fw-semibold" htmlFor="modalHunterPaid" style={{ fontSize: '12px' }}>
                      Komisi Hunter Sudah Dicairkan (Paid)
                    </label>
                  </div>

                  <div className="form-check form-switch mb-0">
                    <input
                      type="checkbox"
                      className="form-check-input"
                      id="modalDevPaid"
                      checked={editForm.dev_paid}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, dev_paid: e.target.checked }))}
                    />
                    <label className="form-check-label fw-semibold" htmlFor="modalDevPaid" style={{ fontSize: '12px' }}>
                      Bagi Hasil Dev Sudah Dicairkan (Paid)
                    </label>
                  </div>
                </div>
              </div>

              {/* BAGIAN 3: DELIVERY PROGRESS, REVISI & DELIVERABLES */}
              <div className="mb-4">
                <label className="form-label fw-bold mb-2" style={{ fontSize: '13px' }}>
                  3. Tahapan Pengerjaan, Deliverables &amp; Link Website
                </label>

                <div className="row g-3">
                  <div className="col-12 col-md-6">
                    <label className="form-label text-muted mb-1" style={{ fontSize: '11.5px' }}>
                      Tahap Pipeline Delivery
                    </label>
                    <select
                      className="notion-select w-100"
                      value={editForm.project_status}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, project_status: e.target.value }))}
                    >
                      <option value="briefing">1. Briefing &amp; Pengumpulan Materi</option>
                      <option value="design">2. Wireframe &amp; UI Design Visual</option>
                      <option value="development">3. Frontend Coding &amp; Integrasi</option>
                      <option value="review">4. Review &amp; Revisi Klien</option>
                      <option value="completed">5. Live Production &amp; Handover</option>
                    </select>
                  </div>

                  <div className="col-12 col-md-3">
                    <label className="form-label text-muted mb-1" style={{ fontSize: '11.5px' }}>
                      Jumlah Revisi Klien
                    </label>
                    <input
                      type="number"
                      min="0"
                      className="notion-input w-100"
                      value={editForm.revision_count}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, revision_count: Number(e.target.value) || 0 }))}
                    />
                  </div>

                  <div className="col-12 col-md-3">
                    <label className="form-label text-muted mb-1" style={{ fontSize: '11.5px' }}>
                      Batas Maks Revisi
                    </label>
                    <input
                      type="number"
                      min="1"
                      className="notion-input w-100"
                      value={editForm.max_revisions}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, max_revisions: Number(e.target.value) || 3 }))}
                    />
                  </div>

                  <div className="col-12 col-md-6">
                    <label className="form-label text-muted mb-1" style={{ fontSize: '11.5px' }}>
                      Link Staging / Preview Web
                    </label>
                    <input
                      type="text"
                      className="notion-input w-100"
                      placeholder="https://preview.clientweb.com"
                      value={editForm.staging_url}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, staging_url: e.target.value }))}
                    />
                  </div>

                  <div className="col-12 col-md-6">
                    <label className="form-label text-muted mb-1" style={{ fontSize: '11.5px' }}>
                      Live Website URL Klien
                    </label>
                    <input
                      type="text"
                      className="notion-input w-100"
                      placeholder="https://clientbrand.com"
                      value={editForm.live_url}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, live_url: e.target.value }))}
                    />
                  </div>

                  <div className="col-12">
                    <label className="form-label text-muted mb-1" style={{ fontSize: '11.5px' }}>
                      Kredensial Hosting / WP-Admin / Server (Aman &amp; Terisolasi)
                    </label>
                    <textarea
                      rows={2}
                      className="notion-input w-100 font-monospace"
                      style={{ fontSize: '12px' }}
                      placeholder="cPanel / WP-Admin URL, username, password..."
                      value={editForm.credentials}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, credentials: e.target.value }))}
                    />
                  </div>
                </div>
              </div>

              {/* Modal Action Buttons */}
              <div className="d-flex align-items-center justify-content-end gap-2 pt-3 border-top">
                <button
                  type="button"
                  className="btn-notion-outline"
                  onClick={() => setEditingDeal(null)}
                  disabled={saving}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="btn-notion-primary px-4"
                  disabled={saving}
                >
                  {saving ? 'Menyimpan...' : 'Simpan Perubahan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
