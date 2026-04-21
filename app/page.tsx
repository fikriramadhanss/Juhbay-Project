//ini page tsx di app

'use client';

import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, Product } from '../lib/db';
import { ShoppingCart, Coffee, History, Trash2, Settings, Store, Banknote, QrCode, X, Sun, Moon } from 'lucide-react';
import Link from 'next/link';

export default function POSPage() {
  const [cart, setCart] = useState<any[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'QRIS'>('CASH');
  const [isDark, setIsDark] = useState(true);

  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [manualName, setManualName] = useState('Manual Brew');
  const [manualPrice, setManualPrice] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

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
      setCart([...cart, { cartKey, productId: product.id, name, price: product.price, quantity: 1 }]);
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
      quantity: 1
    }]);
    setIsManualModalOpen(false);
  };

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    const total = cart.reduce((s, i) => s + (i.price * i.quantity), 0);

    for (const item of cart) {
      const p = await db.products.get(item.productId);
      if (p) await db.products.update(item.productId, { stock: p.stock - item.quantity });
    }

    await db.sales.add({
      date: new Date(),
      totalAmount: total,
      paymentMethod: paymentMethod,
      items: cart.map(i => ({ productId: i.productId, name: i.name, price: i.price, quantity: i.quantity }))
    });

    alert(`Pembayaran ${paymentMethod} Berhasil!`);
    setCart([]);
  };

  const d = isDark;

  return (
    <div className={`flex h-screen font-sans overflow-hidden relative transition-colors duration-300 ${d ? 'bg-zinc-950 text-white' : 'bg-zinc-100 text-zinc-900'}`}>

      {/* MODAL MANUAL BREW */}
      {isManualModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className={`rounded-2xl p-6 md:p-8 w-full max-w-sm shadow-2xl border ${d ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200'}`}>
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-base font-black uppercase tracking-widest">Manual Brew</h3>
              <button onClick={() => setIsManualModalOpen(false)} className={`p-2 rounded-lg ${d ? 'hover:bg-zinc-800' : 'hover:bg-zinc-100'}`}><X size={18} /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className={`text-[10px] font-black uppercase tracking-widest block mb-2 ${d ? 'text-zinc-500' : 'text-zinc-400'}`}>Nama Beans / Kopi</label>
                <input type="text" value={manualName} onChange={e => setManualName(e.target.value)}
                  className={`w-full p-3 rounded-xl font-bold outline-none border text-sm ${d ? 'bg-zinc-800 border-zinc-700 text-white focus:border-amber-500' : 'bg-zinc-50 border-zinc-200 text-zinc-900 focus:border-amber-500'}`} />
              </div>
              <div>
                <label className={`text-[10px] font-black uppercase tracking-widest block mb-2 ${d ? 'text-zinc-500' : 'text-zinc-400'}`}>Harga (Rp)</label>
                <input type="number" value={manualPrice} onChange={e => setManualPrice(e.target.value)}
                  className={`w-full p-3 rounded-xl font-black text-lg outline-none border ${d ? 'bg-zinc-800 border-zinc-700 text-white focus:border-amber-500' : 'bg-zinc-50 border-zinc-200 text-zinc-900 focus:border-amber-500'}`}
                  placeholder="Cth: 25000" />
              </div>
              <button onClick={addManualToCart} className="w-full bg-amber-500 hover:bg-amber-400 text-black font-black py-4 rounded-xl transition-all active:scale-95 uppercase tracking-widest text-sm">
                Masuk Keranjang
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SIDEBAR */}
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

        <div className="mt-auto">
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
          <h2 className={`text-xs font-black tracking-[0.3em] uppercase mb-5 ${d ? 'text-zinc-600' : 'text-zinc-400'}`}>Order Menu</h2>
          {activeProducts && Object.entries(activeProducts).map(([cat, names]) => (
            <div key={cat} className="mb-7">
              <h3 className={`text-[9px] font-black tracking-[0.3em] uppercase mb-3 px-3 py-1 rounded-full inline-block border ${d ? 'text-amber-500 bg-amber-500/10 border-amber-500/20' : 'text-amber-700 bg-amber-50 border-amber-200'}`}>{cat}</h3>
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-2 md:gap-3">
                {Object.entries(names).map(([name, variants]) => (
                  <div key={name} className={`p-3 md:p-4 rounded-2xl border flex flex-col justify-between transition-all ${d ? 'bg-zinc-900 border-zinc-800 hover:border-zinc-700' : 'bg-white border-zinc-200 shadow-sm hover:border-zinc-300'}`}>
                    <h4 className="font-black text-xs md:text-sm mb-3 leading-tight">{name}</h4>
                    <div className="space-y-1.5">
                      {variants.map(v => (
                        <button key={v.id} onClick={() => addToCart(v)} disabled={v.stock <= 0 && v.price !== 0}
                          className={`w-full flex justify-between items-center p-2 rounded-xl font-bold transition-all disabled:opacity-30 group
                            ${d ? 'bg-zinc-800 hover:bg-amber-500 hover:text-black text-zinc-300' : 'bg-zinc-100 hover:bg-amber-500 hover:text-black text-zinc-700'}`}>
                          <div className="flex flex-col items-start gap-0.5">
                            <span className="opacity-50 uppercase text-[8px] tracking-wider">{v.variant || 'Regular'}</span>
                            <span className={`text-[8px] font-bold group-hover:text-black/60 ${d ? 'text-amber-500' : 'text-amber-600'}`}>Sisa: {v.stock}</span>
                          </div>
                          <span className="text-[10px] font-black">{v.price === 0 ? 'PILIH' : `Rp ${v.price.toLocaleString('id-ID')}`}</span>
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
        <div className={`w-full md:w-72 lg:w-80 flex flex-col border-t md:border-t-0 md:border-l flex-shrink-0 transition-colors duration-300 h-[42vh] md:h-auto ${d ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200'}`}>

          <div className={`p-3 md:p-5 border-b flex justify-between items-center flex-shrink-0 ${d ? 'border-zinc-800' : 'border-zinc-100'}`}>
            <h2 className="font-black flex items-center gap-2 text-sm">
              <ShoppingCart size={16} className="text-amber-500" />
              Keranjang
              {cart.length > 0 && (
                <span className="bg-amber-500 text-black text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center">{cart.length}</span>
              )}
            </h2>
            <button onClick={() => setCart([])} className="text-[9px] font-black text-red-500 uppercase tracking-widest hover:underline">Clear</button>
          </div>

          <div className="flex-1 p-3 overflow-y-auto space-y-2 min-h-0">
            {cart.length === 0 && (
              <div className={`flex flex-col items-center justify-center h-full py-6 ${d ? 'text-zinc-700' : 'text-zinc-300'}`}>
                <ShoppingCart size={28} className="mb-2" />
                <p className="text-[9px] font-black uppercase tracking-widest">Keranjang kosong</p>
              </div>
            )}
            {cart.map(item => (
              <div key={item.cartKey} className={`flex justify-between items-center p-3 rounded-xl border ${d ? 'bg-zinc-800 border-zinc-700' : 'bg-zinc-50 border-zinc-200'}`}>
                <div className="flex-1 min-w-0 pr-2">
                  <p className="text-[11px] font-black truncate leading-tight">{item.name}</p>
                  <p className={`text-[10px] font-bold mt-0.5 ${d ? 'text-amber-500' : 'text-amber-600'}`}>
                    Rp {item.price.toLocaleString()} <span className={`font-normal ${d ? 'text-zinc-500' : 'text-zinc-400'}`}>x{item.quantity}</span>
                  </p>
                </div>
                <button onClick={() => setCart(cart.filter(c => c.cartKey !== item.cartKey))}
                  className={`p-1.5 rounded-lg transition-colors flex-shrink-0 ${d ? 'text-zinc-600 hover:text-red-500 hover:bg-zinc-700' : 'text-zinc-300 hover:text-red-500 hover:bg-zinc-100'}`}>
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>

          <div className={`p-3 md:p-5 border-t space-y-3 flex-shrink-0 ${d ? 'border-zinc-800 bg-zinc-950' : 'border-zinc-100 bg-zinc-50'}`}>
            <div>
              <p className={`text-[9px] font-black uppercase tracking-widest mb-2 ${d ? 'text-zinc-600' : 'text-zinc-400'}`}>Metode Bayar</p>
              <div className="flex gap-2">
                <button onClick={() => setPaymentMethod('CASH')}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl font-black text-[10px] transition-all tracking-wider
                    ${paymentMethod === 'CASH' ? 'bg-amber-500 text-black' : d ? 'bg-zinc-800 text-zinc-500' : 'bg-zinc-200 text-zinc-400'}`}>
                  <Banknote size={13} /> CASH
                </button>
                <button onClick={() => setPaymentMethod('QRIS')}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl font-black text-[10px] transition-all tracking-wider
                    ${paymentMethod === 'QRIS' ? 'bg-blue-600 text-white' : d ? 'bg-zinc-800 text-zinc-500' : 'bg-zinc-200 text-zinc-400'}`}>
                  <QrCode size={13} /> QRIS
                </button>
              </div>
            </div>
            <div className="flex justify-between items-end">
              <span className={`text-[9px] font-black uppercase tracking-widest ${d ? 'text-zinc-600' : 'text-zinc-400'}`}>Total</span>
              <span className="text-xl font-black tracking-tighter">
                Rp {cart.reduce((s, i) => s + (i.price * i.quantity), 0).toLocaleString('id-ID')}
              </span>
            </div>
            <button onClick={handleCheckout} disabled={cart.length === 0}
              className="w-full bg-amber-500 hover:bg-amber-400 disabled:bg-zinc-800 disabled:text-zinc-600 text-black font-black py-3 rounded-xl transition-all active:scale-95 uppercase tracking-widest text-xs">
              Bayar Sekarang
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}