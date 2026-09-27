import { useState } from 'react';
import { useStock } from '@/contexts/StockContext';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Plus, ArrowUpCircle, ArrowDownCircle, Ban, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { isWithinDateRange } from '@/lib/dateRange';

export default function Movements() {
  const { movements, products, addMovement, cancelMovement } = useStock();
  const { user } = useAuth();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [productId, setProductId] = useState('');
  const [productVariantId, setProductVariantId] = useState('');
  const [type, setType] = useState<'entrada' | 'saida'>('entrada');
  const [quantity, setQuantity] = useState('');
  const [note, setNote] = useState('');
  const [movementToCancel, setMovementToCancel] = useState<string | null>(null);
  const [cancellingMovementId, setCancellingMovementId] = useState<string | null>(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';

  const getStatusStyles = (status: string) => {
    if (status === 'Cancelada') return 'bg-destructive/10 text-destructive border-destructive/20';
    if (status === 'Pendente') return 'bg-accent/10 text-accent border-accent/20';
    return 'bg-success/10 text-success border-success/20';
  };

  const canCancelMovement = (movement: typeof movements[number]) => (
    movement.status !== 'Cancelada' && !movement.sourceSaleId && !movement.note.startsWith('Venda para ')
  );

  const selectedProduct = products.find(product => product.id === productId);
  const filteredMovements = movements.filter(movement => isWithinDateRange(movement.date, startDate, endDate));
  const hasDateFilter = Boolean(startDate || endDate);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const product = selectedProduct;
    if (!product) return;
    if (product.variants.length > 0 && !productVariantId) {
      toast.error('Selecione a cor e o tamanho.');
      return;
    }
    try {
      await addMovement({ productId, productName: product.name, productVariantId: productVariantId || null, variantColor: null, variantSize: null, type, quantity: Number(quantity), note });
      setDialogOpen(false);
      setProductId(''); setProductVariantId(''); setQuantity(''); setNote('');
      toast.success('Movimentação registrada com sucesso.');
    } catch (error: any) {
      toast.error(error?.message || 'Não foi possível registrar a movimentação.');
    }
  };

  const handleCancelMovement = async () => {
    if (!movementToCancel) return;

    try {
      setCancellingMovementId(movementToCancel);
      await cancelMovement(movementToCancel);
      toast.success('Movimentação cancelada com sucesso.');
      setMovementToCancel(null);
    } catch (error: any) {
      toast.error(error?.message || 'Não foi possível cancelar a movimentação.');
    } finally {
      setCancellingMovementId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Movimentações</h1>
          <p className="text-muted-foreground">
            {hasDateFilter ? `${filteredMovements.length} de ${movements.length} movimentações` : 'Histórico de entradas e saídas'}
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gold-gradient text-gold-foreground hover:opacity-90">
              <Plus className="w-4 h-4 mr-2" /> Nova Movimentação
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Nova Movimentação</DialogTitle></DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Produto (estoque total)</Label>
                <Select value={productId} onValueChange={value => { setProductId(value); setProductVariantId(''); }}>
                  <SelectTrigger><SelectValue placeholder="Selecione um produto" /></SelectTrigger>
                  <SelectContent>
                    {products.map(p => <SelectItem key={p.id} value={p.id}>{p.productCode} — {p.name} ({p.quantity} un.)</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {selectedProduct && selectedProduct.variants.length > 0 && (
                <div className="space-y-2">
                  <Label>Cor e tamanho</Label>
                  <Select value={productVariantId} onValueChange={setProductVariantId}>
                    <SelectTrigger><SelectValue placeholder="Selecione a variação" /></SelectTrigger>
                    <SelectContent>
                      {selectedProduct.variants.filter(variant => type === 'entrada' || variant.quantity > 0).map(variant => (
                        <SelectItem key={variant.id} value={variant.id!}>
                          <span className="font-medium">{variant.color} — {variant.size}</span>
                          <span className="ml-2 font-mono text-xs text-muted-foreground">{variant.variantCode} · {variant.quantity} un.</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select value={type} onValueChange={v => setType(v as 'entrada' | 'saida')}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="entrada">Entrada</SelectItem>
                    <SelectItem value="saida">Saída</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Quantidade</Label>
                <Input type="number" min="1" value={quantity} onChange={e => setQuantity(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>Observação</Label>
                <Input value={note} onChange={e => setNote(e.target.value)} placeholder="Ex: Reposição do fornecedor" />
              </div>
              <div className="flex gap-2 justify-end">
                <Button type="button" variant="ghost" onClick={() => setDialogOpen(false)}>Cancelar</Button>
                <Button type="submit" className="gold-gradient text-gold-foreground hover:opacity-90">Registrar</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex flex-col gap-3 rounded-xl border bg-card p-4 sm:flex-row sm:items-end">
        <div className="grid flex-1 gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="movements-start-date">Data inicial</Label>
            <Input
              id="movements-start-date"
              type="date"
              value={startDate}
              max={endDate || undefined}
              onChange={event => setStartDate(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="movements-end-date">Data final</Label>
            <Input
              id="movements-end-date"
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

      <div className="bg-card rounded-xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left p-4 text-sm font-medium text-muted-foreground">Data</th>
                <th className="text-left p-4 text-sm font-medium text-muted-foreground">Produto</th>
                <th className="text-left p-4 text-sm font-medium text-muted-foreground">Código</th>
                <th className="text-left p-4 text-sm font-medium text-muted-foreground">Tipo</th>
                <th className="text-right p-4 text-sm font-medium text-muted-foreground">Qtd</th>
                <th className="text-left p-4 text-sm font-medium text-muted-foreground">Status</th>
                <th className="text-left p-4 text-sm font-medium text-muted-foreground">Obs</th>
                {isAdmin && <th className="text-right p-4 text-sm font-medium text-muted-foreground">Ações</th>}
              </tr>
            </thead>
            <tbody>
              {filteredMovements.map((m, i) => (
                <motion.tr key={m.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}
                  className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="p-4 text-sm text-muted-foreground">{new Date(m.date).toLocaleDateString('pt-BR')}</td>
                  <td className="p-4 font-medium text-foreground"><div>{m.productName}</div>{m.variantColor && <div className="text-xs font-normal text-muted-foreground">{m.variantColor} — {m.variantSize}</div>}</td>
                  <td className="p-4 text-sm">
                    <div className="font-mono font-semibold text-foreground">{m.productCode}</div>
                    {m.variantCode && <div className="mt-1 font-mono text-xs text-muted-foreground">{m.variantCode}</div>}
                  </td>
                  <td className="p-4">
                    <span className={`inline-flex items-center gap-1 text-sm font-medium ${m.type === 'entrada' ? 'text-success' : 'text-destructive'}`}>
                      {m.type === 'entrada' ? <ArrowUpCircle className="w-4 h-4" /> : <ArrowDownCircle className="w-4 h-4" />}
                      {m.type === 'entrada' ? 'Entrada' : 'Saída'}
                    </span>
                  </td>
                  <td className="p-4 text-right font-semibold text-foreground">{m.quantity}</td>
                  <td className="p-4">
                    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${getStatusStyles(m.status)}`}>
                      {m.status === 'Concluida' ? 'Concluída' : m.status}
                    </span>
                  </td>
                  <td className="p-4 text-sm text-muted-foreground">{m.note || '—'}</td>
                  {isAdmin && (
                    <td className="p-4 text-right">
                      {canCancelMovement(m) ? (
                        <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => setMovementToCancel(m.id)}>
                          <Ban className="w-4 h-4 mr-2" /> Cancelar
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                  )}
                </motion.tr>
              ))}
              {filteredMovements.length === 0 && (
                <tr><td colSpan={isAdmin ? 8 : 7} className="p-8 text-center text-muted-foreground">{hasDateFilter ? 'Nenhuma movimentação encontrada no período' : 'Nenhuma movimentação registrada'}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <AlertDialog open={!!movementToCancel} onOpenChange={(open) => !open && setMovementToCancel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar movimentação</AlertDialogTitle>
            <AlertDialogDescription>
              Essa ação irá marcar a movimentação como cancelada e reverter o impacto no estoque automaticamente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={!!cancellingMovementId}>Voltar</AlertDialogCancel>
            <AlertDialogAction onClick={handleCancelMovement} disabled={!!cancellingMovementId} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {cancellingMovementId ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirmar cancelamento'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
