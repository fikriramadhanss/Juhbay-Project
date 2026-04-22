// app/dashboard/page.tsx

'use client';

import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../lib/db';
import { Store, History, Settings, Coffee, Sun, Moon, BarChart3, TrendingUp, Banknote, QrCode, BookOpen } from 'lucide-react';
import Link from 'next/link';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export default function DashboardPage() {
    const [isDark, setIsDark] = useState(true);

    const dashboardData = useLiveQuery(async () => {
        const allSales = await db.sales.toArray();

        const sales = allSales.filter(s => s.status !== 'UNPAID');

        let totalRevenue = 0;
        let totalCash = 0;
        let totalQris = 0;

        const groupedByDate = sales.reduce((acc, sale) => {
            const dateObj = new Date(sale.date);
            const dateStr = dateObj.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' });

            if (!acc[dateStr]) {
                acc[dateStr] = { name: dateStr, Total: 0, CASH: 0, QRIS: 0 };
            }

            const cAmt = sale.cashAmount || (sale.paymentMethod === 'CASH' ? sale.totalAmount : 0);
            const qAmt = sale.qrisAmount || (sale.paymentMethod === 'QRIS' ? sale.totalAmount : 0);

            acc[dateStr].Total += sale.totalAmount;
            acc[dateStr].CASH += cAmt;
            acc[dateStr].QRIS += qAmt;

            totalRevenue += sale.totalAmount;
            totalCash += cAmt;
            totalQris += qAmt;

            return acc;
        }, {} as Record<string, { name: string, Total: number, CASH: number, QRIS: number }>);

        const chartData = Object.values(groupedByDate);

        return { chartData, totalRevenue, totalCash, totalQris, totalTransactions: sales.length };
    });

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
                <Link href="/history" className={`flex items-center justify-center md:justify-start gap-3 p-3 rounded-xl font-bold text-xs transition-all ${d ? 'text-zinc-500 hover:bg-zinc-800 hover:text-white' : 'text-zinc-400 hover:bg-zinc-100 hover:text-zinc-900'}`}>
                    <History size={17} /> <span className="hidden md:block tracking-wide">Riwayat</span>
                </Link>
                <Link href="/manage" className={`flex items-center justify-center md:justify-start gap-3 p-3 rounded-xl font-bold text-xs transition-all ${d ? 'text-zinc-500 hover:bg-zinc-800 hover:text-white' : 'text-zinc-400 hover:bg-zinc-100 hover:text-zinc-900'}`}>
                    <Settings size={17} /> <span className="hidden md:block tracking-wide">Kelola Menu</span>
                </Link>
                <Link href="/hutang" className={`flex items-center justify-center md:justify-start gap-3 p-3 rounded-xl font-bold text-xs transition-all ${d ? 'text-zinc-500 hover:bg-zinc-800 hover:text-white' : 'text-zinc-400 hover:bg-zinc-100 hover:text-zinc-900'}`}>
                    <BookOpen size={17} /> <span className="hidden md:block tracking-wide">Buku Hutang</span>
                </Link>
                <Link href="/dashboard" className="flex items-center justify-center md:justify-start gap-3 p-3 rounded-xl bg-amber-500 text-black font-black text-xs transition-all">
                    <BarChart3 size={17} /> <span className="hidden md:block tracking-wide">Dashboard</span>
                </Link>

                <div className="mt-auto mb-2">
                    <button onClick={() => setIsDark(!d)} className={`flex items-center justify-center md:justify-start gap-3 p-3 w-full rounded-xl font-bold text-xs transition-all ${d ? 'text-zinc-600 hover:bg-zinc-800 hover:text-white' : 'text-zinc-400 hover:bg-zinc-100 hover:text-zinc-900'}`}>
                        {d ? <Sun size={17} /> : <Moon size={17} />}
                        <span className="hidden md:block">{d ? 'Light Mode' : 'Dark Mode'}</span>
                    </button>
                </div>
            </div>

            {/* MAIN CONTENT */}
            <div className="flex-1 overflow-y-auto p-5 md:p-8">
                <div className="max-w-6xl mx-auto">

                    <div className="mb-8">
                        <h2 className="text-2xl md:text-3xl font-black tracking-tight mb-1">Dashboard</h2>
                        <p className={`text-xs font-black uppercase tracking-widest ${d ? 'text-zinc-500' : 'text-zinc-400'}`}>
                            Ringkasan Performa Kedai
                        </p>
                    </div>

                    {/* KOTAK RINGKASAN */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                        <div className={`p-5 rounded-2xl border ${d ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200 shadow-sm'}`}>
                            <div className="flex justify-between items-start mb-4">
                                <p className={`text-[10px] font-black uppercase tracking-widest ${d ? 'text-zinc-500' : 'text-zinc-400'}`}>Total Pendapatan</p>
                                <div className="p-2 rounded-lg bg-amber-500/10 text-amber-500"><TrendingUp size={16} /></div>
                            </div>
                            <h3 className="text-2xl font-black tracking-tighter">
                                Rp {dashboardData?.totalRevenue.toLocaleString('id-ID') || 0}
                            </h3>
                        </div>

                        <div className={`p-5 rounded-2xl border ${d ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200 shadow-sm'}`}>
                            <div className="flex justify-between items-start mb-4">
                                <p className={`text-[10px] font-black uppercase tracking-widest ${d ? 'text-zinc-500' : 'text-zinc-400'}`}>Total Transaksi</p>
                                <div className="p-2 rounded-lg bg-blue-500/10 text-blue-500"><History size={16} /></div>
                            </div>
                            <h3 className="text-2xl font-black tracking-tighter">
                                {dashboardData?.totalTransactions || 0} <span className="text-sm font-bold text-zinc-500">Order</span>
                            </h3>
                        </div>

                        <div className={`p-5 rounded-2xl border ${d ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200 shadow-sm'}`}>
                            <div className="flex justify-between items-start mb-4">
                                <p className={`text-[10px] font-black uppercase tracking-widest ${d ? 'text-zinc-500' : 'text-zinc-400'}`}>Masuk via CASH</p>
                                <div className="p-2 rounded-lg bg-green-500/10 text-green-500"><Banknote size={16} /></div>
                            </div>
                            <h3 className="text-2xl font-black tracking-tighter text-green-500">
                                Rp {dashboardData?.totalCash.toLocaleString('id-ID') || 0}
                            </h3>
                        </div>

                        <div className={`p-5 rounded-2xl border ${d ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200 shadow-sm'}`}>
                            <div className="flex justify-between items-start mb-4">
                                <p className={`text-[10px] font-black uppercase tracking-widest ${d ? 'text-zinc-500' : 'text-zinc-400'}`}>Masuk via QRIS</p>
                                <div className="p-2 rounded-lg bg-purple-500/10 text-purple-500"><QrCode size={16} /></div>
                            </div>
                            <h3 className="text-2xl font-black tracking-tighter text-purple-500">
                                Rp {dashboardData?.totalQris.toLocaleString('id-ID') || 0}
                            </h3>
                        </div>
                    </div>

                    {/* AREA GRAFIK */}
                    <div className={`p-5 md:p-8 rounded-2xl border ${d ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200 shadow-sm'}`}>
                        <h3 className="text-sm font-black mb-6 uppercase tracking-widest">Grafik Pendapatan Harian</h3>

                        {dashboardData?.chartData.length === 0 ? (
                            <div className={`flex flex-col items-center justify-center py-20 ${d ? 'text-zinc-700' : 'text-zinc-300'}`}>
                                <BarChart3 size={40} className="mb-3" />
                                <p className="font-black text-xs uppercase tracking-widest">Belum ada data jualan</p>
                            </div>
                        ) : (
                            <div className="h-[400px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={dashboardData?.chartData} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke={d ? '#27272a' : '#e4e4e7'} vertical={false} />
                                        <XAxis
                                            dataKey="name"
                                            tick={{ fill: d ? '#71717a' : '#a1a1aa', fontSize: 10, fontWeight: 900 }}
                                            axisLine={false}
                                            tickLine={false}
                                            dy={10}
                                        />
                                        <YAxis
                                            tickFormatter={(value) => `Rp ${(value / 1000)}k`}
                                            tick={{ fill: d ? '#71717a' : '#a1a1aa', fontSize: 10, fontWeight: 900 }}
                                            axisLine={false}
                                            tickLine={false}
                                            dx={-10}
                                        />
                                        <Tooltip
                                            cursor={{ fill: d ? '#27272a' : '#f4f4f5' }}
                                            contentStyle={{
                                                backgroundColor: d ? '#18181b' : '#ffffff',
                                                borderColor: d ? '#27272a' : '#e4e4e7',
                                                borderRadius: '12px',
                                                fontWeight: 'bold',
                                                fontSize: '12px'
                                            }}
                                            // @ts-ignore
                                            formatter={(value: any) => [`Rp ${Number(value).toLocaleString('id-ID')}`]}
                                        />
                                        <Legend
                                            wrapperStyle={{ paddingTop: '20px', fontSize: '10px', fontWeight: 900 }}
                                            iconType="circle"
                                        />
                                        <Bar dataKey="CASH" stackId="a" fill="#22c55e" radius={[0, 0, 4, 4]} />
                                        <Bar dataKey="QRIS" stackId="a" fill="#a855f7" radius={[4, 4, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        )}
                    </div>

                </div>
            </div>
        </div>
    );
}