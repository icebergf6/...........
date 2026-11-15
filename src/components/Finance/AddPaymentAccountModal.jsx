import React, { useState } from 'react';
import { X, Plus, CreditCard, Globe, Landmark, Wallet } from 'lucide-react';
import { PAYMENT_PROVIDERS } from '../../lib/supabase';
import { usePaymentAccounts } from '../../context/PaymentAccountsContext';

export default function AddPaymentAccountModal({ isOpen, onClose }) {
  const { addPaymentAccount, paymentAccounts, maxAccounts, isMaxAccounts } =
    usePaymentAccounts();

  const [providerType, setProviderType] = useState('international'); // 'international' | 'local_bank' | 'ewallet' | 'other'
  const [providerName, setProviderName] = useState('PayPal');
  const [accountName, setAccountName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  function handleTypeChange(type) {
    setProviderType(type);
    if (type === 'international') {
      setProviderName('PayPal');
    } else if (type === 'local_bank') {
      setProviderName('SeaBank');
    } else if (type === 'ewallet') {
      setProviderName('GoPay');
    } else {
      setProviderName('Metode Lain');
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (!accountName.trim() || !accountNumber.trim()) {
      setError('Nama pemilik dan nomor rekening / email PayPal wajib diisi.');
      return;
    }

    setSubmitting(true);
    try {
      await addPaymentAccount({
        provider_type: providerType,
        provider_name: providerName,
        account_name: accountName,
        account_number: accountNumber,
        notes,
      });

      // Reset form
      setAccountName('');
      setAccountNumber('');
      setNotes('');
      onClose();
    } catch (err) {
      setError(err.message || 'Gagal menambahkan rekening.');
    } finally {
      setSubmitting(false);
    }
  }

  const currentProviderObj =
    PAYMENT_PROVIDERS.find((p) => p.value === providerName) || null;

  return (
    <div className="notion-modal-overlay" onClick={onClose}>
      <div
        className="notion-modal-box"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Tambah Rekening Pembayaran"
      >
        <div
          className="d-flex align-items-center justify-content-between px-4 py-3 border-bottom"
          style={{ borderColor: 'var(--notion-border)' }}
        >
          <div>
            <div className="fw-bold" style={{ fontSize: '15px' }}>
              Tambah Rekening &amp; Metode Pembayaran
            </div>
            <div className="text-muted" style={{ fontSize: '12px' }}>
              Rekening ke-{paymentAccounts.length + 1} dari batas maksimal{' '}
              {maxAccounts} akun
            </div>
          </div>
          <button
            type="button"
            className="btn btn-sm p-1 text-muted"
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </div>

        {isMaxAccounts ? (
          <div className="p-4 text-center">
            <div className="alert alert-warning py-2 mb-3" style={{ fontSize: '13px' }}>
              Batas maksimal {maxAccounts} rekening pembayaran telah tercapai.
              Hapus salah satu rekening lama terlebih dahulu untuk menambahkan
              yang baru.
            </div>
            <button
              type="button"
              className="btn-notion-outline"
              onClick={onClose}
            >
              Tutup
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-4">
            {error && (
              <div
                className="alert alert-danger py-2 px-3 mb-3"
                style={{ fontSize: '12.5px' }}
              >
                {error}
              </div>
            )}

            {/* Provider Type Selection Tabs */}
            <div className="mb-3">
              <label
                className="form-label fw-medium mb-1"
                style={{ fontSize: '12.5px' }}
              >
                Kategori Bank / Pembayaran
              </label>
              <div
                className="d-flex p-1 rounded-2"
                style={{ backgroundColor: '#f1f1ef' }}
              >
                <button
                  type="button"
                  onClick={() => handleTypeChange('international')}
                  className="btn btn-sm flex-grow-1 fw-medium border-0 d-flex align-items-center justify-content-center gap-1"
                  style={{
                    backgroundColor:
                      providerType === 'international' ? '#ffffff' : 'transparent',
                    color: 'var(--notion-text)',
                    boxShadow:
                      providerType === 'international'
                        ? '0 1px 3px rgba(0,0,0,0.08)'
                        : 'none',
                    fontSize: '12.5px',
                  }}
                >
                  <Globe size={13} />
                  <span>Bank Luar (PayPal)</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleTypeChange('local_bank')}
                  className="btn btn-sm flex-grow-1 fw-medium border-0 d-flex align-items-center justify-content-center gap-1"
                  style={{
                    backgroundColor:
                      providerType === 'local_bank' ? '#ffffff' : 'transparent',
                    color: 'var(--notion-text)',
                    boxShadow:
                      providerType === 'local_bank'
                        ? '0 1px 3px rgba(0,0,0,0.08)'
                        : 'none',
                    fontSize: '12.5px',
                  }}
                >
                  <Landmark size={13} />
                  <span>Bank Lokal (SeaBank/dll)</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleTypeChange('ewallet')}
                  className="btn btn-sm flex-grow-1 fw-medium border-0 d-flex align-items-center justify-content-center gap-1"
                  style={{
                    backgroundColor:
                      providerType === 'ewallet' ? '#ffffff' : 'transparent',
                    color: 'var(--notion-text)',
                    boxShadow:
                      providerType === 'ewallet'
                        ? '0 1px 3px rgba(0,0,0,0.08)'
                        : 'none',
                    fontSize: '12.5px',
                  }}
                >
                  <Wallet size={13} />
                  <span>E-Wallet</span>
                </button>
              </div>
            </div>

            {/* Provider Name Dropdown */}
            <div className="mb-3">
              <label
                className="form-label fw-medium mb-1"
                style={{ fontSize: '12.5px' }}
              >
                Pilihan Provider / Nama Bank <span className="text-danger">*</span>
              </label>
              {providerType === 'international' ? (
                <select
                  className="notion-select w-100"
                  value={providerName}
                  onChange={(e) => setProviderName(e.target.value)}
                >
                  <option value="PayPal">PayPal (USD / Internasional)</option>
                  <option value="Wise">Wise (TransferWise)</option>
                  <option value="Stripe">Stripe Payment Link</option>
                  <option value="Bank Luar Lainnya">Bank Luar Negeri Lainnya</option>
                </select>
              ) : providerType === 'local_bank' ? (
                <select
                  className="notion-select w-100"
                  value={providerName}
                  onChange={(e) => setProviderName(e.target.value)}
                >
                  <option value="SeaBank">SeaBank (Sibank / PT Bank Seabank Indonesia)</option>
                  <option value="BCA">Bank BCA</option>
                  <option value="BRI">Bank BRI</option>
                  <option value="Mandiri">Bank Mandiri</option>
                  <option value="BNI">Bank BNI</option>
                  <option value="Bank Jago">Bank Jago</option>
                  <option value="Bank Lainnya">Bank Lainnya</option>
                </select>
              ) : (
                <select
                  className="notion-select w-100"
                  value={providerName}
                  onChange={(e) => setProviderName(e.target.value)}
                >
                  <option value="GoPay">GoPay</option>
                  <option value="OVO">OVO</option>
                  <option value="Dana">Dana</option>
                  <option value="ShopeePay">ShopeePay</option>
                </select>
              )}
            </div>

            {/* Account Number / PayPal Email */}
            <div className="mb-3">
              <label
                className="form-label fw-medium mb-1"
                style={{ fontSize: '12.5px' }}
              >
                {providerName === 'PayPal'
                  ? 'Email Akun PayPal'
                  : providerType === 'ewallet'
                  ? 'Nomor Handphone E-Wallet'
                  : 'Nomor Rekening Bank'}{' '}
                <span className="text-danger">*</span>
              </label>
              <input
                type="text"
                className="notion-input w-100"
                placeholder={
                  currentProviderObj?.placeholder ||
                  (providerName === 'PayPal'
                    ? 'billing@studio.com'
                    : 'Nomor rekening atau ID akun')
                }
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value)}
                required
              />
            </div>

            {/* Account Holder Name */}
            <div className="mb-3">
              <label
                className="form-label fw-medium mb-1"
                style={{ fontSize: '12.5px' }}
              >
                Nama Pemilik Rekening / Atas Nama <span className="text-danger">*</span>
              </label>
              <input
                type="text"
                className="notion-input w-100"
                placeholder="Contoh: Leo Syafiq / A-Tier Studio LLC"
                value={accountName}
                onChange={(e) => setAccountName(e.target.value)}
                required
              />
            </div>

            {/* Notes / Instructions */}
            <div className="mb-4">
              <label
                className="form-label fw-medium mb-1"
                style={{ fontSize: '12.5px' }}
              >
                Catatan / Instruksi Pembayaran untuk Klien (Opsional)
              </label>
              <textarea
                className="notion-input w-100"
                rows={2}
                placeholder={
                  providerType === 'international'
                    ? 'Contoh: Untuk pembayaran USD luar negeri, pilih opsi Friends & Family atau cantumkan nomor invoice.'
                    : 'Contoh: Berita transfer sertakan nama bisnis Anda, lalu konfirmasi via WhatsApp.'
                }
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            <div className="d-flex justify-content-end gap-2">
              <button
                type="button"
                className="btn-notion-outline"
                onClick={onClose}
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="btn-notion-primary"
              >
                <Plus size={15} />
                <span>
                  {submitting ? 'Menyimpan...' : 'Simpan Rekening'}
                </span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
