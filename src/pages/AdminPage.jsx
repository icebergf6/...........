import React, { useMemo, useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  ShieldCheck,
  Users,
  Clock,
  Calendar,
  Search,
  Filter,
  CheckCircle2,
  Briefcase,
  Download,
  Wallet,
  UserPlus,
  Trash2,
  Edit3,
  Square,
  Plus,
  Settings,
  Database,
  RefreshCw,
  KeyRound,
  Save,
  X,
  ExternalLink,
  CheckCircle,
  XCircle,
  AlertCircle,
  MessageCircle,
  FileCheck,
  Layers,
  Award,
  Sliders,
  ChevronRight,
  Phone,
  Globe,
  Sparkles,
  Check,
  AlertTriangle,
  Target,
  Send,
  UserCheck,
  CheckSquare,
  Eye,
  Minus,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useAttendance } from '../context/AttendanceContext';
import { useProspects } from '../context/ProspectsContext';
import { usePaymentAccounts } from '../context/PaymentAccountsContext';
import PaymentAccountsList from '../components/Finance/PaymentAccountsList';
import {
  formatDurationHMS,
  formatDurationHuman,
  getTodayDateString,
  exportToCSV,
  formatRupiah,
  formatUSD,
  formatCurrency,
  calculateCommission,
  getStudioSettings,
  saveStudioSettings,
  DELIVERY_CHECKLIST_ITEMS,
  SOCIAL_PLATFORMS,
  PROSPECT_STATUSES,
  PAYMENT_STATUSES,
  sanitizeSafeUrl,
} from '../lib/supabase';

export default function AdminPage({ defaultTab }) {
  const {
    user,
    profile,
    teamUsers,
    updateCredentials,
    adminCreateUser,
    adminUpdateUser,
    adminDeleteUser,
  } = useAuth();
  const {
    attendanceLogs,
    nowTick,
    calculateLiveSeconds,
    adminForceStopLog,
    adminUpdateLog,
    adminDeleteLog,
    adminAddManualLog,
  } = useAttendance();
  const {
    allTeamProspects,
    prospects: scopedProspects,
    dealClients,
    updateProspect,
    refreshProspects,
  } = useProspects();
  const prospects = allTeamProspects || scopedProspects;
  const { paymentAccounts, maxAccounts, refreshPaymentAccounts } =
    usePaymentAccounts();

  const todayDate = getTodayDateString();
  const location = useLocation();
  const navigate = useNavigate();

  // Dynamic activeTab resolving from location or defaultTab
  const initialTab = useMemo(() => {
    if (location.pathname.includes('/projects')) return 'projects';
    if (location.pathname.includes('/users-lifecycle')) return 'lifecycle';
    if (defaultTab) return defaultTab === 'overview' ? 'users' : defaultTab;
    return 'users';
  }, [defaultTab, location.pathname]);

  const [activeTab, setActiveTab] = useState(initialTab);

  useEffect(() => {
    if (location.pathname.includes('/projects')) setActiveTab('projects');
    else if (location.pathname.includes('/users-lifecycle')) setActiveTab('lifecycle');
    else if (defaultTab) setActiveTab(defaultTab === 'overview' ? 'users' : defaultTab);
  }, [location.pathname, defaultTab]);

  // Project Management States
  const [projectFilterStatus, setProjectFilterStatus] = useState('ALL');
  const [projectManagementFilter, setProjectManagementFilter] = useState('ALL');
  const [projectSearch, setProjectSearch] = useState('');
  const [editingProjectModal, setEditingProjectModal] = useState(null);
  const [projectAssetForm, setProjectAssetForm] = useState({
    staging_url: '',
    live_url: '',
    domain: '',
    credentials: '',
    max_revisions: 3,
  });

  // User Lifecycle States
  const [isLifecycleModalOpen, setIsLifecycleModalOpen] = useState(false);
  const [lifecycleForm, setLifecycleForm] = useState({
    id: '',
    username: '',
    status: 'active',
    suspended_until: '',
    suspensionDurationPreset: '1',
    customSuspensionDate: '',
    tier: 'Junior Hunter',
    targetDailyHours: 3,
    targetDailyProspects: 10,
    customCommissionRate: 15,
    evaluationNotes: '',
  });

  // Filters for Attendance tab
  const [selectedUser, setSelectedUser] = useState('ALL');
  const [selectedDate, setSelectedDate] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // State for Adding New Team Member
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [newUserForm, setNewUserForm] = useState({
    username: '',
    email: '',
    password: 'password123',
    role: 'user',
  });
  const [userFeedback, setUserFeedback] = useState('');
  const [userError, setUserError] = useState('');

  // State for Editing Attendance Log
  const [editingLog, setEditingLog] = useState(null);
  const [editHours, setEditHours] = useState(0);
  const [editMinutes, setEditMinutes] = useState(0);
  const [editNotes, setEditNotes] = useState('');

  // State for Manual Attendance Log Modal
  const [isManualLogOpen, setIsManualLogOpen] = useState(false);
  const [manualLogForm, setManualLogForm] = useState({
    username: '',
    work_date: todayDate,
    hours: 7,
    minutes: 0,
    notes: '',
  });

  // State for Studio & Commission Settings
  const [studioConfig, setStudioConfig] = useState(() => getStudioSettings());
  const [settingsSaved, setSettingsSaved] = useState(false);

  const isAdmin = profile?.role === 'admin';

  // Gather all known team usernames + registered profiles
  const allTeamMembers = useMemo(() => {
    const map = new Map();

    // 1. From registered teamUsers
    (teamUsers || []).forEach((u) => {
      if (u?.username) {
        const key = u.username.toLowerCase();
        map.set(key, {
          id: u.id || 'user-' + key,
          username: u.username,
          email: u.email || `${u.username}@atier-team.id`,
          role: u.role || 'user',
          status: u.status || 'active',
          suspended_until: u.suspended_until || null,
          tier: u.tier || 'Junior Hunter',
          targetDailyHours: u.targetDailyHours || 3,
          targetDailyProspects: u.targetDailyProspects || 10,
          customCommissionRate: u.customCommissionRate || 0.15,
          evaluationNotes: u.evaluationNotes || '',
          created_at: u.created_at,
        });
      }
    });

    // 2. From attendance logs
    attendanceLogs.forEach((log) => {
      if (log.username) {
        const key = log.username.toLowerCase();
        if (!map.has(key)) {
          map.set(key, {
            id: log.user_id || 'user-' + key,
            username: log.username,
            email: `${log.username}@atier-team.id`,
            role: 'user',
            status: 'active',
            suspended_until: null,
            tier: 'Junior Hunter',
            targetDailyHours: 3,
            targetDailyProspects: 10,
            customCommissionRate: 0.15,
            evaluationNotes: '',
          });
        }
      }
    });

    // 3. From prospects
    prospects.forEach((p) => {
      if (p.created_by_username) {
        const key = p.created_by_username.toLowerCase();
        if (!map.has(key)) {
          map.set(key, {
            id: p.user_id || 'user-' + key,
            username: p.created_by_username,
            email: `${p.created_by_username}@atier-team.id`,
            role: 'user',
            status: 'active',
            suspended_until: null,
            tier: 'Junior Hunter',
            targetDailyHours: 3,
            targetDailyProspects: 10,
            customCommissionRate: 0.15,
            evaluationNotes: '',
          });
        }
      }
    });

    // 4. Current logged-in user
    if (profile?.username) {
      const key = profile.username.toLowerCase();
      const existing = map.get(key) || {};
      map.set(key, {
        ...existing,
        id: user?.id || profile.id || existing.id || 'user-' + key,
        username: profile.username,
        email: profile.email || user?.email || existing.email || `${profile.username}@atier-team.id`,
        role: profile.role || existing.role || 'user',
        status: profile.status || existing.status || 'active',
        suspended_until: profile.suspended_until || existing.suspended_until || null,
        tier: profile.tier || existing.tier || 'Junior Hunter',
        targetDailyHours: profile.targetDailyHours || existing.targetDailyHours || 3,
        targetDailyProspects: profile.targetDailyProspects || existing.targetDailyProspects || 10,
        customCommissionRate: profile.customCommissionRate || existing.customCommissionRate || 0.15,
        evaluationNotes: profile.evaluationNotes || existing.evaluationNotes || '',
      });
    }

    return Array.from(map.values()).sort((a, b) =>
      a.username.localeCompare(b.username)
    );
  }, [teamUsers, attendanceLogs, prospects, profile, user]);

  // Unique dates in attendance logs
  const availableDates = useMemo(() => {
    const set = new Set([todayDate]);
    attendanceLogs.forEach((log) => {
      if (log.work_date) set.add(log.work_date);
    });
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }, [attendanceLogs, todayDate]);

  // Detailed summary per team member
  const memberSummaries = useMemo(() => {
    return allTeamMembers.map((member) => {
      const unameLower = member.username.toLowerCase();
      const userLogs = attendanceLogs.filter(
        (l) => (l.username || '').toLowerCase() === unameLower
      );
      const todayLog = userLogs.find((l) => l.work_date === todayDate) || null;
      const todaySec = calculateLiveSeconds(todayLog, nowTick);

      const totalAllDaysSec = userLogs.reduce(
        (acc, l) => acc + calculateLiveSeconds(l, nowTick),
        0
      );

      const userProspects = prospects.filter(
        (p) => (p.created_by_username || '').toLowerCase() === unameLower
      );
      const userDeals = userProspects.filter((p) => p.status === 'Deal');

      let cashInIdr = 0;
      let cashInUsd = 0;
      userDeals.forEach((d) => {
        const val = Number(d.project_value) || 0;
        const dp =
          d.payment_status === 'Lunas' ? val : Number(d.dp_amount) || 0;
        if (d.currency === 'USD') cashInUsd += dp;
        else cashInIdr += dp;
      });

      const closingRate =
        userProspects.length > 0
          ? Math.round((userDeals.length / userProspects.length) * 100)
          : 0;

      return {
        ...member,
        todayLog,
        todayStatus: todayLog?.status || 'idle',
        todaySeconds: todaySec,
        totalSeconds: totalAllDaysSec,
        daysWorkedCount: userLogs.length,
        prospectsCount: userProspects.length,
        dealsCount: userDeals.length,
        closingRate,
        cashInIdr,
        cashInUsd,
      };
    });
  }, [allTeamMembers, attendanceLogs, prospects, todayDate, nowTick]);

  // Filtered daily attendance log rows
  const filteredLogs = useMemo(() => {
    return attendanceLogs
      .filter((log) => {
        const matchUser =
          selectedUser === 'ALL' ||
          (log.username || '').toLowerCase() === selectedUser.toLowerCase();
        const matchDate =
          selectedDate === 'ALL' || log.work_date === selectedDate;
        const q = searchQuery.toLowerCase();
        const matchSearch =
          !q ||
          (log.username || '').toLowerCase().includes(q) ||
          (log.notes || '').toLowerCase().includes(q) ||
          (log.work_date || '').includes(q);
        return matchUser && matchDate && matchSearch;
      })
      .sort((a, b) => {
        const dateCmp = (b.work_date || '').localeCompare(a.work_date || '');
        if (dateCmp !== 0) return dateCmp;
        return (a.username || '').localeCompare(b.username || '');
      });
  }, [attendanceLogs, selectedUser, selectedDate, searchQuery]);

  // Top-level KPI stats
  const overviewStats = useMemo(() => {
    const todayLogs = attendanceLogs.filter((l) => l.work_date === todayDate);
    const runningNowCount = todayLogs.filter(
      (l) => l.status === 'running'
    ).length;
    const totalTodaySec = todayLogs.reduce(
      (acc, l) => acc + calculateLiveSeconds(l, nowTick),
      0
    );
    const totalAllTimeSec = attendanceLogs.reduce(
      (acc, l) => acc + calculateLiveSeconds(l, nowTick),
      0
    );
    return {
      activeTodayCount: todayLogs.length,
      runningNowCount,
      totalTodaySec,
      totalAllTimeSec,
      teamCount: allTeamMembers.length,
    };
  }, [attendanceLogs, todayDate, nowTick, allTeamMembers]);

  // Commission summaries for all team deals
  const commissionSummary = useMemo(() => {
    let totalCommIdr = 0;
    let totalCommUsd = 0;
    let paidCommIdr = 0;
    let paidCommUsd = 0;
    let pendingCommIdr = 0;
    let pendingCommUsd = 0;

    dealClients.forEach((d) => {
      const isUsd = (d.currency || 'IDR') === 'USD';
      const comm = calculateCommission(d, d.commission?.hunter_rate ?? studioConfig.hunterRate);
      const isPaid = d.commission?.status === 'paid';

      if (isUsd) {
        totalCommUsd += comm.hunterAmount;
        if (isPaid) paidCommUsd += comm.hunterAmount;
        else pendingCommUsd += comm.hunterAmount;
      } else {
        totalCommIdr += comm.hunterAmount;
        if (isPaid) paidCommIdr += comm.hunterAmount;
        else pendingCommIdr += comm.hunterAmount;
      }
    });

    return {
      totalCommIdr,
      totalCommUsd,
      paidCommIdr,
      paidCommUsd,
      pendingCommIdr,
      pendingCommUsd,
    };
  }, [dealClients, studioConfig.hunterRate]);

  function showTempFeedback(msg) {
    setUserFeedback(msg);
    setTimeout(() => setUserFeedback(''), 3000);
  }

  // Handlers for Team User Management
  async function handleAddUserSubmit(e) {
    e.preventDefault();
    setUserError('');
    if (!newUserForm.username.trim()) {
      setUserError('Username wajib diisi.');
      return;
    }
    try {
      const created = await adminCreateUser(newUserForm);
      setNewUserForm({
        username: '',
        email: '',
        password: 'password123',
        role: 'user',
      });
      setIsAddUserOpen(false);
      showTempFeedback(`Anggota tim @${created.username} berhasil ditambahkan!`);
    } catch (err) {
      setUserError(err.message || 'Gagal menambah anggota tim.');
    }
  }

  async function handleRoleChange(member, nextRole) {
    try {
      await adminUpdateUser(member.id || member.username, {
        username: member.username,
        role: nextRole,
      });
      showTempFeedback(
        `Role @${member.username} diubah menjadi ${nextRole.toUpperCase()}.`
      );
    } catch (err) {
      alert(err.message || 'Gagal mengubah role.');
    }
  }

  async function handleResetUserPassword(member) {
    const newPw = window.prompt(
      `Masukkan password baru untuk @${member.username}:`,
      'password123'
    );
    if (!newPw || !newPw.trim()) return;
    try {
      await adminUpdateUser(member.id || member.username, {
        username: member.username,
        role: member.role,
        newPassword: newPw.trim(),
      });
      showTempFeedback(`Password untuk @${member.username} berhasil direset!`);
    } catch (err) {
      alert(err.message || 'Gagal mereset password.');
    }
  }

  async function handleRemoveUser(member) {
    if (
      !window.confirm(
        `Hapus akun anggota @${member.username}? Data prospek yang pernah diinput tetap tersimpan di tabel tim.`
      )
    ) {
      return;
    }
    try {
      await adminDeleteUser(member.id || member.username);
      showTempFeedback(`Akun @${member.username} telah dihapus.`);
    } catch (err) {
      alert(err.message || 'Tidak dapat menghapus akun.');
    }
  }

  // Handlers for Attendance Control
  function openEditLogModal(log) {
    const currentSec = calculateLiveSeconds(log, nowTick);
    const hrs = Math.floor(currentSec / 3600);
    const mins = Math.floor((currentSec % 3600) / 60);
    setEditingLog(log);
    setEditHours(hrs);
    setEditMinutes(mins);
    setEditNotes(log.notes || '');
  }

  async function handleSaveEditLog(e) {
    e.preventDefault();
    if (!editingLog) return;
    const totalSeconds =
      (Math.max(0, Number(editHours) || 0) * 3600) +
      (Math.max(0, Number(editMinutes) || 0) * 60);

    await adminUpdateLog(editingLog.id, {
      accumulated_seconds: totalSeconds,
      status: editingLog.status === 'running' ? 'completed' : editingLog.status,
      notes: editNotes,
    });
    setEditingLog(null);
    showTempFeedback(
      `Jam kerja @${editingLog.username} (${editingLog.work_date}) berhasil dikoreksi.`
    );
  }

  async function handleAddManualLogSubmit(e) {
    e.preventDefault();
    const uname =
      manualLogForm.username || allTeamMembers[0]?.username || 'anggota_tim';
    const totalSec =
      (Math.max(0, Number(manualLogForm.hours) || 0) * 3600) +
      (Math.max(0, Number(manualLogForm.minutes) || 0) * 60);

    await adminAddManualLog({
      username: uname,
      work_date: manualLogForm.work_date,
      accumulated_seconds: totalSec,
      notes: manualLogForm.notes,
    });
    setIsManualLogOpen(false);
    setManualLogForm({
      username: '',
      work_date: todayDate,
      hours: 7,
      minutes: 0,
      notes: '',
    });
    showTempFeedback(`Log absen manual untuk @${uname} berhasil ditambahkan.`);
  }

  // Handlers for Commission & Studio Settings
  async function handleToggleCommissionPaid(deal) {
    const isPaid = deal.commission?.status === 'paid';
    const nextStatus = isPaid ? 'ready' : 'paid';
    const paidAt = isPaid ? null : new Date().toISOString();
    const commCalc = calculateCommission(
      deal,
      deal.commission?.hunter_rate ?? studioConfig.hunterRate
    );

    await updateProspect(deal.id, {
      commission: {
        ...(deal.commission || {}),
        hunter_rate: commCalc.hunterRate,
        hunter_amount: commCalc.hunterAmount,
        status: nextStatus,
        paid_at: paidAt,
      },
    });
  }

  async function handleCustomDealRateChange(deal, ratePercent) {
    const rateDecimal = Math.max(0, Math.min(100, Number(ratePercent) || 0)) / 100;
    const commCalc = calculateCommission(deal, rateDecimal);
    await updateProspect(deal.id, {
      commission: {
        ...(deal.commission || {}),
        hunter_rate: rateDecimal,
        hunter_amount: commCalc.hunterAmount,
        status: deal.commission?.status || commCalc.status,
      },
    });
  }

  function handleSaveStudioSettings(e) {
    e.preventDefault();
    const saved = saveStudioSettings(studioConfig);
    setStudioConfig(saved);
    setSettingsSaved(true);
    setTimeout(() => setSettingsSaved(false), 2500);
  }

  // Export & Backup Handlers
  function handleExportAttendanceCSV() {
    exportToCSV('rekap-absensi-jam-kerja', filteredLogs, [
      { header: 'Tanggal', key: 'work_date' },
      { header: 'Username', key: 'username' },
      { header: 'Jam Mulai (Check-in)', key: 'check_in_at' },
      { header: 'Jam Selesai (Check-out)', key: 'check_out_at' },
      {
        header: 'Total Jam Kerja',
        transform: (row) =>
          formatDurationHMS(calculateLiveSeconds(row, nowTick)),
      },
      { header: 'Status Terakhir', key: 'status' },
      { header: 'Catatan Kerja', key: 'notes' },
    ]);
  }

  function handleExportCommissionsCSV() {
    exportToCSV('rekap-komisi-closing-tim', dealClients, [
      { header: 'Nama Klien Deal', key: 'client_name' },
      { header: 'Penginput (Hunter)', key: 'created_by_username' },
      { header: 'Mata Uang', key: 'currency' },
      { header: 'Nilai Kontrak', key: 'project_value' },
      { header: 'DP Masuk', key: 'dp_amount' },
      {
        header: 'Rate Komisi (%)',
        transform: (row) =>
          Math.round(
            ((row.commission?.hunter_rate ?? studioConfig.hunterRate) || 0.15) *
              100
          ) + '%',
      },
      {
        header: 'Nominal Komisi Hunter',
        transform: (row) =>
          calculateCommission(
            row,
            row.commission?.hunter_rate ?? studioConfig.hunterRate
          ).hunterAmount,
      },
      {
        header: 'Status Payout',
        transform: (row) =>
          row.commission?.status === 'paid'
            ? 'Sudah Ditransfer'
            : 'Belum Ditransfer',
      },
      {
        header: 'Tanggal Ditransfer',
        transform: (row) => row.commission?.paid_at || '-',
      },
    ]);
  }

  function handleBackupFullJSON() {
    const payload = {
      exported_at: new Date().toISOString(),
      studio_settings: studioConfig,
      team_members: allTeamMembers,
      prospects,
      payment_accounts: paymentAccounts,
      attendance_logs: attendanceLogs,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `atier-crm-full-backup-${todayDate}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  function renderStatusBadge(st) {
    if (st === 'running') {
      return <span className="notion-pill status-deal">● Sedang Kerja</span>;
    }
    if (st === 'paused') {
      return (
        <span className="notion-pill status-followup">⏸ Istirahat / Jeda</span>
      );
    }
    if (st === 'completed') {
      return <span className="notion-pill status-dihubungi">✓ Selesai</span>;
    }
    return <span className="notion-pill status-baru">Belum Absen</span>;
  }

  // =========================================================================
  // TAB: MANAJEMEN PROJECT LOGIC
  // =========================================================================
  const filteredProjects = useMemo(() => {
    return dealClients.filter((d) => {
      const pStatus = d.project_status || 'briefing';
      const matchStatus =
        projectFilterStatus === 'ALL' || pStatus === projectFilterStatus;
      const mType =
        d.management_type === 'project_only' ? 'project_only' : 'full_managed';
      const matchMgmt =
        projectManagementFilter === 'ALL' || mType === projectManagementFilter;
      const q = projectSearch.toLowerCase();
      const matchSearch =
        !q ||
        (d.client_name || '').toLowerCase().includes(q) ||
        (d.delivery_assets?.domain || '').toLowerCase().includes(q) ||
        (d.project_assignee || '').toLowerCase().includes(q);
      return matchStatus && matchMgmt && matchSearch;
    });
  }, [dealClients, projectFilterStatus, projectManagementFilter, projectSearch]);

  async function handleProjectStatusChange(dealId, newStatus) {
    await updateProspect(dealId, { project_status: newStatus });
    showTempFeedback('Status pipeline proyek berhasil diperbarui!');
  }

  async function handleProjectAssigneeChange(dealId, assigneeUsername) {
    await updateProspect(dealId, { project_assignee: assigneeUsername });
    showTempFeedback(`Eksekutor proyek diubah ke @${assigneeUsername}`);
  }

  async function handleProjectChecklistToggle(deal, itemKey) {
    const curAssets = deal.delivery_assets || {};
    const curChecklist = curAssets.checklist || {};
    const nextChecklist = {
      ...curChecklist,
      [itemKey]: !curChecklist[itemKey],
    };
    await updateProspect(deal.id, {
      delivery_assets: {
        ...curAssets,
        checklist: nextChecklist,
      },
    });
    showTempFeedback('Checklist tahap delivery berhasil diperbarui!');
  }

  async function handleProjectRevisionChange(deal, delta) {
    const curAssets = deal.delivery_assets || {};
    const count = Number(curAssets.revision_count) || 0;
    const max = Number(curAssets.max_revisions) || 3;
    const nextVal = Math.max(0, Math.min(max, count + delta));
    await updateProspect(deal.id, {
      delivery_assets: {
        ...curAssets,
        revision_count: nextVal,
      },
    });
  }

  function handleOpenProjectAssetModal(deal) {
    setEditingProjectModal(deal);
    setProjectAssetForm({
      staging_url: deal.delivery_assets?.staging_url || '',
      live_url: deal.delivery_assets?.live_url || '',
      domain: deal.delivery_assets?.domain || '',
      credentials: deal.delivery_assets?.credentials || '',
      max_revisions: Number(deal.delivery_assets?.max_revisions) || 3,
    });
  }

  async function handleSaveProjectAssetForm(e) {
    e.preventDefault();
    if (!editingProjectModal) return;
    const curAssets = editingProjectModal.delivery_assets || {};
    await updateProspect(editingProjectModal.id, {
      delivery_assets: {
        ...curAssets,
        staging_url: projectAssetForm.staging_url.trim(),
        live_url: projectAssetForm.live_url.trim(),
        domain: projectAssetForm.domain.trim(),
        credentials: projectAssetForm.credentials.trim(),
        max_revisions: Number(projectAssetForm.max_revisions) || 3,
      },
    });
    setEditingProjectModal(null);
    showTempFeedback('Aset & link deliverables proyek berhasil disimpan!');
  }

  // =========================================================================
  // TAB: MANAJEMEN USER BERKELANJUTAN LOGIC
  // =========================================================================
  function handleOpenLifecycleModal(member) {
    const commRateVal =
      member.customCommissionRate !== undefined &&
      member.customCommissionRate !== null
        ? Number(member.customCommissionRate)
        : 0.15;

    const initialSuspendedUntil = member.suspended_until || '';
    let initialPreset = '1';
    if (initialSuspendedUntil) {
      const diffMs = new Date(initialSuspendedUntil).getTime() - Date.now();
      const diffDays = Math.round(diffMs / (24 * 60 * 60 * 1000));
      if ([1, 3, 7, 14, 30].includes(diffDays)) {
        initialPreset = String(diffDays);
      } else {
        initialPreset = 'custom';
      }
    }

    setLifecycleForm({
      id: member.id || member.username,
      username: member.username,
      status: member.status || 'active',
      suspended_until: initialSuspendedUntil,
      suspensionDurationPreset: initialPreset,
      customSuspensionDate: initialSuspendedUntil
        ? new Date(initialSuspendedUntil).toISOString().slice(0, 16)
        : '',
      tier: member.tier || 'Junior Hunter',
      targetDailyHours:
        member.targetDailyHours !== undefined && member.targetDailyHours !== null
          ? member.targetDailyHours
          : 3,
      targetDailyProspects:
        member.targetDailyProspects !== undefined &&
        member.targetDailyProspects !== null
          ? member.targetDailyProspects
          : 10,
      customCommissionRate: Math.round(
        (!isNaN(commRateVal) && commRateVal >= 0 ? commRateVal : 0.15) * 100
      ),
      evaluationNotes: member.evaluationNotes || '',
    });
    setIsLifecycleModalOpen(true);
  }

  async function handleSaveLifecycleSubmit(e) {
    e.preventDefault();
    try {
      const parsedHours = Number(lifecycleForm.targetDailyHours);
      const resolvedHours =
        !isNaN(parsedHours) && parsedHours >= 0 ? parsedHours : 3;
      const parsedProspects = Number(lifecycleForm.targetDailyProspects);
      const resolvedProspects =
        !isNaN(parsedProspects) && parsedProspects >= 0 ? parsedProspects : 10;
      const parsedComm = Number(lifecycleForm.customCommissionRate);
      const resolvedComm =
        !isNaN(parsedComm) && parsedComm >= 0 ? parsedComm / 100 : 0.15;

      let resolvedSuspendedUntil = null;
      if (lifecycleForm.status === 'suspended') {
        if (lifecycleForm.suspended_until) {
          resolvedSuspendedUntil = new Date(lifecycleForm.suspended_until).toISOString();
        } else {
          // Default 1 hari jika belum dipilih
          resolvedSuspendedUntil = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
        }
      }

      await adminUpdateUser(lifecycleForm.id || lifecycleForm.username, {
        username: lifecycleForm.username,
        status: lifecycleForm.status,
        suspended_until: resolvedSuspendedUntil,
        tier: lifecycleForm.tier,
        targetDailyHours: resolvedHours,
        targetDailyProspects: resolvedProspects,
        customCommissionRate: resolvedComm,
        evaluationNotes: lifecycleForm.evaluationNotes.trim(),
      });
      setIsLifecycleModalOpen(false);
      showTempFeedback(
        `Data lifecycle & status akun @${lifecycleForm.username} berhasil disimpan!`
      );
    } catch (err) {
      alert('Gagal mengupdate lifecycle: ' + err.message);
    }
  }

  async function handleQuickReactivate(member) {
    try {
      await adminUpdateUser(member.id || member.username, {
        status: 'active',
        suspended_until: null,
      });
      showTempFeedback(`Akun @${member.username} berhasil dipulihkan menjadi Aktif!`);
    } catch (err) {
      alert('Gagal mengaktifkan user: ' + err.message);
    }
  }

  async function handleDeleteUser(member) {
    const uname = member.username || member.email;
    if (
      !window.confirm(
        `PERINGATAN: Apakah Anda yakin ingin MENGHAPUS AKUN @${uname} secara permanen?\n\nData login dan profil anggota ini akan dihapus dari sistem.`
      )
    ) {
      return;
    }
    try {
      await adminDeleteUser(member.id || member.username);
      if (isLifecycleModalOpen) setIsLifecycleModalOpen(false);
      showTempFeedback(`Akun @${uname} berhasil dihapus dari sistem.`);
    } catch (err) {
      alert('Gagal menghapus user: ' + err.message);
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-4">
        <div>
          <div className="d-flex align-items-center gap-2 mb-1">
            <h1 className="notion-page-title mb-0">
              Admin Command Center &amp; Manajemen Tim
            </h1>
            <span className="notion-pill pill-linkedin">
              Admin Master
            </span>
          </div>
          <p className="notion-page-subtitle">
            Kelola akun anggota tim, pantau eksekusi project, arahkan karir user berkelanjutan, dan pantau rincian performa personel.
          </p>
        </div>

        <div className="d-flex flex-wrap align-items-center gap-2">
          {activeTab === 'users' && (
            <button
              type="button"
              className="btn-notion-primary"
              onClick={() => setIsAddUserOpen(true)}
            >
              <UserPlus size={15} />
              <span>Tambah Anggota Tim</span>
            </button>
          )}

          {activeTab === 'attendance' && (
            <>
              <button
                type="button"
                className="btn-notion-outline"
                onClick={() => setIsManualLogOpen(true)}
              >
                <Plus size={14} />
                <span>Input Absen Manual</span>
              </button>
              <button
                type="button"
                className="btn-notion-outline"
                onClick={handleExportAttendanceCSV}
              >
                <Download size={14} />
                <span>Export Absensi (CSV)</span>
              </button>
            </>
          )}

          {activeTab === 'commissions' && (
            <button
              type="button"
              className="btn-notion-outline"
              onClick={handleExportCommissionsCSV}
            >
              <Download size={14} />
              <span>Export Komisi (CSV)</span>
            </button>
          )}

          {activeTab === 'system' && (
            <button
              type="button"
              className="btn-notion-outline"
              onClick={handleBackupFullJSON}
            >
              <Download size={14} />
              <span>Backup Full JSON</span>
            </button>
          )}
        </div>
      </div>

      {/* Feedback Banner */}
      {userFeedback && (
        <div
          className="d-flex align-items-center justify-content-between p-2 px-3 rounded mb-3"
          style={{
            backgroundColor: '#dcfce7',
            border: '1px solid #bbf7d0',
            color: '#166534',
            fontSize: '13px',
          }}
        >
          <span className="d-flex align-items-center gap-2 fw-medium">
            <CheckCircle2 size={15} />
            <span>{userFeedback}</span>
          </span>
          <button
            type="button"
            className="btn btn-sm p-0 border-0 bg-transparent text-success"
            onClick={() => setUserFeedback('')}
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Top Overview KPI Cards */}
      <div className="row g-3 mb-4">
        <div className="col-6 col-lg-3">
          <div
            className="notion-card"
            style={{ backgroundColor: '#f4fbf7', borderColor: '#bbf7d0' }}
          >
            <div className="notion-stat-label" style={{ color: '#166534' }}>
              <Clock size={14} />
              <span>Jam Kerja Tim Hari Ini</span>
            </div>
            <div className="notion-stat-value" style={{ color: '#166534' }}>
              {formatDurationHuman(overviewStats.totalTodaySec)}
            </div>
            <div className="mt-1" style={{ fontSize: '11.5px', color: '#15803d' }}>
              {overviewStats.runningNowCount > 0
                ? `● ${overviewStats.runningNowCount} anggota sedang aktif kerja`
                : `${overviewStats.activeTodayCount} anggota sudah absen hari ini`}
            </div>
          </div>
        </div>

        <div className="col-6 col-lg-3">
          <div className="notion-card">
            <div className="notion-stat-label">
              <Users size={14} />
              <span>Total Anggota Tim</span>
            </div>
            <div className="notion-stat-value">
              {overviewStats.teamCount}{' '}
              <span className="text-muted fw-normal" style={{ fontSize: '14px' }}>
                Personel
              </span>
            </div>
            <div className="text-muted mt-1" style={{ fontSize: '11.5px' }}>
              Akumulasi {formatDurationHuman(overviewStats.totalAllTimeSec)} kerja
            </div>
          </div>
        </div>

        <div className="col-6 col-lg-3">
          <div className="notion-card">
            <div className="notion-stat-label">
              <Briefcase size={14} />
              <span>Prospek &amp; Closing Tim</span>
            </div>
            <div className="notion-stat-value">
              {dealClients.length}{' '}
              <span className="text-muted fw-normal" style={{ fontSize: '14px' }}>
                Deal / {prospects.length} Prospek
              </span>
            </div>
            <div className="text-muted mt-1" style={{ fontSize: '11.5px' }}>
              Konversi tim:{' '}
              {prospects.length > 0
                ? Math.round((dealClients.length / prospects.length) * 100)
                : 0}
              %
            </div>
          </div>
        </div>

        <div className="col-6 col-lg-3">
          <div className="notion-card">
            <div className="notion-stat-label">
              <Wallet size={14} className="text-warning" />
              <span>Komisi Belum Dicairkan</span>
            </div>
            <div className="notion-stat-value" style={{ fontSize: '19px' }}>
              {formatRupiah(commissionSummary.pendingCommIdr)}
            </div>
            <div className="text-primary fw-semibold mt-1" style={{ fontSize: '12px' }}>
              + {formatUSD(commissionSummary.pendingCommUsd)} (Rate{' '}
              {Math.round(studioConfig.hunterRate * 100)}%)
            </div>
          </div>
        </div>
      </div>

      {/* 7-Tab Navigation Bar (Scrollable on Mobile) */}
      <div
        className="scrollable-chips-bar p-1 rounded-2 mb-4 bg-light border"
        style={{ borderColor: 'var(--notion-border)' }}
      >
        <button
          type="button"
          className="btn btn-sm flex-shrink-0 d-inline-flex align-items-center gap-2 px-3 py-2 rounded border-0"
          style={{
            backgroundColor: activeTab === 'users' ? '#2f2f2f' : 'transparent',
            color: activeTab === 'users' ? '#ffffff' : 'var(--notion-text)',
            fontWeight: activeTab === 'users' ? 600 : 500,
            fontSize: '13px',
          }}
          onClick={() => setActiveTab('users')}
        >
          <Users size={14} />
          <span>1. Anggota Tim &amp; Akses ({allTeamMembers.length})</span>
        </button>

        <button
          type="button"
          className="btn btn-sm flex-shrink-0 d-inline-flex align-items-center gap-2 px-3 py-2 rounded border-0"
          style={{
            backgroundColor: activeTab === 'projects' ? '#2f2f2f' : 'transparent',
            color: activeTab === 'projects' ? '#ffffff' : 'var(--notion-text)',
            fontWeight: activeTab === 'projects' ? 600 : 500,
            fontSize: '13px',
          }}
          onClick={() => setActiveTab('projects')}
        >
          <Briefcase size={14} />
          <span>2. Manajemen Project ({dealClients.length})</span>
        </button>

        <button
          type="button"
          className="btn btn-sm flex-shrink-0 d-inline-flex align-items-center gap-2 px-3 py-2 rounded border-0"
          style={{
            backgroundColor: activeTab === 'lifecycle' ? '#2f2f2f' : 'transparent',
            color: activeTab === 'lifecycle' ? '#ffffff' : 'var(--notion-text)',
            fontWeight: activeTab === 'lifecycle' ? 600 : 500,
            fontSize: '13px',
          }}
          onClick={() => setActiveTab('lifecycle')}
        >
          <UserCheck size={14} />
          <span>3. User Berkelanjutan ({allTeamMembers.length})</span>
        </button>

        <button
          type="button"
          className="btn btn-sm flex-shrink-0 d-inline-flex align-items-center gap-2 px-3 py-2 rounded border-0"
          style={{
            backgroundColor:
              activeTab === 'attendance' ? '#2f2f2f' : 'transparent',
            color:
              activeTab === 'attendance' ? '#ffffff' : 'var(--notion-text)',
            fontWeight: activeTab === 'attendance' ? 600 : 500,
            fontSize: '13px',
          }}
          onClick={() => setActiveTab('attendance')}
        >
          <Clock size={14} />
          <span>4. Kontrol Absensi ({attendanceLogs.length})</span>
        </button>

        <button
          type="button"
          className="btn btn-sm flex-shrink-0 d-inline-flex align-items-center gap-2 px-3 py-2 rounded border-0"
          style={{
            backgroundColor:
              activeTab === 'commissions' ? '#2f2f2f' : 'transparent',
            color:
              activeTab === 'commissions' ? '#ffffff' : 'var(--notion-text)',
            fontWeight: activeTab === 'commissions' ? 600 : 500,
            fontSize: '13px',
          }}
          onClick={() => setActiveTab('commissions')}
        >
          <Wallet size={14} />
          <span>5. Komisi &amp; Bagi Hasil</span>
        </button>

        <button
          type="button"
          className="btn btn-sm flex-shrink-0 d-inline-flex align-items-center gap-2 px-3 py-2 rounded border-0"
          style={{
            backgroundColor: activeTab === 'system' ? '#2f2f2f' : 'transparent',
            color: activeTab === 'system' ? '#ffffff' : 'var(--notion-text)',
            fontWeight: activeTab === 'system' ? 600 : 500,
            fontSize: '13px',
          }}
          onClick={() => setActiveTab('system')}
        >
          <Database size={14} />
          <span>6. Rekening &amp; Konfigurasi</span>
        </button>
      </div>

      {/* ===================================================================
          TAB 1: MANAJEMEN ANGGOTA TIM & PERFORMA PERSONEL
      =================================================================== */}
      {activeTab === 'users' && (
        <div>
          <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
            <div>
              <div className="fw-bold" style={{ fontSize: '15px' }}>
                Daftar Personel Tim, Role Akses &amp; Kontribusi Penjualan
              </div>
              <div className="text-muted" style={{ fontSize: '12px' }}>
                Tambah akun baru untuk anggota tim yang diundang, atur role Admin/User, atau reset password mereka.
              </div>
            </div>
          </div>

          <div className="notion-table-wrapper mb-4">
            <div className="table-responsive">
              <table className="notion-table">
                <thead>
                  <tr>
                    <th style={{ minWidth: '180px' }}>Anggota Tim</th>
                    <th style={{ minWidth: '135px' }}>Role Akses</th>
                    <th style={{ minWidth: '140px' }}>Status Hari Ini</th>
                    <th style={{ minWidth: '150px' }}>Jam Hari Ini / Total</th>
                    <th style={{ minWidth: '140px' }}>Prospek &amp; Deal</th>
                    <th style={{ minWidth: '155px' }}>Uang Masuk (Kontribusi)</th>
                    <th style={{ minWidth: '175px', textAlign: 'right' }}>
                      Aksi Manajemen User
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {memberSummaries.map((m) => {
                    const isSelf =
                      profile?.username?.toLowerCase() ===
                      m.username.toLowerCase();

                    return (
                      <tr key={m.username} style={{ cursor: 'default' }}>
                        <td>
                          <div className="d-flex align-items-center gap-2">
                            <span
                              className="notion-workspace-badge"
                              style={{
                                width: '28px',
                                height: '28px',
                                fontSize: '11.5px',
                              }}
                            >
                              {m.username.slice(0, 2).toUpperCase()}
                            </span>
                            <div>
                              <div className="fw-bold">
                                @{m.username}{' '}
                                {isSelf && (
                                  <span
                                    className="badge bg-dark text-white ms-1"
                                    style={{ fontSize: '9.5px' }}
                                  >
                                    Anda
                                  </span>
                                )}
                              </div>
                              <div
                                className="text-muted"
                                style={{ fontSize: '11px' }}
                              >
                                {m.email}
                              </div>
                            </div>
                          </div>
                        </td>

                        <td>
                          <select
                            className="notion-select py-1 px-2 fw-semibold"
                            style={{
                              fontSize: '11.5px',
                              backgroundColor:
                                m.role === 'admin' ? '#e0f2fe' : '#f1f1ef',
                              color:
                                m.role === 'admin' ? '#0369a1' : '#37352f',
                            }}
                            value={m.role || 'user'}
                            onChange={(e) =>
                              handleRoleChange(m, e.target.value)
                            }
                          >
                            <option value="user">USER (Hunter)</option>
                            <option value="admin">ADMIN (Leader)</option>
                          </select>
                        </td>

                        <td>{renderStatusBadge(m.todayStatus)}</td>

                        <td>
                          <div className="fw-bold" style={{ fontSize: '13px' }}>
                            {formatDurationHMS(m.todaySeconds)}
                          </div>
                          <div
                            className="text-muted"
                            style={{ fontSize: '11px' }}
                          >
                            Total: {formatDurationHuman(m.totalSeconds)} (
                            {m.daysWorkedCount} hr)
                          </div>
                        </td>

                        <td>
                          <div className="d-flex align-items-center gap-1">
                            <span className="notion-pill pill-gmaps">
                              {m.prospectsCount} prospek
                            </span>
                            <span className="notion-pill status-deal">
                              {m.dealsCount} deal
                            </span>
                          </div>
                          <div
                            className="text-muted mt-1"
                            style={{ fontSize: '11px' }}
                          >
                            Closing rate: <strong>{m.closingRate}%</strong>
                          </div>
                        </td>

                        <td>
                          <div
                            className="fw-bold"
                            style={{ color: '#166534', fontSize: '13px' }}
                          >
                            {formatRupiah(m.cashInIdr)}
                          </div>
                          {m.cashInUsd > 0 && (
                            <div
                              className="fw-semibold text-primary"
                              style={{ fontSize: '11.5px' }}
                            >
                              + {formatUSD(m.cashInUsd)}
                            </div>
                          )}
                        </td>

                        <td className="text-end">
                          <div className="d-flex align-items-center justify-content-end gap-1">
                            <button
                              type="button"
                              className="btn-notion-outline py-1 px-2"
                              style={{ fontSize: '11px' }}
                              onClick={() => {
                                setSelectedUser(m.username);
                                setActiveTab('attendance');
                              }}
                              title="Lihat log absensi user ini"
                            >
                              <Clock size={11} />
                              <span>Log</span>
                            </button>

                            <button
                              type="button"
                              className="btn-notion-outline py-1 px-2"
                              style={{ fontSize: '11px' }}
                              onClick={() => handleResetUserPassword(m)}
                              title="Reset password anggota ini"
                            >
                              <KeyRound size={11} />
                              <span>Reset PW</span>
                            </button>

                            {!isSelf && (
                              <button
                                type="button"
                                className="btn btn-sm text-danger p-1 border-0 bg-transparent"
                                onClick={() => handleRemoveUser(m)}
                                title="Hapus akun anggota ini"
                              >
                                <Trash2 size={14} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================
          TAB 2: MANAJEMEN PROJECT & DELIVERY AGENT
      =================================================================== */}
      {activeTab === 'projects' && (
        <div>
          <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-3">
            <div>
              <div className="fw-bold" style={{ fontSize: '15px' }}>
                Pipeline Delivery Project Klien Deal &amp; Eksekusi Tim ({filteredProjects.length})
              </div>
              <div className="text-muted" style={{ fontSize: '12px' }}>
                Atur pembagian eksekutor tim (designer/dev), checklist 6-tahap delivery, batas revisi klien, dan link deliverables.
              </div>
            </div>

            <div className="d-flex flex-wrap align-items-center gap-2">
              <div className="position-relative" style={{ minWidth: '220px' }}>
                <Search
                  size={14}
                  className="position-absolute text-muted"
                  style={{
                    left: '10px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                  }}
                />
                <input
                  type="text"
                  className="notion-input w-100"
                  style={{ paddingLeft: '30px' }}
                  placeholder="Cari klien, domain, eksekutor..."
                  value={projectSearch}
                  onChange={(e) => setProjectSearch(e.target.value)}
                />
              </div>

              <select
                className="notion-select"
                value={projectManagementFilter}
                onChange={(e) => setProjectManagementFilter(e.target.value)}
              >
                <option value="ALL">Semua Skema Klien</option>
                <option value="full_managed">🏢 Full Managed (Hosting Kami)</option>
                <option value="project_only">⚡ Project Saja (Lepas)</option>
              </select>

              <select
                className="notion-select"
                value={projectFilterStatus}
                onChange={(e) => setProjectFilterStatus(e.target.value)}
              >
                <option value="ALL">Semua Tahap Proyek ({dealClients.length})</option>
                <option value="briefing">1. Briefing &amp; Konten</option>
                <option value="design">2. Desain Visual &amp; Layout Web</option>
                <option value="development">3. Coding &amp; Integrasi</option>
                <option value="review">4. Review &amp; Revisi</option>
                <option value="completed">5. Live &amp; Handover</option>
              </select>
            </div>
          </div>

          <div className="notion-table-wrapper">
            <div className="table-responsive">
              <table className="notion-table">
                <thead>
                  <tr>
                    <th style={{ minWidth: '170px' }}>Klien &amp; Nilai Kontrak</th>
                    <th style={{ minWidth: '150px' }}>Status Pipeline</th>
                    <th style={{ minWidth: '140px' }}>Eksekutor (Assignee)</th>
                    <th style={{ minWidth: '280px' }}>Checklist 6-Tahap Delivery</th>
                    <th style={{ minWidth: '120px' }}>Revisi Klien</th>
                    <th style={{ minWidth: '160px' }}>Aset Deliverables</th>
                    <th style={{ minWidth: '110px', textAlign: 'right' }}>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProjects.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-4 text-muted">
                        Tidak ada project klien deal yang cocok dengan filter.
                      </td>
                    </tr>
                  ) : (
                    filteredProjects.map((deal) => {
                      const curStatus = deal.project_status || 'briefing';
                      const assets = deal.delivery_assets || {};
                      const checklist = assets.checklist || {};
                      const completedCount = DELIVERY_CHECKLIST_ITEMS.filter(
                        (i) => Boolean(checklist[i.id])
                      ).length;
                      const percent = Math.round(
                        (completedCount / DELIVERY_CHECKLIST_ITEMS.length) * 100
                      );
                      const revCount = Number(assets.revision_count) || 0;
                      const maxRev = Number(assets.max_revisions) || 3;

                      return (
                        <tr key={deal.id}>
                          <td>
                            <div className="fw-semibold text-truncate" style={{ maxWidth: '180px' }}>
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
                              <span
                                className={`badge rounded-pill ${
                                  deal.management_type === 'project_only'
                                    ? 'bg-warning-subtle text-warning-emphasis border border-warning-subtle'
                                    : 'bg-primary-subtle text-primary border border-primary-subtle'
                                }`}
                                style={{ fontSize: '10px' }}
                              >
                                {deal.management_type === 'project_only'
                                  ? '⚡ Project Saja (Lepas)'
                                  : '🏢 Full Managed'}
                              </span>
                            </div>
                            <div className="text-muted mt-1" style={{ fontSize: '11.5px' }}>
                              {formatCurrency(deal.project_value, deal.currency)} • Hunter @{deal.created_by_username || 'tim'}
                            </div>
                          </td>

                          <td>
                            <select
                              className="notion-select w-100"
                              style={{ fontSize: '12px' }}
                              value={curStatus}
                              onChange={(e) =>
                                handleProjectStatusChange(deal.id, e.target.value)
                              }
                            >
                              <option value="briefing">📋 1. Briefing &amp; Konten</option>
                              <option value="design">🎨 2. Desain Visual &amp; Layout Web</option>
                              <option value="development">💻 3. Coding &amp; Web</option>
                              <option value="review">🔍 4. Review &amp; Revisi</option>
                              <option value="completed">🚀 5. Live &amp; Handover</option>
                            </select>
                          </td>

                          <td>
                            <select
                              className="notion-select w-100"
                              style={{ fontSize: '12px' }}
                              value={deal.project_assignee || ''}
                              onChange={(e) =>
                                handleProjectAssigneeChange(deal.id, e.target.value)
                              }
                            >
                              <option value="">-- Belum Ditugaskan --</option>
                              {allTeamMembers.map((m) => (
                                <option key={m.username} value={m.username}>
                                  @{m.username} ({m.tier || 'Tim'})
                                </option>
                              ))}
                            </select>
                          </td>

                          <td>
                            <div className="d-flex align-items-center justify-content-between mb-1" style={{ fontSize: '11px' }}>
                              <span className="text-muted">Progress Checklist:</span>
                              <span className="fw-semibold text-primary">{completedCount}/6 ({percent}%)</span>
                            </div>
                            <div className="progress mb-2" style={{ height: '5px' }}>
                              <div
                                className="progress-bar bg-success"
                                style={{ width: `${percent}%` }}
                              />
                            </div>
                            <div className="d-flex flex-wrap gap-1">
                              {DELIVERY_CHECKLIST_ITEMS.map((item, idx) => {
                                const isDone = Boolean(checklist[item.id]);
                                return (
                                  <button
                                    key={item.id}
                                    type="button"
                                    onClick={() => handleProjectChecklistToggle(deal, item.id)}
                                    className={`btn btn-sm p-1 px-2 border rounded ${
                                      isDone
                                        ? 'bg-success text-white border-success'
                                        : 'bg-white text-secondary'
                                    }`}
                                    style={{ fontSize: '10.5px' }}
                                    title={item.label}
                                  >
                                    {isDone ? '✓ ' : ''}{idx + 1}. {item.label.split('.')[1]?.trim().split(' ')[0] || item.id}
                                  </button>
                                );
                              })}
                            </div>
                          </td>

                          <td>
                            <div className="d-flex align-items-center gap-1">
                              <button
                                type="button"
                                className="btn btn-sm btn-outline-secondary p-0 px-1"
                                onClick={() => handleProjectRevisionChange(deal, -1)}
                                title="Kurangi hitungan revisi"
                              >
                                <Minus size={11} />
                              </button>
                              <span className="fw-bold px-1" style={{ fontSize: '12px' }}>
                                {revCount}/{maxRev}
                              </span>
                              <button
                                type="button"
                                className="btn btn-sm btn-outline-secondary p-0 px-1"
                                onClick={() => handleProjectRevisionChange(deal, 1)}
                                title="Tambah hitungan revisi"
                              >
                                <Plus size={11} />
                              </button>
                            </div>
                            {revCount >= maxRev && (
                              <div className="text-danger mt-1 fw-semibold" style={{ fontSize: '10.5px' }}>
                                Kuota Revisi Penuh
                              </div>
                            )}
                          </td>

                          <td>
                            <div className="d-flex flex-column gap-1" style={{ fontSize: '11px' }}>
                              {sanitizeSafeUrl(assets.live_url) ? (
                                <a
                                  href={sanitizeSafeUrl(assets.live_url)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-decoration-none text-primary d-inline-flex align-items-center gap-1"
                                >
                                  <Globe size={11} />
                                  <span className="text-truncate" style={{ maxWidth: '120px' }}>Live Website</span>
                                  <ExternalLink size={10} />
                                </a>
                              ) : (
                                <span className="text-muted">- Live URL belum ada</span>
                              )}

                              {sanitizeSafeUrl(assets.staging_url) ? (
                                <a
                                  href={sanitizeSafeUrl(assets.staging_url)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-decoration-none text-success d-inline-flex align-items-center gap-1"
                                >
                                  <Layers size={11} />
                                  <span className="text-truncate" style={{ maxWidth: '120px' }}>Staging Web</span>
                                  <ExternalLink size={10} />
                                </a>
                              ) : (
                                <span className="text-muted">- Staging belum ada</span>
                              )}

                              {assets.domain ? (
                                <div className="text-muted text-truncate" style={{ maxWidth: '130px' }}>
                                  🌐 {assets.domain}
                                </div>
                              ) : null}
                            </div>
                          </td>

                          <td className="text-end">
                            <button
                              type="button"
                              className="btn-notion-outline py-1 px-2"
                              style={{ fontSize: '11.5px' }}
                              onClick={() => handleOpenProjectAssetModal(deal)}
                              title="Edit link deliverables, domain & kredensial"
                            >
                              <Edit3 size={12} />
                              <span>Aset</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================
          TAB 3: MANAJEMEN USER BERKELANJUTAN & JENJANG KARIR
      =================================================================== */}
      {activeTab === 'lifecycle' && (
        <div>
          <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-3">
            <div>
              <div className="fw-bold" style={{ fontSize: '15px' }}>
                Manajemen User Berkelanjutan, Status Lifecycle &amp; Jenjang Karir ({allTeamMembers.length})
              </div>
              <div className="text-muted" style={{ fontSize: '12px' }}>
                Pantau perkembangan anggota tim, tetapkan status (Aktif/Probation/Cuti/Non-Aktif), atur jenjang karir, dan target personal harian.
              </div>
            </div>
          </div>

          {/* Lifecycle Summary KPI Cards */}
          <div className="row g-2 mb-3">
            <div className="col-6 col-md-3">
              <div className="p-3 bg-white rounded border">
                <div className="text-muted" style={{ fontSize: '11.5px' }}>🟢 Anggota Aktif</div>
                <div className="fs-5 fw-bold text-success">
                  {allTeamMembers.filter((m) => (m.status || 'active') === 'active').length} Personel
                </div>
              </div>
            </div>
            <div className="col-6 col-md-3">
              <div className="p-3 bg-white rounded border">
                <div className="text-muted" style={{ fontSize: '11.5px' }}>🟡 Masa Percobaan (Probation)</div>
                <div className="fs-5 fw-bold text-warning">
                  {allTeamMembers.filter((m) => m.status === 'probation').length} Personel
                </div>
              </div>
            </div>
            <div className="col-6 col-md-3">
              <div className="p-3 bg-white rounded border">
                <div className="text-muted" style={{ fontSize: '11.5px' }}>🔵 Cuti / On Leave</div>
                <div className="fs-5 fw-bold text-primary">
                  {allTeamMembers.filter((m) => m.status === 'leave').length} Personel
                </div>
              </div>
            </div>
            <div className="col-6 col-md-3">
              <div className="p-3 bg-white rounded border">
                <div className="text-muted" style={{ fontSize: '11.5px' }}>💎 Lead Closer &amp; Partner</div>
                <div className="fs-5 fw-bold text-dark">
                  {allTeamMembers.filter((m) => m.tier === 'Lead Closer' || m.tier === 'Core Partner').length} Personel
                </div>
              </div>
            </div>
          </div>

          <div className="notion-table-wrapper">
            <div className="table-responsive">
              <table className="notion-table">
                <thead>
                  <tr>
                    <th style={{ minWidth: '160px' }}>Anggota Tim</th>
                    <th style={{ minWidth: '130px' }}>Status Lifecycle</th>
                    <th style={{ minWidth: '140px' }}>Jenjang Karir (Tier)</th>
                    <th style={{ minWidth: '170px' }}>Target Personal</th>
                    <th style={{ minWidth: '220px' }}>Evaluasi &amp; Catatan Admin</th>
                    <th style={{ minWidth: '120px', textAlign: 'right' }}>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {allTeamMembers.map((m) => {
                    const statusClass =
                      m.status === 'probation'
                        ? 'bg-warning-subtle text-warning-emphasis border border-warning-subtle'
                        : m.status === 'leave'
                        ? 'bg-info-subtle text-info-emphasis border border-info-subtle'
                        : m.status === 'inactive'
                        ? 'bg-secondary-subtle text-secondary border border-secondary-subtle'
                        : 'bg-success-subtle text-success-emphasis border border-success-subtle';

                    const tierClass =
                      m.tier === 'Core Partner'
                        ? 'bg-dark text-white'
                        : m.tier === 'Lead Closer'
                        ? 'bg-primary text-white'
                        : m.tier === 'Senior Hunter'
                        ? 'bg-info text-dark'
                        : 'bg-light text-secondary border';

                    return (
                      <tr key={m.username}>
                        <td>
                          <div className="d-flex align-items-center gap-2">
                            <span className="notion-workspace-badge">
                              {m.username.slice(0, 2).toUpperCase()}
                            </span>
                            <div>
                              <div className="fw-semibold">@{m.username}</div>
                              <div className="text-muted" style={{ fontSize: '11px' }}>
                                {m.email}
                              </div>
                            </div>
                          </div>
                        </td>

                        <td>
                          {(() => {
                            const isSuspended = m.status === 'suspended' || Boolean(m.suspended_until);
                            const isSuspensionActive =
                              isSuspended &&
                              m.suspended_until &&
                              new Date(m.suspended_until).getTime() > Date.now();
                            const isSuspensionExpired =
                              isSuspended &&
                              m.suspended_until &&
                              new Date(m.suspended_until).getTime() <= Date.now();

                            if (m.status === 'banned') {
                              return (
                                <span className="badge rounded-pill bg-danger text-white" style={{ fontSize: '11px' }}>
                                  🔴 Banned Permanen
                                </span>
                              );
                            }
                            if (isSuspensionActive) {
                              const expDate = new Date(m.suspended_until).toLocaleString('id-ID', {
                                day: 'numeric',
                                month: 'short',
                                hour: '2-digit',
                                minute: '2-digit',
                              });
                              return (
                                <div style={{ fontSize: '11px' }}>
                                  <span className="badge rounded-pill bg-warning text-dark border border-warning">
                                    🟠 Suspend (s.d. {expDate})
                                  </span>
                                  <div className="text-muted mt-0.5" style={{ fontSize: '10px' }}>
                                    Pulih otomatis saat tenggat
                                  </div>
                                </div>
                              );
                            }
                            if (isSuspensionExpired || (m.status === 'suspended' && !m.suspended_until)) {
                              return (
                                <span className="badge rounded-pill bg-success-subtle text-success border border-success" style={{ fontSize: '11px' }}>
                                  🟢 Aktif (Suspend Berakhir)
                                </span>
                              );
                            }
                            if (m.status === 'probation') {
                              return (
                                <span className="badge rounded-pill bg-warning-subtle text-dark border" style={{ fontSize: '11px' }}>
                                  🟡 Probation
                                </span>
                              );
                            }
                            if (m.status === 'leave') {
                              return (
                                <span className="badge rounded-pill bg-info-subtle text-dark border" style={{ fontSize: '11px' }}>
                                  🔵 Cuti
                                </span>
                              );
                            }
                            if (m.status === 'inactive') {
                              return (
                                <span className="badge rounded-pill bg-secondary-subtle text-muted border" style={{ fontSize: '11px' }}>
                                  ⚪ Non-Aktif
                                </span>
                              );
                            }
                            return (
                              <span className="badge rounded-pill bg-success text-white" style={{ fontSize: '11px' }}>
                                🟢 Aktif
                              </span>
                            );
                          })()}
                        </td>

                        <td>
                          <span className={`badge ${tierClass}`} style={{ fontSize: '11px' }}>
                            {m.tier || '🌱 Junior Hunter'}
                          </span>
                        </td>

                        <td>
                          <div style={{ fontSize: '11.5px' }}>
                            <div>⏱ <strong>{m.targetDailyHours || 3} Jam</strong> / hari</div>
                            <div>🎯 <strong>{m.targetDailyProspects || 10} Prospek</strong> / hari</div>
                            <div className="text-muted">Komisi: {Math.round((m.customCommissionRate || 0.15) * 100)}%</div>
                          </div>
                        </td>

                        <td>
                          <div className="text-truncate" style={{ maxWidth: '240px', fontSize: '12px' }} title={m.evaluationNotes}>
                            {m.evaluationNotes || <span className="text-muted italic">Belum ada evaluasi berkala.</span>}
                          </div>
                        </td>

                        <td className="text-end">
                          <div className="d-flex align-items-center justify-content-end gap-1">
                            <button
                              type="button"
                              className="btn-notion-outline py-1 px-2"
                              style={{ fontSize: '11.5px' }}
                              onClick={() => navigate(`/admin/users/${m.username}`)}
                              title={`Lihat detail lengkap & seluruh aktivitas @${m.username}`}
                            >
                              <Eye size={12} />
                              <span>Detail</span>
                            </button>

                            <button
                              type="button"
                              className="btn-notion-primary py-1 px-2"
                              style={{ fontSize: '11.5px' }}
                              onClick={() => handleOpenLifecycleModal(m)}
                              title="Atur Karir, Status, atau Skorsing Akun"
                            >
                              <Sliders size={12} />
                              <span>Atur</span>
                            </button>

                            {(m.status === 'suspended' || m.status === 'banned' || m.status === 'inactive') && (
                              <button
                                type="button"
                                className="btn btn-sm btn-outline-success py-1 px-2 border-0 bg-success-subtle text-success"
                                style={{ fontSize: '11.5px' }}
                                onClick={() => handleQuickReactivate(m)}
                                title="Pulihkan dan Aktifkan Akun Sekarang"
                              >
                                <CheckCircle2 size={12} />
                                <span>Pulihkan</span>
                              </button>
                            )}

                            {m.username !== profile?.username && (
                              <button
                                type="button"
                                className="btn btn-sm btn-outline-danger py-1 px-2 border-0"
                                style={{ fontSize: '11.5px' }}
                                onClick={() => handleDeleteUser(m)}
                                title="Hapus Akun Pengguna"
                              >
                                <Trash2 size={12} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================
          TAB 4: KONTROL ABSENSI & KOREKSI JAM KERJA
      =================================================================== */}
      {activeTab === 'attendance' && (
        <div>
          <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
            <div>
              <div className="fw-bold" style={{ fontSize: '15px' }}>
                Log Detail Absensi Harian &amp; Koreksi Stopwatch
              </div>
              <div className="text-muted" style={{ fontSize: '12px' }}>
                Admin dapat menghentikan stopwatch anggota yang lupa check-out, mengoreksi durasi jam kerja, atau menambah absen manual.
              </div>
            </div>

            <div className="d-flex flex-wrap align-items-center gap-2">
              <div className="position-relative" style={{ minWidth: '200px' }}>
                <Search
                  size={14}
                  className="position-absolute text-muted"
                  style={{
                    left: '10px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                  }}
                />
                <input
                  type="text"
                  className="notion-input w-100"
                  style={{ paddingLeft: '30px' }}
                  placeholder="Cari user atau catatan kerja..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              <div className="d-flex align-items-center gap-1">
                <Filter size={13} className="text-muted" />
                <select
                  className="notion-select"
                  value={selectedUser}
                  onChange={(e) => setSelectedUser(e.target.value)}
                >
                  <option value="ALL">
                    Semua User ({allTeamMembers.length})
                  </option>
                  {allTeamMembers.map((u) => (
                    <option key={u.username} value={u.username}>
                      @{u.username}
                    </option>
                  ))}
                </select>
              </div>

              <select
                className="notion-select"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
              >
                <option value="ALL">Semua Tanggal (Riwayat Lengkap)</option>
                {availableDates.map((d) => (
                  <option key={d} value={d}>
                    {d === todayDate ? `${d} (Hari Ini)` : d}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="notion-table-wrapper">
            <div className="table-responsive">
              <table className="notion-table">
                <thead>
                  <tr>
                    <th style={{ minWidth: '130px' }}>Tanggal</th>
                    <th style={{ minWidth: '140px' }}>Username</th>
                    <th style={{ minWidth: '100px' }}>Check-In</th>
                    <th style={{ minWidth: '105px' }}>Check-Out</th>
                    <th style={{ minWidth: '165px' }}>Durasi Kerja</th>
                    <th style={{ minWidth: '125px' }}>Status</th>
                    <th style={{ minWidth: '220px' }}>Catatan Kerja Harian</th>
                    <th style={{ minWidth: '165px', textAlign: 'right' }}>
                      Kontrol Admin
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLogs.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="text-center py-5 text-muted">
                        Tidak ada log absensi yang sesuai dengan filter.
                      </td>
                    </tr>
                  ) : (
                    filteredLogs.map((log) => {
                      const isToday = log.work_date === todayDate;
                      const liveSec = calculateLiveSeconds(log, nowTick);
                      return (
                        <tr key={log.id} style={{ cursor: 'default' }}>
                          <td className="fw-semibold">
                            {log.work_date}
                            {isToday && (
                              <span className="notion-pill pill-gmaps ms-2">
                                Hari Ini
                              </span>
                            )}
                          </td>
                          <td className="fw-semibold">@{log.username}</td>
                          <td>
                            {log.check_in_at
                              ? new Date(log.check_in_at).toLocaleTimeString(
                                  'id-ID',
                                  { hour: '2-digit', minute: '2-digit' }
                                )
                              : '-'}
                          </td>
                          <td>
                            {log.check_out_at
                              ? new Date(log.check_out_at).toLocaleTimeString(
                                  'id-ID',
                                  { hour: '2-digit', minute: '2-digit' }
                                )
                              : log.status === 'running'
                              ? 'Berjalan...'
                              : '-'}
                          </td>
                          <td>
                            <span
                              className="fw-bold"
                              style={{ fontVariantNumeric: 'tabular-nums' }}
                            >
                              {formatDurationHMS(liveSec)}
                            </span>{' '}
                            <span
                              className="text-muted"
                              style={{ fontSize: '11.5px' }}
                            >
                              ({formatDurationHuman(liveSec)})
                            </span>
                          </td>
                          <td>{renderStatusBadge(log.status)}</td>
                          <td className="text-muted">{log.notes || '-'}</td>
                          <td className="text-end">
                            <div className="d-flex align-items-center justify-content-end gap-1">
                              {log.status !== 'completed' && (
                                <button
                                  type="button"
                                  className="btn btn-sm btn-danger py-1 px-2 d-inline-flex align-items-center gap-1"
                                  style={{ fontSize: '11px' }}
                                  onClick={() => {
                                    adminForceStopLog(log.id);
                                    showTempFeedback(
                                      `Stopwatch @${log.username} berhasil dihentikan (Check-Out).`
                                    );
                                  }}
                                  title="Hentikan paksa stopwatch user ini"
                                >
                                  <Square size={10} />
                                  <span>Stop</span>
                                </button>
                              )}

                              <button
                                type="button"
                                className="btn-notion-outline py-1 px-2"
                                style={{ fontSize: '11px' }}
                                onClick={() => openEditLogModal(log)}
                                title="Koreksi durasi jam kerja atau catatan"
                              >
                                <Edit3 size={11} />
                                <span>Koreksi</span>
                              </button>

                              <button
                                type="button"
                                className="btn btn-sm text-danger p-1 border-0 bg-transparent"
                                onClick={() => {
                                  if (
                                    window.confirm(
                                      `Hapus log absensi @${log.username} tanggal ${log.work_date}?`
                                    )
                                  ) {
                                    adminDeleteLog(log.id);
                                  }
                                }}
                                title="Hapus log absensi ini"
                              >
                                <Trash2 size={13} />
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
        </div>
      )}

      {/* ===================================================================
          TAB 3: MANAJEMEN KOMISI TIM & PENGATURAN BAGI HASIL
      =================================================================== */}
      {activeTab === 'commissions' && (
        <div>
          {/* Pengaturan Rate Komisi & Kop Invoice Studio */}
          <div className="notion-card mb-4">
            <div className="d-flex align-items-center justify-content-between mb-3">
              <div className="d-flex align-items-center gap-2">
                <Settings size={16} className="text-primary" />
                <span className="fw-bold" style={{ fontSize: '14.5px' }}>
                  Konfigurasi Bagi Hasil Studio &amp; Kop Invoice
                </span>
              </div>
              {settingsSaved && (
                <span className="badge bg-success text-white py-1 px-2">
                  ✓ Pengaturan Disimpan
                </span>
              )}
            </div>

            <form onSubmit={handleSaveStudioSettings}>
              <div className="row g-3">
                <div className="col-sm-6 col-md-3">
                  <label
                    className="form-label text-muted mb-1"
                    style={{ fontSize: '11.5px' }}
                  >
                    Komisi Sales Hunter Default (%)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="1"
                    className="notion-input w-100 fw-bold"
                    value={Math.round(studioConfig.hunterRate * 100)}
                    onChange={(e) => {
                      const pct = Math.max(
                        0,
                        Math.min(100, Number(e.target.value) || 0)
                      );
                      setStudioConfig((prev) => ({
                        ...prev,
                        hunterRate: pct / 100,
                      }));
                    }}
                  />
                </div>

                <div className="col-sm-6 col-md-3">
                  <label
                    className="form-label text-muted mb-1"
                    style={{ fontSize: '11.5px' }}
                  >
                    Kurs Referensi 1 USD ke IDR (Rp)
                  </label>
                  <input
                    type="number"
                    min="1000"
                    step="100"
                    className="notion-input w-100"
                    value={studioConfig.usdExchangeRate}
                    onChange={(e) =>
                      setStudioConfig((prev) => ({
                        ...prev,
                        usdExchangeRate: Number(e.target.value) || 16000,
                      }))
                    }
                  />
                </div>

                <div className="col-sm-6 col-md-3">
                  <label
                    className="form-label text-muted mb-1"
                    style={{ fontSize: '11.5px' }}
                  >
                    Nama Studio (Kop Invoice)
                  </label>
                  <input
                    type="text"
                    className="notion-input w-100"
                    value={studioConfig.studioName}
                    onChange={(e) =>
                      setStudioConfig((prev) => ({
                        ...prev,
                        studioName: e.target.value,
                      }))
                    }
                  />
                </div>

                <div className="col-sm-6 col-md-3">
                  <label
                    className="form-label text-muted mb-1"
                    style={{ fontSize: '11.5px' }}
                  >
                    Target Jam Kerja Harian (Jam)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="24"
                    step="0.5"
                    className="notion-input w-100 fw-semibold"
                    value={studioConfig.dailyTargetHours ?? 3}
                    onChange={(e) =>
                      setStudioConfig((prev) => ({
                        ...prev,
                        dailyTargetHours: Math.max(
                          1,
                          Math.min(24, Number(e.target.value) || 3)
                        ),
                      }))
                    }
                  />
                </div>

                <div className="col-sm-6 col-md-3">
                  <label
                    className="form-label text-muted mb-1"
                    style={{ fontSize: '11.5px' }}
                  >
                    Target Prospek Baru / Hari (Klien)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="200"
                    step="1"
                    className="notion-input w-100 fw-semibold"
                    value={studioConfig.dailyTargetProspects ?? 10}
                    onChange={(e) =>
                      setStudioConfig((prev) => ({
                        ...prev,
                        dailyTargetProspects: Math.max(
                          1,
                          Math.min(200, Number(e.target.value) || 10)
                        ),
                      }))
                    }
                  />
                </div>

                <div className="col-sm-6 col-md-3 d-flex align-items-end ms-auto">
                  <button type="submit" className="btn-notion-primary w-100 justify-content-center">
                    <Save size={14} />
                    <span>Simpan Konfigurasi</span>
                  </button>
                </div>
              </div>
            </form>
          </div>

          {/* Commission Summary Cards */}
          <div className="row g-3 mb-4">
            <div className="col-12 col-md-4">
              <div className="notion-card">
                <div className="notion-stat-label">
                  <Wallet size={14} className="text-success" />
                  <span>Total Hak Komisi Tim</span>
                </div>
                <div
                  className="notion-stat-value text-success"
                  style={{ fontSize: '20px' }}
                >
                  {formatRupiah(commissionSummary.totalCommIdr)}
                </div>
                {commissionSummary.totalCommUsd > 0 && (
                  <div
                    className="fw-semibold text-primary mt-1"
                    style={{ fontSize: '13px' }}
                  >
                    + {formatUSD(commissionSummary.totalCommUsd)}
                  </div>
                )}
              </div>
            </div>

            <div className="col-6 col-md-4">
              <div className="notion-card">
                <div className="notion-stat-label">
                  <Clock size={14} className="text-warning" />
                  <span>Belum Dicairkan (Pending)</span>
                </div>
                <div
                  className="notion-stat-value text-warning"
                  style={{ fontSize: '20px' }}
                >
                  {formatRupiah(commissionSummary.pendingCommIdr)}
                </div>
                {commissionSummary.pendingCommUsd > 0 && (
                  <div
                    className="fw-semibold text-warning mt-1"
                    style={{ fontSize: '13px' }}
                  >
                    + {formatUSD(commissionSummary.pendingCommUsd)}
                  </div>
                )}
              </div>
            </div>

            <div className="col-6 col-md-4">
              <div className="notion-card">
                <div className="notion-stat-label">
                  <CheckCircle2 size={14} />
                  <span>Sudah Ditransfer (Paid)</span>
                </div>
                <div className="notion-stat-value" style={{ fontSize: '20px' }}>
                  {formatRupiah(commissionSummary.paidCommIdr)}
                </div>
                {commissionSummary.paidCommUsd > 0 && (
                  <div
                    className="fw-semibold text-muted mt-1"
                    style={{ fontSize: '13px' }}
                  >
                    + {formatUSD(commissionSummary.paidCommUsd)}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Table of Team Deals & Commission Payout */}
          <div className="notion-table-wrapper">
            <div className="table-responsive">
              <table className="notion-table">
                <thead>
                  <tr>
                    <th style={{ minWidth: '180px' }}>Klien Deal</th>
                    <th style={{ minWidth: '125px' }}>Hunter</th>
                    <th style={{ minWidth: '130px' }}>Uang Masuk</th>
                    <th style={{ minWidth: '115px' }}>Rate Komisi (%)</th>
                    <th style={{ minWidth: '140px' }}>Nominal Komisi</th>
                    <th style={{ minWidth: '130px' }}>Status Payout</th>
                    <th style={{ minWidth: '145px', textAlign: 'right' }}>
                      Aksi Admin
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {dealClients.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-5 text-muted">
                        Belum ada klien dengan status Deal.
                      </td>
                    </tr>
                  ) : (
                    dealClients.map((client) => {
                      const curr = client.currency || 'IDR';
                      const activeRate =
                        client.commission?.hunter_rate ??
                        studioConfig.hunterRate;
                      const comm = calculateCommission(client, activeRate);
                      const isPaid = client.commission?.status === 'paid';

                      return (
                        <tr key={client.id} style={{ cursor: 'default' }}>
                          <td>
                            <div className="fw-semibold">
                              {client.client_name}
                            </div>
                            <div
                              className="text-muted"
                              style={{ fontSize: '11px' }}
                            >
                              Kontrak:{' '}
                              {formatCurrency(client.project_value, curr)} (
                              {client.payment_status})
                            </div>
                          </td>
                          <td>
                            <span className="notion-pill pill-other fw-semibold">
                              @{client.created_by_username || 'tim'}
                            </span>
                          </td>
                          <td
                            className="fw-semibold"
                            style={{ color: '#166534' }}
                          >
                            {formatCurrency(comm.cashIn, curr)}
                          </td>
                          <td>
                            <div
                              className="d-flex align-items-center gap-1"
                              style={{ maxWidth: '85px' }}
                            >
                              <input
                                type="number"
                                min="0"
                                max="100"
                                className="notion-input py-1 px-2 text-center fw-semibold"
                                style={{ fontSize: '12px', width: '60px' }}
                                value={Math.round(activeRate * 100)}
                                onChange={(e) =>
                                  handleCustomDealRateChange(
                                    client,
                                    e.target.value
                                  )
                                }
                              />
                              <span className="text-muted">%</span>
                            </div>
                          </td>
                          <td>
                            <span
                              className="fw-bold text-success"
                              style={{ fontSize: '13.5px' }}
                            >
                              {formatCurrency(comm.hunterAmount, curr)}
                            </span>
                          </td>
                          <td>
                            <span
                              className={`badge rounded-pill ${
                                isPaid
                                  ? 'bg-success text-white'
                                  : 'bg-warning-subtle text-warning-emphasis border border-warning-subtle'
                              }`}
                              style={{ fontSize: '11px' }}
                            >
                              {isPaid ? 'Sudah Ditransfer' : 'Belum Ditransfer'}
                            </span>
                          </td>
                          <td className="text-end">
                            <button
                              type="button"
                              className={`btn btn-sm ${
                                isPaid ? 'btn-outline-secondary' : 'btn-dark'
                              } py-1 px-2`}
                              style={{ fontSize: '11.5px' }}
                              onClick={() => handleToggleCommissionPaid(client)}
                            >
                              {isPaid ? 'Batalkan' : 'Tandai Ditransfer'}
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================
          TAB 4: REKENING TIM, SISTEM & BACKUP DATABASE
      =================================================================== */}
      {activeTab === 'system' && (
        <div>
          <div className="row g-3 mb-4">
            <div className="col-md-7">
              <div className="notion-card h-100">
                <div className="fw-bold mb-2 d-flex align-items-center gap-2">
                  <Database size={16} />
                  <span>Status Database &amp; Penyimpanan Tim</span>
                </div>
                <p className="text-muted mb-3" style={{ fontSize: '12.5px' }}>
                  Seluruh data CRM tersinkronisasi lintas halaman. Anda dapat mengunduh salinan cadangan penuh (JSON) kapan saja.
                </p>

                <div className="row g-2 mb-3" style={{ fontSize: '12.5px' }}>
                  <div className="col-6 col-sm-3">
                    <div className="p-2 border rounded bg-light">
                      <div className="text-muted" style={{ fontSize: '11px' }}>
                        Prospek
                      </div>
                      <div className="fw-bold">{prospects.length} baris</div>
                    </div>
                  </div>
                  <div className="col-6 col-sm-3">
                    <div className="p-2 border rounded bg-light">
                      <div className="text-muted" style={{ fontSize: '11px' }}>
                        Klien Deal
                      </div>
                      <div className="fw-bold text-success">
                        {dealClients.length} klien
                      </div>
                    </div>
                  </div>
                  <div className="col-6 col-sm-3">
                    <div className="p-2 border rounded bg-light">
                      <div className="text-muted" style={{ fontSize: '11px' }}>
                        Log Absensi
                      </div>
                      <div className="fw-bold">{attendanceLogs.length} log</div>
                    </div>
                  </div>
                  <div className="col-6 col-sm-3">
                    <div className="p-2 border rounded bg-light">
                      <div className="text-muted" style={{ fontSize: '11px' }}>
                        Rekening Tim
                      </div>
                      <div className="fw-bold">
                        {paymentAccounts.length} / {maxAccounts}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="d-flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="btn-notion-primary"
                    onClick={handleBackupFullJSON}
                  >
                    <Download size={14} />
                    <span>Download Full Backup (.JSON)</span>
                  </button>
                </div>
              </div>
            </div>

            <div className="col-md-5">
              <div className="notion-card h-100">
                <div className="fw-bold mb-2 d-flex align-items-center gap-2">
                  <ShieldCheck size={16} className="text-primary" />
                  <span>Panduan Hak Akses Admin</span>
                </div>
                <ul
                  className="text-muted ps-3 mb-0"
                  style={{ fontSize: '12.5px', lineHeight: 1.6 }}
                >
                  <li>
                    <strong>Anggota Tim</strong>: Tambah user baru, ubah role Admin/User, dan reset password.
                  </li>
                  <li>
                    <strong>Kontrol Absensi</strong>: Hentikan paksa stopwatch yang lupa dimatikan &amp; koreksi jam kerja.
                  </li>
                  <li>
                    <strong>Komisi &amp; Bagi Hasil</strong>: Sesuaikan persentase komisi per proyek &amp; catat status transfer.
                  </li>
                  <li>
                    <strong>Rekening Tim</strong>: Kelola hingga maksimal 10 rekening bank/PayPal/E-wallet di bawah ini.
                  </li>
                </ul>
              </div>
            </div>
          </div>

          {/* Embedded Payment Accounts Manager */}
          <PaymentAccountsList />
        </div>
      )}

      {/* ===================================================================
          MODAL 1: TAMBAH ANGGOTA TIM BARU
      =================================================================== */}
      {isAddUserOpen && (
        <div
          className="notion-modal-overlay"
          onClick={() => setIsAddUserOpen(false)}
        >
          <div
            className="notion-modal-box"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="d-flex align-items-center justify-content-between px-4 py-3 border-bottom">
              <div className="fw-bold d-flex align-items-center gap-2">
                <UserPlus size={16} />
                <span>Tambah Anggota Tim Baru</span>
              </div>
              <button
                type="button"
                className="btn btn-sm p-1 text-muted border-0 bg-transparent"
                onClick={() => setIsAddUserOpen(false)}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAddUserSubmit} className="p-4">
              {userError && (
                <div
                  className="alert alert-danger py-2 px-3 mb-3"
                  style={{ fontSize: '12.5px' }}
                >
                  {userError}
                </div>
              )}

              <div className="mb-3">
                <label
                  className="form-label fw-medium mb-1"
                  style={{ fontSize: '12.5px' }}
                >
                  Username Anggota <span className="text-danger">*</span>
                </label>
                <input
                  type="text"
                  className="notion-input w-100"
                  placeholder="Contoh: alex_hunter"
                  value={newUserForm.username}
                  onChange={(e) =>
                    setNewUserForm((prev) => ({
                      ...prev,
                      username: e.target.value,
                    }))
                  }
                  required
                  autoFocus
                />
              </div>

              <div className="mb-3">
                <label
                  className="form-label fw-medium mb-1"
                  style={{ fontSize: '12.5px' }}
                >
                  Email Login (Opsional)
                </label>
                <input
                  type="email"
                  className="notion-input w-100"
                  placeholder="Kosongkan untuk otomatis @atier-team.id"
                  value={newUserForm.email}
                  onChange={(e) =>
                    setNewUserForm((prev) => ({
                      ...prev,
                      email: e.target.value,
                    }))
                  }
                />
              </div>

              <div className="row g-3 mb-4">
                <div className="col-sm-6">
                  <label
                    className="form-label fw-medium mb-1"
                    style={{ fontSize: '12.5px' }}
                  >
                    Password Awal
                  </label>
                  <input
                    type="text"
                    className="notion-input w-100"
                    value={newUserForm.password}
                    onChange={(e) =>
                      setNewUserForm((prev) => ({
                        ...prev,
                        password: e.target.value,
                      }))
                    }
                    required
                  />
                </div>

                <div className="col-sm-6">
                  <label
                    className="form-label fw-medium mb-1"
                    style={{ fontSize: '12.5px' }}
                  >
                    Role Akses
                  </label>
                  <select
                    className="notion-select w-100"
                    value={newUserForm.role}
                    onChange={(e) =>
                      setNewUserForm((prev) => ({
                        ...prev,
                        role: e.target.value,
                      }))
                    }
                  >
                    <option value="user">Anggota Tim (Hunter)</option>
                    <option value="admin">Admin (Leader)</option>
                  </select>
                </div>
              </div>

              <div className="d-flex justify-content-end gap-2">
                <button
                  type="button"
                  className="btn-notion-outline"
                  onClick={() => setIsAddUserOpen(false)}
                >
                  Batal
                </button>
                <button type="submit" className="btn-notion-primary">
                  <UserPlus size={15} />
                  <span>Buat Akun Anggota</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================================================================
          MODAL 2: KOREKSI JAM KERJA & CATATAN ABSENSI
      =================================================================== */}
      {editingLog && (
        <div
          className="notion-modal-overlay"
          onClick={() => setEditingLog(null)}
        >
          <div
            className="notion-modal-box"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="d-flex align-items-center justify-content-between px-4 py-3 border-bottom">
              <div className="fw-bold d-flex align-items-center gap-2">
                <Edit3 size={16} />
                <span>
                  Koreksi Jam Kerja @{editingLog.username} ({editingLog.work_date})
                </span>
              </div>
              <button
                type="button"
                className="btn btn-sm p-1 text-muted border-0 bg-transparent"
                onClick={() => setEditingLog(null)}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveEditLog} className="p-4">
              <div className="row g-3 mb-3">
                <div className="col-6">
                  <label
                    className="form-label fw-medium mb-1"
                    style={{ fontSize: '12.5px' }}
                  >
                    Durasi Jam
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="24"
                    className="notion-input w-100"
                    value={editHours}
                    onChange={(e) => setEditHours(e.target.value)}
                  />
                </div>
                <div className="col-6">
                  <label
                    className="form-label fw-medium mb-1"
                    style={{ fontSize: '12.5px' }}
                  >
                    Durasi Menit
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="59"
                    className="notion-input w-100"
                    value={editMinutes}
                    onChange={(e) => setEditMinutes(e.target.value)}
                  />
                </div>
              </div>

              <div className="mb-4">
                <label
                  className="form-label fw-medium mb-1"
                  style={{ fontSize: '12.5px' }}
                >
                  Catatan Kerja Harian
                </label>
                <textarea
                  className="notion-input w-100"
                  rows={3}
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                />
              </div>

              <div className="d-flex justify-content-end gap-2">
                <button
                  type="button"
                  className="btn-notion-outline"
                  onClick={() => setEditingLog(null)}
                >
                  Batal
                </button>
                <button type="submit" className="btn-notion-primary">
                  <Save size={15} />
                  <span>Simpan Koreksi</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================================================================
          MODAL 3: INPUT LOG ABSENSI MANUAL
      =================================================================== */}
      {isManualLogOpen && (
        <div
          className="notion-modal-overlay"
          onClick={() => setIsManualLogOpen(false)}
        >
          <div
            className="notion-modal-box"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="d-flex align-items-center justify-content-between px-4 py-3 border-bottom">
              <div className="fw-bold d-flex align-items-center gap-2">
                <Plus size={16} />
                <span>Input Log Absensi Manual</span>
              </div>
              <button
                type="button"
                className="btn btn-sm p-1 text-muted border-0 bg-transparent"
                onClick={() => setIsManualLogOpen(false)}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAddManualLogSubmit} className="p-4">
              <div className="row g-3 mb-3">
                <div className="col-sm-6">
                  <label
                    className="form-label fw-medium mb-1"
                    style={{ fontSize: '12.5px' }}
                  >
                    Pilih Anggota Tim
                  </label>
                  <select
                    className="notion-select w-100"
                    value={
                      manualLogForm.username ||
                      allTeamMembers[0]?.username ||
                      ''
                    }
                    onChange={(e) =>
                      setManualLogForm((prev) => ({
                        ...prev,
                        username: e.target.value,
                      }))
                    }
                  >
                    {allTeamMembers.map((m) => (
                      <option key={m.username} value={m.username}>
                        @{m.username}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="col-sm-6">
                  <label
                    className="form-label fw-medium mb-1"
                    style={{ fontSize: '12.5px' }}
                  >
                    Tanggal Kerja
                  </label>
                  <input
                    type="date"
                    className="notion-input w-100"
                    value={manualLogForm.work_date}
                    onChange={(e) =>
                      setManualLogForm((prev) => ({
                        ...prev,
                        work_date: e.target.value,
                      }))
                    }
                    required
                  />
                </div>
              </div>

              <div className="row g-3 mb-3">
                <div className="col-6">
                  <label
                    className="form-label fw-medium mb-1"
                    style={{ fontSize: '12.5px' }}
                  >
                    Durasi Jam
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="24"
                    className="notion-input w-100"
                    value={manualLogForm.hours}
                    onChange={(e) =>
                      setManualLogForm((prev) => ({
                        ...prev,
                        hours: e.target.value,
                      }))
                    }
                  />
                </div>
                <div className="col-6">
                  <label
                    className="form-label fw-medium mb-1"
                    style={{ fontSize: '12.5px' }}
                  >
                    Durasi Menit
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="59"
                    className="notion-input w-100"
                    value={manualLogForm.minutes}
                    onChange={(e) =>
                      setManualLogForm((prev) => ({
                        ...prev,
                        minutes: e.target.value,
                      }))
                    }
                  />
                </div>
              </div>

              <div className="mb-4">
                <label
                  className="form-label fw-medium mb-1"
                  style={{ fontSize: '12.5px' }}
                >
                  Catatan Aktivitas Kerja
                </label>
                <textarea
                  className="notion-input w-100"
                  rows={3}
                  placeholder="Contoh: Hunting 15 prospek Maps & meeting klien..."
                  value={manualLogForm.notes}
                  onChange={(e) =>
                    setManualLogForm((prev) => ({
                      ...prev,
                      notes: e.target.value,
                    }))
                  }
                />
              </div>

              <div className="d-flex justify-content-end gap-2">
                <button
                  type="button"
                  className="btn-notion-outline"
                  onClick={() => setIsManualLogOpen(false)}
                >
                  Batal
                </button>
                <button type="submit" className="btn-notion-primary">
                  <Plus size={15} />
                  <span>Simpan Log Absensi</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Edit Aset Deliverables & Kredensial Project */}
      {editingProjectModal && (
        <div
          className="notion-modal-backdrop"
          onClick={() => setEditingProjectModal(null)}
        >
          <div
            className="notion-modal"
            style={{ maxWidth: '580px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="notion-modal-header d-flex align-items-center justify-content-between p-3 border-bottom">
              <div>
                <h6 className="fw-bold mb-0">
                  Deliverables &amp; Kredensial: {editingProjectModal.client_name}
                </h6>
                <div className="text-muted" style={{ fontSize: '11.5px' }}>
                  Simpan URL Live Website, URL staging, domain klien, dan kuota revisi.
                </div>
              </div>
              <button
                type="button"
                className="btn btn-sm p-1 border-0 bg-transparent text-muted"
                onClick={() => setEditingProjectModal(null)}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveProjectAssetForm} className="p-3">
              <div className="mb-3">
                <label
                  className="form-label text-muted mb-1"
                  style={{ fontSize: '11.5px' }}
                >
                  Live Website URL
                </label>
                <div className="input-group input-group-sm">
                  <input
                    type="url"
                    className="notion-input form-control"
                    placeholder="https://domainklien.com"
                    value={projectAssetForm.live_url}
                    onChange={(e) =>
                      setProjectAssetForm((prev) => ({
                        ...prev,
                        live_url: e.target.value,
                      }))
                    }
                  />
                  {sanitizeSafeUrl(projectAssetForm.live_url) && (
                    <a
                      href={sanitizeSafeUrl(projectAssetForm.live_url)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-outline-secondary"
                    >
                      <ExternalLink size={12} />
                    </a>
                  )}
                </div>
              </div>

              <div className="mb-3">
                <label
                  className="form-label text-muted mb-1"
                  style={{ fontSize: '11.5px' }}
                >
                  Staging / Preview Web URL
                </label>
                <div className="input-group input-group-sm">
                  <input
                    type="url"
                    className="notion-input form-control"
                    placeholder="https://staging.domain.com"
                    value={projectAssetForm.staging_url}
                    onChange={(e) =>
                      setProjectAssetForm((prev) => ({
                        ...prev,
                        staging_url: e.target.value,
                      }))
                    }
                  />
                  {sanitizeSafeUrl(projectAssetForm.staging_url) && (
                    <a
                      href={sanitizeSafeUrl(projectAssetForm.staging_url)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-outline-secondary"
                    >
                      <ExternalLink size={12} />
                    </a>
                  )}
                </div>
              </div>

              <div className="row g-2 mb-3">
                <div className="col-8">
                  <label
                    className="form-label text-muted mb-1"
                    style={{ fontSize: '11.5px' }}
                  >
                    Domain Klien
                  </label>
                  <input
                    type="text"
                    className="notion-input w-100"
                    placeholder="contoh: bisnisku.id"
                    value={projectAssetForm.domain}
                    onChange={(e) =>
                      setProjectAssetForm((prev) => ({
                        ...prev,
                        domain: e.target.value,
                      }))
                    }
                  />
                </div>
                <div className="col-4">
                  <label
                    className="form-label text-muted mb-1"
                    style={{ fontSize: '11.5px' }}
                  >
                    Maks Kuota Revisi
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    className="notion-input w-100"
                    value={projectAssetForm.max_revisions}
                    onChange={(e) =>
                      setProjectAssetForm((prev) => ({
                        ...prev,
                        max_revisions: e.target.value,
                      }))
                    }
                  />
                </div>
              </div>

              <div className="mb-3">
                <label
                  className="form-label text-muted mb-1"
                  style={{ fontSize: '11.5px' }}
                >
                  Kredensial Hosting / CMS (Rahasia &amp; Terbatas)
                </label>
                <textarea
                  className="notion-input w-100"
                  rows={2}
                  placeholder="cPanel / WP Admin login info..."
                  value={projectAssetForm.credentials}
                  onChange={(e) =>
                    setProjectAssetForm((prev) => ({
                      ...prev,
                      credentials: e.target.value,
                    }))
                  }
                />
              </div>

              <div className="d-flex justify-content-end gap-2 pt-2 border-top">
                <button
                  type="button"
                  className="btn-notion-outline"
                  onClick={() => setEditingProjectModal(null)}
                >
                  Batal
                </button>
                <button type="submit" className="btn-notion-primary">
                  <Save size={14} />
                  <span>Simpan Aset Proyek</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Atur Status Lifecycle & Jenjang Karir Anggota */}
      {isLifecycleModalOpen && (
        <div
          className="notion-modal-backdrop"
          onClick={() => setIsLifecycleModalOpen(false)}
        >
          <div
            className="notion-modal"
            style={{ maxWidth: '520px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="notion-modal-header d-flex align-items-center justify-content-between p-3 border-bottom">
              <div>
                <h6 className="fw-bold mb-0">
                  Atur Lifecycle &amp; Karir: @{lifecycleForm.username}
                </h6>
                <div className="text-muted" style={{ fontSize: '11.5px' }}>
                  Ubah status aktif, jenjang karir, target jam/prospek, dan catatan evaluasi.
                </div>
              </div>
              <button
                type="button"
                className="btn btn-sm p-1 border-0 bg-transparent text-muted"
                onClick={() => setIsLifecycleModalOpen(false)}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveLifecycleSubmit} className="p-3">
              <div className="row g-2 mb-3">
                <div className="col-6">
                  <label
                    className="form-label text-muted mb-1"
                    style={{ fontSize: '11.5px' }}
                  >
                    Status Lifecycle
                  </label>
                  <select
                    className="notion-select w-100"
                    value={lifecycleForm.status}
                    onChange={(e) => {
                      const nextStatus = e.target.value;
                      setLifecycleForm((prev) => {
                        let nextSuspendedUntil = prev.suspended_until;
                        if (nextStatus === 'suspended' && !nextSuspendedUntil) {
                          nextSuspendedUntil = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
                        } else if (nextStatus !== 'suspended') {
                          nextSuspendedUntil = null;
                        }
                        return {
                          ...prev,
                          status: nextStatus,
                          suspended_until: nextSuspendedUntil,
                        };
                      });
                    }}
                  >
                    <option value="active">🟢 Aktif (Active)</option>
                    <option value="suspended">🟠 Dinonaktifkan Sementara (Suspended)</option>
                    <option value="banned">🔴 Banned Permanen</option>
                    <option value="probation">
                      🟡 Masa Percobaan (Probation)
                    </option>
                    <option value="leave">🔵 Cuti (On Leave)</option>
                    <option value="inactive">⚪ Non-Aktif (Alumni)</option>
                  </select>
                </div>

                <div className="col-6">
                  <label
                    className="form-label text-muted mb-1"
                    style={{ fontSize: '11.5px' }}
                  >
                    Jenjang Karir (Career Tier)
                  </label>
                  <select
                    className="notion-select w-100"
                    value={lifecycleForm.tier}
                    onChange={(e) =>
                      setLifecycleForm((prev) => ({
                        ...prev,
                        tier: e.target.value,
                      }))
                    }
                  >
                    <option value="Junior Hunter">🌱 Junior Hunter</option>
                    <option value="Senior Hunter">⚡ Senior Hunter</option>
                    <option value="Lead Closer">👑 Lead Closer</option>
                    <option value="Core Partner">💎 Core Partner</option>
                  </select>
                </div>
              </div>

              {/* Dynamic Panel: Suspended Duration Settings */}
              {lifecycleForm.status === 'suspended' && (
                <div
                  className="p-3 rounded-2 border mb-3"
                  style={{ backgroundColor: '#fffbeb', borderColor: '#fef3c7' }}
                >
                  <div
                    className="fw-semibold mb-2 d-flex align-items-center gap-1 text-warning-emphasis"
                    style={{ fontSize: '12px' }}
                  >
                    <Clock size={14} />
                    <span>Batas Waktu Skorsing (Akun Otomatis Pulih Saat Tenggat Habis)</span>
                  </div>
                  <div className="text-muted mb-2" style={{ fontSize: '11.5px' }}>
                    Tentukan durasi penonaktifan akun @{lifecycleForm.username}. Begitu batas waktu tercapai, akun akan <strong>langsung aktif kembali secara otomatis</strong> dan anggota bisa login tanpa repot meminta aktivasi manual ke Admin.
                  </div>

                  <div className="d-flex flex-wrap gap-1 mb-2">
                    {[
                      { label: '1 Hari', val: '1' },
                      { label: '3 Hari', val: '3' },
                      { label: '7 Hari (1 Mgg)', val: '7' },
                      { label: '14 Hari (2 Mgg)', val: '14' },
                      { label: '30 Hari (1 Bln)', val: '30' },
                      { label: 'Kustom Tanggal & Jam', val: 'custom' },
                    ].map((p) => {
                      const isSel = lifecycleForm.suspensionDurationPreset === p.val;
                      return (
                        <button
                          key={p.val}
                          type="button"
                          onClick={() => {
                            if (p.val === 'custom') {
                              setLifecycleForm((prev) => ({
                                ...prev,
                                suspensionDurationPreset: 'custom',
                              }));
                            } else {
                              const d = new Date(Date.now() + Number(p.val) * 24 * 60 * 60 * 1000);
                              setLifecycleForm((prev) => ({
                                ...prev,
                                suspensionDurationPreset: p.val,
                                suspended_until: d.toISOString(),
                              }));
                            }
                          }}
                          className={`btn btn-sm py-1 px-2 ${
                            isSel ? 'btn-dark text-white' : 'btn-outline-secondary bg-white'
                          }`}
                          style={{ fontSize: '11px', borderRadius: '4px' }}
                        >
                          {p.label}
                        </button>
                      );
                    })}
                  </div>

                  {lifecycleForm.suspensionDurationPreset === 'custom' && (
                    <div className="mt-2">
                      <label className="form-label text-muted mb-1" style={{ fontSize: '11px' }}>
                        Pilih Tanggal &amp; Jam Berakhirnya Skorsing:
                      </label>
                      <input
                        type="datetime-local"
                        className="notion-input w-100"
                        value={
                          lifecycleForm.suspended_until
                            ? new Date(lifecycleForm.suspended_until).toISOString().slice(0, 16)
                            : ''
                        }
                        onChange={(e) => {
                          const val = e.target.value;
                          setLifecycleForm((prev) => ({
                            ...prev,
                            suspended_until: val ? new Date(val).toISOString() : '',
                          }));
                        }}
                      />
                    </div>
                  )}

                  <div className="mt-2 text-dark" style={{ fontSize: '11.5px' }}>
                    ⏰ <strong>Tenggat Aktif Kembali:</strong>{' '}
                    {lifecycleForm.suspended_until ? (
                      <span className="text-primary fw-bold">
                        {new Date(lifecycleForm.suspended_until).toLocaleString('id-ID', {
                          dateStyle: 'full',
                          timeStyle: 'short',
                        })}
                      </span>
                    ) : (
                      <span className="text-muted">Pilih durasi skorsing di atas</span>
                    )}
                  </div>
                </div>
              )}

              {/* Dynamic Panel: Banned Permanen Notice */}
              {lifecycleForm.status === 'banned' && (
                <div
                  className="p-3 rounded-2 border border-danger bg-danger-subtle text-danger mb-3"
                  style={{ fontSize: '12px' }}
                >
                  <div className="fw-bold mb-1 d-flex align-items-center gap-1">
                    <AlertCircle size={14} />
                    <span>Perhatian: Ban Permanen</span>
                  </div>
                  <div>
                    Akun @{lifecycleForm.username} akan diblokir total secara permanen dari seluruh sistem studio dan tidak dapat login sama sekali sampai Admin memulihkan statusnya secara manual.
                  </div>
                </div>
              )}

              <div className="row g-2 mb-3">
                <div className="col-4">
                  <label
                    className="form-label text-muted mb-1"
                    style={{ fontSize: '11.5px' }}
                  >
                    Target Jam / Hari
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="24"
                    className="notion-input w-100"
                    value={lifecycleForm.targetDailyHours}
                    onChange={(e) =>
                      setLifecycleForm((prev) => ({
                        ...prev,
                        targetDailyHours: e.target.value,
                      }))
                    }
                  />
                </div>

                <div className="col-4">
                  <label
                    className="form-label text-muted mb-1"
                    style={{ fontSize: '11.5px' }}
                  >
                    Target Prospek / Hari
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    className="notion-input w-100"
                    value={lifecycleForm.targetDailyProspects}
                    onChange={(e) =>
                      setLifecycleForm((prev) => ({
                        ...prev,
                        targetDailyProspects: e.target.value,
                      }))
                    }
                  />
                </div>

                <div className="col-4">
                  <label
                    className="form-label text-muted mb-1"
                    style={{ fontSize: '11.5px' }}
                  >
                    Rate Komisi (%)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    className="notion-input w-100"
                    value={lifecycleForm.customCommissionRate}
                    onChange={(e) =>
                      setLifecycleForm((prev) => ({
                        ...prev,
                        customCommissionRate: e.target.value,
                      }))
                    }
                  />
                </div>
              </div>

              <div className="mb-3">
                <label
                  className="form-label text-muted mb-1"
                  style={{ fontSize: '11.5px' }}
                >
                  Catatan Evaluasi Kinerja &amp; Feedback Admin
                </label>
                <textarea
                  className="notion-input w-100"
                  rows={3}
                  placeholder="Tulis evaluasi performa, saran peningkatan, konsistensi follow-up, atau apresiasi..."
                  value={lifecycleForm.evaluationNotes}
                  onChange={(e) =>
                    setLifecycleForm((prev) => ({
                      ...prev,
                      evaluationNotes: e.target.value,
                    }))
                  }
                />
              </div>

              <div className="d-flex align-items-center justify-content-between gap-2 pt-3 border-top">
                {lifecycleForm.username !== profile?.username ? (
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-danger d-inline-flex align-items-center gap-1"
                    onClick={() =>
                      handleDeleteUser({
                        id: lifecycleForm.id,
                        username: lifecycleForm.username,
                      })
                    }
                  >
                    <Trash2 size={13} />
                    <span>Hapus Akun</span>
                  </button>
                ) : (
                  <div />
                )}

                <div className="d-flex gap-2">
                  <button
                    type="button"
                    className="btn-notion-outline"
                    onClick={() => setIsLifecycleModalOpen(false)}
                  >
                    Batal
                  </button>
                  <button type="submit" className="btn-notion-primary">
                    <Save size={14} />
                    <span>Simpan Perubahan Karir &amp; Akun</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}