import React, { useEffect, useMemo, useState } from 'react';
import {
  X,
  Plus,
  AlertTriangle,
  Search,
  Users,
  Edit3,
  Sparkles,
  Phone,
  ArrowRight,
  ExternalLink,
  Briefcase,
} from 'lucide-react';
import {
  SOCIAL_PLATFORMS,
  PROSPECT_STATUSES,
  PAYMENT_STATUSES,
  DEAL_MANAGEMENT_TYPES,
  getStatusBadgeClass,
  formatCurrency,
} from '../../lib/supabase';
import { useProspects } from '../../context/ProspectsContext';
import { useAuth } from '../../context/AuthContext';

export default function AddProspectModal({
  isOpen,
  onClose,
  onAdd,
  defaultStatus = 'Baru',
}) {
  const { profile } = useAuth();
  const { checkDuplicateProspect, prospects, allTeamProspects, updateProspect } =
    useProspects();

  // Tab State: 'manual' (Input Manual) vs 'import_prospect' (Ambil dari Database Prospek)
  const [activeModalTab, setActiveModalTab] = useState('manual');
  const [prospectSearch, setProspectSearch] = useState('');
  const [selectedSourceProspect, setSelectedSourceProspect] = useState(null);

  const [formData, setFormData] = useState({
    client_name: '',
    source_platform: 'Google Maps',
    social_handle: '',
    whatsapp_number: '',
    status: defaultStatus,
    management_type: 'full_managed',
    renewal_enabled: defaultStatus === 'Deal',
    notes: '',
    currency: 'IDR',
    project_value: 0,
    dp_amount: 0,
    payment_status: defaultStatus === 'Deal' ? 'DP Masuk' : 'Belum DP',
    next_follow_up_date: '',
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setActiveModalTab('manual');
      setProspectSearch('');
      setSelectedSourceProspect(null);
      setFormData({
        client_name: '',
        source_platform: 'Google Maps',
        social_handle: '',
        whatsapp_number: '',
        status: defaultStatus,
        management_type: 'full_managed',
        renewal_enabled: defaultStatus === 'Deal',
        notes: '',
        currency: 'IDR',
        project_value: 0,
        dp_amount: 0,
        payment_status: defaultStatus === 'Deal' ? 'DP Masuk' : 'Belum DP',
        next_follow_up_date: '',
      });
    }
  }, [isOpen, defaultStatus]);

  // Prospek yang tersedia untuk di-closing ke Deal (status bukan Deal)
  const candidateProspects = useMemo(() => {
    const isAdmin = profile?.role === 'admin';
    const list = isAdmin
      ? allTeamProspects && allTeamProspects.length > 0
        ? allTeamProspects
        : prospects
      : prospects || [];
    return (list || []).filter((p) => p.status !== 'Deal');
  }, [allTeamProspects, prospects, profile?.role]);

  const filteredCandidateProspects = useMemo(() => {
    const q = prospectSearch.trim().toLowerCase();
    if (!q) return candidateProspects;
    return candidateProspects.filter((p) => {
      const name = (p.client_name || '').toLowerCase();
      const wa = (p.whatsapp_number || '').toLowerCase();
      const social = (p.social_handle || '').toLowerCase();
      const platform = (p.source_platform || '').toLowerCase();
      const author = (p.created_by_username || '').toLowerCase();
      const notes = (p.notes || '').toLowerCase();
      return (
        name.includes(q) ||
        wa.includes(q) ||
        social.includes(q) ||
        platform.includes(q) ||
        author.includes(q) ||
        notes.includes(q)
      );
    });
  }, [candidateProspects, prospectSearch]);

  const duplicateWarning = useMemo(() => {
    if (!isOpen || !checkDuplicateProspect) return null;
    return checkDuplicateProspect({
      clientName: formData.client_name,
      whatsappNumber: formData.whatsapp_number,
      socialHandle: formData.social_handle,
    });
  }, [
    isOpen,
    checkDuplicateProspect,
    formData.client_name,
    formData.whatsapp_number,
    formData.social_handle,
  ]);

  if (!isOpen) return null;

  function handleSelectProspectToDeal(p) {
    setFormData({
      client_name: p.client_name || '',
      source_platform: p.source_platform || 'Google Maps',
      social_handle: p.social_handle || '',
      whatsapp_number: p.whatsapp_number || '',
      status: 'Deal',
      management_type: p.management_type || 'full_managed',
      renewal_enabled: (p.management_type || 'full_managed') !== 'project_only',
      notes: p.notes || '',
      currency: p.currency || 'IDR',
      project_value: p.project_value || 0,
      dp_amount: p.dp_amount || 0,
      payment_status: p.payment_status === 'Lunas' ? 'Lunas' : 'DP Masuk',
      next_follow_up_date: '',
    });
    setSelectedSourceProspect(p);
    setActiveModalTab('manual');
  }

  function handleChange(field, value) {
    setFormData((prev) => {
      const next = { ...prev, [field]: value };
      if (field === 'payment_status' && value === 'Lunas') {
        const val = Number(prev.project_value) || 0;
        if (val > 0) next.dp_amount = val;
      }
      if (field === 'status' && value === 'Deal') {
        if (prev.payment_status === 'Belum DP') {
          next.payment_status = 'DP Masuk';
        }
        next.renewal_enabled = next.management_type !== 'project_only';
      }
      if (field === 'management_type') {
        next.renewal_enabled = value !== 'project_only';
      }
      return next;
    });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (submitting) return;
    if (!formData.client_name.trim()) return;
    setSubmitting(true);
    try {
      if (selectedSourceProspect && selectedSourceProspect.id) {
        // Update langsung data prospek yang sudah ada menjadi Deal di CRM
        await updateProspect(selectedSourceProspect.id, {
          ...formData,
          status: 'Deal',
          deal_date: new Date().toISOString(),
        });
      } else {
        await onAdd(formData);
      }
      setSelectedSourceProspect(null);
      onClose();
    } catch (err) {
      console.error('Gagal menyimpan data:', err);
      alert('Gagal menyimpan data ke sistem: ' + (err?.message || 'Silakan periksa koneksi internet Anda.'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="notion-modal-overlay" onClick={onClose}>
      <div
        className="notion-modal-box"
        style={{ maxWidth: activeModalTab === 'import_prospect' ? '780px' : '580px' }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Tambah Klien Deal"
      >
        {/* Header Modal */}
        <div
          className="d-flex align-items-center justify-content-between px-4 py-3 border-bottom"
          style={{ borderColor: 'var(--notion-border)' }}
        >
          <div className="fw-bold" style={{ fontSize: '15px' }}>
            {defaultStatus === 'Deal'
              ? 'Tambah Klien Deal & Keuangan'
              : 'Tambah Prospek Hunting Baru'}
          </div>
          <button
            type="button"
            className="btn btn-sm p-1 text-muted"
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </div>

        {/* 2 Tab Bersebelahan di Bagian Atas Modal (Khusus Deal) */}
        {defaultStatus === 'Deal' && (
          <div
            className="d-flex border-bottom bg-light px-4 pt-2 gap-2"
            style={{ borderColor: 'var(--notion-border)' }}
          >
            <button
              type="button"
              onClick={() => setActiveModalTab('manual')}
              className={`btn btn-sm py-2 px-3 border-0 fw-semibold d-inline-flex align-items-center gap-1.5 ${
                activeModalTab === 'manual'
                  ? 'bg-white shadow-sm text-dark border-bottom border-primary border-2'
                  : 'text-muted bg-transparent'
              }`}
              style={{
                fontSize: '12.5px',
                borderTopLeftRadius: '6px',
                borderTopRightRadius: '6px',
              }}
            >
              <Edit3 size={13} />
              <span>1. Input Manual (Form Baru)</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveModalTab('import_prospect')}
              className={`btn btn-sm py-2 px-3 border-0 fw-semibold d-inline-flex align-items-center gap-1.5 ${
                activeModalTab === 'import_prospect'
                  ? 'bg-white shadow-sm text-primary border-bottom border-primary border-2'
                  : 'text-muted bg-transparent'
              }`}
              style={{
                fontSize: '12.5px',
                borderTopLeftRadius: '6px',
                borderTopRightRadius: '6px',
              }}
            >
              <Users size={13} />
              <span>2. Ambil Dari Database Prospek</span>
              <span
                className="badge bg-primary text-white rounded-pill ms-1"
                style={{ fontSize: '10px' }}
              >
                {candidateProspects.length}
              </span>
            </button>
          </div>
        )}

        {/* =================================================================== */}
        {/* TAB 1: FORM INPUT MANUAL DEAL */}
        {/* =================================================================== */}
        {activeModalTab === 'manual' && (
          <form onSubmit={handleSubmit} className="p-4">
            {/* Banner Informasi Saat Data Diimpor Dari Database Prospek */}
            {selectedSourceProspect && (
              <div
                className="p-3 rounded-2 mb-3 d-flex align-items-center justify-content-between gap-2 border"
                style={{
                  backgroundColor: '#eff6ff',
                  borderColor: '#bfdbfe',
                  fontSize: '12px',
                }}
              >
                <div className="d-flex align-items-center gap-2">
                  <Sparkles size={16} className="text-primary flex-shrink-0" />
                  <div>
                    <strong>Data Prospek Berhasil Dimuat:</strong>{' '}
                    <span className="text-primary fw-bold">
                      {selectedSourceProspect.client_name}
                    </span>{' '}
                    <span className="text-muted">
                      (Digarap @{selectedSourceProspect.created_by_username || 'tim'})
                    </span>
                    <div className="text-muted mt-0.5" style={{ fontSize: '11px' }}>
                      Silakan tentukan Nilai Project &amp; DP Masuk, lalu klik <strong>Simpan Deal</strong>.
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary py-1 px-2 bg-white"
                  style={{ fontSize: '11px', whiteSpace: 'nowrap' }}
                  onClick={() => {
                    setSelectedSourceProspect(null);
                    setFormData({
                      client_name: '',
                      source_platform: 'Google Maps',
                      social_handle: '',
                      whatsapp_number: '',
                      status: defaultStatus,
                      management_type: 'full_managed',
                      renewal_enabled: defaultStatus === 'Deal',
                      notes: '',
                      currency: 'IDR',
                      project_value: 0,
                      dp_amount: 0,
                      payment_status: defaultStatus === 'Deal' ? 'DP Masuk' : 'Belum DP',
                      next_follow_up_date: '',
                    });
                  }}
                  title="Batalkan impor dan isi manual kosong"
                >
                  Batal Pilih
                </button>
              </div>
            )}

            {duplicateWarning && !selectedSourceProspect && (
              <div
                className="p-3 rounded-3 mb-3 d-flex align-items-start gap-2"
                style={{
                  backgroundColor: duplicateWarning.isMine
                    ? '#fef3c7'
                    : '#fff1f2',
                  border: duplicateWarning.isMine
                    ? '1px solid #fde68a'
                    : '1px solid #fecdd3',
                  color: duplicateWarning.isMine ? '#92400e' : '#9f1239',
                  fontSize: '12px',
                }}
              >
                <AlertTriangle size={16} className="flex-shrink-0 mt-1" />
                <div>
                  <div className="fw-bold mb-1">
                    {duplicateWarning.isMine
                      ? `Deteksi Duplikat di Tabel Anda (${duplicateWarning.matchedField})`
                      : `Perhatian: ${duplicateWarning.matchedField} Sudah Terdaftar di Sistem`}
                  </div>
                  <div>
                    {duplicateWarning.isMine
                      ? `Prospek ini sudah pernah Anda input sebelumnya (Status saat ini: ${duplicateWarning.status}).`
                      : `Prospek ini sedang digarap oleh @${duplicateWarning.ownerUsername} (Status: ${duplicateWarning.status}). Pastikan tidak terjadi double-pitching ke klien yang sama.`}
                  </div>
                </div>
              </div>
            )}

            <div className="mb-3">
              <label className="form-label fw-medium mb-1" style={{ fontSize: '12.5px' }}>
                Nama Klien / Bisnis <span className="text-danger">*</span>
              </label>
              <input
                type="text"
                className="notion-input w-100"
                placeholder="Contoh: Kopi Senja Roastery / Klinik Gigi Lumina"
                value={formData.client_name}
                onChange={(e) => handleChange('client_name', e.target.value)}
                required
                autoFocus
              />
            </div>

            <div className="row g-3 mb-3">
              <div className="col-sm-6">
                <label className="form-label fw-medium mb-1" style={{ fontSize: '12.5px' }}>
                  Sumber / Pilihan Sosmed <span className="text-danger">*</span>
                </label>
                <select
                  className="notion-select w-100"
                  value={formData.source_platform}
                  onChange={(e) => handleChange('source_platform', e.target.value)}
                >
                  {SOCIAL_PLATFORMS.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="col-sm-6">
                <label className="form-label fw-medium mb-1" style={{ fontSize: '12.5px' }}>
                  Nama Sosmed / Handle <span className="text-danger">*</span>
                </label>
                <input
                  type="text"
                  className="notion-input w-100"
                  placeholder="Contoh: @kopisenja.id / Nama di GMaps"
                  value={formData.social_handle}
                  onChange={(e) => handleChange('social_handle', e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="row g-3 mb-3">
              <div className="col-sm-4">
                <label className="form-label fw-medium mb-1" style={{ fontSize: '12.5px' }}>
                  Nomor WhatsApp / Kontak
                </label>
                <input
                  type="text"
                  className="notion-input w-100"
                  placeholder="Contoh: 628123456789"
                  value={formData.whatsapp_number}
                  onChange={(e) => handleChange('whatsapp_number', e.target.value)}
                />
              </div>

              <div className="col-sm-4">
                <label className="form-label fw-medium mb-1" style={{ fontSize: '12.5px' }}>
                  Status Klien
                </label>
                <select
                  className="notion-select w-100"
                  value={formData.status}
                  onChange={(e) => handleChange('status', e.target.value)}
                >
                  {PROSPECT_STATUSES.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="col-sm-4">
                <label className="form-label fw-medium mb-1" style={{ fontSize: '12.5px' }}>
                  Jadwal Follow-Up
                </label>
                <input
                  type="date"
                  className="notion-input w-100"
                  value={formData.next_follow_up_date || ''}
                  onChange={(e) => handleChange('next_follow_up_date', e.target.value)}
                />
              </div>
            </div>

            {formData.status === 'Deal' && (
              <div
                className="p-3 rounded-3 mb-3"
                style={{
                  backgroundColor: '#f4fbf7',
                  border: '1px solid #bbf7d0',
                }}
              >
                <div className="d-flex align-items-center justify-content-between mb-2">
                  <div
                    className="fw-semibold"
                    style={{ fontSize: '12.5px', color: '#166534' }}
                  >
                    Detail Nilai Proyek &amp; DP Masuk
                  </div>
                  {/* Pilihan Mata Uang */}
                  <div className="d-flex align-items-center gap-1">
                    <span className="text-muted" style={{ fontSize: '11px' }}>
                      Mata Uang:
                    </span>
                    <select
                      className="notion-select py-0 px-2 fw-semibold"
                      style={{ fontSize: '11.5px', height: '26px' }}
                      value={formData.currency || 'IDR'}
                      onChange={(e) => handleChange('currency', e.target.value)}
                    >
                      <option value="IDR">IDR (Rp)</option>
                      <option value="USD">USD ($)</option>
                    </select>
                  </div>
                </div>
                <div className="row g-2">
                  <div className="col-sm-4">
                    <label
                      className="form-label mb-1"
                      style={{ fontSize: '11.5px' }}
                    >
                      Nilai Proyek ({formData.currency === 'USD' ? '$' : 'Rp'})
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
                  <div className="col-sm-4">
                    <label
                      className="form-label mb-1"
                      style={{ fontSize: '11.5px' }}
                    >
                      Nominal DP ({formData.currency === 'USD' ? '$' : 'Rp'})
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
                  <div className="col-sm-4">
                    <label
                      className="form-label mb-1"
                      style={{ fontSize: '11.5px' }}
                    >
                      Status Bayar
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
                </div>

                {/* Tipe Kerjasama Klien Deal */}
                <div className="mt-3 pt-2 border-top" style={{ borderColor: '#bbf7d0' }}>
                  <label
                    className="form-label fw-semibold mb-2 d-block"
                    style={{ fontSize: '12px', color: '#166534' }}
                  >
                    Tipe Kerjasama &amp; Wewenang Manajemen Selanjutnya:
                  </label>
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
                              backgroundColor: active
                                ? '#ffffff'
                                : 'rgba(255,255,255,0.6)',
                              border: active
                                ? '2px solid #16a34a'
                                : '1px solid #d1d5db',
                            }}
                          >
                            <div
                              className="fw-semibold"
                              style={{
                                fontSize: '12px',
                                color: active ? '#14532d' : '#374151',
                              }}
                            >
                              {mt.shortLabel}
                            </div>
                            <div
                              className="text-muted mt-1"
                              style={{ fontSize: '11px', lineHeight: 1.35 }}
                            >
                              {mt.description}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            <div className="mb-4">
              <label className="form-label fw-medium mb-1" style={{ fontSize: '12.5px' }}>
                Catatan Prospek
              </label>
              <textarea
                className="notion-input w-100"
                rows={3}
                placeholder="Catatan hasil riset prospek, kebutuhan website, dll..."
                value={formData.notes}
                onChange={(e) => handleChange('notes', e.target.value)}
              />
            </div>

            <div className="d-flex justify-content-end gap-2">
              <button
                type="button"
                className="btn-notion-outline"
                onClick={onClose}
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="btn-notion-primary"
              >
                <Plus size={15} />
                <span>
                  {submitting
                    ? 'Menyimpan...'
                    : selectedSourceProspect
                    ? 'Konfirmasi & Jadikan Deal'
                    : defaultStatus === 'Deal'
                    ? 'Simpan Deal'
                    : 'Simpan Prospek'}
                </span>
              </button>
            </div>
          </form>
        )}

        {/* =================================================================== */}
        {/* TAB 2: AMBIL DARI DATABASE PROSPEK LENGKAP */}
        {/* =================================================================== */}
        {activeModalTab === 'import_prospect' && (
          <div className="p-4">
            <div className="mb-3">
              <div className="position-relative">
                <Search
                  size={15}
                  className="position-absolute start-0 top-50 translate-middle-y ms-3 text-muted"
                />
                <input
                  type="text"
                  className="notion-input w-100 ps-5"
                  placeholder="Cari prospek berdasarkan nama klien, nomor WhatsApp, sosmed, atau nama hunter..."
                  value={prospectSearch}
                  onChange={(e) => setProspectSearch(e.target.value)}
                  autoFocus
                />
                {prospectSearch && (
                  <button
                    type="button"
                    className="btn btn-sm position-absolute end-0 top-50 translate-middle-y me-2 p-1 text-muted border-0 bg-transparent"
                    onClick={() => setProspectSearch('')}
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            </div>

            <div
              className="d-flex align-items-center justify-content-between mb-2 text-muted"
              style={{ fontSize: '11.5px' }}
            >
              <div>
                Menampilkan{' '}
                <strong>{filteredCandidateProspects.length}</strong> prospek
                hunting siap closing ke status Deal:
              </div>
              <div>Klik tombol <strong>"⚡ Jadikan Deal"</strong> untuk memindahkan data.</div>
            </div>

            {/* List Prospek */}
            <div
              className="d-flex flex-column gap-2"
              style={{ maxHeight: '420px', overflowY: 'auto' }}
            >
              {filteredCandidateProspects.length === 0 ? (
                <div className="text-center py-5 text-muted border rounded-2 bg-light">
                  <Users size={32} className="opacity-25 mb-2" />
                  <div className="fw-semibold" style={{ fontSize: '13px' }}>
                    {prospectSearch
                      ? 'Tidak ada prospek yang cocok dengan kata kunci pencarian.'
                      : 'Belum ada prospek hunting non-deal di database.'}
                  </div>
                  <div className="mt-1" style={{ fontSize: '11.5px' }}>
                    {prospectSearch
                      ? 'Coba gunakan kata kunci nama atau nomor lain.'
                      : 'Silakan input klien baru melalui Tab 1: Input Manual.'}
                  </div>
                </div>
              ) : (
                filteredCandidateProspects.map((p) => {
                  const statusClass = getStatusBadgeClass(p.status);
                  const cleanWa = (p.whatsapp_number || '').replace(/\D/g, '');
                  return (
                    <div
                      key={p.id}
                      className="p-3 rounded-2 border bg-white shadow-xs hover-shadow d-flex flex-column flex-sm-row align-items-sm-center justify-content-between gap-3"
                      style={{ borderColor: 'var(--notion-border)' }}
                    >
                      <div className="flex-grow-1" style={{ minWidth: 0 }}>
                        <div className="d-flex flex-wrap align-items-center gap-1.5 mb-1">
                          <span
                            className="fw-bold text-dark text-truncate"
                            style={{ fontSize: '13.5px' }}
                          >
                            {p.client_name}
                          </span>
                          <span
                            className="badge bg-light text-secondary border"
                            style={{ fontSize: '10.5px' }}
                          >
                            {p.source_platform}
                          </span>
                          <span
                            className={`badge ${statusClass}`}
                            style={{ fontSize: '10.5px' }}
                          >
                            {p.status}
                          </span>
                        </div>

                        <div
                          className="d-flex flex-wrap align-items-center gap-3 text-muted"
                          style={{ fontSize: '11.5px' }}
                        >
                          {p.whatsapp_number && (
                            <a
                              href={`https://wa.me/${cleanWa}`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-decoration-none text-success d-inline-flex align-items-center gap-1"
                            >
                              <Phone size={11} />
                              <span>{p.whatsapp_number}</span>
                            </a>
                          )}

                          {p.social_handle && (
                            <span className="text-truncate" style={{ maxWidth: '180px' }}>
                              @{p.social_handle.replace(/^@/, '')}
                            </span>
                          )}

                          <span>
                            Hunter: <strong>@{p.created_by_username || 'tim'}</strong>
                          </span>
                        </div>

                        {p.notes && (
                          <div
                            className="text-muted text-truncate mt-1 fst-italic"
                            style={{ fontSize: '11px', maxWidth: '480px' }}
                            title={p.notes}
                          >
                            "{p.notes}"
                          </div>
                        )}
                      </div>

                      <div className="flex-shrink-0 d-flex align-items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleSelectProspectToDeal(p)}
                          className="btn btn-sm btn-notion-primary py-1 px-3 d-inline-flex align-items-center gap-1.5"
                          style={{ fontSize: '12px' }}
                          title="Pindahkan seluruh data prospek ini ke form deal"
                        >
                          <Plus size={13} />
                          <span>⚡ Jadikan Deal</span>
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="d-flex justify-content-end gap-2 pt-3 mt-3 border-top">
              <button
                type="button"
                className="btn-notion-outline"
                onClick={onClose}
              >
                Tutup
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
