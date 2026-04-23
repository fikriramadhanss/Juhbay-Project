// app/hpp/page.tsx

'use client';

import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../lib/db';
import { Store, History, Settings, Coffee, Sun, Moon, BarChart3, BookOpen, Calculator, Check, Trash2, PackagePlus, X, Edit, Save, ListChecks } from 'lucide-react';
import Link from 'next/link';

export default function HppPage() {
    // ==========================================
    // STATE & VARIABEL
    // ==========================================
    const [isDark, setIsDark] = useState(true);
    const [isFormOpen, setIsFormOpen] = useState(false);

    // Modal Pilih Menu
    const [isApplyModalOpen, setIsApplyModalOpen] = useState(false);
    const [selectedTemplateId, setSelectedTemplateId] = useState('');
    const [selectedProductIds, setSelectedProductIds] = useState<number[]>([]);

    // Form Tambah HPP
    const [name, setName] = useState('');
    const [air, setAir] = useState('');
    const [susu, setSusu] = useState('');
    const [gas, setGas] = useState('');
    const [beans, setBeans] = useState('');
    const [flavour, setFlavour] = useState('');
    const [cup, setCup] = useState('');
    const [esBatu, setEsBatu] = useState('');
    const [ruko, setRuko] = useState('');
    const [listrik, setListrik] = useState('');

    // State Edit HPP
    const [editId, setEditId] = useState<number | null>(null);
    const [editForm, setEditForm] = useState({
        name: '', air: '', susu: '', gas: '', beans: '', flavour: '', cup: '', esBatu: '', ruko: '', listrik: ''
    });

    const hppList = useLiveQuery(() => db.hppTemplates.toArray());
    const productsList = useLiveQuery(() => db.products.filter(p => p.isActive === true).toArray());

    // ==========================================
    // FUNGSI TAMBAH TEMPLATE
    // ==========================================
    const handleAddHpp = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name) return alert('Nama Template HPP wajib diisi!');

        const nAir = parseInt(air || '0');
        const nSusu = parseInt(susu || '0');
        const nGas = parseInt(gas || '0');
        const nBeans = parseInt(beans || '0');
        const nFlavour = parseInt(flavour || '0');
        const nCup = parseInt(cup || '0');
        const nEsBatu = parseInt(esBatu || '0');
        const nRuko = parseInt(ruko || '0');
        const nListrik = parseInt(listrik || '0');

        const total = nAir + nSusu + nGas + nBeans + nFlavour + nCup + nEsBatu + nRuko + nListrik;

        await db.hppTemplates.add({
            name, air: nAir, susu: nSusu, gas: nGas, beans: nBeans,
            flavour: nFlavour, cup: nCup, esBatu: nEsBatu, ruko: nRuko, listrik: nListrik, total
        });

        setName(''); setAir(''); setSusu(''); setGas(''); setBeans('');
        setFlavour(''); setCup(''); setEsBatu(''); setRuko(''); setListrik('');
        setIsFormOpen(false);
        alert('Template HPP berhasil disimpan!');
    };

    // ==========================================
    // FUNGSI TERAPKAN HPP KE MENU PILIHAN
    // ==========================================
    const toggleProduct = (id: number) => {
        setSelectedProductIds(prev =>
            prev.includes(id) ? prev.filter(pid => pid !== id) : [...prev, id]
        );
    };

    const toggleAllProducts = () => {
        if (productsList && selectedProductIds.length === productsList.length) {
            setSelectedProductIds([]);
        } else if (productsList) {
            setSelectedProductIds(productsList.map(p => p.id!));
        }
    };

    const handleApplyHpp = async () => {
        if (!selectedTemplateId) return alert('Pilih template HPP dulu dari dropdown!');
        if (selectedProductIds.length === 0) return alert('Centang minimal 1 menu yang mau di-set!');

        const template = await db.hppTemplates.get(parseInt(selectedTemplateId));
        if (!template) return alert('Template HPP tidak ditemukan!');

        for (const pid of selectedProductIds) {
            await db.products.update(pid, {
                hppTemplateId: template.id,
                hppTotal: template.total
            });
        }

        alert(`Sukses! HPP "${template.name}" berhasil diterapkan ke ${selectedProductIds.length} menu.`);
        setIsApplyModalOpen(false);
        setSelectedTemplateId('');
        setSelectedProductIds([]);
    };

    // ==========================================
    // FUNGSI EDIT & UPDATE TEMPLATE
    // ==========================================
    const startEdit = (h: any) => {
        setEditId(h.id);
        setEditForm({
            name: h.name, air: h.air.toString(), susu: h.susu.toString(), gas: h.gas.toString(),
            beans: h.beans.toString(), flavour: h.flavour.toString(), cup: h.cup.toString(),
            esBatu: h.esBatu.toString(), ruko: h.ruko.toString(), listrik: h.listrik.toString()
        });
    };

    const saveEdit = async () => {
        if (!editForm.name) return alert('Nama template wajib diisi!');
        const total = ['air', 'susu', 'gas', 'beans', 'flavour', 'cup', 'esBatu', 'ruko', 'listrik']
            .reduce((sum, key) => sum + parseInt((editForm as any)[key] || '0'), 0);

        await db.hppTemplates.update(editId!, {
            name: editForm.name,
            air: parseInt(editForm.air || '0'),
            susu: parseInt(editForm.susu || '0'),
            gas: parseInt(editForm.gas || '0'),
            beans: parseInt(editForm.beans || '0'),
            flavour: parseInt(editForm.flavour || '0'),
            cup: parseInt(editForm.cup || '0'),
            esBatu: parseInt(editForm.esBatu || '0'),
            ruko: parseInt(editForm.ruko || '0'),
            listrik: parseInt(editForm.listrik || '0'),
            total
        });

        // OTOMATIS update modal di semua menu yang pake template ini
        const allProducts = await db.products.toArray();
        const affectedProducts = allProducts.filter(p => p.hppTemplateId === editId);

        for (const p of affectedProducts) {
            await db.products.update(p.id!, { hppTotal: total });
        }

        setEditId(null);
        alert('Template diperbarui! Semua menu yang pakai template ini otomatis ikut update modalnya.');
    };

    const handleDelete = async (id: number) => {
        if (confirm('Hapus template HPP ini? Menu yang pake template ini bisa hilang referensi modalnya.')) {
            await db.hppTemplates.delete(id);
        }
    };

    const d = isDark;

    return (
        <div className={`flex h-screen font-sans overflow-hidden transition-colors duration-300 ${d ? 'bg-zinc-950 text-white' : 'bg-zinc-100 text-zinc-900'}`}>

            {/* MODAL TERAPKAN HPP KE MENU */}
            {isApplyModalOpen && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className={`rounded-2xl p-5 md:p-6 w-full max-w-lg shadow-2xl border flex flex-col max-h-[85vh] ${d ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200'}`}>
                        <div className={`flex justify-between items-center mb-5 border-b pb-4 ${d ? 'border-zinc-800' : 'border-zinc-200'}`}>
                            <h3 className="text-sm md:text-base font-black uppercase tracking-widest text-blue-500">Terapkan HPP ke Menu</h3>
                            <button onClick={() => setIsApplyModalOpen(false)} className={`p-1.5 rounded-lg ${d ? 'hover:bg-zinc-800' : 'hover:bg-zinc-100'}`}><X size={16} /></button>
                        </div>

                        <div className="mb-4">
                            <label className={`text-[10px] font-black uppercase tracking-widest block mb-2 ${d ? 'text-zinc-400' : 'text-zinc-500'}`}>1. Pilih Template HPP</label>
                            <select value={selectedTemplateId} onChange={e => setSelectedTemplateId(e.target.value)} className={`w-full p-3 rounded-xl font-bold text-xs outline-none border ${d ? 'bg-zinc-800 border-zinc-700 text-white focus:border-blue-500' : 'bg-white border-zinc-200 text-zinc-900 focus:border-blue-500'}`}>
                                <option value="">-- Pilih Template yang mau dipakai --</option>
                                {hppList?.map(h => <option key={h.id} value={h.id}>{h.name} (Rp {h.total.toLocaleString('id-ID')})</option>)}
                            </select>
                        </div>

                        <div className="mb-2 flex justify-between items-center mt-2">
                            <label className={`text-[10px] font-black uppercase tracking-widest ${d ? 'text-zinc-400' : 'text-zinc-500'}`}>2. Pilih Menu Tujuan</label>
                            <button onClick={toggleAllProducts} className="text-[10px] font-black text-blue-500 hover:underline uppercase">
                                {productsList?.length === selectedProductIds.length ? 'Batal Semua' : 'Pilih Semua'}
                            </button>
                        </div>

                        <div className={`flex-1 overflow-y-auto mb-5 border rounded-xl p-2 space-y-1 ${d ? 'border-zinc-800 bg-zinc-950/50' : 'border-zinc-200 bg-zinc-50'}`}>
                            {(!productsList || productsList.length === 0) ? (
                                <p className={`text-[10px] p-4 text-center ${d ? 'text-zinc-500' : 'text-zinc-400'}`}>Belum ada menu di database.</p>
                            ) : (
                                productsList.map(p => (
                                    <label key={p.id} className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${selectedProductIds.includes(p.id!) ? (d ? 'bg-blue-500/10' : 'bg-blue-50') : (d ? 'hover:bg-zinc-800' : 'hover:bg-zinc-100')}`}>
                                        <input type="checkbox" checked={selectedProductIds.includes(p.id!)} onChange={() => toggleProduct(p.id!)} className="w-4 h-4 rounded accent-blue-500 cursor-pointer" />
                                        <div className="flex-1 flex justify-between items-center">
                                            <span className={`text-xs font-bold ${d ? 'text-white' : 'text-zinc-900'}`}>{p.name} {p.variant && <span className="opacity-50">({p.variant})</span>}</span>
                                            <span className={`text-[9px] font-black px-2 py-1 rounded-md ${d ? 'bg-zinc-800 text-zinc-400' : 'bg-zinc-200 text-zinc-500'}`}>{p.category}</span>
                                        </div>
                                    </label>
                                ))
                            )}
                        </div>

                        <button onClick={handleApplyHpp} className="w-full bg-blue-500 hover:bg-blue-400 text-white font-black py-3.5 rounded-xl flex justify-center items-center gap-2 text-xs uppercase tracking-widest transition-all active:scale-95">
                            <Check size={14} /> Terapkan HPP
                        </button>
                    </div>
                </div>
            )}

            {/* SIDEBAR NAVIGATION */}
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
                <Link href="/hpp" className="flex items-center justify-center md:justify-start gap-3 p-3 rounded-xl bg-amber-500 text-black font-black text-xs transition-all">
                    <Calculator size={17} /> <span className="hidden md:block tracking-wide">Kelola HPP</span>
                </Link>
                <Link href="/hutang" className={`flex items-center justify-center md:justify-start gap-3 p-3 rounded-xl font-bold text-xs transition-all ${d ? 'text-zinc-500 hover:bg-zinc-800 hover:text-white' : 'text-zinc-400 hover:bg-zinc-100 hover:text-zinc-900'}`}>
                    <BookOpen size={17} /> <span className="hidden md:block tracking-wide">Buku Hutang</span>
                </Link>
                <Link href="/dashboard" className={`flex items-center justify-center md:justify-start gap-3 p-3 rounded-xl font-bold text-xs transition-all ${d ? 'text-zinc-500 hover:bg-zinc-800 hover:text-white' : 'text-zinc-400 hover:bg-zinc-100 hover:text-zinc-900'}`}>
                    <BarChart3 size={17} /> <span className="hidden md:block tracking-wide">Dashboard</span>
                </Link>

                <div className="mt-auto mb-2">
                    <button onClick={() => setIsDark(!d)} className={`flex items-center justify-center md:justify-start gap-3 p-3 w-full rounded-xl font-bold text-xs transition-all ${d ? 'text-zinc-600 hover:bg-zinc-800 hover:text-white' : 'text-zinc-400 hover:bg-zinc-100 hover:text-zinc-900'}`}>
                        {d ? <Sun size={17} /> : <Moon size={17} />}
                        <span className="hidden md:block">{d ? 'Light Mode' : 'Dark Mode'}</span>
                    </button>
                </div>
            </div>

            {/* MAIN CONTENT AREA */}
            <div className="flex-1 overflow-hidden flex flex-col min-w-0">
                <div className={`flex flex-col md:flex-row md:items-center justify-between px-4 sm:px-8 py-4 border-b flex-shrink-0 gap-3 ${d ? 'border-zinc-800 bg-zinc-900' : 'border-zinc-200 bg-white'}`}>
                    <div>
                        <h2 className="text-xl sm:text-base font-black tracking-tight">Kelola Modal (HPP)</h2>
                        <p className={`text-[9px] font-black uppercase tracking-widest ${d ? 'text-zinc-600' : 'text-zinc-400'}`}>Buat Template Harga Modal</p>
                    </div>
                    <div className="flex gap-2">
                        {/* TOMBOL TERAPKAN KE MENU PILIHAN */}
                        <button onClick={() => setIsApplyModalOpen(true)} className={`flex items-center gap-1.5 px-3 py-2 md:py-2.5 rounded-xl font-black text-[10px] transition-all tracking-wider uppercase bg-blue-500 hover:bg-blue-400 text-white`}>
                            <ListChecks size={14} /> Terapkan ke Menu
                        </button>

                        <button onClick={() => setIsFormOpen(!isFormOpen)} className={`flex items-center gap-1.5 px-3 py-2 md:py-2.5 rounded-xl font-black text-[10px] transition-all tracking-wider uppercase ${isFormOpen ? d ? 'bg-zinc-800 text-zinc-400' : 'bg-zinc-200 text-zinc-500' : 'bg-amber-500 hover:bg-amber-400 text-black'}`}>
                            {isFormOpen ? <><X size={14} /> Tutup</> : <><PackagePlus size={14} /> Baru</>}
                        </button>
                    </div>
                </div>

                {/* FORM TAMBAH HPP BARU */}
                {isFormOpen && (
                    <div className={`flex-shrink-0 border-b px-4 sm:px-8 py-5 overflow-y-auto max-h-[50vh] ${d ? 'bg-zinc-900/50 border-zinc-800' : 'bg-zinc-50 border-zinc-200'}`}>
                        <form onSubmit={handleAddHpp} className="grid grid-cols-2 md:grid-cols-5 gap-3 items-end">
                            <div className="col-span-2 md:col-span-5 mb-2">
                                <label className={`text-[9px] font-black uppercase tracking-widest block mb-1.5 ${d ? 'text-zinc-500' : 'text-zinc-400'}`}>Nama Template (Cth: Kopi Susu Aren)</label>
                                <input type="text" value={name} onChange={e => setName(e.target.value)} className={`w-full p-2.5 rounded-xl font-bold text-xs outline-none border ${d ? 'bg-zinc-800 border-zinc-700 text-white' : 'bg-white border-zinc-200 text-zinc-900'}`} placeholder="Masukkan nama template..." />
                            </div>
                            {[
                                { label: 'Air', val: air, set: setAir }, { label: 'Susu', val: susu, set: setSusu },
                                { label: 'Gas', val: gas, set: setGas }, { label: 'Beans', val: beans, set: setBeans },
                                { label: 'Flavour/Sirup', val: flavour, set: setFlavour }, { label: 'Cup & Sedotan', val: cup, set: setCup },
                                { label: 'Es Batu', val: esBatu, set: setEsBatu }, { label: 'Ruko (Per cup)', val: ruko, set: setRuko },
                                { label: 'Listrik (Per cup)', val: listrik, set: setListrik }
                            ].map((item, i) => (
                                <div key={i} className="min-w-[100px]">
                                    <label className={`text-[9px] font-black uppercase tracking-widest block mb-1.5 ${d ? 'text-zinc-500' : 'text-zinc-400'}`}>{item.label}</label>
                                    <input type="number" value={item.val} onChange={e => item.set(e.target.value)} placeholder="0" className={`w-full p-2.5 rounded-xl font-bold text-xs outline-none border ${d ? 'bg-zinc-800 border-zinc-700 text-white' : 'bg-white border-zinc-200 text-zinc-900'}`} />
                                </div>
                            ))}
                            <div className="col-span-2 md:col-span-1 mt-2 md:mt-0">
                                <button type="submit" className="w-full bg-green-500 hover:bg-green-400 text-white font-black px-4 py-2.5 rounded-xl transition-all active:scale-95 text-xs uppercase tracking-widest flex items-center justify-center gap-1.5">
                                    <Check size={14} /> Simpan
                                </button>
                            </div>
                        </form>
                    </div>
                )}

                {/* DAFTAR CARD HPP */}
                <div className="flex-1 overflow-y-auto p-4 md:p-8">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
                        {(!hppList || hppList.length === 0) ? (
                            <div className={`col-span-full flex flex-col items-center justify-center py-20 ${d ? 'text-zinc-700' : 'text-zinc-300'}`}>
                                <Calculator size={32} className="mb-3 md:w-10 md:h-10" />
                                <p className="font-black text-[10px] md:text-xs uppercase tracking-widest text-center">Belum ada template HPP</p>
                            </div>
                        ) : (
                            hppList.map(h => (
                                editId === h.id ? (
                                    // TAMPILAN MODE EDIT HPP
                                    <div key={h.id} className={`p-4 md:p-5 rounded-2xl border flex flex-col justify-between ${d ? 'bg-zinc-900 border-blue-500/50' : 'bg-white border-blue-300 shadow-lg'}`}>
                                        <div>
                                            <input type="text" value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} className={`w-full p-2 mb-3 rounded-lg font-black text-sm outline-none border ${d ? 'bg-zinc-800 border-zinc-700 text-white' : 'bg-zinc-50 border-zinc-200 text-zinc-900'}`} placeholder="Nama Template" />
                                            <div className="grid grid-cols-2 gap-2">
                                                {[
                                                    { key: 'air', label: 'Air' }, { key: 'susu', label: 'Susu' },
                                                    { key: 'gas', label: 'Gas' }, { key: 'beans', label: 'Beans' },
                                                    { key: 'flavour', label: 'Flavour' }, { key: 'cup', label: 'Cup' },
                                                    { key: 'esBatu', label: 'Es Batu' }, { key: 'ruko', label: 'Ruko' },
                                                    { key: 'listrik', label: 'Listrik' }
                                                ].map(item => (
                                                    <div key={item.key} className="flex flex-col">
                                                        <label className={`text-[8px] font-black uppercase ${d ? 'text-zinc-500' : 'text-zinc-400'}`}>{item.label}</label>
                                                        <input type="number" value={(editForm as any)[item.key]} onChange={e => setEditForm({ ...editForm, [item.key]: e.target.value })} className={`w-full p-1.5 rounded-md font-bold text-[10px] outline-none border ${d ? 'bg-zinc-800 border-zinc-700 text-white' : 'bg-white border-zinc-200'}`} />
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                        <div className="flex gap-2 mt-4">
                                            <button onClick={() => setEditId(null)} className={`w-1/3 border border-red-500/50 text-red-500 hover:bg-red-500/10 font-black py-2 md:py-2.5 rounded-xl transition-all active:scale-95 text-[9px] md:text-[10px] uppercase tracking-widest flex justify-center items-center gap-1`}>
                                                <X size={12} /> Batal
                                            </button>
                                            <button onClick={saveEdit} className="w-2/3 bg-blue-500 hover:bg-blue-400 text-white font-black py-2 md:py-2.5 rounded-xl transition-all active:scale-95 text-[10px] md:text-[11px] uppercase tracking-widest flex justify-center items-center gap-1.5">
                                                <Save size={12} /> Update
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    // TAMPILAN NORMAL CARD HPP
                                    <div key={h.id} className={`p-4 md:p-5 rounded-2xl border flex flex-col justify-between ${d ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200 shadow-sm'}`}>
                                        <div>
                                            <h3 className="font-black text-sm md:text-base mb-2">{h.name}</h3>
                                            <p className="text-[10px] font-bold text-amber-500 mb-3">Total Modal: Rp {h.total.toLocaleString('id-ID')} / porsi</p>
                                            <div className={`grid grid-cols-2 gap-2 p-3 rounded-lg text-[9px] font-bold ${d ? 'bg-zinc-800 text-zinc-400' : 'bg-zinc-50 text-zinc-600'}`}>
                                                <span>Air: Rp {h.air}</span><span>Susu: Rp {h.susu}</span>
                                                <span>Gas: Rp {h.gas}</span><span>Beans: Rp {h.beans}</span>
                                                <span>Flavour: Rp {h.flavour}</span><span>Cup: Rp {h.cup}</span>
                                                <span>Es: Rp {h.esBatu}</span><span>Ruko: Rp {h.ruko}</span>
                                                <span>Listrik: Rp {h.listrik}</span>
                                            </div>
                                        </div>
                                        <div className="flex gap-2 mt-4">
                                            <button onClick={() => startEdit(h)} className={`w-1/2 border border-blue-500/50 text-blue-500 hover:bg-blue-500/10 font-black py-2 rounded-xl transition-all active:scale-95 text-[10px] uppercase tracking-widest flex justify-center items-center gap-1`}>
                                                <Edit size={12} /> Edit
                                            </button>
                                            <button onClick={() => handleDelete(h.id!)} className={`w-1/2 border border-red-500/50 text-red-500 hover:bg-red-500/10 font-black py-2 rounded-xl transition-all active:scale-95 text-[10px] uppercase tracking-widest flex justify-center items-center gap-1`}>
                                                <Trash2 size={12} /> Hapus
                                            </button>
                                        </div>
                                    </div>
                                )
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}