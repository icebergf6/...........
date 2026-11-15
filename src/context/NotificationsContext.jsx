import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useAuth } from './AuthContext';
import { useProspects } from './ProspectsContext';
import { useAttendance } from './AttendanceContext';
import {
  getFollowUpStatus,
  getRenewalStatus,
  getStudioSettings,
  getTodayDateString,
  toLocalDateString,
  formatCurrency,
  calculateCommission,
} from '../lib/supabase';

const NotificationsContext = createContext(null);
const READ_STORAGE_KEY_PREFIX = 'atier_crm_notif_read_v1_';
const DISMISSED_STORAGE_KEY_PREFIX = 'atier_crm_notif_dismissed_v1_';
const POPUP_PREF_KEY = 'atier_crm_notif_popup_enabled_v1';

export function NotificationsProvider({ children }) {
  const { user, profile } = useAuth();
  const { prospects, allTeamProspects, dealClients } = useProspects();
  const { myTodayLog, myTodayElapsedSeconds } = useAttendance();

  const [studioSettings, setStudioSettings] = useState(() =>
    getStudioSettings()
  );

  const storageUserKey = user?.id || profile?.username || 'anon';

  const [readIds, setReadIds] = useState(() => {
    try {
      const raw = localStorage.getItem(READ_STORAGE_KEY_PREFIX + storageUserKey);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  const [dismissedIds, setDismissedIds] = useState(() => {
    try {
      const raw = localStorage.getItem(
        DISMISSED_STORAGE_KEY_PREFIX + storageUserKey
      );
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  const [popupEnabled, setPopupEnabled] = useState(() => {
    const raw = localStorage.getItem(POPUP_PREF_KEY);
    return raw === null ? true : raw === 'true';
  });

  // Live floating toast queue
  const [activePopups, setActivePopups] = useState([]);
  const seenPopupIdsRef = useRef(new Set());

  // Reload per-user read/dismissed lists when user changes
  useEffect(() => {
    try {
      const rRaw = localStorage.getItem(READ_STORAGE_KEY_PREFIX + storageUserKey);
      const dRaw = localStorage.getItem(
        DISMISSED_STORAGE_KEY_PREFIX + storageUserKey
      );
      setReadIds(rRaw ? JSON.parse(rRaw) : []);
      setDismissedIds(dRaw ? JSON.parse(dRaw) : []);
      seenPopupIdsRef.current = new Set();
      setActivePopups([]);
    } catch {
      setReadIds([]);
      setDismissedIds([]);
    }
  }, [storageUserKey]);

  // Listen for studio settings changes
  useEffect(() => {
    function handleSettingsUpdated(e) {
      setStudioSettings(e.detail || getStudioSettings());
    }
    window.addEventListener(
      'atier-studio-settings-updated',
      handleSettingsUpdated
    );
    return () =>
      window.removeEventListener(
        'atier-studio-settings-updated',
        handleSettingsUpdated
      );
  }, []);

  const todayStr = getTodayDateString();
  const targetHours = Number(studioSettings.dailyTargetHours) || 3;
  const targetProspects = Number(studioSettings.dailyTargetProspects) || 10;

  // Build live unified notifications list from all CRM modules
  const allNotifications = useMemo(() => {
    if (!user) return [];

    const items = [];
    const unameLower = (profile?.username || '').toLowerCase();

    // 1. Follow-up Reminders (Overdue & Today)
    prospects.forEach((p) => {
      const fuStatus = getFollowUpStatus(p.next_follow_up_date, p.status);
      if (fuStatus === 'overdue') {
        items.push({
          id: `fu-overdue-${p.id}-${p.next_follow_up_date}`,
          category: 'followup',
          severity: 'high',
          title: `Follow-Up Terlewat: ${p.client_name}`,
          message: `Jadwal follow-up (${p.next_follow_up_date}) sudah lewat. Status: ${p.status} • PIC @${p.created_by_username || 'tim'}.`,
          actionLabel: 'Buka Detail Klien',
          actionPath: `/prospects?open=${encodeURIComponent(p.id)}`,
          timestamp: p.next_follow_up_date + 'T08:00:00Z',
          badgeText: 'Terlewat',
        });
      } else if (fuStatus === 'today') {
        items.push({
          id: `fu-today-${p.id}-${p.next_follow_up_date}`,
          category: 'followup',
          severity: 'medium',
          title: `Jadwal Follow-Up Hari Ini: ${p.client_name}`,
          message: `Waktunya follow-up klien ini hari ini (${p.source_platform}). PIC: @${p.created_by_username || 'tim'}.`,
          actionLabel: 'Hubungi & Catat',
          actionPath: `/prospects?open=${encodeURIComponent(p.id)}`,
          timestamp: p.next_follow_up_date + 'T09:00:00Z',
          badgeText: 'Hari Ini',
        });
      }
    });

    // 2. Domain / Hosting / Maintenance Renewal Alerts (Hanya untuk klien Full Managed)
    dealClients.forEach((d) => {
      if (d.management_type === 'project_only' || !d.renewal_enabled) return;
      const rInfo = getRenewalStatus(d.renewal_due_date, d.renewal_enabled, d.management_type);
      const curr = d.currency || 'IDR';
      if (rInfo.status === 'expired') {
        items.push({
          id: `rnw-exp-${d.id}-${d.renewal_due_date}`,
          category: 'renewal',
          severity: 'high',
          title: `Domain / Hosting Expired: ${d.client_name}`,
          message: `${d.delivery_assets?.domain || d.client_name} (${rInfo.daysText}). Tagihan: ${formatCurrency(d.renewal_price, curr)}.`,
          actionLabel: 'Tagih Perpanjangan',
          actionPath: `/deals?tab=renewals&open=${encodeURIComponent(d.id)}`,
          timestamp: (d.renewal_due_date || todayStr) + 'T07:30:00Z',
          badgeText: 'Expired',
        });
      } else if (rInfo.status === 'expiring_soon') {
        items.push({
          id: `rnw-soon-${d.id}-${d.renewal_due_date}`,
          category: 'renewal',
          severity: 'medium',
          title: `Perpanjangan Segera Habis: ${d.client_name}`,
          message: `Jatuh tempo ${d.renewal_due_date} (${rInfo.daysText}) • Tagihan ${formatCurrency(d.renewal_price, curr)}.`,
          actionLabel: 'Lihat Langganan',
          actionPath: `/deals?tab=renewals&open=${encodeURIComponent(d.id)}`,
          timestamp: todayStr + 'T08:15:00Z',
          badgeText: rInfo.daysText,
        });
      }
    });

    // 3. New Deals & Commission Payout Status
    dealClients.forEach((d) => {
      const curr = d.currency || 'IDR';
      const isMine =
        (user?.id && d.user_id === user.id) ||
        (unameLower && (d.created_by_username || '').toLowerCase() === unameLower);

      const dealDay = toLocalDateString(d.deal_date || d.created_at);
      if (dealDay === todayStr || dealClients.indexOf(d) < 2) {
        items.push({
          id: `deal-win-${d.id}`,
          category: 'deal',
          severity: 'success',
          title: `Closing Deal: ${d.client_name}`,
          message: `Nilai kontrak ${formatCurrency(d.project_value, curr)} (${d.payment_status}) oleh @${d.created_by_username || 'tim'}.`,
          actionLabel: 'Lihat Keuangan',
          actionPath: `/deals?open=${encodeURIComponent(d.id)}`,
          timestamp: d.deal_date || d.created_at || todayStr + 'T10:00:00Z',
          badgeText: 'Deal',
        });
      }

      if (isMine && d.commission?.status === 'paid') {
        const comm = calculateCommission(d, d.commission?.hunter_rate);
        items.push({
          id: `comm-paid-${d.id}-${d.commission?.paid_at || ''}`,
          category: 'deal',
          severity: 'success',
          title: `Komisi Ditransfer: ${d.client_name}`,
          message: `Fee hunter Anda sebesar ${formatCurrency(comm.hunterAmount, curr)} telah ditandai Sudah Ditransfer oleh Admin.`,
          actionLabel: 'Cek Komisi Saya',
          actionPath: '/profile',
          timestamp: d.commission?.paid_at || d.deal_date || todayStr + 'T11:00:00Z',
          badgeText: 'Paid',
        });
      }
    });

    // 4. Attendance Stopwatch & Daily Target KPI Alerts for Current User
    const myTodayProspectsCount = prospects.filter((p) => {
      const isMine =
        (user?.id && p.user_id === user.id) ||
        (unameLower && (p.created_by_username || '').toLowerCase() === unameLower);
      return isMine && toLocalDateString(p.created_at) === todayStr;
    }).length;

    if (!myTodayLog) {
      items.push({
        id: `att-idle-${todayStr}`,
        category: 'attendance',
        severity: 'info',
        title: 'Stopwatch Absen Belum Dinyalakan',
        message: `Anda belum memulai stopwatch kerja hari ini (${todayStr}). Nyalakan agar jam kerja & leaderboard tercatat.`,
        actionLabel: 'Mulai Absen',
        actionPath: '/attendance',
        timestamp: todayStr + 'T07:00:00Z',
        badgeText: 'Absen',
      });
    } else if (myTodayLog.status === 'paused') {
      items.push({
        id: `att-paused-${todayStr}-${myTodayLog.id}`,
        category: 'attendance',
        severity: 'medium',
        title: 'Stopwatch Kerja Sedang Jeda',
        message: 'Jangan lupa lanjutkan stopwatch kembali setelah selesai istirahat.',
        actionLabel: 'Lanjutkan',
        actionPath: '/attendance',
        timestamp: myTodayLog.updated_at || todayStr + 'T12:00:00Z',
        badgeText: 'Jeda',
      });
    }

    if (myTodayElapsedSeconds >= targetHours * 3600) {
      items.push({
        id: `kpi-hours-met-${todayStr}`,
        category: 'attendance',
        severity: 'success',
        title: `Target ${targetHours} Jam Kerja Tercapai!`,
        message: 'Luar biasa! Anda sudah memenuhi target jam kerja harian dari Admin.',
        actionLabel: 'Lihat Leaderboard',
        actionPath: '/leaderboard',
        timestamp: todayStr + 'T16:00:00Z',
        badgeText: 'Target ✓',
      });
    }

    if (myTodayProspectsCount >= targetProspects) {
      items.push({
        id: `kpi-pros-met-${todayStr}`,
        category: 'attendance',
        severity: 'success',
        title: `Target ${targetProspects} Prospek Harian Tercapai!`,
        message: `Anda sudah menginput ${myTodayProspectsCount} prospek hari ini. Pertahankan momentum hunting!`,
        actionLabel: 'Lihat Prospek',
        actionPath: '/prospects',
        timestamp: todayStr + 'T16:05:00Z',
        badgeText: 'KPI ✓',
      });
    }

    // 5. Admin Audit Verification Alerts (Khusus prospek milik user)
    prospects.forEach((p) => {
      if (p.verification_status === 'verified') {
        items.push({
          id: `audit-ver-${p.id}`,
          category: 'audit',
          severity: 'success',
          title: `✓ Prospek Diverifikasi: ${p.client_name}`,
          message: `Data prospek keaslian kerja Anda telah disetujui & diverifikasi oleh Admin.`,
          actionLabel: 'Buka Prospek',
          actionPath: `/prospects?open=${encodeURIComponent(p.id)}`,
          timestamp: p.verified_at || p.updated_at || todayStr + 'T12:00:00Z',
          badgeText: 'Terverifikasi',
        });
      } else if (p.verification_status === 'rejected') {
        items.push({
          id: `audit-rej-${p.id}`,
          category: 'audit',
          severity: 'high',
          title: `✕ Prospek Ditolak Audit: ${p.client_name}`,
          message: `Catatan Admin: ${
            p.verification_notes ||
            p.verification_note ||
            'Data ditolak saat audit keaslian harian.'
          }`,
          actionLabel: 'Periksa Prospek',
          actionPath: `/prospects?open=${encodeURIComponent(p.id)}`,
          timestamp: p.verified_at || p.updated_at || todayStr + 'T12:00:00Z',
          badgeText: 'Ditolak',
        });
      }
    });

    // 6. Project Assignee (PIC) Assignments
    const projectPool = allTeamProspects || prospects;
    projectPool.forEach((proj) => {
      if (proj.status === 'Deal' && proj.project_assignee) {
        const isMyAssignee =
          unameLower &&
          proj.project_assignee.trim().toLowerCase() === unameLower;
        if (isMyAssignee) {
          items.push({
            id: `pic-assign-${proj.id}-${proj.project_status || 'briefing'}`,
            category: 'project',
            severity: 'medium',
            title: `🎯 Ditugaskan Sebagai PIC: ${proj.client_name}`,
            message: `Admin menunjuk Anda sebagai PIC teknis untuk pengerjaan website ini. Status: ${
              proj.project_status || 'Briefing'
            }.`,
            actionLabel: 'Buka Pengerjaan Web',
            actionPath: `/deals?open=${encodeURIComponent(proj.id)}`,
            timestamp:
              proj.deal_date || proj.updated_at || todayStr + 'T13:00:00Z',
            badgeText: 'PIC Proyek',
          });
        }
      }
    });

    // 7. Peringatan Stopwatch Jeda Terlalu Lama (>30 Menit)
    if (myTodayLog?.status === 'paused' && myTodayLog.updated_at) {
      const pauseElapsedMin = Math.floor(
        (Date.now() - new Date(myTodayLog.updated_at).getTime()) / 60000
      );
      if (pauseElapsedMin >= 30) {
        items.push({
          id: `att-idle-long-${todayStr}-${Math.floor(pauseElapsedMin / 30)}`,
          category: 'attendance',
          severity: 'high',
          title: `⚠️ Stopwatch Jeda Terlalu Lama (${pauseElapsedMin} Menit)`,
          message:
            'Stopwatch kerja Anda sudah dalam status jeda lebih dari 30 menit. Lanjutkan agar target jam kerja tercapai.',
          actionLabel: 'Lanjutkan Kerja',
          actionPath: '/attendance',
          timestamp: myTodayLog.updated_at,
          badgeText: 'Jeda >30m',
        });
      }
    }

    // Filter dismissed & sort by severity priority then timestamp desc
    const severityWeight = { high: 4, medium: 3, success: 2, info: 1 };
    return items
      .filter((n) => !dismissedIds.includes(n.id))
      .map((n) => ({
        ...n,
        isRead: readIds.includes(n.id),
      }))
      .sort((a, b) => {
        if (a.isRead !== b.isRead) return a.isRead ? 1 : -1;
        const swDiff =
          (severityWeight[b.severity] || 0) - (severityWeight[a.severity] || 0);
        if (swDiff !== 0) return swDiff;
        return (b.timestamp || '').localeCompare(a.timestamp || '');
      });
  }, [
    user,
    profile?.username,
    prospects,
    allTeamProspects,
    dealClients,
    myTodayLog,
    myTodayElapsedSeconds,
    targetHours,
    targetProspects,
    todayStr,
    readIds,
    dismissedIds,
  ]);

  const unreadCount = useMemo(
    () => allNotifications.filter((n) => !n.isRead).length,
    [allNotifications]
  );

  // Queue upgraded floating toast popups for new high/medium/success unread notifications
  useEffect(() => {
    if (!user || !popupEnabled) return;

    const freshCandidates = allNotifications.filter(
      (n) =>
        !n.isRead &&
        !seenPopupIdsRef.current.has(n.id) &&
        (n.severity === 'high' ||
          n.severity === 'medium' ||
          n.severity === 'success')
    );

    if (freshCandidates.length === 0) return;

    // Limit initial flood to top 2 priority alerts so UI stays clean
    const toDisplay = freshCandidates.slice(0, 2);
    freshCandidates.forEach((n) => seenPopupIdsRef.current.add(n.id));

    setActivePopups((prev) => {
      const existingIds = new Set(prev.map((x) => x.id));
      const merged = [
        ...toDisplay.filter((x) => !existingIds.has(x.id)),
        ...prev,
      ];
      return merged.slice(0, 3);
    });
  }, [allNotifications, user, popupEnabled]);

  // Auto-hide popups after 6.5 seconds
  useEffect(() => {
    if (activePopups.length === 0) return;
    const timer = setTimeout(() => {
      setActivePopups((prev) => prev.slice(0, -1));
    }, 6500);
    return () => clearTimeout(timer);
  }, [activePopups]);

  function markAsRead(id) {
    setReadIds((prev) => {
      if (prev.includes(id)) return prev;
      const next = [...prev, id];
      localStorage.setItem(
        READ_STORAGE_KEY_PREFIX + storageUserKey,
        JSON.stringify(next)
      );
      return next;
    });
  }

  function markAllAsRead() {
    const allIds = Array.from(
      new Set([...readIds, ...allNotifications.map((n) => n.id)])
    );
    setReadIds(allIds);
    localStorage.setItem(
      READ_STORAGE_KEY_PREFIX + storageUserKey,
      JSON.stringify(allIds)
    );
    setActivePopups([]);
  }

  function dismissNotification(id) {
    setDismissedIds((prev) => {
      if (prev.includes(id)) return prev;
      const next = [...prev, id];
      localStorage.setItem(
        DISMISSED_STORAGE_KEY_PREFIX + storageUserKey,
        JSON.stringify(next)
      );
      return next;
    });
    setActivePopups((prev) => prev.filter((p) => p.id !== id));
  }

  function closePopup(id) {
    setActivePopups((prev) => prev.filter((p) => p.id !== id));
  }

  function togglePopupEnabled(val) {
    const next = Boolean(val);
    setPopupEnabled(next);
    localStorage.setItem(POPUP_PREF_KEY, String(next));
    if (!next) setActivePopups([]);
  }

  function triggerTestPopup() {
    const testNotif = {
      id: 'test-popup-' + Date.now(),
      category: 'attendance',
      severity: 'success',
      title: 'Popup Notifikasi Aktif!',
      message:
        'Notifikasi follow-up, domain expired, closing deal, dan target harian akan muncul real-time di sini.',
      actionLabel: 'Lihat Semua',
      actionPath: '/notifications',
      badgeText: 'Live Test',
      isRead: false,
    };
    setActivePopups((prev) => [testNotif, ...prev].slice(0, 3));
  }

  return (
    <NotificationsContext.Provider
      value={{
        notifications: allNotifications,
        unreadCount,
        activePopups,
        popupEnabled,
        markAsRead,
        markAllAsRead,
        dismissNotification,
        closePopup,
        togglePopupEnabled,
        triggerTestPopup,
      }}
    >
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationsContext);
  if (!ctx) {
    throw new Error(
      'useNotifications must be used inside NotificationsProvider'
    );
  }
  return ctx;
}
