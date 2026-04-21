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
    paymentMethod: 'CASH' | 'QRIS';
    items: {
        productId: number;
        name: string;
        price: number;
        quantity: number
    }[];
}

export class JuhbayDB extends Dexie {
    products!: Table<Product>;
    sales!: Table<Sale>;

    constructor() {
        super('JuhbaySlowBarDB');


        this.version(2).stores({
            products: '++id, name, isActive, category',
            sales: '++id, date, paymentMethod'
        });
    }
}

export const db = new JuhbayDB();

/**
 * HELPER FUNCTIONS
 */

export async function softDeleteProduct(id: number) {
    return await db.products.update(id, { isActive: false, stock: 0 });
}

export async function getDailyReport(date: Date) {
    const start = new Date(date.getTime());
    start.setHours(0, 0, 0, 0);

    const end = new Date(date.getTime());
    end.setHours(23, 59, 59, 999);

    return await db.sales
        .where('date')
        .between(start, end)
        .toArray();
}