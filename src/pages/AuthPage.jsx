import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, ShieldCheck, Lock, User } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function AuthPage() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      await login({ identifier: username, password });
      navigate('/prospects');
    } catch (err) {
      setError(err.message || 'Terjadi kesalahan saat autentikasi.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="notion-auth-wrapper">
      <div className="notion-auth-card">
        {/* Workspace Logo & Heading */}
        <div className="text-center mb-4">
          <div
            className="notion-workspace-badge mx-auto mb-3"
            style={{
              width: '42px',
              height: '42px',
              fontSize: '19px',
              borderRadius: '8px',
            }}
          >
            A
          </div>
          <h1
            className="fw-bold mb-1"
            style={{ fontSize: '22px', letterSpacing: '-0.02em' }}
          >
            A-Tier Team CRM
          </h1>
          <p className="text-muted mb-0" style={{ fontSize: '13px' }}>
            Portal Internal Tim Hunting Prospek, Stopwatch &amp; Keuangan Deal
          </p>
        </div>

        {error && (
          <div
            className="alert alert-danger py-2 px-3 mb-3 d-flex align-items-center gap-2"
            style={{ fontSize: '12.5px' }}
          >
            <span className="flex-grow-1">{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="mb-3">
            <label
              className="form-label fw-medium mb-1 d-flex align-items-center gap-1"
              style={{ fontSize: '12.5px' }}
            >
              <User size={13} className="text-muted" />
              <span>Username atau Email</span>
            </label>
            <input
              type="text"
              className="notion-input w-100"
              placeholder="Contoh: leo_syafiq atau rina_hunter"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoFocus
            />
          </div>

          <div className="mb-3">
            <label
              className="form-label fw-medium mb-1 d-flex align-items-center gap-1"
              style={{ fontSize: '12.5px' }}
            >
              <Lock size={13} className="text-muted" />
              <span>Password</span>
            </label>
            <input
              type="password"
              className="notion-input w-100"
              placeholder="Masukkan password Anda"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={4}
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="btn-notion-primary w-100 justify-content-center py-2 mt-2"
          >
            <span>
              {submitting ? 'Memverifikasi...' : 'Masuk ke Dashboard'}
            </span>
            <ArrowRight size={15} />
          </button>
        </form>

        <div
          className="mt-4 pt-3 border-top"
          style={{ borderColor: 'var(--notion-border)' }}
        >
          <div
            className="d-flex align-items-start gap-2 p-2 rounded-2"
            style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', fontSize: '11.5px', color: '#475569' }}
          >
            <ShieldCheck size={16} className="text-primary flex-shrink-0 mt-0.5" />
            <div>
              <strong>Akses Khusus Internal:</strong> Akun tim baru didaftarkan langsung oleh Admin Studio melalui Command Center. Hubungi Admin jika Anda belum memiliki akun.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
