import React, { useEffect, useState } from 'react';
import {
  X,
  Globe,
  AtSign,
  Phone,
  CheckCircle2,
  FileText,
  Wallet,
  Trash2,
  ExternalLink,
  Save,
  Calendar,
  UserCheck,
  Bell,
  MessageSquare,
  Layers,
  Link as LinkIcon,
  Check,
  Plus,
  Minus,
  Sparkles,
  ShieldCheck,
  RefreshCw,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import {
  SOCIAL_PLATFORMS,
  PROSPECT_STATUSES,
  PAYMENT_STATUSES,
  RENEWAL_CYCLES,
  DEAL_MANAGEMENT_TYPES,
  getPlatformBadgeClass,
  getStatusBadgeClass,
  formatRupiah,
  formatCurrency,
  getFollowUpBadgeMeta,
  getRenewalStatus,
  getTodayDateString,
  getOffsetDateString,
  DELIVERY_CHECKLIST_ITEMS,
  calculateCommission,
  DEFAULT_COMMISSION_RATES,
  sanitizeSafeUrl,
  normalizeWhatsAppNumber,
} from '../../lib/supabase';

export default function ProspectDetailDrawer({
  prospect,
  onClose,
  onSave,
  onDelete,
}) {
  const { profile } = useAuth();
  const [formData, setFormData] = useState(null);
  const [newTouchpoint, setNewTouchpoint] = useState('');
  const [saving, setSaving] = useState(false);
  const [savedToast, setSavedToast] = useState(false);

  useEffect(() => {
    if (prospect) {
      const canAccessCreds =
        profile?.role === 'admin' ||
        prospect.user_id === profile?.id ||
        (prospect.created_by_username || '').toLowerCase() ===
          (profile?.username || '').toLowerCase() ||
        (Boolean(prospect.project_assignee) &&
          prospect.project_assignee.toLowerCase() ===
            (profile?.username || '').toLowerCase());

      const rawCreds = prospect.delivery_assets?.credentials || '';
      const credsToStore = canAccessCreds ? rawCreds : '';

      setFormData({
        client_name: prospect.client_name || '',
        source_platform: prospect.source_platform || 'Google Maps',
        social_handle: prospect.social_handle || '',
        whatsapp_number: prospect.whatsapp_number || '',
        status: prospect.status || 'Baru',
        management_type:
          prospect.management_type ||
          (prospect.status === 'Deal' && prospect.renewal_enabled === false
            ? 'project_only'
            : 'full_managed'),
        notes: prospect.notes || '',
        currency: prospect.currency || 'IDR',
        project_value: prospect.project_value || 0,
        dp_amount: prospect.dp_amount || 0,
        payment_status: prospect.payment_status || 'Belum DP',
        next_follow_up_date: prospect.next_follow_up_date || '',
        follow_up_notes: Array.isArray(prospect.follow_up_notes)
          ? prospect.follow_up_notes
          : [],
        delivery_assets: prospect.delivery_assets
          ? {
              staging_url: prospect.delivery_assets.staging_url || '',
              live_url: prospect.delivery_assets.live_url || '',
              domain: prospect.delivery_assets.domain || '',
              credentials: credsToStore,
              revision_count: prospect.delivery_assets.revision_count || 0,
              max_revisions: prospect.delivery_assets.max_revisions || 3,
              checklist: {
                content: Boolean(prospect.delivery_assets.checklist?.content),
                wireframe: Boolean(prospect.delivery_assets.checklist?.wireframe),
                ui_design: Boolean(prospect.delivery_assets.checklist?.ui_design),
                code: Boolean(prospect.delivery_assets.checklist?.code),
                qc: Boolean(prospect.delivery_assets.checklist?.qc),
                live: Boolean(prospect.delivery_assets.checklist?.live),
              },
            }
          : {
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
            },
        commission: prospect.commission || {
          hunter_rate: DEFAULT_COMMISSION_RATES.hunter,
          hunter_amount: 0,
          status: 'pending',
          paid_at: null,
        },
        renewal_enabled: prospect.renewal_enabled ?? false,
        renewal_cycle: prospect.renewal_cycle || 'Yearly',
        renewal_service_name:
          prospect.renewal_service_name ||
          'Perpanjangan Domain & Cloud Hosting Tahunan',
        renewal_price: prospect.renewal_price ?? 0,
        renewal_cost: prospect.renewal_cost ?? 0,
        renewal_due_date: prospect.renewal_due_date || '',
        renewal_total_collected: prospect.renewal_total_collected ?? 0,
        renewal_total_net_profit: prospect.renewal_total_net_profit ?? 0,
        renewal_history: Array.isArray(prospect.renewal_history)
          ? prospect.renewal_history
          : [],
      });
      setSavedToast(false);
      setNewTouchpoint('');
    } else {
      setFormData(null);
    }
  }, [prospect]);

  if (!prospect || !formData) return null;

  function handleChange(field, value) {
    setFormData((prev) => {
      const next = { ...prev, [field]: value };
      if (field === 'payment_status' && value === 'Lunas') {
        const val = Number(prev.project_value) || 0;
        if (val > 0) {
          next.dp_amount = val;
        }
      }
      if (field === 'management_type') {
        next.renewal_enabled = value !== 'project_only';
      }
      return next;
    });
  }

  function handleSetFollowUpPreset(days) {
    if (days === 0) {
      handleChange('next_follow_up_date', getTodayDateString());
    } else {
      handleChange('next_follow_up_date', getOffsetDateString(days));
    }
  }

  function handleAddTouchpoint(e) {
    e.preventDefault();
    if (!newTouchpoint.trim()) return;

    const noteItem = {
      id: 'tp-' + Date.now(),
      date: getTodayDateString(),
      note: newTouchpoint.trim(),
      author: profile?.username || prospect.created_by_username || 'tim',
    };

    setFormData((prev) => ({
      ...prev,
      follow_up_notes: [noteItem, ...(prev.follow_up_notes || [])],
    }));
    setNewTouchpoint('');
  }

  function handleDeleteTouchpoint(id) {
    setFormData((prev) => ({
      ...prev,
      follow_up_notes: (prev.follow_up_notes || []).filter((n) => n.id !== id),
    }));
  }

  function handleToggleChecklist(itemKey) {
    setFormData((prev) => {
      const curAssets = prev.delivery_assets || {};
      const curChecklist = curAssets.checklist || {};
      return {
        ...prev,
        delivery_assets: {
          ...curAssets,
          checklist: {
            ...curChecklist,
            [itemKey]: !curChecklist[itemKey],
          },
        },
      };
    });
  }

  function handleDeliveryAssetChange(field, val) {
    setFormData((prev) => ({
      ...prev,
      delivery_assets: {
        ...(prev.delivery_assets || {}),
        [field]: val,
      },
    }));
  }

  function handleRevisionChange(delta) {
    setFormData((prev) => {
      const cur = Number(prev.delivery_assets?.revision_count) || 0;
      const max = Number(prev.delivery_assets?.max_revisions) || 3;
      const nextVal = Math.max(0, Math.min(max, cur + delta));
      return {
        ...prev,
        delivery_assets: {
          ...(prev.delivery_assets || {}),
          revision_count: nextVal,
        },
      };
    });
  }

  const isAdmin = profile?.role === 'admin';
  const isOwner =
    prospect.user_id === profile?.id ||
    (prospect.created_by_username || '').toLowerCase() ===
      (profile?.username || '').toLowerCase();
  const isProjectPic =
    Boolean(prospect.project_assignee) &&
    prospect.project_assignee.toLowerCase() ===
      (profile?.username || '').toLowerCase();
  const canDelete = isAdmin || isOwner;
  const canAccessCredentials = isAdmin || isOwner || isProjectPic;

  function handleDelete() {
    if (!canDelete) {
      alert(
        `Hanya Admin atau pembuat prospek (@${
          prospect.created_by_username || 'tim'
        }) yang memiliki izin untuk menghapus prospek ini.`
      );
      return;
    }
    if (
      window.confirm(
        `Hapus prospek "${formData?.client_name || 'ini'}" dari database tim?`
      )
    ) {
      onDelete(prospect.id);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (saving) return;
    if (!formData.client_name.trim()) return;
    setSaving(true);
    try {
      // Recompute commission state upon save
      const commCalc = calculateCommission(
        formData,
        formData.commission?.hunter_rate || DEFAULT_COMMISSION_RATES.hunter
      );

      const safeDeliveryAssets = {
        ...(formData.delivery_assets || {}),
        credentials: canAccessCredentials
          ? formData.delivery_assets?.credentials || ''
          : prospect.delivery_assets?.credentials || '',
      };

      const updatedData = {
        ...formData,
        delivery_assets: safeDeliveryAssets,
        commission: {
          ...(formData.commission || {}),
          hunter_amount: commCalc.hunterAmount,
          status:
            formData.commission?.status === 'paid'
              ? 'paid'
              : commCalc.status,
        },
      };

      await onSave(prospect.id, updatedData);
      setSavedToast(true);
      setTimeout(() => setSavedToast(false), 2000);
    } finally {
      setSaving(false);
    }
  }

  const cleanWa = normalizeWhatsAppNumber(formData.whatsapp_number);
  const waUrl = cleanWa ? `https://wa.me/${cleanWa}` : null;

  const remainingAmount = Math.max(
    0,
    (Number(formData.project_value) || 0) - (Number(formData.dp_amount) || 0)
  );

  const followUpBadge = getFollowUpBadgeMeta(
    formData.next_follow_up_date,
    formData.status
  );

  // Delivery checklist progress
  const checklistObj = formData.delivery_assets?.checklist || {};
  const completedChecklistCount = DELIVERY_CHECKLIST_ITEMS.filter(
    (item) => checklistObj[item.id]
  ).length;
  const checklistPercent = Math.round(
    (completedChecklistCount / DELIVERY_CHECKLIST_ITEMS.length) * 100
  );

  // Commission calculation
  const commInfo = calculateCommission(
    formData,
    formData.commission?.hunter_rate || DEFAULT_COMMISSION_RATES.hunter
  );

  return (
    <>
      <div className="notion-drawer-backdrop" onClick={onClose} />
      <div className="notion-drawer">
        <div className="notion-drawer-drag-handle d-md-none" />
        <form onSubmit={handleSubmit} className="h-100 d-flex flex-column">
          {/* Top Bar with Creator & Close */}
          <div className="d-flex align-items-center justify-content-between pb-3 mb-3 border-bottom">
            <div className="d-flex align-items-center gap-2">
              <span className="notion-pill pill-other d-inline-flex align-items-center gap-1">
                <UserCheck size={12} />
                <span>Diinput oleh @{prospect.created_by_username || 'tim'}</span>
              </span>
              {savedToast && (
                <span className="badge bg-success text-white py-1 px-2 d-inline-flex align-items-center gap-1 animate__animated animate__fadeIn">
                  <CheckCircle2 size={12} />
                  <span>Tersimpan!</span>
                </span>
              )}
            </div>

            <button
              type="button"
              className="btn btn-sm p-1 text-muted border-0 bg-transparent"
              onClick={onClose}
              title="Tutup (Esc)"
            >
              <X size={18} />
            </button>
          </div>

          {/* Client Title & Main Status */}
          <div className="mb-4">
            <input
              type="text"
              className="form-control border-0 px-0 fw-bold"
              style={{
                fontSize: '22px',
                boxShadow: 'none',
                backgroundColor: 'transparent',
                color: 'var(--notion-text)',
              }}
              value={formData.client_name}
              onChange={(e) => handleChange('client_name', e.target.value)}
              placeholder="Nama Klien atau Bisnis..."
              required
            />

            <div className="d-flex flex-wrap align-items-center gap-2 mt-2">
              {/* Status Switcher */}
              <div className="d-flex align-items-center gap-1">
                <span className="text-muted" style={{ fontSize: '12px' }}>
                  Status:
                </span>
                <select
                  className={`notion-select ${getStatusBadgeClass(
                    formData.status
                  )}`}
                  style={{ fontWeight: 600, padding: '3px 8px' }}
                  value={formData.status}
                  onChange={(e) => handleChange('status', e.target.value)}
                >
                  {PROSPECT_STATUSES.map((st) => (
                    <option key={st.value} value={st.value}>
                      {st.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Source Platform Badge */}
              <div className="d-flex align-items-center gap-1">
                <span className="text-muted" style={{ fontSize: '12px' }}>
                  Platform:
                </span>
                <select
                  className={`notion-select ${getPlatformBadgeClass(
                    formData.source_platform
                  )}`}
                  style={{ fontWeight: 500, padding: '3px 8px' }}
                  value={formData.source_platform}
                  onChange={(e) =>
                    handleChange('source_platform', e.target.value)
                  }
                >
                  {SOCIAL_PLATFORMS.map((sp) => (
                    <option key={sp.value} value={sp.value}>
                      {sp.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Admin Audit Verification Badge */}
              {prospect.verification_status === 'verified' && (
                <span className="badge bg-success-subtle text-success border border-success-subtle px-2 py-1" style={{ fontSize: '11px' }}>
                  ✓ Terverifikasi Admin
                </span>
              )}
              {prospect.verification_status === 'rejected' && (
                <span className="badge bg-danger-subtle text-danger border border-danger-subtle px-2 py-1" style={{ fontSize: '11px' }}>
                  ✕ Ditolak Admin (Perlu Koreksi)
                </span>
              )}
              {prospect.project_status && (
                <span className="badge bg-primary-subtle text-primary border border-primary-subtle px-2 py-1" style={{ fontSize: '11px' }}>
                  PIC Project: {prospect.project_assignee || 'Tim'} • Tahap: {prospect.project_status}
                </span>
              )}
            </div>

            {(prospect.verification_notes || prospect.verification_note) && (
              <div
                className={`mt-2 px-3 py-2 rounded-2 border ${
                  prospect.verification_status === 'rejected'
                    ? 'bg-danger-subtle border-danger-subtle text-danger'
                    : 'bg-light text-secondary'
                }`}
                style={{ fontSize: '11.5px' }}
              >
                <strong>Catatan Audit Admin:</strong>{' '}
                {prospect.verification_notes || prospect.verification_note}
              </div>
            )}
          </div>

          {/* Contact Details */}
          <div
            className="p-3 rounded mb-3"
            style={{
              backgroundColor: '#fafaf9',
              border: '1px solid var(--notion-border)',
            }}
          >
            <div className="row g-2">
              <div className="col-12 col-md-6">
                <label
                  className="form-label text-muted d-flex align-items-center gap-1 mb-1"
                  style={{ fontSize: '11.5px' }}
                >
                  <AtSign size={13} />
                  <span>Akun Sosmed / Nama Profil</span>
                </label>
                <input
                  type="text"
                  className="notion-input w-100"
                  value={formData.social_handle}
                  onChange={(e) => handleChange('social_handle', e.target.value)}
                  placeholder="Contoh: @brand.official atau Link Maps"
                />
              </div>

              <div className="col-12 col-md-6">
                <label
                  className="form-label text-muted d-flex align-items-center justify-content-between mb-1"
                  style={{ fontSize: '11.5px' }}
                >
                  <span className="d-flex align-items-center gap-1">
                    <Phone size={13} />
                    <span>WhatsApp / No Telp</span>
                  </span>
                  {waUrl && (
                    <a
                      href={waUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-success text-decoration-none d-flex align-items-center gap-1"
                      style={{ fontSize: '11px', fontWeight: 500 }}
                    >
                      <span>Buka WA</span>
                      <ExternalLink size={11} />
                    </a>
                  )}
                </label>
                <input
                  type="text"
                  className="notion-input w-100"
                  value={formData.whatsapp_number}
                  onChange={(e) =>
                    handleChange('whatsapp_number', e.target.value)
                  }
                  placeholder="Contoh: 6281234567890"
                />
              </div>
            </div>
          </div>

          {/* SECTION: REMINDER & JADWAL FOLLOW-UP */}
          <div
            className="p-3 rounded mb-3"
            style={{
              backgroundColor: '#ffffff',
              border: '1px solid var(--notion-border)',
            }}
          >
            <div className="d-flex align-items-center justify-content-between mb-2">
              <div className="d-flex align-items-center gap-2">
                <Bell size={15} className="text-primary" />
                <span className="fw-bold" style={{ fontSize: '13px' }}>
                  Jadwal &amp; Reminder Follow-Up
                </span>
              </div>
              {followUpBadge && (
                <span
                  className={`badge rounded-pill ${followUpBadge.pillClass} px-2 py-1`}
                  style={{ fontSize: '11px' }}
                >
                  ● {followUpBadge.label}
                </span>
              )}
            </div>

            {/* Quick Presets */}
            <div className="d-flex flex-wrap gap-1 mb-2">
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary py-1 px-2"
                style={{ fontSize: '11px' }}
                onClick={() => handleSetFollowUpPreset(0)}
              >
                Hari Ini
              </button>
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary py-1 px-2"
                style={{ fontSize: '11px' }}
                onClick={() => handleSetFollowUpPreset(1)}
              >
                Besok
              </button>
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary py-1 px-2"
                style={{ fontSize: '11px' }}
                onClick={() => handleSetFollowUpPreset(3)}
              >
                +3 Hari
              </button>
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary py-1 px-2"
                style={{ fontSize: '11px' }}
                onClick={() => handleSetFollowUpPreset(7)}
              >
                +1 Minggu
              </button>
              {formData.next_follow_up_date && (
                <button
                  type="button"
                  className="btn btn-sm text-danger border-0 p-1 ms-auto"
                  style={{ fontSize: '11px' }}
                  onClick={() => handleChange('next_follow_up_date', '')}
                >
                  Hapus Jadwal
                </button>
              )}
            </div>

            <div className="row g-2 align-items-center">
              <div className="col-12 col-sm-6">
                <input
                  type="date"
                  className="notion-input w-100"
                  value={formData.next_follow_up_date || ''}
                  onChange={(e) =>
                    handleChange('next_follow_up_date', e.target.value)
                  }
                />
              </div>
              <div className="col-12 col-sm-6 text-muted" style={{ fontSize: '11.5px' }}>
                {formData.next_follow_up_date
                  ? `Jadwal follow up: ${formData.next_follow_up_date}`
                  : 'Belum ada tanggal follow-up'}
              </div>
            </div>

            {/* Activity Touchpoints Log */}
            <div className="mt-3 pt-2 border-top">
              <div
                className="fw-semibold text-muted mb-2 d-flex align-items-center gap-1"
                style={{ fontSize: '11.5px' }}
              >
                <MessageSquare size={12} />
                <span>Riwayat Interaksi / Touchpoint ({formData.follow_up_notes.length})</span>
              </div>

              {/* Input New Touchpoint */}
              <div className="d-flex gap-2 mb-2">
                <input
                  type="text"
                  className="notion-input flex-grow-1"
                  placeholder="Catat interaksi: misal 'Kirim portofolio via WA', 'Klien minta telfon'..."
                  value={newTouchpoint}
                  onChange={(e) => setNewTouchpoint(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddTouchpoint(e);
                    }
                  }}
                />
                <button
                  type="button"
                  className="btn-notion-outline py-1 px-2"
                  style={{ fontSize: '11.5px' }}
                  onClick={handleAddTouchpoint}
                  disabled={!newTouchpoint.trim()}
                >
                  <Plus size={13} />
                  <span>Catat</span>
                </button>
              </div>

              {/* List of Touchpoints */}
              {formData.follow_up_notes.length > 0 && (
                <div
                  className="rounded p-2 bg-light border"
                  style={{
                    maxHeight: '130px',
                    overflowY: 'auto',
                    fontSize: '11.5px',
                  }}
                >
                  {formData.follow_up_notes.map((tp) => (
                    <div
                      key={tp.id}
                      className="d-flex align-items-start justify-content-between py-1 border-bottom last-border-0"
                    >
                      <div>
                        <span className="fw-semibold text-dark">@{tp.author || 'tim'}</span>{' '}
                        <span className="text-muted" style={{ fontSize: '10.5px' }}>
                          ({tp.date})
                        </span>
                        <div className="text-secondary">{tp.note}</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteTouchpoint(tp.id)}
                        className="btn btn-sm p-0 text-muted border-0 ms-2"
                        title="Hapus catatan ini"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Deal & Financial Section */}
          <div
            className="p-3 rounded mb-3"
            style={{
              backgroundColor:
                formData.status === 'Deal' ? '#f4fbf7' : '#ffffff',
              border: `1px solid ${
                formData.status === 'Deal'
                  ? '#bbf7d0'
                  : 'var(--notion-border)'
              }`,
            }}
          >
            <div className="d-flex align-items-center justify-content-between mb-2">
              <div className="d-flex align-items-center gap-2">
                <Wallet
                  size={15}
                  className={
                    formData.status === 'Deal'
                      ? 'text-success'
                      : 'text-muted'
                  }
                />
                <span className="fw-bold" style={{ fontSize: '13px' }}>
                  Keuangan Proyek Web Design
                </span>
              </div>

              <div className="d-flex align-items-center gap-1">
                <span className="text-muted" style={{ fontSize: '11.5px' }}>
                  Valuta:
                </span>
                <select
                  className="notion-select fw-semibold"
                  style={{
                    padding: '2px 8px',
                    fontSize: '11px',
                    backgroundColor:
                      formData.currency === 'USD' ? '#e0f2fe' : '#f1f1ef',
                    color:
                      formData.currency === 'USD' ? '#0369a1' : '#37352f',
                  }}
                  value={formData.currency}
                  onChange={(e) => handleChange('currency', e.target.value)}
                >
                  <option value="IDR">IDR (Rp)</option>
                  <option value="USD">USD ($)</option>
                </select>
              </div>
            </div>

            <div className="row g-2">
              <div className="col-6">
                <label
                  className="form-label text-muted mb-1"
                  style={{ fontSize: '11.5px' }}
                >
                  Nilai Kontrak ({formData.currency === 'USD' ? '$' : 'Rp'})
                </label>
                <input
                  type="number"
                  min="0"
                  step={formData.currency === 'USD' ? '10' : '50000'}
                  className="notion-input w-100"
                  value={formData.project_value}
                  onChange={(e) =>
                    handleChange('project_value', e.target.value)
                  }
                />
              </div>
              <div className="col-6">
                <label
                  className="form-label text-muted mb-1"
                  style={{ fontSize: '11.5px' }}
                >
                  DP Masuk ({formData.currency === 'USD' ? '$' : 'Rp'})
                </label>
                <input
                  type="number"
                  min="0"
                  step={formData.currency === 'USD' ? '10' : '50000'}
                  className="notion-input w-100"
                  value={formData.dp_amount}
                  onChange={(e) => handleChange('dp_amount', e.target.value)}
                />
              </div>
              <div className="col-6">
                <label
                  className="form-label text-muted mb-1"
                  style={{ fontSize: '11.5px' }}
                >
                  Status Pembayaran
                </label>
                <select
                  className="notion-select w-100"
                  value={formData.payment_status}
                  onChange={(e) =>
                    handleChange('payment_status', e.target.value)
                  }
                >
                  {PAYMENT_STATUSES.map((ps) => (
                    <option key={ps.value} value={ps.value}>
                      {ps.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-6 d-flex flex-column justify-content-end">
                <div
                  className="p-2 rounded bg-white border"
                  style={{ borderColor: 'var(--notion-border)' }}
                >
                  <div className="text-muted" style={{ fontSize: '11px' }}>
                    Sisa Pelunasan:
                  </div>
                  <div className="fw-bold" style={{ fontSize: '13.5px' }}>
                    {formatCurrency(remainingAmount, formData.currency)}
                  </div>
                </div>
              </div>
            </div>

            {/* Hunter Commission Preview & Tipe Wewenang Manajemen (for Deals) */}
            {formData.status === 'Deal' && (
              <>
                <div
                  className="mt-3 pt-2 border-top d-flex flex-wrap align-items-center justify-content-between gap-2"
                  style={{ fontSize: '11.5px' }}
                >
                  <div>
                    <span className="text-muted">
                      Komisi Hunter ({Math.round((commInfo.hunterRate || 0.15) * 100)}%):{' '}
                    </span>
                    <span className="fw-bold text-success">
                      {formatCurrency(commInfo.hunterAmount, formData.currency)}
                    </span>
                  </div>
                  <div className="text-muted">
                    Kas Studio: {formatCurrency(Math.round(commInfo.cashIn * 0.25), formData.currency)}
                  </div>
                </div>

                {/* Pilihan Tipe Manajemen Klien Deal */}
                <div className="mt-3 pt-2 border-top">
                  <div className="fw-semibold mb-2" style={{ fontSize: '11.5px', color: '#166534' }}>
                    Wewenang Manajemen Website &amp; Hosting:
                  </div>
                  <div className="row g-2">
                    {DEAL_MANAGEMENT_TYPES.map((mt) => {
                      const active = formData.management_type === mt.value;
                      return (
                        <div className="col-12 col-sm-6" key={mt.value}>
                          <div
                            role="button"
                            tabIndex={0}
                            onClick={() => handleChange('management_type', mt.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                handleChange('management_type', mt.value);
                              }
                            }}
                            className="p-2 rounded-2 h-100"
                            style={{
                              cursor: 'pointer',
                              backgroundColor: active ? '#ffffff' : 'rgba(255,255,255,0.55)',
                              border: active ? '2px solid #16a34a' : '1px solid #d1d5db',
                            }}
                          >
                            <div className="fw-semibold" style={{ fontSize: '11.5px' }}>
                              {mt.shortLabel}
                            </div>
                            <div className="text-muted mt-1" style={{ fontSize: '10.5px', lineHeight: 1.35 }}>
                              {mt.description}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* SECTION: PROJECT DELIVERY & ASSET VAULT (Only for Deal Clients) */}
          {formData.status === 'Deal' && (
            <div
              className="p-3 rounded mb-3"
              style={{
                backgroundColor: '#ffffff',
                border: '1px solid var(--notion-border)',
              }}
            >
              <div className="d-flex align-items-center justify-content-between mb-2">
                <div className="d-flex align-items-center gap-2">
                  <Layers size={15} className="text-dark" />
                  <span className="fw-bold" style={{ fontSize: '13px' }}>
                    Project Delivery &amp; Asset Vault
                  </span>
                </div>
                <span
                  className="badge bg-primary-subtle text-primary border border-primary-subtle px-2 py-1"
                  style={{ fontSize: '11px' }}
                >
                  {completedChecklistCount} / {DELIVERY_CHECKLIST_ITEMS.length} Selesai ({checklistPercent}%)
                </span>
              </div>

              {/* Progress bar */}
              <div className="progress mb-3" style={{ height: '6px' }}>
                <div
                  className="progress-bar bg-primary"
                  role="progressbar"
                  style={{ width: `${checklistPercent}%` }}
                />
              </div>

              {/* 6-step checklist */}
              <div className="row g-2 mb-3">
                {DELIVERY_CHECKLIST_ITEMS.map((item) => {
                  const isChecked = Boolean(checklistObj[item.id]);
                  return (
                    <div className="col-12 col-sm-6" key={item.id}>
                      <div
                        className="p-2 rounded border d-flex align-items-center gap-2 cursor-pointer"
                        style={{
                          backgroundColor: isChecked ? '#f0fdf4' : '#fafaf9',
                          borderColor: isChecked ? '#bbf7d0' : '#e5e5e5',
                          fontSize: '11.5px',
                          cursor: 'pointer',
                        }}
                        onClick={() => handleToggleChecklist(item.id)}
                      >
                        <input
                          type="checkbox"
                          className="form-check-input mt-0"
                          checked={isChecked}
                          onChange={() => handleToggleChecklist(item.id)}
                          onClick={(e) => e.stopPropagation()}
                        />
                        <span
                          className={isChecked ? 'fw-semibold text-success' : 'text-secondary'}
                        >
                          {item.label}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Asset Links: Live URL, Staging, Domain */}
              <div className="row g-2">
                <div className="col-12 col-sm-6">
                  <label className="form-label text-muted mb-1" style={{ fontSize: '11px' }}>
                    Live Website URL
                  </label>
                  <div className="input-group input-group-sm">
                    <input
                      type="url"
                      className="notion-input form-control"
                      placeholder="https://domainklien.com"
                      value={formData.delivery_assets?.live_url || ''}
                      onChange={(e) =>
                        handleDeliveryAssetChange('live_url', e.target.value)
                      }
                    />
                    {sanitizeSafeUrl(formData.delivery_assets?.live_url) && (
                      <a
                        href={sanitizeSafeUrl(formData.delivery_assets.live_url)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-outline-secondary"
                      >
                        <ExternalLink size={12} />
                      </a>
                    )}
                  </div>
                </div>

                <div className="col-12 col-sm-6">
                  <label className="form-label text-muted mb-1" style={{ fontSize: '11px' }}>
                    Staging / Preview Web
                  </label>
                  <div className="input-group input-group-sm">
                    <input
                      type="url"
                      className="notion-input form-control"
                      placeholder="https://preview.vercel.app"
                      value={formData.delivery_assets?.staging_url || ''}
                      onChange={(e) =>
                        handleDeliveryAssetChange('staging_url', e.target.value)
                      }
                    />
                    {sanitizeSafeUrl(formData.delivery_assets?.staging_url) && (
                      <a
                        href={sanitizeSafeUrl(formData.delivery_assets.staging_url)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-outline-secondary"
                      >
                        <ExternalLink size={12} />
                      </a>
                    )}
                  </div>
                </div>

                <div className="col-12 col-sm-6">
                  <label className="form-label text-muted mb-1" style={{ fontSize: '11px' }}>
                    Domain Klien
                  </label>
                  <input
                    type="text"
                    className="notion-input w-100"
                    placeholder="contoh: brandklien.com"
                    value={formData.delivery_assets?.domain || ''}
                    onChange={(e) =>
                      handleDeliveryAssetChange('domain', e.target.value)
                    }
                  />
                </div>

                <div className="col-12 col-sm-6">
                  <label className="form-label text-muted mb-1 d-flex justify-content-between" style={{ fontSize: '11px' }}>
                    <span>Jatah Revisi Klien</span>
                    <span className="fw-semibold">
                      {formData.delivery_assets?.revision_count || 0} /{' '}
                      {formData.delivery_assets?.max_revisions || 3}
                    </span>
                  </label>
                  <div className="d-flex align-items-center gap-2">
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-secondary p-1"
                      onClick={() => handleRevisionChange(-1)}
                    >
                      <Minus size={12} />
                    </button>
                    <span className="fw-bold px-2" style={{ fontSize: '12.5px' }}>
                      Revisi ke-{formData.delivery_assets?.revision_count || 0}
                    </span>
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-secondary p-1"
                      onClick={() => handleRevisionChange(1)}
                    >
                      <Plus size={12} />
                    </button>
                  </div>
                </div>

                <div className="col-12">
                  <label className="form-label text-muted mb-1" style={{ fontSize: '11px' }}>
                    Kredensial Hosting / CMS / Catatan Teknis (Aman &amp; Terbatas)
                  </label>
                  {canAccessCredentials ? (
                    <input
                      type="text"
                      className="notion-input w-100"
                      placeholder="Contoh: cPanel Niagahoster / WP Admin login..."
                      value={formData.delivery_assets?.credentials || ''}
                      onChange={(e) =>
                        handleDeliveryAssetChange('credentials', e.target.value)
                      }
                    />
                  ) : (
                    <input
                      type="text"
                      className="notion-input w-100 text-muted bg-light"
                      value="•••••••• (Terbatas: Hanya Admin, Pembuat Prospek, atau PIC Project)"
                      readOnly
                      disabled
                    />
                  )}
                </div>
              </div>
            </div>
          )}

          {/* SECTION: LANGGANAN DOMAIN, HOSTING & MAINTENANCE (Only for Deal Clients) */}
          {formData.status === 'Deal' && (
            <div
              className="p-3 rounded mb-3"
              style={{
                backgroundColor:
                  formData.management_type === 'project_only'
                    ? '#fffbeb'
                    : formData.renewal_enabled
                    ? '#f8fafc'
                    : '#ffffff',
                border: '1px solid var(--notion-border)',
              }}
            >
              <div className="d-flex align-items-center justify-content-between mb-2">
                <div className="d-flex align-items-center gap-2">
                  <RefreshCw size={15} className="text-primary" />
                  <span className="fw-bold" style={{ fontSize: '13px' }}>
                    Langganan Domain, Hosting &amp; Maintenance
                  </span>
                </div>
                {formData.management_type !== 'project_only' && (
                  <div className="form-check form-switch m-0">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      checked={Boolean(formData.renewal_enabled)}
                      onChange={(e) =>
                        handleChange('renewal_enabled', e.target.checked)
                      }
                    />
                  </div>
                )}
              </div>

              {formData.management_type === 'project_only' ? (
                <div
                  className="p-2 rounded bg-white border border-warning-subtle text-warning-emphasis"
                  style={{ fontSize: '11.5px' }}
                >
                  <strong>⚡ Skema Beli Putus (Project / Redesign Saja):</strong> Klien ini tidak menggunakan paket hosting/domain dari studio dan{' '}
                  <strong>tidak di bawah wewenang manajemen kita untuk selanjutnya</strong>. Tidak ada tagihan perpanjangan domain/hosting.
                </div>
              ) : formData.renewal_enabled ? (
                <div className="row g-2">
                  <div className="col-12 col-sm-7">
                    <label
                      className="form-label text-muted mb-1"
                      style={{ fontSize: '11px' }}
                    >
                      Nama Layanan Perpanjangan
                    </label>
                    <input
                      type="text"
                      className="notion-input w-100"
                      value={formData.renewal_service_name || ''}
                      onChange={(e) =>
                        handleChange('renewal_service_name', e.target.value)
                      }
                    />
                  </div>
                  <div className="col-12 col-sm-5">
                    <label
                      className="form-label text-muted mb-1"
                      style={{ fontSize: '11px' }}
                    >
                      Siklus Langganan
                    </label>
                    <select
                      className="notion-select w-100"
                      value={formData.renewal_cycle || 'Yearly'}
                      onChange={(e) =>
                        handleChange('renewal_cycle', e.target.value)
                      }
                    >
                      {RENEWAL_CYCLES.map((rc) => (
                        <option key={rc.value} value={rc.value}>
                          {rc.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="col-12 col-sm-4">
                    <label
                      className="form-label text-muted mb-1"
                      style={{ fontSize: '11px' }}
                    >
                      Jatuh Tempo
                    </label>
                    <input
                      type="date"
                      className="notion-input w-100"
                      value={formData.renewal_due_date || ''}
                      onChange={(e) =>
                        handleChange('renewal_due_date', e.target.value)
                      }
                    />
                  </div>

                  <div className="col-6 col-sm-4">
                    <label
                      className="form-label text-muted mb-1"
                      style={{ fontSize: '11px' }}
                    >
                      Tagihan ({formData.currency})
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      className="notion-input w-100"
                      value={formData.renewal_price}
                      onChange={(e) =>
                        handleChange('renewal_price', Number(e.target.value) || 0)
                      }
                    />
                  </div>

                  <div className="col-6 col-sm-4">
                    <label
                      className="form-label text-muted mb-1"
                      style={{ fontSize: '11px' }}
                    >
                      Modal Provider ({formData.currency})
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      className="notion-input w-100"
                      value={formData.renewal_cost}
                      onChange={(e) =>
                        handleChange('renewal_cost', Number(e.target.value) || 0)
                      }
                    />
                  </div>

                  <div className="col-12">
                    <div
                      className="p-2 rounded bg-white border d-flex flex-wrap align-items-center justify-content-between gap-2 mt-1"
                      style={{ fontSize: '11.5px' }}
                    >
                      <div>
                        <span className="text-muted">Status Masa Aktif: </span>
                        <span
                          className={`badge rounded-pill ${
                            getRenewalStatus(
                              formData.renewal_due_date,
                              formData.renewal_enabled
                            ).pillClass
                          }`}
                        >
                          {
                            getRenewalStatus(
                              formData.renewal_due_date,
                              formData.renewal_enabled
                            ).label
                          }{' '}
                          (
                          {
                            getRenewalStatus(
                              formData.renewal_due_date,
                              formData.renewal_enabled
                            ).daysText
                          }
                          )
                        </span>
                      </div>
                      <div>
                        <span className="text-muted">
                          Margin Bersih Studio (100%):{' '}
                        </span>
                        <span className="fw-bold text-success">
                          {formatCurrency(
                            Math.max(
                              0,
                              (Number(formData.renewal_price) || 0) -
                                (Number(formData.renewal_cost) || 0)
                            ),
                            formData.currency
                          )}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-muted" style={{ fontSize: '11.5px' }}>
                  Aktifkan switch di atas untuk melacak jadwal expired domain/hosting &amp; tagihan perpanjangan klien ini.
                </div>
              )}
            </div>
          )}

          {/* Catatan / Notes Prospek */}
          <div className="mb-4 flex-grow-1 d-flex flex-column">
            <label
              className="form-label fw-semibold d-flex align-items-center gap-2 mb-2"
              style={{ fontSize: '13px' }}
            >
              <FileText size={14} />
              <span>Catatan Prospek &amp; Kebutuhan Website</span>
            </label>
            <textarea
              className="notion-input w-100 flex-grow-1"
              rows={4}
              value={formData.notes}
              onChange={(e) => handleChange('notes', e.target.value)}
              placeholder="Tulis hasil hunting dari Google Maps/Instagram, kondisi website klien saat ini, atau paket web design yang ditawarkan..."
            />
          </div>

          {/* Footer Actions (Sticky Bottom for Thumb Reach) */}
          <div
            className="mobile-sticky-footer-actions justify-content-between pt-3 border-top mt-auto"
            style={{ borderColor: 'var(--notion-border)' }}
          >
            {canDelete ? (
              <button
                type="button"
                onClick={handleDelete}
                className="btn btn-sm text-danger d-inline-flex align-items-center gap-1 px-2 py-1"
              >
                <Trash2 size={14} />
                <span>Hapus Prospek</span>
              </button>
            ) : (
              <span
                className="text-muted d-inline-flex align-items-center gap-1"
                style={{ fontSize: '11.5px' }}
                title="Hanya Admin atau pembuat prospek yang berhak menghapus"
              >
                🔒 Milik @{prospect.created_by_username || 'tim'}
              </span>
            )}

            <div className="d-flex align-items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="btn-notion-outline"
              >
                Tutup
              </button>
              <button
                type="submit"
                disabled={saving}
                className="btn-notion-primary"
              >
                <Save size={14} />
                <span>{saving ? 'Menyimpan...' : 'Simpan Perubahan'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </>
  );
}