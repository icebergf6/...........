import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  CheckCircle2,
  AlertTriangle,
  CalendarClock,
  RefreshCw,
  Wallet,
  Clock,
  CheckCheck,
  Search,
  Trash2,
  ArrowRight,
  Sparkles,
  BellRing,
  Briefcase,
  ShieldCheck,
  Monitor,
} from 'lucide-react';
import { useNotifications } from '../context/NotificationsContext';
import { requestDesktopNotificationPermission } from '../lib/supabase';

const CATEGORY_TABS = [
  { id: 'ALL', label: 'Semua Notifikasi', icon: Bell },
  { id: 'UNREAD', label: 'Belum Dibaca', icon: BellRing },
  { id: 'followup', label: 'Follow-Up Klien', icon: CalendarClock },
  { id: 'project', label: 'Penugasan PIC Proyek', icon: Briefcase },
  { id: 'audit', label: 'Verifikasi Audit Admin', icon: ShieldCheck },
  { id: 'renewal', label: 'Domain & Hosting', icon: RefreshCw },
  { id: 'deal', label: 'Deal & Komisi', icon: Wallet },
  { id: 'attendance', label: 'Stopwatch & KPI', icon: Clock },
];

export default function NotificationsPage() {
  const {
    notifications,
    unreadCount,
    popupEnabled,
    markAsRead,
    markAllAsRead,
    dismissNotification,
    togglePopupEnabled,
    triggerTestPopup,
  } = useNotifications();
  const navigate = useNavigate();

  const [categoryTab, setCategoryTab] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const summaryStats = useMemo(() => {
    const urgent = notifications.filter(
      (n) => n.severity === 'high' || n.severity === 'medium'
    ).length;
    const achievements = notifications.filter(
      (n) => n.severity === 'success'
    ).length;
    return {
      total: notifications.length,
      unread: unreadCount,
      urgent,
      achievements,
    };
  }, [notifications, unreadCount]);

  const filteredList = useMemo(() => {
    return notifications.filter((n) => {
      if (categoryTab === 'UNREAD' && n.isRead) return false;
      if (
        categoryTab !== 'ALL' &&
        categoryTab !== 'UNREAD' &&
        n.category !== categoryTab
      ) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          (n.title || '').toLowerCase().includes(q) ||
          (n.message || '').toLowerCase().includes(q) ||
          (n.badgeText || '').toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [notifications, categoryTab, searchQuery]);

  function getSeverityStyle(notifOrSeverity) {
    const severity =
      typeof notifOrSeverity === 'object'
        ? notifOrSeverity.severity
        : notifOrSeverity;
    const category =
      typeof notifOrSeverity === 'object' ? notifOrSeverity.category : '';

    if (category === 'audit') {
      return {
        bg: severity === 'success' ? '#f0fdf4' : '#fef2f2',
        border: severity === 'success' ? '#bbf7d0' : '#fecaca',
        badge:
          severity === 'success' ? 'bg-success text-white' : 'bg-danger text-white',
        icon: ShieldCheck,
        iconColor: severity === 'success' ? '#16a34a' : '#dc2626',
      };
    }

    if (category === 'project') {
      return {
        bg: '#eff6ff',
        border: '#bfdbfe',
        badge: 'bg-primary text-white',
        icon: Briefcase,
        iconColor: '#2563eb',
      };
    }

    if (severity === 'high') {
      return {
        bg: '#fef2f2',
        border: '#fecaca',
        badge: 'bg-danger text-white',
        icon: AlertTriangle,
        iconColor: '#dc2626',
      };
    }
    if (severity === 'medium') {
      return {
        bg: '#fffbeb',
        border: '#fde68a',
        badge: 'bg-warning text-dark',
        icon: CalendarClock,
        iconColor: '#d97706',
      };
    }
    if (severity === 'success') {
      return {
        bg: '#f0fdf4',
        border: '#bbf7d0',
        badge: 'bg-success text-white',
        icon: Sparkles,
        iconColor: '#16a34a',
      };
    }
    return {
      bg: '#f8fafc',
      border: '#e2e8f0',
      badge: 'bg-secondary text-white',
      icon: Bell,
      iconColor: '#475569',
    };
  }

  function handleOpenAction(notif) {
    markAsRead(notif.id);
    if (notif.actionPath) {
      navigate(notif.actionPath);
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-4">
        <div>
          <div className="d-flex align-items-center gap-2 mb-1">
            <h1 className="notion-page-title mb-0">Pusat Notifikasi Tim</h1>
            {unreadCount > 0 && (
              <span className="badge rounded-pill bg-danger text-white px-2 py-1">
                {unreadCount} Belum Dibaca
              </span>
            )}
          </div>
          <p className="notion-page-subtitle">
            Pantau pengingat follow-up klien, jadwal expired domain/hosting,
            closing deal, pencairan komisi, dan target stopwatch harian secara
            real-time.
          </p>
        </div>

        <div className="d-flex flex-wrap align-items-center gap-2">
          <div className="form-check form-switch d-flex align-items-center gap-2 bg-light border rounded px-3 py-1 m-0">
            <input
              className="form-check-input m-0"
              type="checkbox"
              id="popupNotifSwitch"
              checked={popupEnabled}
              onChange={(e) => togglePopupEnabled(e.target.checked)}
            />
            <label
              className="form-check-label fw-medium"
              htmlFor="popupNotifSwitch"
              style={{ fontSize: '12px' }}
            >
              Popup Notif Live
            </label>
          </div>

          <button
            type="button"
            className="btn-notion-outline"
            onClick={triggerTestPopup}
            title="Uji tampilan popup toast notifikasi di pojok layar"
          >
            <BellRing size={14} />
            <span>Uji Popup</span>
          </button>

          <button
            type="button"
            className="btn-notion-primary"
            onClick={markAllAsRead}
            disabled={unreadCount === 0}
          >
            <CheckCheck size={14} />
            <span>Tandai Semua Dibaca</span>
          </button>
        </div>
      </div>

      {/* 4 Notification Summary Cards */}
      <div className="row g-3 mb-4">
        <div className="col-6 col-lg-3">
          <div className="notion-card">
            <div className="notion-stat-label">
              <Bell size={14} />
              <span>Total Notifikasi</span>
            </div>
            <div className="notion-stat-value">{summaryStats.total}</div>
            <div className="text-muted mt-1" style={{ fontSize: '11.5px' }}>
              Sinkron otomatis semua modul CRM
            </div>
          </div>
        </div>

        <div className="col-6 col-lg-3">
          <div
            className="notion-card"
            style={{
              backgroundColor: summaryStats.unread > 0 ? '#fef2f2' : '#ffffff',
              borderColor:
                summaryStats.unread > 0 ? '#fecaca' : 'var(--notion-border)',
            }}
          >
            <div
              className="notion-stat-label"
              style={{ color: summaryStats.unread > 0 ? '#dc2626' : undefined }}
            >
              <BellRing size={14} />
              <span>Belum Dibaca</span>
            </div>
            <div
              className="notion-stat-value"
              style={{ color: summaryStats.unread > 0 ? '#dc2626' : undefined }}
            >
              {summaryStats.unread}
            </div>
            <div className="text-muted mt-1" style={{ fontSize: '11.5px' }}>
              Perlu ditinjau / ditindaklanjuti
            </div>
          </div>
        </div>

        <div className="col-6 col-lg-3">
          <div className="notion-card">
            <div className="notion-stat-label">
              <AlertTriangle size={14} className="text-warning" />
              <span>Follow-Up &amp; Jatuh Tempo</span>
            </div>
            <div className="notion-stat-value">{summaryStats.urgent}</div>
            <div className="text-muted mt-1" style={{ fontSize: '11.5px' }}>
              Termasuk klien &amp; domain expired
            </div>
          </div>
        </div>

        <div className="col-6 col-lg-3">
          <div className="notion-card">
            <div className="notion-stat-label">
              <CheckCircle2 size={14} className="text-success" />
              <span>Closing Deal &amp; Target</span>
            </div>
            <div className="notion-stat-value text-success">
              {summaryStats.achievements}
            </div>
            <div className="text-muted mt-1" style={{ fontSize: '11.5px' }}>
              Deal baru, komisi &amp; target KPI
            </div>
          </div>
        </div>
      </div>

      {/* Category Filter Tabs & Search */}
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
        <div className="d-flex flex-wrap gap-1">
          {CATEGORY_TABS.map((tab) => {
            const IconComp = tab.icon;
            const active = categoryTab === tab.id;
            const count =
              tab.id === 'ALL'
                ? notifications.length
                : tab.id === 'UNREAD'
                ? unreadCount
                : notifications.filter((n) => n.category === tab.id).length;

            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setCategoryTab(tab.id)}
                className={`btn btn-sm d-inline-flex align-items-center gap-1 px-3 py-1 ${
                  active ? 'btn-dark text-white' : 'btn-outline-secondary bg-white'
                }`}
                style={{ fontSize: '12.5px', borderRadius: '6px' }}
              >
                <IconComp size={13} />
                <span>{tab.label}</span>
                <span
                  className={`badge rounded-pill ms-1 ${
                    active ? 'bg-light text-dark' : 'bg-light text-secondary'
                  }`}
                  style={{ fontSize: '10px' }}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        <div
          className="position-relative"
          style={{ minWidth: '220px', maxWidth: '300px', flex: '1 1 220px' }}
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
            placeholder="Cari notifikasi klien, deal..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Notifications List */}
      <div className="d-flex flex-column gap-2">
        {filteredList.length === 0 ? (
          <div className="notion-card text-center py-5 text-muted">
            <Bell size={28} className="mb-2 opacity-50" />
            <div className="fw-semibold">Tidak ada notifikasi pada kategori ini.</div>
            <div style={{ fontSize: '12.5px' }}>
              Semua tugas follow-up, domain, dan absensi dalam kondisi aman terkendali!
            </div>
          </div>
        ) : (
          filteredList.map((notif) => {
            const sty = getSeverityStyle(notif);
            const SevIcon = sty.icon;

            return (
              <div
                key={notif.id}
                className="notion-card p-3 d-flex flex-wrap align-items-start justify-content-between gap-3"
                style={{
                  backgroundColor: notif.isRead ? '#ffffff' : sty.bg,
                  borderColor: notif.isRead ? 'var(--notion-border)' : sty.border,
                  opacity: notif.isRead ? 0.85 : 1,
                }}
              >
                <div className="d-flex align-items-start gap-3 flex-grow-1">
                  <div
                    className="p-2 rounded-2 border bg-white d-flex align-items-center justify-content-center flex-shrink-0"
                    style={{ color: sty.iconColor }}
                  >
                    <SevIcon size={18} />
                  </div>

                  <div>
                    <div className="d-flex flex-wrap align-items-center gap-2 mb-1">
                      {!notif.isRead && (
                        <span
                          className="rounded-circle bg-primary d-inline-block"
                          style={{ width: '8px', height: '8px' }}
                          title="Belum dibaca"
                        />
                      )}
                      <span className="fw-bold" style={{ fontSize: '14px' }}>
                        {notif.title}
                      </span>
                      <span
                        className={`badge rounded-pill ${sty.badge}`}
                        style={{ fontSize: '10.5px' }}
                      >
                        {notif.badgeText}
                      </span>
                    </div>
                    <div
                      className="text-secondary"
                      style={{ fontSize: '12.5px' }}
                    >
                      {notif.message}
                    </div>
                  </div>
                </div>

                <div className="d-flex align-items-center gap-2 ms-auto">
                  {notif.actionPath && (
                    <button
                      type="button"
                      className="btn-notion-outline py-1 px-2"
                      style={{ fontSize: '12px' }}
                      onClick={() => handleOpenAction(notif)}
                    >
                      <span>{notif.actionLabel || 'Buka'}</span>
                      <ArrowRight size={12} />
                    </button>
                  )}

                  {!notif.isRead && (
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-success py-1 px-2"
                      style={{ fontSize: '11.5px' }}
                      onClick={() => markAsRead(notif.id)}
                      title="Tandai sudah dibaca"
                    >
                      <CheckCircle2 size={13} />
                    </button>
                  )}

                  <button
                    type="button"
                    className="btn btn-sm btn-outline-secondary py-1 px-2 text-muted"
                    style={{ fontSize: '11.5px' }}
                    onClick={() => dismissNotification(notif.id)}
                    title="Hapus notifikasi ini dari daftar"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
