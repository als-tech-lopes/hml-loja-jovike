import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Loader2, Save, CreditCard, Calendar, Key, Crown, Settings2, Zap, TestTube } from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { SYSTEM_MODULE_LABELS, SYSTEM_MODULE_ORDER, SYSTEM_MODULES } from '@/lib/systemModules';

interface BillingData {
  id: string;
  plan_type: string;
  due_day: number | null;
  payment_status: string;
  pix_key: string;
  monthly_value: number;
  is_trial: boolean;
  trial_start_date: string | null;
  trial_end_date: string | null;
}

interface PlanFeature {
  id: string;
  module_key: string;
  module_label: string;
  enabled: boolean;
}

interface PlanTemplate {
  id: string;
  plan_key: string;
  plan_label: string;
  monthly_value: number;
  due_day: number;
  pix_key: string;
  max_users: number;
  modules: Record<string, boolean>;
}

const statusLabels: Record<string, string> = {
  active: 'Ativo',
  overdue: 'Vencido',
};

export default function BillingManagement() {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'super_admin';
  const [billing, setBilling] = useState<BillingData | null>(null);
  const [features, setFeatures] = useState<PlanFeature[]>([]);
  const [templates, setTemplates] = useState<PlanTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ plan_type: 'basic', due_day: 5, payment_status: 'active', pix_key: '', monthly_value: 0, is_trial: false, trial_start_date: '', trial_end_date: '' });

  useEffect(() => { loadData(); }, []);

  const normalizeFeatures = (items: PlanFeature[]) => items
    .map((feature) => ({
      ...feature,
      module_label: SYSTEM_MODULE_LABELS[feature.module_key as keyof typeof SYSTEM_MODULE_LABELS] || feature.module_label,
    }))
    .sort((a, b) => {
      const left = SYSTEM_MODULE_ORDER.get(a.module_key as any) ?? Number.MAX_SAFE_INTEGER;
      const right = SYSTEM_MODULE_ORDER.get(b.module_key as any) ?? Number.MAX_SAFE_INTEGER;
      return left - right || a.module_label.localeCompare(b.module_label);
    });

  const loadData = async () => {
    const [billingRes, featuresRes, templatesRes] = await Promise.all([
      supabase.from('tenant_billing').select('*').limit(1).maybeSingle(),
      supabase.from('plan_features').select('*').order('module_key'),
      supabase.from('plan_templates').select('*').order('monthly_value'),
    ]);
    let nextFeatures = (featuresRes.data as PlanFeature[] | null) ?? [];

    if (isSuperAdmin) {
      const existingKeys = new Set(nextFeatures.map((feature) => feature.module_key));
      const missingModules = SYSTEM_MODULES.filter((module) => !existingKeys.has(module.key));

      if (missingModules.length > 0) {
        const { data: insertedFeatures, error } = await supabase
          .from('plan_features')
          .insert(missingModules.map((module) => ({
            module_key: module.key,
            module_label: module.label,
            enabled: true,
          })))
          .select('*');

        if (error) {
          toast.error('Erro ao sincronizar módulos: ' + error.message);
        } else if (insertedFeatures) {
          nextFeatures = [...nextFeatures, ...(insertedFeatures as PlanFeature[])];
        }
      }
    }

    if (billingRes.data) {
      const bd = billingRes.data as unknown as BillingData;
      setBilling(bd);
      setForm({
        plan_type: bd.plan_type,
        due_day: bd.due_day ?? 5,
        payment_status: bd.payment_status,
        pix_key: bd.pix_key,
        monthly_value: bd.monthly_value,
        is_trial: bd.is_trial ?? false,
        trial_start_date: bd.trial_start_date || '',
        trial_end_date: bd.trial_end_date || '',
      });
    }
    setFeatures(normalizeFeatures(nextFeatures));
    if (templatesRes.data) {
      setTemplates(templatesRes.data.map((d: any) => ({
        ...d,
        modules: typeof d.modules === 'string' ? JSON.parse(d.modules) : d.modules,
      })));
    }
    setLoading(false);
  };

  const handleApplyTemplate = async (planKey: string) => {
    const template = templates.find(t => t.plan_key === planKey);
    if (!template) return;

    setForm(prev => ({
      ...prev,
      plan_type: template.plan_key,
      due_day: template.due_day,
      payment_status: 'active',
      pix_key: template.pix_key || prev.pix_key,
      monthly_value: template.monthly_value,
      is_trial: false,
      trial_start_date: '',
      trial_end_date: '',
    }));

    for (const feat of features) {
      const shouldEnable = template.modules[feat.module_key] ?? feat.enabled;
      if (shouldEnable !== feat.enabled) {
        await supabase.from('plan_features').update({ enabled: shouldEnable }).eq('id', feat.id);
      }
    }

    setFeatures(prev => prev.map(f => ({
      ...f,
      enabled: template.modules[f.module_key] ?? f.enabled,
    })));

    toast.success(`Template "${template.plan_label}" aplicado. Revise e salve as alterações.`);
  };

  const handleSave = async () => {
    if (!billing) return;
    setSaving(true);
    const { error } = await supabase
      .from('tenant_billing')
      .update({
        plan_type: form.plan_type,
        due_day: form.due_day,
        payment_status: form.payment_status,
        pix_key: form.pix_key,
        monthly_value: form.monthly_value,
        is_trial: form.is_trial,
        trial_start_date: form.trial_start_date || null,
        trial_end_date: form.trial_end_date || null,
      } as any)
      .eq('id', billing.id);

    if (error) toast.error('Erro ao salvar: ' + error.message);
    else { toast.success('Configurações de plano atualizadas'); await loadData(); }
    setSaving(false);
  };

  const handleToggleFeature = async (feature: PlanFeature) => {
    const newEnabled = !feature.enabled;
    const { error } = await supabase.from('plan_features').update({ enabled: newEnabled }).eq('id', feature.id);
    if (error) toast.error('Erro ao atualizar módulo: ' + error.message);
    else {
      setFeatures(prev => normalizeFeatures(prev.map(f => f.id === feature.id ? { ...f, enabled: newEnabled } : f)));
      toast.success(`${feature.module_label} ${newEnabled ? 'ativado' : 'desativado'}`);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-accent" /></div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-display font-bold text-foreground flex items-center gap-2">
          <Crown className="w-8 h-8 text-accent" />
          {isSuperAdmin ? 'Gestão de Plano e Cobrança' : 'Meu Plano'}
        </h1>
        <p className="text-muted-foreground mt-1">
          {isSuperAdmin ? 'Gerencie o plano, vencimento, chave Pix e módulos do sistema.' : 'Visualize as informações do seu plano.'}
        </p>
      </div>

      {/* Template Quick Apply - super_admin only */}
      {isSuperAdmin && templates.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="bg-card rounded-xl border p-6 max-w-2xl">
          <div className="flex items-center gap-2 mb-3">
            <Zap className="w-5 h-5 text-accent" />
            <h2 className="text-lg font-semibold text-foreground">Aplicar Template de Plano</h2>
          </div>
          <p className="text-sm text-muted-foreground mb-4">Selecione um template para preencher automaticamente as configurações. Você pode ajustar antes de salvar.</p>
          <div className="flex flex-wrap gap-2">
            {templates.map(t => (
              <Button
                key={t.id}
                variant={form.plan_type === t.plan_key ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleApplyTemplate(t.plan_key)}
              >
                {t.plan_label} — R$ {t.monthly_value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </Button>
            ))}
          </div>
        </motion.div>
      )}

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="bg-card rounded-xl border p-6 max-w-2xl">
        <div className="grid gap-6">
          <div className="space-y-2">
            <Label className="flex items-center gap-2"><CreditCard className="w-4 h-4" /> Tipo de Plano</Label>
            {isSuperAdmin ? (
              <Select value={form.plan_type} onValueChange={v => setForm(p => ({ ...p, plan_type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {templates.map(t => (
                    <SelectItem key={t.plan_key} value={t.plan_key}>{t.plan_label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <div className="p-3 rounded-lg bg-muted">
                <span className="font-medium text-foreground">{templates.find(t => t.plan_key === form.plan_type)?.plan_label || form.plan_type}</span>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label>Valor Mensal (R$)</Label>
            {isSuperAdmin ? (
              <Input type="number" min={0} step={0.01} value={form.monthly_value} onChange={e => setForm(p => ({ ...p, monthly_value: parseFloat(e.target.value) || 0 }))} />
            ) : (
              <div className="p-3 rounded-lg bg-muted">
                <span className="font-medium text-foreground">R$ {form.monthly_value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-2"><Calendar className="w-4 h-4" /> Dia do Vencimento</Label>
            {isSuperAdmin ? (
              <Input type="number" min={1} max={31} value={form.due_day} onChange={e => setForm(p => ({ ...p, due_day: Math.min(31, Math.max(1, parseInt(e.target.value) || 1)) }))} />
            ) : (
              <div className="p-3 rounded-lg bg-muted">
                <span className="font-medium text-foreground">Dia {form.due_day}</span>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label>Status do Pagamento</Label>
            {isSuperAdmin ? (
              <Select value={form.payment_status} onValueChange={v => setForm(p => ({ ...p, payment_status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Ativo</SelectItem>
                  <SelectItem value="overdue">Vencido</SelectItem>
                </SelectContent>
              </Select>
            ) : (
              <div className="p-3 rounded-lg bg-muted">
                <Badge variant={form.payment_status === 'active' ? 'default' : 'destructive'}>
                  {statusLabels[form.payment_status] || form.payment_status}
                </Badge>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-2"><Key className="w-4 h-4" /> Chave Pix</Label>
            {isSuperAdmin ? (
              <Input value={form.pix_key} onChange={e => setForm(p => ({ ...p, pix_key: e.target.value }))} placeholder="CPF, CNPJ, email ou chave aleatória" />
            ) : (
              <div className="p-3 rounded-lg bg-muted">
                <span className="font-medium text-foreground">{form.pix_key || 'Não configurada'}</span>
              </div>
            )}
          </div>

          {isSuperAdmin && (
            <div className="space-y-4 border-t pt-4">
              <div className="flex items-center gap-2">
                <TestTube className="w-4 h-4 text-accent" />
                <Label className="font-semibold">Plano Demonstração (Trial 14 dias)</Label>
              </div>
              <div className="flex items-center gap-3">
                <Switch checked={form.is_trial} onCheckedChange={v => {
                  const today = new Date().toISOString().split('T')[0];
                  const end = new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0];
                  setForm(p => ({
                    ...p,
                    is_trial: v,
                    trial_start_date: v ? today : '',
                    trial_end_date: v ? end : '',
                    payment_status: v ? 'active' : p.payment_status,
                  }));
                }} />
                <span className="text-sm text-muted-foreground">{form.is_trial ? 'Trial ativo' : 'Trial desativado'}</span>
              </div>
              {form.is_trial && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label>Início do Trial</Label>
                    <Input type="date" value={form.trial_start_date} onChange={e => {
                      const start = e.target.value;
                      const end = start ? new Date(new Date(start).getTime() + 14 * 86400000).toISOString().split('T')[0] : '';
                      setForm(p => ({ ...p, trial_start_date: start, trial_end_date: end }));
                    }} />
                  </div>
                  <div className="space-y-1">
                    <Label>Término do Trial</Label>
                    <Input type="date" value={form.trial_end_date} readOnly className="bg-muted" />
                  </div>
                  {form.trial_end_date && (() => {
                    const days = Math.ceil((new Date(form.trial_end_date).getTime() - new Date().setHours(0,0,0,0)) / 86400000);
                    return (
                      <div className="col-span-2">
                        <Badge variant={days <= 0 ? 'destructive' : days <= 3 ? 'default' : 'secondary'}>
                          {days <= 0 ? 'Expirado' : `${days} dias restantes`}
                        </Badge>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          )}

          {isSuperAdmin && (
            <Button onClick={handleSave} disabled={saving} className="gold-gradient text-gold-foreground font-semibold w-fit">
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
              Salvar Alterações
            </Button>
          )}
        </div>
      </motion.div>

      {isSuperAdmin && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-card rounded-xl border p-6 max-w-2xl">
          <div className="flex items-center gap-2 mb-4">
            <Settings2 className="w-5 h-5 text-accent" />
            <h2 className="text-lg font-semibold text-foreground">Módulos do Sistema</h2>
          </div>
          <p className="text-sm text-muted-foreground mb-4">Ative ou desative os módulos disponíveis conforme o plano contratado.</p>
          <div className="grid gap-3">
            {features.map(f => (
              <div key={f.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-foreground">{f.module_label}</span>
                  <Badge variant={f.enabled ? 'default' : 'secondary'}>{f.enabled ? 'Ativo' : 'Inativo'}</Badge>
                </div>
                <Switch checked={f.enabled} onCheckedChange={() => handleToggleFeature(f)} />
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
}
