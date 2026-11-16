import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Plus,
  Search,
  Filter,
  Users,
  CheckCircle2,
  Clock,
  ChevronRight,
  Globe,
  UserCheck,
  Download,
  Bell,
  MessageSquare,
  Lock,
  ShieldCheck,
  Phone,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useProspects } from '../context/ProspectsContext';
import {
  SOCIAL_PLATFORMS,
  PROSPECT_STATUSES,
  getPlatformBadgeClass,
  getStatusBadgeClass,
  exportToCSV,
  getFollowUpBadgeMeta,
  getFollowUpStatus,
  normalizeWhatsAppNumber,
} from '../lib/supabase';
import AddProspectModal from '../components/Prospects/AddProspectModal';
import ProspectDetailDrawer from '../components/Prospects/ProspectDetailDrawer';

export default function ProspectsPage() {
  const { profile } = useAuth();
  const { prospects, loading, addProspect, updateProspect, deleteProspect } =
    useProspects();
  const [searchParams, setSearchParams] = useSearchParams();
  const isAdmin = profile?.role === 'admin';

  const [searchQuery, setSearchQuery] = useState('');
  const [platformFilter, setPlatformFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [creatorFilter, setCreatorFilter] = useState('ALL');
  const [followUpFilter, setFollowUpFilter] = useState('ALL');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedProspectId, setSelectedProspectId] = useState(null);

  // Deep-link support from Notifications (?open=id&followup=OVERDUE)
  useEffect(() => {
    const openId = searchParams.get('open');
    const fu = searchParams.get('followup');
    if (openId) {
      setSelectedProspectId(openId);
    }
    if (fu) {
      setFollowUpFilter(fu);
    }
    if (openId || fu) {
      const next = new URLSearchParams(searchParams);
      next.delete('open');
      next.delete('followup');
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const selectedProspect = useMemo(
    () => prospects.find((p) => p.id === selectedProspectId) || null,
    [prospects, selectedProspectId]
  );

  // Unique list of team members who added prospects
  const teamCreators = useMemo(() => {
    const map = new Map();
    prospects.forEach((p) => {
      if (p.created_by_username && p.created_by_username.trim()) {
        const lower = p.created_by_username.trim().toLowerCase();
        if (!map.has(lower)) map.set(lower, p.created_by_username.trim());
      }
    });
    return Array.from(map.values()).sort();
  }, [prospects]);

  const filteredProspects = useMemo(() => {
    return prospects.filter((item) => {
      const q = searchQuery.toLowerCase();
      const matchSearch =
        !q ||
        (item.client_name || '').toLowerCase().includes(q) ||
        (item.social_handle || '').toLowerCase().includes(q) ||
        (item.created_by_username || '').toLowerCase().includes(q) ||
        (item.notes || '').toLowerCase().includes(q);

      const matchPlatform =
        platformFilter === 'ALL' || item.source_platform === platformFilter;
      const matchStatus =
        statusFilter === 'ALL' || item.status === statusFilter;
      const matchCreator =
        creatorFilter === 'ALL' || item.created_by_username === creatorFilter;

      let matchFollowUp = true;
      if (followUpFilter !== 'ALL') {
        const fuStatus = getFollowUpStatus(item.next_follow_up_date, item.status);
        if (followUpFilter === 'TODAY') {
          matchFollowUp = fuStatus === 'today';
        } else if (followUpFilter === 'OVERDUE') {
          matchFollowUp = fuStatus === 'overdue';
        } else if (followUpFilter === 'UPCOMING') {
          matchFollowUp = fuStatus === 'upcoming';
        } else if (followUpFilter === 'SCHEDULED') {
          matchFollowUp = Boolean(fuStatus);
        }
      }

      return (
        matchSearch &&
        matchPlatform &&
        matchStatus &&
        matchCreator &&
        matchFollowUp
      );
    });
  }, [
    prospects,
    searchQuery,
    platformFilter,
    statusFilter,
    creatorFilter,
    followUpFilter,
  ]);

  const stats = useMemo(() => {
    const total = prospects.length;
    const activeFollowUp = prospects.filter((p) =>
      ['Dihubungi', 'Follow Up', 'Negosiasi'].includes(p.status)
    ).length;
    const totalDeal = prospects.filter((p) => p.status === 'Deal').length;
    const todayFollowUps = prospects.filter(
      (p) => getFollowUpStatus(p.next_follow_up_date, p.status) === 'today'
    ).length;
    const overdueFollowUps = prospects.filter(
      (p) => getFollowUpStatus(p.next_follow_up_date, p.status) === 'overdue'
    ).length;

    return { total, activeFollowUp, totalDeal, todayFollowUps, overdueFollowUps };
  }, [prospects]);

  function handleExportCSV() {
    exportToCSV(
      isAdmin
        ? 'data-prospek-seluruh-tim'
        : `data-prospek-${profile?.username || 'saya'}`,
      filteredProspects,
      [
        { header: 'Nama Klien / Bisnis', key: 'client_name' },
        { header: 'Sumber Platform', key: 'source_platform' },
        { header: 'Akun Sosmed / Maps', key: 'social_handle' },
        { header: 'WhatsApp', key: 'whatsapp_number' },
        { header: 'Status Prospek', key: 'status' },
        { header: 'Ditambahkan Oleh', key: 'created_by_username' },
        { header: 'Jadwal Follow-Up', key: 'next_follow_up_date' },
        { header: 'Mata Uang', key: 'currency' },
        { header: 'Nilai Kontrak', key: 'project_value' },
        { header: 'DP Masuk', key: 'dp_amount' },
        { header: 'Status Bayar', key: 'payment_status' },
        { header: 'Catatan', key: 'notes' },
        { header: 'Tanggal Dibuat', key: 'created_at' },
      ]
    );
  }

  async function handleDeleteProspect(id) {
    await deleteProspect(id);
    if (selectedProspectId === id) {
      setSelectedProspectId(null);
    }
  }

  return (
    <div>
      {/* Page Header */}
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-4">
        <div>
          <div className="d-flex flex-wrap align-items-center gap-2 mb-1">
            <h1 className="notion-page-title mb-0">
              {isAdmin
                ? 'Database Prospek Seluruh Tim'
                : `Database Prospek Saya (@${profile?.username || 'user'})`}
            </h1>
            {isAdmin ? (
              <span
                className="badge bg-primary-subtle text-primary border border-primary-subtle d-inline-flex align-items-center gap-1 px-2 py-1"
                style={{ fontSize: '11px' }}
              >
                <ShieldCheck size={12} />
                <span>Supervisi Admin (Semua Hunter)</span>
              </span>
            ) : (
              <span
                className="badge bg-dark-subtle text-dark border border-secondary-subtle d-inline-flex align-items-center gap-1 px-2 py-1"
                style={{ fontSize: '11px' }}
              >
                <Lock size={11} />
                <span>Tabel Mandiri Independen</span>
              </span>
            )}
          </div>
          <p className="notion-page-subtitle mb-0">
            {isAdmin
              ? 'Supervisi penuh seluruh tabel prospek anggota tim, jadwal follow-up, dan status verifikasi harian.'
              : 'Tabel kerja mandiri khusus prospek Anda sendiri — hasil prospek Anda terisolasi secara independen dan tidak dapat dilihat oleh anggota tim lain.'}
          </p>
        </div>

        <div className="d-flex align-items-center gap-2">
          <button
            type="button"
            className="btn-notion-outline"
            onClick={handleExportCSV}
            title="Download data prospek ke format CSV / Excel"
          >
            <Download size={14} />
            <span>Export CSV</span>
          </button>

          <button
            type="button"
            className="btn-notion-primary"
            onClick={() => setIsAddModalOpen(true)}
          >
            <Plus size={16} />
            <span>Tambah Prospek</span>
          </button>
        </div>
      </div>

      {/* Quick Summary Cards */}
      <div className="row g-3 mb-4">
        <div className="col-6 col-md-3">
          <div className="notion-card">
            <div className="notion-stat-label">
              <Users size={14} />
              <span>
                {isAdmin ? 'Total Prospek Tim' : 'Total Prospek Saya'}
              </span>
            </div>
            <div className="notion-stat-value">{stats.total}</div>
          </div>
        </div>

        <div className="col-6 col-md-3">
          <div className="notion-card">
            <div className="notion-stat-label">
              <Bell size={14} className="text-warning" />
              <span>Follow-Up Hari Ini</span>
            </div>
            <div className="notion-stat-value text-warning">
              {stats.todayFollowUps}
              {stats.overdueFollowUps > 0 && (
                <span
                  className="badge bg-danger ms-2"
                  style={{ fontSize: '11px', verticalAlign: 'middle' }}
                  title={`${stats.overdueFollowUps} prospek terlewat`}
                >
                  {stats.overdueFollowUps} Terlewat
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="col-6 col-md-3">
          <div className="notion-card">
            <div className="notion-stat-label">
              <Clock size={14} />
              <span>Follow-Up &amp; Negosiasi</span>
            </div>
            <div className="notion-stat-value">{stats.activeFollowUp}</div>
          </div>
        </div>

        <div className="col-6 col-md-3">
          <div className="notion-card">
            <div className="notion-stat-label">
              <CheckCircle2 size={14} className="text-success" />
              <span>Klien Deal (Closing)</span>
            </div>
            <div className="notion-stat-value text-success">
              {stats.totalDeal}
            </div>
          </div>
        </div>
      </div>

      {/* Filter & Search Toolbar */}
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
        <div className="d-flex flex-wrap align-items-center gap-2 flex-grow-1">
          <div
            className="position-relative"
            style={{
              minWidth: '220px',
              flex: '1 1 230px',
              maxWidth: '320px',
            }}
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
              placeholder={
                isAdmin
                  ? 'Cari nama prospek, sosmed, penginput...'
                  : 'Cari nama prospek, sosmed, catatan...'
              }
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Filter Reminder Follow-Up */}
          <div className="d-flex align-items-center gap-1">
            <Bell size={13} className="text-muted ms-1" />
            <select
              className="notion-select"
              value={followUpFilter}
              onChange={(e) => setFollowUpFilter(e.target.value)}
            >
              <option value="ALL">Semua Jadwal Follow-Up</option>
              <option value="TODAY">⚡ Follow-Up Hari Ini</option>
              <option value="OVERDUE">🔴 Terlewat (Overdue)</option>
              <option value="UPCOMING">🟢 Terjadwal Mendatang</option>
              <option value="SCHEDULED">Semua yang Dijadwalkan</option>
            </select>
          </div>

          {/* Filter Platform Sosmed */}
          <div className="d-flex align-items-center gap-1">
            <Filter size={13} className="text-muted ms-1" />
            <select
              className="notion-select"
              value={platformFilter}
              onChange={(e) => setPlatformFilter(e.target.value)}
            >
              <option value="ALL">Semua Sosmed</option>
              {SOCIAL_PLATFORMS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>

          {/* Filter Status */}
          <select
            className="notion-select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="ALL">Semua Status</option>
            {PROSPECT_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>

          {/* Filter Ditambahkan Oleh User (Khusus Admin) */}
          {isAdmin && (
            <div className="d-flex align-items-center gap-1">
              <UserCheck size={13} className="text-muted ms-1" />
              <select
                className="notion-select"
                value={creatorFilter}
                onChange={(e) => setCreatorFilter(e.target.value)}
              >
                <option value="ALL">Semua Penginput Tim</option>
                {teamCreators.map((uname) => (
                  <option key={uname} value={uname}>
                    Oleh: @{uname}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="text-muted" style={{ fontSize: '12.5px' }}>
          Menampilkan <strong>{filteredProspects.length}</strong> prospek{' '}
          {isAdmin ? 'tim' : 'pribadi'}
        </div>
      </div>

      {/* Desktop View: Notion-Style Table (Screens >= 768px) */}
      <div className="notion-table-wrapper d-none d-md-block">
        <div className="table-responsive">
          <table className="notion-table">
            <thead>
              <tr>
                <th style={{ minWidth: '190px' }}>Nama Prospek / Klien</th>
                <th style={{ minWidth: '130px' }}>Sumber Sosmed</th>
                <th style={{ minWidth: '160px' }}>Nama Akun Sosmed</th>
                <th style={{ minWidth: '115px' }}>Status</th>
                <th style={{ minWidth: '140px' }}>Jadwal Follow-Up</th>
                <th style={{ minWidth: '130px' }}>Penginput</th>
                <th style={{ minWidth: '130px' }}>WhatsApp</th>
                <th style={{ minWidth: '180px' }}>Catatan Ringkas</th>
                <th style={{ width: '60px', textAlign: 'center' }}>Detail</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} className="text-center py-5 text-muted">
                    Memuat data prospek...
                  </td>
                </tr>
              ) : filteredProspects.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-5">
                    <div className="text-muted mb-2">
                      Belum ada prospek yang sesuai dengan pencarian/filter.
                    </div>
                    <button
                      type="button"
                      className="btn-notion-outline"
                      onClick={() => setIsAddModalOpen(true)}
                    >
                      <Plus size={14} />
                      <span>Tambah Prospek Baru</span>
                    </button>
                  </td>
                </tr>
              ) : (
                filteredProspects.map((item) => {
                  const isSelected = selectedProspectId === item.id;
                  const fuBadge = getFollowUpBadgeMeta(
                    item.next_follow_up_date,
                    item.status
                  );
                  const notesCount = Array.isArray(item.follow_up_notes)
                    ? item.follow_up_notes.length
                    : 0;

                  return (
                    <tr
                      key={item.id}
                      className={isSelected ? 'selected-row' : ''}
                      onClick={() => setSelectedProspectId(item.id)}
                    >
                      <td>
                        <div className="fw-semibold d-flex align-items-center justify-content-between gap-2">
                          <span>{item.client_name}</span>
                          <span
                            className="text-muted fw-normal"
                            style={{ fontSize: '11px' }}
                          >
                            Buka
                          </span>
                        </div>
                        {(item.verification_status === 'verified' ||
                          item.verification_status === 'rejected' ||
                          item.verification_status === 'review') && (
                          <div className="mt-1">
                            {item.verification_status === 'verified' && (
                              <span
                                className="badge bg-success-subtle text-success border border-success-subtle"
                                style={{ fontSize: '10px' }}
                              >
                                ✓ Terverifikasi Asli
                              </span>
                            )}
                            {item.verification_status === 'review' && (
                              <span
                                className="badge bg-warning-subtle text-warning-emphasis border border-warning-subtle"
                                style={{ fontSize: '10px' }}
                              >
                                ⏳ Audit Admin
                              </span>
                            )}
                            {item.verification_status === 'rejected' && (
                              <span
                                className="badge bg-danger-subtle text-danger border border-danger-subtle"
                                style={{ fontSize: '10px' }}
                                title={
                                  item.verification_notes ||
                                  item.verification_note ||
                                  'Ditolak pada audit keaslian harian Admin'
                                }
                              >
                                ✕ Ditolak Admin
                              </span>
                            )}
                          </div>
                        )}
                      </td>
                      <td>
                        <span
                          className={`notion-pill ${getPlatformBadgeClass(
                            item.source_platform
                          )}`}
                        >
                          {item.source_platform}
                        </span>
                      </td>
                      <td className="text-truncate" style={{ maxWidth: '170px' }}>
                        {item.social_handle || '-'}
                      </td>
                      <td>
                        <span
                          className={`notion-pill ${getStatusBadgeClass(
                            item.status
                          )}`}
                        >
                          {item.status}
                        </span>
                        {item.status === 'Deal' && (
                          <div className="mt-1">
                            <span
                              className={`badge rounded-pill ${
                                item.management_type === 'project_only'
                                  ? 'bg-warning-subtle text-warning-emphasis border border-warning-subtle'
                                  : 'bg-primary-subtle text-primary border border-primary-subtle'
                              }`}
                              style={{ fontSize: '9.5px' }}
                            >
                              {item.management_type === 'project_only'
                                ? '⚡ Project Saja'
                                : '🏢 Full Managed'}
                            </span>
                          </div>
                        )}
                      </td>
                      <td>
                        {fuBadge ? (
                          <div className="d-flex align-items-center gap-1">
                            <span
                              className={`badge rounded-pill ${fuBadge.pillClass} px-2 py-1`}
                              style={{ fontSize: '10.5px' }}
                            >
                              ● {fuBadge.label}
                            </span>
                            <span
                              className="text-muted ms-1"
                              style={{ fontSize: '11px' }}
                            >
                              {item.next_follow_up_date}
                            </span>
                          </div>
                        ) : (
                          <span className="text-muted" style={{ fontSize: '11.5px' }}>
                            -
                          </span>
                        )}
                      </td>
                      <td>
                        <span className="notion-pill pill-other">
                          @{item.created_by_username || 'tim'}
                        </span>
                      </td>
                      <td>{item.whatsapp_number || '-'}</td>
                      <td className="text-truncate" style={{ maxWidth: '200px' }}>
                        <div className="d-flex align-items-center gap-1">
                          <span className="text-truncate">
                            {item.notes || 'Tidak ada catatan'}
                          </span>
                          {notesCount > 0 && (
                            <span
                              className="badge bg-secondary-subtle text-secondary py-0 px-1 ms-1"
                              style={{ fontSize: '10px' }}
                              title={`${notesCount} riwayat interaksi`}
                            >
                              <MessageSquare size={10} className="me-1" />
                              {notesCount}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="text-center text-muted">
                        <ChevronRight size={14} />
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
      <div className="mobile-card-list d-block d-md-none">
        {loading ? (
          <div className="notion-card text-center py-4 text-muted">
            Memuat data prospek...
          </div>
        ) : filteredProspects.length === 0 ? (
          <div className="notion-card text-center py-4">
            <div className="text-muted mb-2">
              Belum ada prospek yang sesuai dengan pencarian/filter.
            </div>
            <button
              type="button"
              className="btn-notion-outline"
              onClick={() => setIsAddModalOpen(true)}
            >
              <Plus size={14} />
              <span>Tambah Prospek Baru</span>
            </button>
          </div>
        ) : (
          filteredProspects.map((item) => {
            const isSelected = selectedProspectId === item.id;
            const fuBadge = getFollowUpBadgeMeta(
              item.next_follow_up_date,
              item.status
            );
            const notesCount = Array.isArray(item.follow_up_notes)
              ? item.follow_up_notes.length
              : 0;
            const cleanPhone = normalizeWhatsAppNumber(item.whatsapp_number);

            return (
              <div
                key={item.id}
                className="mobile-data-card"
                style={{
                  borderLeft: isSelected
                    ? '4px solid var(--notion-accent)'
                    : undefined,
                  backgroundColor: isSelected ? '#f8fafc' : '#ffffff',
                }}
              >
                {/* Header: Title & Badges */}
                <div className="mobile-data-card-header">
                  <div className="flex-grow-1 overflow-hidden pe-2">
                    <div
                      className="mobile-data-card-title text-truncate"
                      onClick={() => setSelectedProspectId(item.id)}
                      style={{ cursor: 'pointer' }}
                    >
                      {item.client_name}
                    </div>
                    <div className="d-flex flex-wrap align-items-center gap-1 mt-1">
                      <span
                        className={`notion-pill ${getPlatformBadgeClass(
                          item.source_platform
                        )}`}
                      >
                        {item.source_platform}
                      </span>
                      <span
                        className={`notion-pill ${getStatusBadgeClass(
                          item.status
                        )}`}
                      >
                        {item.status}
                      </span>
                      {item.status === 'Deal' && (
                        <span
                          className={`badge rounded-pill ${
                            item.management_type === 'project_only'
                              ? 'bg-warning-subtle text-warning-emphasis border border-warning-subtle'
                              : 'bg-primary-subtle text-primary border border-primary-subtle'
                          }`}
                          style={{ fontSize: '9.5px' }}
                        >
                          {item.management_type === 'project_only'
                            ? '⚡ Project Saja'
                            : '🏢 Full Managed'}
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedProspectId(item.id)}
                    className="btn btn-sm btn-light border py-1 px-2 flex-shrink-0"
                    style={{ fontSize: '11.5px' }}
                  >
                    Detail &rarr;
                  </button>
                </div>

                {/* Body Details */}
                <div className="mobile-data-card-body">
                  {fuBadge && (
                    <div className="d-flex align-items-center gap-2">
                      <span
                        className={`badge rounded-pill ${fuBadge.pillClass} px-2 py-1`}
                        style={{ fontSize: '10.5px' }}
                      >
                        ● {fuBadge.label}
                      </span>
                      <span className="text-muted" style={{ fontSize: '11px' }}>
                        {item.next_follow_up_date}
                      </span>
                    </div>
                  )}

                  <div
                    className="d-flex align-items-center justify-content-between gap-2 text-secondary"
                    style={{ fontSize: '12px' }}
                  >
                    <span className="text-truncate">
                      Akun: <strong>{item.social_handle || '-'}</strong>
                    </span>
                    <span className="text-muted">
                      Oleh: @{item.created_by_username || 'tim'}
                    </span>
                  </div>

                  {item.notes && (
                    <div
                      className="p-2 rounded bg-light border text-truncate text-secondary"
                      style={{ fontSize: '11.5px' }}
                    >
                      {item.notes}
                    </div>
                  )}
                </div>

                {/* Footer Quick Action (Direct WhatsApp Button) */}
                <div className="mobile-data-card-footer">
                  <div className="d-flex align-items-center gap-2">
                    {cleanPhone ? (
                      <a
                        href={`https://wa.me/${cleanPhone}`}
                        target="_blank"
                        rel="noreferrer"
                        className="btn btn-sm btn-success py-1 px-2 d-inline-flex align-items-center gap-1 text-decoration-none shadow-sm"
                        style={{ fontSize: '11.5px', fontWeight: 600 }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Phone size={12} />
                        <span>Chat WA ({cleanPhone})</span>
                      </a>
                    ) : (
                      <span className="text-muted" style={{ fontSize: '11px' }}>
                        Tidak ada no. WA
                      </span>
                    )}
                  </div>

                  <div className="d-flex align-items-center gap-1">
                    {notesCount > 0 && (
                      <span
                        className="badge bg-secondary-subtle text-secondary py-1 px-2"
                        style={{ fontSize: '10.5px' }}
                      >
                        <MessageSquare size={10} className="me-1" />
                        {notesCount} touchpoint
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Modal Tambah Prospek */}
      <AddProspectModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onAdd={addProspect}
      />

      {/* Side-Peek Detail Drawer */}
      <ProspectDetailDrawer
        prospect={selectedProspect}
        onClose={() => setSelectedProspectId(null)}
        onSave={updateProspect}
        onDelete={handleDeleteProspect}
      />
    </div>
  );
}