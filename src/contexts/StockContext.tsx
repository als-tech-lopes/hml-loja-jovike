import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface Product {
  id: string;
  name: string;
  quantity: number;
  price: number;
  category: string;
  description: string;
  minStock: number;
  createdAt: string;
  image_url?: string; // ✅ torna a imagem opcional
}

export interface Movement {
  id: string;
  productId: string;
  productName: string;
  type: 'entrada' | 'saida';
  quantity: number;
  date: string;
  note: string;
  status: string;
  cancelledAt?: string | null;
  cancelledBy?: string | null;
  sourceSaleId?: string | null;
}

interface StockContextType {
  products: Product[];
  movements: Movement[];
  loading: boolean;
  addProduct: (p: Omit<Product, 'id' | 'createdAt'>) => Promise<void>;
  updateProduct: (id: string, p: Partial<Product>) => Promise<void>;
  deleteProduct: (id: string) => Promise<void>;
  addMovement: (m: Omit<Movement, 'id' | 'date' | 'status' | 'cancelledAt' | 'cancelledBy'>) => Promise<void>;
  cancelMovement: (movementId: string) => Promise<void>;
  getProduct: (id: string) => Product | undefined;
  lowStockProducts: Product[];
  totalProducts: number;
  totalValue: number;
  refreshProducts: () => Promise<void>;
  refreshMovements: () => Promise<void>;
}

const StockContext = createContext<StockContextType | null>(null);

export function StockProvider({ children }: { children: React.ReactNode }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchProducts = useCallback(async () => {
    const { data } = await supabase.from('products').select('*').order('created_at', { ascending: false });
    if (data) {
      setProducts(data.map(p => ({
        id: p.id, name: p.name, quantity: p.quantity, price: Number(p.price),
        category: p.category, description: p.description, minStock: p.min_stock, createdAt: p.created_at,
        image_url: p.image_url ?? undefined,
      })));
    }
  }, []);

  const fetchMovements = useCallback(async () => {
    const { data } = await supabase.from('movements').select('*').order('created_at', { ascending: false });
    if (data) {
      setMovements(data.map(m => ({
        id: m.id, productId: m.product_id, productName: m.product_name,
        type: m.type as 'entrada' | 'saida', quantity: m.quantity, date: m.created_at, note: m.note,
        status: (m as any).status ?? 'Concluida',
        cancelledAt: (m as any).cancelled_at ?? null,
        cancelledBy: (m as any).cancelled_by ?? null,
        sourceSaleId: (m as any).source_sale_id ?? null,
      })));
    }
  }, []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    await Promise.all([fetchProducts(), fetchMovements()]);
    setLoading(false);
  }, [fetchProducts, fetchMovements]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const addProduct = useCallback(async (p: Omit<Product, 'id' | 'createdAt'>) => {
    const { data, error } = await supabase.from('products').insert({
      name: p.name, quantity: p.quantity, price: p.price,
      category: p.category, description: p.description, min_stock: p.minStock,
      image_url: p.image_url ?? null,
    }).select().single();
    if (data && !error) {
      setProducts(prev => [{
        id: data.id, name: data.name, quantity: data.quantity, price: Number(data.price),
        category: data.category, description: data.description, minStock: data.min_stock, createdAt: data.created_at,
        image_url: data.image_url ?? undefined,
      }, ...prev]);
    }
  }, []);

  const updateProduct = useCallback(async (id: string, data: Partial<Product>) => {
    const updateData: Record<string, unknown> = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.quantity !== undefined) updateData.quantity = data.quantity;
    if (data.price !== undefined) updateData.price = data.price;
    if (data.category !== undefined) updateData.category = data.category;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.minStock !== undefined) updateData.min_stock = data.minStock;
    if (data.image_url !== undefined) updateData.image_url = data.image_url;

    await supabase.from('products').update(updateData).eq('id', id);
    setProducts(prev => prev.map(p => p.id === id ? { ...p, ...data } : p));
  }, []);

  const deleteProduct = useCallback(async (id: string) => {
    await supabase.from('products').delete().eq('id', id);
    setProducts(prev => prev.filter(p => p.id !== id));
  }, []);

  const addMovement = useCallback(async (m: Omit<Movement, 'id' | 'date'>) => {
    // Insert movement
    const { data: movData } = await supabase.from('movements').insert({
      product_id: m.productId, product_name: m.productName,
      type: m.type, quantity: m.quantity, note: m.note,
      source_sale_id: m.sourceSaleId ?? null,
    } as any).select().single();

    // Update product quantity
    const product = products.find(p => p.id === m.productId);
    if (product) {
      const newQty = m.type === 'entrada' ? product.quantity + m.quantity : Math.max(0, product.quantity - m.quantity);
      await supabase.from('products').update({ quantity: newQty }).eq('id', m.productId);
      setProducts(prev => prev.map(p => p.id === m.productId ? { ...p, quantity: newQty } : p));
    }

    if (movData) {
      setMovements(prev => [{
        id: movData.id, productId: movData.product_id, productName: movData.product_name,
        type: movData.type as 'entrada' | 'saida', quantity: movData.quantity,
        date: movData.created_at, note: movData.note,
        status: (movData as any).status ?? 'Concluida',
        cancelledAt: (movData as any).cancelled_at ?? null,
        cancelledBy: (movData as any).cancelled_by ?? null,
        sourceSaleId: (movData as any).source_sale_id ?? null,
      }, ...prev]);
    }
  }, [products]);

  const cancelMovement = useCallback(async (movementId: string) => {
    const { error } = await supabase.rpc('cancel_movement', { _movement_id: movementId });
    if (error) throw error;
    await Promise.all([fetchProducts(), fetchMovements()]);
  }, [fetchMovements, fetchProducts]);

  const getProduct = useCallback((id: string) => products.find(p => p.id === id), [products]);
  const refreshProducts = fetchProducts;
  const refreshMovements = fetchMovements;

  const lowStockProducts = products.filter(p => p.quantity <= p.minStock);
  const totalProducts = products.length;
  const totalValue = products.reduce((sum, p) => sum + p.quantity * p.price, 0);

  return (
    <StockContext.Provider value={{ products, movements, loading, addProduct, updateProduct, deleteProduct, addMovement, cancelMovement, getProduct, lowStockProducts, totalProducts, totalValue, refreshProducts, refreshMovements }}>
      {children}
    </StockContext.Provider>
  );
}

export function useStock() {
  const ctx = useContext(StockContext);
  if (!ctx) throw new Error('useStock must be used within StockProvider');
  return ctx;
}
