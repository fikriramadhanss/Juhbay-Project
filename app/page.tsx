// app/page.tsx

'use client';

import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, Product } from '../lib/db';
import { ShoppingCart, Coffee, History, Trash2, Settings, Store, Banknote, QrCode, X, Sun, Moon, FileText, BarChart3, BookOpen, CheckCircle, SplitSquareHorizontal, Calculator } from 'lucide-react';
import Link from 'next/link';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function POSPage() {
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

  const activeProducts = useLiveQuery(async () => {
    const all = await db.products.toArray();
    const active = all.filter(p => p.isActive === true);

    const grouped: Record<string, Record<string, Product[]>> = {};
    active.forEach(p => {
      if (!grouped[p.category]) grouped[p.category] = {};
      if (!grouped[p.category][p.name]) grouped[p.category][p.name] = [];
      grouped[p.category][p.name].push(p);
    });
    return grouped;
  });

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
      productId: selectedProduct?.id,
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

    const totalProfit = cart.reduce((sum, item) => sum + ((item.price - item.hpp) * item.quantity), 0);

    for (const item of cart) {
      const p = await db.products.get(item.productId);
      if (p) await db.products.update(item.productId, { stock: p.stock - item.quantity });
    }

    await db.sales.add({
      date: new Date(),
      totalAmount: cartTotal,
      paymentMethod: paymentMethod,
      status: isKasbon ? 'UNPAID' : 'PAID',
      customerName: customerName || '-',
      cashAmount: cAmount,
      qrisAmount: qAmount,
      totalProfit: totalProfit,
      items: cart.map(i => ({ productId: i.productId, name: i.name, price: i.price, quantity: i.quantity, hpp: i.hpp }))
    });

    if (isKasbon) {
      alert(`Pesanan a/n ${customerName} masuk ke Buku Hutang (Rencana Via ${paymentMethod})!`);
    } else {
      alert(`Pembayaran ${paymentMethod} Berhasil!`);
    }

    setCart([]);
    setCustomerName('');
    setSplitCash('');
    setIsCheckoutModalOpen(false);
  };

  const cancelOrder = () => {
    setCart([]);
    setCustomerName('');
    setSplitCash('');
    setIsCheckoutModalOpen(false);
  };

  // ==========================================
  // FUNGSI TUTUP KASIR (FIX KASBON MINUS & HASIL BERSIH)
  // ==========================================
  const handleTutupKasir = async () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const todaysSales = await db.sales
      .where('date')
      .between(today, tomorrow)
      .toArray();

    if (todaysSales.length === 0) {
      return alert('Belum ada transaksi hari ini, nggak bisa tutup kasir!');
    }

    const allProducts = await db.products.toArray();

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
          realProfit = sale.items.reduce((sum, item) => {
            let hpp = item.hpp;
            if (!hpp || hpp === 0) {
              const p = allProducts.find(prod => prod.id === item.productId);
              hpp = p?.hppTotal || 0;
            }
            return sum + ((item.price - hpp) * item.quantity);
          }, 0);
        }
        totalProfitLunas += realProfit;
      } else {
        totalKasbon += sale.totalAmount;
      }

      const itemsStr = sale.items.map(i => `${i.name} (x${i.quantity})`).join(', ');
      const methodStr = isUnpaid
        ? 'KASBON (Belum Bayar)'
        : (sale.paymentMethod === 'SPLIT' ? `SPLIT (C:${sale.cashAmount}, Q:${sale.qrisAmount})` : sale.paymentMethod);

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

    // Hitung hasil bersih akhir dikurangi kasbon
    const hasilBersihAkhir = totalProfitLunas - totalKasbon;

    autoTable(doc, {
      startY: 35,
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
      // @ts-ignore
      didParseCell: function (data: any) {
        if (data.row.index === 3 && data.column.index === 1) {
          data.cell.styles.textColor = [239, 68, 68]; // Merah untuk Kasbon
          data.cell.styles.fontStyle = 'bold';
        }
        if (data.row.index === 4 && data.column.index === 1) {
          if (hasilBersihAkhir < 0) {
            data.cell.styles.textColor = [239, 68, 68]; // Merah kalau minus
          } else {
            data.cell.styles.textColor = [34, 197, 94]; // Hijau kalau plus
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
      styles: { fontSize: 8 },
      // @ts-ignore
      didParseCell: function (data: any) {
        if (data.row.raw[3] === 'KASBON (Belum Bayar)') {
          if (data.column.index === 3 || data.column.index === 4) {
            data.cell.styles.textColor = [239, 68, 68]; // Merah untuk row Kasbon
            data.cell.styles.fontStyle = 'bold';
          }
        }
      }
    });

    doc.save(`Rekap_Juhbay_${today.toISOString().split('T')[0]}.pdf`);
    alert('Tutup Kasir selesai! Data Kasbon otomatis mengurangi Hasil Bersih di PDF.');
  };

  const d = isDark;

  return (
    <div className={`flex h-screen font-sans overflow-hidden relative transition-colors duration-300 ${d ? 'bg-zinc-950 text-white' : 'bg-zinc-100 text-zinc-900'}`}>

      {/* MODAL MANUAL BREW */}
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

      {/* MODAL CHECKOUT CONFIRMATION */}
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

      {/* SIDEBAR NAVIGATION */}
      <div className={`w-14 md:w-56 flex flex-col p-2 md:p-4 gap-1 border-r z-20 transition-colors duration-300 flex-shrink-0 ${d ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200'}`}>
        <div className="px-2 py-4 mb-2 hidden md:block">
          <p className="text-[9px] font-black text-amber-500 tracking-[0.3em] uppercase mb-1">EST. 2024</p>
          <h1 className="text-base font-black tracking-tight leading-none">Juhbay Coffee</h1>
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
          <button onClick={handleTutupKasir} className={`flex items-center justify-center md:justify-start gap-3 p-3 w-full rounded-xl font-black text-xs transition-all ${d ? 'bg-zinc-800 text-amber-500 hover:bg-amber-500 hover:text-black' : 'bg-zinc-100 text-amber-600 hover:bg-amber-500 hover:text-white'}`}>
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

      {/* MAIN AREA */}
      <div className="flex flex-col md:flex-row flex-1 overflow-hidden min-w-0">

        {/* MENU GRID */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8 min-h-0">
          <h2 className={`text-xs font-black tracking-[0.3em] uppercase mb-4 md:mb-5 ${d ? 'text-zinc-600' : 'text-zinc-400'}`}>Order Menu</h2>

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

        {/* CART */}
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