// app/history/page.tsx

'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Store, History as HistoryIcon, Settings, Coffee, Sun, Moon, BarChart3, BookOpen, Download, Trash2, Calculator } from 'lucide-react';
import Link from 'next/link';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function HistoryPage() {
    const [isMounted, setIsMounted] = useState(false);
    const [isDark, setIsDark] = useState(true);

    const [filterMode, setFilterMode] = useState<'DAILY' | 'MONTHLY' | 'YEARLY'>('DAILY');
    const [filterDate, setFilterDate] = useState(new Date().toISOString().split('T')[0]);
    const [filterMonth, setFilterMonth] = useState(new Date().getMonth());
    const [filterYear, setFilterYear] = useState(new Date().getFullYear());

    const [historyData, setHistoryData] = useState<{
        sales: any[];
        totalAmount: number;
        totalProfit: number;
        totalTrx: number;
        qrisCount: number;
        cashCount: number;
    } | null>(null);

    const fetchHistory = async () => {
        let startIso = '';
        let endIso = '';

        if (filterMode === 'DAILY') {
            const d = new Date(filterDate);
            d.setHours(0, 0, 0, 0);
            startIso = d.toISOString();
            const nextD = new Date(d);
            nextD.setDate(nextD.getDate() + 1);
            endIso = nextD.toISOString();
        } else if (filterMode === 'MONTHLY') {
            const d = new Date(filterYear, filterMonth, 1);
            startIso = d.toISOString();
            const nextD = new Date(filterYear, filterMonth + 1, 1);
            endIso = nextD.toISOString();
        } else {
            const d = new Date(filterYear, 0, 1);
            startIso = d.toISOString();
            const nextD = new Date(filterYear + 1, 0, 1);
            endIso = nextD.toISOString();
        }

        const { data: rawSales } = await supabase
            .from('sales')
            .select('*, sale_items(*)')
            .gte('date', startIso)
            .lt('date', endIso)
            .order('id', { ascending: false });

        const { data: rawProducts } = await supabase
            .from('products')
            .select('*');

        const allProducts = rawProducts || [];

        const mappedSales = (rawSales || []).map((s: any) => {
            let realProfit = 0;
            const fixedItems = (s.sale_items || []).map((i: any) => {
                let currentHpp = i.hpp;
                if (!currentHpp || currentHpp === 0) {
                    const master = allProducts.find((p: any) => p.id === i.product_id);
                    currentHpp = master?.hpp_total || 0;
                }
                realProfit += (i.price - currentHpp) * i.quantity;
                return {
                    productId: i.product_id,
                    name: i.name,
                    price: i.price,
                    quantity: i.quantity,
                    hpp: currentHpp
                };
            });

            return {
                id: s.id,
                date: new Date(s.date),
                totalAmount: s.total_amount,
                paymentMethod: s.payment_method,
                status: s.status,
                customerName: s.customer_name,
                cashAmount: s.cash_amount,
                qrisAmount: s.qris_amount,
                totalProfit: realProfit,
                items: fixedItems
            };
        });

        const lunasSales = mappedSales.filter(s => s.status !== 'UNPAID');

        const totalAmount = lunasSales.reduce((sum, sale) => sum + sale.totalAmount, 0);
        const totalProfit = lunasSales.reduce((sum, sale) => sum + (sale.totalProfit || 0), 0);

        const qrisCount = lunasSales.filter(s => s.paymentMethod === 'QRIS' || s.paymentMethod === 'SPLIT').length;
        const cashCount = lunasSales.filter(s => s.paymentMethod === 'CASH' || s.paymentMethod === 'SPLIT').length;

        setHistoryData({
            sales: mappedSales,
            totalAmount,
            totalProfit,
            totalTrx: lunasSales.length,
            qrisCount,
            cashCount
        });
    };

    useEffect(() => {
        setIsMounted(true);
        fetchHistory();

        const channel = supabase
            .channel('realtime-history-channel')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'sales' }, () => {
                fetchHistory();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [filterMode, filterDate, filterMonth, filterYear]);

    const handleDeleteTransaction = async (sale: any) => {
        const namaPelanggan = sale.customerName && sale.customerName !== '-' ? sale.customerName : 'Anonim';

        if (confirm(`Yakin mau hapus riwayat transaksi #TRX-${sale.id} a/n ${namaPelanggan}?\n\nTenang aja, stok menu yang udah dibeli di transaksi ini bakal dibalikin otomatis.`)) {
            try {
                for (const item of sale.items) {
                    if (item.productId && item.productId !== 0) {
                        const { data: p } = await supabase
                            .from('products')
                            .select('stock')
                            .eq('id', item.productId)
                            .single();

                        if (p) {
                            await supabase
                                .from('products')
                                .update({ stock: p.stock + item.quantity })
                                .eq('id', item.productId);
                        }
                    }
                }
                const { error } = await supabase.from('sales').delete().eq('id', sale.id);
                if (error) throw error;

                alert(`Sip! Transaksi #TRX-${sale.id} berhasil dihapus.`);
                fetchHistory();
            } catch (error) {
                console.error(error);
                alert('Waduh, gagal hapus transaksi. Coba lagi ya.');
            }
        }
    };

    const handleExportPDF = () => {
        if (!historyData || historyData.sales.length === 0) return alert('Tidak ada data untuk dicetak!');

        const doc = new jsPDF();
        let titleStr = 'LAPORAN PENJUALAN HARIAN';
        let periodStr = '';

        const monthsIndo = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

        if (filterMode === 'DAILY') {
            const dateObj = new Date(filterDate);
            periodStr = dateObj.toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        } else if (filterMode === 'MONTHLY') {
            titleStr = 'LAPORAN PENJUALAN BULANAN';
            periodStr = `${monthsIndo[filterMonth]} ${filterYear}`;
        } else {
            titleStr = 'LAPORAN PENJUALAN TAHUNAN';
            periodStr = `Tahun ${filterYear}`;
        }

        doc.setFontSize(16);
        doc.text(`JUHBAY COFFEE - ${titleStr}`, 14, 20);
        doc.setFontSize(11);
        doc.text(`Periode: ${periodStr}`, 14, 28);

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

        const tableData = historyData.sales.map((sale) => {
            const d = sale.date;
            const tglJam = `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()} ${d.getHours().toString().padStart(2, '0')}.${d.getMinutes().toString().padStart(2, '0')}`;

            const itemsStr = sale.items.map((i: any) => `- ${i.name} (x${i.quantity})`).join('\n');

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
                2: { cellWidth: 35 },
                4: { cellWidth: 55 },
            }
        });

        let filenameSuffix = filterDate;
        if (filterMode === 'MONTHLY') filenameSuffix = `${filterYear}-${String(filterMonth + 1).padStart(2, '0')}`;
        if (filterMode === 'YEARLY') filenameSuffix = `${filterYear}`;

        doc.save(`Riwayat_Penjualan_${filenameSuffix}.pdf`);
    };

    const d = isDark;
    const monthsList = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

    if (!isMounted) {
        return (
            <div className="h-screen w-screen bg-zinc-950 flex items-center justify-center">
                <p className="text-amber-500 font-black tracking-[0.3em] uppercase text-xs">Memuat Riwayat...</p>
            </div>
        );
    }

    return (
        <div className={`flex h-screen font-sans overflow-hidden transition-colors duration-300 ${d ? 'bg-zinc-950 text-white' : 'bg-zinc-100 text-zinc-900'}`}>

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

            <div className="flex-1 overflow-y-auto p-4 md:p-8">
                <div className="max-w-7xl mx-auto">

                    <div className="flex flex-col xl:flex-row justify-between items-start xl:items-end mb-6 md:mb-8 gap-4">
                        <div>
                            <h2 className="text-xl md:text-3xl font-black tracking-tight mb-1">Riwayat Transaksi</h2>
                            <p className={`text-[10px] md:text-xs font-black uppercase tracking-widest ${d ? 'text-zinc-500' : 'text-zinc-400'}`}>Laporan Penjualan Juhbay</p>
                        </div>

                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full xl:w-auto">
                            <div className={`flex p-1 rounded-xl border self-center w-full sm:w-auto ${d ? 'bg-zinc-900 border-zinc-800' : 'bg-zinc-200/50 border-zinc-300'}`}>
                                <button onClick={() => setFilterMode('DAILY')} className={`flex-1 sm:flex-none px-4 py-2 rounded-lg font-black text-xs uppercase tracking-wider transition-all ${filterMode === 'DAILY' ? 'bg-amber-500 text-black' : d ? 'text-zinc-400 hover:text-white' : 'text-zinc-600 hover:text-black'}`}>Harian</button>
                                <button onClick={() => setFilterMode('MONTHLY')} className={`flex-1 sm:flex-none px-4 py-2 rounded-lg font-black text-xs uppercase tracking-wider transition-all ${filterMode === 'MONTHLY' ? 'bg-amber-500 text-black' : d ? 'text-zinc-400 hover:text-white' : 'text-zinc-600 hover:text-black'}`}>Bulanan</button>
                                <button onClick={() => setFilterMode('YEARLY')} className={`flex-1 sm:flex-none px-4 py-2 rounded-lg font-black text-xs uppercase tracking-wider transition-all ${filterMode === 'YEARLY' ? 'bg-amber-500 text-black' : d ? 'text-zinc-400 hover:text-white' : 'text-zinc-600 hover:text-black'}`}>Tahunan</button>
                            </div>

                            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                                {filterMode === 'DAILY' && (
                                    <input type="date" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} className={`p-2 rounded-xl font-bold text-xs outline-none border w-full sm:w-auto ${d ? 'bg-zinc-900 border-zinc-800 text-white' : 'bg-white border-zinc-300 text-zinc-900'}`} />
                                )}

                                {filterMode === 'MONTHLY' && (
                                    <div className="flex gap-1 w-full sm:w-auto">
                                        <select value={filterMonth} onChange={(e) => setFilterMonth(parseInt(e.target.value))} className={`p-2 rounded-xl font-bold text-xs outline-none border flex-1 sm:flex-none ${d ? 'bg-zinc-900 border-zinc-800 text-white' : 'bg-white border-zinc-300 text-zinc-900'}`}>
                                            {monthsList.map((m, idx) => <option key={idx} value={idx}>{m}</option>)}
                                        </select>
                                        <input type="number" value={filterYear} onChange={(e) => setFilterYear(parseInt(e.target.value))} className={`w-20 p-2 rounded-xl font-bold text-xs outline-none border text-center ${d ? 'bg-zinc-900 border-zinc-800 text-white' : 'bg-white border-zinc-300 text-zinc-900'}`} placeholder="Tahun" />
                                    </div>
                                )}

                                {filterMode === 'YEARLY' && (
                                    <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                                        <span className={`text-xs font-bold ${d ? 'text-zinc-500' : 'text-zinc-400'}`}>Tahun:</span>
                                        <input type="number" value={filterYear} onChange={(e) => setFilterYear(parseInt(e.target.value))} className={`w-24 p-2 rounded-xl font-bold text-xs outline-none border text-center ${d ? 'bg-zinc-900 border-zinc-800 text-white' : 'bg-white border-zinc-300 text-zinc-900'}`} placeholder="Tahun" />
                                    </div>
                                )}

                                <button onClick={handleExportPDF} className="bg-amber-500 hover:bg-amber-400 text-black font-black px-4 py-2 rounded-xl transition-all active:scale-95 text-xs uppercase tracking-widest flex items-center justify-center gap-2 h-[34px] flex-shrink-0"><Download size={14} /> PDF</button>
                            </div>
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
                            <table className="w-full text-left min-w-[800px]">
                                <thead className={`border-b ${d ? 'border-zinc-800' : 'border-zinc-200'}`}>
                                    <tr className={`text-[9px] font-black uppercase tracking-widest ${d ? 'text-zinc-600' : 'text-zinc-400'}`}>
                                        <th className="px-4 py-3">ID</th>
                                        <th className="px-4 py-3">Waktu</th>
                                        <th className="px-4 py-3">Nama Pembeli</th>
                                        <th className="px-4 py-3">Metode</th>
                                        <th className="px-4 py-3">Items</th>
                                        <th className="px-4 py-3 text-right">Total</th>
                                        <th className="px-4 py-3 text-center">Aksi</th>
                                    </tr>
                                </thead>
                                <tbody className={`divide-y ${d ? 'divide-zinc-800/50' : 'divide-zinc-100'}`}>
                                    {(!historyData?.sales || historyData.sales.length === 0) ? (
                                        <tr><td colSpan={7} className="px-4 py-10 text-center"><p className={`text-[10px] font-black uppercase tracking-widest ${d ? 'text-zinc-600' : 'text-zinc-400'}`}>Belum ada transaksi di periode ini</p></td></tr>
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
                                                            {sale.items.map((item: any, idx: number) => {
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
                                                    <td className="px-4 py-3 text-center">
                                                        <button
                                                            onClick={() => handleDeleteTransaction(sale)}
                                                            className={`p-1.5 md:p-2 rounded-lg transition-all mx-auto flex items-center justify-center ${d ? 'text-red-400 bg-red-500/10 hover:bg-red-500/20' : 'text-red-500 bg-red-50 hover:bg-red-100'}`}
                                                            title="Hapus Transaksi"
                                                        >
                                                            <Trash2 size={14} />
                                                        </button>
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