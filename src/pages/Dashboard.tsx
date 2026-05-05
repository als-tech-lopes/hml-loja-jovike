import { useAuth } from '@/contexts/AuthContext';
import { useStock } from '@/contexts/StockContext';
import { Package, AlertTriangle, DollarSign, TrendingDown, Plus, Minus, Search, Crown } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { differenceInDays, format } from 'date-fns';

const fadeIn = (i: number) => ({
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { delay: i * 0.08, duration: 0.3 },
});

const planLabels: Record<string, string> = {
  basic: 'Básico',
  professional: 'Profissional',
  premium: 'Premium',
};

const statusLabels: Record<string, string> = {
  active: 'Ativo',
  overdue: 'Vencido',
  pending: 'Pendente',
};

interface BillingInfo {
  plan_type: string;
  payment_status: string;
  due_day: number | null;
  is_trial: boolean;
  trial_end_date: string | null;
}

function getNextDueDate(dueDay: number): Date {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  const day = Math.min(dueDay, new Date(year, month + 1, 0).getDate());
  const thisMonth = new Date(year, month, day);
  if (today.getDate() <= dueDay) return thisMonth;
  const nextMonth = month + 1;
  const nextDay = Math.min(dueDay, new Date(year, nextMonth + 1, 0).getDate());
  return new Date(year, nextMonth, nextDay);
}

function useBillingInfo(isAdmin: boolean) {
  const [billing, setBilling] = useState<BillingInfo | null>(null);
  useEffect(() => {
    if (!isAdmin) return;
    supabase.from('tenant_billing').select('plan_type, payment_status, due_day, is_trial, trial_end_date').limit(1).single()
      .then(({ data }) => { if (data) setBilling(data as unknown as BillingInfo); });
  }, [isAdmin]);
  return billing;
}

function getBillingAlert(billing: BillingInfo | null) {
  if (!billing) return null;
  // Trial alerts
  if (billing.is_trial && billing.trial_end_date) {
    const endDate = new Date(billing.trial_end_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const days = Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (days < 0)
      return { message: 'Seu período de demonstração foi encerrado. Escolha um plano para continuar.', variant: 'destructive' as const };
    if (days === 0)
      return { message: 'Seu período de demonstração termina hoje.', variant: 'destructive' as const };
    if (days === 1)
      return { message: 'Seu período de demonstração termina amanhã.', variant: 'default' as const };
    if (days <= 3)
      return { message: `Seu período de demonstração termina em ${days} dias.`, variant: 'default' as const };
    return null;
  }
  // Regular billing alerts
  if (!billing.due_day) return null;
  const nextDue = getNextDueDate(billing.due_day);
  const days = differenceInDays(nextDue, new Date());
  if (days < 0 || billing.payment_status === 'overdue')
    return { message: 'Plano vencido. Entre em contato para regularização.', variant: 'destructive' as const };
  if (days === 0)
    return { message: 'Atenção: seu plano vence hoje.', variant: 'destructive' as const };
  if (days <= 3)
    return { message: `Atenção: seu plano vence em ${days} dia${days > 1 ? 's' : ''}.`, variant: 'default' as const };
  return null;
}

export default function Dashboard() {
  const { user } = useAuth();
  const { totalProducts, totalValue, lowStockProducts } = useStock();
  const navigate = useNavigate();
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';
  const billing = useBillingInfo(isAdmin);

  const stats = [
    { label: 'Total de Produtos', value: totalProducts, icon: Package, color: 'text-accent' },
    { label: 'Estoque Baixo', value: lowStockProducts.length, icon: AlertTriangle, color: 'text-destructive' },
    { label: 'Valor em Estoque', value: `R$ ${totalValue.toLocaleString('pt-BR')}`, icon: DollarSign, color: 'text-success' },
  ];

  const billingAlert = getBillingAlert(billing);
  const nextDueDate = billing?.due_day ? getNextDueDate(billing.due_day) : null;
  const daysRemaining = nextDueDate ? differenceInDays(nextDueDate, new Date()) : null;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-display font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground mt-1">Olá, {user?.name}! Aqui está o resumo do seu estoque.</p>
      </div>

      {isAdmin && billingAlert && (
        <Alert variant={billingAlert.variant}>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Aviso do Plano</AlertTitle>
          <AlertDescription>{billingAlert.message}</AlertDescription>
        </Alert>
      )}

      {isAdmin && billing && (
        <motion.div {...fadeIn(0)} className="bg-card rounded-xl border p-6">
          <div className="flex items-center gap-2 mb-4">
            <Crown className="w-5 h-5 text-accent" />
            <h2 className="text-lg font-semibold text-foreground">Seu Plano</h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Plano Ativo</p>
              <p className="text-base font-bold text-foreground">{planLabels[billing.plan_type] || billing.plan_type}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Status</p>
              <p className={`text-base font-bold ${billing.payment_status === 'active' ? 'text-success' : 'text-destructive'}`}>
                {statusLabels[billing.payment_status] || billing.payment_status}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Vencimento</p>
              <p className="text-base font-bold text-foreground">{nextDueDate ? format(nextDueDate, 'dd/MM/yyyy') : '—'}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Dias Restantes</p>
              <p className={`text-base font-bold ${daysRemaining !== null && daysRemaining <= 3 ? 'text-destructive' : 'text-foreground'}`}>
                {daysRemaining !== null ? (daysRemaining < 0 ? 'Vencido' : daysRemaining) : '—'}
              </p>
            </div>
          </div>
        </motion.div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {stats.map((s, i) => (
          <motion.div key={s.label} {...fadeIn(i)} className="stat-card flex items-start gap-4">
            <div className={`p-3 rounded-xl bg-muted ${s.color}`}>
              <s.icon className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{s.label}</p>
              <p className="text-2xl font-bold text-foreground mt-1">{s.value}</p>
            </div>
          </motion.div>
        ))}
      </div>

      <motion.div {...fadeIn(3)} className="flex flex-wrap gap-3">
        <Button onClick={() => navigate('/produtos?new=1')} className="gold-gradient text-gold-foreground hover:opacity-90">
          <Plus className="w-4 h-4 mr-2" /> Adicionar Produto
        </Button>
        <Button variant="outline" onClick={() => navigate('/movimentacoes?new=1')}>
          <Minus className="w-4 h-4 mr-2" /> Dar Baixa
        </Button>
        <Button variant="outline" onClick={() => navigate('/produtos')}>
          <Search className="w-4 h-4 mr-2" /> Buscar Produto
        </Button>
      </motion.div>

      {lowStockProducts.length > 0 && (
        <motion.div {...fadeIn(4)} className="bg-card rounded-xl border p-6">
          <div className="flex items-center gap-2 mb-4">
            <TrendingDown className="w-5 h-5 text-destructive" />
            <h2 className="text-lg font-semibold text-foreground">Produtos com Estoque Baixo</h2>
          </div>
          <div className="space-y-3">
            {lowStockProducts.map(p => (
              <div key={p.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <div>
                  <p className="font-medium text-foreground">{p.name}</p>
                  <p className="text-sm text-muted-foreground">{p.category}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-destructive">{p.quantity} un.</p>
                  <p className="text-xs text-muted-foreground">Mín: {p.minStock}</p>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
}
