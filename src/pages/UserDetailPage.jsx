import React, { useState, useMemo } from 'react';
import { useParams, useNavigate, NavLink } from 'react-router-dom';
import {
  ArrowLeft,
  User,
  Clock,
  Target,
  Calendar,
  CheckCircle2,
  TrendingUp,
  Wallet,
  Phone,
  MessageSquare,
  Award,
  AlertCircle,
  FileText,
  Download,
  Sliders,
  Check,
  ExternalLink,
  ShieldCheck,
  Filter,
  Search,
  ChevronRight,
  BarChart2,
  Star,
  Flame,
  Sparkles,
  Zap,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useAttendance } from '../context/AttendanceContext';
import { useProspects } from '../context/ProspectsContext';
import {
  formatDurationHMS,
  formatDurationHuman,
  formatRupiah,
  formatUSD,
  formatCurrency,
  getTodayDateString,
  getOffsetDateString,
  exportToCSV,
  normalizeWhatsAppNumber,
  getPlatformBadgeClass,
  getStatusBadgeClass,
  calculateCommission,
  getFollowUpBadgeMeta,
  sanitizeSafeUrl,
} from '../lib/supabase';

export default function UserDetailPage() {
  const { username } = useParams();
  const navigate = useNavigate();
  const { profile, teamUsers, adminUpdateUser } = useAuth();
  const { attendanceLogs, nowTick, calculateLiveSeconds } = useAttendance();
  const { allTeamProspects, prospects: userScopedProspects, dealClients, updateProspect } = useProspects();

  const prospects = allTeamProspects || userScopedProspects || [];
  const todayDate = getTodayDateString();

  // Active detail subtab
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'prospects' | 'deals' | 'attendance' | 'evaluation'
  const [chartPeriod, setChartPeriod] = useState(14); // 7, 14, 30 days
  const [prospectSearch, setProspectSearch] = useState('');
  const [prospectStatusFilter, setProspectStatusFilter] = useState('ALL');
  const [evalNotesInput, setEvalNotesInput] = useState('');
  const [savingEval, setSavingEval] = useState(false);
  const [evalSuccess, setEvalSuccess] = useState(false);

  // Find target user from teamUsers or synthesize from prospects/logs
  const targetUser = useMemo(() => {
    if (!username) return null;
    const unameLower = username.toLowerCase();
    const found = (teamUsers || []).find(
      (u) => (u.username || '').toLowerCase() === unameLower
    );
    if (found) return found;

    // Check if user is current admin
    if ((profile?.username || '').toLowerCase() === unameLower) {
      return profile;
    }

    // Synthesize fallback
    return {
      username: username,
      email: `${username}@atier-team.id`,
      role: 'user',
      status: 'active',
      tier: 'Junior Hunter',
      targetDailyHours: 3,
      targetDailyProspects: 10,
      customCommissionRate: 0.15,
      evaluationNotes: '',
    };
  }, [teamUsers, username, profile]);

  // Synchronize initial evaluation notes cleanly
  React.useEffect(() => {
    setEvalNotesInput(targetUser?.evaluationNotes || '');
  }, [targetUser?.evaluationNotes, targetUser?.id, targetUser?.username]);

  const unameLower = (username || '').toLowerCase();
  const targetUserId = targetUser?.id;

  // Filter logs for this user (support both username & user_id)
  const userLogs = useMemo(() => {
    return (attendanceLogs || [])
      .filter((l) => {
        const matchUname = (l.username || '').toLowerCase() === unameLower;
        const matchId = targetUserId && l.user_id === targetUserId;
        return matchUname || matchId;
      })
      .sort((a, b) => (b.work_date || '').localeCompare(a.work_date || ''));
  }, [attendanceLogs, unameLower, targetUserId]);

  // Filter prospects for this user (support both created_by_username & user_id)
  const userProspects = useMemo(() => {
    return (prospects || []).filter((p) => {
      const matchUname = (p.created_by_username || '').toLowerCase() === unameLower;
      const matchId = targetUserId && p.user_id === targetUserId;
      return matchUname || matchId;
    });
  }, [prospects, unameLower, targetUserId]);

  // Filter deals for this user
  const userDeals = useMemo(() => {
    return userProspects.filter((p) => p.status === 'Deal');
  }, [userProspects]);

  // User financial statistics
  const userFinances = useMemo(() => {
    let cashInIdr = 0;
    let cashInUsd = 0;
    let totalProjectValIdr = 0;
    let totalProjectValUsd = 0;
    let commEarnedIdr = 0;
    let commEarnedUsd = 0;
    let commPaidIdr = 0;
    let commPaidUsd = 0;

    userDeals.forEach((d) => {
      const isUsd = (d.currency || 'IDR') === 'USD';
      const val = Number(d.project_value) || 0;
      const dp = d.payment_status === 'Lunas' ? val : Number(d.dp_amount) || 0;
      const rate = d.commission?.hunter_rate !== undefined ? Number(d.commission.hunter_rate) : (targetUser?.customCommissionRate || 0.15);
      const hunterAmt = Math.round((d.payment_status === 'Lunas' ? val : dp) * rate);
      const isPaid = Boolean(d.commission?.hunter_paid || d.commission?.status === 'paid');

      if (isUsd) {
        totalProjectValUsd += val;
        cashInUsd += dp;
        commEarnedUsd += hunterAmt;
        if (isPaid) commPaidUsd += hunterAmt;
      } else {
        totalProjectValIdr += val;
        cashInIdr += dp;
        commEarnedIdr += hunterAmt;
        if (isPaid) commPaidIdr += hunterAmt;
      }
    });

    return {
      cashInIdr,
      cashInUsd,
      totalProjectValIdr,
      totalProjectValUsd,
      commEarnedIdr,
      commEarnedUsd,
      commPaidIdr,
      commPaidUsd,
      commPendingIdr: Math.max(0, commEarnedIdr - commPaidIdr),
      commPendingUsd: Math.max(0, commEarnedUsd - commPaidUsd),
    };
  }, [userDeals, targetUser]);

  // Group logs by work_date for accurate day-level metrics & multi-session support
  const dailyWorkMap = useMemo(() => {
    const map = new Map();
    userLogs.forEach((l) => {
      const d = l.work_date;
      if (!d) return;
      const current = map.get(d) || { totalSec: 0, logs: [], isRunning: false };
      const sec = calculateLiveSeconds(l, nowTick);
      current.totalSec += sec;
      current.logs.push(l);
      if (l.status === 'running') current.isRunning = true;
      map.set(d, current);
    });
    return map;
  }, [userLogs, nowTick, calculateLiveSeconds]);

  // Overall time & attendance stats (aggregated per unique work day)
  const timeStats = useMemo(() => {
    const totalSec = userLogs.reduce(
      (acc, l) => acc + calculateLiveSeconds(l, nowTick),
      0
    );
    const todayData = dailyWorkMap.get(todayDate) || { totalSec: 0, isRunning: false };
    const todaySec = todayData.totalSec;
    const isTodayRunning = todayData.isRunning;
    const daysWorked = dailyWorkMap.size;
    const avgSecPerDay = daysWorked > 0 ? Math.round(totalSec / daysWorked) : 0;

    const targetSec = (Number(targetUser?.targetDailyHours) || 3) * 3600;
    let targetMetDays = 0;
    dailyWorkMap.forEach((day) => {
      if (day.totalSec >= targetSec) targetMetDays++;
    });

    return {
      totalSec,
      todaySec,
      isTodayRunning,
      daysWorked,
      avgSecPerDay,
      targetMetDays,
      targetMetPct: daysWorked > 0 ? Math.round((targetMetDays / daysWorked) * 100) : 0,
    };
  }, [userLogs, dailyWorkMap, todayDate, targetUser]);

  // Daily Chart Data for the last N days (timezone-safe via getOffsetDateString)
  const chartData = useMemo(() => {
    const result = [];
    const targetHours = Number(targetUser?.targetDailyHours) || 3;

    for (let i = chartPeriod - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = getOffsetDateString(-i);
      const dayData = dailyWorkMap.get(dateStr);
      const sec = dayData ? dayData.totalSec : 0;
      const hours = Number((sec / 3600).toFixed(1));
      const isTargetMet = hours >= targetHours;
      const dayName = d.toLocaleDateString('id-ID', { weekday: 'short' });
      const label = `${d.getDate()}/${d.getMonth() + 1}`;
      const primaryTag = dayData?.logs?.[0]?.focus_tag || '-';

      result.push({
        dateStr,
        dayName,
        label,
        hours,
        sec,
        isTargetMet,
        status: dayData?.isRunning ? 'running' : sec > 0 ? 'completed' : 'empty',
        tag: primaryTag,
      });
    }

    const maxHours = Math.max(targetHours * 1.5, ...result.map((r) => r.hours), 4);
    return { list: result, maxHours, targetHours };
  }, [dailyWorkMap, chartPeriod, targetUser]);

  // Prospects status breakdown
  const prospectBreakdown = useMemo(() => {
    const total = userProspects.length;
    const baru = userProspects.filter((p) => p.status === 'Baru').length;
    const dihubungi = userProspects.filter((p) => p.status === 'Dihubungi').length;
    const followUp = userProspects.filter((p) => p.status === 'Follow Up').length;
    const negosiasi = userProspects.filter((p) => p.status === 'Negosiasi').length;
    const deal = userProspects.filter((p) => p.status === 'Deal').length;
    const batal = userProspects.filter((p) => p.status === 'Batal').length;
    const closingRate = total > 0 ? Math.min(100, Math.round((deal / total) * 100)) : 0;

    return { total, baru, dihubungi, followUp, negosiasi, deal, batal, closingRate };
  }, [userProspects]);

  // Filtered prospects for Tab 2
  const filteredUserProspects = useMemo(() => {
    return userProspects.filter((p) => {
      const q = prospectSearch.toLowerCase();
      const matchSearch =
        (p.client_name || '').toLowerCase().includes(q) ||
        (p.social_handle || '').toLowerCase().includes(q) ||
        (p.whatsapp_number || '').includes(q) ||
        (p.notes || '').toLowerCase().includes(q);

      const matchStatus =
        prospectStatusFilter === 'ALL' || p.status === prospectStatusFilter;

      return matchSearch && matchStatus;
    });
  }, [userProspects, prospectSearch, prospectStatusFilter]);

  // Handle Save Evaluation Notes
  async function handleSaveEvaluation() {
    if (!targetUser) return;
    setSavingEval(true);
    try {
      await adminUpdateUser(targetUser.id || targetUser.username, {
        evaluationNotes: evalNotesInput.trim(),
      });
      setEvalSuccess(true);
      setTimeout(() => setEvalSuccess(false), 3000);
    } catch (err) {
      alert('Gagal menyimpan evaluasi: ' + (err.message || 'Error'));
    } finally {
      setSavingEval(false);
    }
  }

  // Export User Full Report
  function handleExportUserReport() {
    exportToCSV(`laporan-personel-${username}`, userProspects, [
      { header: 'Nama Klien / Bisnis', key: 'client_name' },
      { header: 'Sumber Platform', key: 'source_platform' },
      { header: 'Sosmed / Web', key: 'social_handle' },
      { header: 'WhatsApp', key: 'whatsapp_number' },
      { header: 'Status', key: 'status' },
      { header: 'Tanggal Dibuat', transform: (r) => (r.created_at || '').split('T')[0] },
      { header: 'Jadwal Follow-Up', key: 'next_follow_up_date' },
      { header: 'Catatan Touchpoint', key: 'notes' },
    ]);
  }

  if (!targetUser) {
    return (
      <div className="notion-page-container text-center py-5">
        <div className="text-muted mb-3">Personel tidak ditemukan</div>
        <button
          type="button"
          className="btn-notion-primary"
          onClick={() => navigate('/admin/users-lifecycle')}
        >
          <ArrowLeft size={14} />
          <span>Kembali ke User Berkelanjutan</span>
        </button>
      </div>
    );
  }

  return (
    <div className="notion-page-container">
      {/* Navigation Breadcrumb & Back Button */}
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
        <NavLink
          to="/admin/users-lifecycle"
          className="btn-notion-outline d-inline-flex align-items-center gap-1 text-decoration-none"
          style={{ fontSize: '12.5px' }}
        >
          <ArrowLeft size={14} />
          <span>Kembali ke User Berkelanjutan</span>
        </NavLink>

        <div className="d-flex align-items-center gap-2">
          <button
            type="button"
            className="btn-notion-outline"
            onClick={handleExportUserReport}
            title="Download seluruh data prospek personel ini ke CSV"
          >
            <Download size={14} />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Profile Card Header */}
      <div className="notion-card mb-4" style={{ backgroundColor: '#ffffff', borderLeft: '4px solid #2383e2' }}>
        <div className="d-flex flex-wrap align-items-center justify-content-between gap-3">
          <div className="d-flex align-items-center gap-3">
            <span
              className="notion-workspace-badge"
              style={{ width: '48px', height: '48px', fontSize: '18px', borderRadius: '12px' }}
            >
              {String(targetUser.username || 'US').slice(0, 2).toUpperCase()}
            </span>
            <div>
              <div className="d-flex align-items-center gap-2">
                <h1 className="h4 fw-bold mb-0">@{targetUser.username}</h1>
                <span
                  className="badge rounded-pill"
                  style={{
                    backgroundColor: targetUser.role === 'admin' ? '#e0f2fe' : '#f1f1ef',
                    color: targetUser.role === 'admin' ? '#0369a1' : '#37352f',
                    fontSize: '11px',
                  }}
                >
                  {targetUser.role === 'admin' ? '👑 Administrator' : 'Sales Hunter'}
                </span>
                <span
                  className={`badge rounded-pill ${
                    targetUser.status === 'suspended'
                      ? 'bg-warning text-dark'
                      : targetUser.status === 'banned'
                      ? 'bg-danger text-white'
                      : targetUser.status === 'probation'
                      ? 'bg-warning-subtle text-dark border'
                      : 'bg-success text-white'
                  }`}
                  style={{ fontSize: '11px' }}
                >
                  {targetUser.status === 'suspended'
                    ? '🟠 Suspend'
                    : targetUser.status === 'banned'
                    ? '🔴 Banned'
                    : targetUser.status === 'probation'
                    ? '🟡 Probation'
                    : '🟢 Aktif'}
                </span>
              </div>
              <div className="text-muted mt-1" style={{ fontSize: '12.5px' }}>
                Email: <strong>{targetUser.email || '-'}</strong> • Tier:{' '}
                <span className="fw-semibold text-dark">{targetUser.tier || 'Junior Hunter'}</span> • Target Harian:{' '}
                <strong>{targetUser.targetDailyHours || 3} Jam</strong> &amp;{' '}
                <strong>{targetUser.targetDailyProspects || 10} Prospek</strong> (Komisi:{' '}
                {Math.round((targetUser.customCommissionRate || 0.15) * 100)}%)
              </div>
            </div>
          </div>

          <div className="d-flex align-items-center gap-2">
            <div className="p-2 px-3 rounded bg-light border text-end">
              <div className="text-muted" style={{ fontSize: '11px' }}>Status Jam Kerja Hari Ini</div>
              <div
                className="fw-bold"
                style={{
                  fontSize: '13.5px',
                  color: timeStats.isTodayRunning
                    ? '#166534'
                    : timeStats.todaySec > 0
                    ? '#1e40af'
                    : '#6b7280',
                }}
              >
                {timeStats.isTodayRunning
                  ? `● Sedang Kerja: ${formatDurationHuman(timeStats.todaySec)}`
                  : timeStats.todaySec > 0
                  ? `✓ Selesai: ${formatDurationHuman(timeStats.todaySec)}`
                  : 'Belum Absen Hari Ini'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 4 Executive KPI Cards */}
      <div className="row g-3 mb-4">
        {/* KPI 1: Jam Kerja */}
        <div className="col-6 col-lg-3">
          <div className="notion-card h-100" style={{ backgroundColor: '#f8fafc', borderColor: '#cbd5e1' }}>
            <div className="notion-stat-label">
              <Clock size={14} className="text-primary" />
              <span>Total Jam Kerja Akumulasi</span>
            </div>
            <div className="notion-stat-value">
              {formatDurationHuman(timeStats.totalSec)}
            </div>
            <div className="text-muted mt-1" style={{ fontSize: '11.5px' }}>
              Rata-rata <strong>{formatDurationHuman(timeStats.avgSecPerDay)}</strong> / hari ({timeStats.daysWorked} hari aktif)
            </div>
            <div className="progress mt-2" style={{ height: '4px' }}>
              <div
                className="progress-bar bg-primary"
                style={{ width: `${Math.min(100, timeStats.targetMetPct)}%` }}
              />
            </div>
          </div>
        </div>

        {/* KPI 2: Prospek */}
        <div className="col-6 col-lg-3">
          <div className="notion-card h-100" style={{ backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' }}>
            <div className="notion-stat-label" style={{ color: '#166534' }}>
              <Target size={14} />
              <span>Prospek yang Ditambahkan</span>
            </div>
            <div className="notion-stat-value" style={{ color: '#166534' }}>
              {prospectBreakdown.total} <span className="fw-normal text-muted" style={{ fontSize: '13px' }}>Klien</span>
            </div>
            <div className="d-flex align-items-center gap-2 mt-1" style={{ fontSize: '11.5px' }}>
              <span className="text-success fw-semibold">🎯 Deal: {prospectBreakdown.deal}</span>
              <span className="text-secondary">● Follow-up: {prospectBreakdown.followUp + prospectBreakdown.negosiasi}</span>
            </div>
          </div>
        </div>

        {/* KPI 3: Closing Rate & Kontrak */}
        <div className="col-6 col-lg-3">
          <div className="notion-card h-100" style={{ backgroundColor: '#eff6ff', borderColor: '#bfdbfe' }}>
            <div className="notion-stat-label" style={{ color: '#1e40af' }}>
              <TrendingUp size={14} />
              <span>Closing Rate &amp; Nilai Kontrak</span>
            </div>
            <div className="notion-stat-value" style={{ color: '#1e3a8a' }}>
              {prospectBreakdown.closingRate}%
            </div>
            <div className="mt-1 fw-semibold text-primary" style={{ fontSize: '12px' }}>
              Total Deal: {formatRupiah(userFinances.totalProjectValIdr)}
              {userFinances.totalProjectValUsd > 0 && ` + ${formatUSD(userFinances.totalProjectValUsd)}`}
            </div>
          </div>
        </div>

        {/* KPI 4: Komisi Hunter */}
        <div className="col-6 col-lg-3">
          <div className="notion-card h-100" style={{ backgroundColor: '#fffbeb', borderColor: '#fde68a' }}>
            <div className="notion-stat-label" style={{ color: '#92400e' }}>
              <Wallet size={14} />
              <span>Hak Komisi Sales Hunter</span>
            </div>
            <div className="notion-stat-value" style={{ color: '#92400e' }}>
              {formatRupiah(userFinances.commEarnedIdr)}
            </div>
            <div className="d-flex align-items-center gap-2 mt-1" style={{ fontSize: '11.5px' }}>
              <span className="text-success fw-semibold">✓ Cair: {formatRupiah(userFinances.commPaidIdr)}</span>
              {userFinances.commPendingIdr > 0 && (
                <span className="text-warning-emphasis">⏳ Pending: {formatRupiah(userFinances.commPendingIdr)}</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Visual Chart Jam Kerja Personel */}
      <div className="notion-card mb-4">
        <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 pb-3 mb-3 border-bottom">
          <div className="d-flex align-items-center gap-2">
            <BarChart2 size={18} className="text-primary" />
            <div>
              <h2 className="h6 fw-bold mb-0">Grafik Jam Kerja Harian @{username}</h2>
              <div className="text-muted" style={{ fontSize: '12px' }}>
                Garis putus-putus menunjukkan target harian minimal ({chartData.targetHours} Jam / hari)
              </div>
            </div>
          </div>

          <div className="d-flex align-items-center gap-1">
            {[
              { label: '7 Hari', val: 7 },
              { label: '14 Hari', val: 14 },
              { label: '30 Hari', val: 30 },
            ].map((p) => (
              <button
                key={p.val}
                type="button"
                className={`btn btn-sm py-1 px-2 ${
                  chartPeriod === p.val ? 'btn-dark text-white' : 'btn-light border'
                }`}
                style={{ fontSize: '11.5px' }}
                onClick={() => setChartPeriod(p.val)}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* SVG / HTML5 Bar Chart */}
        <div className="position-relative pt-4 pb-2" style={{ height: '220px', minHeight: '200px' }}>
          {/* Target Reference Line */}
          <div
            className="position-absolute w-100 d-flex align-items-center"
            style={{
              bottom: `${Math.min(92, Math.max(8, (chartData.targetHours / chartData.maxHours) * 100))}%`,
              left: 0,
              zIndex: 2,
              pointerEvents: 'none',
            }}
          >
            <div className="border-bottom border-danger w-100" style={{ borderStyle: 'dashed !important' }} />
            <span
              className="badge bg-danger text-white position-absolute end-0"
              style={{ fontSize: '9.5px', transform: 'translateY(-50%)' }}
            >
              Target: {chartData.targetHours}j
            </span>
          </div>

          {/* Bars Container */}
          <div className="d-flex align-items-end justify-content-between h-100 gap-1 px-1">
            {chartData.list.map((item, idx) => {
              const heightPct = Math.min(100, Math.max(4, (item.hours / chartData.maxHours) * 100));
              const isOver = item.hours > chartData.targetHours;

              return (
                <div
                  key={idx}
                  className="flex-grow-1 d-flex flex-column align-items-center h-100 justify-content-end group position-relative"
                  title={`${item.dateStr} (${item.dayName}): ${item.hours} Jam • Tag: ${item.tag}`}
                >
                  {/* Floating Tooltip Value on Hover */}
                  <div
                    className="fw-bold mb-1"
                    style={{
                      fontSize: '10px',
                      color: item.isTargetMet ? '#166534' : item.hours > 0 ? '#37352f' : '#cbd5e1',
                    }}
                  >
                    {item.hours > 0 ? `${item.hours}j` : '0'}
                  </div>

                  {/* Bar */}
                  <div
                    className="w-100 rounded-top"
                    style={{
                      height: `${heightPct}%`,
                      backgroundColor: isOver
                        ? '#16a34a'
                        : item.isTargetMet
                        ? '#22c55e'
                        : item.hours > 0
                        ? '#94a3b8'
                        : '#f1f5f9',
                      minHeight: '4px',
                      transition: 'height 0.25s ease',
                    }}
                  />

                  {/* Day Label */}
                  <div className="mt-2 text-center text-muted" style={{ fontSize: '10px', lineHeight: 1.1 }}>
                    <div className="fw-semibold">{item.dayName}</div>
                    <div style={{ fontSize: '9px' }}>{item.label}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Chart Legend Footer */}
        <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 pt-3 mt-2 border-top text-muted" style={{ fontSize: '11.5px' }}>
          <div className="d-flex align-items-center gap-3">
            <span className="d-flex align-items-center gap-1">
              <span className="d-inline-block rounded-circle" style={{ width: '8px', height: '8px', backgroundColor: '#16a34a' }} />
              <span>Overwork / Target Terlampaui</span>
            </span>
            <span className="d-flex align-items-center gap-1">
              <span className="d-inline-block rounded-circle" style={{ width: '8px', height: '8px', backgroundColor: '#22c55e' }} />
              <span>Mencapai Target</span>
            </span>
            <span className="d-flex align-items-center gap-1">
              <span className="d-inline-block rounded-circle" style={{ width: '8px', height: '8px', backgroundColor: '#94a3b8' }} />
              <span>Di Bawah Target</span>
            </span>
          </div>

          <div className="fw-medium text-dark">
            Hari Mencapai Target: <strong>{timeStats.targetMetDays}</strong> dari <strong>{timeStats.daysWorked}</strong> hari kerja aktif ({timeStats.targetMetPct}%)
          </div>
        </div>
      </div>

      {/* Sub-Tabs: Seluruh Aktivitas Lengkap User */}
      <div className="scrollable-chips-bar p-1 rounded-2 mb-4 bg-light border" style={{ borderColor: 'var(--notion-border)' }}>
        <button
          type="button"
          className={`btn btn-sm flex-shrink-0 d-inline-flex align-items-center gap-1.5 px-3 py-2 rounded border-0 ${
            activeTab === 'overview' ? 'bg-dark text-white fw-semibold' : 'text-secondary'
          }`}
          style={{ fontSize: '12.5px' }}
          onClick={() => setActiveTab('overview')}
        >
          <Sparkles size={13} />
          <span>Ringkasan Performa</span>
        </button>

        <button
          type="button"
          className={`btn btn-sm flex-shrink-0 d-inline-flex align-items-center gap-1.5 px-3 py-2 rounded border-0 ${
            activeTab === 'prospects' ? 'bg-dark text-white fw-semibold' : 'text-secondary'
          }`}
          style={{ fontSize: '12.5px' }}
          onClick={() => setActiveTab('prospects')}
        >
          <Target size={13} />
          <span>Daftar Prospek ({userProspects.length})</span>
        </button>

        <button
          type="button"
          className={`btn btn-sm flex-shrink-0 d-inline-flex align-items-center gap-1.5 px-3 py-2 rounded border-0 ${
            activeTab === 'deals' ? 'bg-dark text-white fw-semibold' : 'text-secondary'
          }`}
          style={{ fontSize: '12.5px' }}
          onClick={() => setActiveTab('deals')}
        >
          <Wallet size={13} />
          <span>Klien Deal Closing ({userDeals.length})</span>
        </button>

        <button
          type="button"
          className={`btn btn-sm flex-shrink-0 d-inline-flex align-items-center gap-1.5 px-3 py-2 rounded border-0 ${
            activeTab === 'attendance' ? 'bg-dark text-white fw-semibold' : 'text-secondary'
          }`}
          style={{ fontSize: '12.5px' }}
          onClick={() => setActiveTab('attendance')}
        >
          <Clock size={13} />
          <span>Log Absensi Stopwatch ({userLogs.length})</span>
        </button>

        <button
          type="button"
          className={`btn btn-sm flex-shrink-0 d-inline-flex align-items-center gap-1.5 px-3 py-2 rounded border-0 ${
            activeTab === 'evaluation' ? 'bg-dark text-white fw-semibold' : 'text-secondary'
          }`}
          style={{ fontSize: '12.5px' }}
          onClick={() => setActiveTab('evaluation')}
        >
          <Sliders size={13} />
          <span>Evaluasi &amp; Catatan Admin</span>
        </button>
      </div>

      {/* ===================================================================
          TAB 1: RINGKASAN PERFORMA & TOUCHPOINTS
      =================================================================== */}
      {activeTab === 'overview' && (
        <div className="row g-3">
          <div className="col-12 col-lg-6">
            <div className="notion-card h-100">
              <h3 className="h6 fw-bold mb-3 d-flex align-items-center gap-2">
                <Target size={16} className="text-primary" />
                <span>Distribusi Status Prospek</span>
              </h3>

              <div className="d-flex flex-column gap-2.5">
                {[
                  { label: 'Prospek Baru', count: prospectBreakdown.baru, color: '#64748b', bg: '#f1f5f9' },
                  { label: 'Sudah Dihubungi', count: prospectBreakdown.dihubungi, color: '#0284c7', bg: '#e0f2fe' },
                  { label: 'Sedang Follow Up', count: prospectBreakdown.followUp, color: '#d97706', bg: '#fef3c7' },
                  { label: 'Negosiasi Penawaran', count: prospectBreakdown.negosiasi, color: '#7c3aed', bg: '#f3e8ff' },
                  { label: 'Closing Deal 🎉', count: prospectBreakdown.deal, color: '#16a34a', bg: '#dcfce7' },
                  { label: 'Batal / Belum Minat', count: prospectBreakdown.batal, color: '#dc2626', bg: '#fee2e2' },
                ].map((item, idx) => {
                  const pct = prospectBreakdown.total > 0 ? Math.round((item.count / prospectBreakdown.total) * 100) : 0;
                  return (
                    <div key={idx} className="p-2.5 rounded border d-flex align-items-center justify-content-between" style={{ backgroundColor: item.bg }}>
                      <div className="d-flex align-items-center gap-2">
                        <span className="fw-semibold" style={{ fontSize: '13px', color: item.color }}>
                          {item.label}
                        </span>
                      </div>
                      <div className="d-flex align-items-center gap-2">
                        <span className="fw-bold" style={{ fontSize: '14px', color: item.color }}>
                          {item.count}
                        </span>
                        <span className="text-muted" style={{ fontSize: '11px' }}>
                          ({pct}%)
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="col-12 col-lg-6">
            <div className="notion-card h-100 d-flex flex-column justify-content-between">
              <div>
                <h3 className="h6 fw-bold mb-3 d-flex align-items-center gap-2">
                  <Award size={16} className="text-warning" />
                  <span>Kepatuhan Target &amp; Evaluasi Berkala</span>
                </h3>

                <div className="p-3 rounded bg-light border mb-3">
                  <div className="d-flex justify-content-between align-items-center mb-1">
                    <span className="fw-semibold text-dark" style={{ fontSize: '12.5px' }}>Target Jam Kerja Harian</span>
                    <span className="badge bg-primary text-white" style={{ fontSize: '11px' }}>{targetUser.targetDailyHours || 3} Jam / hari</span>
                  </div>
                  <div className="text-muted" style={{ fontSize: '11.5px' }}>
                    Tercapai pada {timeStats.targetMetDays} dari {timeStats.daysWorked} hari kerja ({timeStats.targetMetPct}%)
                  </div>
                </div>

                <div className="p-3 rounded bg-light border mb-3">
                  <div className="d-flex justify-content-between align-items-center mb-1">
                    <span className="fw-semibold text-dark" style={{ fontSize: '12.5px' }}>Target Prospek Harian</span>
                    <span className="badge bg-dark text-white" style={{ fontSize: '11px' }}>{targetUser.targetDailyProspects || 10} Prospek / hari</span>
                  </div>
                  <div className="text-muted" style={{ fontSize: '11.5px' }}>
                    Total {prospectBreakdown.total} prospek telah dihimpun seumur hidup
                  </div>
                </div>

                <div className="p-3 rounded bg-light border">
                  <div className="fw-semibold text-dark mb-1" style={{ fontSize: '12.5px' }}>Evaluasi Terakhir Admin:</div>
                  <p className="text-secondary mb-0" style={{ fontSize: '12px', lineHeight: 1.5 }}>
                    {targetUser.evaluationNotes || <span className="text-muted italic">Belum ada evaluasi berkala yang dicatat. Buka tab "Evaluasi &amp; Catatan Admin" untuk menambahkan.</span>}
                  </p>
                </div>
              </div>

              <div className="pt-3 border-top mt-3 text-end">
                <button
                  type="button"
                  className="btn-notion-outline"
                  onClick={() => setActiveTab('evaluation')}
                >
                  <Sliders size={13} />
                  <span>Update Catatan Evaluasi &rarr;</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================
          TAB 2: DAFTAR PROSPEK YANG DIINPUT
      =================================================================== */}
      {activeTab === 'prospects' && (
        <div>
          {/* Filter Toolbar */}
          <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
            <div className="d-flex flex-wrap align-items-center gap-2 flex-grow-1">
              <div className="position-relative" style={{ maxWidth: '300px', flex: '1 1 200px' }}>
                <Search size={14} className="position-absolute text-muted" style={{ left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  type="text"
                  className="notion-input w-100"
                  style={{ paddingLeft: '32px' }}
                  placeholder="Cari prospek @username..."
                  value={prospectSearch}
                  onChange={(e) => setProspectSearch(e.target.value)}
                />
              </div>

              <select
                className="notion-select"
                value={prospectStatusFilter}
                onChange={(e) => setProspectStatusFilter(e.target.value)}
              >
                <option value="ALL">Semua Status ({userProspects.length})</option>
                <option value="Baru">Baru</option>
                <option value="Dihubungi">Dihubungi</option>
                <option value="Follow Up">Follow Up</option>
                <option value="Negosiasi">Negosiasi</option>
                <option value="Deal">Deal (Closing)</option>
                <option value="Batal">Batal</option>
              </select>
            </div>

            <div className="text-muted" style={{ fontSize: '12px' }}>
              Menampilkan <strong>{filteredUserProspects.length}</strong> prospek
            </div>
          </div>

          {/* Desktop Table View */}
          <div className="notion-table-wrapper d-none d-md-block">
            <div className="table-responsive">
              <table className="notion-table">
                <thead>
                  <tr>
                    <th style={{ minWidth: '180px' }}>Nama Klien / Bisnis</th>
                    <th style={{ minWidth: '130px' }}>Platform</th>
                    <th style={{ minWidth: '150px' }}>Akun / Link Sosmed</th>
                    <th style={{ minWidth: '130px' }}>WhatsApp</th>
                    <th style={{ minWidth: '110px' }}>Status</th>
                    <th style={{ minWidth: '140px' }}>Jadwal Follow-Up</th>
                    <th style={{ minWidth: '120px' }}>Tanggal Input</th>
                    <th style={{ minWidth: '180px' }}>Catatan</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUserProspects.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="text-center py-4 text-muted">
                        Tidak ada data prospek yang cocok dengan pencarian/filter.
                      </td>
                    </tr>
                  ) : (
                    filteredUserProspects.map((p) => {
                      const cleanPhone = normalizeWhatsAppNumber(p.whatsapp_number);
                      const fuBadge = getFollowUpBadgeMeta(p.next_follow_up_date, p.status);

                      return (
                        <tr key={p.id}>
                          <td>
                            <div className="fw-semibold">{p.client_name}</div>
                          </td>
                          <td>
                            <span className={`notion-pill ${getPlatformBadgeClass(p.source_platform)}`}>
                              {p.source_platform}
                            </span>
                          </td>
                          <td className="text-truncate" style={{ maxWidth: '160px' }}>
                            {p.social_handle || '-'}
                          </td>
                          <td>
                            {cleanPhone ? (
                              <a
                                href={`https://wa.me/${cleanPhone}`}
                                target="_blank"
                                rel="noreferrer"
                                className="btn btn-sm btn-outline-success py-0 px-2 d-inline-flex align-items-center gap-1 text-decoration-none"
                                style={{ fontSize: '11px' }}
                              >
                                <Phone size={10} />
                                <span>{cleanPhone}</span>
                              </a>
                            ) : (
                              <span className="text-muted" style={{ fontSize: '11px' }}>-</span>
                            )}
                          </td>
                          <td>
                            <span className={`notion-pill ${getStatusBadgeClass(p.status)}`}>
                              {p.status}
                            </span>
                          </td>
                          <td>
                            {fuBadge ? (
                              <span className={`badge rounded-pill ${fuBadge.pillClass}`} style={{ fontSize: '10.5px' }}>
                                {fuBadge.label} ({p.next_follow_up_date})
                              </span>
                            ) : (
                              <span className="text-muted" style={{ fontSize: '11px' }}>-</span>
                            )}
                          </td>
                          <td className="text-muted" style={{ fontSize: '11.5px' }}>
                            {(p.created_at || '').split('T')[0] || '-'}
                          </td>
                          <td className="text-truncate" style={{ maxWidth: '200px', fontSize: '12px' }}>
                            {p.notes || <span className="text-muted">-</span>}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile Card View */}
          <div className="mobile-card-list d-block d-md-none">
            {filteredUserProspects.length === 0 ? (
              <div className="text-center py-4 text-muted bg-light rounded border" style={{ fontSize: '13px' }}>
                Tidak ada data prospek yang cocok dengan pencarian/filter.
              </div>
            ) : (
              filteredUserProspects.map((p) => {
              const cleanPhone = normalizeWhatsAppNumber(p.whatsapp_number);
              return (
                <div key={p.id} className="mobile-data-card">
                  <div className="mobile-data-card-header">
                    <div>
                      <div className="mobile-data-card-title">{p.client_name}</div>
                      <div className="d-flex align-items-center gap-1 mt-1">
                        <span className={`notion-pill ${getPlatformBadgeClass(p.source_platform)}`}>
                          {p.source_platform}
                        </span>
                        <span className={`notion-pill ${getStatusBadgeClass(p.status)}`}>
                          {p.status}
                        </span>
                      </div>
                    </div>
                    {cleanPhone && (
                      <a
                        href={`https://wa.me/${cleanPhone}`}
                        target="_blank"
                        rel="noreferrer"
                        className="btn btn-sm btn-success py-1 px-2 text-decoration-none d-inline-flex align-items-center gap-1"
                        style={{ fontSize: '11px' }}
                      >
                        <Phone size={11} />
                        <span>WA</span>
                      </a>
                    )}
                  </div>
                  <div className="mobile-data-card-body">
                    <div className="text-secondary" style={{ fontSize: '12px' }}>
                      Akun: <strong>{p.social_handle || '-'}</strong> • Dibuat: {(p.created_at || '').split('T')[0]}
                    </div>
                    {p.notes && (
                      <div className="p-2 rounded bg-light border text-truncate text-secondary" style={{ fontSize: '11.5px' }}>
                        {p.notes}
                      </div>
                    )}
                  </div>
                </div>
              );
            }))}
          </div>
        </div>
      )}

      {/* ===================================================================
          TAB 3: KLIEN DEAL CLOSING & KOMISI
      =================================================================== */}
      {activeTab === 'deals' && (
        <div>
          <div className="notion-table-wrapper d-none d-md-block">
            <div className="table-responsive">
              <table className="notion-table">
                <thead>
                  <tr>
                    <th style={{ minWidth: '180px' }}>Nama Klien Deal</th>
                    <th style={{ minWidth: '130px' }}>Tipe Manajemen</th>
                    <th style={{ minWidth: '85px' }}>Valuta</th>
                    <th style={{ minWidth: '130px' }}>Nilai Kontrak</th>
                    <th style={{ minWidth: '120px' }}>DP Masuk</th>
                    <th style={{ minWidth: '120px' }}>Status Bayar</th>
                    <th style={{ minWidth: '130px' }}>Komisi Hunter</th>
                    <th style={{ minWidth: '130px' }}>Status Pencairan</th>
                  </tr>
                </thead>
                <tbody>
                  {userDeals.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="text-center py-4 text-muted">
                        Belum ada proyek deal closing yang tercatat dari personel ini.
                      </td>
                    </tr>
                  ) : (
                    userDeals.map((d) => {
                      const curr = d.currency || 'IDR';
                      const val = Number(d.project_value) || 0;
                      const dp = d.payment_status === 'Lunas' ? val : Number(d.dp_amount) || 0;
                      const rate = d.commission?.hunter_rate !== undefined ? Number(d.commission.hunter_rate) : (targetUser?.customCommissionRate || 0.15);
                      const hunterAmt = Math.round((d.payment_status === 'Lunas' ? val : dp) * rate);
                      const isPaid = Boolean(d.commission?.hunter_paid || d.commission?.status === 'paid');

                      return (
                        <tr key={d.id}>
                          <td>
                            <div className="fw-semibold">{d.client_name}</div>
                            <div className="text-muted" style={{ fontSize: '11px' }}>{d.source_platform}</div>
                          </td>
                          <td>
                            <span className="notion-pill" style={{ fontSize: '10.5px' }}>
                              {d.management_type === 'project_only' ? '⚡ Project Saja' : '🏢 Full Managed'}
                            </span>
                          </td>
                          <td>
                            <span className="badge bg-light text-dark border" style={{ fontSize: '10.5px' }}>
                              {curr}
                            </span>
                          </td>
                          <td className="fw-semibold">{formatCurrency(val, curr)}</td>
                          <td className="text-success fw-semibold">{formatCurrency(dp, curr)}</td>
                          <td>
                            <span className="notion-pill" style={{ fontSize: '10.5px' }}>
                              {d.payment_status}
                            </span>
                          </td>
                          <td className="fw-bold text-dark">{formatCurrency(hunterAmt, curr)}</td>
                          <td>
                            <span
                              className={`badge rounded-pill ${
                                isPaid ? 'bg-success text-white' : 'bg-warning-subtle text-warning-emphasis border border-warning-subtle'
                              }`}
                              style={{ fontSize: '11px' }}
                            >
                              {isPaid ? '✓ Sudah Cair' : '⏳ Belum Cair'}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile Deal Cards */}
          <div className="mobile-card-list d-block d-md-none">
            {userDeals.length === 0 ? (
              <div className="text-center py-4 text-muted bg-light rounded border" style={{ fontSize: '13px' }}>
                Belum ada proyek deal closing yang tercatat dari personel ini.
              </div>
            ) : (
              userDeals.map((d) => {
                const curr = d.currency || 'IDR';
                const val = Number(d.project_value) || 0;
                const dp = d.payment_status === 'Lunas' ? val : Number(d.dp_amount) || 0;
                const rate = d.commission?.hunter_rate !== undefined ? Number(d.commission.hunter_rate) : (targetUser?.customCommissionRate || 0.15);
                const hunterAmt = Math.round((d.payment_status === 'Lunas' ? val : dp) * rate);
                const isPaid = Boolean(d.commission?.hunter_paid || d.commission?.status === 'paid');

              return (
                <div key={d.id} className="mobile-data-card">
                  <div className="mobile-data-card-header">
                    <div>
                      <div className="mobile-data-card-title">{d.client_name}</div>
                      <span className="notion-pill" style={{ fontSize: '10px' }}>
                        {d.management_type === 'project_only' ? 'Project Saja' : 'Full Managed'}
                      </span>
                    </div>
                    <span
                      className={`badge rounded-pill ${
                        isPaid ? 'bg-success text-white' : 'bg-warning-subtle text-warning-emphasis border'
                      }`}
                      style={{ fontSize: '10.5px' }}
                    >
                      {isPaid ? 'Cair ✓' : 'Pending'}
                    </span>
                  </div>
                  <div className="mobile-data-card-body">
                    <div className="p-2 rounded bg-light border d-flex justify-content-between">
                      <div>
                        <div className="text-muted" style={{ fontSize: '10.5px' }}>Nilai Deal</div>
                        <div className="fw-bold">{formatCurrency(val, curr)}</div>
                      </div>
                      <div className="text-end">
                        <div className="text-muted" style={{ fontSize: '10.5px' }}>Komisi Hunter</div>
                        <div className="fw-bold text-success">{formatCurrency(hunterAmt, curr)}</div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            }))}
          </div>
        </div>
      )}

      {/* ===================================================================
          TAB 4: LOG ABSENSI & STOPWATCH
      =================================================================== */}
      {activeTab === 'attendance' && (
        <div>
          <div className="notion-table-wrapper d-none d-md-block">
            <div className="table-responsive">
              <table className="notion-table">
                <thead>
                  <tr>
                    <th style={{ minWidth: '120px' }}>Tanggal Kerja</th>
                    <th style={{ minWidth: '120px' }}>Status Sesi</th>
                    <th style={{ minWidth: '130px' }}>Total Durasi</th>
                    <th style={{ minWidth: '130px' }}>Target Harian</th>
                    <th style={{ minWidth: '150px' }}>Tag Fokus Kerja</th>
                    <th style={{ minWidth: '220px' }}>Catatan Ringkasan Harian</th>
                  </tr>
                </thead>
                <tbody>
                  {userLogs.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-4 text-muted">
                        Belum ada riwayat absensi stopwatch dari personel ini.
                      </td>
                    </tr>
                  ) : (
                    userLogs.map((log) => {
                      const sec = calculateLiveSeconds(log, nowTick);
                      const targetHours = Number(targetUser.targetDailyHours) || 3;
                      const isMet = sec >= targetHours * 3600;

                      return (
                        <tr key={log.id}>
                          <td className="fw-semibold">{log.work_date}</td>
                          <td>
                            {log.status === 'running' ? (
                              <span className="badge bg-success text-white">● Sedang Kerja</span>
                            ) : log.status === 'paused' ? (
                              <span className="badge bg-warning text-dark">⏸ Jeda</span>
                            ) : (
                              <span className="badge bg-light text-dark border">✓ Selesai</span>
                            )}
                          </td>
                          <td className="fw-bold" style={{ color: isMet ? '#166534' : '#37352f' }}>
                            {formatDurationHMS(sec)}
                          </td>
                          <td>
                            <span
                              className={`badge rounded-pill ${
                                isMet ? 'bg-success-subtle text-success border border-success' : 'bg-light text-muted border'
                              }`}
                              style={{ fontSize: '10.5px' }}
                            >
                              {isMet ? '✓ Capai Target' : `${(sec / 3600).toFixed(1)} / ${targetHours}j`}
                            </span>
                          </td>
                          <td>
                            <span className="notion-pill" style={{ fontSize: '11px' }}>
                              {log.focus_tag || 'Hunting Prospek'}
                            </span>
                          </td>
                          <td className="text-truncate" style={{ maxWidth: '240px', fontSize: '12px' }}>
                            {log.notes || <span className="text-muted">-</span>}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile Attendance Cards */}
          <div className="mobile-card-list d-block d-md-none">
            {userLogs.length === 0 ? (
              <div className="text-center py-4 text-muted bg-light rounded border" style={{ fontSize: '13px' }}>
                Belum ada riwayat absensi stopwatch dari personel ini.
              </div>
            ) : (
              userLogs.map((log) => {
              const sec = calculateLiveSeconds(log, nowTick);
              return (
                <div key={log.id} className="mobile-data-card">
                  <div className="mobile-data-card-header">
                    <div>
                      <div className="mobile-data-card-title">{log.work_date}</div>
                      <span className="text-muted" style={{ fontSize: '11px' }}>{log.focus_tag || 'Hunting'}</span>
                    </div>
                    <span className="fw-bold fs-6 text-primary">{formatDurationHMS(sec)}</span>
                  </div>
                  {log.notes && (
                    <div className="p-2 rounded bg-light border text-truncate text-secondary mt-2" style={{ fontSize: '11px' }}>
                      {log.notes}
                    </div>
                  )}
                </div>
              );
            }))}
          </div>
        </div>
      )}

      {/* ===================================================================
          TAB 5: EVALUASI & CATATAN ADMIN
      =================================================================== */}
      {activeTab === 'evaluation' && (
        <div className="notion-card">
          <div className="d-flex align-items-center gap-2 mb-3">
            <Sliders size={18} className="text-primary" />
            <h3 className="h6 fw-bold mb-0">Evaluasi Karir &amp; Catatan Khusus Administrator</h3>
          </div>
          <p className="text-muted mb-3" style={{ fontSize: '12.5px' }}>
            Catatan ini hanya dapat dilihat oleh Administrator dan berfungsi sebagai arsip histori perkembangan, performa kerja harian, atau feedback kedisiplinan personel <strong>@{username}</strong>.
          </p>

          {evalSuccess && (
            <div className="alert alert-success py-2 px-3 mb-3 d-flex align-items-center gap-2" style={{ fontSize: '13px' }}>
              <CheckCircle2 size={16} />
              <span>Catatan evaluasi untuk @{username} berhasil disimpan!</span>
            </div>
          )}

          <div className="mb-3">
            <label className="form-label fw-semibold" style={{ fontSize: '12.5px' }}>
              Catatan Evaluasi / Rekomendasi Karir:
            </label>
            <textarea
              className="notion-input w-100"
              rows={6}
              value={evalNotesInput}
              onChange={(e) => setEvalNotesInput(e.target.value)}
              placeholder={`Tulis evaluasi performa @${username}, misal: "Sangat rajin hunting di Google Maps, follow-up rapi, direkomendasikan naik ke Senior Hunter bulan depan..."`}
            />
          </div>

          <div className="d-flex align-items-center justify-content-between pt-3 border-top">
            <div className="text-muted" style={{ fontSize: '11.5px' }}>
              Tersimpan otomatis ke basis data profil personel.
            </div>

            <button
              type="button"
              className="btn-notion-primary"
              disabled={savingEval}
              onClick={handleSaveEvaluation}
            >
              <Check size={14} />
              <span>{savingEval ? 'Menyimpan...' : 'Simpan Evaluasi'}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
