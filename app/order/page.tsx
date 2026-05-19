'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { onlineOrdersDB } from '../../lib/db';
import { ShoppingCart, Plus, Minus, Trash2, Send, CheckCircle, Coffee } from 'lucide-react';

interface Product {
  id: number;
  name: string;
  category: string;
  variant?: string;
  price: number;
  is_active: boolean;
}

interface CartItem {
  productId: number;
  name: string;
  price: number;
  quantity: number;
}

export default function OrderPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [deliveryMethod, setDeliveryMethod] = useState('pickup');
  const [customDelivery, setCustomDelivery] = useState('');
  const [address, setAddress] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(false);

  useEffect(() => {
    const fetchProducts = async () => {
      const { data } = await supabase
        .from('products')
        .select('id, name, category, variant, price, is_active')
        .eq('is_active', true)
        .gt('price', 0)
        .order('category', { ascending: true });
      if (data) setProducts(data);
    };
    fetchProducts();
  }, []);

  const grouped = useMemo(() => {
    const map: Record<string, Product[]> = {};
    products.forEach(p => {
      if (!map[p.category]) map[p.category] = [];
      map[p.category].push(p);
    });
    return map;
  }, [products]);

  const addToCart = (p: Product) => {
    const key = p.id;
    const existing = cart.find(i => i.productId === key);
    const displayName = p.variant ? `${p.name} (${p.variant})` : p.name;
    if (existing) {
      setCart(cart.map(i => i.productId === key ? { ...i, quantity: i.quantity + 1 } : i));
    } else {
      setCart([...cart, { productId: p.id, name: displayName, price: p.price, quantity: 1 }]);
    }
  };

  const updateQty = (productId: number, delta: number) => {
    setCart(cart.map(i => {
      if (i.productId !== productId) return i;
      const newQty = i.quantity + delta;
      return newQty <= 0 ? i : { ...i, quantity: newQty };
    }));
  };

  const removeItem = (productId: number) => setCart(cart.filter(i => i.productId !== productId));

  const total = cart.reduce((s, i) => s + i.price * i.quantity, 0);

  const submitOrder = async () => {
    if (!customerName.trim()) return alert('Nama harus diisi!');
    if (!customerPhone.trim()) return alert('Nomor HP harus diisi!');
    if (cart.length === 0) return alert('Keranjang masih kosong!');
    if (deliveryMethod !== 'pickup' && !address.trim()) return alert('Alamat harus diisi untuk pengiriman!');
    if (deliveryMethod === 'other' && !customDelivery.trim()) return alert('Tulis metode pengiriman kamu!');

    const finalMethod = deliveryMethod === 'other' ? customDelivery.trim() : deliveryMethod;

    setIsSubmitting(true);
    try {
      await onlineOrdersDB.add({
        customer_name: customerName.trim(),
        customer_phone: customerPhone.trim(),
        customer_address: deliveryMethod !== 'pickup' ? address.trim() : undefined,
        delivery_method: finalMethod,
        items: cart.map(({ name, price, quantity }) => ({ name, price, quantity })),
        total: total,
        status: 'pending',
        notes: notes.trim() || undefined,
      });
      setOrderSuccess(true);
      setCart([]);
      setCustomerName('');
      setCustomerPhone('');
      setAddress('');
      setNotes('');
      setDeliveryMethod('pickup');
      setCustomDelivery('');
    } catch (e) {
      alert('Gagal mengirim pesanan. Coba lagi ya!');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (orderSuccess) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center p-6">
        <div className="text-center max-w-sm">
          <CheckCircle size={64} className="text-green-500 mx-auto mb-4" />
          <h1 className="text-2xl font-black mb-2">Pesanan Terkirim!</h1>
          <p className="text-zinc-400 text-sm mb-6">Pesanan kamu udah masuk. Tunggu konfirmasi dari kami ya!</p>
          <button onClick={() => setOrderSuccess(false)} className="bg-amber-500 text-black font-bold px-6 py-3 rounded-xl">
            Pesan Lagi
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-zinc-900 border-b border-zinc-800 p-4">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Coffee size={20} className="text-amber-500" />
            <h1 className="font-black text-sm tracking-wide">JUHBAY ORDER</h1>
          </div>
          {cart.length > 0 && (
            <span className="bg-amber-500 text-black text-xs font-bold px-2 py-0.5 rounded-full">
              {cart.length} item
            </span>
          )}
        </div>
      </div>

      <div className="max-w-lg mx-auto p-4 pb-32">
        {/* Menu */}
        {Object.entries(grouped).map(([category, items]) => (
          <div key={category} className="mb-6">
            <h2 className="text-xs font-black uppercase tracking-widest text-amber-500 mb-3">{category}</h2>
            <div className="space-y-2">
              {items.map(p => (
                <button key={p.id} onClick={() => addToCart(p)}
                  className="w-full flex justify-between items-center p-3 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-amber-500/50 transition-all active:scale-[0.98]">
                  <span className="text-sm font-bold text-left">{p.variant ? `${p.name} (${p.variant})` : p.name}</span>
                  <span className="text-xs font-bold text-amber-500 whitespace-nowrap ml-2">Rp {p.price.toLocaleString('id-ID')}</span>
                </button>
              ))}
            </div>
          </div>
        ))}

        {/* Cart */}
        {cart.length > 0 && (
          <div className="mt-6 p-4 rounded-2xl bg-zinc-900 border border-zinc-800">
            <h3 className="text-xs font-black uppercase tracking-widest text-zinc-400 mb-3 flex items-center gap-2">
              <ShoppingCart size={14} /> Keranjang
            </h3>
            <div className="space-y-2">
              {cart.map(item => (
                <div key={item.productId} className="flex items-center justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold truncate">{item.name}</p>
                    <p className="text-[10px] text-zinc-500">Rp {(item.price * item.quantity).toLocaleString('id-ID')}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => updateQty(item.productId, -1)} className="p-1 rounded bg-zinc-800 hover:bg-zinc-700"><Minus size={12} /></button>
                    <span className="text-xs font-bold w-6 text-center">{item.quantity}</span>
                    <button onClick={() => updateQty(item.productId, 1)} className="p-1 rounded bg-zinc-800 hover:bg-zinc-700"><Plus size={12} /></button>
                    <button onClick={() => removeItem(item.productId)} className="p-1 rounded text-red-500 hover:bg-zinc-800 ml-1"><Trash2 size={12} /></button>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-3 pt-3 border-t border-zinc-800 flex justify-between">
              <span className="text-xs font-bold text-zinc-400">Total</span>
              <span className="text-sm font-black">Rp {total.toLocaleString('id-ID')}</span>
            </div>
          </div>
        )}

        {/* Customer Info */}
        <div className="mt-6 space-y-3">
          <input value={customerName} onChange={e => setCustomerName(e.target.value)}
            placeholder="Nama kamu" className="w-full p-3 rounded-xl bg-zinc-900 border border-zinc-800 text-sm outline-none focus:border-amber-500" />
          <input value={customerPhone} onChange={e => setCustomerPhone(e.target.value)}
            placeholder="Nomor HP (WhatsApp)" type="tel" className="w-full p-3 rounded-xl bg-zinc-900 border border-zinc-800 text-sm outline-none focus:border-amber-500" />

          {/* Delivery Method */}
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2">Metode Pengiriman</p>
            <div className="grid grid-cols-2 gap-2">
              {([['pickup', '🏪 Ambil Sendiri'], ['self_deliver', '🛵 Diantar Pegawai'], ['ojol', '📱 Ojol (Grab/Gojek)'], ['other', '✏️ Lainnya']] as const).map(([val, label]) => (
                <button key={val} type="button" onClick={() => setDeliveryMethod(val)}
                  className={`p-2.5 rounded-xl text-[10px] font-bold border transition-all ${deliveryMethod === val ? 'bg-amber-500/20 border-amber-500 text-amber-400' : 'bg-zinc-900 border-zinc-800 text-zinc-400'}`}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          {deliveryMethod === 'other' && (
            <input value={customDelivery} onChange={e => setCustomDelivery(e.target.value)}
              placeholder="Tulis metode pengiriman (misal: titip temen)" className="w-full p-3 rounded-xl bg-zinc-900 border border-zinc-800 text-sm outline-none focus:border-amber-500" />
          )}

          {deliveryMethod !== 'pickup' && (
            <textarea value={address} onChange={e => setAddress(e.target.value)}
              placeholder="Alamat lengkap pengiriman" rows={2} className="w-full p-3 rounded-xl bg-zinc-900 border border-zinc-800 text-sm outline-none focus:border-amber-500 resize-none" />
          )}

          <textarea value={notes} onChange={e => setNotes(e.target.value)}
            placeholder="Catatan (opsional, misal: less sugar)" rows={2} className="w-full p-3 rounded-xl bg-zinc-900 border border-zinc-800 text-sm outline-none focus:border-amber-500 resize-none" />
        </div>
      </div>

      {/* Fixed bottom button */}
      {cart.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-zinc-950 border-t border-zinc-800">
          <div className="max-w-lg mx-auto">
            <button onClick={submitOrder} disabled={isSubmitting}
              className="w-full bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-black font-black py-3.5 rounded-xl transition-all active:scale-95 flex items-center justify-center gap-2 text-sm">
              <Send size={16} />
              {isSubmitting ? 'Mengirim...' : `Kirim Pesanan • Rp ${total.toLocaleString('id-ID')}`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
