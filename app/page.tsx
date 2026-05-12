// app/page.tsx

'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { ShoppingCart, Coffee, History, Trash2, Settings, Store, Banknote, QrCode, X, Sun, Moon, FileText, BarChart3, BookOpen, CheckCircle, SplitSquareHorizontal, Calculator } from 'lucide-react';
import Link from 'next/link';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface Product {
  id?: number;
  name: string;
  category: string;
  variant?: string;
  price: number;
  stock: number;
  isActive: boolean;
  hppTotal: number;
}

export default function POSPage() {
  const [isMounted, setIsMounted] = useState(false);
  const [productsList, setProductsList] = useState<Product[]>([]);
  const [cart, setCart] = useState<any[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'QRIS' | 'SPLIT'>('CASH');
  const [splitCash, setSplitCash] = useState('');
  const [isDark, setIsDark] = useState(true);

  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [manualName, setManualName] = useState('Manual Brew');
  const [manualPrice, setManualPrice] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState(false);
  const [customerName, setCustomerName] = useState('');

  const [isTutupKasirModalOpen, setIsTutupKasirModalOpen] = useState(false);
  const [namaKasir, setNamaKasir] = useState('');

  const [isTransactionStatusModalOpen, setIsTransactionStatusModalOpen] = useState(false);
  const [transactionStatus, setTransactionStatus] = useState<'SUCCESS' | 'ERROR' | null>(null);
  const [transactionStatusTitle, setTransactionStatusTitle] = useState('');
  const [transactionStatusMessage, setTransactionStatusMessage] = useState('');

  const fetchProducts = async () => {
    const { data } = await supabase
      .from('products')
      .select('*')
      .eq('is_active', true)
      .order('id', { ascending: true });

    if (data) {
      const mapped: Product[] = data.map((p: any) => ({
        id: p.id,
        name: p.name,
        category: p.category,
        variant: p.variant || undefined,
        price: p.price,
        stock: p.stock,
        isActive: p.is_active,
        hppTotal: p.hpp_total
      }));
      setProductsList(mapped);
    }
  };

  useEffect(() => {
    setIsMounted(true);
    fetchProducts();

    const channel = supabase
      .channel('realtime-pos-channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, () => {
        fetchProducts();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const activeProducts = useMemo(() => {
    const grouped: Record<string, Record<string, Product[]>> = {};
    productsList.forEach(p => {
      if (!grouped[p.category]) grouped[p.category] = {};
      if (!grouped[p.category][p.name]) grouped[p.category][p.name] = [];
      grouped[p.category][p.name].push(p);
    });
    return grouped;
  }, [productsList]);

  const addToCart = (product: Product) => {
    if (product.price === 0) {
      setSelectedProduct(product);
      setManualName(product.name);
      setManualPrice('');
      setIsManualModalOpen(true);
      return;
    }

    const cartKey = `${product.id}`;
    const existing = cart.find(i => i.cartKey === cartKey);
    const name = product.variant ? `${product.name} (${product.variant})` : product.name;

    if (existing) {
      if (existing.quantity >= product.stock) return alert('Stok habis!');
      setCart(cart.map(i => i.cartKey === cartKey ? { ...i, quantity: i.quantity + 1 } : i));
    } else {
      if (product.stock <= 0) return alert('Stok habis!');
      setCart([...cart, { cartKey, productId: product.id, name, price: product.price, quantity: 1, hpp: product.hppTotal || 0 }]);
    }
  };

  const addManualToCart = () => {
    if (!manualPrice || parseInt(manualPrice) <= 0) return alert('Input harga yang bener dong!');

    const cartKey = `manual-${Date.now()}`;
    setCart([...cart, {
      cartKey,
      productId: selectedProduct?.id || 0,
      name: manualName,
      price: parseInt(manualPrice),
      quantity: 1,
      hpp: selectedProduct?.hppTotal || 0
    }]);
    setIsManualModalOpen(false);
  };

  const cartTotal = cart.reduce((s, i) => s + (i.price * i.quantity), 0);

  const processPayment = async (isKasbon: boolean) => {
    if (isKasbon && !customerName.trim()) {
      return alert('Nama temen/pelanggan harus diisi kalau mau ngutang!');
    }

    const cAmount = paymentMethod === 'SPLIT' ? parseInt(splitCash || '0') : (paymentMethod === 'CASH' ? cartTotal : 0);
    const qAmount = paymentMethod === 'SPLIT' ? (cartTotal - cAmount) : (paymentMethod === 'QRIS' ? cartTotal : 0);

    if (paymentMethod === 'SPLIT' && (cAmount < 0 || cAmount > cartTotal)) {
      return alert('Nominal Cash untuk Split tidak valid!');
    }

    if (!isKasbon && (paymentMethod === 'QRIS' || paymentMethod === 'SPLIT')) {
      if (!window.confirm(`PENTING: Pastiin saldo QRIS sebesar Rp ${qAmount.toLocaleString('id-ID')} udah masuk mutasi ya. Udah dicek?`)) {
        return;
      }
    }

    try {
      const totalProfit = cart.reduce((sum, item) => sum + ((item.price - item.hpp) * item.quantity), 0);

      const { data: saleData, error: saleError } = await supabase
        .from('sales')
        .insert({
          date: new Date().toISOString(),
          total_amount: cartTotal,
          payment_method: paymentMethod,
          status: isKasbon ? 'UNPAID' : 'PAID',
          customer_name: customerName || '-',
          cash_amount: cAmount,
          qris_amount: qAmount,
          total_profit: totalProfit
        })
        .select();

      if (saleError || !saleData || saleData.length === 0) {
        throw new Error(saleError?.message || 'Gagal menyimpan data penjualan');
      }

      const newSaleId = saleData[0].id;

      const itemsPayload = cart.map(i => ({
        sale_id: newSaleId,
        product_id: i.productId || 0,
        name: i.name,
        price: i.price,
        quantity: i.quantity,
        hpp: i.hpp
      }));

      const { error: itemsError } = await supabase
        .from('sale_items')
        .insert(itemsPayload);

      if (itemsError) throw itemsError;

      for (const item of cart) {
        if (item.productId && item.productId !== 0) {
          const { data: currentProd } = await supabase
            .from('products')
            .select('stock')
            .eq('id', item.productId)
            .single();

          if (currentProd) {
            await supabase
              .from('products')
              .update({ stock: currentProd.stock - item.quantity })
              .eq('id', item.productId);
          }
        }
      }

      if (isKasbon) {
        setIsTransactionStatusModalOpen(true);
        setTransactionStatus('SUCCESS');
        setTransactionStatusTitle('Berhasil!');
        setTransactionStatusMessage(`Data berhasil disimpan! (Masuk Buku Hutang a/n ${customerName})`);
      } else {
        setIsTransactionStatusModalOpen(true);
        setTransactionStatus('SUCCESS');
        setTransactionStatusTitle('Berhasil!');
        setTransactionStatusMessage(`Data berhasil disimpan! Pembayaran ${paymentMethod} sukses.`);
      }
    } catch (error) {
      console.error(error);
      setIsTransactionStatusModalOpen(true);
      setTransactionStatus('ERROR');
      setTransactionStatusTitle('Gagal!');
      setTransactionStatusMessage('Data gagal disimpan atau dibatalkan. Silakan coba lagi.');
    } finally {
      setCart([]);
      setCustomerName('');
      setSplitCash('');
      setIsCheckoutModalOpen(false);
    }
  };

  const cancelOrder = () => {
    setCart([]);
    setCustomerName('');
    setSplitCash('');
    setIsCheckoutModalOpen(false);
  };

  const confirmTutupKasir = async () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const { data } = await supabase
      .from('sales')
      .select('id')
      .gte('date', today.toISOString())
      .lt('date', tomorrow.toISOString());

    if (!data || data.length === 0) {
      return alert('Belum ada transaksi hari ini, nggak bisa tutup kasir!');
    }

    setIsTutupKasirModalOpen(true);
  };

  const handleTutupKasir = async () => {
    if (!namaKasir.trim()) {
      return alert('Nama kasir wajib diisi buat rekap tutup kasir!');
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const { data: rawSales } = await supabase
      .from('sales')
      .select('*, sale_items(*)')
      .gte('date', today.toISOString())
      .lt('date', tomorrow.toISOString())
      .order('id', { ascending: true });

    const todaysSales = (rawSales || []).map((s: any) => ({
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

    let totalCash = 0;
    let totalQris = 0;
    let totalKasbon = 0;
    let totalProfitLunas = 0;

    const tableData = todaysSales.map((sale, index) => {
      const isUnpaid = sale.status === 'UNPAID';

      if (!isUnpaid) {
        totalCash += sale.cashAmount || (sale.paymentMethod === 'CASH' ? sale.totalAmount : 0);
        totalQris += sale.qrisAmount || (sale.paymentMethod === 'QRIS' ? sale.totalAmount : 0);

        let realProfit = sale.totalProfit || 0;
        if (realProfit === 0) {
          realProfit = sale.items.reduce((sum: number, item: any) => {
            const currentMaster = productsList.find(p => p.id === item.productId);
            const fallbackHpp = item.hpp || currentMaster?.hppTotal || 0;
            return sum + ((item.price - fallbackHpp) * item.quantity);
          }, 0);
        }
        totalProfitLunas += realProfit;
      } else {
        totalKasbon += sale.totalAmount;
      }

      const itemsStr = sale.items.map((i: any) => `- ${i.name} (x${i.quantity})`).join('\n');
      const methodStr = isUnpaid
        ? '[BELUM BAYAR]'
        : (sale.paymentMethod === 'SPLIT' ? `SPLIT\n(C:${sale.cashAmount}, Q:${sale.qrisAmount})` : sale.paymentMethod);

      return [
        index + 1,
        sale.date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
        itemsStr,
        methodStr,
        isUnpaid ? `- Rp ${sale.totalAmount.toLocaleString('id-ID')}` : `Rp ${sale.totalAmount.toLocaleString('id-ID')}`
      ];
    });

    const doc = new jsPDF();
    const dateStr = today.toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    doc.setFontSize(16);
    doc.text('REKAP TUTUP KASIR JUHBAY COFFEE', 14, 20);
    doc.setFontSize(11);
    doc.text(`Tanggal: ${dateStr}`, 14, 28);
    doc.text(`Kasir / Shift: ${namaKasir}`, 14, 34);

    const hasilBersihAkhir = totalProfitLunas - totalKasbon;

    autoTable(doc, {
      startY: 42,
      head: [['Ringkasan', 'Nominal']],
      body: [
        ['Total Transaksi (Semua)', `${todaysSales.length} Trx`],
        ['Total CASH Masuk', `Rp ${totalCash.toLocaleString('id-ID')}`],
        ['Total QRIS Masuk', `Rp ${totalQris.toLocaleString('id-ID')}`],
        ['Total Hutang / Kasbon', `- Rp ${totalKasbon.toLocaleString('id-ID')}`],
        ['Total Hasil Bersih', `${hasilBersihAkhir < 0 ? '- ' : ''}Rp ${Math.abs(hasilBersihAkhir).toLocaleString('id-ID')}`]
      ],
      theme: 'grid',
      headStyles: { fillColor: [245, 158, 11] },
      didParseCell: function (data: any) {
        if (data.row.index === 3 && data.column.index === 1) {
          data.cell.styles.textColor = [239, 68, 68];
          data.cell.styles.fontStyle = 'bold';
        }
        if (data.row.index === 4 && data.column.index === 1) {
          if (hasilBersihAkhir < 0) {
            data.cell.styles.textColor = [239, 68, 68];
          } else {
            data.cell.styles.textColor = [34, 197, 94];
          }
          data.cell.styles.fontStyle = 'bold';
        }
      }
    });

    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 10,
      head: [['No', 'Jam', 'Orderan', 'Pembayaran', 'Total']],
      body: tableData,
      theme: 'striped',
      headStyles: { fillColor: [39, 39, 42] },
      styles: { fontSize: 8, cellPadding: 2 },
      columnStyles: {
        2: { cellWidth: 55 },
      },
      didParseCell: function (data: any) {
        if (data.row.raw[3] === '[BELUM BAYAR]') {
          if (data.column.index === 3 || data.column.index === 4) {
            data.cell.styles.textColor = [239, 68, 68];
            data.cell.styles.fontStyle = 'bold';
          }
        }
      }
    });

    doc.save(`Rekap_Juhbay_${today.toISOString().split('T')[0]}.pdf`);
    alert('Tutup Kasir selesai! Laporan PDF berhasil di-download.');

    setIsTutupKasirModalOpen(false);
    setNamaKasir('');
  };

  const d = isDark;

  if (!isMounted) {
    return (
      <div className="h-screen w-screen bg-zinc-950 flex items-center justify-center relative">
        <div className="text-center">
          <Coffee size={40} className="text-amber-500 animate-pulse mx-auto mb-4" />
          <p className="text-amber-500 font-black tracking-[0.3em] uppercase text-xs">Memuat Juhbay POS...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex h-screen font-sans overflow-hidden relative transition-colors duration-300 ${d ? 'bg-zinc-950 text-white' : 'bg-zinc-100 text-zinc-900'}`}>

      {isTransactionStatusModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="rounded-2xl p-8 md:p-10 w-full max-w-sm bg-zinc-900 border border-zinc-800 shadow-2xl text-center relative">

            <div className="absolute top-6 left-1/2 -translate-x-1/2 p-2 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-500">
              <FileText size={20} />
            </div>

            <div className="flex justify-center mb-6 mt-8">
              {transactionStatus === 'SUCCESS' ? (
                <CheckCircle size={60} className="text-green-500" strokeWidth={1} />
              ) : (
                <X size={60} className="text-red-500" strokeWidth={1} />
              )}
            </div>

            <h3 className="text-white text-2xl font-black mb-1 md:mb-2">{transactionStatusTitle}</h3>
            <p className="text-xs md:text-sm font-black mb-6 md:mb-8 whitespace-normal text-zinc-400">
              {transactionStatusMessage}
            </p>

            <button
              onClick={() => {
                setIsTransactionStatusModalOpen(false);
                setTransactionStatus(null);
              }}
              className="w-full bg-[#5A51B7] hover:bg-[#4C43A4] text-white font-black py-3 md:py-4 rounded-xl transition-all active:scale-95 uppercase tracking-widest text-xs md:text-sm">
              Oke
            </button>
          </div>
        </div>
      )}

      {isTutupKasirModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className={`rounded-2xl p-5 md:p-8 w-full max-w-sm shadow-2xl border ${d ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200'}`}>
            <div className="flex justify-between items-center mb-5 md:mb-6">
              <h3 className="text-sm md:text-base font-black uppercase tracking-widest text-amber-500">Tutup Kasir</h3>
              <button onClick={() => setIsTutupKasirModalOpen(false)} className={`p-2 rounded-lg transition-colors ${d ? 'hover:bg-zinc-800 text-zinc-400' : 'hover:bg-zinc-100 text-zinc-500'}`}><X size={18} /></button>
            </div>

            <div className="mb-5 md:mb-6 text-left">
              <label className={`text-[9px] md:text-[10px] font-black uppercase tracking-widest block mb-1 md:mb-2 ${d ? 'text-zinc-400' : 'text-zinc-500'}`}>Nama Kasir yang Bertugas</label>
              <input type="text" value={namaKasir} onChange={e => setNamaKasir(e.target.value)}
                className={`w-full p-2.5 md:p-3 rounded-xl font-bold outline-none border text-xs md:text-sm ${d ? 'bg-zinc-800 border-zinc-700 text-white focus:border-amber-500' : 'bg-zinc-50 border-zinc-200 text-zinc-900 focus:border-amber-500'}`}
                placeholder="Cth: Yudha / Fikri"
                autoFocus
              />
            </div>

            <div className="space-y-2 md:space-y-3">
              <button onClick={handleTutupKasir} className="w-full bg-amber-500 hover:bg-amber-400 text-black font-black py-3 md:py-4 rounded-xl transition-all active:scale-95 uppercase tracking-widest text-[10px] md:text-sm flex items-center justify-center gap-2">
                <FileText size={16} /> Cetak & Tutup Kasir
              </button>
            </div>
          </div>
        </div>
      )}

      {isManualModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className={`rounded-2xl p-5 md:p-8 w-full max-w-sm shadow-2xl border ${d ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200'}`}>
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-sm md:text-base font-black uppercase tracking-widest">Manual Brew</h3>
              <button onClick={() => setIsManualModalOpen(false)} className={`p-2 rounded-lg ${d ? 'hover:bg-zinc-800' : 'hover:bg-zinc-100'}`}><X size={18} /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className={`text-[9px] md:text-[10px] font-black uppercase tracking-widest block mb-2 ${d ? 'text-zinc-500' : 'text-zinc-400'}`}>Nama Beans / Kopi</label>
                <input type="text" value={manualName} onChange={e => setManualName(e.target.value)}
                  className={`w-full p-2.5 md:p-3 rounded-xl font-bold outline-none border text-xs md:text-sm ${d ? 'bg-zinc-800 border-zinc-700 text-white focus:border-amber-500' : 'bg-zinc-50 border-zinc-200 text-zinc-900 focus:border-amber-500'}`} />
              </div>
              <div>
                <label className={`text-[9px] md:text-[10px] font-black uppercase tracking-widest block mb-2 ${d ? 'text-zinc-500' : 'text-zinc-400'}`}>Harga (Rp)</label>
                <input type="number" value={manualPrice} onChange={e => setManualPrice(e.target.value)}
                  className={`w-full p-2.5 md:p-3 rounded-xl font-black text-base md:text-lg outline-none border ${d ? 'bg-zinc-800 border-zinc-700 text-white focus:border-amber-500' : 'bg-zinc-50 border-zinc-200 text-zinc-900 focus:border-amber-500'}`}
                  placeholder="Cth: 25000" />
              </div>
              <button onClick={addManualToCart} className="w-full bg-amber-500 hover:bg-amber-400 text-black font-black py-3 md:py-4 rounded-xl transition-all active:scale-95 uppercase tracking-widest text-xs md:text-sm">
                Masuk Keranjang
              </button>
            </div>
          </div>
        </div>
      )}

      {isCheckoutModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className={`rounded-2xl p-5 md:p-8 w-full max-w-sm shadow-2xl border ${d ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200'}`}>
            <div className="flex justify-between items-center mb-5 md:mb-6">
              <h3 className="text-sm md:text-base font-black uppercase tracking-widest text-amber-500">Konfirmasi</h3>
              <button onClick={() => setIsCheckoutModalOpen(false)} className={`p-2 rounded-lg transition-colors ${d ? 'hover:bg-zinc-800 text-zinc-400' : 'hover:bg-zinc-100 text-zinc-500'}`}><X size={18} /></button>
            </div>

            <div className="text-center mb-5 md:mb-6">
              <p className={`text-[9px] md:text-[10px] font-black uppercase tracking-widest mb-1 ${d ? 'text-zinc-500' : 'text-zinc-400'}`}>Total Tagihan</p>
              <p className="text-2xl md:text-4xl font-black tracking-tighter">Rp {cartTotal.toLocaleString('id-ID')}</p>
            </div>

            <div className="mb-5 md:mb-6 text-left">
              <label className={`text-[9px] md:text-[10px] font-black uppercase tracking-widest block mb-1 md:mb-2 ${d ? 'text-zinc-400' : 'text-zinc-500'}`}>Nama Pelanggan / Temen</label>
              <input type="text" value={customerName} onChange={e => setCustomerName(e.target.value)}
                className={`w-full p-2.5 md:p-3 rounded-xl font-bold outline-none border text-xs md:text-sm ${d ? 'bg-zinc-800 border-zinc-700 text-white focus:border-amber-500' : 'bg-zinc-50 border-zinc-200 text-zinc-900 focus:border-amber-500'}`}
                placeholder="Cth: Yudha / Hanif" />
            </div>

            <div className="space-y-2 md:space-y-3">
              <button onClick={() => processPayment(false)} className="w-full bg-amber-500 hover:bg-amber-400 text-black font-black py-3 md:py-4 rounded-xl transition-all active:scale-95 uppercase tracking-widest text-[10px] md:text-sm flex items-center justify-center gap-2">
                <CheckCircle size={16} /> Udah Bayar Lunas
              </button>
              <button onClick={() => processPayment(true)} className={`w-full border-2 font-black py-2.5 md:py-3 rounded-xl transition-all active:scale-95 uppercase tracking-widest text-[9px] md:text-xs border-red-500/50 text-red-500 hover:bg-red-500/10`}>
                Belum Bayar (Ngutang)
              </button>
              <button onClick={cancelOrder} className={`w-full font-black py-2 rounded-xl transition-all active:scale-95 uppercase tracking-widest text-[9px] md:text-xs ${d ? 'text-zinc-500 hover:bg-zinc-800' : 'text-zinc-400 hover:bg-zinc-100'}`}>
                Kembali (Batal)
              </button>
            </div>
          </div>
        </div>
      )}

      <div className={`w-14 md:w-56 flex flex-col p-2 md:p-4 gap-1 border-r z-20 transition-colors duration-300 flex-shrink-0 ${d ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200'}`}>
        <div className="px-2 py-4 mb-2 hidden md:block">
          <p className="text-[9px] font-black text-amber-500 tracking-[0.3em] uppercase mb-1">EST. 2024</p>
          <h1 className="text-base font-black tracking-tight leading-none">Juhbay POS</h1>
        </div>
        <div className="flex justify-center md:hidden py-3">
          <Coffee size={20} className="text-amber-500" />
        </div>

        <Link href="/" className="flex items-center justify-center md:justify-start gap-3 p-3 rounded-xl bg-amber-500 text-black font-black transition-all">
          <Store size={17} /> <span className="hidden md:block text-xs tracking-wide">Kasir</span>
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
        <Link href="/dashboard" className={`flex items-center justify-center md:justify-start gap-3 p-3 rounded-xl font-bold text-xs transition-all ${d ? 'text-zinc-500 hover:bg-zinc-800 hover:text-white' : 'text-zinc-400 hover:bg-zinc-100 hover:text-zinc-900'}`}>
          <BarChart3 size={17} /> <span className="hidden md:block tracking-wide">Dashboard</span>
        </Link>

        <div className="mt-auto mb-2">
          <button onClick={confirmTutupKasir} className={`flex items-center justify-center md:justify-start gap-3 p-3 w-full rounded-xl font-black text-xs transition-all ${d ? 'bg-zinc-800 text-amber-500 hover:bg-amber-500 hover:text-black' : 'bg-zinc-100 text-amber-600 hover:bg-amber-500 hover:text-white'}`}>
            <FileText size={17} />
            <span className="hidden md:block">Tutup Kasir</span>
          </button>
        </div>

        <div className="mt-1">
          <button onClick={() => setIsDark(!d)} className={`flex items-center justify-center md:justify-start gap-3 p-3 w-full rounded-xl font-bold text-xs transition-all ${d ? 'text-zinc-600 hover:bg-zinc-800 hover:text-white' : 'text-zinc-400 hover:bg-zinc-100 hover:text-zinc-900'}`}>
            {d ? <Sun size={17} /> : <Moon size={17} />}
            <span className="hidden md:block">{d ? 'Light Mode' : 'Dark Mode'}</span>
          </button>
        </div>
      </div>

      <div className="flex flex-col md:flex-row flex-1 overflow-hidden min-w-0">

        <div className="flex-1 overflow-y-auto p-4 md:p-8 min-h-0">
          <div className="flex justify-between items-center mb-4 md:mb-5">
            <h2 className={`text-xs font-black tracking-[0.3em] uppercase ${d ? 'text-zinc-600' : 'text-zinc-400'}`}>Order Menu</h2>
          </div>

          {activeProducts && Object.entries(activeProducts).map(([cat, names]) => (
            <div key={cat} className="mb-5 md:mb-7">
              <h3 className={`text-[8px] md:text-[9px] font-black tracking-[0.3em] uppercase mb-2 md:mb-3 px-3 py-1 rounded-full inline-block border ${d ? 'text-amber-500 bg-amber-500/10 border-amber-500/20' : 'text-amber-700 bg-amber-50 border-amber-200'}`}>{cat}</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 md:gap-3">
                {Object.entries(names).map(([name, variants]) => (
                  <div key={name} className={`p-3 md:p-4 rounded-2xl border flex flex-col justify-between transition-all ${d ? 'bg-zinc-900 border-zinc-800 hover:border-zinc-700' : 'bg-white border-zinc-200 shadow-sm hover:border-zinc-300'}`}>
                    <h4 className="font-black text-[11px] md:text-sm mb-2 md:mb-3 leading-tight">{name}</h4>
                    <div className="space-y-1 md:space-y-1.5">
                      {variants.map(v => (
                        <button key={v.id} onClick={() => addToCart(v)} disabled={v.stock <= 0 && v.price !== 0}
                          className={`w-full flex justify-between items-center p-1.5 md:p-2 rounded-xl font-bold transition-all disabled:opacity-30 group
                            ${d ? 'bg-zinc-800 hover:bg-amber-500 hover:text-black text-zinc-300' : 'bg-zinc-100 hover:bg-amber-500 hover:text-black text-zinc-700'}`}>
                          <div className="flex flex-col items-start gap-0 md:gap-0.5">
                            <span className="opacity-50 uppercase text-[7px] md:text-[8px] tracking-wider">{v.variant || 'Regular'}</span>
                            <span className={`text-[7px] md:text-[8px] font-bold group-hover:text-black/60 ${d ? 'text-amber-500' : 'text-amber-600'}`}>Sisa: {v.stock}</span>
                          </div>
                          <span className="text-[9px] md:text-[10px] font-black">{v.price === 0 ? 'PILIH' : `Rp ${v.price.toLocaleString('id-ID')}`}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className={`w-full md:w-72 lg:w-80 flex flex-col border-t md:border-t-0 md:border-l flex-shrink-0 transition-colors duration-300 h-[45vh] md:h-auto ${d ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200'}`}>

          <div className={`p-3 md:p-5 border-b flex justify-between items-center flex-shrink-0 ${d ? 'border-zinc-800' : 'border-zinc-100'}`}>
            <h2 className="font-black flex items-center gap-2 text-xs md:text-sm">
              <ShoppingCart size={14} className="md:w-4 md:h-4 text-amber-500" />
              Keranjang
              {cart.length > 0 && (
                <span className="bg-amber-500 text-black text-[8px] md:text-[9px] font-black w-4 h-4 md:w-4 md:h-4 rounded-full flex items-center justify-center ml-1">{cart.length}</span>
              )}
            </h2>
            <button onClick={() => setCart([])} className="text-[8px] md:text-[9px] font-black text-red-500 uppercase tracking-widest hover:underline">Clear</button>
          </div>

          <div className="flex-1 p-2 md:p-3 overflow-y-auto space-y-1.5 md:space-y-2 min-h-0">
            {cart.length === 0 && (
              <div className={`flex flex-col items-center justify-center h-full py-6 ${d ? 'text-zinc-700' : 'text-zinc-300'}`}>
                <ShoppingCart size={24} className="md:w-7 md:h-7 mb-2" />
                <p className="text-[8px] md:text-[9px] font-black uppercase tracking-widest">Keranjang kosong</p>
              </div>
            )}
            {cart.map(item => (
              <div key={item.cartKey} className={`flex justify-between items-center p-2 md:p-3 rounded-xl border ${d ? 'bg-zinc-800 border-zinc-700' : 'bg-zinc-50 border-zinc-200'}`}>
                <div className="flex-1 min-w-0 pr-2">
                  <p className="text-[9px] md:text-[11px] font-black truncate leading-tight">{item.name}</p>
                  <p className={`text-[8px] md:text-[10px] font-bold mt-0.5 ${d ? 'text-amber-500' : 'text-amber-600'}`}>
                    Rp {item.price.toLocaleString()} <span className={`font-normal ${d ? 'text-zinc-500' : 'text-zinc-400'}`}>x{item.quantity}</span>
                  </p>
                </div>
                <button onClick={() => setCart(cart.filter(c => c.cartKey !== item.cartKey))}
                  className={`p-1.5 rounded-lg transition-colors flex-shrink-0 ${d ? 'text-zinc-600 hover:text-red-500 hover:bg-zinc-700' : 'text-zinc-300 hover:text-red-500 hover:bg-zinc-100'}`}>
                  <Trash2 size={12} className="md:w-3.5 md:h-3.5" />
                </button>
              </div>
            ))}
          </div>

          <div className={`p-3 md:p-5 border-t flex-shrink-0 ${d ? 'border-zinc-800 bg-zinc-950' : 'border-zinc-100 bg-zinc-50'}`}>
            <div className="mb-2 md:mb-3">
              <p className={`text-[8px] md:text-[9px] font-black uppercase tracking-widest mb-1.5 md:mb-2 ${d ? 'text-zinc-600' : 'text-zinc-400'}`}>Metode Bayar (Lunas)</p>
              <div className="flex gap-1.5 md:gap-2">
                <button onClick={() => setPaymentMethod('CASH')}
                  className={`flex-1 flex items-center justify-center gap-1 md:gap-1.5 py-1.5 md:py-2 rounded-xl font-black text-[8px] md:text-[10px] transition-all tracking-wider
                    ${paymentMethod === 'CASH' ? 'bg-amber-500 text-black' : d ? 'bg-zinc-800 text-zinc-500' : 'bg-zinc-200 text-zinc-400'}`}>
                  <Banknote size={10} className="md:w-3 md:h-3" /> CASH
                </button>
                <button onClick={() => setPaymentMethod('QRIS')}
                  className={`flex-1 flex items-center justify-center gap-1 md:gap-1.5 py-1.5 md:py-2 rounded-xl font-black text-[8px] md:text-[10px] transition-all tracking-wider
                    ${paymentMethod === 'QRIS' ? 'bg-blue-600 text-white' : d ? 'bg-zinc-800 text-zinc-500' : 'bg-zinc-200 text-zinc-400'}`}>
                  <QrCode size={10} className="md:w-3 md:h-3" /> QRIS
                </button>
                <button onClick={() => setPaymentMethod('SPLIT')}
                  className={`flex-1 flex items-center justify-center gap-1 md:gap-1.5 py-1.5 md:py-2 rounded-xl font-black text-[8px] md:text-[10px] transition-all tracking-wider
                    ${paymentMethod === 'SPLIT' ? 'bg-purple-500 text-white' : d ? 'bg-zinc-800 text-zinc-500' : 'bg-zinc-200 text-zinc-400'}`}>
                  <SplitSquareHorizontal size={10} className="md:w-3 md:h-3" /> SPLIT
                </button>
              </div>
            </div>

            {paymentMethod === 'SPLIT' && (
              <div className={`p-2 md:p-3 rounded-xl border mb-2 md:mb-3 ${d ? 'bg-zinc-900 border-zinc-700' : 'bg-zinc-50 border-zinc-200'}`}>
                <label className={`text-[8px] md:text-[9px] font-black uppercase tracking-widest block mb-1 ${d ? 'text-zinc-400' : 'text-zinc-500'}`}>Nominal Cash</label>
                <input type="number" value={splitCash} onChange={e => setSplitCash(e.target.value)}
                  className={`w-full p-1.5 md:p-2 rounded-lg font-bold outline-none border text-[10px] md:text-xs mb-1.5 md:mb-2 ${d ? 'bg-zinc-800 border-zinc-700 text-white' : 'bg-white border-zinc-200'}`} placeholder="Masukkan uang cash..." />
                <p className={`text-[8px] md:text-[9px] font-bold ${d ? 'text-zinc-400' : 'text-zinc-500'}`}>
                  Sisa via QRIS: <span className="text-purple-500">Rp {(cartTotal - (parseInt(splitCash) || 0)).toLocaleString('id-ID')}</span>
                </p>
              </div>
            )}

            <div className="flex justify-between items-end mb-2 md:mb-3 mt-1">
              <span className={`text-[8px] md:text-[9px] font-black uppercase tracking-widest ${d ? 'text-zinc-600' : 'text-zinc-400'}`}>Total</span>
              <span className="text-lg md:text-xl font-black tracking-tighter">
                Rp {cartTotal.toLocaleString('id-ID')}
              </span>
            </div>
            <button onClick={() => setIsCheckoutModalOpen(true)} disabled={cart.length === 0}
              className="w-full bg-amber-500 hover:bg-amber-400 disabled:bg-zinc-800 disabled:text-zinc-600 text-black font-black py-2.5 md:py-3 rounded-xl transition-all active:scale-95 uppercase tracking-widest text-[10px] md:text-xs">
              Bayar Sekarang
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}