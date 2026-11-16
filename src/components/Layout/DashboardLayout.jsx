import React, { useState, useMemo, useEffect, useRef } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  Users,
  Wallet,
  UserCircle,
  ShieldCheck,
  LogOut,
  Menu,
  X,
  Database,
  Clock,
  Trophy,
  Sparkles,
  Bell,
  ArrowRight,
  Play,
  Pause,
  CheckCheck,
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Briefcase,
  UserCheck,
  CheckSquare,
  Server,
  BookOpen,
  Sliders,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useProspects } from '../../context/ProspectsContext';
import { useAttendance } from '../../context/AttendanceContext';
import { useNotifications } from '../../context/NotificationsContext';
import {
  formatDurationHMS,
  formatCurrency,
  getStudioSettings,
} from '../../lib/supabase';

const ROUTE_TITLES = {
  '/attendance': 'Absen & Stopwatch Kerja',
  '/prospects': 'Database Prospek',
  '/deals': 'Klien Deal & Keuangan',
  '/managed-hosting': 'Full Managed Hosting & Domain',
  '/leaderboard': 'Leaderboard Kompetisi Tim',
  '/notifications': 'Pusat Notifikasi',
  '/profile': 'Profile & Komisi Saya',
  '/guide': 'Buku Panduan & SOP Operasional',
  '/admin': 'Admin Command Center',
  '/admin/production': 'Admin — Produksi & Bagi Hasil',
  '/admin/projects': 'Admin — Manajemen Project',
  '/admin/users-lifecycle': 'Admin — Manajemen User Berkelanjutan',
  '/admin/audit': 'Admin — Audit Keaslian Kerja Harian',
};

export default function DashboardLayout() {
  const { profile, logout, isSupabaseConfigured } = useAuth();
  const { prospects, dealClients } = useProspects();
  const {
    myTodayLog,
    myTodayElapsedSeconds,
    startWork,
    pauseWork,
    resumeWork,
    timerMode,
    countdownRemaining,
    isCountdownRunning,
    pomodoroStage,
  } = useAttendance();
  const {
    notifications,
    unreadCount,
    activePopups,
    markAsRead,
    markAllAsRead,
    closePopup,
  } = useNotifications();
  const navigate = useNavigate();
  const location = useLocation();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showCelebration, setShowCelebration] = useState(true);
  const [showActivityFeed, setShowActivityFeed] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);
  const [bellTab, setBellTab] = useState('all'); // 'all' | 'unread'
  const bellRef = useRef(null);
  const [dailyTargetHours, setDailyTargetHours] = useState(
    () => getStudioSettings().dailyTargetHours || 6
  );

  // Close bell popover when clicking outside
  useEffect(() => {
    function handleClickOutside(e) {
      if (bellRef.current && !bellRef.current.contains(e.target)) {
        setBellOpen(false);
      }
    }
    if (bellOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [bellOpen]);

  useEffect(() => {
    function handleSettingsUpdated(e) {
      if (e.detail?.dailyTargetHours) {
        setDailyTargetHours(Number(e.detail.dailyTargetHours) || 6);
      } else {
        setDailyTargetHours(getStudioSettings().dailyTargetHours || 6);
      }
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

  async function handleLogout() {
    await logout();
    navigate('/auth');
  }

  const displayUsername = profile?.username || 'user';
  const initials = displayUsername.slice(0, 2).toUpperCase();

  const fullManagedCount = useMemo(() => {
    return (dealClients || []).filter(
      (p) => p.status === 'Deal' && p.management_type !== 'project_only'
    ).length;
  }, [dealClients]);
  const effectiveDailyTargetHours =
    Number(profile?.targetDailyHours) || Number(dailyTargetHours) || 6;
  const isWorking = myTodayLog?.status === 'running';
  const isPaused = myTodayLog?.status === 'paused';

  // Latest closed deal for celebration banner
  const latestDeal = useMemo(() => {
    if (!dealClients || !dealClients.length) return null;
    return dealClients[0];
  }, [dealClients]);

  // Combined live activity feed items
  const recentActivities = useMemo(() => {
    const items = [];

    dealClients.forEach((d) => {
      items.push({
        id: 'act-deal-' + d.id,
        type: 'deal',
        title: `Closing Klien: ${d.client_name}`,
        subtitle: `${formatCurrency(d.project_value, d.currency)} • Hunter @${d.created_by_username || 'tim'}`,
        timestamp: d.deal_date || d.created_at,
      });
    });

    prospects.slice(0, 4).forEach((p) => {
      if (p.status !== 'Deal') {
        items.push({
          id: 'act-pros-' + p.id,
          type: 'prospect',
          title: `Prospek Baru: ${p.client_name}`,
          subtitle: `Sumber ${p.source_platform} • Oleh @${p.created_by_username || 'tim'}`,
          timestamp: p.created_at,
        });
      }
    });

    return items.sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || '')).slice(0, 6);
  }, [dealClients, prospects]);

  return (
    <div className="notion-app-shell">
      {/* Mobile Sidebar Backdrop */}
      {sidebarOpen && (
        <div
          className="notion-drawer-backdrop d-lg-none"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Notion-Style Sidebar */}
      <aside className={`notion-sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="notion-workspace-header d-flex align-items-center justify-content-between">
          <div className="d-flex align-items-center gap-2 overflow-hidden">
            <span className="notion-workspace-badge">{initials}</span>
            <div className="text-truncate">
              <div
                className="fw-semibold text-truncate"
                style={{ fontSize: '13.5px', lineHeight: 1.2 }}
              >
                A-Tier Team CRM
              </div>
              <div
                className="text-muted text-truncate"
                style={{ fontSize: '11.5px' }}
              >
                @{displayUsername}
              </div>
            </div>
          </div>
          <button
            type="button"
            className="btn btn-sm p-1 d-lg-none text-muted"
            onClick={() => setSidebarOpen(false)}
          >
            <X size={16} />
          </button>
        </div>

        {/* Interactive Live Mini-Stopwatch Banner in Sidebar */}
        <div className="px-2 pt-2">
          <div
            className="px-3 py-2 rounded-2"
            style={{
              backgroundColor: isWorking
                ? '#dcfce7'
                : isPaused
                ? '#fef3c7'
                : '#ededeb',
              color: isWorking
                ? '#166534'
                : isPaused
                ? '#92400e'
                : '#37352f',
              fontSize: '12px',
            }}
          >
            <div className="d-flex align-items-center justify-content-between gap-2">
              <NavLink
                to="/attendance"
                onClick={() => setSidebarOpen(false)}
                className="text-decoration-none d-flex align-items-center gap-1 fw-semibold flex-grow-1 text-truncate"
                style={{ color: 'inherit' }}
              >
                <Clock size={13} />
                <span className="text-truncate">
                  {timerMode === 'pomodoro'
                    ? pomodoroStage === 'work'
                      ? '🍅 Pomodoro Fokus'
                      : '☕ Istirahat 5m'
                    : timerMode === 'countdown'
                    ? '⏳ Countdown'
                    : isWorking
                    ? 'Sedang Kerja'
                    : isPaused
                    ? 'Stopwatch Jeda'
                    : myTodayLog?.status === 'completed'
                    ? 'Selesai Kerja'
                    : 'Absen Kerja'}
                </span>
              </NavLink>

              <span
                className="fw-bold"
                style={{ fontVariantNumeric: 'tabular-nums' }}
              >
                {timerMode === 'pomodoro' || timerMode === 'countdown'
                  ? formatDurationHMS(countdownRemaining)
                  : formatDurationHMS(myTodayElapsedSeconds)}
              </span>

              {isWorking || isCountdownRunning ? (
                <button
                  type="button"
                  onClick={() => pauseWork()}
                  className="btn btn-sm p-1 border-0 bg-white rounded text-success d-inline-flex align-items-center justify-content-center"
                  title="Jeda stopwatch sementara"
                >
                  <Pause size={11} />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => (myTodayLog ? resumeWork() : startWork())}
                  className="btn btn-sm p-1 border-0 bg-dark text-white rounded d-inline-flex align-items-center justify-content-center"
                  title={
                    myTodayLog ? 'Lanjutkan stopwatch' : 'Mulai absen & stopwatch'
                  }
                >
                  <Play size={11} />
                </button>
              )}
            </div>

            {/* Mini Target Progress Bar */}
            <div
              className="progress mt-2"
              style={{ height: '4px', backgroundColor: 'rgba(0,0,0,0.08)' }}
              title={`Target Harian: ${effectiveDailyTargetHours} Jam`}
            >
              <div
                className={`progress-bar ${
                  myTodayElapsedSeconds >= effectiveDailyTargetHours * 3600
                    ? 'bg-success'
                    : 'bg-dark'
                }`}
                style={{
                  width: `${Math.min(
                    100,
                    Math.round(
                      (myTodayElapsedSeconds /
                        Math.max(1, effectiveDailyTargetHours * 3600)) *
                        100
                    )
                  )}%`,
                }}
              />
            </div>
          </div>
        </div>

        {/* Navigation Links */}
        <div className="flex-grow-1 py-2 overflow-auto">
          <div className="notion-nav-section-label">Workspace Tim</div>

          <NavLink
            to="/attendance"
            onClick={() => setSidebarOpen(false)}
            className={({ isActive }) =>
              `notion-nav-item ${isActive ? 'active' : ''}`
            }
          >
            <Clock size={16} />
            <span className="flex-grow-1">Absen &amp; Stopwatch</span>
          </NavLink>

          <NavLink
            to="/prospects"
            onClick={() => setSidebarOpen(false)}
            className={({ isActive }) =>
              `notion-nav-item ${isActive ? 'active' : ''}`
            }
          >
            <Users size={16} />
            <span className="flex-grow-1">
              {profile?.role === 'admin' ? 'Prospek Tim' : 'Prospek Saya'}
            </span>
            <span
              className="badge rounded-pill"
              style={{
                backgroundColor: '#e9e9e7',
                color: '#37352f',
                fontSize: '11px',
                fontWeight: 600,
              }}
            >
              {prospects.length}
            </span>
          </NavLink>

          <NavLink
            to="/deals"
            onClick={() => setSidebarOpen(false)}
            className={({ isActive }) =>
              `notion-nav-item ${isActive ? 'active' : ''}`
            }
          >
            <Wallet size={16} />
            <span className="flex-grow-1">Klien Deal &amp; Keuangan</span>
            <span
              className="badge rounded-pill"
              style={{
                backgroundColor: '#dcfce7',
                color: '#166534',
                fontSize: '11px',
                fontWeight: 600,
              }}
            >
              {dealClients.length}
            </span>
          </NavLink>

          <NavLink
            to="/managed-hosting"
            onClick={() => setSidebarOpen(false)}
            className={({ isActive }) =>
              `notion-nav-item ${isActive ? 'active' : ''}`
            }
          >
            <Server size={16} />
            <span className="flex-grow-1">Managed Hosting</span>
            <span
              className="badge rounded-pill"
              style={{
                backgroundColor: '#e0f2fe',
                color: '#0369a1',
                fontSize: '11px',
                fontWeight: 600,
              }}
            >
              {fullManagedCount}
            </span>
          </NavLink>

          <NavLink
            to="/leaderboard"
            onClick={() => setSidebarOpen(false)}
            className={({ isActive }) =>
              `notion-nav-item ${isActive ? 'active' : ''}`
            }
          >
            <Trophy size={16} />
            <span className="flex-grow-1">Leaderboard Tim</span>
            <span
              className="notion-pill"
              style={{
                backgroundColor: '#fef3c7',
                color: '#92400e',
                fontSize: '10.5px',
                padding: '1px 6px',
              }}
            >
              Live
            </span>
          </NavLink>

          <NavLink
            to="/notifications"
            onClick={() => setSidebarOpen(false)}
            className={({ isActive }) =>
              `notion-nav-item ${isActive ? 'active' : ''}`
            }
          >
            <Bell size={16} />
            <span className="flex-grow-1">Pusat Notifikasi</span>
            {unreadCount > 0 && (
              <span
                className="badge rounded-pill bg-danger text-white"
                style={{ fontSize: '10.5px', fontWeight: 600 }}
              >
                {unreadCount}
              </span>
            )}
          </NavLink>

          <div className="notion-nav-section-label mt-2">Akun Saya</div>

          <NavLink
            to="/profile"
            onClick={() => setSidebarOpen(false)}
            className={({ isActive }) =>
              `notion-nav-item ${isActive ? 'active' : ''}`
            }
          >
            <UserCircle size={16} />
            <span className="flex-grow-1">Profile &amp; Komisi Saya</span>
          </NavLink>

          <NavLink
            to="/guide"
            onClick={() => setSidebarOpen(false)}
            className={({ isActive }) =>
              `notion-nav-item ${isActive ? 'active' : ''}`
            }
          >
            <BookOpen size={16} />
            <span className="flex-grow-1">Buku Panduan &amp; SOP</span>
            <span
              className="notion-pill"
              style={{
                backgroundColor: '#dbeafe',
                color: '#1d4ed8',
                fontSize: '10.5px',
                padding: '1px 6px',
                fontWeight: 600,
              }}
            >
              Manual
            </span>
          </NavLink>

          {/* Area Khusus Admin (Hanya tampil untuk role === 'admin') */}
          {profile?.role === 'admin' && (
            <>
              <div className="notion-nav-section-label mt-3">Area Khusus Admin</div>

              <NavLink
                to="/admin"
                end
                onClick={() => setSidebarOpen(false)}
                className={({ isActive }) =>
                  `notion-nav-item ${isActive ? 'active' : ''}`
                }
              >
                <ShieldCheck size={16} />
                <span className="flex-grow-1">Command Center</span>
                <span
                  className="notion-pill"
                  style={{
                    backgroundColor: '#e0f2fe',
                    color: '#0369a1',
                    fontSize: '10px',
                    padding: '1px 6px',
                  }}
                >
                  Admin
                </span>
              </NavLink>

              <NavLink
                to="/admin/production"
                onClick={() => setSidebarOpen(false)}
                className={({ isActive }) =>
                  `notion-nav-item ${isActive ? 'active' : ''}`
                }
              >
                <Sliders size={16} />
                <span className="flex-grow-1">Produksi &amp; Bagi Hasil</span>
                <span
                  className="notion-pill"
                  style={{
                    backgroundColor: '#fef3c7',
                    color: '#92400e',
                    fontSize: '10px',
                    padding: '1px 6px',
                  }}
                >
                  Baru
                </span>
              </NavLink>

              <NavLink
                to="/admin/projects"
                onClick={() => setSidebarOpen(false)}
                className={({ isActive }) =>
                  `notion-nav-item ${isActive ? 'active' : ''}`
                }
              >
                <Briefcase size={16} />
                <span className="flex-grow-1">Manajemen Project</span>
              </NavLink>

              <NavLink
                to="/admin/users-lifecycle"
                onClick={() => setSidebarOpen(false)}
                className={({ isActive }) =>
                  `notion-nav-item ${isActive ? 'active' : ''}`
                }
              >
                <UserCheck size={16} />
                <span className="flex-grow-1">User Berkelanjutan</span>
              </NavLink>

              <NavLink
                to="/admin/audit"
                onClick={() => setSidebarOpen(false)}
                className={({ isActive }) =>
                  `notion-nav-item ${isActive ? 'active' : ''}`
                }
              >
                <CheckSquare size={16} />
                <span className="flex-grow-1">Audit Keaslian Kerja</span>
              </NavLink>
            </>
          )}

          {/* Activity Feed Trigger */}
          <div className="px-3 pt-3">
            <button
              type="button"
              className="btn btn-sm btn-light border w-100 d-flex align-items-center justify-content-between py-1 px-2"
              style={{ fontSize: '11.5px', color: '#555' }}
              onClick={() => setShowActivityFeed((prev) => !prev)}
            >
              <span className="d-flex align-items-center gap-1">
                <Bell size={12} />
                <span>Aktivitas Tim ({recentActivities.length})</span>
              </span>
              <span style={{ fontSize: '10px' }}>{showActivityFeed ? '▲' : '▼'}</span>
            </button>

            {showActivityFeed && (
              <div
                className="mt-2 p-2 bg-light rounded border"
                style={{ fontSize: '11px', maxHeight: '180px', overflowY: 'auto' }}
              >
                {recentActivities.map((act) => (
                  <div key={act.id} className="py-1 border-bottom last-border-0">
                    <div className="fw-semibold text-truncate">{act.title}</div>
                    <div className="text-muted text-truncate">{act.subtitle}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Connection Mode & Footer */}
        <div
          className="p-3 border-top"
          style={{ borderColor: 'var(--notion-border)' }}
        >
          <NavLink
            to="/guide"
            onClick={() => setSidebarOpen(false)}
            className="d-flex align-items-center justify-content-between gap-2 mb-2 px-2 py-1 rounded text-decoration-none shadow-sm"
            style={{
              backgroundColor: '#dcfce7',
              border: '1px solid #86efac',
              fontSize: '11.5px',
              color: '#166534',
              padding: '6px 10px',
              cursor: 'pointer',
            }}
            title="Buka Manual Book & Panduan Alur Kerja Lengkap"
          >
            <div className="d-flex align-items-center gap-2 text-truncate">
              <BookOpen size={14} className="text-success flex-shrink-0" />
              <span className="text-truncate fw-semibold">
                Panduan &amp; SOP Sistem
              </span>
            </div>
            <ArrowRight size={12} className="text-success opacity-75 flex-shrink-0" />
          </NavLink>

          <div className="d-flex align-items-center justify-content-between px-1 mb-2">
            <div className="text-truncate">
              <div
                className="fw-semibold text-truncate"
                style={{ fontSize: '12.5px' }}
              >
                @{displayUsername}
              </div>
              <div className="text-muted" style={{ fontSize: '11px' }}>
                Role:{' '}
                <span className="text-uppercase fw-semibold">
                  {profile?.role || 'user'}
                </span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="notion-nav-item text-danger m-0 w-100"
          >
            <LogOut size={15} />
            <span>Keluar (Logout)</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="notion-main">
        {/* Top Unified Sticky Navbar Bar (Desktop & Mobile) */}
        <header
          className="d-flex align-items-center justify-content-between px-3 px-lg-4 py-2 border-bottom bg-white sticky-top d-print-none"
          style={{ borderColor: 'var(--notion-border)', zIndex: 1015 }}
        >
          <div className="d-flex align-items-center gap-2 overflow-hidden">
            <button
              type="button"
              className="btn btn-sm p-1 d-lg-none"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu size={20} />
            </button>

            <span
              className="fw-semibold text-truncate"
              style={{ fontSize: '13.5px', color: 'var(--notion-text)' }}
            >
              {ROUTE_TITLES[location.pathname] || 'A-Tier Team CRM'}
            </span>
          </div>

          <div className="d-flex align-items-center gap-2">
            {/* Compact Navbar Stopwatch Pill (Always visible across all devices) */}
            <NavLink
              to="/attendance"
              className="d-inline-flex align-items-center gap-1 px-2 py-1 rounded text-decoration-none border"
              style={{
                backgroundColor: isWorking
                  ? '#f0fdf4'
                  : isPaused
                  ? '#fffbeb'
                  : '#fafaf9',
                borderColor: isWorking
                  ? '#bbf7d0'
                  : isPaused
                  ? '#fde68a'
                  : 'var(--notion-border)',
                color: isWorking
                  ? '#166534'
                  : isPaused
                  ? '#92400e'
                  : 'var(--notion-text)',
                fontSize: '11.5px',
                fontVariantNumeric: 'tabular-nums',
              }}
              title={isWorking ? 'Stopwatch berjalan aktif' : isPaused ? 'Stopwatch dijeda' : 'Buka Absen & Stopwatch'}
            >
              <Clock size={12} className={isWorking ? 'text-success' : ''} />
              <span className="fw-semibold">
                {formatDurationHMS(myTodayElapsedSeconds)}
              </span>
            </NavLink>

            {/* Upgraded Notification Bell Icon & Dropdown Popover */}
            <div className="position-relative" ref={bellRef}>
              <button
                type="button"
                className="btn btn-sm btn-light border position-relative d-inline-flex align-items-center justify-content-center"
                style={{ width: '34px', height: '34px', borderRadius: '8px' }}
                onClick={() => setBellOpen((prev) => !prev)}
                title="Notifikasi Tim & Pengingat"
              >
                <Bell size={16} />
                {unreadCount > 0 && (
                  <span
                    className="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger text-white"
                    style={{ fontSize: '10px', padding: '2px 5px' }}
                  >
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              {bellOpen && (
                <div
                  className="position-absolute end-0 mt-2 bg-white border shadow-lg rounded-3 overflow-hidden"
                  style={{
                    width: 'min(370px, calc(100vw - 24px))',
                    borderColor: 'var(--notion-border-strong)',
                    zIndex: 1080,
                  }}
                >
                  <div className="px-3 py-2 border-bottom bg-light d-flex align-items-center justify-content-between">
                    <div className="fw-bold d-flex align-items-center gap-2" style={{ fontSize: '13px' }}>
                      <Bell size={14} />
                      <span>Notifikasi ({unreadCount} baru)</span>
                    </div>

                    <div className="d-flex align-items-center gap-2">
                      {unreadCount > 0 && (
                        <button
                          type="button"
                          onClick={markAllAsRead}
                          className="btn btn-sm p-0 border-0 bg-transparent text-primary fw-medium d-inline-flex align-items-center gap-1"
                          style={{ fontSize: '11.5px' }}
                        >
                          <CheckCheck size={12} />
                          <span>Baca Semua</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Quick filter */}
                  <div className="d-flex gap-1 px-3 py-2 border-bottom bg-white">
                    <button
                      type="button"
                      className={`btn btn-sm py-0 px-2 ${
                        bellTab === 'all' ? 'btn-dark text-white' : 'btn-light text-secondary'
                      }`}
                      style={{ fontSize: '11px' }}
                      onClick={() => setBellTab('all')}
                    >
                      Semua ({notifications.length})
                    </button>
                    <button
                      type="button"
                      className={`btn btn-sm py-0 px-2 ${
                        bellTab === 'unread' ? 'btn-dark text-white' : 'btn-light text-secondary'
                      }`}
                      style={{ fontSize: '11px' }}
                      onClick={() => setBellTab('unread')}
                    >
                      Belum Dibaca ({unreadCount})
                    </button>
                  </div>

                  <div style={{ maxHeight: '320px', overflowY: 'auto' }}>
                    {(bellTab === 'unread'
                      ? notifications.filter((n) => !n.isRead)
                      : notifications
                    )
                      .slice(0, 8)
                      .map((n) => (
                        <button
                          key={n.id}
                          type="button"
                          onClick={() => {
                            markAsRead(n.id);
                            setBellOpen(false);
                            if (n.actionPath) navigate(n.actionPath);
                          }}
                          className="w-100 text-start border-0 border-bottom px-3 py-2 d-flex align-items-start gap-2"
                          style={{
                            backgroundColor: n.isRead ? '#ffffff' : '#f8fafc',
                          }}
                        >
                          <div className="pt-1 flex-shrink-0">
                            {n.severity === 'high' ? (
                              <AlertTriangle size={14} className="text-danger" />
                            ) : n.severity === 'medium' ? (
                              <CalendarClock size={14} className="text-warning" />
                            ) : n.severity === 'success' ? (
                              <CheckCircle2 size={14} className="text-success" />
                            ) : (
                              <Bell size={14} className="text-secondary" />
                            )}
                          </div>
                          <div className="flex-grow-1 overflow-hidden">
                            <div className="d-flex align-items-center justify-content-between gap-1">
                              <span
                                className="fw-semibold text-truncate"
                                style={{ fontSize: '12.5px', color: 'var(--notion-text)' }}
                              >
                                {n.title}
                              </span>
                              {!n.isRead && (
                                <span
                                  className="rounded-circle bg-primary flex-shrink-0"
                                  style={{ width: '7px', height: '7px' }}
                                />
                              )}
                            </div>
                            <div
                              className="text-muted text-truncate"
                              style={{ fontSize: '11.5px' }}
                            >
                              {n.message}
                            </div>
                          </div>
                        </button>
                      ))}

                    {(bellTab === 'unread'
                      ? notifications.filter((n) => !n.isRead)
                      : notifications
                    ).length === 0 && (
                      <div className="text-center py-4 text-muted" style={{ fontSize: '12px' }}>
                        Tidak ada notifikasi.
                      </div>
                    )}
                  </div>

                  <div className="p-2 bg-light border-top text-center">
                    <button
                      type="button"
                      className="btn btn-sm btn-link text-decoration-none fw-semibold w-100 py-1"
                      style={{ fontSize: '12px' }}
                      onClick={() => {
                        setBellOpen(false);
                        navigate('/notifications');
                      }}
                    >
                      Buka Halaman Pusat Notifikasi &rarr;
                    </button>
                  </div>
                </div>
              )}
            </div>

            <NavLink
              to="/profile"
              className="notion-workspace-badge text-decoration-none"
              title={`@${displayUsername}`}
            >
              {initials}
            </NavLink>
          </div>
        </header>

        {/* Page Container */}
        <div className="notion-page-container">
          {/* Top Deal Celebration Banner */}
          {showCelebration && latestDeal && (
            <div
              className="d-flex align-items-center justify-content-between p-2 px-3 rounded-2 mb-4 animate__animated animate__fadeIn"
              style={{
                backgroundColor: '#f0fdf4',
                border: '1px solid #bbf7d0',
                color: '#166534',
                fontSize: '12.5px',
              }}
            >
              <div className="d-flex align-items-center gap-2">
                <Sparkles size={15} className="text-success" />
                <span>
                  🎉 <strong>Closing Klien Terbaru:</strong> @{latestDeal.created_by_username || 'tim'} berhasil closing{' '}
                  <strong>{latestDeal.client_name}</strong> (
                  {formatCurrency(latestDeal.project_value, latestDeal.currency)})!
                </span>
              </div>

              <div className="d-flex align-items-center gap-2">
                <NavLink
                  to="/deals"
                  className="text-decoration-none fw-semibold d-inline-flex align-items-center gap-1 text-success"
                  style={{ fontSize: '11.5px' }}
                >
                  <span>Lihat Keuangan</span>
                  <ArrowRight size={12} />
                </NavLink>

                <button
                  type="button"
                  className="btn btn-sm p-0 text-muted border-0 bg-transparent ms-2"
                  onClick={() => setShowCelebration(false)}
                  title="Tutup banner"
                >
                  <X size={14} />
                </button>
              </div>
            </div>
          )}

          <Outlet />
        </div>
      </div>

      {/* Upgraded Live Floating Toast Notification Stack (Positioned Above Mobile Bottom Nav on Mobile) */}
      {activePopups.length > 0 && (
        <div
          className="position-fixed d-flex flex-column gap-2 d-print-none"
          style={{
            bottom: 'calc(74px + env(safe-area-inset-bottom, 0px))',
            right: '16px',
            width: 'min(360px, calc(100vw - 32px))',
            zIndex: 1090,
          }}
        >
          {activePopups.map((popup) => {
            const accentColor =
              popup.severity === 'high'
                ? '#dc2626'
                : popup.severity === 'medium'
                ? '#d97706'
                : popup.severity === 'success'
                ? '#16a34a'
                : '#2383e2';

            return (
              <div
                key={popup.id}
                className="bg-white rounded-3 shadow-lg border p-3"
                style={{
                  borderColor: 'var(--notion-border-strong)',
                  borderLeft: `4px solid ${accentColor}`,
                }}
              >
                <div className="d-flex align-items-start justify-content-between gap-2">
                  <div className="d-flex align-items-center gap-2">
                    <span
                      className="badge text-white"
                      style={{
                        backgroundColor: accentColor,
                        fontSize: '10px',
                      }}
                    >
                      {popup.badgeText || 'Info'}
                    </span>
                    <span
                      className="fw-bold"
                      style={{ fontSize: '13px', color: 'var(--notion-text)' }}
                    >
                      {popup.title}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="btn btn-sm p-0 border-0 bg-transparent text-muted"
                    onClick={() => closePopup(popup.id)}
                  >
                    <X size={14} />
                  </button>
                </div>

                <div
                  className="text-secondary mt-1 mb-2"
                  style={{ fontSize: '12px', lineHeight: 1.4 }}
                >
                  {popup.message}
                </div>

                <div className="d-flex align-items-center justify-content-end gap-2">
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-secondary py-0 px-2"
                    style={{ fontSize: '11px' }}
                    onClick={() => {
                      markAsRead(popup.id);
                      closePopup(popup.id);
                    }}
                  >
                    Tandai Dibaca
                  </button>
                  {popup.actionPath && (
                    <button
                      type="button"
                      className="btn btn-sm btn-dark py-0 px-2 d-inline-flex align-items-center gap-1"
                      style={{ fontSize: '11px' }}
                      onClick={() => {
                        markAsRead(popup.id);
                        closePopup(popup.id);
                        navigate(popup.actionPath);
                      }}
                    >
                      <span>{popup.actionLabel || 'Buka'}</span>
                      <ArrowRight size={11} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Mobile Bottom Navigation Bar (Thumb Zone) - Only visible on screens < lg */}
      <nav className="notion-mobile-bottom-nav d-lg-none d-print-none">
        <NavLink
          to="/attendance"
          onClick={() => setSidebarOpen(false)}
          className={({ isActive }) =>
            `notion-mobile-nav-item ${isActive ? 'active' : ''}`
          }
        >
          <div className="mobile-nav-icon-wrapper">
            <Clock size={18} />
            {isWorking && <span className="mobile-nav-pulse-dot" />}
          </div>
          <span>Absen</span>
        </NavLink>

        <NavLink
          to="/prospects"
          onClick={() => setSidebarOpen(false)}
          className={({ isActive }) =>
            `notion-mobile-nav-item ${isActive ? 'active' : ''}`
          }
        >
          <div className="mobile-nav-icon-wrapper">
            <Users size={18} />
            {prospects.length > 0 && (
              <span className="mobile-nav-badge" style={{ backgroundColor: '#475569' }}>
                {prospects.length > 99 ? '99+' : prospects.length}
              </span>
            )}
          </div>
          <span>Prospek</span>
        </NavLink>

        <NavLink
          to="/deals"
          onClick={() => setSidebarOpen(false)}
          className={({ isActive }) =>
            `notion-mobile-nav-item ${isActive ? 'active' : ''}`
          }
        >
          <div className="mobile-nav-icon-wrapper">
            <Wallet size={18} />
            {dealClients.length > 0 && (
              <span className="mobile-nav-badge" style={{ backgroundColor: '#16a34a' }}>
                {dealClients.length}
              </span>
            )}
          </div>
          <span>Deals</span>
        </NavLink>

        <NavLink
          to="/notifications"
          onClick={() => setSidebarOpen(false)}
          className={({ isActive }) =>
            `notion-mobile-nav-item ${isActive ? 'active' : ''}`
          }
        >
          <div className="mobile-nav-icon-wrapper">
            <Bell size={18} />
            {unreadCount > 0 && (
              <span className="mobile-nav-badge bg-danger">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </div>
          <span>Notifikasi</span>
        </NavLink>

        <button
          type="button"
          onClick={() => setSidebarOpen((prev) => !prev)}
          className={`notion-mobile-nav-item ${sidebarOpen ? 'active' : ''}`}
          aria-label="Buka Menu Navigasi"
        >
          <div className="mobile-nav-icon-wrapper">
            <Menu size={18} />
          </div>
          <span>Menu</span>
        </button>
      </nav>
    </div>
  );
}