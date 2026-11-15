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

  const [countdownDuration, setCountdownDuration] = useState(1500); // 25 min default
  const [countdownRemaining, setCountdownRemaining] = useState(1500);
  const [isCountdownRunning, setIsCountdownRunning] = useState(false);
  const [pomodoroStage, setPomodoroStage] = useState('work'); // 'work' | 'break'
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

    if (chimeEnabledRef.current) {
      const chimeType =
        timerModeRef.current === 'pomodoro' && pomodoroStageRef.current === 'work'
          ? 'break'
          : 'success';
      playSynthesizedChime(chimeType);
    }

    if (timerModeRef.current === 'pomodoro') {
      if (pomodoroStageRef.current === 'work') {
        showDesktopNotification('🍅 Sesi Pomodoro 25 Menit Selesai!', {
          body: 'Kerja bagus! Waktunya istirahat sejenak 5 menit untuk rileks.',
        });
        setPomodoroStage('break');
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
    } catch {}

    if (mode === 'pomodoro') {
      setPomodoroStage('work');
      setCountdownDuration(1500);
      setCountdownRemaining(1500);
      setIsCountdownRunning(false);
    } else if (mode === 'countdown') {
      setIsCountdownRunning(false);
    }
  }

  async function startCountdown(durationSec) {
    if (durationSec && Number(durationSec) > 0) {
      const dur = Number(durationSec);
      setCountdownDuration(dur);
      setCountdownRemaining(dur);
    }
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
    if (myTodayLog?.status === 'running') {
      await pauseWork();
    }
  }

  async function resumeCountdown() {
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
    const dur = newDurationSec || countdownDuration;
    setCountdownDuration(dur);
    setCountdownRemaining(dur);
  }

  function skipPomodoroStage() {
    if (pomodoroStage === 'work') {
      setPomodoroStage('break');
      setCountdownDuration(300);
      setCountdownRemaining(300);
    } else {
      setPomodoroStage('work');
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
