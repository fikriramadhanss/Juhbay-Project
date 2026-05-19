// app/dashboard/page.tsx

'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Store, History, Settings, Coffee, Sun, Moon, BarChart3, TrendingUp, Banknote, QrCode, BookOpen, Calculator, CalendarDays, Trophy, ChevronDown, Package, Bell } from 'lucide-react';
import Link from 'next/link';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, Cell, PieChart as RechartsPie, Pie } from 'recharts'

export default function DashboardPage() {
    const [isMounted, setIsMounted] = useState(false);
    const [isDark, setIsDark] = useState(true);
    const [timeFilter, setTimeFilter] = useState('7_DAYS');
    const [isFilterOpen, setIsFilterOpen] = useState(false);
    const [dashboardData, setDashboardData] = useState<{
        chartData: any[];
        totalRevenue: number;
        totalCash: number;
        totalQris: number;
        totalOnline: number;
        totalProfit: number;
        totalTransactions: number;
        topProducts: any[];
        pieData: any[];
        categoryStats: any[];
        onlineChartData: any[];
    } | null>(null);

    const categoryColors = ['#f59e0b', '#3b82f6', '#10b981', '#a855f7', '#ec4899', '#06b6d4', '#f97316'];

    const fetchDashboard = async () => {
        const { data: rawSales } = await supabase
            .from('sales')
            .select('*, sale_items(*)');

        const { data: rawProducts } = await supabase
            .from('products')
            .select('*');

        const allSales = (rawSales || []).map((s: any) => ({
            id: s.id,
            date: new Date(s.date),
            totalAmount: s.total_amount,
            paymentMethod: s.payment_method,
            status: s.status,
            customerName: s.customer_name,
            cashAmount: s.cash_amount,
            qrisAmount: s.qris_amount,
            totalProfit: s.total_profit,
            items: (s.sale_items || []).map((i: any) => ({
                productId: i.product_id,
                name: i.name,
                price: i.price,
                quantity: i.quantity,
                hpp: i.hpp
            }))
        }));

        const allProducts = (rawProducts || []).map((p: any) => ({
            id: p.id,
            name: p.name,
            category: p.category,
            variant: p.variant,
            price: p.price,
            stock: p.stock,
            isActive: p.is_active,
            hppTotal: p.hpp_total
        }));

        let sales = allSales.filter(s => s.status !== 'UNPAID');

        const now = new Date();
        const todayStr = now.toISOString().split('T')[0];

        if (timeFilter === 'TODAY') {
            sales = sales.filter(s => new Date(s.date).toISOString().split('T')[0] === todayStr);
        } else if (timeFilter === '7_DAYS') {
            const sevenDaysAgo = new Date();
            sevenDaysAgo.setHours(0, 0, 0, 0);
            sevenDaysAgo.setDate(now.getDate() - 6);
            sales = sales.filter(s => new Date(s.date) >= sevenDaysAgo);
        } else if (timeFilter === 'THIS_MONTH') {
            const thisMonth = now.getMonth();
            const thisYear = now.getFullYear();
            sales = sales.filter(s => {
                const d = new Date(s.date);
                return d.getMonth() === thisMonth && d.getFullYear() === thisYear;
            });
        }

        let totalRevenue = 0;
        let totalCash = 0;
        let totalQris = 0;
        let totalOnline = 0;
        let totalProfit = 0;

        const itemCounts: Record<string, { name: string, qty: number, revenue: number }> = {};
        const categoryStats: Record<string, number> = {};

        const groupedByDate = sales.reduce((acc, sale) => {
            const dateObj = new Date(sale.date);
            const dateStr = dateObj.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' });

            if (!acc[dateStr]) acc[dateStr] = { name: dateStr, Total: 0, CASH: 0, QRIS: 0, ONLINE: 0, Profit: 0 };

            const cAmt = sale.paymentMethod === 'ONLINE' ? 0 : (sale.cashAmount || (sale.paymentMethod === 'CASH' ? sale.totalAmount : 0));
            const qAmt = sale.paymentMethod === 'ONLINE' ? 0 : (sale.qrisAmount || (sale.paymentMethod === 'QRIS' ? sale.totalAmount : 0));
            const oAmt = sale.paymentMethod === 'ONLINE' ? sale.totalAmount : 0;

            let realProfit = sale.totalProfit || 0;
            if (!sale.totalProfit || sale.totalProfit === 0) {
                realProfit = sale.items.reduce((sum: number, item: any) => {
                    const pm = allProducts.find(p => p.id === item.productId);
                    const hpp = item.hpp || pm?.hppTotal || 0;
                    return sum + ((item.price - hpp) * item.quantity);
                }, 0);
            }

            acc[dateStr].Total += sale.totalAmount;
            acc[dateStr].CASH += cAmt;
            acc[dateStr].QRIS += qAmt;
            acc[dateStr].ONLINE += oAmt;
            acc[dateStr].Profit += realProfit;

            totalRevenue += sale.totalAmount;
            totalCash += cAmt;
            totalQris += qAmt;
            totalOnline += oAmt;
            totalProfit += realProfit;

            sale.items.forEach((item: any) => {
                if (!itemCounts[item.name]) itemCounts[item.name] = { name: item.name, qty: 0, revenue: 0 };
                itemCounts[item.name].qty += item.quantity;
                itemCounts[item.name].revenue += (item.price * item.quantity);

                const productMaster = allProducts.find(p => p.id === item.productId);
                const cat = productMaster?.category || 'Lainnya';
                categoryStats[cat] = (categoryStats[cat] || 0) + item.quantity;
            });

            return acc;
        }, {} as Record<string, { name: string, Total: number, CASH: number, QRIS: number, ONLINE: number, Profit: number }>);

        const topProducts = Object.values(itemCounts).sort((a, b) => b.qty - a.qty).slice(0, 5);
        const pieData = [
            { name: 'CASH', value: totalCash, color: '#22c55e' },
            { name: 'QRIS', value: totalQris, color: '#a855f7' },
            { name: 'ONLINE', value: totalOnline, color: '#f59e0b' }
        ].filter(d => d.value > 0);

        const onlineChartData = Object.values(groupedByDate).map(d => ({ name: d.name, Online: d.ONLINE })).filter(d => d.Online > 0);

        setDashboardData({
            chartData: Object.values(groupedByDate),
            totalRevenue,
            totalCash,
            totalQris,
            totalOnline,
            totalProfit,
            totalTransactions: sales.length,
            topProducts,
            pieData,
            categoryStats: Object.entries(categoryStats).map(([name, value]) => ({ name, value })),
            onlineChartData
        });
    };

    useEffect(() => {
        setIsMounted(true);
        fetchDashboard();

        const channel = supabase
            .channel('realtime-dashboard')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'sales' }, () => {
                fetchDashboard();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [timeFilter]);

    const d = isDark;
    const filterOptions = [
        { id: 'TODAY', label: 'Hari Ini' },
        { id: '7_DAYS', label: '7 Hari Terakhir' },
        { id: 'THIS_MONTH', label: 'Bulan Ini' },
        { id: 'ALL', label: 'Semua Waktu' }
    ];

    if (!isMounted) {
        return (
            <div className="h-screen w-screen bg-zinc-950 flex items-center justify-center">
                <p className="text-amber-500 font-black tracking-[0.3em] uppercase text-xs">Memuat Dashboard...</p>
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
                <Link href="/history" className={`flex items-center justify-center md:justify-start gap-3 p-3 rounded-xl font-bold text-xs transition-all ${d ? 'text-zinc-500 hover:bg-zinc-800 hover:text-white' : 'text-zinc-400 hover:bg-zinc-100 hover:text-zinc-900'}`}>
                    <History size={17} /> <span className="hidden md:block tracking-wide">Riwayat</span>
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
                <Link href="/dashboard" className="flex items-center justify-center md:justify-start gap-3 p-3 rounded-xl bg-amber-500 text-black font-black text-xs transition-all">
                    <BarChart3 size={17} /> <span className="hidden md:block tracking-wide">Dashboard</span>
                </Link>
                <Link href="/orders" className={`flex items-center justify-center md:justify-start gap-3 p-3 rounded-xl font-bold text-xs transition-all ${d ? 'text-zinc-500 hover:bg-zinc-800 hover:text-white' : 'text-zinc-400 hover:bg-zinc-100 hover:text-zinc-900'}`}>
                    <Bell size={17} /> <span className="hidden md:block tracking-wide">Pesanan Online</span>
                </Link>

                <div className="mt-auto mb-2"><button onClick={() => setIsDark(!d)} className={`flex items-center justify-center md:justify-start gap-3 p-3 w-full rounded-xl font-bold text-xs transition-all ${d ? 'text-zinc-600 hover:bg-zinc-800 hover:text-white' : 'text-zinc-400 hover:bg-zinc-100 hover:text-zinc-900'}`}>{d ? <Sun size={17} /> : <Moon size={17} />}<span className="hidden md:block">{d ? 'Light Mode' : 'Dark Mode'}</span></button></div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 md:p-8 relative">
                <div className="max-w-7xl mx-auto">

                    <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 md:mb-8 gap-4">
                        <div>
                            <h2 className="text-xl md:text-3xl font-black tracking-tight mb-1">Dashboard</h2>
                            <p className={`text-[10px] md:text-xs font-black uppercase tracking-widest ${d ? 'text-zinc-500' : 'text-zinc-400'}`}>Ringkasan Performa Kedai</p>
                        </div>

                        <div className="relative">
                            <button onClick={() => setIsFilterOpen(!isFilterOpen)} className={`flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl border min-w-[160px] transition-all ${d ? 'bg-zinc-900 border-zinc-800 hover:border-zinc-700 text-zinc-300' : 'bg-white border-zinc-200 hover:border-zinc-300 text-zinc-700'}`}>
                                <div className="flex items-center gap-2"><CalendarDays size={14} className={d ? 'text-amber-500' : 'text-amber-600'} /><span className="font-bold text-xs">{filterOptions.find(o => o.id === timeFilter)?.label}</span></div>
                                <ChevronDown size={14} className={`transition-transform duration-200 ${isFilterOpen ? 'rotate-180' : ''}`} />
                            </button>

                            {isFilterOpen && (
                                <>
                                    <div className="fixed inset-0 z-40" onClick={() => setIsFilterOpen(false)}></div>
                                    <div className={`absolute right-0 top-full mt-2 w-full min-w-[160px] rounded-xl border shadow-xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 ${d ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200'}`}>
                                        {filterOptions.map(opt => (
                                            <button key={opt.id} onClick={() => { setTimeFilter(opt.id); setIsFilterOpen(false); }} className={`w-full text-left px-4 py-3 text-xs font-bold transition-colors ${timeFilter === opt.id ? (d ? 'bg-amber-500/10 text-amber-500' : 'bg-amber-50 text-amber-600') : (d ? 'text-zinc-400 hover:bg-zinc-800 hover:text-white' : 'text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900')}`}>{opt.label}</button>
                                        ))}
                                    </div>
                                </>
                            )}
                        </div>
                    </div>

                    <div className="grid grid-cols-2 lg:grid-cols-6 gap-3 md:gap-4 mb-6 md:mb-8">
                        <div className={`p-4 md:p-5 rounded-2xl border ${d ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200'}`}>
                            <div className="flex justify-between items-start mb-2"><p className={`text-[9px] md:text-[10px] font-black uppercase tracking-widest ${d ? 'text-zinc-500' : 'text-zinc-400'}`}>Omzet</p><div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-500"><TrendingUp size={14} /></div></div>
                            <h3 className="text-lg md:text-xl font-black truncate text-blue-500">Rp {dashboardData?.totalRevenue.toLocaleString('id-ID') || 0}</h3>
                        </div>
                        <div className={`p-4 md:p-5 rounded-2xl border ${d ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200'}`}>
                            <div className="flex justify-between items-start mb-2"><p className={`text-[9px] md:text-[10px] font-black uppercase tracking-widest ${d ? 'text-zinc-500' : 'text-zinc-400'}`}>Untung Bersih</p><div className="p-1.5 rounded-lg bg-green-500/10 text-green-500"><Banknote size={14} /></div></div>
                            <h3 className="text-lg md:text-xl font-black truncate text-green-500">Rp {dashboardData?.totalProfit.toLocaleString('id-ID') || 0}</h3>
                        </div>
                        <div className={`p-4 md:p-5 rounded-2xl border ${d ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200'}`}>
                            <div className="flex justify-between items-start mb-2"><p className={`text-[9px] md:text-[10px] font-black uppercase tracking-widest ${d ? 'text-zinc-500' : 'text-zinc-400'}`}>Total Trx</p><div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-500"><History size={14} /></div></div>
                            <h3 className="text-lg md:text-xl font-black truncate">{dashboardData?.totalTransactions || 0} <span className="text-[10px] font-bold text-zinc-500">Order</span></h3>
                        </div>
                        <div className={`p-4 md:p-5 rounded-2xl border ${d ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200'}`}>
                            <div className="flex justify-between items-start mb-2"><p className={`text-[9px] md:text-[10px] font-black uppercase tracking-widest ${d ? 'text-zinc-500' : 'text-zinc-400'}`}>CASH</p><div className="p-1.5 rounded-lg bg-green-500/10 text-green-500"><Banknote size={14} /></div></div>
                            <h3 className="text-lg md:text-xl font-black truncate text-green-500">Rp {dashboardData?.totalCash.toLocaleString('id-ID') || 0}</h3>
                        </div>
                        <div className={`p-4 md:p-5 rounded-2xl border ${d ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200'}`}>
                            <div className="flex justify-between items-start mb-2"><p className={`text-[9px] md:text-[10px] font-black uppercase tracking-widest ${d ? 'text-zinc-500' : 'text-zinc-400'}`}>QRIS</p><div className="p-1.5 rounded-lg bg-purple-500/10 text-purple-500"><QrCode size={14} /></div></div>
                            <h3 className="text-lg md:text-xl font-black truncate text-purple-500">Rp {dashboardData?.totalQris.toLocaleString('id-ID') || 0}</h3>
                        </div>
                        <div className={`p-4 md:p-5 rounded-2xl border ${d ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200'}`}>
                            <div className="flex justify-between items-start mb-2"><p className={`text-[9px] md:text-[10px] font-black uppercase tracking-widest ${d ? 'text-zinc-500' : 'text-zinc-400'}`}>Online</p><div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-500"><Package size={14} /></div></div>
                            <h3 className="text-lg md:text-xl font-black truncate text-amber-500">Rp {dashboardData?.totalOnline.toLocaleString('id-ID') || 0}</h3>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6 mb-6 md:mb-8">
                        <div className={`lg:col-span-2 p-4 md:p-6 rounded-2xl border overflow-x-auto ${d ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200'}`}>
                            <h3 className="text-xs md:text-sm font-black mb-4 md:mb-6 uppercase tracking-widest">Grafik Omzet Harian</h3>
                            {(!dashboardData || dashboardData.chartData.length === 0) ? (
                                <div className={`flex flex-col items-center justify-center py-10 md:py-20 ${d ? 'text-zinc-700' : 'text-zinc-300'}`}><BarChart3 size={40} className="mb-3" /><p className="font-black text-[10px] md:text-xs uppercase tracking-widest">Belum ada data jualan</p></div>
                            ) : (
                                <div className="h-[250px] md:h-[350px] min-w-[400px]">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={dashboardData.chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                            <CartesianGrid strokeDasharray="3 3" stroke={d ? '#27272a' : '#e4e4e7'} vertical={false} />
                                            <XAxis dataKey="name" tick={{ fill: d ? '#71717a' : '#a1a1aa', fontSize: 10, fontWeight: 900 }} axisLine={false} tickLine={false} dy={10} />
                                            <YAxis width={65} tickFormatter={(value: any) => `Rp ${(value / 1000)}k`} tick={{ fill: d ? '#71717a' : '#a1a1aa', fontSize: 10, fontWeight: 900 }} axisLine={false} tickLine={false} dx={-10} />
                                            <RechartsTooltip cursor={{ fill: d ? '#27272a' : '#f4f4f5' }} contentStyle={{ backgroundColor: d ? '#18181b' : '#ffffff', borderColor: d ? '#27272a' : '#e4e4e7', borderRadius: '12px', fontWeight: 'bold', fontSize: '12px' }} labelStyle={{ color: d ? '#ffffff' : '#09090b' }} itemStyle={{ color: d ? '#ffffff' : '#09090b' }} formatter={(value: any, name: any) => [`Rp ${Number(value).toLocaleString('id-ID')}`, name]} />
                                            <Legend wrapperStyle={{ paddingTop: '10px', fontSize: '10px', fontWeight: 900 }} iconType="circle" />
                                            <Bar dataKey="CASH" stackId="a" fill="#22c55e" radius={[0, 0, 4, 4]} />
                                            <Bar dataKey="QRIS" stackId="a" fill="#a855f7" radius={[0, 0, 0, 0]} />
                                            <Bar dataKey="ONLINE" stackId="a" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            )}
                        </div>

                        <div className={`p-4 md:p-6 rounded-2xl border flex flex-col ${d ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200'}`}>
                            <div className="flex items-center justify-between mb-4 md:mb-6">
                                <h3 className="text-xs md:text-sm font-black uppercase tracking-widest">Menu Terlaris</h3>
                                <Trophy size={16} className="text-amber-500" />
                            </div>
                            <div className="flex-1 overflow-y-auto space-y-3">
                                {(!dashboardData?.topProducts || dashboardData.topProducts.length === 0) ? (
                                    <div className={`flex flex-col items-center justify-center h-full py-10 ${d ? 'text-zinc-700' : 'text-zinc-300'}`}>
                                        <Coffee size={32} className="mb-2" />
                                        <p className="font-black text-[10px] md:text-xs uppercase tracking-widest text-center">Belum ada orderan</p>
                                    </div>
                                ) : (
                                    dashboardData.topProducts.map((p, idx) => (
                                        <div key={idx} className={`flex items-center justify-between p-3 rounded-xl border ${d ? 'bg-zinc-950/50 border-zinc-800/50' : 'bg-zinc-50 border-zinc-200'}`}>
                                            <div className="flex items-center gap-3 min-w-0">
                                                <div className={`w-6 h-6 md:w-8 md:h-8 rounded-lg flex items-center justify-center font-black text-[10px] md:text-xs flex-shrink-0 ${idx === 0 ? 'bg-amber-500 text-black' : idx === 1 ? 'bg-zinc-300 text-zinc-800' : idx === 2 ? 'bg-amber-700 text-white' : d ? 'bg-zinc-800 text-zinc-500' : 'bg-zinc-200 text-zinc-500'}`}>
                                                    #{idx + 1}
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="text-[10px] md:text-xs font-black truncate">{p.name}</p>
                                                    <p className={`text-[8px] md:text-[9px] font-bold ${d ? 'text-zinc-500' : 'text-zinc-400'}`}>Omzet: Rp {p.revenue.toLocaleString('id-ID')}</p>
                                                </div>
                                            </div>
                                            <div className="flex flex-col items-end flex-shrink-0 ml-2">
                                                <span className="text-xs md:text-sm font-black text-amber-500">{p.qty}</span>
                                                <span className={`text-[8px] font-bold uppercase tracking-wider ${d ? 'text-zinc-500' : 'text-zinc-400'}`}>Terjual</span>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
                        <div className={`p-4 md:p-6 rounded-2xl border ${d ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200'}`}>
                            <h3 className="text-xs font-black mb-4 uppercase tracking-widest text-center">Metode Pembayaran</h3>
                            <div className="h-[200px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <RechartsPie>
                                        <Pie data={dashboardData?.pieData || []} innerRadius={50} outerRadius={75} paddingAngle={5} dataKey="value">
                                            {(dashboardData?.pieData || []).map((entry, index) => <Cell key={index} fill={entry.color} />)}
                                        </Pie>
                                        <RechartsTooltip contentStyle={{ backgroundColor: d ? '#18181b' : '#ffffff', borderColor: d ? '#27272a' : '#e4e4e7', borderRadius: '8px', fontWeight: 'bold', fontSize: '11px' }} labelStyle={{ color: d ? '#ffffff' : '#09090b' }} itemStyle={{ color: d ? '#ffffff' : '#09090b' }} formatter={(val: any) => [`Rp ${Number(val).toLocaleString('id-ID')}`]} />
                                    </RechartsPie>
                                </ResponsiveContainer>
                            </div>
                            <div className="flex justify-center gap-4 mt-2 flex-wrap">
                                {(dashboardData?.pieData || []).map(item => (
                                    <div key={item.name} className="flex items-center gap-2">
                                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }}></div>
                                        <span className={`text-[10px] font-black uppercase ${d ? 'text-zinc-400' : 'text-zinc-600'}`}>{item.name}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className={`lg:col-span-2 p-4 md:p-6 rounded-2xl border ${d ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200'}`}>
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-xs font-black uppercase tracking-widest">Penjualan per Kategori</h3>
                                <Package size={16} className="text-blue-500" />
                            </div>
                            <div className="h-[200px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart layout="vertical" data={dashboardData?.categoryStats || []} margin={{ left: 20, right: 20 }}>
                                        <XAxis type="number" hide />
                                        <YAxis dataKey="name" type="category" tick={{ fill: d ? '#71717a' : '#a1a1aa', fontSize: 10, fontWeight: 900 }} axisLine={false} tickLine={false} />
                                        <RechartsTooltip cursor={{ fill: d ? '#27272a' : '#f4f4f5' }} contentStyle={{ backgroundColor: d ? '#18181b' : '#ffffff', borderColor: d ? '#27272a' : '#e4e4e7', borderRadius: '8px', fontWeight: 'bold', fontSize: '11px' }} labelStyle={{ color: d ? '#ffffff' : '#09090b' }} itemStyle={{ color: d ? '#ffffff' : '#09090b' }} formatter={(val: any) => [`${val} Cup / Item`]} />
                                        <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                                            {(dashboardData?.categoryStats || []).map((entry, index) => (
                                                <Cell key={index} fill={categoryColors[index % categoryColors.length]} />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>

                    {/* Online Orders Chart */}
                    <div className={`mt-6 p-4 md:p-6 rounded-2xl border ${d ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200'}`}>
                        <div className="flex items-center justify-between mb-4 md:mb-6">
                            <h3 className="text-xs md:text-sm font-black uppercase tracking-widest">Pesanan Online</h3>
                            <span className={`text-[10px] font-bold ${d ? 'text-zinc-500' : 'text-zinc-400'}`}>Total: Rp {dashboardData?.totalOnline.toLocaleString('id-ID') || 0}</span>
                        </div>
                        {(!dashboardData?.onlineChartData || dashboardData.onlineChartData.length === 0) ? (
                            <div className={`flex flex-col items-center justify-center py-10 ${d ? 'text-zinc-700' : 'text-zinc-300'}`}>
                                <Package size={32} className="mb-2" />
                                <p className="font-black text-[10px] uppercase tracking-widest">Belum ada pesanan online</p>
                            </div>
                        ) : (
                            <div className="h-[200px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={dashboardData.onlineChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke={d ? '#27272a' : '#e4e4e7'} vertical={false} />
                                        <XAxis dataKey="name" tick={{ fill: d ? '#71717a' : '#a1a1aa', fontSize: 10, fontWeight: 900 }} axisLine={false} tickLine={false} />
                                        <YAxis width={65} tickFormatter={(value: any) => `Rp ${(value / 1000)}k`} tick={{ fill: d ? '#71717a' : '#a1a1aa', fontSize: 10, fontWeight: 900 }} axisLine={false} tickLine={false} />
                                        <RechartsTooltip contentStyle={{ backgroundColor: d ? '#18181b' : '#ffffff', borderColor: d ? '#27272a' : '#e4e4e7', borderRadius: '12px', fontWeight: 'bold', fontSize: '12px' }} formatter={(value: any) => [`Rp ${Number(value).toLocaleString('id-ID')}`, 'Online']} />
                                        <Bar dataKey="Online" fill="#f59e0b" radius={[4, 4, 4, 4]} />
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