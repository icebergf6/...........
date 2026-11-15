import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  supabase,
  isSupabaseConfigured,
  getTodayDateString,
  playSynthesizedChime,
  showDesktopNotification,
} from '../lib/supabase';
import { useAuth } from './AuthContext';

const AttendanceContext = createContext(null);
const LOCAL_ATTENDANCE_KEY = 'atier_crm_attendance_logs_v1';
const TIMER_MODE_KEY = 'atier_crm_timer_mode_v1';
const CHIME_PREF_KEY = 'atier_crm_chime_enabled_v1';
const POMODORO_CYCLES_KEY_PREFIX = 'atier_crm_pomo_cycles_';
const COUNTDOWN_END_TIME_KEY = 'atier_crm_countdown_end_time';
const POMODORO_STAGE_KEY = 'atier_crm_pomodoro_stage';
const COUNTDOWN_DUR_KEY = 'atier_crm_countdown_dur';

export function calculateLiveSeconds(logRecord, nowMs = Date.now()) {
  if (!logRecord) return 0;
  const base = Number(logRecord.accumulated_seconds) || 0;
  if (logRecord.status === 'running' && logRecord.last_started_at) {
    const startMs = new Date(logRecord.last_started_at).getTime();
    const deltaSec = Math.max(0, Math.floor((nowMs - startMs) / 1000));
    return base + deltaSec;
  }
  return base;
}

export function AttendanceProvider({ children }) {
  const { user, profile, teamUsers } = useAuth();
  const [attendanceLogs, setAttendanceLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [nowTick, setNowTick] = useState(Date.now());

  const todayDate = getTodayDateString();
  const currentUsername =
    profile?.username || user?.email?.split('@')[0] || 'anggota_tim';

  // Multi-Mode Timer States
  const [timerMode, setTimerModeState] = useState(() => {
    try {
      return localStorage.getItem(TIMER_MODE_KEY) || 'stopwatch';
    } catch {
      return 'stopwatch';
    }
  });

  const [pomodoroStage, setPomodoroStage] = useState(() => {
    try {
      return localStorage.getItem(POMODORO_STAGE_KEY) || 'work';
    } catch {
      return 'work';
    }
  });

  const [countdownDuration, setCountdownDuration] = useState(() => {
    try {
      const saved = localStorage.getItem(COUNTDOWN_DUR_KEY);
      return saved ? Number(saved) || 1500 : 1500;
    } catch {
      return 1500;
    }
  });

  const [countdownRemaining, setCountdownRemaining] = useState(() => {
    try {
      const endMs = Number(localStorage.getItem(COUNTDOWN_END_TIME_KEY));
      if (endMs && endMs > Date.now()) {
        return Math.max(0, Math.floor((endMs - Date.now()) / 1000));
      }
      return 1500;
    } catch {
      return 1500;
    }
  });

  const [isCountdownRunning, setIsCountdownRunning] = useState(() => {
    try {
      const endMs = Number(localStorage.getItem(COUNTDOWN_END_TIME_KEY));
      return Boolean(endMs && endMs > Date.now());
    } catch {
      return false;
    }
  });

  const [pomodoroCycles, setPomodoroCycles] = useState(() => {
    try {
      const saved = localStorage.getItem(POMODORO_CYCLES_KEY_PREFIX + todayDate);
      return saved ? Number(saved) || 0 : 0;
    } catch {
      return 0;
    }
  });
  const [chimeEnabled, setChimeEnabled] = useState(() => {
    try {
      const raw = localStorage.getItem(CHIME_PREF_KEY);
      return raw === null ? true : raw === 'true';
    } catch {
      return true;
    }
  });

  const pauseWorkRef = useRef(null);
  const isCountdownRunningRef = useRef(false);
  isCountdownRunningRef.current = isCountdownRunning;
  const pomodoroStageRef = useRef('work');
  pomodoroStageRef.current = pomodoroStage;
  const timerModeRef = useRef('stopwatch');
  timerModeRef.current = timerMode;
  const chimeEnabledRef = useRef(true);
  chimeEnabledRef.current = chimeEnabled;
  const countdownDurationRef = useRef(1500);
  countdownDurationRef.current = countdownDuration;

  useEffect(() => {
    if (!user) {
      setAttendanceLogs([]);
      setLoading(false);
      return;
    }
    loadAttendanceLogs();

    // Live sync across accounts/tabs
    if (isSupabaseConfigured && supabase) {
      const channel = supabase
        .channel('public:attendance_logs_live')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'attendance_logs' },
          () => {
            loadAttendanceLogs();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    } else {
      function handleStorageChange(e) {
        if (e.key === LOCAL_ATTENDANCE_KEY && e.newValue) {
          try {
            setAttendanceLogs(JSON.parse(e.newValue));
          } catch (err) {
            console.error('Failed to sync attendance from storage:', err);
          }
        }
      }
      window.addEventListener('storage', handleStorageChange);
      return () => window.removeEventListener('storage', handleStorageChange);
    }
  }, [user]);

  // Keep username synced in attendance logs if user updates username in Profile
  useEffect(() => {
    if (!user || !profile?.username) return;
    setAttendanceLogs((prev) => {
      const needsUpdate = prev.some(
        (log) => log.user_id === user.id && log.username !== profile.username
      );
      if (!needsUpdate) return prev;

      const updated = prev.map((log) =>
        log.user_id === user.id && log.username !== profile.username
          ? { ...log, username: profile.username }
          : log
      );
      if (!isSupabaseConfigured) {
        localStorage.setItem(LOCAL_ATTENDANCE_KEY, JSON.stringify(updated));
      }
      return updated;
    });
  }, [profile?.username, user]);

  function handleCountdownFinished() {
    setIsCountdownRunning(false);
    isCountdownRunningRef.current = false;
    try {
      localStorage.removeItem(COUNTDOWN_END_TIME_KEY);
    } catch {}

    if (chimeEnabledRef.current) {
      const chimeType =
        timerModeRef.current === 'pomodoro' && pomodoroStageRef.current === 'work'
          ? 'break'
          : 'success';
      playSynthesizedChime(chimeType);
    }

    if (timerModeRef.current === 'pomodoro') {
      if (pomodoroStageRef.current === 'work') {
        // Otomatis jeda stopwatch saat memasuki waktu istirahat agar data audit akurat
        if (pauseWorkRef.current) {
          pauseWorkRef.current().catch(() => {});
        }
        showDesktopNotification('🍅 Sesi Pomodoro 25 Menit Selesai!', {
          body: 'Kerja bagus! Stopwatch dijeda otomatis. Waktunya istirahat sejenak 5 menit untuk rileks.',
        });
        setPomodoroStage('break');
        try {
          localStorage.setItem(POMODORO_STAGE_KEY, 'break');
          localStorage.setItem(COUNTDOWN_DUR_KEY, '300');
        } catch {}
        setCountdownDuration(300);
        setCountdownRemaining(300);
        setPomodoroCycles((prev) => {
          const next = prev + 1;
          try {
            localStorage.setItem(
              POMODORO_CYCLES_KEY_PREFIX + todayDate,
              String(next)
            );
          } catch {}
          return next;
        });
      } else {
        showDesktopNotification('⚡ Waktu Istirahat 5 Menit Selesai!', {
          body: 'Siap untuk sesi Pomodoro fokus berikutnya? Klik Mulai Kerja.',
        });
        setPomodoroStage('work');
        try {
          localStorage.setItem(POMODORO_STAGE_KEY, 'work');
          localStorage.setItem(COUNTDOWN_DUR_KEY, '1500');
        } catch {}
        setCountdownDuration(1500);
        setCountdownRemaining(1500);
      }
    } else {
      showDesktopNotification('⏳ Waktu Countdown Timer Habis!', {
        body: 'Sesi fokus kerja yang Anda atur telah selesai.',
      });
    }
  }

  // 1-second interval ticker for live stopwatch & countdown display
  useEffect(() => {
    const timer = setInterval(() => {
      setNowTick(Date.now());
      if (isCountdownRunningRef.current) {
        setCountdownRemaining((prev) => {
          if (prev <= 1) {
            handleCountdownFinished();
            return 0;
          }
          return prev - 1;
        });
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [todayDate]);

  async function loadAttendanceLogs() {
    setLoading(true);
    try {
      if (isSupabaseConfigured && supabase && user) {
        const { data, error } = await supabase
          .from('attendance_logs')
          .select('*')
          .order('work_date', { ascending: false });

        if (error) throw error;
        setAttendanceLogs(data || []);
      } else {
        const saved = localStorage.getItem(LOCAL_ATTENDANCE_KEY);
        if (saved) {
          setAttendanceLogs(JSON.parse(saved));
        } else {
          setAttendanceLogs([]);
        }
      }
    } catch (err) {
      console.error('Error loading attendance logs:', err);
    } finally {
      setLoading(false);
    }
  }

  function persistLocal(nextLogs) {
    setAttendanceLogs(nextLogs);
    localStorage.setItem(LOCAL_ATTENDANCE_KEY, JSON.stringify(nextLogs));
  }

  const myTodayLog = useMemo(() => {
    if (!user) return null;
    return (
      attendanceLogs.find(
        (log) =>
          (log.user_id === user.id ||
            (profile?.username &&
              log.username?.toLowerCase() === profile.username.toLowerCase())) &&
          log.work_date === todayDate
      ) || null
    );
  }, [attendanceLogs, user, profile?.username, todayDate]);

  const myTodayElapsedSeconds = useMemo(() => {
    return calculateLiveSeconds(myTodayLog, nowTick);
  }, [myTodayLog, nowTick]);

  const myHistoryLogs = useMemo(() => {
    if (!user) return [];
    return attendanceLogs
      .filter(
        (log) =>
          log.user_id === user.id ||
          (profile?.username &&
            log.username?.toLowerCase() === profile.username.toLowerCase())
      )
      .sort((a, b) => b.work_date.localeCompare(a.work_date));
  }, [attendanceLogs, user, profile?.username]);

  async function startWork(initialNotes = '', focusTag = 'Hunting Prospek') {
    if (!user) return;
    const nowIso = new Date().toISOString();

    if (myTodayLog) {
      return resumeWork();
    }

    const newLog = {
      user_id: user.id,
      username: currentUsername,
      work_date: todayDate,
      status: 'running',
      accumulated_seconds: 0,
      last_started_at: nowIso,
      check_in_at: nowIso,
      check_out_at: null,
      notes: initialNotes,
      focus_tag: focusTag || 'Hunting Prospek',
      updated_at: nowIso,
    };

    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('attendance_logs')
        .insert([newLog])
        .select()
        .single();
      if (error) throw error;
      setAttendanceLogs((prev) => [data, ...prev]);
      return data;
    }

    const localLog = { ...newLog, id: 'att-' + Date.now() };
    persistLocal([localLog, ...attendanceLogs]);
    return localLog;
  }

  async function pauseWork() {
    pauseWorkRef.current = pauseWork;
    if (!myTodayLog || myTodayLog.status !== 'running') return;
    const nowIso = new Date().toISOString();
    const totalSec = calculateLiveSeconds(myTodayLog, Date.now());

    const updates = {
      status: 'paused',
      accumulated_seconds: totalSec,
      last_started_at: null,
      updated_at: nowIso,
    };

    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('attendance_logs')
        .update(updates)
        .eq('id', myTodayLog.id)
        .select()
        .single();
      if (error) throw error;
      setAttendanceLogs((prev) =>
        prev.map((item) => (item.id === myTodayLog.id ? data : item))
      );
      return data;
    }

    const nextLogs = attendanceLogs.map((item) =>
      item.id === myTodayLog.id ? { ...item, ...updates } : item
    );
    persistLocal(nextLogs);
  }

  async function resumeWork() {
    if (!myTodayLog || myTodayLog.status === 'running') return;
    const nowIso = new Date().toISOString();

    const updates = {
      status: 'running',
      last_started_at: nowIso,
      check_out_at: null,
      updated_at: nowIso,
    };

    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('attendance_logs')
        .update(updates)
        .eq('id', myTodayLog.id)
        .select()
        .single();
      if (error) throw error;
      setAttendanceLogs((prev) =>
        prev.map((item) => (item.id === myTodayLog.id ? data : item))
      );
      return data;
    }

    const nextLogs = attendanceLogs.map((item) =>
      item.id === myTodayLog.id ? { ...item, ...updates } : item
    );
    persistLocal(nextLogs);
  }

  async function finishWork(notesInput) {
    if (!myTodayLog) return;
    const nowIso = new Date().toISOString();
    const totalSec = calculateLiveSeconds(myTodayLog, Date.now());

    const updates = {
      status: 'completed',
      accumulated_seconds: totalSec,
      last_started_at: null,
      check_out_at: nowIso,
      notes: notesInput !== undefined ? notesInput : myTodayLog.notes,
      updated_at: nowIso,
    };

    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('attendance_logs')
        .update(updates)
        .eq('id', myTodayLog.id)
        .select()
        .single();
      if (error) throw error;
      setAttendanceLogs((prev) =>
        prev.map((item) => (item.id === myTodayLog.id ? data : item))
      );
      return data;
    }

    const nextLogs = attendanceLogs.map((item) =>
      item.id === myTodayLog.id ? { ...item, ...updates } : item
    );
    persistLocal(nextLogs);
  }

  async function updateTodayNotes(notesText, focusTag) {
    if (!myTodayLog) return;
    const nowIso = new Date().toISOString();
    const updates = {
      notes: notesText,
      ...(focusTag !== undefined ? { focus_tag: focusTag } : {}),
      updated_at: nowIso,
    };

    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('attendance_logs')
        .update(updates)
        .eq('id', myTodayLog.id)
        .select()
        .single();
      if (error) throw error;
      setAttendanceLogs((prev) =>
        prev.map((item) => (item.id === myTodayLog.id ? data : item))
      );
      return data;
    }

    const nextLogs = attendanceLogs.map((item) =>
      item.id === myTodayLog.id ? { ...item, ...updates } : item
    );
    persistLocal(nextLogs);
  }

  async function updateTodayFocusTag(focusTag) {
    if (!myTodayLog) return;
    return updateTodayNotes(myTodayLog.notes || '', focusTag);
  }

  // Multi-Mode Timer Control Functions
  function setTimerMode(mode) {
    setTimerModeState(mode);
    try {
      localStorage.setItem(TIMER_MODE_KEY, mode);
      localStorage.removeItem(COUNTDOWN_END_TIME_KEY);
    } catch {}

    if (mode === 'pomodoro') {
      setPomodoroStage('work');
      setCountdownDuration(1500);
      setCountdownRemaining(1500);
      setIsCountdownRunning(false);
      try {
        localStorage.setItem(POMODORO_STAGE_KEY, 'work');
        localStorage.setItem(COUNTDOWN_DUR_KEY, '1500');
      } catch {}
    } else if (mode === 'countdown') {
      setIsCountdownRunning(false);
    }
  }

  async function startCountdown(durationSec) {
    let dur = countdownDuration;
    if (durationSec && Number(durationSec) > 0) {
      dur = Number(durationSec);
      setCountdownDuration(dur);
      setCountdownRemaining(dur);
    }
    const currentRem = durationSec ? dur : (countdownRemaining > 0 ? countdownRemaining : dur);
    const endMs = Date.now() + currentRem * 1000;
    try {
      localStorage.setItem(COUNTDOWN_END_TIME_KEY, String(endMs));
      localStorage.setItem(COUNTDOWN_DUR_KEY, String(dur));
      localStorage.setItem(POMODORO_STAGE_KEY, pomodoroStage);
    } catch {}

    setIsCountdownRunning(true);
    // Otomatis sinkronkan dengan stopwatch jam kerja harian
    if (!myTodayLog || myTodayLog.status !== 'running') {
      if (myTodayLog) {
        await resumeWork();
      } else {
        await startWork('', 'Hunting Prospek');
      }
    }
  }

  async function pauseCountdown() {
    setIsCountdownRunning(false);
    try {
      localStorage.removeItem(COUNTDOWN_END_TIME_KEY);
    } catch {}
    if (myTodayLog?.status === 'running') {
      await pauseWork();
    }
  }

  async function resumeCountdown() {
    const endMs = Date.now() + (countdownRemaining > 0 ? countdownRemaining * 1000 : countdownDuration * 1000);
    try {
      localStorage.setItem(COUNTDOWN_END_TIME_KEY, String(endMs));
    } catch {}

    setIsCountdownRunning(true);
    if (!myTodayLog || myTodayLog.status !== 'running') {
      if (myTodayLog) {
        await resumeWork();
      } else {
        await startWork('', 'Hunting Prospek');
      }
    }
  }

  function resetCountdown(newDurationSec) {
    setIsCountdownRunning(false);
    try {
      localStorage.removeItem(COUNTDOWN_END_TIME_KEY);
    } catch {}
    const dur = newDurationSec || countdownDuration;
    setCountdownDuration(dur);
    setCountdownRemaining(dur);
  }

  function skipPomodoroStage() {
    try {
      localStorage.removeItem(COUNTDOWN_END_TIME_KEY);
    } catch {}
    if (pomodoroStage === 'work') {
      setPomodoroStage('break');
      try {
        localStorage.setItem(POMODORO_STAGE_KEY, 'break');
      } catch {}
      setCountdownDuration(300);
      setCountdownRemaining(300);
    } else {
      setPomodoroStage('work');
      try {
        localStorage.setItem(POMODORO_STAGE_KEY, 'work');
      } catch {}
      setCountdownDuration(1500);
      setCountdownRemaining(1500);
    }
    setIsCountdownRunning(false);
  }

  function toggleChimeEnabled() {
    setChimeEnabled((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(CHIME_PREF_KEY, String(next));
      } catch {}
      return next;
    });
  }

  function testChimeSound(type = 'success') {
    playSynthesizedChime(type);
  }

  // Admin: Force stop a running or paused stopwatch for any team member
  async function adminForceStopLog(logId) {
    if (profile?.role !== 'admin') {
      throw new Error('Akses ditolak: Hanya Admin yang dapat menghentikan paksa timer.');
    }
    const target = attendanceLogs.find((item) => item.id === logId);
    if (!target) return;
    const nowIso = new Date().toISOString();
    const finalSeconds = calculateLiveSeconds(target, Date.now());

    const updates = {
      status: 'completed',
      accumulated_seconds: finalSeconds,
      last_started_at: null,
      check_out_at: nowIso,
      updated_at: nowIso,
    };

    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('attendance_logs')
        .update(updates)
        .eq('id', logId)
        .select()
        .single();
      if (error) throw error;
      setAttendanceLogs((prev) =>
        prev.map((item) => (item.id === logId ? data : item))
      );
      return data;
    }

    const nextLogs = attendanceLogs.map((item) =>
      item.id === logId ? { ...item, ...updates } : item
    );
    persistLocal(nextLogs);
  }

  // Admin: Edit duration, status, or notes of any attendance log
  async function adminUpdateLog(logId, { accumulated_seconds, status, notes }) {
    if (profile?.role !== 'admin') {
      throw new Error('Akses ditolak: Hanya Admin yang dapat mengubah log absensi.');
    }
    const target = attendanceLogs.find((item) => item.id === logId);
    if (!target) return;
    const nowIso = new Date().toISOString();

    const nextSec =
      accumulated_seconds !== undefined
        ? Math.max(0, Math.floor(Number(accumulated_seconds) || 0))
        : target.accumulated_seconds;
    const nextStatus = status || target.status;

    const updates = {
      accumulated_seconds: nextSec,
      status: nextStatus,
      last_started_at: nextStatus === 'running' ? nowIso : null,
      check_out_at:
        nextStatus === 'completed'
          ? target.check_out_at || nowIso
          : target.check_out_at,
      notes: notes !== undefined ? notes : target.notes,
      updated_at: nowIso,
    };

    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('attendance_logs')
        .update(updates)
        .eq('id', logId)
        .select()
        .single();
      if (error) throw error;
      setAttendanceLogs((prev) =>
        prev.map((item) => (item.id === logId ? data : item))
      );
      return data;
    }

    const nextLogs = attendanceLogs.map((item) =>
      item.id === logId ? { ...item, ...updates } : item
    );
    persistLocal(nextLogs);
  }

  // Admin: Delete an attendance log entry
  async function adminDeleteLog(logId) {
    if (profile?.role !== 'admin') {
      throw new Error('Akses ditolak: Hanya Admin yang dapat menghapus log absensi.');
    }
    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase
        .from('attendance_logs')
        .delete()
        .eq('id', logId);
      if (error) throw error;
      setAttendanceLogs((prev) => prev.filter((item) => item.id !== logId));
      return;
    }

    const nextLogs = attendanceLogs.filter((item) => item.id !== logId);
    persistLocal(nextLogs);
  }

  // Admin: Add a manual attendance log for a team member
  async function adminAddManualLog({
    username,
    work_date,
    accumulated_seconds,
    notes,
  }) {
    if (profile?.role !== 'admin') {
      throw new Error('Akses ditolak: Hanya Admin yang dapat menambah absensi manual.');
    }
    const cleanUname = (username || '').trim().toLowerCase().replace(/\s+/g, '_');
    if (!cleanUname) return;
    const dateStr = work_date || todayDate;
    const nowIso = new Date().toISOString();
    const totalSec = Math.max(0, Math.floor(Number(accumulated_seconds) || 0));

    const existing = attendanceLogs.find(
      (item) =>
        item.work_date === dateStr &&
        (item.username || '').toLowerCase() === cleanUname
    );
    if (existing) {
      return adminUpdateLog(existing.id, {
        accumulated_seconds: totalSec,
        status: 'completed',
        notes: notes || existing.notes || 'Input absensi manual oleh Admin.',
      });
    }

    const matchedMember = (teamUsers || []).find(
      (u) => (u.username || '').toLowerCase() === cleanUname
    );
    const resolvedUserId = matchedMember?.id || null;

    const newLog = {
      user_id: isSupabaseConfigured ? resolvedUserId : resolvedUserId || 'user-' + cleanUname,
      username: cleanUname,
      work_date: dateStr,
      status: 'completed',
      accumulated_seconds: totalSec,
      last_started_at: null,
      check_in_at: `${dateStr}T09:00:00.000Z`,
      check_out_at: `${dateStr}T17:00:00.000Z`,
      notes: notes || 'Input absensi manual oleh Admin.',
      focus_tag: 'Input Manual Admin',
      updated_at: nowIso,
    };

    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('attendance_logs')
        .insert([newLog])
        .select()
        .single();
      if (error) throw error;
      setAttendanceLogs((prev) => [data, ...prev]);
      return data;
    }

    const localLog = { ...newLog, id: 'att-manual-' + Date.now() };
    persistLocal([localLog, ...attendanceLogs]);
    return localLog;
  }

  return (
    <AttendanceContext.Provider
      value={{
        attendanceLogs,
        myTodayLog,
        myTodayElapsedSeconds,
        myHistoryLogs,
        nowTick,
        loading,
        startWork,
        pauseWork,
        resumeWork,
        finishWork,
        updateTodayNotes,
        updateTodayFocusTag,
        calculateLiveSeconds,
        // Multi-Mode Timer Exports
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
        // Admin attendance tools
        adminForceStopLog,
        adminUpdateLog,
        adminDeleteLog,
        adminAddManualLog,
      }}
    >
      {children}
    </AttendanceContext.Provider>
  );
}

export function useAttendance() {
  const ctx = useContext(AttendanceContext);
  if (!ctx)
    throw new Error('useAttendance must be used inside AttendanceProvider');
  return ctx;
}
