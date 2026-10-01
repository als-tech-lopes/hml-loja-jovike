import { useState, useEffect, useCallback } from 'react';
import { useStock } from '@/contexts/StockContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Plus, Trash2, Eye, Loader2, Ban, Search, ReceiptText, Check, ChevronsUpDown, Package } from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { isWithinDateRange } from '@/lib/dateRange';

interface SaleItem {
  productId: string;
  productName: string;
  productCode: string;
  quantity: number;
  unitPrice: number;
  productVariantId?: string | null;
  variantCode?: string | null;
  variantColor?: string | null;
  variantSize?: string | null;
}

interface Sale {
  id: string;
  saleCode: string;
  clientName: string;
  clientPhone: string;
  items: SaleItem[];
  paymentMethod: string;
  subtotal: number;
  discountType: 'percentage' | 'fixed' | null;
  discountValue: number;
  discountAmount: number;
  total: number;
  date: string;
  note: string;
  status: string;
  cancelledAt?: string | null;
  cancelledBy?: string | null;
  sellerName: string;
  printReceipt: boolean;
}

type NewSalePayload = Omit<Sale, 'id' | 'saleCode' | 'date' | 'total' | 'status' | 'cancelledAt' | 'cancelledBy' | 'sellerName'>;

const roundCurrency = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

function ProductThumbnail({ product, className }: { product: any; className?: string }) {
  const imageUrl = product.image_url || product.variantImages?.[0]?.imageUrl;
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => setImageFailed(false), [imageUrl]);

  return (
    <span className={cn('flex shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted', className)}>
      {imageUrl && !imageFailed ? (
        <img
          src={imageUrl}
          alt={`Imagem de ${product.name}`}
          className="h-full w-full object-cover"
          onError={() => setImageFailed(true)}
        />
      ) : (
        <Package className="h-1/2 w-1/2 text-muted-foreground" aria-hidden="true" />
      )}
    </span>
  );
}

function SaleForm({ products, onSave, onClose }: { products: any[]; onSave: (sale: NewSalePayload) => Promise<void>; onClose: () => void }) {
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [note, setNote] = useState('');
  const [printReceipt, setPrintReceipt] = useState(false);
  const [discountType, setDiscountType] = useState<'none' | 'percentage' | 'fixed'>('none');
  const [discountValue, setDiscountValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [items, setItems] = useState<SaleItem[]>([]);
  const [selProductId, setSelProductId] = useState('');
  const [productPickerOpen, setProductPickerOpen] = useState(false);
  const [selVariantId, setSelVariantId] = useState('');
  const [selQty, setSelQty] = useState('1');
  const selectedProduct = products.find(product => product.id === selProductId);
  const selectedVariant = selectedProduct?.variants.find((variant: any) => variant.id === selVariantId);

  const addItem = () => {
    const prod = products.find(p => p.id === selProductId);
    if (!prod) return;
    const variant = selVariantId ? prod.variants.find((item: any) => item.id === selVariantId) : undefined;
    if (prod.variants.length > 0 && !variant) return;
    const requestedQuantity = Number(selQty);
    const availableQuantity = variant?.quantity ?? prod.quantity;
    const existing = items.find(i => i.productId === selProductId && (i.productVariantId ?? null) === (variant?.id ?? null));
    if (requestedQuantity < 1 || requestedQuantity + (existing?.quantity ?? 0) > availableQuantity) {
      toast.error('Quantidade superior ao estoque disponível.');
      return;
    }
    if (existing) {
      setItems(items.map(i => i === existing ? { ...i, quantity: i.quantity + requestedQuantity } : i));
    } else {
      setItems([...items, {
        productId: prod.id, productName: prod.name, productCode: prod.productCode, quantity: requestedQuantity,
        unitPrice: variant?.price ?? prod.price, productVariantId: variant?.id ?? null,
        variantCode: variant?.variantCode ?? null, variantColor: variant?.color ?? null, variantSize: variant?.size ?? null,
      }]);
    }
    setSelProductId(''); setSelVariantId(''); setSelQty('1');
  };

  const removeItem = (item: SaleItem) => setItems(items.filter(i => i !== item));
  const subtotal = roundCurrency(items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0));
  const parsedDiscountValue = Number(discountValue || 0);
  const calculatedDiscount = discountType === 'percentage'
    ? subtotal * parsedDiscountValue / 100
    : discountType === 'fixed' ? parsedDiscountValue : 0;
  const discountAmount = roundCurrency(Math.min(subtotal, Math.max(0, Number.isFinite(calculatedDiscount) ? calculatedDiscount : 0)));
  const total = roundCurrency(subtotal - discountAmount);
  const invalidDiscount = !Number.isFinite(parsedDiscountValue) || parsedDiscountValue < 0 ||
    (discountType === 'percentage' && parsedDiscountValue > 100) ||
    (discountType === 'fixed' && parsedDiscountValue > subtotal);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (items.length === 0) return;
    if (invalidDiscount) {
      toast.error(discountType === 'percentage' ? 'O desconto percentual deve estar entre 0% e 100%.' : 'O desconto fixo não pode ser maior que o subtotal.');
      return;
    }
    try {
      setSaving(true);
      await onSave({
        clientName, clientPhone, items, paymentMethod, note, printReceipt, subtotal,
        discountType: discountType === 'none' ? null : discountType,
        discountValue: discountType === 'none' ? 0 : parsedDiscountValue,
        discountAmount,
      });
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível registrar a venda.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2"><Label>Cliente *</Label><Input value={clientName} onChange={e => setClientName(e.target.value)} required /></div>
        <div className="space-y-2"><Label>Telefone</Label><Input value={clientPhone} onChange={e => setClientPhone(e.target.value)} placeholder="(11) 99999-9999" /></div>
      </div>
      <div className="space-y-2">
        <Label>Forma de Pagamento *</Label>
        <Select value={paymentMethod} onValueChange={setPaymentMethod} required>
          <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="pix">PIX</SelectItem>
            <SelectItem value="dinheiro">Dinheiro</SelectItem>
            <SelectItem value="cartao_credito">Cartão de Crédito</SelectItem>
            <SelectItem value="cartao_debito">Cartão de Débito</SelectItem>
            
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>Adicionar Produto</Label>
        <div className="flex gap-2">
          <Popover open={productPickerOpen} onOpenChange={setProductPickerOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" role="combobox" aria-expanded={productPickerOpen} className="min-w-0 flex-1 justify-between font-normal">
                {selProductId ? (() => {
                  return selectedProduct ? (
                    <span className="flex min-w-0 items-center gap-2">
                      <ProductThumbnail product={selectedProduct} className="h-7 w-7" />
                      <span className="min-w-0 text-left">
                        <span className="block truncate font-mono font-semibold">{selectedProduct.productCode}</span>
                        <span className="block truncate text-xs text-muted-foreground">{selectedProduct.name}{selectedVariant ? ` · ${selectedVariant.color}/${selectedVariant.size}` : ''}</span>
                      </span>
                    </span>
                  ) : 'Produto';
                })() : <span className="text-muted-foreground">Pesquisar produto...</span>}
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
              <Command>
                <CommandInput placeholder="Buscar por código ou nome..." />
                <CommandList>
                  <CommandEmpty>Nenhum produto disponível encontrado.</CommandEmpty>
                  <CommandGroup>
                    {products.filter(product => product.quantity > 0).map(product => (
                      <CommandItem
                        key={product.id}
                        value={`${product.productCode} ${product.variants.map((variant: any) => variant.variantCode).filter(Boolean).join(' ')} ${product.name}`}
                        onSelect={() => {
                          setSelProductId(product.id);
                          setSelVariantId('');
                          setProductPickerOpen(false);
                        }}
                      >
                        <Check className={cn('mr-2 h-4 w-4', selProductId === product.id ? 'opacity-100' : 'opacity-0')} />
                        <ProductThumbnail product={product} className="mr-3 h-12 w-12" />
                        <span className="min-w-0 flex-1 truncate">{product.productCode} — {product.name}</span>
                        <span className="ml-2 shrink-0 text-xs text-muted-foreground">{product.quantity} disp.</span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
          {selectedProduct?.variants.length > 0 && (
            <Select value={selVariantId} onValueChange={setSelVariantId}>
              <SelectTrigger className="flex-1"><SelectValue placeholder="Cor / tamanho" /></SelectTrigger>
              <SelectContent>
                {selectedProduct?.variants.filter((variant: any) => variant.quantity > 0).map((variant: any) => (
                  <SelectItem key={variant.id} value={variant.id}>
                    <span className="font-medium">{variant.color} — {variant.size}</span>
                    <span className="ml-2 font-mono text-xs text-muted-foreground">{variant.variantCode} · {variant.quantity} disp.</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Input type="number" min="1" className="w-20" value={selQty} onChange={e => setSelQty(e.target.value)} />
          <Button type="button" variant="outline" onClick={addItem} disabled={!selProductId || (selectedProduct?.variants.length > 0 && !selVariantId)}><Plus className="w-4 h-4" /></Button>
        </div>
        {selectedProduct && (
          <div className="mt-2 rounded-lg border bg-muted/30 p-3 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div><span className="text-muted-foreground">Código principal:</span> <span className="ml-1 font-mono font-bold text-foreground">{selectedProduct.productCode}</span></div>
              <div><span className="text-muted-foreground">Estoque total:</span> <span className="ml-1 font-semibold text-foreground">{selectedProduct.quantity}</span></div>
            </div>
            {selectedVariant ? (
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t pt-2">
                <div><span className="text-muted-foreground">Cor selecionada:</span> <span className="ml-1 font-semibold text-foreground">{selectedVariant.color}</span>{selectedVariant.size && <span className="text-muted-foreground"> · {selectedVariant.size}</span>}</div>
                <div><span className="text-muted-foreground">Código da variação:</span> <span className="ml-1 font-mono font-semibold text-foreground">{selectedVariant.variantCode}</span> <span className="ml-2 text-muted-foreground">({selectedVariant.quantity} disp.)</span></div>
              </div>
            ) : selectedProduct.variants.length > 0 ? (
              <p className="mt-2 border-t pt-2 text-xs text-muted-foreground">Selecione a cor e o tamanho para visualizar o código específico da variação.</p>
            ) : null}
          </div>
        )}
      </div>
      {items.length > 0 && (
        <div className="rounded-lg border divide-y">
          {items.map(item => (
            <div key={`${item.productId}:${item.productVariantId ?? 'base'}`} className="flex items-center justify-between p-3 text-sm">
              <div>
                <div><span className="mr-2 font-mono font-semibold text-foreground">{item.productCode}</span><span className="font-medium text-foreground">{item.productName}</span><span className="text-muted-foreground ml-2">x{item.quantity}</span></div>
                {item.variantColor && <div className="mt-1 text-xs text-muted-foreground"><span className="font-medium text-foreground">{item.variantColor} — {item.variantSize}</span><span className="ml-2 font-mono">{item.variantCode}</span></div>}
              </div>
              <div className="flex items-center gap-3">
                <span className="text-foreground">R$ {(item.quantity * item.unitPrice).toLocaleString('pt-BR')}</span>
                <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeItem(item)}><Trash2 className="w-3 h-3" /></Button>
              </div>
            </div>
          ))}
          <div className="flex justify-between p-3 font-medium text-foreground bg-muted/50"><span>Subtotal</span><span>R$ {subtotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span></div>
        </div>
      )}
      {items.length > 0 && (
        <div className="space-y-3 rounded-lg border p-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Desconto</Label>
              <Select value={discountType} onValueChange={(value: 'none' | 'percentage' | 'fixed') => { setDiscountType(value); setDiscountValue(''); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem desconto</SelectItem>
                  <SelectItem value="percentage">Porcentagem (%)</SelectItem>
                  <SelectItem value="fixed">Valor fixo (R$)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {discountType !== 'none' && (
              <div className="space-y-2">
                <Label>{discountType === 'percentage' ? 'Percentual (%)' : 'Valor do desconto (R$)'}</Label>
                <Input
                  type="number"
                  min="0"
                  max={discountType === 'percentage' ? 100 : subtotal}
                  step="0.01"
                  value={discountValue}
                  onChange={event => setDiscountValue(event.target.value)}
                  placeholder={discountType === 'percentage' ? 'Ex: 10' : 'Ex: 15,00'}
                  aria-invalid={invalidDiscount}
                />
                {invalidDiscount && <p className="text-xs text-destructive">{discountType === 'percentage' ? 'Informe até 100%.' : 'Informe até o valor do subtotal.'}</p>}
              </div>
            )}
          </div>
          <div className="space-y-1 border-t pt-3 text-sm">
            <div className="flex justify-between text-muted-foreground"><span>Subtotal</span><span>R$ {subtotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span></div>
            <div className="flex justify-between text-muted-foreground"><span>Desconto</span><span>- R$ {discountAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span></div>
            <div className="flex justify-between pt-1 text-lg font-bold text-foreground"><span>Total final</span><span>R$ {total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span></div>
          </div>
        </div>
      )}
      <div className="space-y-2"><Label>Observação</Label><Input value={note} onChange={e => setNote(e.target.value)} /></div>
      <label className="flex items-start gap-3 rounded-lg border p-3 cursor-pointer">
        <Checkbox checked={printReceipt} onCheckedChange={checked => setPrintReceipt(checked === true)} />
        <span className="space-y-1">
          <span className="flex items-center gap-2 text-sm font-medium text-foreground"><ReceiptText className="w-4 h-4" /> Imprimir cupom fiscal</span>
          <span className="block text-xs text-muted-foreground">Marca esta venda para impressão do cupom.</span>
        </span>
      </label>
      <div className="flex gap-2 justify-end">
        <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>Cancelar</Button>
        <Button type="submit" className="gold-gradient text-gold-foreground hover:opacity-90" disabled={saving || items.length === 0 || !paymentMethod || !clientName || invalidDiscount}>
          {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Salvando...</> : 'Registrar Venda'}
        </Button>
      </div>
    </form>
  );
}

const paymentLabels: Record<string, string> = {
  pix: 'PIX', dinheiro: 'Dinheiro', cartao_credito: 'Cartão Crédito', cartao_debito: 'Cartão Débito', boleto: 'Boleto',
};

export default function Sales() {
  const { products, refreshProducts, refreshMovements } = useStock();
  const { user } = useAuth();
  const [sales, setSales] = useState<Sale[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [detailSale, setDetailSale] = useState<Sale | null>(null);
  const [loadingSales, setLoadingSales] = useState(true);
  const [saleToCancel, setSaleToCancel] = useState<Sale | null>(null);
  const [cancellingSaleId, setCancellingSaleId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';

  const getStatusVariant = (status: string) => {
    if (status === 'Cancelada') return 'destructive' as const;
    return 'default' as const;
  };

  const getStatusLabel = (status: string) => status === 'Concluida' ? 'Concluída' : status;

  const fetchSales = useCallback(async () => {
    const { data: salesData } = await supabase.from('sales').select('*').order('created_at', { ascending: false });
    if (!salesData) { setLoadingSales(false); return; }

    const sellerIds = Array.from(new Set(salesData.map((s: any) => s.created_by).filter(Boolean)));
    const sellerMap = new Map<string, string>();
    if (sellerIds.length > 0) {
      const { data: profilesData } = await supabase.from('profiles').select('user_id, name, email').in('user_id', sellerIds);
      (profilesData || []).forEach((p: any) => sellerMap.set(p.user_id, p.name || p.email || 'Não informado'));
    }

    const salesWithItems: Sale[] = [];
    for (const s of salesData) {
      const { data: items } = await supabase.from('sale_items').select('*').eq('sale_id', s.id);
      salesWithItems.push({
        id: s.id, saleCode: s.sale_code, clientName: s.client_name, clientPhone: s.client_phone,
        paymentMethod: s.payment_method, subtotal: Number(s.subtotal),
        discountType: s.discount_type as 'percentage' | 'fixed' | null,
        discountValue: Number(s.discount_value), discountAmount: Number(s.discount_amount),
        total: Number(s.total), note: s.note, date: s.created_at,
        items: (items || []).map(i => {
          const currentProduct = products.find(product => product.id === i.product_id);
          const currentVariant = currentProduct?.variants.find(variant => variant.id === i.product_variant_id);
          return {
            productId: i.product_id ?? `deleted:${i.product_code}`, productName: i.product_name, productCode: currentProduct?.productCode ?? i.product_code,
            quantity: i.quantity, unitPrice: Number(i.unit_price), productVariantId: i.product_variant_id,
            variantCode: i.variant_code ?? currentVariant?.variantCode ?? null, variantColor: i.variant_color, variantSize: i.variant_size,
          };
        }),
        status: (s as any).status ?? 'Concluida',
        cancelledAt: (s as any).cancelled_at ?? null,
        cancelledBy: (s as any).cancelled_by ?? null,
        sellerName: s.created_by ? (sellerMap.get(s.created_by) || 'Não informado') : 'Não informado',
        printReceipt: s.print_receipt,
      });
    }
    setSales(salesWithItems);
    setLoadingSales(false);
  }, [products]);

  useEffect(() => { fetchSales(); }, [fetchSales]);

  const handleSave = async (data: NewSalePayload) => {
    const { data: saleData, error: saleError } = await supabase.rpc('create_sale', {
      _client_name: data.clientName,
      _client_phone: data.clientPhone,
      _payment_method: data.paymentMethod,
      _discount_type: data.discountType,
      _discount_value: data.discountValue,
      _note: data.note,
      _print_receipt: data.printReceipt,
      _items: data.items.map(item => ({
        product_id: item.productId,
        product_variant_id: item.productVariantId ?? null,
        quantity: item.quantity,
      })),
    });

    if (saleError) throw saleError;
    if (!saleData) throw new Error('Não foi possível criar a venda.');

    await Promise.all([fetchSales(), refreshProducts(), refreshMovements()]);
    toast.success(`Venda ${saleData.sale_code} registrada com sucesso.`);
  };

  const normalizedSearch = search.trim().toLowerCase();
  const filteredSales = sales.filter(s =>
    isWithinDateRange(s.date, startDate, endDate) && (
      !normalizedSearch ||
      s.saleCode.toLowerCase().includes(normalizedSearch) ||
      s.clientName.toLowerCase().includes(normalizedSearch) ||
      s.clientPhone.toLowerCase().includes(normalizedSearch) ||
      s.items.some(item => item.productCode.toLowerCase().includes(normalizedSearch) || item.variantCode?.toLowerCase().includes(normalizedSearch) || item.productName.toLowerCase().includes(normalizedSearch) || item.variantColor?.toLowerCase().includes(normalizedSearch) || item.variantSize?.toLowerCase().includes(normalizedSearch))
    )
  );
  const hasDateFilter = Boolean(startDate || endDate);

  const handleCancelSale = async () => {
    if (!saleToCancel) return;

    try {
      setCancellingSaleId(saleToCancel.id);
      const { error } = await supabase.rpc('cancel_sale', { _sale_id: saleToCancel.id });
      if (error) throw error;

      await Promise.all([fetchSales(), refreshProducts(), refreshMovements()]);
      setDetailSale(current => current?.id === saleToCancel.id ? { ...current, status: 'Cancelada' } : current);
      toast.success('Venda cancelada com sucesso.');
      setSaleToCancel(null);
    } catch (error: any) {
      toast.error(error?.message || 'Não foi possível cancelar a venda.');
    } finally {
      setCancellingSaleId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Vendas</h1>
          <p className="text-muted-foreground">
            {hasDateFilter || normalizedSearch ? `${filteredSales.length} de ${sales.length} vendas` : `${sales.length} vendas registradas`}
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gold-gradient text-gold-foreground hover:opacity-90"><Plus className="w-4 h-4 mr-2" /> Nova Venda</Button>
          </DialogTrigger>
          <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Registrar Venda</DialogTitle></DialogHeader>
            <SaleForm products={products} onSave={handleSave} onClose={() => setDialogOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>

      <Dialog open={!!detailSale} onOpenChange={() => setDetailSale(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Detalhes da Venda</DialogTitle></DialogHeader>
          {detailSale && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div><span className="text-muted-foreground">Código:</span> <span className="font-mono font-medium text-foreground">{detailSale.saleCode}</span></div>
                <div><span className="text-muted-foreground">Cliente:</span> <span className="font-medium text-foreground">{detailSale.clientName}</span></div>
                <div><span className="text-muted-foreground">Telefone:</span> <span className="text-foreground">{detailSale.clientPhone || '—'}</span></div>
                <div><span className="text-muted-foreground">Data:</span> <span className="text-foreground">{new Date(detailSale.date).toLocaleDateString('pt-BR')}</span></div>
                <div><span className="text-muted-foreground">Pagamento:</span> <span className="text-foreground">{paymentLabels[detailSale.paymentMethod] || detailSale.paymentMethod}</span></div>
                <div><span className="text-muted-foreground">Status:</span> <Badge variant={getStatusVariant(detailSale.status)} className="ml-2">{getStatusLabel(detailSale.status)}</Badge></div>
                <div><span className="text-muted-foreground">Cancelamento:</span> <span className="text-foreground">{detailSale.cancelledAt ? new Date(detailSale.cancelledAt).toLocaleString('pt-BR') : '—'}</span></div>
                {isAdmin && <div><span className="text-muted-foreground">Vendedor:</span> <span className="text-foreground">{detailSale.sellerName}</span></div>}
                <div><span className="text-muted-foreground">Cupom fiscal:</span> <Badge variant={detailSale.printReceipt ? 'default' : 'outline'} className="ml-2">{detailSale.printReceipt ? 'Solicitado' : 'Não solicitado'}</Badge></div>
              </div>
              <div className="rounded-lg border divide-y">
                {detailSale.items.map(item => (
                  <div key={`${item.productId}:${item.productVariantId ?? 'base'}`} className="flex justify-between p-3">
                    <span className="text-foreground">
                      <span className="font-mono font-semibold mr-2">{item.productCode}</span>{item.productName} x{item.quantity}
                      {item.variantColor && <span className="block text-xs text-muted-foreground"><span className="font-medium text-foreground">{item.variantColor} — {item.variantSize}</span><span className="ml-2 font-mono">{item.variantCode}</span></span>}
                    </span>
                    <span className="text-foreground">R$ {(item.quantity * item.unitPrice).toLocaleString('pt-BR')}</span>
                  </div>
                ))}
                <div className="space-y-1 bg-muted/50 p-3">
                  <div className="flex justify-between text-muted-foreground"><span>Subtotal</span><span>R$ {detailSale.subtotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span></div>
                  {detailSale.discountAmount > 0 && (
                    <div className="flex justify-between text-muted-foreground">
                      <span>Desconto{detailSale.discountType === 'percentage' ? ` (${detailSale.discountValue}%)` : ''}</span>
                      <span>- R$ {detailSale.discountAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                    </div>
                  )}
                  <div className="flex justify-between pt-1 font-semibold text-foreground"><span>Total final</span><span>R$ {detailSale.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span></div>
                </div>
              </div>
              {detailSale.note && <p className="text-muted-foreground">Obs: {detailSale.note}</p>}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <div className="space-y-3 rounded-xl border bg-card p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input className="pl-10" placeholder="Buscar por código da venda, cliente, telefone ou produto..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="grid flex-1 gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="sales-start-date">Data inicial</Label>
              <Input
                id="sales-start-date"
                type="date"
                value={startDate}
                max={endDate || undefined}
                onChange={event => setStartDate(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sales-end-date">Data final</Label>
              <Input
                id="sales-end-date"
                type="date"
                value={endDate}
                min={startDate || undefined}
                onChange={event => setEndDate(event.target.value)}
              />
            </div>
          </div>
          {hasDateFilter && (
            <Button type="button" variant="outline" onClick={() => { setStartDate(''); setEndDate(''); }}>
              Limpar período
            </Button>
          )}
        </div>
      </div>

      <div className="bg-card rounded-xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left p-4 text-sm font-medium text-muted-foreground">Data</th>
                <th className="text-left p-4 text-sm font-medium text-muted-foreground">Código</th>
                <th className="text-left p-4 text-sm font-medium text-muted-foreground">Cliente</th>
                {isAdmin && <th className="text-left p-4 text-sm font-medium text-muted-foreground">Vendedor</th>}
                <th className="text-left p-4 text-sm font-medium text-muted-foreground">Pagamento</th>
                <th className="text-right p-4 text-sm font-medium text-muted-foreground">Itens</th>
                <th className="text-left p-4 text-sm font-medium text-muted-foreground">Status</th>
                <th className="text-left p-4 text-sm font-medium text-muted-foreground">Cupom</th>
                <th className="text-right p-4 text-sm font-medium text-muted-foreground">Total</th>
                <th className="text-right p-4 text-sm font-medium text-muted-foreground">Ações</th>
              </tr>
            </thead>
            <tbody>
              {loadingSales ? (
                <tr><td colSpan={isAdmin ? 10 : 9} className="p-8 text-center"><Loader2 className="w-5 h-5 animate-spin mx-auto text-muted-foreground" /></td></tr>
              ) : filteredSales.map((s, i) => (
                <motion.tr key={s.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}
                  className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="p-4 text-sm text-muted-foreground">{new Date(s.date).toLocaleDateString('pt-BR')}</td>
                  <td className="p-4 text-sm font-mono font-medium text-foreground whitespace-nowrap">{s.saleCode}</td>
                  <td className="p-4 font-medium text-foreground">{s.clientName}</td>
                  {isAdmin && <td className="p-4 text-sm text-foreground">{s.sellerName}</td>}
                  <td className="p-4 text-sm text-muted-foreground">{paymentLabels[s.paymentMethod] || s.paymentMethod}</td>
                  <td className="p-4 text-right text-foreground">{s.items.length}</td>
                  <td className="p-4"><Badge variant={getStatusVariant(s.status)}>{getStatusLabel(s.status)}</Badge></td>
                  <td className="p-4"><Badge variant={s.printReceipt ? 'default' : 'outline'}>{s.printReceipt ? 'Sim' : 'Não'}</Badge></td>
                  <td className="p-4 text-right font-semibold text-foreground">R$ {s.total.toLocaleString('pt-BR')}</td>
                  <td className="p-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => setDetailSale(s)}><Eye className="w-4 h-4" /></Button>
                      {isAdmin && s.status !== 'Cancelada' && (
                        <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => setSaleToCancel(s)}>
                          <Ban className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </td>
                </motion.tr>
              ))}
              {!loadingSales && filteredSales.length === 0 && (
                <tr><td colSpan={isAdmin ? 10 : 9} className="p-8 text-center text-muted-foreground">{hasDateFilter ? 'Nenhuma venda encontrada no período' : 'Nenhuma venda encontrada'}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <AlertDialog open={!!saleToCancel} onOpenChange={(open) => !open && setSaleToCancel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar venda</AlertDialogTitle>
            <AlertDialogDescription>
              A venda continuará no histórico, será marcada como cancelada e o estoque será revertido automaticamente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={!!cancellingSaleId}>Voltar</AlertDialogCancel>
            <AlertDialogAction onClick={handleCancelSale} disabled={!!cancellingSaleId} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {cancellingSaleId ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirmar cancelamento'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
