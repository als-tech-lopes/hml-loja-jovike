import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Settings } from 'lucide-react';
import { toast } from 'sonner';

const LIMIT_OPTIONS = [10, 20, 50, 100];

export default function OfflineCatalogSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settingsId, setSettingsId] = useState<string | null>(null);
  const [maxProducts, setMaxProducts] = useState(10);

  useEffect(() => {
    const loadSettings = async () => {
      const { data } = await (supabase as any)
        .from('offline_catalog_settings')
        .select('id, max_products')
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();

      setSettingsId(data?.id ?? null);
      setMaxProducts(Number(data?.max_products ?? 10));
      setLoading(false);
    };

    loadSettings();
  }, []);

  const saveLimit = async () => {
    setSaving(true);

    const db = supabase as any;
    const { data, error } = settingsId
      ? await db.from('offline_catalog_settings').update({ max_products: maxProducts }).eq('id', settingsId).select('id').maybeSingle()
      : await db.from('offline_catalog_settings').insert({ max_products: maxProducts }).select('id').maybeSingle();

    if (error) {
      toast.error(error.message);
      setSaving(false);
      return;
    }

    if (data?.id) setSettingsId(data.id);
    toast.success('Limite do Catálogo Offline salvo com sucesso.');
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-accent" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-3xl font-display font-bold text-foreground flex items-center gap-2">
          <Settings className="w-8 h-8 text-accent" />
          Configuração do Catálogo Offline
        </h1>
        <p className="text-muted-foreground mt-1">Defina o limite máximo de produtos disponíveis para seleção no catálogo offline.</p>
      </div>

      <div className="rounded-xl border bg-card p-6 space-y-5">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-muted-foreground">Limite atual:</span>
          <Badge variant="secondary">{maxProducts} produtos</Badge>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {LIMIT_OPTIONS.map((option) => (
            <Button
              key={option}
              type="button"
              variant={maxProducts === option ? 'default' : 'outline'}
              onClick={() => setMaxProducts(option)}
            >
              {option} produtos
            </Button>
          ))}
        </div>

        <div className="flex justify-end">
          <Button onClick={saveLimit} disabled={saving} className="gold-gradient text-gold-foreground hover:opacity-90">
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Salvar limite
          </Button>
        </div>
      </div>
    </div>
  );
}