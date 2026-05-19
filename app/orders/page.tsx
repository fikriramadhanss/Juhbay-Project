'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { onlineOrdersDB, OnlineOrder } from '../../lib/db';
import { ArrowLeft, Clock, CheckCircle, XCircle, Package, Pencil, Save, X, Truck, MapPin, ExternalLink } from 'lucide-react';
import Link from 'next/link';

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  pending: { label: 'Menunggu', color: 'bg-yellow-500/20 text-yellow-400', icon: Clock },
  confirmed: { label: 'Dikonfirmasi', color: 'bg-blue-500/20 text-blue-400', icon: Package },
  delivering: { label: 'Diantar', color: 'bg-purple-500/20 text-purple-400', icon: Truck },
  done: { label: 'Selesai', color: 'bg-green-500/20 text-green-400', icon: CheckCircle },
  cancelled: { label: 'Dibatalkan', color: 'bg-red-500/20 text-red-400', icon: XCircle },
};

const DELIVERY_LABELS: Record<string, string> = {
  pickup: '🏪 Ambil Sendiri',
  self_deliver: '🛵 Diantar Pegawai',
  ojol: '📱 Ojol (Grab/Gojek)',
};

// Store address for deep link - encode for URL
const STORE_ADDRESS = 'Juhbay Coffee'; // Ganti dengan alamat toko kamu

export default function OrdersPage() {
  const [orders, setOrders] = useState<OnlineOrder[]>([]);
  const [filter, setFilter] = useState<'ALL' | OnlineOrder['status']>('ALL');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ customer_name: '', customer_phone: '', notes: '', customer_address: '', delivery_method: '', custom_delivery: '' });

  const fetchOrders = async () => {
    const data = await onlineOrdersDB.toArray();
    setOrders(data);
  };

  useEffect(() => {
    fetchOrders();
    const channel = supabase
      .channel('admin-orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'online_orders' }, () => fetchOrders())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const updateStatus = async (id: string, status: OnlineOrder['status']) => {
    await onlineOrdersDB.updateStatus(id, status);

    // When order is done, auto-create sale record
    if (status === 'done') {
      const order = orders.find(o => o.id === id);
      if (order) {
        const items = (order.items || []).map(i => ({
          product_id: 0,
          name: i.name,
          price: i.price,
          quantity: i.quantity,
          hpp: 0,
        }));
        const totalAmount = order.total || items.reduce((s, i) => s + i.price * i.quantity, 0);
        const { data: saleData, error: saleErr } = await supabase.from('sales').insert({
          date: new Date().toISOString(),
          total_amount: totalAmount,
          payment_method: 'ONLINE',
          status: 'PAID',
          customer_name: order.customer_name,
          cash_amount: 0,
          qris_amount: 0,
          total_profit: 0,
        }).select('id').single();

        if (saleData && !saleErr) {
          await supabase.from('sale_items').insert(items.map(i => ({ sale_id: saleData.id, ...i })));
        }
      }
    }

    setOrders(orders.map(o => o.id === id ? { ...o, status } : o));
  };

  const startEdit = (order: OnlineOrder) => {
    setEditingId(order.id!);
    const isCustom = order.delivery_method && !['pickup', 'self_deliver', 'ojol'].includes(order.delivery_method);
    setEditForm({
      customer_name: order.customer_name,
      customer_phone: order.customer_phone,
      notes: order.notes || '',
      customer_address: order.customer_address || '',
      delivery_method: isCustom ? 'other' : (order.delivery_method || 'pickup'),
      custom_delivery: isCustom ? order.delivery_method : '',
    });
  };

  const saveEdit = async (id: string) => {
    const finalMethod = editForm.delivery_method === 'other' ? editForm.custom_delivery : editForm.delivery_method;
    await onlineOrdersDB.update(id, {
      customer_name: editForm.customer_name,
      customer_phone: editForm.customer_phone,
      notes: editForm.notes,
      customer_address: editForm.customer_address,
      delivery_method: finalMethod,
    });
    setOrders(orders.map(o => o.id === id ? { ...o, customer_name: editForm.customer_name, customer_phone: editForm.customer_phone, notes: editForm.notes, customer_address: editForm.customer_address, delivery_method: finalMethod } : o));
    setEditingId(null);
  };

  const openGrab = (address: string) => {
    const encoded = encodeURIComponent(address);
    window.open(`https://grab.onelink.me/2695613898?af_dp=grab://express/booking?dropoff=${encoded}`, '_blank');
  };

  const openGojek = (address: string) => {
    const encoded = encodeURIComponent(address);
    window.open(`https://gojek.link/gosend?drop_address=${encoded}`, '_blank');
  };

  const openGoogleMaps = (address: string) => {
    window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`, '_blank');
  };

  const filtered = filter === 'ALL' ? orders : orders.filter(o => o.status === filter);

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-4 md:p-6">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Link href="/" className="p-2 rounded-lg bg-zinc-900 hover:bg-zinc-800"><ArrowLeft size={16} /></Link>
          <h1 className="font-black text-lg">Pesanan Online</h1>
          <span className="ml-auto text-xs font-bold text-zinc-500">{orders.filter(o => o.status === 'pending').length} pending</span>
        </div>

        {/* Filter */}
        <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
          {(['ALL', 'pending', 'confirmed', 'delivering', 'done', 'cancelled'] as const).map(s => (
            <button key={s} onClick={() => setFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider whitespace-nowrap transition-all ${filter === s ? 'bg-amber-500 text-black' : 'bg-zinc-900 text-zinc-400 hover:bg-zinc-800'}`}>
              {s === 'ALL' ? 'Semua' : STATUS_CONFIG[s].label}
            </button>
          ))}
        </div>

        {/* Orders List */}
        {filtered.length === 0 && (
          <div className="text-center py-16 text-zinc-600">
            <Package size={32} className="mx-auto mb-2" />
            <p className="text-xs font-bold">Belum ada pesanan</p>
          </div>
        )}

        <div className="space-y-3">
          {filtered.map(order => {
            const cfg = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending;
            const Icon = cfg.icon;
            const isEditing = editingId === order.id;
            const needsDelivery = order.delivery_method && order.delivery_method !== 'pickup';

            return (
              <div key={order.id} className="p-4 rounded-2xl bg-zinc-900 border border-zinc-800">
                {/* Header row */}
                <div className="flex items-start justify-between mb-2">
                  {isEditing ? (
                    <div className="flex-1 space-y-2 mr-2">
                      <input value={editForm.customer_name} onChange={e => setEditForm({ ...editForm, customer_name: e.target.value })}
                        className="w-full p-2 rounded-lg bg-zinc-800 border border-zinc-700 text-sm font-bold outline-none focus:border-amber-500" placeholder="Nama" />
                      <input value={editForm.customer_phone} onChange={e => setEditForm({ ...editForm, customer_phone: e.target.value })}
                        className="w-full p-2 rounded-lg bg-zinc-800 border border-zinc-700 text-xs outline-none focus:border-amber-500" placeholder="No HP" />
                      <input value={editForm.customer_address} onChange={e => setEditForm({ ...editForm, customer_address: e.target.value })}
                        className="w-full p-2 rounded-lg bg-zinc-800 border border-zinc-700 text-xs outline-none focus:border-amber-500" placeholder="Alamat" />
                      <div className="grid grid-cols-2 gap-1.5">
                        {([['pickup', '🏪 Ambil'], ['self_deliver', '🛵 Pegawai'], ['ojol', '📱 Ojol'], ['other', '✏️ Lainnya']] as const).map(([val, label]) => (
                          <button key={val} type="button" onClick={() => setEditForm({ ...editForm, delivery_method: val })}
                            className={`p-1.5 rounded-lg text-[9px] font-bold border transition-all ${editForm.delivery_method === val ? 'bg-amber-500/20 border-amber-500 text-amber-400' : 'bg-zinc-800 border-zinc-700 text-zinc-500'}`}>
                            {label}
                          </button>
                        ))}
                      </div>
                      {editForm.delivery_method === 'other' && (
                        <input value={editForm.custom_delivery} onChange={e => setEditForm({ ...editForm, custom_delivery: e.target.value })}
                          className="w-full p-2 rounded-lg bg-zinc-800 border border-zinc-700 text-xs outline-none focus:border-amber-500" placeholder="Tulis metode pengiriman..." />
                      )}
                      <input value={editForm.notes} onChange={e => setEditForm({ ...editForm, notes: e.target.value })}
                        className="w-full p-2 rounded-lg bg-zinc-800 border border-zinc-700 text-xs outline-none focus:border-amber-500" placeholder="Catatan" />
                    </div>
                  ) : (
                    <div>
                      <p className="font-black text-sm">{order.customer_name}</p>
                      <p className="text-[10px] text-zinc-500">{order.customer_phone}</p>
                    </div>
                  )}
                  <div className="flex items-center gap-1.5">
                    <span className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold ${cfg.color}`}>
                      <Icon size={10} /> {cfg.label}
                    </span>
                    {isEditing ? (
                      <>
                        <button onClick={() => saveEdit(order.id!)} className="p-1.5 rounded-lg bg-green-600 hover:bg-green-500"><Save size={12} /></button>
                        <button onClick={() => setEditingId(null)} className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700"><X size={12} /></button>
                      </>
                    ) : (
                      <button onClick={() => startEdit(order)} className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white"><Pencil size={12} /></button>
                    )}
                  </div>
                </div>

                {/* Delivery info */}
                {!isEditing && order.delivery_method && (
                  <div className={`flex items-center gap-2 px-3 py-2 rounded-lg mb-2 text-[10px] font-bold ${order.delivery_method === 'pickup' ? 'bg-zinc-800 text-zinc-400' : 'bg-purple-500/10 text-purple-400'}`}>
                    {order.delivery_method === 'pickup' ? <Package size={12} /> : <Truck size={12} />}
                    {DELIVERY_LABELS[order.delivery_method] || `✏️ ${order.delivery_method}`}
                  </div>
                )}

                {!isEditing && needsDelivery && order.customer_address && (
                  <div className="flex items-start gap-2 px-3 py-2 rounded-lg mb-2 bg-zinc-800 text-[11px] text-zinc-300">
                    <MapPin size={12} className="text-amber-500 mt-0.5 flex-shrink-0" />
                    <span>{order.customer_address}</span>
                  </div>
                )}

                {/* Items */}
                <div className="space-y-1 my-3">
                  {(order.items || []).map((item, i) => (
                    <div key={i} className="flex justify-between text-xs">
                      <span className="text-zinc-300">{item.quantity}x {item.name}</span>
                      <span className="text-zinc-500">Rp {(item.price * item.quantity).toLocaleString('id-ID')}</span>
                    </div>
                  ))}
                </div>

                {!isEditing && order.notes && <p className="text-[10px] text-zinc-500 italic mb-2">📝 {order.notes}</p>}

                {/* Footer */}
                <div className="flex items-center justify-between pt-2 border-t border-zinc-800">
                  <div>
                    <span className="text-xs font-black">Rp {(order.total || 0).toLocaleString('id-ID')}</span>
                    <span className="text-[10px] text-zinc-600 ml-2">
                      {order.created_at && new Date(order.created_at).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  {order.status === 'pending' && (
                    <div className="flex gap-1.5">
                      <button onClick={() => updateStatus(order.id!, 'confirmed')} className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-[10px] font-bold hover:bg-blue-500">Konfirmasi</button>
                      <button onClick={() => updateStatus(order.id!, 'cancelled')} className="px-3 py-1.5 rounded-lg bg-zinc-800 text-red-400 text-[10px] font-bold hover:bg-zinc-700">Tolak</button>
                    </div>
                  )}

                  {order.status === 'confirmed' && needsDelivery && (
                    <div className="flex gap-1.5 flex-wrap justify-end">
                      {order.delivery_method === 'ojol' && order.customer_address && (
                        <>
                          <button onClick={() => openGrab(order.customer_address!)} className="px-2.5 py-1.5 rounded-lg bg-green-700 text-white text-[10px] font-bold hover:bg-green-600 flex items-center gap-1">
                            <ExternalLink size={10} /> Grab
                          </button>
                          <button onClick={() => openGojek(order.customer_address!)} className="px-2.5 py-1.5 rounded-lg bg-green-700 text-white text-[10px] font-bold hover:bg-green-600 flex items-center gap-1">
                            <ExternalLink size={10} /> Gojek
                          </button>
                        </>
                      )}
                      {order.delivery_method === 'self_deliver' && (
                        <button onClick={() => updateStatus(order.id!, 'delivering')} className="px-3 py-1.5 rounded-lg bg-purple-600 text-white text-[10px] font-bold hover:bg-purple-500 flex items-center gap-1">
                          <Truck size={10} /> Antar Sekarang
                        </button>
                      )}
                      {order.customer_address && (
                        <button onClick={() => openGoogleMaps(order.customer_address!)} className="px-2.5 py-1.5 rounded-lg bg-zinc-800 text-zinc-300 text-[10px] font-bold hover:bg-zinc-700 flex items-center gap-1">
                          <MapPin size={10} /> Maps
                        </button>
                      )}
                      <button onClick={() => updateStatus(order.id!, 'delivering')} className="px-3 py-1.5 rounded-lg bg-purple-600 text-white text-[10px] font-bold hover:bg-purple-500">Diantar</button>
                    </div>
                  )}

                  {order.status === 'confirmed' && !needsDelivery && (
                    <button onClick={() => updateStatus(order.id!, 'done')} className="px-3 py-1.5 rounded-lg bg-green-600 text-white text-[10px] font-bold hover:bg-green-500">Selesai</button>
                  )}

                  {order.status === 'delivering' && (
                    <button onClick={() => updateStatus(order.id!, 'done')} className="px-3 py-1.5 rounded-lg bg-green-600 text-white text-[10px] font-bold hover:bg-green-500">Sudah Sampai</button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
