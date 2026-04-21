// ini history

'use client';

import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../lib/db';
import { History, Settings, Store, Download, Trash2, Coffee, Sun, Moon } from 'lucide-react'; // Tambah Trash2
import Link from 'next/link';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function HistoryPage() {
    const [filterDate, setFilterDate] = useState(new Date().toISOString().split('T')[0]);
    const [reportType, setReportType] = useState<'daily' | 'monthly'>('daily');
    const [isDark, setIsDark] = useState(true);

    const salesHistory = useLiveQuery(async () => {
        const parts = filterDate.split('-');
        const y = parseInt(parts[0]), m = parseInt(parts[1]) - 1, d = parseInt(parts[2]);
        let start, end;
        if (reportType === 'daily') {
            start = new Date(y, m, d, 0, 0, 0, 0);
            end = new Date(y, m, d, 23, 59, 59, 999);
        } else {
            start = new Date(y, m, 1, 0, 0, 0, 0);
            end = new Date(y, m + 1, 0, 23, 59, 59, 999);
        }
        return await db.sales.where('date').between(start, end).reverse().toArray();
    }, [filterDate, reportType]);

    const clearHistory = async () => {
        const confirmDelete = confirm("Serius mau hapus semua riwayat penjualan? Data ini nggak bisa dikembalikan!");
        if (confirmDelete) {
            await db.sales.clear();
            alert("History berhasil dibersihkan!");
        }
    };

    const exportPDF = () => {
        const doc = new jsPDF();
        doc.text("JUHBAY COFFEE - LAPORAN PENJUALAN", 14, 20);
        const data = salesHistory?.map(s => [
            s.id || '-',
            new Date(s.date).toLocaleString(),
            s.paymentMethod || 'CASH',
            s.items.map(i => `${i.name} (x${i.quantity})`).join(', '),
            `Rp ${s.totalAmount.toLocaleString('id-ID')}`
        ]);
        autoTable(doc, {
            startY: 30,
            head: [['ID', 'WAKTU', 'METODE', 'ITEM', 'TOTAL']],
            body: data || []
        });
        doc.save(`Laporan_${filterDate}.pdf`);
    };

    const d = isDark;

    return (
        <div className={`flex h-screen font-sans overflow-hidden transition-colors duration-300 ${d ? 'bg-zinc-950 text-white' : 'bg-zinc-100 text-zinc-900'}`}>

            {/* SIDEBAR */}
            <div className={`w-14 md:w-56 flex flex-col p-2 md:p-4 gap-1 border-r z-20 flex-shrink-0 ${d ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200'}`}>
                <div className="px-2 py-4 mb-2 hidden md:block">
                    <p className="text-[9px] font-black text-amber-500 tracking-[0.3em] uppercase mb-1">EST. 2024</p>
                    <h1 className="text-base font-black tracking-tight leading-none">Juhbay Coffee</h1>
                </div>
                <div className="flex justify-center md:hidden py-3">
                    <Coffee size={20} className="text-amber-500" />
                </div>

                <Link href="/" className={`flex items-center justify-center md:justify-start gap-3 p-3 rounded-xl font-bold text-xs transition-all ${d ? 'text-zinc-500 hover:bg-zinc-800 hover:text-white' : 'text-zinc-400 hover:bg-zinc-100 hover:text-zinc-900'}`}>
                    <Store size={17} /> <span className="hidden md:block tracking-wide">Kasir</span>
                </Link>
                <Link href="/history" className="flex items-center justify-center md:justify-start gap-3 p-3 rounded-xl bg-amber-500 text-black font-black text-xs transition-all">
                    <History size={17} /> <span className="hidden md:block tracking-wide">Riwayat</span>
                </Link>
                <Link href="/manage" className={`flex items-center justify-center md:justify-start gap-3 p-3 rounded-xl font-bold text-xs transition-all ${d ? 'text-zinc-500 hover:bg-zinc-800 hover:text-white' : 'text-zinc-400 hover:bg-zinc-100 hover:text-zinc-900'}`}>
                    <Settings size={17} /> <span className="hidden md:block tracking-wide">Kelola Menu</span>
                </Link>

                <div className="mt-auto">
                    <button onClick={() => setIsDark(!d)} className={`flex items-center justify-center md:justify-start gap-3 p-3 w-full rounded-xl font-bold text-xs transition-all ${d ? 'text-zinc-600 hover:bg-zinc-800 hover:text-white' : 'text-zinc-400 hover:bg-zinc-100 hover:text-zinc-900'}`}>
                        {d ? <Sun size={17} /> : <Moon size={17} />}
                        <span className="hidden md:block">{d ? 'Light Mode' : 'Dark Mode'}</span>
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 md:p-8">
                <div className="max-w-5xl mx-auto">

                    {/* Header */}
                    <div className="flex flex-col sm:flex-row justify-between sm:items-end gap-4 mb-8">
                        <div>
                            <h2 className="text-2xl md:text-3xl font-black tracking-tight mb-1">History</h2>
                            <p className={`font-bold text-xs uppercase tracking-widest ${d ? 'text-zinc-600' : 'text-zinc-400'}`}>Laporan Penjualan</p>
                        </div>

                        {/* Controls */}
                        <div className={`flex flex-wrap gap-2 p-2 rounded-2xl border ${d ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200 shadow-sm'}`}>
                            <select value={reportType} onChange={e => setReportType(e.target.value as any)}
                                className={`font-bold text-xs p-2 outline-none rounded-xl border ${d ? 'bg-zinc-800 border-zinc-700 text-white' : 'bg-zinc-50 border-zinc-200 text-zinc-800'}`}>
                                <option value="daily">Harian</option>
                                <option value="monthly">Bulanan</option>
                            </select>
                            <input type={reportType === 'daily' ? "date" : "month"} value={filterDate} onChange={e => setFilterDate(e.target.value)}
                                className={`font-bold text-xs p-2 outline-none rounded-xl border ${d ? 'bg-zinc-800 border-zinc-700 text-white' : 'bg-zinc-50 border-zinc-200 text-zinc-800'}`} />
                            <button onClick={exportPDF} className="bg-amber-500 hover:bg-amber-400 text-black px-4 py-2 rounded-xl font-black text-xs flex items-center gap-1.5 transition-all tracking-wider uppercase">
                                <Download size={14} /> PDF
                            </button>

                            {/* TOMBOL HAPUS SEMUA */}
                            <button onClick={clearHistory} className={`px-4 py-2 rounded-xl font-black text-xs flex items-center gap-1.5 transition-all tracking-wider uppercase ${d ? 'bg-zinc-800 text-red-500 hover:bg-red-500 hover:text-white border border-zinc-700' : 'bg-red-50 text-red-600 hover:bg-red-600 hover:text-white'}`}>
                                <Trash2 size={14} /> Hapus
                            </button>
                        </div>
                    </div>

                    {/* Ringkasan total */}
                    {salesHistory && salesHistory.length > 0 && (
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
                            <div className={`p-4 rounded-2xl border ${d ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200 shadow-sm'}`}>
                                <p className={`text-[9px] font-black uppercase tracking-widest mb-1 ${d ? 'text-zinc-600' : 'text-zinc-400'}`}>Transaksi</p>
                                <p className="text-xl font-black">{salesHistory.length}</p>
                            </div>
                            <div className={`p-4 rounded-2xl border ${d ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200 shadow-sm'}`}>
                                <p className={`text-[9px] font-black uppercase tracking-widest mb-1 ${d ? 'text-zinc-600' : 'text-zinc-400'}`}>Total</p>
                                <p className="text-xl font-black">Rp {salesHistory.reduce((s, i) => s + i.totalAmount, 0).toLocaleString('id-ID')}</p>
                            </div>
                            <div className={`p-4 rounded-2xl border col-span-2 sm:col-span-1 ${d ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200 shadow-sm'}`}>
                                <p className={`text-[9px] font-black uppercase tracking-widest mb-1 ${d ? 'text-zinc-600' : 'text-zinc-400'}`}>QRIS</p>
                                <p className="text-xl font-black">{salesHistory.filter(s => s.paymentMethod === 'QRIS').length} trx</p>
                            </div>
                        </div>
                    )}

                    {/* Tabel */}
                    <div className={`rounded-2xl border overflow-hidden ${d ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200 shadow-sm'}`}>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left min-w-[600px]">
                                <thead className={`border-b ${d ? 'bg-zinc-950 border-zinc-800' : 'bg-zinc-50 border-zinc-200'}`}>
                                    <tr className={`text-[9px] font-black uppercase tracking-widest ${d ? 'text-zinc-600' : 'text-zinc-400'}`}>
                                        <th className="p-4 md:p-5">ID</th>
                                        <th className="p-4 md:p-5">Waktu</th>
                                        <th className="p-4 md:p-5">Metode</th>
                                        <th className="p-4 md:p-5">Items</th>
                                        <th className="p-4 md:p-5 text-right">Total</th>
                                    </tr>
                                </thead>
                                <tbody className={`divide-y ${d ? 'divide-zinc-800' : 'divide-zinc-100'}`}>
                                    {salesHistory?.map(s => (
                                        <tr key={s.id} className={`transition-colors ${d ? 'hover:bg-zinc-800' : 'hover:bg-amber-50/40'}`}>
                                            <td className={`p-4 md:p-5 font-mono font-bold text-xs ${d ? 'text-amber-500' : 'text-amber-700'}`}>#TRX-{s.id}</td>
                                            <td className={`p-4 md:p-5 font-bold text-xs ${d ? 'text-zinc-500' : 'text-zinc-400'}`}>
                                                {new Date(s.date).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                                            </td>
                                            <td className="p-4 md:p-5">
                                                <span className={`text-[9px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider
                                                    ${s.paymentMethod === 'QRIS'
                                                        ? d ? 'bg-blue-500/10 text-blue-400' : 'bg-blue-100 text-blue-700'
                                                        : d ? 'bg-green-500/10 text-green-400' : 'bg-green-100 text-green-700'
                                                    }`}>
                                                    {s.paymentMethod || 'CASH'}
                                                </span>
                                            </td>
                                            <td className="p-4 md:p-5">
                                                {s.items.map((it, idx) => (
                                                    <div key={idx} className={`text-xs font-bold ${d ? 'text-zinc-300' : 'text-zinc-700'}`}>
                                                        {it.name} <span className={`font-black ${d ? 'text-amber-500' : 'text-amber-600'}`}>x{it.quantity}</span>
                                                    </div>
                                                ))}
                                            </td>
                                            <td className="p-4 md:p-5 text-right font-black text-base tracking-tight">
                                                Rp {s.totalAmount.toLocaleString('id-ID')}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        {(!salesHistory || salesHistory.length === 0) && (
                            <div className={`py-16 text-center font-black text-xs uppercase tracking-widest ${d ? 'text-zinc-700' : 'text-zinc-300'}`}>
                                Tidak ada data
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}