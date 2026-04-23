// app/history/page.tsx

'use client';

import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../lib/db';
import { Store, History as HistoryIcon, Settings, Coffee, Sun, Moon, BarChart3, BookOpen, Download, Trash2, Calculator } from 'lucide-react';
import Link from 'next/link';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function HistoryPage() {
    // ==========================================
    // STATE & VARIABEL
    // ==========================================
    const [isDark, setIsDark] = useState(true);
    const [filterDate, setFilterDate] = useState(new Date().toISOString().split('T')[0]);

    // ==========================================
    // AMBIL DATA TRANSAKSI DARI DATABASE
    // ==========================================
    const historyData = useLiveQuery(async () => {
        const allSales = await db.sales.reverse().toArray();
        const allProducts = await db.products.toArray();

        // Filter berdasarkan tanggal
        const filtered = allSales.filter(sale => {
            const saleDate = new Date(sale.date).toISOString().split('T')[0];
            return saleDate === filterDate;
        });

        // Kalkulasi ulang profit kalau HPP-nya 0 (Kasus transaksi lama / retroaktif)
        const salesWithFix = filtered.map(sale => {
            let realProfit = 0;
            const fixedItems = sale.items.map(item => {
                let currentHpp = item.hpp;
                if (!currentHpp || currentHpp === 0) {
                    const master = allProducts.find(p => p.id === item.productId);
                    currentHpp = master?.hppTotal || 0;
                }
                realProfit += (item.price - currentHpp) * item.quantity;
                return { ...item, hpp: currentHpp };
            });
            return { ...sale, items: fixedItems, totalProfit: realProfit };
        });

        // Hitung dari yang UDAH LUNAS aja buat di kotak ringkasan atas
        const lunasSales = salesWithFix.filter(s => s.status !== 'UNPAID');

        const totalAmount = lunasSales.reduce((sum, sale) => sum + sale.totalAmount, 0);
        const totalProfit = lunasSales.reduce((sum, sale) => sum + (sale.totalProfit || 0), 0);

        const qrisCount = lunasSales.filter(s => s.paymentMethod === 'QRIS' || s.paymentMethod === 'SPLIT').length;
        const cashCount = lunasSales.filter(s => s.paymentMethod === 'CASH' || s.paymentMethod === 'SPLIT').length;

        return {
            sales: salesWithFix,
            totalAmount,
            totalProfit,
            totalTrx: lunasSales.length,
            qrisCount,
            cashCount
        };
    }, [filterDate]);

    // ==========================================
    // FUNGSI EXPORT PDF YANG UDAH DIRAPIHIN
    // ==========================================
    const handleExportPDF = () => {
        if (!historyData || historyData.sales.length === 0) return alert('Tidak ada data untuk dicetak!');

        const doc = new jsPDF();
        const dateObj = new Date(filterDate);
        const dateStr = dateObj.toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

        doc.setFontSize(16);
        doc.text('LAPORAN PENJUALAN JUHBAY COFFEE', 14, 20);
        doc.setFontSize(11);
        doc.text(`Tanggal: ${dateStr}`, 14, 28);

        // TABEL 1: RINGKASAN HARIAN
        autoTable(doc, {
            startY: 35,
            head: [['Ringkasan Laporan', 'Total']],
            body: [
                ['Total Transaksi Lunas', `${historyData.totalTrx} Trx`],
                ['Transaksi via CASH', `${historyData.cashCount} Trx`],
                ['Transaksi via QRIS', `${historyData.qrisCount} Trx`],
                ['Total Omzet Kotor', `Rp ${historyData.totalAmount.toLocaleString('id-ID')}`],
                ['Total Hasil Bersih (Profit)', `Rp ${historyData.totalProfit.toLocaleString('id-ID')}`]
            ],
            theme: 'grid',
            headStyles: { fillColor: [245, 158, 11] },
            styles: { fontSize: 10, fontStyle: 'bold' }
        });

        // TABEL 2: DETAIL TRANSAKSI
        const tableData = historyData.sales.map((sale) => {
            const d = sale.date;
            const tglJam = `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()} ${d.getHours().toString().padStart(2, '0')}.${d.getMinutes().toString().padStart(2, '0')}`;

            // Format orderan dibikin enter ke bawah biar rapih, nggak nyamping
            const itemsStr = sale.items.map(i => `- ${i.name} (x${i.quantity})`).join('\n');

            const methodDisplay = sale.paymentMethod === 'SPLIT'
                ? `SPLIT\n(C: ${sale.cashAmount}, Q: ${sale.qrisAmount})`
                : sale.paymentMethod;

            const isUnpaid = sale.status === 'UNPAID' ? '[BELUM BAYAR]\n' : '';

            return [
                `#TRX-${sale.id}`,
                tglJam,
                sale.customerName && sale.customerName !== '-' ? sale.customerName : 'Anonim',
                isUnpaid + methodDisplay,
                itemsStr,
                `Rp ${sale.totalAmount.toLocaleString('id-ID')}`
            ];
        });

        autoTable(doc, {
            startY: (doc as any).lastAutoTable.finalY + 10,
            head: [['ID', 'Waktu', 'Nama Pembeli', 'Metode', 'Orderan', 'Total']],
            body: tableData,
            theme: 'striped',
            headStyles: { fillColor: [39, 39, 42] },
            styles: { fontSize: 8, cellPadding: 2 },
            columnStyles: {
                2: { cellWidth: 35 }, // Kolom Nama Pembeli dilebarin
                4: { cellWidth: 55 }, // Kolom Detail Orderan dilebarin
            }
        });

        doc.save(`Riwayat_Penjualan_${filterDate}.pdf`);
    };

    // ==========================================
    // FUNGSI HAPUS HISTORY HARIAN
    // ==========================================
    const handleClearHistory = async () => {
        if (confirm('YAKIN MAU HAPUS SEMUA RIWAYAT DI TANGGAL INI? Data nggak bisa dibalikin lho!')) {
            const idsToDelete = historyData?.sales.map(s => s.id as number) || [];
            await db.sales.bulkDelete(idsToDelete);
            alert('Riwayat di tanggal ini berhasil dibersihkan!');
        }
    };

    const d = isDark;

    return (
        <div className={`flex h-screen font-sans overflow-hidden transition-colors duration-300 ${d ? 'bg-zinc-950 text-white' : 'bg-zinc-100 text-zinc-900'}`}>

            {/* SIDEBAR NAVIGATION */}
            <div className={`w-14 md:w-56 flex flex-col p-2 md:p-4 gap-1 border-r z-20 flex-shrink-0 ${d ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200'}`}>
                <div className="px-2 py-4 mb-2 hidden md:block">
                    <p className="text-[9px] font-black text-amber-500 tracking-[0.3em] uppercase mb-1">EST. 2024</p>
                    <h1 className="text-base font-black tracking-tight leading-none">Juhbay Coffee</h1>
                </div>
                <div className="flex justify-center md:hidden py-3"><Coffee size={20} className="text-amber-500" /></div>

                <Link href="/" className={`flex items-center justify-center md:justify-start gap-3 p-3 rounded-xl font-bold text-xs transition-all ${d ? 'text-zinc-500 hover:bg-zinc-800 hover:text-white' : 'text-zinc-400 hover:bg-zinc-100 hover:text-zinc-900'}`}>
                    <Store size={17} /> <span className="hidden md:block tracking-wide">Kasir</span>
                </Link>
                <Link href="/history" className="flex items-center justify-center md:justify-start gap-3 p-3 rounded-xl bg-amber-500 text-black font-black text-xs transition-all">
                    <HistoryIcon size={17} /> <span className="hidden md:block tracking-wide">Riwayat</span>
                </Link>
                <Link href="/manage" className={`flex items-center justify-center md:justify-start gap-3 p-3 rounded-xl font-bold text-xs transition-all ${d ? 'text-zinc-500 hover:bg-zinc-800 hover:text-white' : 'text-zinc-400 hover:bg-zinc-100 hover:text-zinc-900'}`}>
                    <Settings size={17} /> <span className="hidden md:block tracking-wide">Kelola Menu</span>
                </Link>
                <Link href="/hpp" className={`flex items-center justify-center md:justify-start gap-3 p-3 rounded-xl font-bold text-xs transition-all ${d ? 'text-zinc-500 hover:bg-zinc-800 hover:text-white' : 'text-zinc-400 hover:bg-zinc-100 hover:text-zinc-900'}`}>
                    <Calculator size={17} /> <span className="hidden md:block tracking-wide">Kelola HPP</span>
                </Link>
                <Link href="/hutang" className={`flex items-center justify-center md:justify-start gap-3 p-3 rounded-xl font-bold text-xs transition-all ${d ? 'text-zinc-500 hover:bg-zinc-800 hover:text-white' : 'text-zinc-400 hover:bg-zinc-100 hover:text-zinc-900'}`}>
                    <BookOpen size={17} /> <span className="hidden md:block tracking-wide">Buku Hutang</span>
                </Link>
                <Link href="/dashboard" className={`flex items-center justify-center md:justify-start gap-3 p-3 rounded-xl font-bold text-xs transition-all ${d ? 'text-zinc-500 hover:bg-zinc-800 hover:text-white' : 'text-zinc-400 hover:bg-zinc-100 hover:text-zinc-900'}`}>
                    <BarChart3 size={17} /> <span className="hidden md:block tracking-wide">Dashboard</span>
                </Link>

                <div className="mt-auto mb-2"><button onClick={() => setIsDark(!d)} className={`flex items-center justify-center md:justify-start gap-3 p-3 w-full rounded-xl font-bold text-xs transition-all ${d ? 'text-zinc-600 hover:bg-zinc-800 hover:text-white' : 'text-zinc-400 hover:bg-zinc-100 hover:text-zinc-900'}`}>{d ? <Sun size={17} /> : <Moon size={17} />}<span className="hidden md:block">{d ? 'Light Mode' : 'Dark Mode'}</span></button></div>
            </div>

            {/* MAIN CONTENT AREA */}
            <div className="flex-1 overflow-y-auto p-4 md:p-8">
                <div className="max-w-6xl mx-auto">

                    <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-6 md:mb-8 gap-4">
                        <div>
                            <h2 className="text-xl md:text-3xl font-black tracking-tight mb-1">History</h2>
                            <p className={`text-[10px] md:text-xs font-black uppercase tracking-widest ${d ? 'text-zinc-500' : 'text-zinc-400'}`}>Laporan Penjualan</p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 md:gap-3 w-full md:w-auto">
                            <input type="date" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} className={`flex-1 md:flex-none p-2 md:p-2.5 rounded-xl font-bold text-xs outline-none border ${d ? 'bg-zinc-900 border-zinc-800 text-white' : 'bg-white border-zinc-200 text-zinc-900'}`} />
                            <button onClick={handleExportPDF} className="bg-amber-500 hover:bg-amber-400 text-black font-black px-3 md:px-4 py-2 md:py-2.5 rounded-xl transition-all active:scale-95 text-[10px] md:text-xs uppercase tracking-widest flex items-center gap-1.5 md:gap-2"><Download size={14} /> PDF</button>
                            <button onClick={handleClearHistory} className={`border border-red-500/50 text-red-500 hover:bg-red-500/10 font-black px-3 md:px-4 py-2 md:py-2.5 rounded-xl transition-all active:scale-95 text-[10px] md:text-xs uppercase tracking-widest flex items-center gap-1.5 md:gap-2`}><Trash2 size={14} /> Hapus</button>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3 md:gap-4 mb-6 md:mb-8">
                        <div className={`p-4 rounded-2xl border ${d ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200'}`}>
                            <p className={`text-[9px] md:text-[10px] font-black uppercase tracking-widest mb-1.5 md:mb-2 ${d ? 'text-zinc-500' : 'text-zinc-400'}`}>Total Trx</p>
                            <h3 className="text-lg md:text-xl font-black">{historyData?.totalTrx || 0}</h3>
                        </div>
                        <div className={`p-4 rounded-2xl border ${d ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200'}`}>
                            <p className={`text-[9px] md:text-[10px] font-black uppercase tracking-widest mb-1.5 md:mb-2 ${d ? 'text-zinc-500' : 'text-zinc-400'}`}>Via CASH</p>
                            <h3 className="text-lg md:text-xl font-black text-green-500">{historyData?.cashCount || 0} <span className="text-[10px] font-bold text-zinc-500">trx</span></h3>
                        </div>
                        <div className={`p-4 rounded-2xl border ${d ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200'}`}>
                            <p className={`text-[9px] md:text-[10px] font-black uppercase tracking-widest mb-1.5 md:mb-2 ${d ? 'text-zinc-500' : 'text-zinc-400'}`}>Via QRIS</p>
                            <h3 className="text-lg md:text-xl font-black text-purple-500">{historyData?.qrisCount || 0} <span className="text-[10px] font-bold text-zinc-500">trx</span></h3>
                        </div>
                        <div className={`p-4 rounded-2xl border ${d ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200'}`}>
                            <p className={`text-[9px] md:text-[10px] font-black uppercase tracking-widest mb-1.5 md:mb-2 ${d ? 'text-zinc-500' : 'text-zinc-400'}`}>Omzet Kotor</p>
                            <h3 className="text-lg md:text-xl font-black truncate text-blue-500">Rp {historyData?.totalAmount.toLocaleString('id-ID') || 0}</h3>
                        </div>
                        <div className={`p-4 rounded-2xl border ${d ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200'}`}>
                            <p className={`text-[9px] md:text-[10px] font-black uppercase tracking-widest mb-1.5 md:mb-2 ${d ? 'text-zinc-500' : 'text-zinc-400'}`}>Hasil Bersih</p>
                            <h3 className="text-lg md:text-xl font-black truncate text-green-500">Rp {historyData?.totalProfit.toLocaleString('id-ID') || 0}</h3>
                        </div>
                    </div>

                    <div className={`rounded-2xl border overflow-hidden ${d ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200'}`}>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left min-w-[700px]">
                                <thead className={`border-b ${d ? 'border-zinc-800' : 'border-zinc-200'}`}>
                                    <tr className={`text-[9px] font-black uppercase tracking-widest ${d ? 'text-zinc-600' : 'text-zinc-400'}`}>
                                        <th className="px-4 py-3">ID</th>
                                        <th className="px-4 py-3">Waktu</th>
                                        <th className="px-4 py-3">Nama Pembeli</th>
                                        <th className="px-4 py-3">Metode</th>
                                        <th className="px-4 py-3">Items</th>
                                        <th className="px-4 py-3 text-right">Total</th>
                                    </tr>
                                </thead>
                                <tbody className={`divide-y ${d ? 'divide-zinc-800/50' : 'divide-zinc-100'}`}>
                                    {(!historyData?.sales || historyData.sales.length === 0) ? (
                                        <tr><td colSpan={6} className="px-4 py-10 text-center"><p className={`text-[10px] font-black uppercase tracking-widest ${d ? 'text-zinc-600' : 'text-zinc-400'}`}>Belum ada transaksi</p></td></tr>
                                    ) : (
                                        historyData.sales.map((sale) => {
                                            const sDate = sale.date;
                                            const tgl = `${sDate.getDate().toString().padStart(2, '0')}/${(sDate.getMonth() + 1).toString().padStart(2, '0')}/${sDate.getFullYear()}`;
                                            const jam = `${sDate.getHours().toString().padStart(2, '0')}.${sDate.getMinutes().toString().padStart(2, '0')}`;

                                            const isKasbon = sale.status === 'UNPAID';

                                            return (
                                                <tr key={sale.id} className={`transition-colors ${isKasbon ? (d ? 'bg-red-950/20' : 'bg-red-50') : (d ? 'hover:bg-zinc-800/50' : 'hover:bg-zinc-50')}`}>
                                                    <td className="px-4 py-3"><span className="text-[10px] font-black text-amber-500">#TRX-{sale.id}</span></td>
                                                    <td className="px-4 py-3"><div className="flex flex-col"><span className={`text-[9px] font-bold ${d ? 'text-zinc-300' : 'text-zinc-700'}`}>{tgl}</span><span className={`text-[8px] font-black ${d ? 'text-zinc-500' : 'text-zinc-400'}`}>{jam}</span></div></td>

                                                    {/* Keliatan Nama Pembelinya Lebih Tegas */}
                                                    <td className="px-4 py-3"><span className={`text-[11px] font-bold ${d ? 'text-zinc-300' : 'text-zinc-700'}`}>{sale.customerName && sale.customerName !== '-' ? sale.customerName : <span className="opacity-50 italic">Anonim</span>}</span></td>

                                                    <td className="px-4 py-3">
                                                        <div className="flex flex-col items-start gap-1">
                                                            {isKasbon ? (
                                                                <span className="text-[8px] font-black uppercase tracking-widest px-2 py-1 rounded-md border bg-red-500/10 text-red-500 border-red-500/20">BELUM BAYAR</span>
                                                            ) : (
                                                                <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-1 rounded-md border ${sale.paymentMethod === 'QRIS' ? 'bg-blue-500/10 text-blue-500 border-blue-500/20' : sale.paymentMethod === 'CASH' ? 'bg-green-500/10 text-green-500 border-green-500/20' : sale.paymentMethod === 'SPLIT' ? 'bg-purple-500/10 text-purple-500 border-purple-500/20' : 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20'}`}>{sale.paymentMethod}</span>
                                                            )}
                                                            {sale.paymentMethod === 'SPLIT' && !isKasbon && (
                                                                <div className={`text-[7px] font-bold mt-1 leading-tight ${d ? 'text-zinc-400' : 'text-zinc-500'}`}>
                                                                    C: {sale.cashAmount?.toLocaleString('id-ID')}<br />
                                                                    Q: {sale.qrisAmount?.toLocaleString('id-ID')}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <div className="space-y-2">
                                                            {sale.items.map((item, idx) => {
                                                                const profitPerItem = (item.price - (item.hpp || 0)) * item.quantity;
                                                                return (
                                                                    <div key={idx} className={`flex flex-col ${d ? 'text-zinc-300' : 'text-zinc-700'}`}>
                                                                        <div className="text-[10px] font-bold">
                                                                            {item.name} <span className="text-amber-500 ml-1">x{item.quantity}</span>
                                                                        </div>
                                                                        {!isKasbon && (
                                                                            <div className="text-[8px] font-bold text-green-500">
                                                                                Hasil Bersih: Rp {profitPerItem.toLocaleString('id-ID')}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3 text-right">
                                                        <span className="text-xs font-black block">Rp {sale.totalAmount.toLocaleString('id-ID')}</span>
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}