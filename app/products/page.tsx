// ini di product

'use client';

import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../lib/db';
import { ArrowLeft, Plus, Trash2, PackageSearch, Coffee, Sun, Moon } from 'lucide-react';
import Link from 'next/link';

export default function AddProductPage() {
    const [name, setName] = useState('');
    const [category, setCategory] = useState('KOPI CLASSIC');
    const [price, setPrice] = useState('');
    const [isDark, setIsDark] = useState(true);

    const activeProducts = useLiveQuery(async () => {
        return await db.products.where('isActive').equals(1).reverse().toArray();
    });

    const handleAddProduct = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name || !price) return alert('Nama dan Harga wajib diisi!');

        try {
            await db.products.add({
                name: name,
                category: category,
                price: parseInt(price),
                stock: 999,
                isActive: true,
                variant: '' 
            });

            alert('Menu berhasil ditambah!');
            setName('');
            setPrice('');
        } catch (error) {
            alert('Gagal menambah menu');
            console.error(error);
        }
    };

    const handleDeleteProduct = async (id: number) => {
        if (confirm('Yakin mau hapus menu ini dari kasir? (Data di history tetap aman)')) {
            await db.products.update(id, { isActive: false });
        }
    };

    const d = isDark;

    return (
        <div className={`min-h-screen p-4 md:p-8 font-sans transition-colors duration-300 ${d ? 'bg-zinc-950 text-white' : 'bg-zinc-100 text-zinc-900'}`}>
            <div className="max-w-4xl mx-auto">

                {/* Header */}
                <div className="flex justify-between items-start mb-8">
                    <div>
                        <Link href="/" className={`inline-flex items-center gap-2 font-black text-xs mb-3 hover:opacity-70 transition-all tracking-widest uppercase ${d ? 'text-amber-500' : 'text-amber-700'}`}>
                            <ArrowLeft size={16} /> Kembali ke Kasir
                        </Link>
                        <h1 className="text-2xl md:text-3xl font-black tracking-tight">Kelola Menu</h1>
                    </div>
                    <button onClick={() => setIsDark(!d)} className={`p-3 rounded-xl border transition-all ${d ? 'border-zinc-800 text-zinc-500 hover:bg-zinc-800' : 'border-zinc-200 text-zinc-400 hover:bg-zinc-200'}`}>
                        {d ? <Sun size={16} /> : <Moon size={16} />}
                    </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">

                    {/* Form Tambah Menu */}
                    <div className="md:col-span-1">
                        <div className={`p-5 md:p-6 rounded-2xl border ${d ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200 shadow-sm'}`}>
                            <h2 className="font-black text-base mb-5">Tambah Menu Baru</h2>
                            <form onSubmit={handleAddProduct} className="space-y-4">

                                <div>
                                    <label className={`block text-[9px] font-black uppercase tracking-widest mb-2 ${d ? 'text-zinc-500' : 'text-zinc-400'}`}>Nama Menu</label>
                                    <input
                                        type="text"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        placeholder="Cth: Cookies Coklat"
                                        className={`w-full p-3 rounded-xl font-bold text-sm outline-none border ${d ? 'bg-zinc-800 border-zinc-700 text-white placeholder-zinc-600 focus:border-amber-500' : 'bg-zinc-50 border-zinc-200 text-zinc-900 placeholder-zinc-400 focus:border-amber-500'}`}
                                    />
                                </div>

                                <div>
                                    <label className={`block text-[9px] font-black uppercase tracking-widest mb-2 ${d ? 'text-zinc-500' : 'text-zinc-400'}`}>Jenis Menu</label>
                                    <select
                                        value={category}
                                        onChange={(e) => setCategory(e.target.value)}
                                        className={`w-full p-3 rounded-xl font-bold text-sm outline-none border ${d ? 'bg-zinc-800 border-zinc-700 text-white focus:border-amber-500' : 'bg-zinc-50 border-zinc-200 text-zinc-900 focus:border-amber-500'}`}
                                    >
                                        <option value="KOPI CLASSIC">Coffee Classic</option>
                                        <option value="KOPI FLAVOR">Coffee Flavor</option>
                                        <option value="NON KOPI">Non Coffee</option>
                                        <option value="MAKANAN">Food / Cookies</option>
                                    </select>
                                </div>

                                <div>
                                    <label className={`block text-[9px] font-black uppercase tracking-widest mb-2 ${d ? 'text-zinc-500' : 'text-zinc-400'}`}>Harga (Rp)</label>
                                    <input
                                        type="number"
                                        value={price}
                                        onChange={(e) => setPrice(e.target.value)}
                                        placeholder="Cth: 15000"
                                        className={`w-full p-3 rounded-xl font-bold text-sm outline-none border ${d ? 'bg-zinc-800 border-zinc-700 text-white placeholder-zinc-600 focus:border-amber-500' : 'bg-zinc-50 border-zinc-200 text-zinc-900 placeholder-zinc-400 focus:border-amber-500'}`}
                                    />
                                </div>

                                <button
                                    type="submit"
                                    className="w-full bg-amber-500 hover:bg-amber-400 text-black font-black py-3.5 rounded-xl mt-2 transition-all active:scale-95 flex justify-center items-center gap-2 text-xs uppercase tracking-widest"
                                >
                                    <Plus size={16} /> Simpan Menu
                                </button>
                            </form>
                        </div>
                    </div>

                    {/* Daftar Menu Aktif */}
                    <div className="md:col-span-2">
                        <div className={`p-5 md:p-6 rounded-2xl border min-h-64 ${d ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200 shadow-sm'}`}>
                            <h2 className="font-black text-base mb-5">Daftar Menu Aktif</h2>

                            <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
                                {!activeProducts || activeProducts.length === 0 ? (
                                    <div className={`flex flex-col items-center justify-center py-16 ${d ? 'text-zinc-700' : 'text-zinc-300'}`}>
                                        <PackageSearch size={36} className="mb-3" />
                                        <p className="font-black text-xs uppercase tracking-widest">Belum ada menu</p>
                                    </div>
                                ) : (
                                    activeProducts.map(product => (
                                        <div key={product.id} className={`flex justify-between items-center p-3.5 rounded-xl border transition-colors ${d ? 'bg-zinc-800 border-zinc-700 hover:border-zinc-600' : 'bg-zinc-50 border-zinc-200 hover:border-amber-200'}`}>
                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-center gap-2 mb-1 flex-wrap">
                                                    <span className={`text-[9px] font-black px-2 py-0.5 rounded-md uppercase tracking-wide ${d ? 'bg-zinc-700 text-zinc-400' : 'bg-zinc-200 text-zinc-600'}`}>{product.category}</span>
                                                    {product.variant && <span className={`text-[9px] font-black px-2 py-0.5 rounded-md ${d ? 'bg-amber-500/20 text-amber-400' : 'bg-amber-100 text-amber-700'}`}>{product.variant}</span>}
                                                </div>
                                                <h3 className="font-black text-sm leading-tight">{product.name}</h3>
                                                <p className={`font-bold text-xs mt-0.5 ${d ? 'text-amber-500' : 'text-amber-700'}`}>Rp {product.price.toLocaleString('id-ID')}</p>
                                            </div>

                                            <button
                                                onClick={() => handleDeleteProduct(product.id!)}
                                                className={`p-2.5 rounded-xl transition-all flex-shrink-0 ml-3 ${d ? 'text-zinc-600 hover:text-red-500 hover:bg-zinc-700' : 'text-zinc-400 hover:text-red-500 hover:bg-red-50'}`}
                                                title="Hapus Menu"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
}