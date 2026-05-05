import { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarIcon, Loader2, Save, Wallet } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

interface SellerRow {
  id: string;
  name: string;
  email: string;
  totalSold: number;
  commissionPercent: number;
}

const formatCurrency = (value: number) =>
  value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export default function SellerCommissions() {
  const { users, user } = useAuth();
  const today = new Date();
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);

  const [startDate, setStartDate] = useState<Date | undefined>(firstDay);
  const [endDate, setEndDate] = useState<Date | undefined>(today);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const [salesByUser, setSalesByUser] = useState<Record<string, number>>({});
  const [commissions, setCommissions] = useState<Record<string, number>>({});
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';

  const sellers = useMemo(
    () => users.filter((u) => u.is_active),
    [users],
  );

  async function loadData() {
    if (!startDate || !endDate) return;
    setLoading(true);
    try {
      const startISO = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate(), 0, 0, 0).toISOString();
      const endISO = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate(), 23, 59, 59).toISOString();

      const { data: sales, error } = await supabase
        .from('sales')
        .select('created_by, total, status, created_at')
        .gte('created_at', startISO)
        .lte('created_at', endISO);

      if (error) throw error;

      const totals: Record<string, number> = {};
      (sales ?? []).forEach((s: any) => {
        const status = (s.status || '').toLowerCase();
        if (status === 'cancelada' || status === 'estornada') return;
        if (!s.created_by) return;
        totals[s.created_by] = (totals[s.created_by] || 0) + Number(s.total || 0);
      });
      setSalesByUser(totals);

      const { data: comms, error: commErr } = await supabase
        .from('seller_commissions')
        .select('seller_id, commission_percent');
      if (commErr) throw commErr;
      const map: Record<string, number> = {};
      (comms ?? []).forEach((c: any) => {
        map[c.seller_id] = Number(c.commission_percent || 0);
      });
      setCommissions(map);
      setDrafts({});
    } catch (e: any) {
      toast.error(e.message || 'Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate?.getTime(), endDate?.getTime()]);

  const rows: SellerRow[] = useMemo(() => {
    return sellers
      .map((s) => ({
        id: s.id,
        name: s.name || s.email,
        email: s.email,
        totalSold: salesByUser[s.id] || 0,
        commissionPercent: commissions[s.id] ?? 0,
      }))
      .sort((a, b) => b.totalSold - a.totalSold);
  }, [sellers, salesByUser, commissions]);

  const grandTotal = rows.reduce((acc, r) => acc + r.totalSold, 0);
  const grandCommission = rows.reduce((acc, r) => {
    const draft = drafts[r.id];
    const pct = draft !== undefined ? parseFloat(draft.replace(',', '.')) : r.commissionPercent;
    const safePct = isNaN(pct) ? 0 : pct;
    return acc + (r.totalSold * safePct) / 100;
  }, 0);

  async function handleSave(sellerId: string) {
    if (!isAdmin) return;
    const raw = drafts[sellerId];
    const pct = raw !== undefined ? parseFloat(raw.replace(',', '.')) : commissions[sellerId] ?? 0;
    if (isNaN(pct) || pct < 0 || pct > 100) {
      toast.error('Informe uma porcentagem entre 0 e 100');
      return;
    }
    setSaving(sellerId);
    try {
      const { error } = await supabase
        .from('seller_commissions')
        .upsert(
          { seller_id: sellerId, commission_percent: pct },
          { onConflict: 'seller_id' },
        );
      if (error) throw error;
      setCommissions((prev) => ({ ...prev, [sellerId]: pct }));
      setDrafts((prev) => {
        const copy = { ...prev };
        delete copy[sellerId];
        return copy;
      });
      toast.success('Comissão salva');
    } catch (e: any) {
      toast.error(e.message || 'Erro ao salvar comissão');
    } finally {
      setSaving(null);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div>
        <h1 className="text-3xl font-display font-bold flex items-center gap-2">
          <Wallet className="w-7 h-7 text-accent" />
          Comissão de Vendedores
        </h1>
        <p className="text-muted-foreground mt-1">
          Calcule a comissão de cada vendedor com base no período selecionado.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Período</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-4">
          <div className="space-y-2">
            <Label>Data inicial</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    'w-[200px] justify-start text-left font-normal',
                    !startDate && 'text-muted-foreground',
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {startDate ? format(startDate, 'PPP', { locale: ptBR }) : 'Selecionar'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={startDate}
                  onSelect={setStartDate}
                  initialFocus
                  className={cn('p-3 pointer-events-auto')}
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <Label>Data final</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    'w-[200px] justify-start text-left font-normal',
                    !endDate && 'text-muted-foreground',
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {endDate ? format(endDate, 'PPP', { locale: ptBR }) : 'Selecionar'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={endDate}
                  onSelect={setEndDate}
                  initialFocus
                  className={cn('p-3 pointer-events-auto')}
                />
              </PopoverContent>
            </Popover>
          </div>

          <Button onClick={loadData} disabled={loading} variant="secondary">
            {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            Atualizar
          </Button>

          <div className="ml-auto flex flex-col items-end gap-1 text-sm">
            <span className="text-muted-foreground">Total no período</span>
            <span className="text-lg font-semibold">{formatCurrency(grandTotal)}</span>
            <span className="text-muted-foreground">Comissão total</span>
            <span className="text-lg font-semibold text-accent">{formatCurrency(grandCommission)}</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Vendedores</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : rows.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Nenhum vendedor encontrado.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Vendedor</TableHead>
                    <TableHead className="text-right">Total Vendido</TableHead>
                    <TableHead className="w-[160px]">% Comissão</TableHead>
                    <TableHead className="text-right">Valor a Receber</TableHead>
                    <TableHead className="w-[120px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => {
                    const draft = drafts[r.id];
                    const pctValue = draft !== undefined ? draft : String(r.commissionPercent);
                    const numericPct = parseFloat((draft ?? String(r.commissionPercent)).replace(',', '.'));
                    const safePct = isNaN(numericPct) ? 0 : numericPct;
                    const commissionValue = (r.totalSold * safePct) / 100;
                    const dirty = draft !== undefined && draft !== String(r.commissionPercent);

                    return (
                      <TableRow key={r.id}>
                        <TableCell>
                          <div className="font-medium">{r.name}</div>
                          <div className="text-xs text-muted-foreground">{r.email}</div>
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(r.totalSold)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Input
                              type="number"
                              min={0}
                              max={100}
                              step="0.01"
                              value={pctValue}
                              onChange={(e) =>
                                setDrafts((prev) => ({ ...prev, [r.id]: e.target.value }))
                              }
                              disabled={!isAdmin}
                              className="w-24"
                            />
                            <span className="text-muted-foreground">%</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge variant="secondary" className="text-base">
                            {formatCurrency(commissionValue)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {isAdmin && (
                            <Button
                              size="sm"
                              variant={dirty ? 'default' : 'ghost'}
                              onClick={() => handleSave(r.id)}
                              disabled={saving === r.id || !dirty}
                            >
                              {saving === r.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <>
                                  <Save className="w-4 h-4 mr-1" />
                                  Salvar
                                </>
                              )}
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
