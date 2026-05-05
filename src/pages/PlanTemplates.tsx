import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Loader2, Save, Plus, Trash2, LayoutTemplate } from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';

interface PlanTemplate {
  id: string;
  plan_key: string;
  plan_label: string;
  monthly_value: number;
  due_day: number;
  pix_key: string;
  max_users: number;
  default_status: string;
  modules: Record<string, boolean>;
}

const MODULE_OPTIONS = [
  { key: 'products', label: 'Produtos' },
  { key: 'movements', label: 'Movimentações' },
  { key: 'sales', label: 'Vendas' },
  { key: 'reports', label: 'Relatórios' },
  { key: 'catalog', label: 'Catálogo Online' },
  { key: 'export_excel', label: 'Exportação Excel' },
  { key: 'users', label: 'Usuários' },
];

const TRIAL_PLAN_KEY = 'trial';

const emptyTemplate: Omit<PlanTemplate, 'id'> = {
  plan_key: '',
  plan_label: '',
  monthly_value: 0,
  due_day: 5,
  pix_key: '',
  max_users: 2,
  default_status: 'active',
  modules: Object.fromEntries(MODULE_OPTIONS.map(m => [m.key, false])),
};

export default function PlanTemplates() {
  const [templates, setTemplates] = useState<PlanTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Record<string, PlanTemplate>>({});

  useEffect(() => { loadTemplates(); }, []);

  const loadTemplates = async () => {
    const { data } = await supabase.from('plan_templates').select('*').order('monthly_value');
    if (data) {
      const parsed = data.map((d: any) => ({
        ...d,
        modules: typeof d.modules === 'string' ? JSON.parse(d.modules) : d.modules,
      }));
      setTemplates(parsed);
      const editMap: Record<string, PlanTemplate> = {};
      parsed.forEach((t: PlanTemplate) => { editMap[t.id] = { ...t }; });
      setEditing(editMap);
    }
    setLoading(false);
  };

  const handleChange = (id: string, field: string, value: any) => {
    setEditing(prev => ({ ...prev, [id]: { ...prev[id], [field]: value } }));
  };

  const handleModuleToggle = (id: string, moduleKey: string) => {
    setEditing(prev => ({
      ...prev,
      [id]: {
        ...prev[id],
        modules: { ...prev[id].modules, [moduleKey]: !prev[id].modules[moduleKey] },
      },
    }));
  };

  const handleSave = async (id: string) => {
    const t = editing[id];
    if (!t) return;
    setSavingId(id);
    const { error } = await supabase.from('plan_templates').update({
      plan_label: t.plan_label,
      monthly_value: t.monthly_value,
      due_day: t.due_day,
      pix_key: t.pix_key,
      max_users: t.max_users,
      default_status: t.default_status,
      modules: t.modules as any,
    }).eq('id', id);

    if (error) toast.error('Erro ao salvar: ' + error.message);
    else { toast.success(`Template "${t.plan_label}" salvo`); await loadTemplates(); }
    setSavingId(null);
  };

  const handleAdd = async () => {
    const key = `custom_${Date.now()}`;
    const { error } = await supabase.from('plan_templates').insert({
      plan_key: key,
      plan_label: 'Novo Plano',
      monthly_value: 0,
      due_day: 5,
      max_users: 2,
      modules: emptyTemplate.modules as any,
    } as any);
    if (error) toast.error('Erro: ' + error.message);
    else { toast.success('Novo template criado'); await loadTemplates(); }
  };

  const handleDelete = async (id: string, label: string) => {
    if (!confirm(`Excluir o template "${label}"?`)) return;
    const { error } = await supabase.from('plan_templates').delete().eq('id', id);
    if (error) toast.error('Erro: ' + error.message);
    else { toast.success('Template excluído'); await loadTemplates(); }
  };

  if (loading) {
    return <div className="flex items-center justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-accent" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground flex items-center gap-2">
            <LayoutTemplate className="w-8 h-8 text-accent" />
            Templates de Plano
          </h1>
          <p className="text-muted-foreground mt-1">Configure modelos pré-definidos para cada tipo de plano.</p>
        </div>
        <Button onClick={handleAdd} className="gold-gradient text-gold-foreground font-semibold">
          <Plus className="w-4 h-4 mr-2" /> Novo Template
        </Button>
      </div>

      <div className="grid gap-6">
        {templates.map((t, idx) => {
          const e = editing[t.id] || t;
          return (
            <motion.div key={t.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.05 }} className="bg-card rounded-xl border p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-xs">{t.plan_key}</Badge>
                  {t.plan_key === TRIAL_PLAN_KEY && (
                    <Badge className="bg-accent text-accent-foreground text-xs">Teste Grátis 14 dias</Badge>
                  )}
                </div>
                <Button variant="ghost" size="icon" onClick={() => handleDelete(t.id, t.plan_label)}>
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              </div>

              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                <div className="space-y-1">
                  <Label>Nome do Plano</Label>
                  <Input value={e.plan_label} onChange={ev => handleChange(t.id, 'plan_label', ev.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>Valor Mensal (R$)</Label>
                  <Input type="number" min={0} step={0.01} value={e.monthly_value} onChange={ev => handleChange(t.id, 'monthly_value', parseFloat(ev.target.value) || 0)} />
                </div>
                <div className="space-y-1">
                  <Label>Dia do Vencimento</Label>
                  <Input type="number" min={1} max={31} value={e.due_day} onChange={ev => handleChange(t.id, 'due_day', Math.min(31, Math.max(1, parseInt(ev.target.value) || 1)))} />
                </div>
                <div className="space-y-1">
                  <Label>Chave Pix</Label>
                  <Input value={e.pix_key} onChange={ev => handleChange(t.id, 'pix_key', ev.target.value)} placeholder="CPF, CNPJ, email ou aleatória" />
                </div>
                <div className="space-y-1">
                  <Label>Máx. Usuários</Label>
                  <Input type="number" min={1} value={e.max_users} onChange={ev => handleChange(t.id, 'max_users', Math.max(1, parseInt(ev.target.value) || 1))} />
                </div>
              </div>

              <div className="mb-4">
                <Label className="mb-2 block">Módulos Liberados</Label>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {MODULE_OPTIONS.map(m => (
                    <div key={m.key} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                      <span className="text-sm text-foreground">{m.label}</span>
                      <Switch checked={!!e.modules[m.key]} onCheckedChange={() => handleModuleToggle(t.id, m.key)} />
                    </div>
                  ))}
                </div>
              </div>

              <Button onClick={() => handleSave(t.id)} disabled={savingId === t.id} className="gold-gradient text-gold-foreground font-semibold">
                {savingId === t.id ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                Salvar Template
              </Button>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
