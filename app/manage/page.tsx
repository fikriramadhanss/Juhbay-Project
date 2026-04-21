// ini manage

'use client';

import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, Product } from '../../lib/db';
import { History, Settings, Store, PackagePlus, Minus, Plus, Edit, Trash2, Save, X, Coffee, Sun, Moon, Check } from 'lucide-react';
import Link from 'next/link';

export default function ManagePage() {
    const [formName, setFormName] = useState('');
    const [formCategory, setFormCategory] = useState('KOPI CLASSIC');
    const [formPrice, setFormPrice] = useState('');
    const [formStock, setFormStock] = useState('50');
    const [isDark, setIsDark] = useState(true);
    const [isFormOpen, setIsFormOpen] = useState(false);

    const [editId, setEditId] = useState<number | null>(null);
    const [editForm, setEditForm] = useState({ name: '', category: '', price: '' });

    const manageProductsList = useLiveQuery(async () => {
        const all = await db.products.toArray();
        return all.filter(p => p.isActive === true).reverse();
    });

    const handleAddProduct = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formName || !formPrice || !formStock) return alert('Isi Nama, Harga, dan Stok!');
        await db.products.add({
            name: formName, category: formCategory, price: parseInt(formPrice), stock: parseInt(formStock), isActive: true, variant: ''
        });
        setFormName(''); setFormPrice(''); setFormStock('50');
        setIsFormOpen(false);
    };

    const startEdit = (product: Product) => {
        setEditId(product.id!);
        setEditForm({ name: product.name, category: product.category, price: product.price.toString() });
    };

    const saveEdit = async () => {
        if (!editForm.name || !editForm.price) return alert('Isi lengkap!');
        await db.products.update(editId!, { name: editForm.name, category: editForm.category, price: parseInt(editForm.price) });
        setEditId(null);
    };

    const updateStock = async (id: number, newStock: number) => {
        if (newStock < 0) return;
        await db.products.update(id, { stock: newStock });
    };

    const d = isDark;

    const catColor: Record<string, string> = {
        'KOPI CLASSIC': d ? 'bg-amber-500/10 text-amber-400' : 'bg-amber-100 text-amber-700',
        'KOPI FLAVOR': d ? 'bg-orange-500/10 text-orange-400' : 'bg-orange-100 text-orange-700',
        'NON KOPI': d ? 'bg-blue-500/10 text-blue-400' : 'bg-blue-100 text-blue-700',
        'MAKANAN': d ? 'bg-green-500/10 text-green-400' : 'bg-green-100 text-green-700',
    };

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
                <Link href="/manage" className="flex items-center justify-center md:justify-start gap-3 p-3 rounded-xl bg-amber-500 text-black font-black text-xs transition-all">
                    <Settings size={17} /> <span className="hidden md:block tracking-wide">Kelola Menu</span>
                </Link>

                <div className="mt-auto">
                    <button onClick={() => setIsDark(!d)} className={`flex items-center justify-center md:justify-start gap-3 p-3 w-full rounded-xl font-bold text-xs transition-all ${d ? 'text-zinc-600 hover:bg-zinc-800 hover:text-white' : 'text-zinc-400 hover:bg-zinc-100 hover:text-zinc-900'}`}>
                        {d ? <Sun size={17} /> : <Moon size={17} />}
                        <span className="hidden md:block">{d ? 'Light Mode' : 'Dark Mode'}</span>
                    </button>
                </div>
            </div>

            {/* MAIN CONTENT */}
            <div className="flex-1 overflow-hidden flex flex-col min-w-0">

                {/* TOP BAR */}
                <div className={`flex items-center justify-between px-5 md:px-8 py-4 border-b flex-shrink-0 ${d ? 'border-zinc-800 bg-zinc-900' : 'border-zinc-200 bg-white'}`}>
                    <div>
                        <h2 className="text-base font-black tracking-tight">Kelola Menu</h2>
                        <p className={`text-[9px] font-black uppercase tracking-widest ${d ? 'text-zinc-600' : 'text-zinc-400'}`}>
                            {manageProductsList?.length ?? 0} menu aktif
                        </p>
                    </div>
                    <button
                        onClick={() => setIsFormOpen(!isFormOpen)}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-black text-xs transition-all tracking-wider uppercase
                            ${isFormOpen
                                ? d ? 'bg-zinc-800 text-zinc-400' : 'bg-zinc-200 text-zinc-500'
                                : 'bg-amber-500 hover:bg-amber-400 text-black'}`}
                    >
                        {isFormOpen ? <><X size={14} /> Tutup</> : <><PackagePlus size={14} /> Tambah Menu</>}
                    </button>
                </div>

                {/* FORM TAMBAH */}
                {isFormOpen && (
                    <div className={`flex-shrink-0 border-b px-5 md:px-8 py-5 ${d ? 'bg-zinc-900/50 border-zinc-800' : 'bg-zinc-50 border-zinc-200'}`}>
                        <form onSubmit={handleAddProduct} className="flex flex-wrap gap-3 items-end">
                            <div className="flex-1 min-w-[130px]">
                                <label className={`text-[9px] font-black uppercase tracking-widest block mb-1.5 ${d ? 'text-zinc-500' : 'text-zinc-400'}`}>Nama Menu</label>
                                <input type="text" value={formName} onChange={e => setFormName(e.target.value)} placeholder="Cth: Cookies Coklat"
                                    className={`w-full p-2.5 rounded-xl font-bold text-xs outline-none border ${d ? 'bg-zinc-800 border-zinc-700 text-white placeholder-zinc-600 focus:border-amber-500' : 'bg-white border-zinc-200 text-zinc-900 placeholder-zinc-400 focus:border-amber-500'}`} />
                            </div>
                            <div className="min-w-[130px]">
                                <label className={`text-[9px] font-black uppercase tracking-widest block mb-1.5 ${d ? 'text-zinc-500' : 'text-zinc-400'}`}>Kategori</label>
                                <select value={formCategory} onChange={e => setFormCategory(e.target.value)}
                                    className={`w-full p-2.5 rounded-xl font-bold text-xs outline-none border ${d ? 'bg-zinc-800 border-zinc-700 text-white focus:border-amber-500' : 'bg-white border-zinc-200 text-zinc-900 focus:border-amber-500'}`}>
                                    <option value="KOPI CLASSIC">Kopi Classic</option>
                                    <option value="KOPI FLAVOR">Kopi Flavor</option>
                                    <option value="NON KOPI">Non Kopi</option>
                                    <option value="MAKANAN">Makanan / Cookies</option>
                                </select>
                            </div>
                            <div className="min-w-[100px]">
                                <label className={`text-[9px] font-black uppercase tracking-widest block mb-1.5 ${d ? 'text-zinc-500' : 'text-zinc-400'}`}>Harga (Rp)</label>
                                <input type="number" value={formPrice} onChange={e => setFormPrice(e.target.value)} placeholder="15000"
                                    className={`w-full p-2.5 rounded-xl font-bold text-xs outline-none border ${d ? 'bg-zinc-800 border-zinc-700 text-white placeholder-zinc-600 focus:border-amber-500' : 'bg-white border-zinc-200 text-zinc-900 placeholder-zinc-400 focus:border-amber-500'}`} />
                            </div>
                            <div className="min-w-[80px]">
                                <label className={`text-[9px] font-black uppercase tracking-widest block mb-1.5 ${d ? 'text-zinc-500' : 'text-zinc-400'}`}>Stok</label>
                                <input type="number" value={formStock} onChange={e => setFormStock(e.target.value)}
                                    className={`w-full p-2.5 rounded-xl font-bold text-xs outline-none border ${d ? 'bg-zinc-800 border-zinc-700 text-white focus:border-amber-500' : 'bg-white border-zinc-200 text-zinc-900 focus:border-amber-500'}`} />
                            </div>
                            <button type="submit" className="bg-amber-500 hover:bg-amber-400 text-black font-black px-5 py-2.5 rounded-xl transition-all active:scale-95 text-xs uppercase tracking-widest flex items-center gap-1.5">
                                <Check size={14} /> Simpan
                            </button>
                        </form>
                    </div>
                )}

                {/* TABLE */}
                <div className="flex-1 overflow-y-auto overflow-x-auto">
                    <table className="w-full text-left min-w-[480px]">
                        <thead className={`sticky top-0 z-10 border-b ${d ? 'bg-zinc-950 border-zinc-800' : 'bg-zinc-100 border-zinc-200'}`}>
                            <tr className={`text-[9px] font-black uppercase tracking-widest ${d ? 'text-zinc-600' : 'text-zinc-400'}`}>
                                <th className="px-5 md:px-8 py-3.5 w-[35%]">Menu</th>
                                <th className="px-4 py-3.5 hidden sm:table-cell">Kategori</th>
                                <th className="px-4 py-3.5">Harga</th>
                                <th className="px-4 py-3.5">Stok</th>
                                <th className="px-4 py-3.5 text-right">Aksi</th>
                            </tr>
                        </thead>
                        <tbody className={`divide-y ${d ? 'divide-zinc-800/50' : 'divide-zinc-100'}`}>
                            {manageProductsList?.map((p, index) => (
                                <tr key={p.id} className={`transition-colors group ${d ? 'hover:bg-zinc-900' : 'hover:bg-white'}`}>

                                    {editId === p.id ? (
                                        <>
                                            <td className="px-5 md:px-8 py-3">
                                                <input type="text" value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                                                    className={`w-full p-2 rounded-lg border font-bold text-xs outline-none ${d ? 'bg-zinc-800 border-zinc-600 text-white focus:border-amber-500' : 'bg-white border-zinc-300 text-zinc-900 focus:border-amber-500'}`} />
                                            </td>
                                            <td className="px-4 py-3 hidden sm:table-cell">
                                                <select value={editForm.category} onChange={e => setEditForm({ ...editForm, category: e.target.value })}
                                                    className={`w-full p-2 rounded-lg border font-bold text-xs outline-none ${d ? 'bg-zinc-800 border-zinc-600 text-white' : 'bg-white border-zinc-300 text-zinc-900'}`}>
                                                    <option value="KOPI CLASSIC">Kopi Classic</option>
                                                    <option value="KOPI FLAVOR">Kopi Flavor</option>
                                                    <option value="NON KOPI">Non Kopi</option>
                                                    <option value="MAKANAN">Makanan</option>
                                                </select>
                                            </td>
                                            <td className="px-4 py-3">
                                                <input type="number" value={editForm.price} onChange={e => setEditForm({ ...editForm, price: e.target.value })}
                                                    className={`w-24 p-2 rounded-lg border font-bold text-xs outline-none ${d ? 'bg-zinc-800 border-zinc-600 text-white focus:border-amber-500' : 'bg-white border-zinc-300 text-zinc-900 focus:border-amber-500'}`} />
                                            </td>
                                            <td className="px-4 py-3" />
                                            <td className="px-4 py-3 text-right">
                                                <div className="flex items-center justify-end gap-1.5">
                                                    <button onClick={saveEdit} className="bg-green-500 hover:bg-green-400 text-white p-2 rounded-lg transition-all"><Save size={13} /></button>
                                                    <button onClick={() => setEditId(null)} className={`p-2 rounded-lg transition-all ${d ? 'bg-zinc-700 text-zinc-400' : 'bg-zinc-200 text-zinc-500'}`}><X size={13} /></button>
                                                </div>
                                            </td>
                                        </>
                                    ) : (
                                        <>
                                            <td className="px-5 md:px-8 py-3.5">
                                                <div className="flex items-center gap-2">
                                                    {index < 3 && <span className="bg-red-500 text-white text-[7px] font-black px-1.5 py-0.5 rounded-md uppercase tracking-wide flex-shrink-0">NEW</span>}
                                                    <p className="font-black text-xs leading-tight">
                                                        {p.name}
                                                        {p.variant && <span className={`text-[10px] font-bold ml-1 ${d ? 'text-zinc-500' : 'text-zinc-400'}`}>({p.variant})</span>}
                                                    </p>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3.5 hidden sm:table-cell">
                                                <span className={`text-[9px] font-black px-2 py-1 rounded-lg uppercase tracking-wide ${catColor[p.category] ?? (d ? 'bg-zinc-700 text-zinc-400' : 'bg-zinc-200 text-zinc-500')}`}>
                                                    {p.category.replace('KOPI ', '')}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3.5">
                                                <span className={`text-xs font-black ${d ? 'text-zinc-300' : 'text-zinc-700'}`}>
                                                    Rp {p.price.toLocaleString('id-ID')}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3.5">
                                                <div className={`flex items-center gap-0.5 p-0.5 rounded-lg border w-fit ${d ? 'bg-zinc-800 border-zinc-700' : 'bg-white border-zinc-200 shadow-sm'}`}>
                                                    <button onClick={() => updateStock(p.id!, p.stock - 1)} className={`p-1.5 rounded-md transition-colors ${d ? 'hover:bg-zinc-700 text-zinc-500 hover:text-white' : 'hover:bg-zinc-100 text-zinc-400'}`}><Minus size={10} /></button>
                                                    <span className="font-black text-xs w-6 text-center">{p.stock}</span>
                                                    <button onClick={() => updateStock(p.id!, p.stock + 1)} className={`p-1.5 rounded-md transition-colors ${d ? 'hover:bg-zinc-700 text-zinc-500 hover:text-white' : 'hover:bg-zinc-100 text-zinc-400'}`}><Plus size={10} /></button>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3.5 text-right">
                                                <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button onClick={() => startEdit(p)} className={`p-2 rounded-lg transition-all ${d ? 'text-zinc-500 hover:text-blue-400 hover:bg-zinc-800' : 'text-zinc-400 hover:text-blue-500 hover:bg-blue-50'}`}><Edit size={13} /></button>
                                                    <button onClick={async () => { if (confirm('Hapus menu ini?')) await db.products.update(p.id!, { isActive: false }); }}
                                                        className={`p-2 rounded-lg transition-all ${d ? 'text-zinc-500 hover:text-red-400 hover:bg-zinc-800' : 'text-zinc-400 hover:text-red-500 hover:bg-red-50'}`}><Trash2 size={13} /></button>
                                                </div>
                                            </td>
                                        </>
                                    )}
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    {(!manageProductsList || manageProductsList.length === 0) && (
                        <div className={`flex flex-col items-center justify-center py-24 ${d ? 'text-zinc-700' : 'text-zinc-300'}`}>
                            <PackagePlus size={36} className="mb-3" />
                            <p className="font-black text-xs uppercase tracking-widest">Belum ada menu</p>
                            <p className={`text-[10px] mt-1 ${d ? 'text-zinc-700' : 'text-zinc-400'}`}>Klik "Tambah Menu" untuk mulai</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}