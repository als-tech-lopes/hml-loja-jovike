import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { TablesUpdate } from '@/integrations/supabase/types';
import { compareProductSizes } from '@/lib/productSizes';

export interface ProductVariant {
  id?: string;
  variantCode?: string;
  color: string;
  size: string;
  quantity: number;
  price: number;
  minStock: number;
  description: string;
}

export interface ProductVariantImage {
  id?: string;
  color: string;
  imageUrl: string;
  displayOrder: number;
}

export interface Product {
  id: string;
  productCode: string;
  name: string;
  quantity: number;
  purchasePrice: number;
  price: number;
  category: string;
  description: string;
  minStock: number;
  createdAt: string;
  image_url?: string; // ✅ torna a imagem opcional
  variants: ProductVariant[];
  variantImages: ProductVariantImage[];
}

export interface Movement {
  id: string;
  productId: string | null;
  productName: string;
  productCode: string;
  productVariantId?: string | null;
  variantCode?: string | null;
  variantColor?: string | null;
  variantSize?: string | null;
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
  addProduct: (p: Omit<Product, 'id' | 'productCode' | 'createdAt'>) => Promise<Product>;
  updateProduct: (id: string, p: Partial<Product>) => Promise<void>;
  deleteProduct: (id: string) => Promise<void>;
  addMovement: (m: Omit<Movement, 'id' | 'productCode' | 'date' | 'status' | 'cancelledAt' | 'cancelledBy'>) => Promise<void>;
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
    const [{ data }, { data: variants }, { data: variantImages }] = await Promise.all([
      supabase.from('products').select('*').order('created_at', { ascending: false }),
      supabase.from('product_variants').select('*').order('color').order('size'),
      supabase.from('product_variant_images').select('*').order('display_order'),
    ]);
    if (data) {
      setProducts(data.map(p => ({
        id: p.id, productCode: p.product_code, name: p.name, quantity: p.quantity,
        purchasePrice: Number(p.purchase_price), price: Number(p.price),
        category: p.category, description: p.description, minStock: p.min_stock, createdAt: p.created_at,
        image_url: p.image_url ?? undefined,
        variants: (variants || []).filter(v => v.product_id === p.id).map(v => ({
          id: v.id, variantCode: v.variant_code, color: v.color, size: v.size, quantity: v.quantity, price: Number(v.price),
          minStock: v.min_stock, description: v.description,
        })).sort((first, second) => first.color.localeCompare(second.color, 'pt-BR') || compareProductSizes(first.size, second.size)),
        variantImages: (variantImages || []).filter(image => image.product_id === p.id).map(image => ({ id: image.id, color: image.color, imageUrl: image.image_url, displayOrder: image.display_order })),
      })));
    }
  }, []);

  const fetchMovements = useCallback(async () => {
    const { data } = await supabase.from('movements').select('*').order('created_at', { ascending: false });
    if (data) {
      setMovements(data.map(m => ({
        id: m.id, productId: m.product_id, productName: m.product_name, productCode: m.product_code,
        productVariantId: m.product_variant_id, variantCode: m.variant_code, variantColor: m.variant_color, variantSize: m.variant_size,
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

  const addProduct = useCallback(async (p: Omit<Product, 'id' | 'productCode' | 'createdAt'>) => {
    const { data, error } = await supabase.from('products').insert({
      name: p.name, quantity: p.quantity, purchase_price: p.purchasePrice, price: p.price,
      category: p.category, description: p.description, min_stock: p.minStock,
      image_url: p.image_url ?? null,
    }).select().single();
    if (error) throw error;
    const [variantsResult, imagesResult] = await Promise.all([
      p.variants.length > 0
        ? supabase.from('product_variants').insert(
          p.variants.map(variant => ({
            product_id: data.id, color: variant.color.trim(), size: variant.size.trim(), quantity: variant.quantity,
            price: variant.price, min_stock: variant.minStock, description: variant.description,
          })),
        )
        : Promise.resolve({ error: null }),
      p.variantImages.length > 0
        ? supabase.from('product_variant_images').insert(
          p.variantImages.map(image => ({ product_id: data.id, color: image.color.trim(), image_url: image.imageUrl, display_order: image.displayOrder })),
        )
        : Promise.resolve({ error: null }),
    ]);
    const relatedRecordError = variantsResult.error || imagesResult.error;
    if (relatedRecordError) {
      await supabase.from('products').delete().eq('id', data.id);
      throw relatedRecordError;
    }
    const product: Product = {
        id: data.id, productCode: data.product_code, name: data.name, quantity: data.quantity,
        purchasePrice: Number(data.purchase_price), price: Number(data.price),
        category: data.category, description: data.description, minStock: data.min_stock, createdAt: data.created_at,
        image_url: data.image_url ?? undefined,
        variants: p.variants,
        variantImages: p.variantImages,
    };
    await fetchProducts();
    return product;
  }, [fetchProducts]);

  const updateProduct = useCallback(async (id: string, data: Partial<Product>) => {
    const updateData: TablesUpdate<'products'> = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.quantity !== undefined) updateData.quantity = data.quantity;
    if (data.purchasePrice !== undefined) updateData.purchase_price = data.purchasePrice;
    if (data.price !== undefined) updateData.price = data.price;
    if (data.category !== undefined) updateData.category = data.category;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.minStock !== undefined) updateData.min_stock = data.minStock;
    if (data.image_url !== undefined) updateData.image_url = data.image_url;

    const { error } = await supabase.from('products').update(updateData).eq('id', id);
    if (error) throw error;

    if (data.variants !== undefined) {
      const { data: storedVariants, error: variantsLookupError } = await supabase
        .from('product_variants')
        .select('id')
        .eq('product_id', id);
      if (variantsLookupError) throw variantsLookupError;

      const retainedIds = new Set(data.variants.flatMap(variant => variant.id ? [variant.id] : []));
      const removedIds = (storedVariants || []).map(variant => variant.id).filter(variantId => !retainedIds.has(variantId));
      const existingVariants = data.variants.filter(variant => variant.id);
      const newVariants = data.variants.filter(variant => !variant.id);

      if (removedIds.length > 0) {
        const { error: deleteError } = await supabase.from('product_variants').delete().in('id', removedIds).eq('product_id', id);
        if (deleteError) throw deleteError;
      }
      const variantUpdateResults = await Promise.all(existingVariants.map(variant => (
        supabase.from('product_variants').update({
          color: variant.color.trim(), size: variant.size.trim(), quantity: variant.quantity,
          price: variant.price, min_stock: variant.minStock, description: variant.description,
        }).eq('id', variant.id!).eq('product_id', id)
      )));
      const variantUpdateError = variantUpdateResults.find(result => result.error)?.error;
      if (variantUpdateError) throw variantUpdateError;
      if (newVariants.length > 0) {
        const { error: insertError } = await supabase.from('product_variants').insert(
          newVariants.map(variant => ({
            product_id: id, color: variant.color.trim(), size: variant.size.trim(), quantity: variant.quantity,
            price: variant.price, min_stock: variant.minStock, description: variant.description,
          })),
        );
        if (insertError) throw insertError;
      }
    }
    if (data.variantImages !== undefined) {
      const { error: deleteImagesError } = await supabase.from('product_variant_images').delete().eq('product_id', id);
      if (deleteImagesError) throw deleteImagesError;
      if (data.variantImages.length > 0) {
        const { error: insertImagesError } = await supabase.from('product_variant_images').insert(
          data.variantImages.map(image => ({ product_id: id, color: image.color.trim(), image_url: image.imageUrl, display_order: image.displayOrder })),
        );
        if (insertImagesError) throw insertImagesError;
      }
    }
    await fetchProducts();
  }, [fetchProducts]);

  const deleteProduct = useCallback(async (id: string) => {
    const { data: deletedProduct, error } = await supabase
      .from('products')
      .delete()
      .eq('id', id)
      .select('id')
      .maybeSingle();

    if (error) {
      throw new Error(`Não foi possível excluir o produto: ${error.message}`);
    }
    if (!deletedProduct) {
      throw new Error('O produto não foi excluído. Verifique sua permissão de acesso e tente novamente.');
    }

    setProducts(prev => prev.filter(product => product.id !== id));
  }, []);

  const addMovement = useCallback(async (m: Omit<Movement, 'id' | 'productCode' | 'date' | 'status' | 'cancelledAt' | 'cancelledBy'>) => {
    const productId = m.productId;
    if (!productId) throw new Error('Produto não encontrado.');
    const product = products.find(p => p.id === productId);
    if (!product) throw new Error('Produto não encontrado.');
    const variant = m.productVariantId ? product.variants.find(item => item.id === m.productVariantId) : undefined;
    if (product.variants.length > 0 && !variant) throw new Error('Selecione uma variação do produto.');
    if (m.type === 'saida' && variant && m.quantity > variant.quantity) throw new Error('Estoque insuficiente para esta variação.');
    if (m.type === 'saida' && !variant && m.quantity > product.quantity) throw new Error('Estoque insuficiente para este produto.');
    if (m.sourceSaleId) throw new Error('Movimentações de venda devem ser criadas pela transação da venda.');

    const { data: movData, error: movementError } = await supabase.rpc('create_stock_movement', {
      _product_id: productId,
      _product_variant_id: variant?.id ?? null,
      _type: m.type,
      _quantity: m.quantity,
      _note: m.note,
    });
    if (movementError) throw movementError;
    if (!movData) throw new Error('Não foi possível registrar a movimentação de estoque.');
    await Promise.all([fetchProducts(), fetchMovements()]);
  }, [fetchMovements, fetchProducts, products]);

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
  const totalValue = products.reduce((sum, p) => sum + p.quantity * p.purchasePrice, 0);

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
