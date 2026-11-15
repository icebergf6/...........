import React, { createContext, useContext, useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import {
  supabase,
  supabaseUrl,
  supabaseAnonKey,
  isSupabaseConfigured,
  syncStudioSettingsFromSupabase,
} from '../lib/supabase';

const AuthContext = createContext(null);

const LOCAL_SESSION_KEY = 'atier_crm_session_v2';
const LOCAL_USERS_KEY = 'atier_crm_users_v2';

const DEFAULT_DEMO_USERS = [];

export function normalizeProfile(raw, fallbackAuthUser = null) {
  if (!raw && !fallbackAuthUser) return null;
  const base = raw || {};
  const email = base.email || fallbackAuthUser?.email || '';
  const username =
    base.username ||
    base.full_name ||
    fallbackAuthUser?.user_metadata?.username ||
    email.split('@')[0] ||
    'anggota_tim';

  const targetHours =
    base.targetDailyHours ??
    base.target_daily_hours ??
    3;
  const targetProspects =
    base.targetDailyProspects ??
    base.target_daily_prospects ??
    10;
  const commRate =
    base.customCommissionRate ??
    base.custom_commission_rate ??
    0.15;
  const evalNotes =
    base.evaluationNotes ??
    base.evaluation_notes ??
    '';

  const parsedTargetHours = Number(targetHours);
  const resolvedTargetHours =
    !isNaN(parsedTargetHours) && parsedTargetHours >= 0 ? parsedTargetHours : 3;

  const parsedTargetProspects = Number(targetProspects);
  const resolvedTargetProspects =
    !isNaN(parsedTargetProspects) && parsedTargetProspects >= 0
      ? parsedTargetProspects
      : 10;

  const parsedCommRate = Number(commRate);
  const resolvedCommRate =
    !isNaN(parsedCommRate) && parsedCommRate >= 0 ? parsedCommRate : 0.15;

  let rawStatus = base.status || 'active';
  let suspendedUntil = base.suspended_until || base.suspendedUntil || null;

  // Auto-reaktivasi: jika masa skorsing sudah berakhir, kembalikan status ke active
  if (rawStatus === 'suspended' && suspendedUntil) {
    const expiryTime = new Date(suspendedUntil).getTime();
    if (!isNaN(expiryTime) && expiryTime <= Date.now()) {
      rawStatus = 'active';
      suspendedUntil = null;
    }
  }

  return {
    ...base,
    id: base.id || fallbackAuthUser?.id,
    username: String(username).trim().toLowerCase().replace(/\s+/g, '_'),
    email,
    role: base.role === 'admin' ? 'admin' : 'user',
    status: rawStatus,
    suspended_until: suspendedUntil,
    suspendedUntil,
    tier: base.tier || (base.role === 'admin' ? 'Core Partner' : 'Junior Hunter'),
    targetDailyHours: resolvedTargetHours,
    target_daily_hours: resolvedTargetHours,
    targetDailyProspects: resolvedTargetProspects,
    target_daily_prospects: resolvedTargetProspects,
    customCommissionRate: resolvedCommRate,
    custom_commission_rate: resolvedCommRate,
    evaluationNotes: evalNotes,
    evaluation_notes: evalNotes,
    created_at: base.created_at || new Date().toISOString(),
  };
}

function getInitialLocalUsers() {
  try {
    const raw = localStorage.getItem(LOCAL_USERS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.map((u) => ({
          ...u,
          profile: normalizeProfile(u.profile, u.user),
        }));
      }
    }
  } catch {
    // ignore
  }
  return DEFAULT_DEMO_USERS;
}

function findMatchingLocalUser(usersList, sessionUser, sessionProfile) {
  if (!Array.isArray(usersList)) return null;
  const targetId = sessionUser?.id || sessionProfile?.id;
  const targetUname = (sessionProfile?.username || '').toLowerCase();
  const targetEmail = (
    sessionProfile?.email ||
    sessionUser?.email ||
    ''
  ).toLowerCase();
  return usersList.find(
    (u) =>
      (targetId && u.user?.id === targetId) ||
      (targetUname &&
        (u.profile?.username || '').toLowerCase() === targetUname) ||
      (targetEmail && (u.email || '').toLowerCase() === targetEmail)
  );
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [teamUsers, setTeamUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isSupabaseConfigured && supabase) {
      // Bersihkan sisa cache dummy lokal lama agar murni menggunakan Supabase
      localStorage.removeItem(LOCAL_SESSION_KEY);
      localStorage.removeItem(LOCAL_USERS_KEY);
      localStorage.removeItem('atier_crm_shared_prospects_v2');
      localStorage.removeItem('atier_crm_payment_accounts_v1');
      localStorage.removeItem('atier_crm_attendance_logs_v1');

      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session?.user) {
          setUser(session.user);
          fetchSupabaseProfile(session.user);
          loadTeamProfiles();
          syncStudioSettingsFromSupabase();
        } else {
          setLoading(false);
        }
      });

      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((_event, session) => {
        if (session?.user) {
          setUser(session.user);
          fetchSupabaseProfile(session.user);
          loadTeamProfiles();
          syncStudioSettingsFromSupabase();
        } else {
          setUser(null);
          setProfile(null);
          setTeamUsers([]);
          setLoading(false);
        }
      });

      const profilesChannel = supabase
        .channel('public:profiles_and_settings_live')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'profiles' },
          () => {
            loadTeamProfiles();
            supabase.auth.getSession().then(({ data: { session } }) => {
              if (session?.user) {
                fetchSupabaseProfile(session.user);
              }
            });
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'studio_settings' },
          () => {
            syncStudioSettingsFromSupabase();
          }
        )
        .subscribe();

      return () => {
        subscription.unsubscribe();
        supabase.removeChannel(profilesChannel);
      };
    } else {
      const initialUsers = getInitialLocalUsers();
      setTeamUsers(initialUsers.map((u) => u.profile));

      const savedSession = localStorage.getItem(LOCAL_SESSION_KEY);
      if (savedSession) {
        try {
          const parsed = JSON.parse(savedSession);
          const matchedUser = findMatchingLocalUser(
            initialUsers,
            parsed.user,
            parsed.profile
          );
          if (matchedUser && matchedUser.profile?.status !== 'inactive') {
            const syncedProfile = normalizeProfile({
              ...parsed.profile,
              ...matchedUser.profile,
            });
            localStorage.setItem(
              LOCAL_SESSION_KEY,
              JSON.stringify({ user: matchedUser.user, profile: syncedProfile })
            );
            setUser(matchedUser.user);
            setProfile(syncedProfile);
          } else {
            localStorage.removeItem(LOCAL_SESSION_KEY);
            setUser(null);
            setProfile(null);
          }
        } catch (err) {
          console.error('Failed to parse local session', err);
        }
      }
      setLoading(false);

      function handleAuthStorageSync(e) {
        if (e.key === LOCAL_USERS_KEY) {
          const freshUsers = getInitialLocalUsers();
          setTeamUsers(freshUsers.map((u) => u.profile));
          const currSessionRaw = localStorage.getItem(LOCAL_SESSION_KEY);
          if (currSessionRaw) {
            try {
              const currParsed = JSON.parse(currSessionRaw);
              const matched = findMatchingLocalUser(
                freshUsers,
                currParsed.user,
                currParsed.profile
              );
              if (!matched || matched.profile?.status === 'inactive') {
                localStorage.removeItem(LOCAL_SESSION_KEY);
                setUser(null);
                setProfile(null);
              } else {
                const syncedProfile = normalizeProfile({
                  ...currParsed.profile,
                  ...matched.profile,
                });
                localStorage.setItem(
                  LOCAL_SESSION_KEY,
                  JSON.stringify({ user: matched.user, profile: syncedProfile })
                );
                setUser(matched.user);
                setProfile(syncedProfile);
              }
            } catch {
              // ignore
            }
          }
        } else if (e.key === LOCAL_SESSION_KEY) {
          if (!e.newValue) {
            setUser(null);
            setProfile(null);
          } else {
            try {
              const nextSess = JSON.parse(e.newValue);
              setUser(nextSess.user || null);
              setProfile(normalizeProfile(nextSess.profile, nextSess.user));
            } catch {
              // ignore
            }
          }
        }
      }

      window.addEventListener('storage', handleAuthStorageSync);
      return () => window.removeEventListener('storage', handleAuthStorageSync);
    }
  }, []);

  async function loadTeamProfiles() {
    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .order('created_at', { ascending: true });
        if (!error && data) {
          setTeamUsers(data.map((row) => normalizeProfile(row)));
        }
      } catch (e) {
        console.error('Error loading team profiles:', e);
      }
    } else {
      const stored = getInitialLocalUsers();
      setTeamUsers(stored.map((u) => u.profile));
    }
  }

  async function fetchSupabaseProfile(authUser) {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authUser.id)
        .single();

      if (error || !data) {
        const fallbackProfile = normalizeProfile(null, authUser);
        setProfile(fallbackProfile);
      } else {
        const normalized = normalizeProfile(data, authUser);
        if (normalized.status === 'banned') {
          await supabase.auth.signOut();
          setUser(null);
          setProfile(null);
          return;
        }
        if (normalized.status === 'suspended') {
          await supabase.auth.signOut();
          setUser(null);
          setProfile(null);
          return;
        }
        if (normalized.status === 'inactive') {
          await supabase.auth.signOut();
          setUser(null);
          setProfile(null);
          return;
        }
        if (data.status === 'suspended' && normalized.status === 'active') {
          await supabase
            .from('profiles')
            .update({
              status: 'active',
              suspended_until: null,
              updated_at: new Date().toISOString(),
            })
            .eq('id', authUser.id);
        }
        setProfile(normalized);
      }
    } catch (err) {
      console.error('Error fetching profile:', err);
    } finally {
      setLoading(false);
    }
  }

  async function register({ username, email, password }) {
    const cleanUsername = (username || email.split('@')[0])
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '_');

    const safeRole = 'user';

    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            username: cleanUsername,
            role: safeRole,
          },
        },
      });
      if (error) throw error;

      // Jika auto-confirm aktif namun session belum otomatis terbuka, login otomatis
      if (!data.session && data.user) {
        await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
      }

      await loadTeamProfiles();
      return data;
    }

    const storedUsers = getInitialLocalUsers();
    const existing = storedUsers.find(
      (u) =>
        u.email.toLowerCase() === email.toLowerCase() ||
        (u.profile?.username || '').toLowerCase() === cleanUsername
    );
    if (existing) {
      throw new Error(
        'Username atau Email sudah terdaftar. Silakan langsung masuk (Login).'
      );
    }

    const isFirstAccount = storedUsers.length === 0 || cleanUsername === 'leo_syafiq';
    const assignedRole = isFirstAccount ? 'admin' : safeRole;
    const assignedTier = isFirstAccount ? 'Core Partner' : 'Junior Hunter';

    const newUserId = 'user-' + Date.now();
    const newUser = { id: newUserId, email };
    const newProfile = normalizeProfile({
      id: newUserId,
      username: cleanUsername,
      email,
      role: assignedRole,
      status: 'active',
      tier: assignedTier,
      targetDailyHours: 6,
      targetDailyProspects: 10,
      customCommissionRate: 0.15,
      evaluationNotes: '',
      created_at: new Date().toISOString(),
    });

    const nextUsers = [
      ...storedUsers,
      { email, password, user: newUser, profile: newProfile },
    ];
    localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(nextUsers));
    setTeamUsers(nextUsers.map((u) => u.profile));
    localStorage.setItem(
      LOCAL_SESSION_KEY,
      JSON.stringify({ user: newUser, profile: newProfile })
    );
    setUser(newUser);
    setProfile(newProfile);
    return { user: newUser, profile: newProfile };
  }

  async function login({ identifier, password }) {
    const cleanInput = (identifier || '').trim();
    const cleanLower = cleanInput.toLowerCase();

    if (isSupabaseConfigured && supabase) {
      let targetEmail = cleanInput;

      // Jika input berupa username (tanpa @), cari email melalui RPC database
      if (!cleanInput.includes('@')) {
        const { data: resolvedEmail, error: rpcErr } = await supabase.rpc(
          'get_email_by_username',
          { lookup_username: cleanLower }
        );
        if (!rpcErr && resolvedEmail) {
          targetEmail = resolvedEmail;
        } else {
          throw new Error(
            `Username @${cleanLower} belum terdaftar. Silakan buat akun di tab Buat Akun Tim atau masuk menggunakan alamat Email.`
          );
        }
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email: targetEmail,
        password,
      });
      if (error) throw error;

      if (data?.user) {
        const { data: profData } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', data.user.id)
          .single();

        if (profData) {
          if (profData.status === 'banned') {
            await supabase.auth.signOut();
            throw new Error(
              'Akun Anda telah di-ban secara permanen oleh Admin karena pelanggaran operasional studio. Hubungi Admin jika ini adalah kekeliruan.'
            );
          }

          if (profData.status === 'inactive') {
            await supabase.auth.signOut();
            throw new Error(
              'Akun Anda sedang dinonaktifkan (Nonaktif/Alumni) oleh Admin. Hubungi Admin untuk aktivasi.'
            );
          }

          if (profData.status === 'suspended' || profData.suspended_until) {
            const expiryTime = profData.suspended_until
              ? new Date(profData.suspended_until).getTime()
              : NaN;
            const now = Date.now();

            if (!isNaN(expiryTime) && expiryTime <= now) {
              // Auto-reaktivasi: masa skorsing telah berakhir secara otomatis!
              await supabase
                .from('profiles')
                .update({
                  status: 'active',
                  suspended_until: null,
                  updated_at: new Date().toISOString(),
                })
                .eq('id', data.user.id);
            } else {
              // Masih dalam masa penangguhan
              await supabase.auth.signOut();
              const dateStr = !isNaN(expiryTime)
                ? new Date(expiryTime).toLocaleString('id-ID', {
                    dateStyle: 'full',
                    timeStyle: 'short',
                  })
                : 'waktu yang ditentukan';
              const remainingHours = !isNaN(expiryTime)
                ? Math.max(1, Math.ceil((expiryTime - now) / (1000 * 60 * 60)))
                : null;
              const remainingInfo = remainingHours
                ? ` (Sisa sekitar ${remainingHours} jam)`
                : '';
              const notes = profData.evaluation_notes
                ? ` Alasan: "${profData.evaluation_notes}".`
                : '';
              throw new Error(
                `Akun Anda sedang dinonaktifkan sementara oleh Admin hingga ${dateStr}${remainingInfo}.${notes} Akun akan pulih dan dapat diakses kembali secara otomatis setelah masa tenggat berakhir.`
              );
            }
          }
        }
      }
      return data;
    }

    const storedUsers = getInitialLocalUsers();
    const matchedByIdentity = storedUsers.find(
      (u) =>
        u.email.toLowerCase() === cleanLower ||
        (u.profile?.username || '').toLowerCase() === cleanLower
    );

    if (!matchedByIdentity) {
      throw new Error(
        'Username atau Email belum terdaftar. Silakan klik tab Buat Akun Tim terlebih dahulu.'
      );
    }

    if (matchedByIdentity.profile?.status === 'banned') {
      throw new Error(
        'Akun Anda telah di-ban secara permanen oleh Admin karena pelanggaran operasional studio. Hubungi Admin jika ini adalah kekeliruan.'
      );
    }

    if (matchedByIdentity.profile?.status === 'inactive') {
      throw new Error(
        'Akun Anda sedang dinonaktifkan (Nonaktif/Alumni) oleh Admin. Hubungi Admin untuk aktivasi.'
      );
    }

    if (
      matchedByIdentity.profile?.status === 'suspended' ||
      matchedByIdentity.profile?.suspended_until
    ) {
      const expiryTime = matchedByIdentity.profile.suspended_until
        ? new Date(matchedByIdentity.profile.suspended_until).getTime()
        : NaN;
      const now = Date.now();

      if (!isNaN(expiryTime) && expiryTime <= now) {
        // Auto-reaktivasi lokal
        matchedByIdentity.profile.status = 'active';
        matchedByIdentity.profile.suspended_until = null;
        matchedByIdentity.profile.suspendedUntil = null;
        localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(storedUsers));
        setTeamUsers(storedUsers.map((u) => u.profile));
      } else {
        const dateStr = !isNaN(expiryTime)
          ? new Date(expiryTime).toLocaleString('id-ID', {
              dateStyle: 'full',
              timeStyle: 'short',
            })
          : 'waktu yang ditentukan';
        const remainingHours = !isNaN(expiryTime)
          ? Math.max(1, Math.ceil((expiryTime - now) / (1000 * 60 * 60)))
          : null;
        const remainingInfo = remainingHours
          ? ` (Sisa sekitar ${remainingHours} jam)`
          : '';
        const notes = matchedByIdentity.profile?.evaluationNotes
          ? ` Alasan: "${matchedByIdentity.profile.evaluationNotes}".`
          : '';
        throw new Error(
          `Akun Anda sedang dinonaktifkan sementara oleh Admin hingga ${dateStr}${remainingInfo}.${notes} Akun akan pulih dan dapat diakses kembali secara otomatis setelah masa tenggat berakhir.`
        );
      }
    }

    if (matchedByIdentity.password !== password) {
      throw new Error('Password yang Anda masukkan salah.');
    }

    localStorage.setItem(
      LOCAL_SESSION_KEY,
      JSON.stringify({
        user: matchedByIdentity.user,
        profile: matchedByIdentity.profile,
      })
    );
    setUser(matchedByIdentity.user);
    setProfile(matchedByIdentity.profile);
    return matchedByIdentity;
  }

  async function updateCredentials({ username, newPassword, role }) {
    if (!profile) return;

    const cleanUsername = (username || profile.username || 'user')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '_');

    const nextRole =
      profile.role === 'admin' ? role || profile.role : profile.role || 'user';
    const nextProfile = normalizeProfile({
      ...profile,
      username: cleanUsername,
      role: nextRole,
      updated_at: new Date().toISOString(),
    });

    if (isSupabaseConfigured && supabase && user) {
      if (newPassword && newPassword.trim().length > 0) {
        const { error: pwErr } = await supabase.auth.updateUser({
          password: newPassword.trim(),
        });
        if (pwErr) throw pwErr;
      }

      const { data, error } = await supabase
        .from('profiles')
        .update({
          username: cleanUsername,
          role: nextRole,
          updated_at: nextProfile.updated_at,
        })
        .eq('id', user.id)
        .select()
        .single();

      if (error) throw error;
      const normalized = normalizeProfile(data, user);
      setProfile(normalized);
      await loadTeamProfiles();
      return normalized;
    }

    setProfile(nextProfile);
    localStorage.setItem(
      LOCAL_SESSION_KEY,
      JSON.stringify({ user, profile: nextProfile })
    );

    const storedUsers = getInitialLocalUsers();
    const updatedUsers = storedUsers.map((u) => {
      if (u.user.id === user?.id) {
        return {
          ...u,
          password:
            newPassword && newPassword.trim().length > 0
              ? newPassword.trim()
              : u.password,
          profile: nextProfile,
        };
      }
      return u;
    });
    localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(updatedUsers));
    setTeamUsers(updatedUsers.map((u) => u.profile));
    return nextProfile;
  }

  // Admin: Create a new team member without logging out current admin
  async function adminCreateUser({ username, email, password, role = 'user' }) {
    if (profile?.role !== 'admin') {
      throw new Error(
        'Akses ditolak: Hanya Admin yang diizinkan menambah anggota tim.'
      );
    }

    const cleanUsername = (username || email.split('@')[0])
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '_');
    const cleanEmail =
      (email || '').trim() || `${cleanUsername}@atier-team.id`;

    if (isSupabaseConfigured && supabase) {
      const exists = teamUsers.some(
        (u) =>
          (u.username || '').toLowerCase() === cleanUsername ||
          (u.email || '').toLowerCase() === cleanEmail.toLowerCase()
      );
      if (exists) {
        throw new Error(`Username @${cleanUsername} atau email sudah digunakan.`);
      }

      const tempClient = createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
      });

      const { data: signUpData, error: signUpErr } = await tempClient.auth.signUp({
        email: cleanEmail,
        password: password || 'password123',
        options: {
          data: {
            username: cleanUsername,
            role: role || 'user',
          },
        },
      });

      if (signUpErr) throw signUpErr;

      if (signUpData?.user?.id) {
        await supabase
          .from('profiles')
          .update({
            username: cleanUsername,
            role: role === 'admin' ? 'admin' : 'user',
            tier: role === 'admin' ? 'Core Partner' : 'Junior Hunter',
            updated_at: new Date().toISOString(),
          })
          .eq('id', signUpData.user.id);
      }

      await loadTeamProfiles();
      return {
        id: signUpData?.user?.id,
        username: cleanUsername,
        email: cleanEmail,
        role: role || 'user',
      };
    }

    const storedUsers = getInitialLocalUsers();
    const exists = storedUsers.some(
      (u) =>
        (u.profile?.username || '').toLowerCase() === cleanUsername ||
        u.email.toLowerCase() === cleanEmail.toLowerCase()
    );
    if (exists) {
      throw new Error(`Username @${cleanUsername} atau email sudah digunakan.`);
    }

    const newId = 'user-' + Date.now();
    const newUser = { id: newId, email: cleanEmail };
    const newProfile = normalizeProfile({
      id: newId,
      username: cleanUsername,
      email: cleanEmail,
      role: role || 'user',
      created_at: new Date().toISOString(),
    });

    const nextUsers = [
      ...storedUsers,
      {
        email: cleanEmail,
        password: password || 'password123',
        user: newUser,
        profile: newProfile,
      },
    ];
    localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(nextUsers));
    setTeamUsers(nextUsers.map((u) => u.profile));
    return newProfile;
  }

  // Admin: Update another user's role, username, password, or lifecycle targets
  async function adminUpdateUser(targetIdOrUsername, updates) {
    if (profile?.role !== 'admin') {
      throw new Error(
        'Akses ditolak: Hanya Admin yang diizinkan mengubah data anggota.'
      );
    }

    const matched = teamUsers.find(
      (u) =>
        u.id === targetIdOrUsername ||
        (u.username || '').toLowerCase() ===
          String(targetIdOrUsername || '').toLowerCase()
    );
    const targetId = matched?.id || targetIdOrUsername;

    if (
      user &&
      (targetId === user.id ||
        (matched && matched.username === profile?.username)) &&
      (updates.status === 'banned' ||
        updates.status === 'suspended' ||
        updates.status === 'inactive')
    ) {
      throw new Error(
        'Akses ditolak: Anda tidak dapat menonaktifkan atau mem-ban akun Admin yang sedang Anda gunakan saat ini.'
      );
    }

    if (isSupabaseConfigured && supabase) {
      const dbPayload = {
        updated_at: new Date().toISOString(),
      };
      if (updates.username !== undefined) {
        dbPayload.username = updates.username
          .trim()
          .toLowerCase()
          .replace(/\s+/g, '_');
      }
      if (updates.role !== undefined) dbPayload.role = updates.role;
      if (updates.status !== undefined) dbPayload.status = updates.status;
      if (updates.suspended_until !== undefined) {
        dbPayload.suspended_until = updates.suspended_until;
      } else if (updates.status === 'active') {
        dbPayload.suspended_until = null;
      }
      if (updates.tier !== undefined) dbPayload.tier = updates.tier;
      if (updates.targetDailyHours !== undefined) {
        dbPayload.target_daily_hours = Number(updates.targetDailyHours) || 3;
      }
      if (updates.targetDailyProspects !== undefined) {
        dbPayload.target_daily_prospects =
          Number(updates.targetDailyProspects) || 10;
      }
      if (updates.customCommissionRate !== undefined) {
        dbPayload.custom_commission_rate =
          Number(updates.customCommissionRate) || 0.15;
      }
      if (updates.evaluationNotes !== undefined) {
        dbPayload.evaluation_notes = updates.evaluationNotes;
      }

      const { error } = await supabase
        .from('profiles')
        .update(dbPayload)
        .eq('id', targetId);
      if (error) throw error;

      if (updates.newPassword && updates.newPassword.trim()) {
        const { error: pwErr } = await supabase.rpc(
          'admin_reset_user_password',
          {
            target_user_id: targetId,
            new_password: updates.newPassword.trim(),
          }
        );
        if (pwErr) throw pwErr;
      }

      await loadTeamProfiles();
      if (user && targetId === user.id) {
        await fetchSupabaseProfile(user);
      }
      return;
    }

    const storedUsers = getInitialLocalUsers();
    const updatedUsers = storedUsers.map((u) => {
      const match =
        u.profile.id === targetIdOrUsername ||
        u.profile.username === targetIdOrUsername;
      if (!match) return u;

      const updatedProfile = normalizeProfile({
        ...u.profile,
        ...updates,
        username: updates.username
          ? updates.username.trim().toLowerCase().replace(/\s+/g, '_')
          : u.profile.username,
        role: updates.role || u.profile.role,
        status: updates.status || u.profile.status || 'active',
        suspended_until:
          updates.suspended_until !== undefined
            ? updates.suspended_until
            : updates.status === 'active'
            ? null
            : u.profile.suspended_until || null,
        tier: updates.tier || u.profile.tier || 'Junior Hunter',
        targetDailyHours:
          updates.targetDailyHours !== undefined
            ? Number(updates.targetDailyHours)
            : u.profile.targetDailyHours || 3,
        targetDailyProspects:
          updates.targetDailyProspects !== undefined
            ? Number(updates.targetDailyProspects)
            : u.profile.targetDailyProspects || 10,
        customCommissionRate:
          updates.customCommissionRate !== undefined
            ? Number(updates.customCommissionRate)
            : u.profile.customCommissionRate || 0.15,
        evaluationNotes:
          updates.evaluationNotes !== undefined
            ? updates.evaluationNotes
            : u.profile.evaluationNotes || '',
        updated_at: new Date().toISOString(),
      });

      if (user && u.user.id === user.id) {
        setProfile(updatedProfile);
        localStorage.setItem(
          LOCAL_SESSION_KEY,
          JSON.stringify({ user, profile: updatedProfile })
        );
      }

      return {
        ...u,
        password:
          updates.newPassword && updates.newPassword.trim()
            ? updates.newPassword.trim()
            : u.password,
        profile: updatedProfile,
      };
    });

    localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(updatedUsers));
    setTeamUsers(updatedUsers.map((u) => u.profile));
  }

  // Admin: Delete a team member account
  async function adminDeleteUser(targetIdOrUsername) {
    if (profile?.role !== 'admin') {
      throw new Error(
        'Akses ditolak: Hanya Admin yang diizinkan menghapus anggota tim.'
      );
    }

    const matched = teamUsers.find(
      (u) =>
        u.id === targetIdOrUsername ||
        (u.username || '').toLowerCase() ===
          String(targetIdOrUsername || '').toLowerCase()
    );
    const resolvedId = matched?.id || targetIdOrUsername;

    if (
      user &&
      (user.id === resolvedId ||
        user.id === targetIdOrUsername ||
        profile?.username === targetIdOrUsername)
    ) {
      throw new Error(
        'Anda tidak dapat menghapus akun Admin yang sedang Anda gunakan.'
      );
    }

    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase.rpc('admin_delete_user_account', {
        target_user_id: resolvedId,
      });
      if (error) {
        // Fallback delete from profiles if RPC not matched
        await supabase.from('profiles').delete().eq('id', resolvedId);
      }
      await loadTeamProfiles();
      return;
    }

    const storedUsers = getInitialLocalUsers();
    const filtered = storedUsers.filter(
      (u) =>
        u.profile.id !== targetIdOrUsername &&
        u.profile.username !== targetIdOrUsername
    );
    localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(filtered));
    setTeamUsers(filtered.map((u) => u.profile));
  }

  async function deleteAccount() {
    if (!user) return;
    if (isSupabaseConfigured && supabase) {
      await supabase.from('profiles').delete().eq('id', user.id);
      await supabase.auth.signOut();
    } else {
      const storedUsers = getInitialLocalUsers();
      const filtered = storedUsers.filter((u) => u.user.id !== user.id);
      localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(filtered));
      setTeamUsers(filtered.map((u) => u.profile));
    }
    localStorage.removeItem(LOCAL_SESSION_KEY);
    setUser(null);
    setProfile(null);
  }

  async function logout() {
    if (isSupabaseConfigured && supabase) {
      await supabase.auth.signOut();
    }
    localStorage.removeItem(LOCAL_SESSION_KEY);
    setUser(null);
    setProfile(null);
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        teamUsers,
        loading,
        isSupabaseConfigured,
        register,
        login,
        logout,
        updateCredentials,
        deleteAccount,
        adminCreateUser,
        adminUpdateUser,
        adminDeleteUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
