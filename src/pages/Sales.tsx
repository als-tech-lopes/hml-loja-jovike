import { useState, useEffect, useCallback } from 'react';
import { useStock } from '@/contexts/StockContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Plus, Trash2, Eye, Loader2, Ban } from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';

interface SaleItem {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
}

interface Sale {
  id: string;
  clientName: string;
  clientPhone: string;
  items: SaleItem[];
  paymentMethod: string;
  total: number;
  date: string;
  note: string;
  status: string;
  cancelledAt?: string | null;
  cancelledBy?: string | null;
  sellerName: string;
}

type NewSalePayload = Omit<Sale, 'id' | 'date' | 'total' | 'status' | 'cancelledAt' | 'cancelledBy' | 'sellerName'>;

function SaleForm({ products, onSave, onClose }: { products: any[]; onSave: (sale: NewSalePayload) => void; onClose: () => void }) {
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [note, setNote] = useState('');
  const [items, setItems] = useState<SaleItem[]>([]);
  const [selProductId, setSelProductId] = useState('');
  const [selQty, setSelQty] = useState('1');

  const addItem = () => {
    const prod = products.find(p => p.id === selProductId);
    if (!prod) return;
    const existing = items.find(i => i.productId === selProductId);
    if (existing) {
      setItems(items.map(i => i.productId === selProductId ? { ...i, quantity: i.quantity + Number(selQty) } : i));
    } else {
      setItems([...items, { productId: prod.id, productName: prod.name, quantity: Number(selQty), unitPrice: prod.price }]);
    }
    setSelProductId(''); setSelQty('1');
  };

  const removeItem = (productId: string) => setItems(items.filter(i => i.productId !== productId));
  const total = items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (items.length === 0) return;
    onSave({ clientName, clientPhone, items, paymentMethod, note });
    onClose();
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
          <Select value={selProductId} onValueChange={setSelProductId}>
            <SelectTrigger className="flex-1"><SelectValue placeholder="Produto" /></SelectTrigger>
            <SelectContent>
              {products.filter(p => p.quantity > 0).map(p => (
                <SelectItem key={p.id} value={p.id}>{p.name} ({p.quantity} disp.)</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input type="number" min="1" className="w-20" value={selQty} onChange={e => setSelQty(e.target.value)} />
          <Button type="button" variant="outline" onClick={addItem} disabled={!selProductId}><Plus className="w-4 h-4" /></Button>
        </div>
      </div>
      {items.length > 0 && (
        <div className="rounded-lg border divide-y">
          {items.map(item => (
            <div key={item.productId} className="flex items-center justify-between p-3 text-sm">
              <div><span className="font-medium text-foreground">{item.productName}</span><span className="text-muted-foreground ml-2">x{item.quantity}</span></div>
              <div className="flex items-center gap-3">
                <span className="text-foreground">R$ {(item.quantity * item.unitPrice).toLocaleString('pt-BR')}</span>
                <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeItem(item.productId)}><Trash2 className="w-3 h-3" /></Button>
              </div>
            </div>
          ))}
          <div className="flex justify-between p-3 font-semibold text-foreground bg-muted/50"><span>Total</span><span>R$ {total.toLocaleString('pt-BR')}</span></div>
        </div>
      )}
      <div className="space-y-2"><Label>Observação</Label><Input value={note} onChange={e => setNote(e.target.value)} /></div>
      <div className="flex gap-2 justify-end">
        <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
        <Button type="submit" className="gold-gradient text-gold-foreground hover:opacity-90" disabled={items.length === 0 || !paymentMethod || !clientName}>Registrar Venda</Button>
      </div>
    </form>
  );
}

const paymentLabels: Record<string, string> = {
  pix: 'PIX', dinheiro: 'Dinheiro', cartao_credito: 'Cartão Crédito', cartao_debito: 'Cartão Débito', boleto: 'Boleto',
};

export default function Sales() {
  const { products, addMovement, refreshProducts, refreshMovements } = useStock();
  const { user } = useAuth();
  const [sales, setSales] = useState<Sale[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [detailSale, setDetailSale] = useState<Sale | null>(null);
  const [loadingSales, setLoadingSales] = useState(true);
  const [saleToCancel, setSaleToCancel] = useState<Sale | null>(null);
  const [cancellingSaleId, setCancellingSaleId] = useState<string | null>(null);

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
        id: s.id, clientName: s.client_name, clientPhone: s.client_phone,
        paymentMethod: s.payment_method, total: Number(s.total), note: s.note, date: s.created_at,
        items: (items || []).map(i => ({ productId: i.product_id, productName: i.product_name, quantity: i.quantity, unitPrice: Number(i.unit_price) })),
        status: (s as any).status ?? 'Concluida',
        cancelledAt: (s as any).cancelled_at ?? null,
        cancelledBy: (s as any).cancelled_by ?? null,
        sellerName: s.created_by ? (sellerMap.get(s.created_by) || 'Não informado') : 'Não informado',
      });
    }
    setSales(salesWithItems);
    setLoadingSales(false);
  }, []);

  useEffect(() => { fetchSales(); }, [fetchSales]);

  const handleSave = async (data: NewSalePayload) => {
    const total = data.items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);

    const { data: saleData } = await supabase.from('sales').insert({
      client_name: data.clientName, client_phone: data.clientPhone,
      payment_method: data.paymentMethod, total, note: data.note, created_by: user?.id,
    }).select().single();

    if (!saleData) return;

    await supabase.from('sale_items').insert(
      data.items.map(i => ({
        sale_id: saleData.id, product_id: i.productId, product_name: i.productName,
        quantity: i.quantity, unit_price: i.unitPrice,
      }))
    );

    // Register stock movements
    for (const item of data.items) {
      await addMovement({ productId: item.productId, productName: item.productName, type: 'saida', quantity: item.quantity, note: `Venda para ${data.clientName}`, sourceSaleId: saleData.id });
    }

    fetchSales();
  };

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
          <p className="text-muted-foreground">{sales.length} vendas registradas</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gold-gradient text-gold-foreground hover:opacity-90"><Plus className="w-4 h-4 mr-2" /> Nova Venda</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
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
                <div><span className="text-muted-foreground">Cliente:</span> <span className="font-medium text-foreground">{detailSale.clientName}</span></div>
                <div><span className="text-muted-foreground">Telefone:</span> <span className="text-foreground">{detailSale.clientPhone || '—'}</span></div>
                <div><span className="text-muted-foreground">Data:</span> <span className="text-foreground">{new Date(detailSale.date).toLocaleDateString('pt-BR')}</span></div>
                <div><span className="text-muted-foreground">Pagamento:</span> <span className="text-foreground">{paymentLabels[detailSale.paymentMethod] || detailSale.paymentMethod}</span></div>
                <div><span className="text-muted-foreground">Status:</span> <Badge variant={getStatusVariant(detailSale.status)} className="ml-2">{getStatusLabel(detailSale.status)}</Badge></div>
                <div><span className="text-muted-foreground">Cancelamento:</span> <span className="text-foreground">{detailSale.cancelledAt ? new Date(detailSale.cancelledAt).toLocaleString('pt-BR') : '—'}</span></div>
                {isAdmin && <div><span className="text-muted-foreground">Vendedor:</span> <span className="text-foreground">{detailSale.sellerName}</span></div>}
              </div>
              <div className="rounded-lg border divide-y">
                {detailSale.items.map(item => (
                  <div key={item.productId} className="flex justify-between p-3">
                    <span className="text-foreground">{item.productName} x{item.quantity}</span>
                    <span className="text-foreground">R$ {(item.quantity * item.unitPrice).toLocaleString('pt-BR')}</span>
                  </div>
                ))}
                <div className="flex justify-between p-3 font-semibold bg-muted/50 text-foreground"><span>Total</span><span>R$ {detailSale.total.toLocaleString('pt-BR')}</span></div>
              </div>
              {detailSale.note && <p className="text-muted-foreground">Obs: {detailSale.note}</p>}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <div className="bg-card rounded-xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left p-4 text-sm font-medium text-muted-foreground">Data</th>
                <th className="text-left p-4 text-sm font-medium text-muted-foreground">Cliente</th>
                {isAdmin && <th className="text-left p-4 text-sm font-medium text-muted-foreground">Vendedor</th>}
                <th className="text-left p-4 text-sm font-medium text-muted-foreground">Pagamento</th>
                <th className="text-right p-4 text-sm font-medium text-muted-foreground">Itens</th>
                <th className="text-left p-4 text-sm font-medium text-muted-foreground">Status</th>
                <th className="text-right p-4 text-sm font-medium text-muted-foreground">Total</th>
                <th className="text-right p-4 text-sm font-medium text-muted-foreground">Ações</th>
              </tr>
            </thead>
            <tbody>
              {loadingSales ? (
                <tr><td colSpan={isAdmin ? 8 : 7} className="p-8 text-center"><Loader2 className="w-5 h-5 animate-spin mx-auto text-muted-foreground" /></td></tr>
              ) : sales.map((s, i) => (
                <motion.tr key={s.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}
                  className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="p-4 text-sm text-muted-foreground">{new Date(s.date).toLocaleDateString('pt-BR')}</td>
                  <td className="p-4 font-medium text-foreground">{s.clientName}</td>
                  {isAdmin && <td className="p-4 text-sm text-foreground">{s.sellerName}</td>}
                  <td className="p-4 text-sm text-muted-foreground">{paymentLabels[s.paymentMethod] || s.paymentMethod}</td>
                  <td className="p-4 text-right text-foreground">{s.items.length}</td>
                  <td className="p-4"><Badge variant={getStatusVariant(s.status)}>{getStatusLabel(s.status)}</Badge></td>
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
              {!loadingSales && sales.length === 0 && (
                <tr><td colSpan={isAdmin ? 8 : 7} className="p-8 text-center text-muted-foreground">Nenhuma venda registrada</td></tr>
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
