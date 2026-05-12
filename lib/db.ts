// lib/db.ts
// Semua operasi database sekarang menggunakan Supabase

import { supabase } from './supabase';

// ─── Type Definitions ────────────────────────────────────────────────────────

export interface HppTemplate {
    id?: number;
    name: string;
    air: number;
    susu: number;
    gas: number;
    beans: number;
    flavour: number;
    cup: number;
    es_batu: number;
    ruko: number;
    listrik: number;
    total: number;
}

export interface Product {
    id?: number;
    name: string;
    category: string;
    variant?: string;
    price: number;
    stock: number;
    is_active: boolean;
    hpp_template_id?: number;
    hpp_total?: number;
}

export interface SaleItem {
    product_id: number;
    name: string;
    price: number;
    quantity: number;
    hpp?: number;
}

export interface Sale {
    id?: number;
    date: string; // ISO string
    total_amount: number;
    payment_method: 'CASH' | 'QRIS' | 'KASBON' | 'SPLIT';
    status?: 'PAID' | 'UNPAID';
    customer_name?: string;
    cash_amount?: number;
    qris_amount?: number;
    total_profit?: number;
    items: SaleItem[];
}

// ─── HPP Templates ───────────────────────────────────────────────────────────

export const hppTemplatesDB = {
    async toArray(): Promise<HppTemplate[]> {
        const { data, error } = await supabase
            .from('hpp_templates')
            .select('*')
            .order('id', { ascending: true });
        if (error) throw error;
        return data || [];
    },

    async get(id: number): Promise<HppTemplate | null> {
        const { data, error } = await supabase
            .from('hpp_templates')
            .select('*')
            .eq('id', id)
            .single();
        if (error) return null;
        return data;
    },

    async add(template: Omit<HppTemplate, 'id'>): Promise<void> {
        const { error } = await supabase.from('hpp_templates').insert(template);
        if (error) throw error;
    },

    async update(id: number, changes: Partial<HppTemplate>): Promise<void> {
        const { error } = await supabase
            .from('hpp_templates')
            .update(changes)
            .eq('id', id);
        if (error) throw error;
    },

    async delete(id: number): Promise<void> {
        const { error } = await supabase
            .from('hpp_templates')
            .delete()
            .eq('id', id);
        if (error) throw error;
    },
};

// ─── Products ─────────────────────────────────────────────────────────────────

export const productsDB = {
    async toArray(): Promise<Product[]> {
        const { data, error } = await supabase
            .from('products')
            .select('*')
            .order('id', { ascending: true });
        if (error) throw error;
        return data || [];
    },

    async get(id: number): Promise<Product | null> {
        const { data, error } = await supabase
            .from('products')
            .select('*')
            .eq('id', id)
            .single();
        if (error) return null;
        return data;
    },

    async add(product: Omit<Product, 'id'>): Promise<void> {
        const { error } = await supabase.from('products').insert(product);
        if (error) throw error;
    },

    async update(id: number, changes: Partial<Product>): Promise<void> {
        const { error } = await supabase
            .from('products')
            .update(changes)
            .eq('id', id);
        if (error) throw error;
    },

    filter(predicate: (p: Product) => boolean) {
        return {
            async toArray(): Promise<Product[]> {
                const { data, error } = await supabase
                    .from('products')
                    .select('*')
                    .order('id', { ascending: true });
                if (error) throw error;
                return (data || []).filter(predicate);
            }
        };
    },
};

// ─── Sales ────────────────────────────────────────────────────────────────────

export const salesDB = {
    async toArray(): Promise<Sale[]> {
        const { data, error } = await supabase
            .from('sales')
            .select('*, sale_items(*)')
            .order('id', { ascending: true });
        if (error) throw error;
        return (data || []).map(normalizeSale);
    },

    async get(id: number): Promise<Sale | null> {
        const { data, error } = await supabase
            .from('sales')
            .select('*, sale_items(*)')
            .eq('id', id)
            .single();
        if (error) return null;
        return normalizeSale(data);
    },

    async add(sale: Omit<Sale, 'id'>): Promise<void> {
        const { items, ...saleData } = sale;
        const { data: inserted, error } = await supabase
            .from('sales')
            .insert(saleData)
            .select('id')
            .single();
        if (error) throw error;

        const saleId = inserted.id;
        const saleItems = items.map(item => ({
            sale_id: saleId,
            product_id: item.product_id,
            name: item.name,
            price: item.price,
            quantity: item.quantity,
            hpp: item.hpp ?? 0,
        }));

        const { error: itemsError } = await supabase.from('sale_items').insert(saleItems);
        if (itemsError) throw itemsError;
    },

    async update(id: number, changes: Partial<Omit<Sale, 'items'>>): Promise<void> {
        const { error } = await supabase
            .from('sales')
            .update(changes)
            .eq('id', id);
        if (error) throw error;
    },

    async delete(id: number): Promise<void> {
        await supabase.from('sale_items').delete().eq('sale_id', id);
        const { error } = await supabase.from('sales').delete().eq('id', id);
        if (error) throw error;
    },

    reverse() {
        return {
            async toArray(): Promise<Sale[]> {
                const { data, error } = await supabase
                    .from('sales')
                    .select('*, sale_items(*)')
                    .order('id', { ascending: false });
                if (error) throw error;
                return (data || []).map(normalizeSale);
            }
        };
    },

    async getBetweenDates(start: Date, end: Date): Promise<Sale[]> {
        const { data, error } = await supabase
            .from('sales')
            .select('*, sale_items(*)')
            .gte('date', start.toISOString())
            .lt('date', end.toISOString())
            .order('id', { ascending: true });
        if (error) throw error;
        return (data || []).map(normalizeSale);
    },
};

// ─── Helper: Normalize Supabase row → Sale ────────────────────────────────────

function normalizeSale(row: any): Sale {
    const items: SaleItem[] = (row.sale_items || []).map((si: any) => ({
        product_id: si.product_id,
        name: si.name,
        price: si.price,
        quantity: si.quantity,
        hpp: si.hpp ?? 0,
    }));
    return {
        id: row.id,
        date: row.date,
        total_amount: row.total_amount,
        payment_method: row.payment_method,
        status: row.status,
        customer_name: row.customer_name,
        cash_amount: row.cash_amount,
        qris_amount: row.qris_amount,
        total_profit: row.total_profit,
        items,
    };
}