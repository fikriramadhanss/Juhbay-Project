// lib/db.ts

import Dexie, { Table } from 'dexie';

export interface Product {
    id?: number;
    name: string;
    category: string;
    variant?: string;
    price: number;
    stock: number;
    isActive: boolean;
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
    items: {
        productId: number;
        name: string;
        price: number;
        quantity: number;
    }[];
}

export class JuhbayDB extends Dexie {
    products!: Table<Product>;
    sales!: Table<Sale>;

    constructor() {
        super('JuhbaySlowBarDB');
        this.version(4).stores({
            products: '++id, name, isActive, category',
            sales: '++id, date, paymentMethod, status'
        });
    }
}

export const db = new JuhbayDB();