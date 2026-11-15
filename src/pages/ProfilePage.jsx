import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AtSign,
  KeyRound,
  ShieldCheck,
  Save,
  Trash2,
  CheckCircle2,
  Wallet,
  Award,
  ArrowUpRight,
  Clock,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useProspects } from '../context/ProspectsContext';
import {
  formatRupiah,
  formatUSD,
  formatCurrency,
  calculateCommission,
  getStudioSettings,
} from '../lib/supabase';

export default function ProfilePage() {
  const { user, profile, updateCredentials, deleteAccount } = useAuth();
  const { prospects } = useProspects();
  const navigate = useNavigate();

  const [studioRateTick, setStudioRateTick] = useState(() =>
    getStudioSettings().hunterRate
  );
  const [username, setUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [role, setRole] = useState('user');
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    function handleSettingsUpdated(e) {
      setStudioRateTick(
        e.detail?.hunterRate ?? getStudioSettings().hunterRate
      );
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
    if (profile) {
      setUsername(profile.username || '');
      setRole(profile.role || 'user');
    }
  }, [profile]);

  // Deals closed by logged in user
  const userDeals = useMemo(() => {
    if (!profile?.username && !user?.id) return [];
    const myUname = (profile?.username || '').toLowerCase();
    return prospects.filter(
      (p) =>
        p.status === 'Deal' &&
        ((user?.id && p.user_id === user.id) ||
          (myUname && (p.created_by_username || '').toLowerCase() === myUname))
    );
  }, [prospects, profile?.username, user?.id]);

  const myEffectiveRate =
    typeof profile?.customCommissionRate === 'number'
      ? profile.customCommissionRate
      : studioRateTick;
  const myEffectiveRatePct = Math.round(myEffectiveRate * 100);

  const commissionSummary = useMemo(() => {
    let earnedIdr = 0;
    let earnedUsd = 0;
    let paidIdr = 0;
    let paidUsd = 0;
    let pendingIdr = 0;
    let pendingUsd = 0;

    userDeals.forEach((d) => {
      const isUsd = (d.currency || 'IDR') === 'USD';
      const comm = calculateCommission(
        d,
        d.commission?.hunter_rate ?? myEffectiveRate
      );
      const isPaid = d.commission?.status === 'paid';

      if (isUsd) {
        earnedUsd += comm.hunterAmount;
        if (isPaid) paidUsd += comm.hunterAmount;
        else pendingUsd += comm.hunterAmount;
      } else {
        earnedIdr += comm.hunterAmount;
        if (isPaid) paidIdr += comm.hunterAmount;
        else pendingIdr += comm.hunterAmount;
      }
    });

    return { earnedIdr, earnedUsd, paidIdr, paidUsd, pendingIdr, pendingUsd };
  }, [userDeals, myEffectiveRate]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSavedSuccess(false);

    if (!username.trim()) {
      setError('Username tidak boleh kosong.');
      return;
    }

    setSaving(true);
    try {
      await updateCredentials({
        username: username.trim(),
        newPassword: newPassword.trim(),
        role: profile?.role === 'admin' ? role : profile?.role,
      });
      setNewPassword('');
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (err) {
      setError(err.message || 'Gagal memperbarui username & password.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteMyAccount() {
    await deleteAccount();
    navigate('/auth');
  }

  return (
    <div style={{ maxWidth: '640px' }}>
      <div className="mb-4">
        <h1 className="notion-page-title">Profile &amp; Komisi Saya</h1>
        <p className="notion-page-subtitle">
          Pengaturan akun, ganti password, dan rekap perolehan komisi hasil closing klien web design.
        </p>
      </div>

      {/* Account Info Card */}
      <div className="notion-card mb-4">
        <div
          className="d-flex align-items-center gap-3 pb-3 mb-4 border-bottom"
          style={{ borderColor: 'var(--notion-border)' }}
        >
          <div
            className="notion-workspace-badge"
            style={{
              width: '48px',
              height: '48px',
              fontSize: '18px',
              borderRadius: '10px',
            }}
          >
            {(username || 'U').slice(0, 2).toUpperCase()}
          </div>
          <div>
            <div className="fw-bold" style={{ fontSize: '18px' }}>
              @{username || 'user'}
            </div>
            <div className="text-muted" style={{ fontSize: '12.5px' }}>
              <span className="notion-pill status-dihubungi">
                Role: {(role || 'user').toUpperCase()}
              </span>
            </div>
          </div>
        </div>

        {savedSuccess && (
          <div
            className="d-flex align-items-center gap-2 p-2 px-3 rounded mb-3"
            style={{
              backgroundColor: '#dcfce7',
              color: '#166534',
              fontSize: '13px',
            }}
          >
            <CheckCircle2 size={15} />
            <span>Username / Password berhasil diperbarui!</span>
          </div>
        )}

        {error && (
          <div
            className="alert alert-danger py-2 px-3 mb-3"
            style={{ fontSize: '12.5px' }}
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Username CRUD */}
          <div className="mb-3">
            <label
              className="form-label fw-medium d-flex align-items-center gap-2 mb-1"
              style={{ fontSize: '13px' }}
            >
              <AtSign size={15} className="text-muted" />
              <span>Username</span>
            </label>
            <input
              type="text"
              className="notion-input w-100"
              placeholder="Contoh: leo_syafiq / rina_hunter"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
            <div className="text-muted mt-1" style={{ fontSize: '11.5px' }}>
              Username ini muncul pada kolom <strong>Ditambahkan Oleh</strong> di
              tabel prospek dan pada leaderboard tim.
            </div>
          </div>

          {/* Password CRUD */}
          <div className="mb-3">
            <label
              className="form-label fw-medium d-flex align-items-center gap-2 mb-1"
              style={{ fontSize: '13px' }}
            >
              <KeyRound size={15} className="text-muted" />
              <span>Password Baru</span>
            </label>
            <input
              type="password"
              className="notion-input w-100"
              placeholder="Kosongkan jika tidak ingin mengganti password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              minLength={4}
            />
          </div>

          {/* Role Display / Switcher */}
          <div className="mb-4">
            <label
              className="form-label fw-medium d-flex align-items-center gap-2 mb-1"
              style={{ fontSize: '13px' }}
            >
              <ShieldCheck size={15} className="text-muted" />
              <span>Role Akses Tim</span>
            </label>
            {profile?.role === 'admin' ? (
              <select
                className="notion-select w-100"
                value={role}
                onChange={(e) => setRole(e.target.value)}
              >
                <option value="admin">Admin (Pemilik / Leader)</option>
                <option value="user">Anggota Tim (User)</option>
              </select>
            ) : (
              <div
                className="p-2 px-3 rounded bg-light border d-flex align-items-center justify-content-between"
                style={{ fontSize: '12.5px' }}
              >
                <span className="fw-semibold text-dark">
                  Anggota Tim / Sales Hunter
                </span>
                <span className="text-muted" style={{ fontSize: '11px' }}>
                  🔒 Hak akses diatur oleh Admin
                </span>
              </div>
            )}
          </div>

          <div
            className="d-flex align-items-center justify-content-between pt-3 border-top"
            style={{ borderColor: 'var(--notion-border)' }}
          >
            {!confirmDelete ? (
              <button
                type="button"
                className="btn btn-sm text-danger d-inline-flex align-items-center gap-1 px-2 py-1"
                onClick={() => setConfirmDelete(true)}
              >
                <Trash2 size={14} />
                <span>Hapus Akun</span>
              </button>
            ) : (
              <div className="d-flex align-items-center gap-2">
                <button
                  type="button"
                  className="btn btn-sm btn-danger py-1 px-2"
                  style={{ fontSize: '12px' }}
                  onClick={handleDeleteMyAccount}
                >
                  Ya, Hapus Akun Saya
                </button>
                <button
                  type="button"
                  className="btn-notion-outline py-1 px-2"
                  style={{ fontSize: '12px' }}
                  onClick={() => setConfirmDelete(false)}
                >
                  Batal
                </button>
              </div>
            )}

            <button
              type="submit"
              disabled={saving}
              className="btn-notion-primary"
            >
              <Save size={15} />
              <span>{saving ? 'Menyimpan...' : 'Simpan Perubahan'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* SECTION: JENJANG KARIR, TARGET PERSONAL & EVALUASI ADMIN */}
      <div className="notion-card mb-4">
        <div className="d-flex align-items-center justify-content-between mb-3">
          <div className="d-flex align-items-center gap-2">
            <Award size={18} className="text-primary" />
            <h2 className="fw-bold mb-0" style={{ fontSize: '16px' }}>
              Jenjang Karir, Target Personal &amp; Evaluasi Admin
            </h2>
          </div>
          <span
            className={`badge rounded-pill px-2 py-1 ${
              profile?.status === 'inactive'
                ? 'bg-danger-subtle text-danger border border-danger-subtle'
                : 'bg-success-subtle text-success border border-success-subtle'
            }`}
            style={{ fontSize: '11px' }}
          >
            {profile?.status === 'inactive' ? '● Nonaktif / Cuti' : '● Status Aktif'}
          </span>
        </div>

        <div className="row g-2 mb-3">
          <div className="col-6 col-sm-3">
            <div className="p-2 rounded bg-light border text-center h-100">
              <div className="text-muted" style={{ fontSize: '11px' }}>
                Jenjang Karir
              </div>
              <div className="fw-bold text-primary mt-1" style={{ fontSize: '13px' }}>
                {profile?.tier || 'Junior Hunter'}
              </div>
            </div>
          </div>

          <div className="col-6 col-sm-3">
            <div className="p-2 rounded bg-light border text-center h-100">
              <div className="text-muted" style={{ fontSize: '11px' }}>
                Target Jam/Hari
              </div>
              <div className="fw-bold mt-1" style={{ fontSize: '13px' }}>
                {profile?.targetDailyHours || 3} Jam
              </div>
            </div>
          </div>

          <div className="col-6 col-sm-3">
            <div className="p-2 rounded bg-light border text-center h-100">
              <div className="text-muted" style={{ fontSize: '11px' }}>
                Target Prospek
              </div>
              <div className="fw-bold mt-1" style={{ fontSize: '13px' }}>
                {profile?.targetDailyProspects || 10} / hari
              </div>
            </div>
          </div>

          <div className="col-6 col-sm-3">
            <div className="p-2 rounded bg-light border text-center h-100">
              <div className="text-muted" style={{ fontSize: '11px' }}>
                Rate Komisi
              </div>
              <div className="fw-bold text-success mt-1" style={{ fontSize: '13px' }}>
                {myEffectiveRatePct}%
              </div>
            </div>
          </div>
        </div>

        <div
          className="p-3 rounded border"
          style={{ backgroundColor: '#fafaf9', fontSize: '12.5px' }}
        >
          <div className="fw-semibold text-dark mb-1">
            Catatan Evaluasi &amp; Arahan Admin:
          </div>
          <div className="text-muted">
            {profile?.evaluationNotes
              ? profile.evaluationNotes
              : 'Belum ada catatan evaluasi berkala dari Admin.'}
          </div>
        </div>
      </div>

      {/* SECTION: KOMISI & INCENTIVE TRACKER USER */}
      <div className="notion-card mb-4">
        <div className="d-flex align-items-center justify-content-between mb-3">
          <div className="d-flex align-items-center gap-2">
            <Wallet size={18} className="text-success" />
            <h2 className="fw-bold mb-0" style={{ fontSize: '16px' }}>
              Komisi &amp; Bagi Hasil Closing Saya
            </h2>
          </div>
          <span className="notion-pill status-deal">Rate {myEffectiveRatePct}%</span>
        </div>
        <p className="text-muted mb-3" style={{ fontSize: '12px' }}>
          Estimasi hak komisi sales hunter ({myEffectiveRatePct}% dari uang masuk) untuk setiap klien deal yang Anda dapatkan.
        </p>

        {/* Summary Badges */}
        <div className="row g-2 mb-3">
          <div className="col-6 col-sm-4">
            <div className="p-2 rounded bg-light border text-center">
              <div className="text-muted" style={{ fontSize: '11px' }}>
                Total Komisi Didapat
              </div>
              <div className="fw-bold text-success" style={{ fontSize: '14px' }}>
                {formatRupiah(commissionSummary.earnedIdr)}
              </div>
              {commissionSummary.earnedUsd > 0 && (
                <div className="text-primary fw-semibold" style={{ fontSize: '12px' }}>
                  + {formatUSD(commissionSummary.earnedUsd)}
                </div>
              )}
            </div>
          </div>

          <div className="col-6 col-sm-4">
            <div className="p-2 rounded bg-light border text-center">
              <div className="text-muted" style={{ fontSize: '11px' }}>
                Siap Dicairkan (Pending)
              </div>
              <div className="fw-bold text-warning" style={{ fontSize: '14px' }}>
                {formatRupiah(commissionSummary.pendingIdr)}
              </div>
              {commissionSummary.pendingUsd > 0 && (
                <div className="text-warning fw-semibold" style={{ fontSize: '12px' }}>
                  + {formatUSD(commissionSummary.pendingUsd)}
                </div>
              )}
            </div>
          </div>

          <div className="col-12 col-sm-4">
            <div className="p-2 rounded bg-light border text-center">
              <div className="text-muted" style={{ fontSize: '11px' }}>
                Sudah Ditransfer
              </div>
              <div className="fw-bold text-muted" style={{ fontSize: '14px' }}>
                {formatRupiah(commissionSummary.paidIdr)}
              </div>
              {commissionSummary.paidUsd > 0 && (
                <div className="text-muted fw-semibold" style={{ fontSize: '12px' }}>
                  + {formatUSD(commissionSummary.paidUsd)}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* List of User's Deals & Fee */}
        {userDeals.length === 0 ? (
          <div className="text-center py-3 text-muted" style={{ fontSize: '12.5px' }}>
            Anda belum memiliki klien deal. Tambahkan prospek dan ubah statusnya menjadi <strong>Deal</strong> untuk mulai menghasilkan komisi.
          </div>
        ) : (
          <div className="border rounded overflow-hidden">
            <table className="table table-sm mb-0 align-middle" style={{ fontSize: '12px' }}>
              <thead className="table-light">
                <tr>
                  <th>Klien Deal</th>
                  <th style={{ textAlign: 'right' }}>Nilai DP</th>
                  <th style={{ textAlign: 'right' }}>Hak Komisi (15%)</th>
                  <th style={{ width: '110px', textAlign: 'center' }}>Status Payout</th>
                </tr>
              </thead>
              <tbody>
                {userDeals.map((deal) => {
                  const curr = deal.currency || 'IDR';
                  const comm = calculateCommission(deal);
                  const isPaid = deal.commission?.status === 'paid';

                  return (
                    <tr key={deal.id}>
                      <td>
                        <div className="fw-semibold">{deal.client_name}</div>
                        <div className="text-muted" style={{ fontSize: '10.5px' }}>
                          {deal.source_platform}
                        </div>
                      </td>
                      <td className="text-end fw-semibold">
                        {formatCurrency(comm.cashIn, curr)}
                      </td>
                      <td className="text-end fw-bold text-success">
                        {formatCurrency(comm.hunterAmount, curr)}
                      </td>
                      <td className="text-center">
                        <span
                          className={`badge rounded-pill ${
                            isPaid
                              ? 'bg-success text-white'
                              : 'bg-warning-subtle text-warning-emphasis border border-warning-subtle'
                          }`}
                          style={{ fontSize: '10.5px' }}
                        >
                          {isPaid ? 'Sudah Ditransfer' : 'Siap Dicairkan'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}