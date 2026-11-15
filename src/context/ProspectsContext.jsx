import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  supabase,
  isSupabaseConfigured,
  normalizeWhatsAppNumber,
} from '../lib/supabase';
import { useAuth } from './AuthContext';

const ProspectsContext = createContext(null);
const LOCAL_PROSPECTS_KEY = 'atier_crm_shared_prospects_v2';

function normalizeDeliveryAssets(assets) {
  if (!assets || typeof assets !== 'object') return null;
  const { checklist, ...restAssets } = assets;
  let nextChecklist = checklist;
  if (checklist && typeof checklist === 'object') {
    nextChecklist = {
      content: Boolean(checklist.content),
      wireframe: Boolean(checklist.wireframe),
      ui_design: Boolean(checklist.ui_design),
      code: Boolean(checklist.code),
      qc: Boolean(checklist.qc),
      live: Boolean(checklist.live),
    };
  }
  return {
    staging_url: restAssets.staging_url || '',
    live_url: restAssets.live_url || '',
    domain: restAssets.domain || '',
    credentials: restAssets.credentials || '',
    revision_count: Number(restAssets.revision_count) || 0,
    max_revisions: Number(restAssets.max_revisions) || 3,
    ...(nextChecklist ? { checklist: nextChecklist } : {}),
  };
}

function resolveManagementType(item) {
  if (
    item?.management_type === 'project_only' ||
    item?.management_type === 'full_managed'
  ) {
    return item.management_type;
  }
  if (item?.status === 'Deal' && item?.renewal_enabled === false) {
    return 'project_only';
  }
  return 'full_managed';
}

export function ProspectsProvider({ children }) {
  const { user, profile } = useAuth();
  const [allProspects, setAllProspects] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setAllProspects([]);
      setLoading(false);
      return;
    }
    loadProspects();

    // Live sync across accounts/tabs
    if (isSupabaseConfigured && supabase) {
      const channel = supabase
        .channel('public:prospects_live')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'prospects' },
          () => {
            loadProspects();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    } else {
      function handleStorageChange(e) {
        if (e.key === LOCAL_PROSPECTS_KEY && e.newValue) {
          try {
            setAllProspects(JSON.parse(e.newValue));
          } catch (err) {
            console.error('Failed to sync prospects from storage:', err);
          }
        }
      }
      window.addEventListener('storage', handleStorageChange);
      return () => window.removeEventListener('storage', handleStorageChange);
    }
  }, [user]);

  // Keep creator username in sync if the logged-in user updates their username
  useEffect(() => {
    if (!user || !profile?.username) return;
    setAllProspects((prev) => {
      const needsUpdate = prev.some(
        (item) =>
          item.user_id === user.id &&
          item.created_by_username !== profile.username
      );
      if (!needsUpdate) return prev;

      const updated = prev.map((item) =>
        item.user_id === user.id &&
        item.created_by_username !== profile.username
          ? { ...item, created_by_username: profile.username }
          : item
      );
      if (isSupabaseConfigured && supabase) {
        supabase
          .from('prospects')
          .update({ created_by_username: profile.username })
          .eq('user_id', user.id)
          .then(() => {});
      } else {
        localStorage.setItem(LOCAL_PROSPECTS_KEY, JSON.stringify(updated));
      }
      return updated;
    });
  }, [profile?.username, user]);

  async function loadProspects() {
    setLoading(true);
    try {
      if (isSupabaseConfigured && supabase && user) {
        const { data, error } = await supabase
          .from('prospects')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) throw error;
        setAllProspects(data || []);
      } else {
        const saved = localStorage.getItem(LOCAL_PROSPECTS_KEY);
        if (saved) {
          try {
            const parsed = JSON.parse(saved);
            const enriched = Array.isArray(parsed)
              ? parsed.map((item) => {
                  const managementType = resolveManagementType(item);
                  const isProjectOnly = managementType === 'project_only';
                  return {
                    ...item,
                    currency: item.currency || 'IDR',
                    management_type: managementType,
                    next_follow_up_date: item.next_follow_up_date || null,
                    follow_up_notes: item.follow_up_notes || [],
                    delivery_assets: normalizeDeliveryAssets(
                      item.delivery_assets || null
                    ),
                    commission: item.commission || null,
                    renewal_enabled: isProjectOnly
                      ? false
                      : Boolean(item.renewal_enabled),
                    renewal_cycle: item.renewal_cycle || 'Yearly',
                    renewal_service_name:
                      item.renewal_service_name ||
                      'Perpanjangan Domain & Cloud Hosting Tahunan',
                    renewal_price: Number(item.renewal_price) || 0,
                    renewal_cost: Number(item.renewal_cost) || 0,
                    renewal_due_date: item.renewal_due_date || null,
                    renewal_total_collected:
                      Number(item.renewal_total_collected) || 0,
                    renewal_total_net_profit:
                      Number(item.renewal_total_net_profit) || 0,
                    renewal_history: item.renewal_history || [],
                  };
                })
              : [];
            setAllProspects(enriched);
          } catch {
            setAllProspects([]);
          }
        } else {
          setAllProspects([]);
        }
      }
    } catch (err) {
      console.error('Error loading shared prospects:', err);
    } finally {
      setLoading(false);
    }
  }

  function persistLocal(nextList) {
    setAllProspects(nextList);
    localStorage.setItem(LOCAL_PROSPECTS_KEY, JSON.stringify(nextList));
  }

  async function addProspect(payload) {
    const isDeal = payload.status === 'Deal';
    const projectValue = Number(payload.project_value) || 0;
    const dpAmount =
      payload.payment_status === 'Lunas'
        ? projectValue
        : Number(payload.dp_amount) || 0;

    const creatorUsername =
      profile?.username || user?.email?.split('@')[0] || 'anggota_tim';

    const managementType =
      payload.management_type === 'project_only'
        ? 'project_only'
        : 'full_managed';
    const effectiveRenewalEnabled =
      managementType === 'project_only'
        ? false
        : payload.renewal_enabled ?? (isDeal ? true : false);

    const newRecord = {
      user_id: user?.id || null,
      created_by_username: creatorUsername,
      client_name: payload.client_name.trim(),
      source_platform: payload.source_platform || 'Google Maps',
      social_handle: (payload.social_handle || '').trim(),
      whatsapp_number: (payload.whatsapp_number || '').trim(),
      status: payload.status || 'Baru',
      management_type: managementType,
      notes: (payload.notes || '').trim(),
      currency: payload.currency || 'IDR',
      project_value: projectValue,
      dp_amount: dpAmount,
      payment_status:
        payload.payment_status || (dpAmount > 0 ? 'DP Masuk' : 'Belum DP'),
      deal_date: isDeal
        ? payload.deal_date || new Date().toISOString()
        : null,
      next_follow_up_date: payload.next_follow_up_date || null,
      follow_up_notes: payload.follow_up_notes || [],
      delivery_assets: normalizeDeliveryAssets(payload.delivery_assets || null),
      commission: payload.commission || null,
      renewal_enabled: effectiveRenewalEnabled,
      renewal_cycle: payload.renewal_cycle || 'Yearly',
      renewal_service_name:
        payload.renewal_service_name ||
        'Perpanjangan Domain & Cloud Hosting Tahunan',
      renewal_price: Number(payload.renewal_price) || 0,
      renewal_cost: Number(payload.renewal_cost) || 0,
      renewal_due_date: payload.renewal_due_date || null,
      renewal_total_collected: Number(payload.renewal_total_collected) || 0,
      renewal_total_net_profit: Number(payload.renewal_total_net_profit) || 0,
      renewal_history: Array.isArray(payload.renewal_history)
        ? payload.renewal_history
        : [],
      project_status: payload.project_status || 'briefing',
      project_assignee: payload.project_assignee || '',
      verification_status: payload.verification_status || 'pending',
      verification_notes: payload.verification_notes || '',
      verified_by: payload.verified_by || '',
      verified_at: payload.verified_at || null,
    };

    if (isSupabaseConfigured && supabase && user) {
      const { data, error } = await supabase
        .from('prospects')
        .insert([newRecord])
        .select()
        .single();

      if (error) throw error;
      setAllProspects((prev) => [data, ...prev]);
      return data;
    }

    const localRecord = {
      ...newRecord,
      id: 'prospect-' + Date.now(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const nextList = [localRecord, ...allProspects];
    persistLocal(nextList);
    return localRecord;
  }

  async function updateProspect(id, updates) {
    const existing = allProspects.find((p) => p.id === id);
    if (!existing) return null;

    const isAdmin = profile?.role === 'admin';
    const currentUsername = (profile?.username || '').trim().toLowerCase();
    const isOwner =
      (user?.id && existing.user_id === user.id) ||
      (currentUsername &&
        (existing.created_by_username || '').trim().toLowerCase() ===
          currentUsername);
    const isAssignee =
      currentUsername &&
      (existing.project_assignee || '').trim().toLowerCase() ===
        currentUsername;
    const isSharedDeal = existing.status === 'Deal';

    if (!isAdmin && !isOwner && !isAssignee && !isSharedDeal) {
      throw new Error(
        'Akses ditolak: Anda hanya dapat mengubah prospek milik Anda sendiri.'
      );
    }

    const merged = {
      ...existing,
      ...updates,
      updated_at: new Date().toISOString(),
    };

    merged.management_type =
      merged.management_type === 'project_only'
        ? 'project_only'
        : 'full_managed';

    if (updates.management_type === 'project_only') {
      merged.renewal_enabled = false;
    } else if (
      updates.management_type === 'full_managed' &&
      updates.renewal_enabled === undefined
    ) {
      merged.renewal_enabled = true;
    }

    if (merged.delivery_assets) {
      merged.delivery_assets = normalizeDeliveryAssets(merged.delivery_assets);
    }

    if (merged.status === 'Deal' && !merged.deal_date) {
      merged.deal_date = new Date().toISOString();
    }

    merged.project_value = Number(merged.project_value) || 0;
    if (merged.payment_status === 'Lunas' && merged.project_value > 0) {
      merged.dp_amount = merged.project_value;
    } else {
      merged.dp_amount = Number(merged.dp_amount) || 0;
    }

    if (isSupabaseConfigured && supabase && user) {
      const { data, error } = await supabase
        .from('prospects')
        .update({
          client_name: merged.client_name,
          source_platform: merged.source_platform,
          social_handle: merged.social_handle || '',
          whatsapp_number: merged.whatsapp_number || '',
          status: merged.status,
          management_type: merged.management_type,
          notes: merged.notes || '',
          currency: merged.currency || 'IDR',
          project_value: merged.project_value,
          dp_amount: merged.dp_amount,
          payment_status: merged.payment_status,
          deal_date: merged.deal_date || null,
          next_follow_up_date: merged.next_follow_up_date || null,
          follow_up_notes: Array.isArray(merged.follow_up_notes)
            ? merged.follow_up_notes
            : [],
          delivery_assets: merged.delivery_assets || {},
          commission: merged.commission || {},
          renewal_enabled: merged.renewal_enabled ?? false,
          renewal_cycle: merged.renewal_cycle || 'Yearly',
          renewal_service_name: merged.renewal_service_name || null,
          renewal_price: Number(merged.renewal_price) || 0,
          renewal_cost: Number(merged.renewal_cost) || 0,
          renewal_due_date: merged.renewal_due_date || null,
          renewal_total_collected:
            Number(merged.renewal_total_collected) || 0,
          renewal_total_net_profit:
            Number(merged.renewal_total_net_profit) || 0,
          renewal_history: Array.isArray(merged.renewal_history)
            ? merged.renewal_history
            : [],
          project_status: merged.project_status || 'briefing',
          project_assignee: merged.project_assignee || '',
          verification_status: merged.verification_status || 'pending',
          verification_notes:
            merged.verification_notes ?? merged.verification_note ?? '',
          verified_by: merged.verified_by || '',
          verified_at: merged.verified_at || null,
          updated_at: merged.updated_at,
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      setAllProspects((prev) =>
        prev.map((item) => (item.id === id ? data : item))
      );
      return data;
    }

    const nextList = allProspects.map((item) =>
      item.id === id ? merged : item
    );
    persistLocal(nextList);
    return merged;
  }

  async function deleteProspect(id) {
    const target = allProspects.find((p) => p.id === id);
    const isAdmin = profile?.role === 'admin';
    const currentUsername = (profile?.username || '').trim().toLowerCase();
    const isOwner =
      target &&
      ((user?.id && target.user_id === user.id) ||
        (currentUsername &&
          (target.created_by_username || '').trim().toLowerCase() ===
            currentUsername));
    if (target && !isAdmin && !isOwner) {
      throw new Error(
        'Akses ditolak: Hanya pembuat prospek atau Admin yang dapat menghapus data.'
      );
    }

    if (isSupabaseConfigured && supabase && user) {
      const { error } = await supabase.from('prospects').delete().eq('id', id);
      if (error) throw error;
      setAllProspects((prev) => prev.filter((item) => item.id !== id));
      return;
    }

    const nextList = allProspects.filter((item) => item.id !== id);
    persistLocal(nextList);
  }

  // Independent per-user prospects table for regular users; full team view for Admin
  const prospects = useMemo(() => {
    const effectiveRole = profile?.role || user?.user_metadata?.role || 'user';
    if (effectiveRole === 'admin') {
      return allProspects;
    }
    const myUserId = user?.id;
    const myUsername = (
      profile?.username ||
      user?.user_metadata?.username ||
      ''
    )
      .trim()
      .toLowerCase();
    return allProspects.filter((item) => {
      if (myUserId && item.user_id === myUserId) return true;
      if (
        myUsername &&
        (item.created_by_username || '').trim().toLowerCase() === myUsername
      ) {
        return true;
      }
      return false;
    });
  }, [
    allProspects,
    profile?.role,
    profile?.username,
    user?.id,
    user?.user_metadata?.role,
    user?.user_metadata?.username,
  ]);

  // Public/shared Deals across the studio (for /deals and /managed-hosting)
  const dealClients = useMemo(
    () => allProspects.filter((p) => p.status === 'Deal'),
    [allProspects]
  );

  // Privacy-safe duplicate detector across all team members when adding a new prospect
  function checkDuplicateProspect({
    clientName = '',
    whatsappNumber = '',
    socialHandle = '',
  }) {
    const normWa = normalizeWhatsAppNumber(whatsappNumber);
    const normName = clientName.trim().toLowerCase();
    const normHandle = socialHandle.trim().toLowerCase();

    if (!normWa && normName.length < 3 && normHandle.length < 3) {
      return null;
    }

    const myUserId = user?.id;
    const myUsername = (profile?.username || '').trim().toLowerCase();

    for (const item of allProspects) {
      const itemWa = normalizeWhatsAppNumber(item.whatsapp_number);
      const itemName = (item.client_name || '').trim().toLowerCase();
      const itemHandle = (item.social_handle || '').trim().toLowerCase();

      const matchWa = normWa.length >= 8 && itemWa === normWa;
      const matchName = normName.length >= 4 && itemName === normName;
      const matchHandle =
        normHandle.length >= 4 &&
        normHandle !== '-' &&
        itemHandle === normHandle;

      if (matchWa || matchName || matchHandle) {
        const isMine =
          (myUserId && item.user_id === myUserId) ||
          (myUsername &&
            (item.created_by_username || '').trim().toLowerCase() ===
              myUsername);
        return {
          isDuplicate: true,
          isMine,
          ownerUsername: item.created_by_username || 'anggota_tim',
          matchedField: matchWa
            ? 'Nomor WhatsApp'
            : matchHandle
            ? 'Akun Sosmed'
            : 'Nama Bisnis',
          status: item.status,
        };
      }
    }
    return null;
  }

  return (
    <ProspectsContext.Provider
      value={{
        prospects,
        allTeamProspects: allProspects,
        dealClients,
        loading,
        addProspect,
        updateProspect,
        deleteProspect,
        checkDuplicateProspect,
        refreshProspects: loadProspects,
      }}
    >
      {children}
    </ProspectsContext.Provider>
  );
}

export function useProspects() {
  const ctx = useContext(ProspectsContext);
  if (!ctx)
    throw new Error('useProspects must be used inside ProspectsProvider');
  return ctx;
}
