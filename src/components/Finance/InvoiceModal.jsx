import React, { useState, useMemo } from 'react';
import {
  X,
  Printer,
  Copy,
  Check,
  FileText,
  CreditCard,
  Building,
  Calendar,
  DollarSign,
  Download,
} from 'lucide-react';
import { usePaymentAccounts } from '../../context/PaymentAccountsContext';
import {
  formatCurrency,
  getTodayDateString,
  getOffsetDateString,
  getStudioSettings,
  getNextRenewalDate,
} from '../../lib/supabase';

export default function InvoiceModal({
  isOpen,
  onClose,
  client,
  initialInvoiceType = null,
}) {
  const { paymentAccounts } = usePaymentAccounts();
  const studioSettings = getStudioSettings();

  const [invoiceType, setInvoiceType] = useState('dp'); // 'dp' | 'pelunasan' | 'quotation' | 'renewal'
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [customNote, setCustomNote] = useState('');
  const [copiedText, setCopiedText] = useState(false);

  // Initialize defaults when client changes
  React.useEffect(() => {
    if (client) {
      const targetType =
        initialInvoiceType ||
        (client.payment_status === 'DP Masuk' || client.payment_status === 'Lunas'
          ? 'pelunasan'
          : 'dp');

      setInvoiceType(targetType);

      const now = new Date();
      const prefix = targetType === 'renewal' ? 'RNW-' : 'INV-';
      const code =
        prefix +
        now.getFullYear() +
        String(now.getMonth() + 1).padStart(2, '0') +
        '-' +
        client.id.slice(-4).toUpperCase();
      setInvoiceNumber(code);
      setDueDate(
        targetType === 'renewal' && client.renewal_due_date
          ? client.renewal_due_date
          : getOffsetDateString(7)
      );

      // Auto-select payment account based on currency
      const isUsd = (client.currency || 'IDR') === 'USD';
      if (isUsd) {
        const paypalAcc = paymentAccounts.find(
          (a) => a.provider_name.toLowerCase().includes('paypal') || a.provider_type === 'international'
        );
        setSelectedAccountId(paypalAcc ? paypalAcc.id : paymentAccounts[0]?.id || '');
      } else {
        const localAcc = paymentAccounts.find(
          (a) => a.provider_type === 'local_bank' || a.provider_type === 'ewallet'
        );
        setSelectedAccountId(localAcc ? localAcc.id : paymentAccounts[0]?.id || '');
      }
    }
  }, [client, paymentAccounts, initialInvoiceType]);

  const selectedAccount = useMemo(() => {
    return (
      paymentAccounts.find((a) => a.id === selectedAccountId) ||
      paymentAccounts[0] ||
      null
    );
  }, [paymentAccounts, selectedAccountId]);

  if (!isOpen || !client) return null;

  const curr = client.currency || 'IDR';
  const projectVal = Number(client.project_value) || 0;
  const dpAmount = Number(client.dp_amount) || 0;
  const remaining = Math.max(0, projectVal - dpAmount);
  const renewalPrice =
    Number(client.renewal_price) || (curr === 'USD' ? 150 : 1500000);
  const renewalCycle = client.renewal_cycle || 'Yearly';
  const renewalServiceName =
    client.renewal_service_name ||
    'Perpanjangan Domain, Cloud Hosting & Maintenance Website';
  const clientDomain =
    client.delivery_assets?.domain ||
    client.delivery_assets?.live_url ||
    client.social_handle ||
    '-';
  const nextActiveUntil = getNextRenewalDate(
    client.renewal_due_date || getTodayDateString(),
    renewalCycle
  );

  let amountToPay = 0;
  let typeLabel = '';
  let statusBadge = '';

  if (invoiceType === 'dp') {
    amountToPay = dpAmount > 0 ? dpAmount : Math.round(projectVal * 0.5);
    typeLabel = 'INVOICE DOWN PAYMENT (DP 50%)';
    statusBadge = 'Menunggu Pembayaran DP';
  } else if (invoiceType === 'pelunasan') {
    amountToPay = client.payment_status === 'Lunas' ? projectVal : remaining;
    typeLabel = 'INVOICE PELUNASAN AKHIR';
    statusBadge = client.payment_status === 'Lunas' ? 'LUNAS (PAID)' : 'Menunggu Pelunasan';
  } else if (invoiceType === 'renewal') {
    amountToPay = renewalPrice;
    typeLabel =
      renewalCycle === 'Monthly'
        ? 'INVOICE PERPANJANGAN BULANAN (MAINTENANCE & HOSTING)'
        : 'INVOICE PERPANJANGAN TAHUNAN (DOMAIN & HOSTING)';
    statusBadge = 'Tagihan Perpanjangan Layanan';
  } else {
    amountToPay = projectVal;
    typeLabel = 'QUOTATION / SURAT PENAWARAN HARGA';
    statusBadge = 'Estimasi Penawaran';
  }

  function handlePrint() {
    window.print();
  }

  function handleCopySummaryText() {
    const text =
      invoiceType === 'renewal'
        ? `*${typeLabel}*
No. Invoice: ${invoiceNumber}
Klien: ${client.client_name}
Domain / Website: ${clientDomain}
Jatuh Tempo Perpanjangan: ${dueDate}

*Detail Layanan Perpanjangan:*
${renewalServiceName}
Siklus: ${renewalCycle === 'Monthly' ? 'Bulanan (1 Bulan)' : 'Tahunan (1 Tahun)'}
Perpanjangan Aktif s/d: ${nextActiveUntil}
*Total Tagihan Perpanjangan: ${formatCurrency(amountToPay, curr)}*

*Metode Pembayaran:*
${selectedAccount?.provider_name || 'Bank Transfer'}: ${selectedAccount?.account_number || '-'}
A/N: ${selectedAccount?.account_name || '-'}

Mohon konfirmasi setelah melakukan transfer agar layanan domain & server tetap aktif tanpa kendala. Terima kasih!
_${studioSettings.studioName}_`
        : `*${typeLabel}*
No. Invoice: ${invoiceNumber}
Klien: ${client.client_name}
Tanggal: ${getTodayDateString()}
Jatuh Tempo: ${dueDate}

*Detail Proyek:*
Pembuatan Desain & Development Website
Total Nilai Kontrak: ${formatCurrency(projectVal, curr)}
${
  invoiceType === 'dp'
    ? `Tagihan DP: ${formatCurrency(amountToPay, curr)}
Sisa Pelunasan: ${formatCurrency(Math.max(0, projectVal - amountToPay), curr)}`
    : invoiceType === 'pelunasan'
    ? `Tagihan Pelunasan: ${formatCurrency(amountToPay, curr)}`
    : `Total Penawaran: ${formatCurrency(projectVal, curr)}`
}

*Metode Pembayaran:*
${selectedAccount?.provider_name || 'Bank Transfer'}: ${selectedAccount?.account_number || '-'}
A/N: ${selectedAccount?.account_name || '-'}

Mohon konfirmasi setelah melakukan transfer. Terima kasih!
_${studioSettings.studioName}_`;

    navigator.clipboard.writeText(text);
    setCopiedText(true);
    setTimeout(() => setCopiedText(false), 2200);
  }

  return (
    <>
      <div className="notion-drawer-backdrop" onClick={onClose} />
      <div
        className="modal show d-block"
        tabIndex="-1"
        style={{ backgroundColor: 'rgba(15, 15, 15, 0.45)', zIndex: 1060 }}
      >
        <div className="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable">
          <div className="modal-content border-0 shadow-lg" style={{ borderRadius: '10px' }}>
            {/* Modal Control Header (Hidden when printed) */}
            <div className="modal-header py-2 px-3 border-bottom d-print-none bg-light">
              <div className="d-flex align-items-center gap-2">
                <FileText size={16} />
                <span className="fw-semibold" style={{ fontSize: '13.5px' }}>
                  Generator Invoice &amp; Penawaran Web Design
                </span>
              </div>

              <div className="d-flex align-items-center gap-2">
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary d-inline-flex align-items-center gap-1"
                  onClick={handleCopySummaryText}
                  title="Salin teks invoice untuk WhatsApp / Email"
                >
                  {copiedText ? (
                    <>
                      <Check size={13} className="text-success" />
                      <span className="text-success fw-bold">Tersalin!</span>
                    </>
                  ) : (
                    <>
                      <Copy size={13} />
                      <span>Salin Teks WA</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  className="btn btn-sm btn-dark d-inline-flex align-items-center gap-1"
                  onClick={handlePrint}
                  title="Cetak atau Simpan PDF via browser print"
                >
                  <Printer size={13} />
                  <span>Cetak / PDF</span>
                </button>

                <button
                  type="button"
                  className="btn btn-sm p-1 text-muted border-0 bg-transparent ms-1"
                  onClick={onClose}
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Config Toolbar (Hidden when printed) */}
            <div className="p-3 bg-white border-bottom d-print-none">
              <div className="row g-2 align-items-center">
                <div className="col-12 col-md-4">
                  <label className="text-muted mb-1" style={{ fontSize: '11px' }}>
                    Jenis Dokumen:
                  </label>
                  <select
                    className="notion-select w-100 fw-semibold"
                    value={invoiceType}
                    onChange={(e) => {
                      const nextType = e.target.value;
                      setInvoiceType(nextType);
                      const now = new Date();
                      const prefix = nextType === 'renewal' ? 'RNW-' : 'INV-';
                      setInvoiceNumber(
                        prefix +
                          now.getFullYear() +
                          String(now.getMonth() + 1).padStart(2, '0') +
                          '-' +
                          client.id.slice(-4).toUpperCase()
                      );
                    }}
                  >
                    <option value="dp">Invoice DP (Down Payment)</option>
                    <option value="pelunasan">Invoice Pelunasan Akhir</option>
                    <option value="renewal">
                      Invoice Perpanjangan (Domain/Hosting/Maintenance)
                    </option>
                    <option value="quotation">Surat Penawaran (Quotation)</option>
                  </select>
                </div>

                <div className="col-12 col-md-4">
                  <label className="text-muted mb-1" style={{ fontSize: '11px' }}>
                    Rekening Pembayaran:
                  </label>
                  <select
                    className="notion-select w-100"
                    value={selectedAccountId}
                    onChange={(e) => setSelectedAccountId(e.target.value)}
                  >
                    {paymentAccounts.map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        {acc.provider_name} — {acc.account_number} ({acc.account_name})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="col-12 col-md-4">
                  <label className="text-muted mb-1" style={{ fontSize: '11px' }}>
                    Jatuh Tempo:
                  </label>
                  <input
                    type="date"
                    className="notion-input w-100"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Printable Invoice Document Body */}
            <div className="modal-body p-4 p-md-5 bg-white" id="printable-invoice">
              {/* Studio Header & Invoice Tag */}
              <div className="d-flex align-items-start justify-content-between mb-4 pb-3 border-bottom">
                <div>
                  <div className="fw-bold tracking-tight" style={{ fontSize: '20px', letterSpacing: '-0.02em' }}>
                    {studioSettings.studioName}
                  </div>
                  <div className="text-muted" style={{ fontSize: '12px' }}>
                    Modern Web Design, UI/UX Architecture &amp; Development
                  </div>
                  <div className="text-muted" style={{ fontSize: '11.5px' }}>
                    {studioSettings.studioContact}
                  </div>
                </div>

                <div className="text-end">
                  <div className="badge bg-dark text-white px-2 py-1 mb-1" style={{ fontSize: '12px' }}>
                    {typeLabel}
                  </div>
                  <div className="fw-semibold text-secondary" style={{ fontSize: '13px' }}>
                    #{invoiceNumber}
                  </div>
                  <div className="text-muted" style={{ fontSize: '11.5px' }}>
                    Status: <strong>{statusBadge}</strong>
                  </div>
                </div>
              </div>

              {/* Billed To & Dates Meta */}
              <div className="row g-3 mb-4">
                <div className="col-6">
                  <div className="text-muted mb-1 text-uppercase fw-semibold" style={{ fontSize: '11px', letterSpacing: '0.05em' }}>
                    DITUJUKAN KEPADA:
                  </div>
                  <div className="fw-bold" style={{ fontSize: '15px' }}>
                    {client.client_name}
                  </div>
                  <div className="text-muted" style={{ fontSize: '12px' }}>
                    Platform: {client.source_platform} ({client.social_handle || '-'})
                  </div>
                  {client.whatsapp_number && (
                    <div className="text-muted" style={{ fontSize: '12px' }}>
                      Telp/WA: {client.whatsapp_number}
                    </div>
                  )}
                  <div className="text-muted" style={{ fontSize: '11.5px' }}>
                    PIC Studio: @{client.created_by_username || 'tim'}
                  </div>
                </div>

                <div className="col-6 text-end">
                  <div className="text-muted mb-1 text-uppercase fw-semibold" style={{ fontSize: '11px', letterSpacing: '0.05em' }}>
                    INFORMASI TANGGAL:
                  </div>
                  <div style={{ fontSize: '12.5px' }}>
                    <span className="text-muted">Tanggal Diterbitkan: </span>
                    <span className="fw-semibold">{getTodayDateString()}</span>
                  </div>
                  <div style={{ fontSize: '12.5px' }}>
                    <span className="text-muted">Batas Pembayaran: </span>
                    <span className="fw-semibold text-danger">{dueDate}</span>
                  </div>
                  <div style={{ fontSize: '12.5px' }}>
                    <span className="text-muted">Mata Uang: </span>
                    <span className="fw-bold">{curr}</span>
                  </div>
                </div>
              </div>

              {/* Items Table */}
              <div className="table-responsive mb-4">
                <table className="table table-bordered align-middle" style={{ borderColor: '#e5e5e5' }}>
                  <thead style={{ backgroundColor: '#f9f9f8' }}>
                    <tr style={{ fontSize: '12px', textTransform: 'uppercase', color: '#666' }}>
                      <th>Deskripsi Layanan</th>
                      <th style={{ width: '80px', textAlign: 'center' }}>Qty</th>
                      <th style={{ width: '160px', textAlign: 'right' }}>Harga</th>
                    </tr>
                  </thead>
                  <tbody style={{ fontSize: '13px' }}>
                    {invoiceType === 'renewal' ? (
                      <tr>
                        <td>
                          <div className="fw-semibold">
                            {renewalServiceName} ({client.client_name})
                          </div>
                          <div className="text-muted" style={{ fontSize: '11.5px', marginTop: '3px' }}>
                            • Domain / Website: <strong>{clientDomain}</strong>
                            <br />
                            • Siklus Langganan:{' '}
                            <strong>
                              {renewalCycle === 'Monthly'
                                ? 'Bulanan (Per 1 Bulan)'
                                : 'Tahunan (Per 1 Tahun)'}
                            </strong>
                            <br />
                            • Perpanjangan Masa Aktif s/d: <strong>{nextActiveUntil}</strong>
                            <br />• Termasuk pemeliharaan server, SSL keamanan &amp; backup berkala
                          </div>
                        </td>
                        <td className="text-center">
                          1 {renewalCycle === 'Monthly' ? 'Bulan' : 'Tahun'}
                        </td>
                        <td className="text-end fw-semibold">
                          {formatCurrency(amountToPay, curr)}
                        </td>
                      </tr>
                    ) : (
                      <tr>
                        <td>
                          <div className="fw-semibold">
                            {client.management_type === 'project_only'
                              ? `Pembuatan / Redesign Website (${client.client_name}) — Project Saja`
                              : `Pembuatan Website Profesional (${client.client_name})`}
                          </div>
                          <div className="text-muted" style={{ fontSize: '11.5px', marginTop: '3px' }}>
                            • Riset Moodboard &amp; Desain Visual Antarmuka Website (UI/UX)
                            <br />
                            • Pengembangan Frontend Responsif (Mobile, Tablet, Desktop)
                            <br />
                            • Integrasi Formulir / WhatsApp / Direktori &amp; SEO Friendly
                            <br />
                            • Skema Manajemen:{' '}
                            <strong>
                              {client.management_type === 'project_only'
                                ? 'Project / Redesign Saja (Hosting & Domain Dikelola Klien Sendiri)'
                                : 'Full Managed (Termasuk Hosting & Domain dari Studio)'}
                            </strong>
                            <br />• Termasuk jatah 3x putaran revisi gratis
                          </div>
                        </td>
                        <td className="text-center">1 Paket</td>
                        <td className="text-end fw-semibold">
                          {formatCurrency(projectVal, curr)}
                        </td>
                      </tr>
                    )}
                  </tbody>
                  <tfoot>
                    {invoiceType !== 'renewal' && (
                      <tr>
                        <td colSpan="2" className="text-end text-muted fw-semibold" style={{ fontSize: '12.5px' }}>
                          Total Nilai Kontrak Proyek:
                        </td>
                        <td className="text-end fw-bold" style={{ fontSize: '13.5px' }}>
                          {formatCurrency(projectVal, curr)}
                        </td>
                      </tr>
                    )}

                    {invoiceType === 'renewal' && (
                      <tr style={{ backgroundColor: '#f0fdf4' }}>
                        <td colSpan="2" className="text-end fw-bold text-success" style={{ fontSize: '13.5px' }}>
                          Total Biaya Perpanjangan yang Harus Dibayar:
                        </td>
                        <td className="text-end fw-bold text-success" style={{ fontSize: '15px' }}>
                          {formatCurrency(amountToPay, curr)}
                        </td>
                      </tr>
                    )}

                    {invoiceType === 'dp' && (
                      <>
                        <tr style={{ backgroundColor: '#f0fdf4' }}>
                          <td colSpan="2" className="text-end fw-bold text-success" style={{ fontSize: '13.5px' }}>
                            Jumlah Tagihan DP (50%) yang Harus Dibayar:
                          </td>
                          <td className="text-end fw-bold text-success" style={{ fontSize: '15px' }}>
                            {formatCurrency(amountToPay, curr)}
                          </td>
                        </tr>
                        <tr>
                          <td colSpan="2" className="text-end text-muted" style={{ fontSize: '12px' }}>
                            Sisa Tagihan Pelunasan Pasca-Selesai:
                          </td>
                          <td className="text-end text-muted" style={{ fontSize: '12px' }}>
                            {formatCurrency(Math.max(0, projectVal - amountToPay), curr)}
                          </td>
                        </tr>
                      </>
                    )}

                    {invoiceType === 'pelunasan' && (
                      <>
                        <tr>
                          <td colSpan="2" className="text-end text-muted" style={{ fontSize: '12px' }}>
                            DP yang Sudah Diterima Sebelumnya:
                          </td>
                          <td className="text-end text-muted" style={{ fontSize: '12px' }}>
                            {formatCurrency(dpAmount, curr)}
                          </td>
                        </tr>
                        <tr style={{ backgroundColor: '#f0fdf4' }}>
                          <td colSpan="2" className="text-end fw-bold text-success" style={{ fontSize: '13.5px' }}>
                            Total Pelunasan Akhir:
                          </td>
                          <td className="text-end fw-bold text-success" style={{ fontSize: '15px' }}>
                            {formatCurrency(amountToPay, curr)}
                          </td>
                        </tr>
                      </>
                    )}

                    {invoiceType === 'quotation' && (
                      <tr style={{ backgroundColor: '#f8fafc' }}>
                        <td colSpan="2" className="text-end fw-bold text-primary" style={{ fontSize: '13.5px' }}>
                          Total Estimasi Investasi:
                        </td>
                        <td className="text-end fw-bold text-primary" style={{ fontSize: '15px' }}>
                          {formatCurrency(amountToPay, curr)}
                        </td>
                      </tr>
                    )}
                  </tfoot>
                </table>
              </div>

              {/* Payment Details Box */}
              <div
                className="p-3 rounded mb-4"
                style={{
                  backgroundColor: '#fbfbfa',
                  border: '1px solid #e5e5e5',
                }}
              >
                <div className="fw-bold mb-2 d-flex align-items-center gap-2" style={{ fontSize: '13px' }}>
                  <CreditCard size={15} />
                  <span>INSTRUKSI PEMBAYARAN TRANSFER</span>
                </div>
                {selectedAccount ? (
                  <div className="row g-2 align-items-center">
                    <div className="col-sm-4">
                      <div className="text-muted" style={{ fontSize: '11px' }}>
                        Penyedia / Bank:
                      </div>
                      <div className="fw-bold" style={{ fontSize: '13px' }}>
                        {selectedAccount.provider_name}
                      </div>
                    </div>
                    <div className="col-sm-5">
                      <div className="text-muted" style={{ fontSize: '11px' }}>
                        Nomor Rekening / Email Akun:
                      </div>
                      <div
                        className="fw-bold select-all text-primary"
                        style={{ fontSize: '14px', letterSpacing: '0.04em' }}
                      >
                        {selectedAccount.account_number}
                      </div>
                    </div>
                    <div className="col-sm-3">
                      <div className="text-muted" style={{ fontSize: '11px' }}>
                        Atas Nama:
                      </div>
                      <div className="fw-semibold" style={{ fontSize: '13px' }}>
                        {selectedAccount.account_name}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-muted" style={{ fontSize: '12px' }}>
                    Belum ada rekening yang dipilih. Silakan tambahkan rekening tim di halaman Keuangan.
                  </div>
                )}
              </div>

              {/* Terms & Footer Note */}
              <div className="text-muted pt-2 border-top" style={{ fontSize: '11px', lineHeight: 1.5 }}>
                <div className="fw-semibold text-dark mb-1">Syarat &amp; Ketentuan Layanan:</div>
                <ol className="ps-3 mb-2">
                  <li>Pengerjaan wireframe &amp; desain UI dimulai setelah pembayaran Down Payment (DP) diterima.</li>
                  <li>Pelunasan dibayarkan setelah seluruh tahap revisi disetujui dan sebelum serah terima hak akses hosting/domain live.</li>
                  <li>Bukti transfer harap dikirimkan melalui WhatsApp admin studio untuk verifikasi instan.</li>
                </ol>
                <div className="text-end font-monospace" style={{ fontSize: '10.5px' }}>
                  A-Tier Management • Generated on {getTodayDateString()}
                </div>
              </div>
            </div>

            {/* Modal Footer Controls (Hidden when printed) */}
            <div className="modal-footer py-2 px-3 border-top d-print-none bg-light justify-content-between">
              <span className="text-muted" style={{ fontSize: '12px' }}>
                Tip: Gunakan "Save as PDF" pada jendela cetak browser untuk menyimpan file PDF.
              </span>
              <div className="d-flex align-items-center gap-2">
                <button type="button" className="btn-notion-outline" onClick={onClose}>
                  Tutup
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-dark d-inline-flex align-items-center gap-1"
                  onClick={handlePrint}
                >
                  <Printer size={13} />
                  <span>Cetak / Simpan PDF</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}