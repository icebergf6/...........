import React, { useMemo } from 'react';
import {
  X,
  TrendingUp,
  BarChart3,
  PieChart,
  Target,
  DollarSign,
  Download,
  Users,
  CheckCircle2,
  Globe,
  Wallet,
} from 'lucide-react';
import {
  formatRupiah,
  formatUSD,
  formatCurrency,
  exportToCSV,
  SOCIAL_PLATFORMS,
} from '../../lib/supabase';

export default function AnalyticsModal({ isOpen, onClose, prospects = [], dealClients = [] }) {
  const analytics = useMemo(() => {
    const totalProspects = prospects.length;
    const totalDeals = dealClients.length;
    const winRate =
      totalProspects > 0 ? Math.round((totalDeals / totalProspects) * 100) : 0;

    // Financial accumulations
    let totalCashInIdr = 0;
    let totalCashInUsd = 0;
    let totalContractIdr = 0;
    let totalContractUsd = 0;
    let dealsIdrCount = 0;
    let dealsUsdCount = 0;

    dealClients.forEach((d) => {
      const isUsd = (d.currency || 'IDR') === 'USD';
      const val = Number(d.project_value) || 0;
      const dp =
        d.payment_status === 'Lunas' ? val : Number(d.dp_amount) || 0;

      if (isUsd) {
        dealsUsdCount++;
        totalContractUsd += val;
        totalCashInUsd += dp;
      } else {
        dealsIdrCount++;
        totalContractIdr += val;
        totalCashInIdr += dp;
      }
    });

    const avgDealSizeIdr =
      dealsIdrCount > 0 ? Math.round(totalContractIdr / dealsIdrCount) : 0;
    const avgDealSizeUsd =
      dealsUsdCount > 0 ? Math.round(totalContractUsd / dealsUsdCount) : 0;

    // Platform analysis
    const platformMap = {};
    SOCIAL_PLATFORMS.forEach((p) => {
      platformMap[p.value] = {
        name: p.label,
        count: 0,
        dealCount: 0,
        cashInIdr: 0,
        cashInUsd: 0,
      };
    });

    prospects.forEach((p) => {
      const plat = p.source_platform || 'Lainnya';
      if (!platformMap[plat]) {
        platformMap[plat] = {
          name: plat,
          count: 0,
          dealCount: 0,
          cashInIdr: 0,
          cashInUsd: 0,
        };
      }
      platformMap[plat].count += 1;
      if (p.status === 'Deal') {
        platformMap[plat].dealCount += 1;
        const val = Number(p.project_value) || 0;
        const dp =
          p.payment_status === 'Lunas' ? val : Number(p.dp_amount) || 0;
        if (p.currency === 'USD') {
          platformMap[plat].cashInUsd += dp;
        } else {
          platformMap[plat].cashInIdr += dp;
        }
      }
    });

    const platformStats = Object.values(platformMap)
      .filter((item) => item.count > 0)
      .sort((a, b) => b.dealCount - a.dealCount || b.count - a.count);

    return {
      totalProspects,
      totalDeals,
      winRate,
      totalCashInIdr,
      totalCashInUsd,
      totalContractIdr,
      totalContractUsd,
      avgDealSizeIdr,
      avgDealSizeUsd,
      platformStats,
    };
  }, [prospects, dealClients]);

  if (!isOpen) return null;

  function handleExportDealsCSV() {
    exportToCSV('laporan-klien-deal-keuangan', dealClients, [
      { header: 'Nama Klien', key: 'client_name' },
      { header: 'Sumber Platform', key: 'source_platform' },
      { header: 'Sosmed / Website', key: 'social_handle' },
      { header: 'Penginput (Hunter)', key: 'created_by_username' },
      { header: 'Mata Uang', key: 'currency' },
      { header: 'Nilai Kontrak', key: 'project_value' },
      { header: 'DP Masuk', key: 'dp_amount' },
      {
        header: 'Sisa Pelunasan',
        transform: (row) =>
          Math.max(
            0,
            (Number(row.project_value) || 0) - (Number(row.dp_amount) || 0)
          ),
      },
      { header: 'Status Pembayaran', key: 'payment_status' },
      { header: 'Tanggal Deal', key: 'deal_date' },
      { header: 'Catatan', key: 'notes' },
    ]);
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
            <div className="modal-header py-3 px-4 border-bottom bg-light">
              <div className="d-flex align-items-center gap-2">
                <BarChart3 size={18} className="text-primary" />
                <h5 className="modal-title fw-bold mb-0" style={{ fontSize: '16px' }}>
                  Analitik Bisnis &amp; Konversi Penjualan Web
                </h5>
              </div>

              <div className="d-flex align-items-center gap-2">
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary d-inline-flex align-items-center gap-1"
                  onClick={handleExportDealsCSV}
                >
                  <Download size={13} />
                  <span>Export Deals (CSV)</span>
                </button>

                <button
                  type="button"
                  className="btn btn-sm p-1 text-muted border-0 bg-transparent ms-2"
                  onClick={onClose}
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className="modal-body p-4 bg-white">
              {/* Top High-level KPI Cards */}
              <div className="row g-3 mb-4">
                <div className="col-6 col-md-3">
                  <div className="p-3 rounded border bg-light text-center">
                    <div className="text-muted mb-1" style={{ fontSize: '11.5px' }}>
                      Win Rate (Closing Rate)
                    </div>
                    <div className="fw-bold text-success" style={{ fontSize: '24px' }}>
                      {analytics.winRate}%
                    </div>
                    <div className="text-muted" style={{ fontSize: '11px' }}>
                      {analytics.totalDeals} deal dari {analytics.totalProspects} prospek
                    </div>
                  </div>
                </div>

                <div className="col-6 col-md-3">
                  <div className="p-3 rounded border bg-light text-center">
                    <div className="text-muted mb-1" style={{ fontSize: '11.5px' }}>
                      Rata-Rata Nilai Deal (IDR)
                    </div>
                    <div className="fw-bold" style={{ fontSize: '18px' }}>
                      {formatRupiah(analytics.avgDealSizeIdr)}
                    </div>
                    <div className="text-muted" style={{ fontSize: '11px' }}>
                      Per klien lokal
                    </div>
                  </div>
                </div>

                <div className="col-6 col-md-3">
                  <div className="p-3 rounded border bg-light text-center">
                    <div className="text-muted mb-1" style={{ fontSize: '11.5px' }}>
                      Rata-Rata Nilai Deal (USD)
                    </div>
                    <div className="fw-bold text-primary" style={{ fontSize: '18px' }}>
                      {formatUSD(analytics.avgDealSizeUsd)}
                    </div>
                    <div className="text-muted" style={{ fontSize: '11px' }}>
                      Per klien luar negeri
                    </div>
                  </div>
                </div>

                <div className="col-6 col-md-3">
                  <div className="p-3 rounded border bg-light text-center">
                    <div className="text-muted mb-1" style={{ fontSize: '11.5px' }}>
                      Total Uang Masuk Tim
                    </div>
                    <div className="fw-bold text-success" style={{ fontSize: '15px' }}>
                      {formatRupiah(analytics.totalCashInIdr)}
                    </div>
                    <div className="fw-semibold text-primary" style={{ fontSize: '13px' }}>
                      + {formatUSD(analytics.totalCashInUsd)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Source Platform Conversion Table */}
              <div className="mb-4">
                <div className="d-flex align-items-center justify-content-between mb-2">
                  <div className="fw-bold d-flex align-items-center gap-2" style={{ fontSize: '13.5px' }}>
                    <Globe size={15} />
                    <span>Efektivitas Sumber Hunting Klien (Platform Comparison)</span>
                  </div>
                  <span className="text-muted" style={{ fontSize: '11.5px' }}>
                    Platform mana yang paling banyak menghasilkan closing?
                  </span>
                </div>

                <div className="table-responsive border rounded">
                  <table className="table table-sm table-hover mb-0 align-middle" style={{ fontSize: '12.5px' }}>
                    <thead className="table-light">
                      <tr>
                        <th>Platform</th>
                        <th style={{ width: '120px', textAlign: 'center' }}>Total Prospek</th>
                        <th style={{ width: '120px', textAlign: 'center' }}>Closing (Deal)</th>
                        <th style={{ width: '110px', textAlign: 'center' }}>Konversi (%)</th>
                        <th style={{ width: '170px', textAlign: 'right' }}>Pendapatan Riil</th>
                      </tr>
                    </thead>
                    <tbody>
                      {analytics.platformStats.map((item) => {
                        const conv =
                          item.count > 0
                            ? Math.round((item.dealCount / item.count) * 100)
                            : 0;

                        return (
                          <tr key={item.name}>
                            <td className="fw-semibold">{item.name}</td>
                            <td className="text-center">{item.count} prospek</td>
                            <td className="text-center">
                              <span
                                className={`badge rounded-pill ${
                                  item.dealCount > 0
                                    ? 'bg-success-subtle text-success border border-success-subtle'
                                    : 'bg-light text-muted'
                                }`}
                              >
                                {item.dealCount} Deal
                              </span>
                            </td>
                            <td className="text-center fw-semibold">
                              {conv}%
                            </td>
                            <td className="text-end fw-bold">
                              {item.cashInIdr > 0 && (
                                <div style={{ color: '#166534' }}>
                                  {formatRupiah(item.cashInIdr)}
                                </div>
                              )}
                              {item.cashInUsd > 0 && (
                                <div className="text-primary">
                                  {formatUSD(item.cashInUsd)}
                                </div>
                              )}
                              {item.cashInIdr === 0 && item.cashInUsd === 0 && (
                                <span className="text-muted">-</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Conversion Insight & Tips */}
              <div
                className="p-3 rounded"
                style={{
                  backgroundColor: '#fbfbfa',
                  border: '1px solid #e5e5e5',
                  fontSize: '12px',
                }}
              >
                <div className="fw-semibold mb-1 text-dark">
                  💡 Insight Rekomendasi Hunting:
                </div>
                <div className="text-muted">
                  • <strong>Google Maps</strong> terbukti paling efektif untuk bisnis lokal (Klinik, Resto, Bengkel) dengan rasio respon tercepat via WhatsApp.
                  <br />
                  • <strong>LinkedIn &amp; Instagram</strong> optimal untuk klien bernilai tinggi (ticket size USD) seperti konsultan, arsitek, dan boutique.
                </div>
              </div>
            </div>

            <div className="modal-footer py-2 px-3 border-top bg-light">
              <button type="button" className="btn-notion-outline" onClick={onClose}>
                Tutup
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}