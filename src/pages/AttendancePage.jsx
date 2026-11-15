import React, { useEffect, useMemo, useState } from 'react';
import {
  Play,
  Pause,
  Square,
  Clock,
  Calendar,
  CheckCircle2,
  FileText,
  Save,
  Target,
  TrendingUp,
  Users,
  Sparkles,
  Download,
  Award,
  MessageSquare,
  Timer,
  RotateCcw,
  SkipForward,
  Coffee,
  Flame,
  Volume2,
  VolumeX,
  Sliders,
  Bell,
  Hourglass,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useAttendance } from '../context/AttendanceContext';
import { useProspects } from '../context/ProspectsContext';
import {
  formatDurationHMS,
  formatDurationHuman,
  getTodayDateString,
  getOffsetDateString,
  toLocalDateString,
  getStudioSettings,
  WORK_FOCUS_TAGS,
  exportToCSV,
} from '../lib/supabase';

export default function AttendancePage() {
  const { user, profile } = useAuth();
  const {
    myTodayLog,
    myTodayElapsedSeconds,
    myHistoryLogs,
    nowTick,
    startWork,
    pauseWork,
    resumeWork,
    finishWork,
    updateTodayNotes,
    updateTodayFocusTag,
    calculateLiveSeconds,
    // Multi-Mode Timer States & Functions
    timerMode,
    setTimerMode,
    countdownDuration,
    countdownRemaining,
    isCountdownRunning,
    pomodoroStage,
    pomodoroCycles,
    chimeEnabled,
    toggleChimeEnabled,
    testChimeSound,
    startCountdown,
    pauseCountdown,
    resumeCountdown,
    resetCountdown,
    skipPomodoroStage,
  } = useAttendance();
  const { prospects } = useProspects();

  const [studioSettings, setStudioSettings] = useState(() =>
    getStudioSettings()
  );
  const [notes, setNotes] = useState('');
  const [focusTag, setFocusTag] = useState('Hunting Prospek');
  const [savedToast, setSavedToast] = useState(false);
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [customMinutesInput, setCustomMinutesInput] = useState('30');

  // Sync studio settings if Admin updates targets
  useEffect(() => {
    function handleSettingsUpdated(e) {
      if (e.detail) {
        setStudioSettings(e.detail);
      } else {
        setStudioSettings(getStudioSettings());
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

  useEffect(() => {
    if (myTodayLog) {
      setNotes(myTodayLog.notes || '');
      if (myTodayLog.focus_tag) {
        setFocusTag(myTodayLog.focus_tag);
      }
    }
  }, [myTodayLog?.id, myTodayLog?.focus_tag]);

  const status = myTodayLog?.status || 'idle';
  const todayStr = getTodayDateString();
  const targetHours =
    Number(profile?.targetDailyHours) || Number(studioSettings.dailyTargetHours) || 3;
  const targetSeconds = targetHours * 3600;
  const targetProspects =
    Number(profile?.targetDailyProspects) ||
    Number(studioSettings.dailyTargetProspects) ||
    10;

  const rawProgressPct = Math.round(
    (myTodayElapsedSeconds / Math.max(1, targetSeconds)) * 100
  );
  const hoursProgressPct = Math.min(100, rawProgressPct);
  const isDailyHoursTargetMet = myTodayElapsedSeconds >= targetSeconds;
  const overworkSeconds = Math.max(0, myTodayElapsedSeconds - targetSeconds);
  const isOverworking = overworkSeconds > 0;

  // Compute Real-time Daily KPIs from ProspectsContext for the logged-in user today
  const myTodayKpi = useMemo(() => {
    const uname = (profile?.username || '').toLowerCase();
    const uid = user?.id;

    const myProspects = (prospects || []).filter((p) => {
      const matchId = uid && p.user_id === uid;
      const matchName =
        uname && (p.created_by_username || '').toLowerCase() === uname;
      return matchId || matchName;
    });

    const todayNewProspects = myProspects.filter(
      (p) => toLocalDateString(p.created_at) === todayStr
    );

    const todayDeals = myProspects.filter(
      (p) =>
        p.status === 'Deal' &&
        (toLocalDateString(p.deal_date) === todayStr ||
          toLocalDateString(p.created_at) === todayStr)
    );

    // Count touchpoint notes logged by this user today across all prospects
    let todayTouchpointsCount = 0;
    (prospects || []).forEach((p) => {
      if (Array.isArray(p.follow_up_notes)) {
        p.follow_up_notes.forEach((tp) => {
          const tpAuthor = (tp.author || '').toLowerCase();
          if (tp.date === todayStr && Boolean(uname) && tpAuthor === uname) {
            todayTouchpointsCount += 1;
          }
        });
      }
    });

    const prospectTargetPct = Math.min(
      100,
      Math.round(
        (todayNewProspects.length / Math.max(1, targetProspects)) * 100
      )
    );

    return {
      newProspectsCount: todayNewProspects.length,
      newProspectNames: todayNewProspects
        .slice(0, 4)
        .map((p) => p.client_name),
      todayDealsCount: todayDeals.length,
      todayTouchpointsCount,
      prospectTargetPct,
      isProspectTargetMet: todayNewProspects.length >= targetProspects,
    };
  }, [prospects, user?.id, profile?.username, todayStr, targetProspects]);

  // Compute Weekly & Monthly Personal Work Stats
  const personalStats = useMemo(() => {
    const sevenDaysAgoStr = getOffsetDateString(-6); // today + past 6 days = 7 days
    const currentMonthPrefix = todayStr.slice(0, 7); // YYYY-MM

    let weekSeconds = 0;
    let monthSeconds = 0;
    let monthActiveDays = 0;
    let targetMetDaysCount = 0;

    myHistoryLogs.forEach((log) => {
      const sec = calculateLiveSeconds(log, nowTick);
      if (log.work_date >= sevenDaysAgoStr && log.work_date <= todayStr) {
        weekSeconds += sec;
      }
      if ((log.work_date || '').startsWith(currentMonthPrefix)) {
        monthSeconds += sec;
        if (sec > 0) monthActiveDays += 1;
      }
      if (sec >= targetSeconds) {
        targetMetDaysCount += 1;
      }
    });

    const avgDailyMonthSec =
      monthActiveDays > 0 ? Math.round(monthSeconds / monthActiveDays) : 0;

    return {
      weekSeconds,
      monthSeconds,
      monthActiveDays,
      avgDailyMonthSec,
      targetMetDaysCount,
    };
  }, [myHistoryLogs, nowTick, todayStr, targetSeconds, calculateLiveSeconds]);

  function buildAutoSummaryText() {
    const parts = [
      `Fokus: ${focusTag}`,
      `Durasi: ${formatDurationHuman(myTodayElapsedSeconds)}`,
      `Input ${myTodayKpi.newProspectsCount} prospek baru`,
    ];
    if (myTodayKpi.newProspectNames.length > 0) {
      parts[2] += ` (${myTodayKpi.newProspectNames.join(', ')}${
        myTodayKpi.newProspectsCount > myTodayKpi.newProspectNames.length
          ? ', dll'
          : ''
      })`;
    }
    if (myTodayKpi.todayTouchpointsCount > 0) {
      parts.push(`Follow-up ${myTodayKpi.todayTouchpointsCount} aktivitas`);
    }
    if (myTodayKpi.todayDealsCount > 0) {
      parts.push(`Closing ${myTodayKpi.todayDealsCount} klien Deal`);
    }
    return parts.join(' | ');
  }

  async function handleAutoFillNotes() {
    const summary = buildAutoSummaryText();
    setNotes(summary);
    if (myTodayLog) {
      await updateTodayNotes(summary, focusTag);
      setSavedToast(true);
      setTimeout(() => setSavedToast(false), 2200);
    }
  }

  async function handleSelectFocusTag(tagValue) {
    setFocusTag(tagValue);
    if (myTodayLog) {
      await updateTodayFocusTag(tagValue);
    }
  }

  async function handleSaveNotes(e) {
    e.preventDefault();
    if (!myTodayLog) return;
    await updateTodayNotes(notes, focusTag);
    setSavedToast(true);
    setTimeout(() => setSavedToast(false), 2000);
  }

  async function handleFinishWork() {
    const finalNote = notes.trim() ? notes : buildAutoSummaryText();
    if (!notes.trim()) {
      setNotes(finalNote);
    }
    await finishWork(finalNote);
  }

  function handleExportMyAttendanceCSV() {
    exportToCSV(
      `riwayat-kerja-${profile?.username || 'saya'}`,
      myHistoryLogs,
      [
        { header: 'Tanggal', key: 'work_date' },
        { header: 'Fokus Aktivitas', key: 'focus_tag' },
        {
          header: 'Jam Mulai',
          transform: (r) =>
            r.check_in_at
              ? new Date(r.check_in_at).toLocaleTimeString('id-ID', {
                  hour: '2-digit',
                  minute: '2-digit',
                })
              : '-',
        },
        {
          header: 'Jam Selesai',
          transform: (r) =>
            r.check_out_at
              ? new Date(r.check_out_at).toLocaleTimeString('id-ID', {
                  hour: '2-digit',
                  minute: '2-digit',
                })
              : '-',
        },
        {
          header: 'Total Durasi (HMS)',
          transform: (r) => formatDurationHMS(calculateLiveSeconds(r, nowTick)),
        },
        {
          header: `Target Harian (${targetHours} Jam)`,
          transform: (r) => {
            const sec = calculateLiveSeconds(r, nowTick);
            return sec >= targetSeconds
              ? 'Tercapai'
              : `${Math.round((sec / targetSeconds) * 100)}%`;
          },
        },
        { header: 'Status', key: 'status' },
        { header: 'Catatan Kerja', key: 'notes' },
      ]
    );
  }

  function renderStatusBadge(st) {
    if (st === 'running') {
      return (
        <span className="notion-pill status-deal">
          ● Sedang Bekerja (Stopwatch Aktif)
        </span>
      );
    }
    if (st === 'paused') {
      return (
        <span className="notion-pill status-followup">⏸ Istirahat / Jeda</span>
      );
    }
    if (st === 'completed') {
      return (
        <span className="notion-pill status-dihubungi">
          ✓ Selesai Kerja Hari Ini
        </span>
      );
    }
    return <span className="notion-pill status-baru">Belum Absen Hari Ini</span>;
  }

  return (
    <div>
      {/* Header */}
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-4">
        <div>
          <h1 className="notion-page-title">Absen &amp; Stopwatch Kerja</h1>
          <p className="notion-page-subtitle">
            Nyalakan stopwatch saat mulai bekerja. Target harian Anda saat ini:{' '}
            <strong>Minimal {targetHours} Jam Kerja</strong> &amp;{' '}
            <strong>{targetProspects} Prospek Baru</strong> (diatur oleh Admin). Anda bebas lembur (overwork).
          </p>
        </div>

        <div className="d-flex flex-wrap align-items-center gap-2">
          <span className="text-muted" style={{ fontSize: '12.5px' }}>
            User: <strong>@{profile?.username || 'user'}</strong>
          </span>
          {renderStatusBadge(status)}
        </div>
      </div>

      {/* 4 Personal Productivity Summary Cards */}
      <div className="row g-3 mb-4">
        <div className="col-6 col-lg-3">
          <div
            className="notion-card"
            style={{
              backgroundColor: isDailyHoursTargetMet ? '#f0fdf4' : '#ffffff',
              borderColor: isDailyHoursTargetMet
                ? '#bbf7d0'
                : 'var(--notion-border)',
            }}
          >
            <div
              className="notion-stat-label d-flex align-items-center justify-content-between"
              style={{ color: isDailyHoursTargetMet ? '#166534' : undefined }}
            >
              <div className="d-flex align-items-center gap-1">
                <Target size={14} />
                <span>Progress Jam Hari Ini</span>
              </div>
              {isOverworking && (
                <span
                  className="badge bg-success text-white rounded-pill"
                  style={{ fontSize: '10px' }}
                >
                  🚀 Overwork
                </span>
              )}
            </div>
            <div
              className="notion-stat-value d-flex align-items-baseline gap-1"
              style={{
                fontSize: '20px',
                color: isDailyHoursTargetMet ? '#166534' : undefined,
              }}
            >
              <span>{rawProgressPct}%</span>
              <span className="text-muted fw-normal" style={{ fontSize: '13px' }}>
                / {targetHours}j min
              </span>
            </div>

            {isOverworking ? (
              <div className="text-success fw-semibold mt-1" style={{ fontSize: '11px' }}>
                ⚡ Lembur: +{formatDurationHuman(overworkSeconds)}
              </div>
            ) : (
              <div className="text-muted mt-1" style={{ fontSize: '11px' }}>
                Sisa: {formatDurationHuman(Math.max(0, targetSeconds - myTodayElapsedSeconds))}
              </div>
            )}

            <div className="progress mt-2" style={{ height: '6px' }}>
              <div
                className={`progress-bar ${
                  isOverworking
                    ? 'bg-success'
                    : isDailyHoursTargetMet
                    ? 'bg-success'
                    : 'bg-dark'
                }`}
                style={{ width: `${hoursProgressPct}%` }}
              />
            </div>
          </div>
        </div>

        <div className="col-6 col-lg-3">
          <div className="notion-card">
            <div className="notion-stat-label">
              <Clock size={14} className="text-primary" />
              <span>Minggu Ini (7 Hari)</span>
            </div>
            <div className="notion-stat-value" style={{ fontSize: '20px' }}>
              {formatDurationHuman(personalStats.weekSeconds)}
            </div>
            <div className="text-muted mt-1" style={{ fontSize: '11.5px' }}>
              Akumulasi jam aktif 7 hari terakhir
            </div>
          </div>
        </div>

        <div className="col-6 col-lg-3">
          <div className="notion-card">
            <div className="notion-stat-label">
              <TrendingUp size={14} className="text-success" />
              <span>Total Bulan Ini</span>
            </div>
            <div className="notion-stat-value" style={{ fontSize: '20px' }}>
              {formatDurationHuman(personalStats.monthSeconds)}
            </div>
            <div className="text-muted mt-1" style={{ fontSize: '11.5px' }}>
              Rata-rata {formatDurationHuman(personalStats.avgDailyMonthSec)}{' '}
              / hari aktif
            </div>
          </div>
        </div>

        <div className="col-6 col-lg-3">
          <div className="notion-card">
            <div className="notion-stat-label">
              <Award size={14} className="text-warning" />
              <span>Hari Capai Target</span>
            </div>
            <div className="notion-stat-value" style={{ fontSize: '20px' }}>
              {personalStats.targetMetDaysCount}{' '}
              <span className="text-muted fw-normal" style={{ fontSize: '13px' }}>
                / {myHistoryLogs.length} Hari
              </span>
            </div>
            <div className="text-muted mt-1" style={{ fontSize: '11.5px' }}>
              Minimal {targetHours} jam kerja / hari
            </div>
          </div>
        </div>
      </div>

      {/* Main Multi-Mode Stopwatch & Timer Card + Right KPI & Work Log Panel */}
      <div className="row g-4 mb-4">
        <div className="col-lg-7">
          <div
            className="notion-card h-100 d-flex flex-column justify-content-between"
            style={{
              backgroundColor:
                status === 'running' || isCountdownRunning
                  ? '#f4fbf7'
                  : '#ffffff',
              borderColor:
                status === 'running' || isCountdownRunning
                  ? '#bbf7d0'
                  : 'var(--notion-border)',
            }}
          >
            <div>
              {/* Header: Date + Audio Chime Toggle */}
              <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
                <div
                  className="d-flex align-items-center gap-2 text-muted"
                  style={{ fontSize: '13px' }}
                >
                  <Calendar size={15} />
                  <span>
                    Hari Ini:{' '}
                    <strong>
                      {new Date().toLocaleDateString('id-ID', {
                        weekday: 'long',
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                      })}
                    </strong>
                  </span>
                  {myTodayLog?.check_in_at && (
                    <span className="ms-2">
                      (Mulai:{' '}
                      <strong>
                        {new Date(myTodayLog.check_in_at).toLocaleTimeString(
                          'id-ID',
                          { hour: '2-digit', minute: '2-digit' }
                        )}
                      </strong>
                      )
                    </span>
                  )}
                </div>

                {/* Audio Chime Bell Controller */}
                <div className="d-flex align-items-center gap-1">
                  <button
                    type="button"
                    onClick={toggleChimeEnabled}
                    className={`btn btn-sm py-1 px-2 d-inline-flex align-items-center gap-1 ${
                      chimeEnabled
                        ? 'btn-light border text-success'
                        : 'btn-light border text-muted'
                    }`}
                    style={{ fontSize: '11.5px', borderRadius: '6px' }}
                    title={
                      chimeEnabled
                        ? 'Suara lonceng (Audio Chime) aktif saat timer habis'
                        : 'Suara lonceng dinonaktifkan'
                    }
                  >
                    {chimeEnabled ? <Volume2 size={13} /> : <VolumeX size={13} />}
                    <span>{chimeEnabled ? 'Suara Aktif' : 'Senyap'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => testChimeSound('success')}
                    className="btn btn-sm btn-link py-1 px-1 text-muted text-decoration-none"
                    style={{ fontSize: '11px' }}
                    title="Uji dengar nada lonceng selesai"
                  >
                    Uji Nada
                  </button>
                </div>
              </div>

              {/* Mode Switcher Tabs */}
              <div
                className="d-flex flex-wrap p-1 rounded-2 mb-3"
                style={{
                  backgroundColor: '#f1f1ef',
                  border: '1px solid var(--notion-border)',
                  gap: '4px',
                }}
              >
                <button
                  type="button"
                  onClick={() => setTimerMode('stopwatch')}
                  className={`btn btn-sm flex-fill py-1 px-2 border-0 fw-semibold d-inline-flex align-items-center justify-content-center gap-1 ${
                    timerMode === 'stopwatch'
                      ? 'bg-white shadow-sm text-dark'
                      : 'text-muted bg-transparent'
                  }`}
                  style={{ fontSize: '12px', borderRadius: '5px' }}
                >
                  <Clock size={13} />
                  <span>Stopwatch Standar</span>
                </button>

                <button
                  type="button"
                  onClick={() => setTimerMode('pomodoro')}
                  className={`btn btn-sm flex-fill py-1 px-2 border-0 fw-semibold d-inline-flex align-items-center justify-content-center gap-1 ${
                    timerMode === 'pomodoro'
                      ? 'bg-white shadow-sm text-danger'
                      : 'text-muted bg-transparent'
                  }`}
                  style={{ fontSize: '12px', borderRadius: '5px' }}
                >
                  <span>🍅</span>
                  <span>Pomodoro (25m/5m)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setTimerMode('countdown')}
                  className={`btn btn-sm flex-fill py-1 px-2 border-0 fw-semibold d-inline-flex align-items-center justify-content-center gap-1 ${
                    timerMode === 'countdown'
                      ? 'bg-white shadow-sm text-primary'
                      : 'text-muted bg-transparent'
                  }`}
                  style={{ fontSize: '12px', borderRadius: '5px' }}
                >
                  <Hourglass size={13} />
                  <span>Countdown Kustom</span>
                </button>

                <button
                  type="button"
                  onClick={() => setTimerMode('target')}
                  className={`btn btn-sm flex-fill py-1 px-2 border-0 fw-semibold d-inline-flex align-items-center justify-content-center gap-1 ${
                    timerMode === 'target'
                      ? 'bg-white shadow-sm text-success'
                      : 'text-muted bg-transparent'
                  }`}
                  style={{ fontSize: '12px', borderRadius: '5px' }}
                >
                  <Target size={13} />
                  <span>Sisa Target {targetHours} Jam</span>
                </button>
              </div>

              {/* Focus Activity Selector Pills */}
              <div className="mb-3">
                <div
                  className="text-muted mb-1 fw-medium"
                  style={{ fontSize: '11.5px' }}
                >
                  Fokus Aktivitas Saat Ini:
                </div>
                <div className="d-flex flex-wrap gap-1">
                  {WORK_FOCUS_TAGS.map((tag) => {
                    const active = focusTag === tag.value;
                    return (
                      <button
                        key={tag.value}
                        type="button"
                        onClick={() => handleSelectFocusTag(tag.value)}
                        className={`btn btn-sm py-1 px-2 ${
                          active
                            ? 'btn-dark text-white'
                            : 'btn-outline-secondary bg-white'
                        }`}
                        style={{ fontSize: '11.5px', borderRadius: '6px' }}
                      >
                        {tag.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Dynamic Display According to Timer Mode */}
              {/* MODE 1: STOPWATCH STANDAR */}
              {timerMode === 'stopwatch' && (
                <div className="text-center py-3 my-1">
                  <div
                    className="fw-bold"
                    style={{
                      fontSize: '56px',
                      fontVariantNumeric: 'tabular-nums',
                      letterSpacing: '-0.03em',
                      color:
                        status === 'running'
                          ? '#166534'
                          : 'var(--notion-text)',
                      lineHeight: 1.1,
                    }}
                  >
                    {formatDurationHMS(myTodayElapsedSeconds)}
                  </div>
                  <div className="text-muted mt-2" style={{ fontSize: '13px' }}>
                    Total Durasi Stopwatch Hari Ini (
                    <strong>{formatDurationHuman(myTodayElapsedSeconds)}</strong>)
                  </div>

                  {/* Progress Bar toward Daily Target */}
                  <div className="mx-auto mt-3" style={{ maxWidth: '380px' }}>
                    <div
                      className="d-flex justify-content-between text-muted mb-1"
                      style={{ fontSize: '11px' }}
                    >
                      <span>Minimal Target Harian: {targetHours} Jam</span>
                      <span
                        className={
                          isDailyHoursTargetMet
                            ? 'text-success fw-bold'
                            : 'fw-semibold'
                        }
                      >
                        {isOverworking
                          ? `🎯 Target 3j Tercapai • 🚀 Overwork +${formatDurationHuman(overworkSeconds)}`
                          : isDailyHoursTargetMet
                          ? '🎯 Target Minimal Tercapai!'
                          : `${hoursProgressPct}% Tercapai`}
                      </span>
                    </div>
                    <div className="progress" style={{ height: '8px' }}>
                      <div
                        className={`progress-bar ${
                          isOverworking
                            ? 'bg-success'
                            : isDailyHoursTargetMet
                            ? 'bg-success'
                            : status === 'running'
                            ? 'bg-success progress-bar-striped progress-bar-animated'
                            : 'bg-dark'
                        }`}
                        style={{ width: `${hoursProgressPct}%` }}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* MODE 2: POMODORO TIMER (25m Fokus / 5m Break) */}
              {timerMode === 'pomodoro' && (
                <div className="text-center py-3 my-1">
                  <div className="d-flex align-items-center justify-content-center gap-2 mb-2">
                    <span
                      className={`badge rounded-pill px-3 py-1 ${
                        pomodoroStage === 'work'
                          ? 'bg-danger-subtle text-danger border border-danger-subtle'
                          : 'bg-success-subtle text-success border border-success-subtle'
                      }`}
                      style={{ fontSize: '12px' }}
                    >
                      {pomodoroStage === 'work' ? (
                        <>🍅 Sesi Kerja Fokus (25 Menit)</>
                      ) : (
                        <>☕ Sesi Istirahat Sejenak (5 Menit)</>
                      )}
                    </span>
                    {pomodoroCycles > 0 && (
                      <span
                        className="badge rounded-pill bg-light text-dark border px-2 py-1"
                        style={{ fontSize: '11px' }}
                      >
                        ✓ {pomodoroCycles} Putaran Selesai
                      </span>
                    )}
                  </div>

                  <div
                    className="fw-bold"
                    style={{
                      fontSize: '56px',
                      fontVariantNumeric: 'tabular-nums',
                      letterSpacing: '-0.03em',
                      color:
                        pomodoroStage === 'work'
                          ? '#dc2626'
                          : '#16a34a',
                      lineHeight: 1.1,
                    }}
                  >
                    {formatDurationHMS(countdownRemaining)}
                  </div>
                  <div className="text-muted mt-2" style={{ fontSize: '12.5px' }}>
                    {pomodoroStage === 'work'
                      ? 'Waktu kerja fokus Anda otomatis dihitung ke jam kerja studio'
                      : 'Ambil nafas, minum air, dan regangkan badan sejenak'}
                  </div>

                  {/* Pomodoro Progress Bar */}
                  <div className="mx-auto mt-3" style={{ maxWidth: '380px' }}>
                    <div className="progress" style={{ height: '8px' }}>
                      <div
                        className={`progress-bar ${
                          pomodoroStage === 'work' ? 'bg-danger' : 'bg-success'
                        }`}
                        style={{
                          width: `${Math.min(
                            100,
                            Math.round(
                              ((countdownDuration - countdownRemaining) /
                                Math.max(1, countdownDuration)) *
                                100
                            )
                          )}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* MODE 3: CUSTOM COUNTDOWN TIMER */}
              {timerMode === 'countdown' && (
                <div className="text-center py-2 my-1">
                  {/* Preset Buttons */}
                  <div className="d-flex flex-wrap align-items-center justify-content-center gap-1 mb-2">
                    {[
                      { label: '15m (Sprint)', sec: 900 },
                      { label: '30m (Hunting)', sec: 1800 },
                      { label: '45m (Follow-up)', sec: 2700 },
                      { label: '60m (Deep Work)', sec: 3600 },
                    ].map((item) => (
                      <button
                        key={item.sec}
                        type="button"
                        onClick={() => {
                          resetCountdown(item.sec);
                        }}
                        className={`btn btn-sm py-1 px-2 ${
                          countdownDuration === item.sec
                            ? 'btn-dark text-white'
                            : 'btn-outline-secondary bg-white'
                        }`}
                        style={{ fontSize: '11px', borderRadius: '5px' }}
                      >
                        {item.label}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setShowCustomModal(true)}
                      className="btn btn-sm btn-outline-primary py-1 px-2"
                      style={{ fontSize: '11px', borderRadius: '5px' }}
                    >
                      <Sliders size={11} className="me-1" />
                      Kustom...
                    </button>
                  </div>

                  <div
                    className="fw-bold"
                    style={{
                      fontSize: '56px',
                      fontVariantNumeric: 'tabular-nums',
                      letterSpacing: '-0.03em',
                      color:
                        isCountdownRunning
                          ? '#0284c7'
                          : 'var(--notion-text)',
                      lineHeight: 1.1,
                    }}
                  >
                    {formatDurationHMS(countdownRemaining)}
                  </div>
                  <div className="text-muted mt-2" style={{ fontSize: '12.5px' }}>
                    Durasi Target Sesi:{' '}
                    <strong>{formatDurationHuman(countdownDuration)}</strong>{' '}
                    (Otomatis tercatat ke stopwatch jam kerja)
                  </div>

                  <div className="mx-auto mt-3" style={{ maxWidth: '380px' }}>
                    <div className="progress" style={{ height: '8px' }}>
                      <div
                        className="progress-bar bg-primary"
                        style={{
                          width: `${Math.min(
                            100,
                            Math.round(
                              ((countdownDuration - countdownRemaining) /
                                Math.max(1, countdownDuration)) *
                                100
                            )
                          )}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* MODE 4: COUNTDOWN SISA TARGET (Minimal 3 Jam + Overwork) */}
              {timerMode === 'target' && (
                <div className="text-center py-3 my-1">
                  <div
                    className="fw-semibold mb-1 d-flex align-items-center justify-content-center gap-1"
                    style={{
                      fontSize: '12.5px',
                      color: isOverworking ? '#15803d' : '#0f766e',
                    }}
                  >
                    {isOverworking ? (
                      <>
                        <span>🚀</span>
                        <span>Mode Overwork Aktif — Target Minimal {targetHours} Jam Terpenuhi!</span>
                      </>
                    ) : (
                      <>
                        <Target size={14} />
                        <span>Hitung Mundur Menuju Target Minimal ({targetHours} Jam)</span>
                      </>
                    )}
                  </div>
                  <div
                    className="fw-bold"
                    style={{
                      fontSize: '56px',
                      fontVariantNumeric: 'tabular-nums',
                      letterSpacing: '-0.03em',
                      color: isOverworking
                        ? '#166534'
                        : isDailyHoursTargetMet
                        ? '#16a34a'
                        : '#0f766e',
                      lineHeight: 1.1,
                    }}
                  >
                    {isOverworking
                      ? `+${formatDurationHMS(overworkSeconds)}`
                      : formatDurationHMS(
                          Math.max(0, targetSeconds - myTodayElapsedSeconds)
                        )}
                  </div>
                  <div className="text-muted mt-2" style={{ fontSize: '13px' }}>
                    {isOverworking ? (
                      <span className="text-success fw-bold">
                        🎉 Luar biasa! Anda telah melampaui target minimal {targetHours} jam dan sedang lembur overwork <strong>+{formatDurationHuman(overworkSeconds)}</strong>.
                      </span>
                    ) : isDailyHoursTargetMet ? (
                      <span className="text-success fw-bold">
                        🎉 Selamat! Target minimal {targetHours} jam kerja harian hari ini tepat terpenuhi.
                      </span>
                    ) : (
                      <span>
                        Sisa waktu menuju target minimal:{' '}
                        <strong>
                          {formatDurationHuman(
                            Math.max(0, targetSeconds - myTodayElapsedSeconds)
                          )}
                        </strong>
                      </span>
                    )}
                  </div>

                  <div className="mx-auto mt-3" style={{ maxWidth: '380px' }}>
                    <div
                      className="d-flex justify-content-between text-muted mb-1"
                      style={{ fontSize: '11px' }}
                    >
                      <span>Minimal: {targetHours} Jam</span>
                      <span
                        className={
                          isDailyHoursTargetMet
                            ? 'text-success fw-bold'
                            : 'fw-semibold'
                        }
                      >
                        {rawProgressPct}%
                      </span>
                    </div>
                    <div className="progress" style={{ height: '8px' }}>
                      <div
                        className={`progress-bar ${
                          isOverworking
                            ? 'bg-success'
                            : isDailyHoursTargetMet
                            ? 'bg-success'
                            : 'bg-teal'
                        }`}
                        style={{
                          width: `${hoursProgressPct}%`,
                          backgroundColor: isDailyHoursTargetMet
                            ? '#16a34a'
                            : '#0d9488',
                        }}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Dynamic Controls Bar according to mode */}
            <div
              className="d-flex flex-wrap align-items-center justify-content-center gap-2 pt-3 border-top"
              style={{ borderColor: 'var(--notion-border)' }}
            >
              {/* Controls for Mode 1 (Stopwatch) & Mode 4 (Target) */}
              {(timerMode === 'stopwatch' || timerMode === 'target') && (
                <>
                  {status === 'idle' && (
                    <button
                      type="button"
                      onClick={() => startWork(notes, focusTag)}
                      className="btn-notion-primary px-4 py-2"
                      style={{ fontSize: '14px' }}
                    >
                      <Play size={16} />
                      <span>Absen Masuk &amp; Mulai Stopwatch</span>
                    </button>
                  )}

                  {status === 'running' && (
                    <>
                      <button
                        type="button"
                        onClick={pauseWork}
                        className="btn-notion-outline px-3 py-2"
                      >
                        <Pause size={15} />
                        <span>Jeda (Istirahat)</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleFinishWork}
                        className="btn-notion-primary px-3 py-2"
                        style={{
                          backgroundColor: '#dc2626',
                          borderColor: '#dc2626',
                        }}
                      >
                        <Square size={15} />
                        <span>Selesai Kerja (Check-Out)</span>
                      </button>
                    </>
                  )}

                  {status === 'paused' && (
                    <>
                      <button
                        type="button"
                        onClick={resumeWork}
                        className="btn-notion-primary px-3 py-2"
                      >
                        <Play size={15} />
                        <span>Lanjutkan Kerja</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleFinishWork}
                        className="btn-notion-outline px-3 py-2 text-danger"
                      >
                        <Square size={15} />
                        <span>Selesai Kerja (Check-Out)</span>
                      </button>
                    </>
                  )}
                </>
              )}

              {/* Controls for Mode 2 (Pomodoro) */}
              {timerMode === 'pomodoro' && (
                <>
                  {!isCountdownRunning ? (
                    <button
                      type="button"
                      onClick={() => startCountdown()}
                      className="btn-notion-primary px-4 py-2"
                      style={{
                        backgroundColor: '#dc2626',
                        borderColor: '#dc2626',
                        fontSize: '14px',
                      }}
                    >
                      <Play size={16} />
                      <span>
                        {countdownRemaining < countdownDuration
                          ? 'Lanjutkan Pomodoro'
                          : 'Mulai Sesi Pomodoro (25m)'}
                      </span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => pauseCountdown()}
                      className="btn-notion-outline px-3 py-2"
                    >
                      <Pause size={15} />
                      <span>Jeda Pomodoro</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={skipPomodoroStage}
                    className="btn-notion-outline px-3 py-2"
                    title="Lewati tahap fokus/break saat ini"
                  >
                    <SkipForward size={14} />
                    <span>
                      Lewati ke {pomodoroStage === 'work' ? 'Break' : 'Fokus'}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => resetCountdown(pomodoroStage === 'work' ? 1500 : 300)}
                    className="btn-notion-outline px-2 py-2"
                    title="Reset waktu putaran ini"
                  >
                    <RotateCcw size={14} />
                  </button>

                  {status === 'running' && (
                    <button
                      type="button"
                      onClick={handleFinishWork}
                      className="btn-notion-outline px-3 py-2 text-danger"
                      title="Selesai jam kerja harian"
                    >
                      <Square size={14} />
                      <span>Selesai Hari Ini</span>
                    </button>
                  )}
                </>
              )}

              {/* Controls for Mode 3 (Custom Countdown) */}
              {timerMode === 'countdown' && (
                <>
                  {!isCountdownRunning ? (
                    <button
                      type="button"
                      onClick={() => startCountdown()}
                      className="btn-notion-primary px-4 py-2"
                      style={{ fontSize: '14px' }}
                    >
                      <Play size={16} />
                      <span>
                        {countdownRemaining < countdownDuration
                          ? 'Lanjutkan Countdown'
                          : 'Mulai Countdown Timer'}
                      </span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => pauseCountdown()}
                      className="btn-notion-outline px-3 py-2"
                    >
                      <Pause size={15} />
                      <span>Jeda Countdown</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => resetCountdown()}
                    className="btn-notion-outline px-3 py-2"
                    title="Reset countdown ke durasi awal"
                  >
                    <RotateCcw size={14} />
                    <span>Reset</span>
                  </button>

                  {status === 'running' && (
                    <button
                      type="button"
                      onClick={handleFinishWork}
                      className="btn-notion-outline px-3 py-2 text-danger"
                      title="Selesai jam kerja harian"
                    >
                      <Square size={14} />
                      <span>Selesai Hari Ini</span>
                    </button>
                  )}
                </>
              )}

              {status === 'completed' && (
                <div className="d-flex flex-wrap align-items-center justify-content-between w-100 gap-2">
                  <div
                    className="d-flex align-items-center gap-2 text-success fw-medium"
                    style={{ fontSize: '13px' }}
                  >
                    <CheckCircle2 size={16} />
                    <span>
                      Absen selesai dicatat (Check-out:{' '}
                      {myTodayLog?.check_out_at
                        ? new Date(myTodayLog.check_out_at).toLocaleTimeString(
                            'id-ID',
                            { hour: '2-digit', minute: '2-digit' }
                          )
                        : '-'}
                      ).
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={resumeWork}
                    className="btn-notion-outline py-1 px-2"
                    style={{ fontSize: '12px' }}
                  >
                    <Play size={13} />
                    <span>Lanjutkan Lagi (Lembur)</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Live Daily KPI + Auto-Generated Notes */}
        <div className="col-lg-5 d-flex flex-column gap-3">
          {/* Auto Daily KPI Panel (synced from ProspectsContext) */}
          <div className="notion-card">
            <div className="d-flex align-items-center justify-content-between mb-2">
              <div
                className="fw-bold d-flex align-items-center gap-2"
                style={{ fontSize: '14px' }}
              >
                <Users size={15} className="text-primary" />
                <span>Pencapaian KPI Saya Hari Ini</span>
              </div>
              <span
                className={`badge rounded-pill ${
                  myTodayKpi.isProspectTargetMet
                    ? 'bg-success text-white'
                    : 'bg-light text-secondary border'
                }`}
                style={{ fontSize: '10.5px' }}
              >
                Live dari Prospek
              </span>
            </div>

            <div className="mb-2">
              <div
                className="d-flex justify-content-between mb-1"
                style={{ fontSize: '12px' }}
              >
                <span className="text-muted">Prospek Baru Diinput Hari Ini</span>
                <span className="fw-bold">
                  {myTodayKpi.newProspectsCount} / {targetProspects} Prospek (
                  {myTodayKpi.prospectTargetPct}%)
                </span>
              </div>
              <div className="progress" style={{ height: '7px' }}>
                <div
                  className={`progress-bar ${
                    myTodayKpi.isProspectTargetMet
                      ? 'bg-success'
                      : 'bg-primary'
                  }`}
                  style={{ width: `${myTodayKpi.prospectTargetPct}%` }}
                />
              </div>
            </div>

            <div className="row g-2 pt-1">
              <div className="col-6">
                <div className="p-2 rounded bg-light border d-flex align-items-center justify-content-between">
                  <span
                    className="text-muted d-flex align-items-center gap-1"
                    style={{ fontSize: '11.5px' }}
                  >
                    <MessageSquare size={12} />
                    <span>Follow-Up Hari Ini</span>
                  </span>
                  <span className="fw-bold" style={{ fontSize: '13.5px' }}>
                    {myTodayKpi.todayTouchpointsCount}
                  </span>
                </div>
              </div>
              <div className="col-6">
                <div className="p-2 rounded bg-light border d-flex align-items-center justify-content-between">
                  <span
                    className="text-muted d-flex align-items-center gap-1"
                    style={{ fontSize: '11.5px' }}
                  >
                    <CheckCircle2 size={12} className="text-success" />
                    <span>Deal Hari Ini</span>
                  </span>
                  <span
                    className="fw-bold text-success"
                    style={{ fontSize: '13.5px' }}
                  >
                    {myTodayKpi.todayDealsCount}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Today's Work Log / Notes with 1-Click Auto-Generate */}
          <div className="notion-card flex-grow-1 d-flex flex-column">
            <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-2">
              <div
                className="fw-semibold d-flex align-items-center gap-2"
                style={{ fontSize: '14px' }}
              >
                <FileText size={15} />
                <span>Catatan Kerja Hari Ini</span>
              </div>
              <div className="d-flex align-items-center gap-2">
                {savedToast && (
                  <span
                    className="text-success fw-medium"
                    style={{ fontSize: '12px' }}
                  >
                    ✓ Tersimpan
                  </span>
                )}
                <button
                  type="button"
                  onClick={handleAutoFillNotes}
                  className="btn btn-sm btn-outline-primary py-1 px-2 d-inline-flex align-items-center gap-1"
                  style={{ fontSize: '11px' }}
                  title="Buat ringkasan laporan otomatis dari hasil input prospek & follow-up hari ini"
                >
                  <Sparkles size={12} />
                  <span>Auto-Isi dari Hasil Hari Ini</span>
                </button>
              </div>
            </div>
            <p className="text-muted mb-2" style={{ fontSize: '12px' }}>
              Ringkasan ini tampil di rekap Admin. Kosongkan lalu tekan Check-Out
              untuk pengisian otomatis.
            </p>
            <form
              onSubmit={handleSaveNotes}
              className="d-flex flex-column flex-grow-1"
            >
              <textarea
                className="notion-input w-100 flex-grow-1 mb-3"
                rows={3}
                placeholder="Contoh: Hunting 10 prospek dari Google Maps area Bandung, follow up 4 klien..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
              <div className="d-flex justify-content-end">
                <button
                  type="submit"
                  disabled={!myTodayLog}
                  className="btn-notion-outline"
                >
                  <Save size={14} />
                  <span>
                    {myTodayLog
                      ? 'Simpan Catatan Hari Ini'
                      : 'Mulai Absen untuk Menyimpan Catatan'}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* Personal Attendance History Table */}
      <div className="mb-2 d-flex flex-wrap align-items-center justify-content-between gap-2">
        <div
          className="fw-bold d-flex align-items-center gap-2"
          style={{ fontSize: '15px' }}
        >
          <Clock size={16} />
          <span>Riwayat Jam Kerja Saya</span>
        </div>
        <div className="d-flex align-items-center gap-2">
          <span className="text-muted" style={{ fontSize: '12.5px' }}>
            Total <strong>{myHistoryLogs.length}</strong> hari tercatat
          </span>
          <button
            type="button"
            onClick={handleExportMyAttendanceCSV}
            className="btn-notion-outline py-1 px-2"
            style={{ fontSize: '12px' }}
          >
            <Download size={13} />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      <div className="notion-table-wrapper">
        <div className="table-responsive">
          <table className="notion-table">
            <thead>
              <tr>
                <th style={{ minWidth: '140px' }}>Tanggal</th>
                <th style={{ minWidth: '135px' }}>Fokus Kerja</th>
                <th style={{ minWidth: '105px' }}>Mulai / Selesai</th>
                <th style={{ minWidth: '150px' }}>Total Durasi</th>
                <th style={{ minWidth: '140px' }}>Target ({targetHours}j)</th>
                <th style={{ minWidth: '125px' }}>Status</th>
                <th style={{ minWidth: '240px' }}>Catatan Aktivitas</th>
              </tr>
            </thead>
            <tbody>
              {myHistoryLogs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-4 text-muted">
                    Belum ada riwayat absen. Klik tombol{' '}
                    <strong>Absen Masuk &amp; Mulai Stopwatch</strong> di atas
                    untuk memulai.
                  </td>
                </tr>
              ) : (
                myHistoryLogs.map((log) => {
                  const isToday = log.work_date === todayStr;
                  const liveSec = calculateLiveSeconds(log, nowTick);
                  const pctTarget = Math.min(
                    100,
                    Math.round((liveSec / Math.max(1, targetSeconds)) * 100)
                  );
                  const metTarget = liveSec >= targetSeconds;

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
                      <td>
                        <span
                          className="badge bg-light text-dark border"
                          style={{ fontSize: '11px' }}
                        >
                          {log.focus_tag || 'Hunting Prospek'}
                        </span>
                      </td>
                      <td style={{ fontSize: '12.5px' }}>
                        {log.check_in_at
                          ? new Date(log.check_in_at).toLocaleTimeString(
                              'id-ID',
                              { hour: '2-digit', minute: '2-digit' }
                            )
                          : '-'}
                        {' → '}
                        {log.check_out_at
                          ? new Date(log.check_out_at).toLocaleTimeString(
                              'id-ID',
                              { hour: '2-digit', minute: '2-digit' }
                            )
                          : log.status === 'running'
                          ? 'Aktif'
                          : '-'}
                      </td>
                      <td>
                        <span className="fw-bold">
                          {formatDurationHMS(liveSec)}
                        </span>{' '}
                        <span
                          className="text-muted"
                          style={{ fontSize: '11.5px' }}
                        >
                          ({formatDurationHuman(liveSec)})
                        </span>
                      </td>
                      <td>
                        <span
                          className={`badge rounded-pill ${
                            metTarget
                              ? 'bg-success-subtle text-success border border-success-subtle'
                              : 'bg-light text-secondary border'
                          }`}
                          style={{ fontSize: '11px' }}
                        >
                          {metTarget ? '🎯 Tercapai' : `${pctTarget}%`}
                        </span>
                      </td>
                      <td>{renderStatusBadge(log.status)}</td>
                      <td className="text-muted" style={{ fontSize: '12.5px' }}>
                        {log.notes || '-'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Input Durasi Countdown Kustom */}
      {showCustomModal && (
        <>
          <div
            className="notion-drawer-backdrop"
            onClick={() => setShowCustomModal(false)}
          />
          <div
            className="modal show d-block"
            tabIndex="-1"
            style={{ backgroundColor: 'rgba(15, 15, 15, 0.45)', zIndex: 1060 }}
          >
            <div className="modal-dialog modal-sm modal-dialog-centered">
              <div className="modal-content border-0 shadow" style={{ borderRadius: '10px' }}>
                <div className="modal-header py-2 px-3 border-bottom bg-light">
                  <div className="fw-semibold" style={{ fontSize: '13.5px' }}>
                    Atur Durasi Countdown Kustom
                  </div>
                  <button
                    type="button"
                    className="btn-close"
                    style={{ fontSize: '11px' }}
                    onClick={() => setShowCustomModal(false)}
                  />
                </div>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const mins = Math.max(1, parseInt(customMinutesInput, 10) || 30);
                    resetCountdown(mins * 60);
                    setShowCustomModal(false);
                  }}
                  className="p-3"
                >
                  <label className="form-label mb-1" style={{ fontSize: '12px' }}>
                    Durasi Sesi Kerja (Menit):
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="480"
                    className="notion-input w-100 mb-3"
                    value={customMinutesInput}
                    onChange={(e) => setCustomMinutesInput(e.target.value)}
                    required
                    autoFocus
                  />
                  <div className="d-flex justify-content-end gap-2">
                    <button
                      type="button"
                      className="btn-notion-outline"
                      onClick={() => setShowCustomModal(false)}
                    >
                      Batal
                    </button>
                    <button type="submit" className="btn-notion-primary">
                      Terapkan Timer
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
