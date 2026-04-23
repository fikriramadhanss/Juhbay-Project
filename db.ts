// lib/db.ts

import Dexie, { Table } from 'dexie';

export interface HppTemplate {
    id?: number;
    name: string;
    air: number;
    susu: number;
    gas: number;
    beans: number;
    flavour: number;
    cup: number;
    esBatu: number;
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
    isActive: boolean;
    hppTemplateId?: number;
    hppTotal?: number;
}

export interface Sale {
    id?: number;
    date: Date;
    totalAmount: number;
    paymentMethod: 'CASH' | 'QRIS' | 'KASBON' | 'SPLIT';
    status?: 'PAID' | 'UNPAID';
    customerName?: string;
    cashAmount?: number;
    qrisAmount?: number;
    totalProfit?: number;
    items: {
        productId: number;
        name: string;
        price: number;
        quantity: number;
        hpp?: number;
    }[];
}

export class JuhbayDB extends Dexie {
    products!: Table<Product>;
    sales!: Table<Sale>;
    hppTemplates!: Table<HppTemplate>;

    constructor() {
        super('JuhbaySlowBarDB');
        this.version(5).stores({
            products: '++id, name, isActive, category',
            sales: '++id, date, paymentMethod, status',
            hppTemplates: '++id, name'
        });
    }
}

export const db = new JuhbayDB();