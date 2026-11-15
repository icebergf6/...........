import React, { useEffect, useMemo, useState } from 'react';
import {
  Trophy,
  Clock,
  Users,
  CheckCircle2,
  Wallet,
  Sparkles,
  Calendar,
  Award,
  MessageSquare,
  Layers,
  Swords,
  Target,
  RefreshCw,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useProspects } from '../context/ProspectsContext';
import { useAttendance } from '../context/AttendanceContext';
import {
  formatRupiah,
  formatUSD,
  formatDurationHMS,
  formatDurationHuman,
  getTodayDateString,
  getOffsetDateString,
  toLocalDateString,
  getStudioSettings,
  DELIVERY_CHECKLIST_ITEMS,
  calculateCommission,
} from '../lib/supabase';

const RANK_CATEGORIES = [
  {
    id: 'mvp',
    label: 'Skor MVP (Semua Fitur)',
    icon: Trophy,
    desc: 'Gabungan Jam Kerja, Prospek, Follow-Up, Deal, Uang Masuk & Delivery Web Live',
  },
  {
    id: 'revenue',
    label: 'Uang Masuk (IDR+USD)',
    icon: Wallet,
    desc: 'Diurutkan berdasarkan total DP & Pelunasan kontrak web design tertinggi',
  },
  {
    id: 'deals',
    label: 'Closing / Deal',
    icon: CheckCircle2,
    desc: 'Diurutkan berdasarkan jumlah klien yang berhasil closing (Deal)',
  },
  {
    id: 'prospects',
    label: 'Prospek Ditambahkan',
    icon: Users,
    desc: 'Diurutkan berdasarkan jumlah prospek baru yang diinput ke database tim',
  },
  {
    id: 'followup',
    label: 'Aktivitas Follow-Up',
    icon: MessageSquare,
    desc: 'Diurutkan berdasarkan total catatan interaksi / touchpoint follow-up klien',
  },
  {
    id: 'delivery',
    label: 'Web Live & Delivery',
    icon: Layers,
    desc: 'Diurutkan berdasarkan jumlah website Go-Live & rata-rata progres checklist proyek',
  },
  {
    id: 'hours',
    label: 'Jam Kerja Stopwatch',
    icon: Clock,
    desc: 'Diurutkan berdasarkan total durasi stopwatch & pencapaian target harian',
  },
];

const PERIOD_OPTIONS = [
  { id: 'ALL', label: 'Semua Waktu (All-Time)' },
  { id: 'MONTH', label: 'Bulan Ini' },
  { id: 'WEEK', label: '7 Hari Terakhir' },
  { id: 'TODAY', label: 'Hari Ini' },
];

export default function LeaderboardPage() {
  const { profile, teamUsers } = useAuth();
  const { allTeamProspects, prospects: fallbackProspects } = useProspects();
  const prospects = allTeamProspects || fallbackProspects;
  const { attendanceLogs, nowTick, calculateLiveSeconds } = useAttendance();

  const [studioSettings, setStudioSettings] = useState(() =>
    getStudioSettings()
  );
  const [category, setCategory] = useState('mvp');
  const [period, setPeriod] = useState('ALL');
  const [compareUserA, setCompareUserA] = useState('');
  const [compareUserB, setCompareUserB] = useState('');

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
  const sevenDaysAgoStr = getOffsetDateString(-6);
  const currentMonthPrefix = todayStr.slice(0, 7); // YYYY-MM
  const usdRate = Number(studioSettings.usdExchangeRate) || 16000;
  const targetHours = Number(studioSettings.dailyTargetHours) || 3;
  const targetSeconds = targetHours * 3600;

  function isDateInPeriod(dateStrOrIso) {
    if (period === 'ALL') return true;
    if (!dateStrOrIso) return false;
    const dStr = toLocalDateString(dateStrOrIso);
    if (!dStr) return false;
    if (period === 'TODAY') return dStr === todayStr;
    if (period === 'WEEK') return dStr >= sevenDaysAgoStr && dStr <= todayStr;
    if (period === 'MONTH') return dStr.startsWith(currentMonthPrefix);
    return true;
  }

  // Gather all known team members (including Admin-created teamUsers + logs + prospects + current profile)
  const allMembersMeta = useMemo(() => {
    const map = new Map();

    const addMember = (
      uname,
      id = null,
      role = 'user',
      extra = {}
    ) => {
      if (!uname || !uname.trim()) return;
      const clean = uname.trim();
      const lower = clean.toLowerCase();
      if (!map.has(lower)) {
        map.set(lower, {
          username: clean,
          id,
          role,
          tier: extra.tier || 'Junior Hunter',
          status: extra.status || 'active',
          targetDailyHours: extra.targetDailyHours,
          customCommissionRate: extra.customCommissionRate,
        });
      } else {
        const existing = map.get(lower);
        if (!existing.id && id) existing.id = id;
        if (role === 'admin') existing.role = 'admin';
        if (extra.tier) existing.tier = extra.tier;
        if (extra.status) existing.status = extra.status;
        if (extra.targetDailyHours !== undefined)
          existing.targetDailyHours = extra.targetDailyHours;
        if (extra.customCommissionRate !== undefined)
          existing.customCommissionRate = extra.customCommissionRate;
      }
    };

    (teamUsers || []).forEach((u) =>
      addMember(u.username, u.id, u.role, {
        tier: u.tier,
        status: u.status,
        targetDailyHours: u.targetDailyHours,
        customCommissionRate: u.customCommissionRate,
      })
    );
    attendanceLogs.forEach((l) => addMember(l.username, l.user_id));
    prospects.forEach((p) => {
      addMember(p.created_by_username, p.user_id);
      if (p.project_assignee) addMember(p.project_assignee);
    });
    if (profile?.username) {
      addMember(profile.username, profile.id, profile.role, {
        tier: profile.tier,
        status: profile.status,
        targetDailyHours: profile.targetDailyHours,
        customCommissionRate: profile.customCommissionRate,
      });
    }

    return Array.from(map.values());
  }, [teamUsers, attendanceLogs, prospects, profile]);

  // Compute fully integrated leaderboard rows across all CRM features
  const rankedMembers = useMemo(() => {
    const rows = allMembersMeta.map((meta) => {
      const uname = meta.username;
      const unameLower = uname.toLowerCase();
      const uid = meta.id;
      const memberTargetHours = Number(meta.targetDailyHours) || targetHours;
      const memberTargetSeconds = memberTargetHours * 3600;
      const memberCommRate =
        typeof meta.customCommissionRate === 'number'
          ? meta.customCommissionRate
          : studioSettings.hunterRate;

      const belongsToMember = (recordUserId, recordUsername) => {
        if (uid && recordUserId && recordUserId === uid) return true;
        return (recordUsername || '').trim().toLowerCase() === unameLower;
      };

      // 1. Attendance & Daily Target Achievement
      const userAttLogs = attendanceLogs.filter(
        (l) =>
          belongsToMember(l.user_id, l.username) && isDateInPeriod(l.work_date)
      );
      let totalSeconds = 0;
      let targetMetDays = 0;
      userAttLogs.forEach((l) => {
        const sec = calculateLiveSeconds(l, nowTick);
        totalSeconds += sec;
        if (sec >= memberTargetSeconds) targetMetDays += 1;
      });

      const todayLog = attendanceLogs.find(
        (l) =>
          belongsToMember(l.user_id, l.username) && l.work_date === todayStr
      );
      const isWorkingNow = todayLog?.status === 'running';
      const activeFocusTag = todayLog?.focus_tag || null;

      // 2. Prospects Added (Prospek yang ditolak Admin sebagai Data Palsu tidak dihitung ke skor!)
      const userProspects = prospects.filter(
        (p) =>
          belongsToMember(p.user_id, p.created_by_username) &&
          p.verification_status !== 'rejected' &&
          isDateInPeriod(p.created_at || todayStr)
      );
      const prospectsCount = userProspects.length;

      // 3. Follow-Up Touchpoints Authored across ALL prospects
      let followUpCount = 0;
      prospects.forEach((p) => {
        if (Array.isArray(p.follow_up_notes)) {
          p.follow_up_notes.forEach((tp) => {
            if (
              (tp.author || '').trim().toLowerCase() === unameLower &&
              isDateInPeriod(tp.date || p.created_at)
            ) {
              followUpCount += 1;
            }
          });
        }
      });

      // 4. Deals Closed, Cash In, Commission & Recurring Renewal Net Profit
      const userDeals = prospects.filter(
        (p) =>
          belongsToMember(p.user_id, p.created_by_username) &&
          p.status === 'Deal' &&
          p.verification_status !== 'rejected' &&
          isDateInPeriod(p.deal_date || p.created_at || todayStr)
      );
      const dealsCount = userDeals.length;

      let cashInIdr = 0;
      let cashInUsd = 0;
      let contractValueIdr = 0;
      let contractValueUsd = 0;
      let commissionIdr = 0;
      let commissionUsd = 0;
      let renewalNetIdr = 0;
      let renewalNetUsd = 0;

      userDeals.forEach((client) => {
        const isUsd = (client.currency || 'IDR') === 'USD';
        const val = Number(client.project_value) || 0;
        const currentDp = Number(client.dp_amount) || 0;
        const dp =
          client.payment_status === 'Lunas'
            ? val > 0
              ? val
              : currentDp
            : currentDp;
        const comm = calculateCommission(
          client,
          client.commission?.hunter_rate ?? memberCommRate
        );
        const rNet = Number(client.renewal_total_net_profit) || 0;

        if (isUsd) {
          cashInUsd += dp;
          contractValueUsd += val;
          commissionUsd += comm.hunterAmount;
          renewalNetUsd += rNet;
        } else {
          cashInIdr += dp;
          contractValueIdr += val;
          commissionIdr += comm.hunterAmount;
          renewalNetIdr += rNet;
        }
      });

      // 5. Delivery & Web Live Progress (termasuk proyek yang ditugaskan oleh Admin di Manajemen Project!)
      const involvedProjects = prospects.filter(
        (p) =>
          p.status === 'Deal' &&
          isDateInPeriod(p.deal_date || p.created_at || todayStr) &&
          (belongsToMember(p.user_id, p.created_by_username) ||
            (p.project_assignee || '').trim().toLowerCase() === unameLower)
      );
      let webLiveCount = 0;
      let totalChecklistPct = 0;
      involvedProjects.forEach((client) => {
        const checklist = client.delivery_assets?.checklist || {};
        const doneSteps = DELIVERY_CHECKLIST_ITEMS.filter(
          (item) => checklist[item.id]
        ).length;
        const pct = Math.round(
          (doneSteps / DELIVERY_CHECKLIST_ITEMS.length) * 100
        );
        totalChecklistPct += pct;
        if (
          client.project_status === 'completed' ||
          checklist.live ||
          client.delivery_assets?.live_url
        ) {
          webLiveCount += 1;
        }
      });

      const avgDeliveryPct =
        involvedProjects.length > 0
          ? Math.round(totalChecklistPct / involvedProjects.length)
          : 0;

      // Equivalent IDR using Admin-configured USD exchange rate
      const cashInEquivalent = cashInIdr + cashInUsd * usdRate;
      const contractValueEquivalent = contractValueIdr + contractValueUsd * usdRate;
      const renewalNetEquivalent = renewalNetIdr + renewalNetUsd * usdRate;
      const commissionEquivalent = commissionIdr + commissionUsd * usdRate;

      const closingRate =
        prospectsCount > 0
          ? Math.round((dealsCount / prospectsCount) * 100)
          : 0;

      // Upgraded MVP Composite Score integrating all CRM modules
      const hoursFloat = totalSeconds / 3600;
      const mvpScore = Math.round(
        hoursFloat * 15 +
          prospectsCount * 10 +
          followUpCount * 5 +
          dealsCount * 100 +
          (cashInEquivalent / 100000) * 5 +
          webLiveCount * 25
      );

      return {
        username: uname,
        role: meta.role,
        tier: meta.tier || 'Junior Hunter',
        targetHours: memberTargetHours,
        isCurrentUser:
          (profile?.username || '').toLowerCase() === unameLower,
        isWorkingNow,
        activeFocusTag,
        totalSeconds,
        targetMetDays,
        prospectsCount,
        followUpCount,
        dealsCount,
        closingRate,
        webLiveCount,
        avgDeliveryPct,
        cashIn: cashInEquivalent,
        cashInIdr,
        cashInUsd,
        contractValue: contractValueEquivalent,
        contractValueIdr,
        contractValueUsd,
        commissionIdr,
        commissionUsd,
        commissionEquivalent,
        renewalNetIdr,
        renewalNetUsd,
        renewalNetEquivalent,
        mvpScore,
      };
    });

    rows.sort((a, b) => {
      if (category === 'revenue') {
        if (b.cashIn !== a.cashIn) return b.cashIn - a.cashIn;
        return b.dealsCount - a.dealsCount;
      }
      if (category === 'deals') {
        if (b.dealsCount !== a.dealsCount) return b.dealsCount - a.dealsCount;
        return b.cashIn - a.cashIn;
      }
      if (category === 'prospects') {
        if (b.prospectsCount !== a.prospectsCount)
          return b.prospectsCount - a.prospectsCount;
        return b.dealsCount - a.dealsCount;
      }
      if (category === 'followup') {
        if (b.followUpCount !== a.followUpCount)
          return b.followUpCount - a.followUpCount;
        return b.prospectsCount - a.prospectsCount;
      }
      if (category === 'delivery') {
        if (b.webLiveCount !== a.webLiveCount)
          return b.webLiveCount - a.webLiveCount;
        return b.avgDeliveryPct - a.avgDeliveryPct;
      }
      if (category === 'hours') {
        if (b.totalSeconds !== a.totalSeconds)
          return b.totalSeconds - a.totalSeconds;
        return b.targetMetDays - a.targetMetDays;
      }
      if (b.mvpScore !== a.mvpScore) return b.mvpScore - a.mvpScore;
      return b.cashIn - a.cashIn;
    });

    return rows.map((item, idx) => ({
      ...item,
      rank: idx + 1,
    }));
  }, [
    allMembersMeta,
    attendanceLogs,
    prospects,
    period,
    category,
    nowTick,
    profile?.username,
    todayStr,
    usdRate,
    targetSeconds,
    studioSettings.hunterRate,
    calculateLiveSeconds,
  ]);

  // Auto-initialize Head-to-Head selectors with top 2 ranked members
  useEffect(() => {
    if (rankedMembers.length >= 1 && !compareUserA) {
      setCompareUserA(rankedMembers[0].username);
    }
    if (rankedMembers.length >= 2 && !compareUserB) {
      setCompareUserB(rankedMembers[1].username);
    } else if (rankedMembers.length === 1 && !compareUserB) {
      setCompareUserB(rankedMembers[0].username);
    }
  }, [rankedMembers, compareUserA, compareUserB]);

  const memberA =
    rankedMembers.find((m) => m.username === compareUserA) ||
    rankedMembers[0] ||
    null;
  const memberB =
    rankedMembers.find((m) => m.username === compareUserB) ||
    rankedMembers[1] ||
    rankedMembers[0] ||
    null;

  // Overall Team Totals across all modules
  const teamTotals = useMemo(() => {
    return rankedMembers.reduce(
      (acc, m) => ({
        totalSeconds: acc.totalSeconds + m.totalSeconds,
        prospectsCount: acc.prospectsCount + m.prospectsCount,
        followUpCount: acc.followUpCount + m.followUpCount,
        dealsCount: acc.dealsCount + m.dealsCount,
        webLiveCount: acc.webLiveCount + m.webLiveCount,
        cashInIdr: acc.cashInIdr + m.cashInIdr,
        cashInUsd: acc.cashInUsd + m.cashInUsd,
        renewalNetIdr: acc.renewalNetIdr + m.renewalNetIdr,
        renewalNetUsd: acc.renewalNetUsd + m.renewalNetUsd,
      }),
      {
        totalSeconds: 0,
        prospectsCount: 0,
        followUpCount: 0,
        dealsCount: 0,
        webLiveCount: 0,
        cashInIdr: 0,
        cashInUsd: 0,
        renewalNetIdr: 0,
        renewalNetUsd: 0,
      }
    );
  }, [rankedMembers]);

  const topThree = rankedMembers.slice(0, 3);

  function getMedalMeta(rank) {
    if (rank === 1) {
      return {
        emoji: '🥇',
        title: 'Juara 1',
        bg: '#fffbeb',
        border: '#fcd34d',
        badgeBg: '#fef3c7',
        badgeText: '#92400e',
      };
    }
    if (rank === 2) {
      return {
        emoji: '🥈',
        title: 'Juara 2',
        bg: '#f8fafc',
        border: '#cbd5e1',
        badgeBg: '#e2e8f0',
        badgeText: '#334155',
      };
    }
    return {
      emoji: '🥉',
      title: 'Juara 3',
      bg: '#fff7ed',
      border: '#fdba74',
      badgeBg: '#ffedd5',
      badgeText: '#9a3412',
    };
  }

  function renderHighlightedMetric(member) {
    if (category === 'revenue') {
      const parts = [];
      if (member.cashInIdr > 0 || member.cashInUsd === 0) {
        parts.push(formatRupiah(member.cashInIdr));
      }
      if (member.cashInUsd > 0) {
        parts.push(formatUSD(member.cashInUsd));
      }
      return {
        label: 'Total Uang Masuk',
        value: parts.join(' + '),
      };
    }
    if (category === 'deals') {
      return {
        label: 'Total Klien Deal',
        value: `${member.dealsCount} Klien (${member.closingRate}%)`,
      };
    }
    if (category === 'prospects') {
      return {
        label: 'Prospek Ditambahkan',
        value: `${member.prospectsCount} Prospek`,
      };
    }
    if (category === 'followup') {
      return {
        label: 'Aktivitas Follow-Up',
        value: `${member.followUpCount} Touchpoint`,
      };
    }
    if (category === 'delivery') {
      return {
        label: 'Website Go-Live',
        value: `${member.webLiveCount} Web (${member.avgDeliveryPct}% avg)`,
      };
    }
    if (category === 'hours') {
      return {
        label: 'Durasi Jam Kerja',
        value: formatDurationHMS(member.totalSeconds),
      };
    }
    return {
      label: 'Total Skor MVP',
      value: `${member.mvpScore.toLocaleString('id-ID')} Poin`,
    };
  }

  const activeCategoryMeta =
    RANK_CATEGORIES.find((c) => c.id === category) || RANK_CATEGORIES[0];

  const comparisonRows =
    memberA && memberB
      ? [
          {
            label: 'Skor MVP Keseluruhan',
            valA: memberA.mvpScore,
            valB: memberB.mvpScore,
            displayA: `${memberA.mvpScore.toLocaleString('id-ID')} pts`,
            displayB: `${memberB.mvpScore.toLocaleString('id-ID')} pts`,
          },
          {
            label: 'Jam Kerja Stopwatch',
            valA: memberA.totalSeconds,
            valB: memberB.totalSeconds,
            displayA: formatDurationHuman(memberA.totalSeconds),
            displayB: formatDurationHuman(memberB.totalSeconds),
          },
          {
            label: `Hari Capai Target (≥ ${targetHours}j)`,
            valA: memberA.targetMetDays,
            valB: memberB.targetMetDays,
            displayA: `${memberA.targetMetDays} hari`,
            displayB: `${memberB.targetMetDays} hari`,
          },
          {
            label: 'Prospek Baru Diinput',
            valA: memberA.prospectsCount,
            valB: memberB.prospectsCount,
            displayA: `${memberA.prospectsCount} prospek`,
            displayB: `${memberB.prospectsCount} prospek`,
          },
          {
            label: 'Aktivitas Follow-Up (Touchpoint)',
            valA: memberA.followUpCount,
            valB: memberB.followUpCount,
            displayA: `${memberA.followUpCount} interaksi`,
            displayB: `${memberB.followUpCount} interaksi`,
          },
          {
            label: 'Closing Deal & Win Rate',
            valA: memberA.dealsCount,
            valB: memberB.dealsCount,
            displayA: `${memberA.dealsCount} deal (${memberA.closingRate}%)`,
            displayB: `${memberB.dealsCount} deal (${memberB.closingRate}%)`,
          },
          {
            label: 'Website Go-Live & Progres Delivery',
            valA: memberA.webLiveCount * 100 + memberA.avgDeliveryPct,
            valB: memberB.webLiveCount * 100 + memberB.avgDeliveryPct,
            displayA: `${memberA.webLiveCount} Live (${memberA.avgDeliveryPct}%)`,
            displayB: `${memberB.webLiveCount} Live (${memberB.avgDeliveryPct}%)`,
          },
          {
            label: 'Uang Masuk Kontrak (IDR + USD)',
            valA: memberA.cashIn,
            valB: memberB.cashIn,
            displayA: `${formatRupiah(memberA.cashInIdr)}${
              memberA.cashInUsd > 0 ? ' + ' + formatUSD(memberA.cashInUsd) : ''
            }`,
            displayB: `${formatRupiah(memberB.cashInIdr)}${
              memberB.cashInUsd > 0 ? ' + ' + formatUSD(memberB.cashInUsd) : ''
            }`,
          },
          {
            label: 'Komisi Hunter Diperoleh',
            valA: memberA.commissionEquivalent,
            valB: memberB.commissionEquivalent,
            displayA: `${formatRupiah(memberA.commissionIdr)}${
              memberA.commissionUsd > 0
                ? ' + ' + formatUSD(memberA.commissionUsd)
                : ''
            }`,
            displayB: `${formatRupiah(memberB.commissionIdr)}${
              memberB.commissionUsd > 0
                ? ' + ' + formatUSD(memberB.commissionUsd)
                : ''
            }`,
          },
          {
            label: 'Laba Recurring Domain/Hosting Klien',
            valA: memberA.renewalNetEquivalent,
            valB: memberB.renewalNetEquivalent,
            displayA: `${formatRupiah(memberA.renewalNetIdr)}${
              memberA.renewalNetUsd > 0
                ? ' + ' + formatUSD(memberA.renewalNetUsd)
                : ''
            }`,
            displayB: `${formatRupiah(memberB.renewalNetIdr)}${
              memberB.renewalNetUsd > 0
                ? ' + ' + formatUSD(memberB.renewalNetUsd)
                : ''
            }`,
          },
        ]
      : [];

  return (
    <div>
      {/* Header */}
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-4">
        <div>
          <div className="d-flex align-items-center gap-2 mb-1">
            <h1 className="notion-page-title mb-0">
              Leaderboard &amp; Komparasi Tim
            </h1>
            <span className="notion-pill status-deal">● Live Update</span>
          </div>
          <p className="notion-page-subtitle">
            Perbandingan performa lintas semua fitur: Jam Kerja Stopwatch,
            Prospek, Follow-Up, Closing Deal, Uang Masuk (IDR/USD), Delivery
            Website &amp; Pendapatan Berulang (Kurs referensi Rp{' '}
            {usdRate.toLocaleString('id-ID')}/USD).
          </p>
        </div>

        {/* Period Filter */}
        <div className="d-flex align-items-center gap-2">
          <Calendar size={15} className="text-muted" />
          <select
            className="notion-select fw-medium"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
          >
            {PERIOD_OPTIONS.map((opt) => (
              <option key={opt.id} value={opt.id}>
                Periode: {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Team-Wide Integrated Summary Strip */}
      <div className="row g-3 mb-4">
        <div className="col-6 col-lg-3">
          <div className="notion-card">
            <div className="notion-stat-label">
              <Clock size={14} className="text-primary" />
              <span>Total Jam Kerja Tim</span>
            </div>
            <div className="notion-stat-value" style={{ fontSize: '19px' }}>
              {formatDurationHuman(teamTotals.totalSeconds)}
            </div>
            <div className="text-muted mt-1" style={{ fontSize: '11.5px' }}>
              {rankedMembers.length} anggota aktif • Target {targetHours}j/hari
            </div>
          </div>
        </div>

        <div className="col-6 col-lg-3">
          <div className="notion-card">
            <div className="notion-stat-label">
              <Users size={14} className="text-info" />
              <span>Hunting &amp; Follow-Up</span>
            </div>
            <div className="notion-stat-value" style={{ fontSize: '19px' }}>
              {teamTotals.prospectsCount}{' '}
              <span className="text-muted fw-normal" style={{ fontSize: '13px' }}>
                Prospek
              </span>
            </div>
            <div className="text-muted mt-1" style={{ fontSize: '11.5px' }}>
              {teamTotals.followUpCount} catatan touchpoint &amp; {teamTotals.dealsCount} Deal
            </div>
          </div>
        </div>

        <div className="col-6 col-lg-3">
          <div
            className="notion-card"
            style={{ backgroundColor: '#f4fbf7', borderColor: '#bbf7d0' }}
          >
            <div className="notion-stat-label" style={{ color: '#166534' }}>
              <Wallet size={14} />
              <span>Uang Masuk Tim (Kontrak)</span>
            </div>
            <div
              className="notion-stat-value"
              style={{ color: '#166534', fontSize: '18px' }}
            >
              {formatRupiah(teamTotals.cashInIdr)}
            </div>
            <div className="fw-semibold text-success" style={{ fontSize: '12px' }}>
              + {formatUSD(teamTotals.cashInUsd)}
            </div>
          </div>
        </div>

        <div className="col-6 col-lg-3">
          <div className="notion-card">
            <div className="notion-stat-label">
              <RefreshCw size={14} className="text-success" />
              <span>Delivery &amp; Laba Perpanjangan</span>
            </div>
            <div className="notion-stat-value" style={{ fontSize: '19px' }}>
              {teamTotals.webLiveCount}{' '}
              <span className="text-muted fw-normal" style={{ fontSize: '13px' }}>
                Web Live
              </span>
            </div>
            <div className="text-muted mt-1" style={{ fontSize: '11.5px' }}>
              Recurring: {formatRupiah(teamTotals.renewalNetIdr)} +{' '}
              {formatUSD(teamTotals.renewalNetUsd)}
            </div>
          </div>
        </div>
      </div>

      {/* Category Switcher Tabs (7 Integrated Categories) */}
      <div
        className="d-flex flex-wrap gap-2 p-2 rounded-3 mb-4"
        style={{
          backgroundColor: '#f7f7f5',
          border: '1px solid var(--notion-border)',
        }}
      >
        {RANK_CATEGORIES.map((cat) => {
          const IconComp = cat.icon;
          const isActive = category === cat.id;
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => setCategory(cat.id)}
              className="btn btn-sm d-inline-flex align-items-center gap-2 px-3 py-2 rounded-2 border-0"
              style={{
                backgroundColor: isActive ? '#2f2f2f' : 'transparent',
                color: isActive ? '#ffffff' : 'var(--notion-text)',
                fontWeight: isActive ? 600 : 500,
                fontSize: '12.5px',
                transition: 'all 0.12s ease',
              }}
            >
              <IconComp size={14} />
              <span>{cat.label}</span>
            </button>
          );
        })}
      </div>

      {/* Top 3 Podium Cards */}
      <div className="row g-3 mb-4">
        {topThree.length === 0 ? (
          <div className="col-12">
            <div className="notion-card text-center py-4 text-muted">
              Belum ada data aktivitas kerja anggota tim yang tercatat pada
              periode ini.
            </div>
          </div>
        ) : (
          topThree.map((member) => {
            const medal = getMedalMeta(member.rank);
            const highlight = renderHighlightedMetric(member);

            return (
              <div className="col-md-4" key={member.username}>
                <div
                  className="notion-card h-100 d-flex flex-column justify-content-between"
                  style={{
                    backgroundColor: medal.bg,
                    borderColor: medal.border,
                  }}
                >
                  <div>
                    <div className="d-flex align-items-center justify-content-between mb-3">
                      <span
                        className="notion-pill fw-bold"
                        style={{
                          backgroundColor: medal.badgeBg,
                          color: medal.badgeText,
                          fontSize: '12.5px',
                        }}
                      >
                        {medal.emoji} {medal.title}
                      </span>

                      {member.isWorkingNow && (
                        <span
                          className="notion-pill status-deal"
                          style={{ fontSize: '11px' }}
                        >
                          ● {member.activeFocusTag || 'Sedang Kerja'}
                        </span>
                      )}
                    </div>

                    {/* Member Identity */}
                    <div className="d-flex align-items-center gap-2 mb-3">
                      <div
                        className="notion-workspace-badge"
                        style={{
                          width: '36px',
                          height: '36px',
                          fontSize: '14px',
                          borderRadius: '8px',
                        }}
                      >
                        {member.username.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div
                          className="fw-bold d-flex align-items-center gap-2"
                          style={{ fontSize: '16px' }}
                        >
                          <span>@{member.username}</span>
                          {member.isCurrentUser && (
                            <span
                              className="notion-pill pill-gmaps"
                              style={{ fontSize: '10.5px', padding: '1px 6px' }}
                            >
                              Anda
                            </span>
                          )}
                        </div>
                        <div className="d-flex flex-wrap align-items-center gap-1 mt-1">
                          <span
                            className="badge bg-light text-primary border"
                            style={{ fontSize: '10px' }}
                          >
                            {member.tier || 'Junior Hunter'}
                          </span>
                        </div>
                        <div className="text-muted" style={{ fontSize: '12px' }}>
                          {highlight.label}:{' '}
                          <strong style={{ color: 'var(--notion-text)' }}>
                            {highlight.value}
                          </strong>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Mini 6 Metrics Breakdown */}
                  <div
                    className="row g-2 pt-3 border-top"
                    style={{
                      borderColor: 'rgba(0,0,0,0.08)',
                      fontSize: '11.5px',
                    }}
                  >
                    <div className="col-6">
                      <div className="text-muted">Jam Kerja</div>
                      <div
                        className="fw-semibold"
                        style={{ fontVariantNumeric: 'tabular-nums' }}
                      >
                        {formatDurationHuman(member.totalSeconds)}
                      </div>
                    </div>
                    <div className="col-6">
                      <div className="text-muted">Prospek &amp; Follow-Up</div>
                      <div className="fw-semibold">
                        {member.prospectsCount} pros · {member.followUpCount} fu
                      </div>
                    </div>
                    <div className="col-6">
                      <div className="text-muted">Closing &amp; Delivery</div>
                      <div className="fw-semibold text-success">
                        {member.dealsCount} deal ({member.webLiveCount} live)
                      </div>
                    </div>
                    <div className="col-6">
                      <div className="text-muted">Uang Masuk</div>
                      <div className="fw-semibold" style={{ color: '#166534' }}>
                        {formatRupiah(member.cashInIdr)}
                        {member.cashInUsd > 0
                          ? ` + ${formatUSD(member.cashInUsd)}`
                          : ''}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Arena Head-to-Head Comparison Section */}
      {rankedMembers.length >= 2 && memberA && memberB && (
        <div className="notion-card mb-4">
          <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3 pb-2 border-bottom">
            <div className="d-flex align-items-center gap-2">
              <Swords size={16} className="text-primary" />
              <span className="fw-bold" style={{ fontSize: '14.5px' }}>
                Arena Komparasi Head-to-Head (Semua Fitur)
              </span>
            </div>

            <div className="d-flex flex-wrap align-items-center gap-2">
              <select
                className="notion-select fw-semibold"
                value={memberA.username}
                onChange={(e) => setCompareUserA(e.target.value)}
              >
                {rankedMembers.map((m) => (
                  <option key={m.username} value={m.username}>
                    @{m.username} (#{m.rank})
                  </option>
                ))}
              </select>

              <span className="fw-bold text-muted" style={{ fontSize: '12px' }}>
                VS
              </span>

              <select
                className="notion-select fw-semibold"
                value={memberB.username}
                onChange={(e) => setCompareUserB(e.target.value)}
              >
                {rankedMembers.map((m) => (
                  <option key={m.username} value={m.username}>
                    @{m.username} (#{m.rank})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="table-responsive">
            <table className="table table-sm align-middle mb-0" style={{ fontSize: '12.5px' }}>
              <thead className="table-light">
                <tr>
                  <th style={{ width: '34%' }}>Metrik Perbandingan</th>
                  <th style={{ width: '33%', textAlign: 'right' }}>
                    @{memberA.username}
                  </th>
                  <th style={{ width: '33%', textAlign: 'left' }}>
                    @{memberB.username}
                  </th>
                </tr>
              </thead>
              <tbody>
                {comparisonRows.map((row) => {
                  const aWins = row.valA > row.valB;
                  const bWins = row.valB > row.valA;
                  return (
                    <tr key={row.label}>
                      <td className="text-muted fw-medium">{row.label}</td>
                      <td
                        className={`text-end ${
                          aWins ? 'fw-bold text-success' : ''
                        }`}
                      >
                        {aWins && <span className="me-1">🏆</span>}
                        {row.displayA}
                      </td>
                      <td
                        className={`text-start ${
                          bWins ? 'fw-bold text-success' : ''
                        }`}
                      >
                        {row.displayB}
                        {bWins && <span className="ms-1">🏆</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Full Leaderboard Table */}
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-2">
        <div
          className="fw-bold d-flex align-items-center gap-2"
          style={{ fontSize: '15px' }}
        >
          <Award size={16} />
          <span>Peringkat Lengkap Seluruh Anggota Tim</span>
        </div>
        <div className="text-muted" style={{ fontSize: '12px' }}>
          {activeCategoryMeta.desc}
        </div>
      </div>

      <div className="notion-table-wrapper mb-4">
        <div className="table-responsive">
          <table className="notion-table">
            <thead>
              <tr>
                <th style={{ width: '80px', textAlign: 'center' }}>Rank</th>
                <th style={{ minWidth: '175px' }}>Anggota Tim</th>
                <th style={{ minWidth: '150px' }}>Jam Kerja &amp; Target</th>
                <th style={{ minWidth: '135px' }}>Prospek &amp; Follow-Up</th>
                <th style={{ minWidth: '140px' }}>Deal &amp; Delivery</th>
                <th style={{ minWidth: '165px' }}>Uang Masuk &amp; Komisi</th>
                <th style={{ minWidth: '120px', textAlign: 'right' }}>
                  Skor MVP
                </th>
              </tr>
            </thead>
            <tbody>
              {rankedMembers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-5 text-muted">
                    Belum ada data aktivitas kerja anggota tim yang tercatat
                    pada periode ini.
                  </td>
                </tr>
              ) : (
                rankedMembers.map((member) => {
                  const rankBadge =
                    member.rank === 1
                      ? '🥇 #1'
                      : member.rank === 2
                      ? '🥈 #2'
                      : member.rank === 3
                      ? '🥉 #3'
                      : `#${member.rank}`;

                  return (
                    <tr
                      key={member.username}
                      className={member.isCurrentUser ? 'selected-row' : ''}
                      style={{ cursor: 'default' }}
                    >
                      <td className="text-center fw-bold">{rankBadge}</td>
                      <td>
                        <div className="d-flex flex-wrap align-items-center gap-1">
                          <span className="fw-semibold">@{member.username}</span>
                          <span
                            className="badge bg-light text-primary border"
                            style={{ fontSize: '10px' }}
                          >
                            {member.tier || 'Junior Hunter'}
                          </span>
                          {member.isCurrentUser && (
                            <span
                              className="notion-pill pill-gmaps"
                              style={{ fontSize: '10.5px', padding: '1px 6px' }}
                            >
                              Anda
                            </span>
                          )}
                          {member.isWorkingNow && (
                            <span
                              className="notion-pill status-deal"
                              style={{ fontSize: '10.5px', padding: '1px 6px' }}
                            >
                              ● Live: {member.activeFocusTag || 'Kerja'}
                            </span>
                          )}
                        </div>
                      </td>
                      <td>
                        <div
                          className="fw-bold"
                          style={{ fontVariantNumeric: 'tabular-nums' }}
                        >
                          {formatDurationHMS(member.totalSeconds)}
                        </div>
                        <div className="text-muted" style={{ fontSize: '11px' }}>
                          {member.targetMetDays} hari capai target (≥{member.targetHours}j)
                        </div>
                      </td>
                      <td>
                        <div>
                          <span className="notion-pill pill-gmaps">
                            {member.prospectsCount} prospek
                          </span>
                        </div>
                        <div className="text-muted mt-1" style={{ fontSize: '11px' }}>
                          {member.followUpCount} follow-up dicatat
                        </div>
                      </td>
                      <td>
                        <div>
                          <span className="notion-pill status-deal">
                            {member.dealsCount} deal ({member.closingRate}%)
                          </span>
                        </div>
                        <div className="text-muted mt-1" style={{ fontSize: '11px' }}>
                          {member.webLiveCount} Web Live · {member.avgDeliveryPct}% prog
                        </div>
                      </td>
                      <td>
                        <div className="fw-bold" style={{ color: '#166534' }}>
                          {member.cashInIdr > 0 || member.cashInUsd === 0
                            ? formatRupiah(member.cashInIdr)
                            : null}
                          {member.cashInIdr > 0 && member.cashInUsd > 0
                            ? ' + '
                            : null}
                          {member.cashInUsd > 0 ? (
                            <span className="text-success ms-1">
                              {formatUSD(member.cashInUsd)}
                            </span>
                          ) : null}
                        </div>
                        <div className="text-muted" style={{ fontSize: '11px' }}>
                          Komisi: {formatRupiah(member.commissionIdr)}
                          {member.commissionUsd > 0
                            ? ` + ${formatUSD(member.commissionUsd)}`
                            : ''}
                        </div>
                      </td>
                      <td className="text-end">
                        <span className="notion-pill status-negosiasi fw-bold">
                          <Sparkles size={12} />
                          <span>
                            {member.mvpScore.toLocaleString('id-ID')} pts
                          </span>
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

      {/* Scoring Guide Footer */}
      <div className="notion-card" style={{ backgroundColor: '#fbfbfa' }}>
        <div className="fw-semibold mb-1" style={{ fontSize: '13px' }}>
          Cara Perhitungan Skor MVP Leaderboard (Terintegrasi Semua Fitur)
        </div>
        <div className="text-muted" style={{ fontSize: '12.5px' }}>
          Setiap anggota tim mendapatkan poin otomatis dari seluruh aktivitas
          CRM: <strong>+15 poin</strong> per 1 jam kerja stopwatch,{' '}
          <strong>+10 poin</strong> per prospek baru,{' '}
          <strong>+5 poin</strong> per catatan interaksi follow-up,{' '}
          <strong>+100 poin</strong> per klien Deal,{' '}
          <strong>+5 poin</strong> per Rp 100.000 uang masuk (DP/Lunas,
          termasuk konversi USD), dan <strong>+25 poin</strong> untuk setiap
          proyek website yang selesai <strong>Go-Live</strong>.
        </div>
      </div>
    </div>
  );
}
