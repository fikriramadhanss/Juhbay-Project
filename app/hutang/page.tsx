// app/hutang/page.tsx

'use client';

import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../lib/db';
import { Store, History, Settings, Coffee, Sun, Moon, BarChart3, BookOpen, CheckCircle, Banknote, QrCode, X, Trash2, SplitSquareHorizontal } from 'lucide-react';
import Link from 'next/link';

export default function HutangPage() {
    const [isDark, setIsDark] = useState(true);
    const [payModal, setPayModal] = useState<any>(null);
    const [activeMethod, setActiveMethod] = useState<'CASH' | 'QRIS' | 'SPLIT'>('CASH');
    const [splitCashInput, setSplitCashInput] = useState('');

    const hutangList = useLiveQuery(async () => {
        const all = await db.sales.toArray();
        return all.filter(s => s.status === 'UNPAID').reverse();
    });

    const prosesLunasin = async () => {
        if (!payModal) return;

        const cAmount = activeMethod === 'SPLIT' ? parseInt(splitCashInput || '0') : (activeMethod === 'CASH' ? payModal.totalAmount : 0);
        const qAmount = activeMethod === 'SPLIT' ? (payModal.totalAmount - cAmount) : (activeMethod === 'QRIS' ? payModal.totalAmount : 0);

        if (activeMethod === 'SPLIT' && (cAmount < 0 || cAmount > payModal.totalAmount)) {
            return alert('Nominal Cash tidak valid!');
        }

        if (activeMethod === 'QRIS' || activeMethod === 'SPLIT') {
            if (!window.confirm(`PENTING: Saldo QRIS sebesar Rp ${qAmount.toLocaleString('id-ID')} udah beneran masuk?`)) return;
        }

        await db.sales.update(payModal.id, {
            status: 'PAID',
            paymentMethod: activeMethod,
            cashAmount: cAmount,
            qrisAmount: qAmount,
            date: new Date()
        });

        setPayModal(null);
        setSplitCashInput('');
        alert(`Mantap! Hutang a/n ${payModal.customerName} udah LUNAS.`);
    };

    const batalinHutang = async (h: any) => {
        if (!confirm(`Yakin mau batalin kasbon a/n ${h.customerName}? Stok menu bakal dibalikin otomatis.`)) return;
        try {
            for (const item of h.items) {
                const p = await db.products.get(item.productId);
                if (p) await db.products.update(item.productId, { stock: p.stock + item.quantity });
            }
            await db.sales.delete(h.id);
            alert(`Kasbon a/n ${h.customerName} berhasil dibatalin dan stok udah balik!`);
        } catch (error) {
            alert('Gagal batalin transaksi!');
        }
    };

    const d = isDark;

    return (
        <div className={`flex h-screen font-sans overflow-hidden transition-colors duration-300 ${d ? 'bg-zinc-950 text-white' : 'bg-zinc-100 text-zinc-900'}`}>

            {/* MODAL LUNASIN */}
            {payModal && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className={`rounded-2xl p-5 md:p-6 w-full max-w-sm shadow-2xl border ${d ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200'}`}>
                        <div className="flex justify-between items-center mb-5">
                            <h3 className="text-xs md:text-sm font-black uppercase tracking-widest text-amber-500">Pilih Pembayaran Lunas</h3>
                            <button onClick={() => setPayModal(null)} className={`p-1.5 rounded-lg ${d ? 'hover:bg-zinc-800' : 'hover:bg-zinc-100'}`}><X size={16} /></button>
                        </div>
                        <p className="text-[11px] md:text-xs mb-4">Lunasin hutang <strong>{payModal.customerName}</strong> sebesar <strong className="text-amber-500 block text-lg md:inline md:text-xs">Rp {payModal.totalAmount.toLocaleString('id-ID')}</strong></p>

                        <div className="flex gap-2 mb-4">
                            <button onClick={() => setActiveMethod('CASH')} className={`flex-1 py-2 md:py-2.5 rounded-xl font-black text-[9px] md:text-[10px] tracking-wider ${activeMethod === 'CASH' ? 'bg-amber-500 text-black' : d ? 'bg-zinc-800 text-zinc-400' : 'bg-zinc-100 text-zinc-500'}`}>CASH</button>
                            <button onClick={() => setActiveMethod('QRIS')} className={`flex-1 py-2 md:py-2.5 rounded-xl font-black text-[9px] md:text-[10px] tracking-wider ${activeMethod === 'QRIS' ? 'bg-blue-600 text-white' : d ? 'bg-zinc-800 text-zinc-400' : 'bg-zinc-100 text-zinc-500'}`}>QRIS</button>
                            <button onClick={() => setActiveMethod('SPLIT')} className={`flex-1 py-2 md:py-2.5 rounded-xl font-black text-[9px] md:text-[10px] tracking-wider ${activeMethod === 'SPLIT' ? 'bg-purple-500 text-white' : d ? 'bg-zinc-800 text-zinc-400' : 'bg-zinc-100 text-zinc-500'}`}>SPLIT</button>
                        </div>

                        {activeMethod === 'SPLIT' && (
                            <div className="mb-4">
                                <label className={`text-[9px] font-black uppercase tracking-widest block mb-1 ${d ? 'text-zinc-400' : 'text-zinc-500'}`}>Nominal Cash</label>
                                <input type="number" value={splitCashInput} onChange={e => setSplitCashInput(e.target.value)}
                                    className={`w-full p-2.5 rounded-xl font-bold outline-none border text-xs mb-2 ${d ? 'bg-zinc-800 border-zinc-700 text-white' : 'bg-zinc-50 border-zinc-200 text-zinc-900'}`} placeholder="Masukkan nominal..." />
                                <p className={`text-[9px] font-bold ${d ? 'text-zinc-400' : 'text-zinc-500'}`}>
                                    Sisa QRIS: <span className="text-purple-500">Rp {(payModal.totalAmount - (parseInt(splitCashInput) || 0)).toLocaleString('id-ID')}</span>
                                </p>
                            </div>
                        )}

                        <button onClick={prosesLunasin} className="w-full bg-green-500 hover:bg-green-400 text-white font-black py-3 md:py-3.5 rounded-xl flex justify-center items-center gap-2 text-[10px] md:text-xs uppercase tracking-widest">
                            <CheckCircle size={14} /> Konfirmasi Lunas
                        </button>
                    </div>
                </div>
            )}

            {/* SIDEBAR NAVIGATION (URUTAN SUDAH BENAR) */}
            <div className={`w-14 md:w-56 flex flex-col p-2 md:p-4 gap-1 border-r z-20 flex-shrink-0 ${d ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200'}`}>
                <div className="px-2 py-4 mb-2 hidden md:block">
                    <p className="text-[9px] font-black text-amber-500 tracking-[0.3em] uppercase mb-1">EST. 2024</p>
                    <h1 className="text-base font-black tracking-tight leading-none">Juhbay Coffee</h1>
                </div>
                <div className="flex justify-center md:hidden py-3"><Coffee size={20} className="text-amber-500" /></div>

                <Link href="/" className={`flex items-center justify-center md:justify-start gap-3 p-3 rounded-xl font-bold text-xs transition-all ${d ? 'text-zinc-500 hover:bg-zinc-800 hover:text-white' : 'text-zinc-400 hover:bg-zinc-100 hover:text-zinc-900'}`}>
                    <Store size={17} /> <span className="hidden md:block tracking-wide">Kasir</span>
                </Link>
                <Link href="/history" className={`flex items-center justify-center md:justify-start gap-3 p-3 rounded-xl font-bold text-xs transition-all ${d ? 'text-zinc-500 hover:bg-zinc-800 hover:text-white' : 'text-zinc-400 hover:bg-zinc-100 hover:text-zinc-900'}`}>
                    <History size={17} /> <span className="hidden md:block tracking-wide">Riwayat</span>
                </Link>
                <Link href="/manage" className={`flex items-center justify-center md:justify-start gap-3 p-3 rounded-xl font-bold text-xs transition-all ${d ? 'text-zinc-500 hover:bg-zinc-800 hover:text-white' : 'text-zinc-400 hover:bg-zinc-100 hover:text-zinc-900'}`}>
                    <Settings size={17} /> <span className="hidden md:block tracking-wide">Kelola Menu</span>
                </Link>
                <Link href="/hutang" className="flex items-center justify-center md:justify-start gap-3 p-3 rounded-xl bg-amber-500 text-black font-black text-xs transition-all">
                    <BookOpen size={17} /> <span className="hidden md:block tracking-wide">Buku Hutang</span>
                </Link>
                <Link href="/dashboard" className={`flex items-center justify-center md:justify-start gap-3 p-3 rounded-xl font-bold text-xs transition-all ${d ? 'text-zinc-500 hover:bg-zinc-800 hover:text-white' : 'text-zinc-400 hover:bg-zinc-100 hover:text-zinc-900'}`}>
                    <BarChart3 size={17} /> <span className="hidden md:block tracking-wide">Dashboard</span>
                </Link>

                <div className="mt-auto mb-2"><button onClick={() => setIsDark(!d)} className={`flex items-center justify-center md:justify-start gap-3 p-3 w-full rounded-xl font-bold text-xs transition-all ${d ? 'text-zinc-600 hover:bg-zinc-800 hover:text-white' : 'text-zinc-400 hover:bg-zinc-100 hover:text-zinc-900'}`}>{d ? <Sun size={17} /> : <Moon size={17} />}<span className="hidden md:block">{d ? 'Light Mode' : 'Dark Mode'}</span></button></div>
            </div>

            {/* MAIN CONTENT */}
            <div className="flex-1 overflow-hidden flex flex-col min-w-0">
                <div className={`flex flex-col sm:flex-row items-start sm:items-center justify-between px-4 sm:px-8 py-4 border-b flex-shrink-0 gap-2 ${d ? 'border-zinc-800 bg-zinc-900' : 'border-zinc-200 bg-white'}`}>
                    <div>
                        <h2 className="text-xl sm:text-base font-black tracking-tight">Buku Hutang & Kasbon</h2>
                        <p className={`text-[9px] font-black uppercase tracking-widest ${d ? 'text-zinc-600' : 'text-zinc-400'}`}>{hutangList?.length ?? 0} pesanan belum dibayar</p>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 md:p-8">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
                        {(!hutangList || hutangList.length === 0) ? (
                            <div className={`col-span-full flex flex-col items-center justify-center py-20 ${d ? 'text-zinc-700' : 'text-zinc-300'}`}>
                                <CheckCircle size={32} className="mb-3 md:w-10 md:h-10" />
                                <p className="font-black text-[10px] md:text-xs uppercase tracking-widest text-center">Aman, nggak ada yang ngutang!</p>
                            </div>
                        ) : (
                            hutangList.map(h => (
                                <div key={h.id} className={`p-4 md:p-5 rounded-2xl border flex flex-col justify-between ${d ? 'bg-zinc-900 border-red-500/30' : 'bg-white border-red-200'}`}>
                                    <div>
                                        <div className="flex justify-between items-start mb-2 md:mb-3">
                                            <div className="flex gap-1.5 flex-wrap">
                                                <span className="text-[8px] md:text-[10px] font-black uppercase tracking-widest bg-red-500/10 text-red-500 px-1.5 md:px-2 py-1 rounded-md">BELUM BAYAR</span>
                                                <span className={`text-[8px] md:text-[10px] font-black uppercase tracking-widest px-1.5 md:px-2 py-1 rounded-md border ${h.paymentMethod === 'QRIS' ? 'bg-blue-500/10 text-blue-500 border-blue-500/20' : h.paymentMethod === 'CASH' ? 'bg-green-500/10 text-green-600 border-green-500/20' : 'bg-zinc-500/10 text-zinc-500 border-zinc-500/20'}`}>
                                                    Rencana Via {h.paymentMethod === 'KASBON' ? 'CASH/QRIS' : h.paymentMethod}
                                                </span>
                                            </div>
                                            <span className={`text-[8px] md:text-[10px] font-bold ${d ? 'text-zinc-500' : 'text-zinc-400'}`}>{h.date.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })}</span>
                                        </div>
                                        <h3 className="font-black text-base md:text-lg mb-1 mt-2">{h.customerName}</h3>
                                        <p className="text-xs md:text-sm font-black text-amber-500 mb-3 md:mb-4">Rp {h.totalAmount.toLocaleString('id-ID')}</p>

                                        <div className={`space-y-1 mb-4 p-2 md:p-3 rounded-lg ${d ? 'bg-zinc-800' : 'bg-zinc-50'}`}>
                                            {h.items.map((item, idx) => (
                                                <div key={idx} className="flex justify-between text-[9px] md:text-[10px] font-bold">
                                                    <span className={d ? 'text-zinc-400' : 'text-zinc-600'}>{item.name} <span className="opacity-50">x{item.quantity}</span></span>
                                                    <span>Rp {(item.price * item.quantity).toLocaleString('id-ID')}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <button onClick={() => batalinHutang(h)} className={`w-1/3 border border-red-500/50 text-red-500 hover:bg-red-500/10 font-black py-2 md:py-2.5 rounded-xl transition-all active:scale-95 text-[9px] md:text-[10px] uppercase tracking-widest flex justify-center items-center gap-1`}>
                                            <Trash2 size={12} /> Batal
                                        </button>
                                        <button onClick={() => setPayModal(h)} className="w-2/3 bg-amber-500 hover:bg-amber-400 text-black font-black py-2 md:py-2.5 rounded-xl transition-all active:scale-95 text-[10px] md:text-[11px] uppercase tracking-widest flex justify-center items-center gap-1.5">
                                            <CheckCircle size={12} /> Lunasin
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}