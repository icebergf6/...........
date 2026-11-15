import React, { useState } from 'react';
import {
  CreditCard,
  Plus,
  Copy,
  Check,
  Trash2,
  Globe,
  Landmark,
  Wallet,
  AlertCircle,
  ShieldCheck,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { usePaymentAccounts } from '../../context/PaymentAccountsContext';
import AddPaymentAccountModal from './AddPaymentAccountModal';

export default function PaymentAccountsList() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin';

  const {
    paymentAccounts,
    loading,
    isMaxAccounts,
    maxAccounts,
    deletePaymentAccount,
  } = usePaymentAccounts();

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [copiedId, setCopiedId] = useState(null);

  function handleCopy(account) {
    if (!account?.account_number) return;
    navigator.clipboard.writeText(account.account_number);
    setCopiedId(account.id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  async function handleDelete(account) {
    if (!isAdmin) {
      alert('Hanya Admin yang berwenang menghapus rekening pembayaran tim.');
      return;
    }
    if (
      window.confirm(
        `Hapus rekening ${account.provider_name} (${account.account_number})?`
      )
    ) {
      await deletePaymentAccount(account.id);
    }
  }

  function getProviderIcon(type) {
    if (type === 'international') return <Globe size={14} className="text-primary" />;
    if (type === 'ewallet') return <Wallet size={14} className="text-success" />;
    return <Landmark size={14} className="text-dark" />;
  }

  function getBadgePill(account) {
    if (account.provider_type === 'international') {
      return (
        <span
          className="notion-pill"
          style={{
            backgroundColor: '#e0f2fe',
            color: '#0369a1',
            fontSize: '11px',
            padding: '2px 7px',
          }}
        >
          Bank Luar (USD)
        </span>
      );
    }
    if (account.provider_type === 'ewallet') {
      return (
        <span
          className="notion-pill"
          style={{
            backgroundColor: '#dcfce7',
            color: '#166534',
            fontSize: '11px',
            padding: '2px 7px',
          }}
        >
          E-Wallet
        </span>
      );
    }
    return (
      <span
        className="notion-pill"
        style={{
          backgroundColor: '#f1f1ef',
          color: '#37352f',
          fontSize: '11px',
          padding: '2px 7px',
        }}
      >
        Bank Lokal (IDR)
      </span>
    );
  }

  return (
    <div className="mt-5 pt-3 border-top" style={{ borderColor: 'var(--notion-border)' }}>
      {/* Header & Capacity */}
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-3">
        <div>
          <div className="d-flex align-items-center gap-2">
            <CreditCard size={18} />
            <h2 className="fw-bold mb-0" style={{ fontSize: '18px' }}>
              Metode Pembayaran &amp; Rekening Tim
            </h2>
            <span
              className="notion-pill"
              style={{
                backgroundColor: isMaxAccounts ? '#fee2e2' : '#f1f1ef',
                color: isMaxAccounts ? '#991b1b' : '#37352f',
                fontSize: '11px',
                fontWeight: 600,
              }}
            >
              {paymentAccounts.length} / {maxAccounts} Akun
            </span>
          </div>
          <p className="notion-page-subtitle mt-1">
            Daftar rekening (PayPal luar negeri, SeaBank, bank lokal, e-wallet) yang
            diberikan ke klien untuk menerima DP dan pelunasan (Maksimal 10 akun).
          </p>
        </div>

        {isAdmin ? (
          <button
            type="button"
            disabled={isMaxAccounts}
            className="btn-notion-primary"
            onClick={() => setIsAddModalOpen(true)}
            title={
              isMaxAccounts
                ? `Batas maksimal ${maxAccounts} akun telah tercapai`
                : 'Tambah rekening baru'
            }
          >
            <Plus size={15} />
            <span>Tambah Rekening</span>
          </button>
        ) : (
          <span className="text-muted d-inline-flex align-items-center gap-1" style={{ fontSize: '11.5px' }}>
            <ShieldCheck size={13} className="text-primary" />
            <span>Rekening dikelola oleh Admin</span>
          </span>
        )}
      </div>

      {isMaxAccounts && (
        <div
          className="alert alert-warning py-2 px-3 mb-3 d-flex align-items-center gap-2"
          style={{ fontSize: '12.5px' }}
        >
          <AlertCircle size={15} />
          <span>
            Kapasitas penuh (10/10 rekening). Anda tidak dapat menambah rekening
            baru sebelum menghapus salah satu akun.
          </span>
        </div>
      )}

      {/* Grid of Payment Accounts */}
      <div className="row g-3">
        {loading ? (
          <div className="col-12 text-center py-4 text-muted">
            Memuat rekening pembayaran...
          </div>
        ) : paymentAccounts.length === 0 ? (
          <div className="col-12">
            <div className="notion-card text-center py-4">
              <div className="text-muted mb-2" style={{ fontSize: '13px' }}>
                Belum ada rekening pembayaran yang ditambahkan.
              </div>
              <button
                type="button"
                className="btn-notion-outline"
                onClick={() => setIsAddModalOpen(true)}
              >
                <Plus size={14} />
                <span>Tambah Rekening Pertama</span>
              </button>
            </div>
          </div>
        ) : (
          paymentAccounts.map((account) => {
            const isCopied = copiedId === account.id;

            return (
              <div className="col-md-6 col-lg-4" key={account.id}>
                <div
                  className="notion-card h-100 d-flex flex-column justify-content-between"
                  style={{
                    backgroundColor:
                      account.provider_type === 'international'
                        ? '#fcfdfd'
                        : '#ffffff',
                    border: '1px solid var(--notion-border)',
                  }}
                >
                  <div>
                    {/* Top Provider Header */}
                    <div className="d-flex align-items-center justify-content-between mb-2">
                      <div className="d-flex align-items-center gap-2">
                        {getProviderIcon(account.provider_type)}
                        <span className="fw-bold" style={{ fontSize: '14px' }}>
                          {account.provider_name}
                        </span>
                      </div>
                      {getBadgePill(account)}
                    </div>

                    {/* Account Number / PayPal Email with Copy Button */}
                    <div
                      className="p-2 rounded bg-light border d-flex align-items-center justify-content-between mb-2"
                      style={{ borderColor: 'var(--notion-border)' }}
                    >
                      <span
                        className="fw-semibold text-truncate select-all"
                        style={{
                          fontSize: '13px',
                          letterSpacing:
                            account.provider_name === 'PayPal'
                              ? 'normal'
                              : '0.04em',
                        }}
                      >
                        {account.account_number}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleCopy(account)}
                        className="btn btn-sm p-1 text-muted border-0 bg-transparent ms-2"
                        title="Salin nomor / email ke clipboard"
                      >
                        {isCopied ? (
                          <span
                            className="d-flex align-items-center gap-1 text-success fw-bold"
                            style={{ fontSize: '11px' }}
                          >
                            <Check size={13} />
                            <span>Tersalin!</span>
                          </span>
                        ) : (
                          <Copy size={13} />
                        )}
                      </button>
                    </div>

                    {/* Account Holder Name */}
                    <div className="mb-2" style={{ fontSize: '12.5px' }}>
                      <span className="text-muted">Atas Nama: </span>
                      <span className="fw-semibold">{account.account_name}</span>
                    </div>

                    {/* Notes if available */}
                    {account.notes && (
                      <p
                        className="text-muted mb-0"
                        style={{
                          fontSize: '11.5px',
                          fontStyle: 'italic',
                          lineHeight: 1.4,
                        }}
                      >
                        "{account.notes}"
                      </p>
                    )}
                  </div>

                  {/* Footer Actions */}
                  <div
                    className="d-flex align-items-center justify-content-between pt-2 border-top mt-3"
                    style={{ borderColor: '#f1f1ef' }}
                  >
                    <button
                      type="button"
                      onClick={() => handleCopy(account)}
                      className="btn btn-sm p-0 text-muted d-inline-flex align-items-center gap-1"
                      style={{ fontSize: '11.5px' }}
                    >
                      <Copy size={11} />
                      <span>{isCopied ? 'Tersalin' : 'Salin Rekening'}</span>
                    </button>

                    {isAdmin && (
                      <button
                        type="button"
                        onClick={() => handleDelete(account)}
                        className="btn btn-sm p-0 text-danger d-inline-flex align-items-center gap-1"
                        style={{ fontSize: '11.5px' }}
                      >
                        <Trash2 size={11} />
                        <span>Hapus</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Add Modal */}
      <AddPaymentAccountModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
      />
    </div>
  );
}
