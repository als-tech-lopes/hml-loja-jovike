import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { useStock } from '@/contexts/StockContext';
import { supabase } from '@/integrations/supabase/client';
import { BookOpen, Gem, Loader2, Search, Settings } from 'lucide-react';
import { toast } from 'sonner';

export default function OfflineCatalog() {
  const { user } = useAuth();
  const { products } = useStock();
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [maxProducts, setMaxProducts] = useState(10);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  useEffect(() => {
    const loadData = async () => {
      const db = supabase as any;
      const [{ data: settings }, { data: selected }] = await Promise.all([
        db.from('offline_catalog_settings').select('max_products').order('created_at', { ascending: true }).limit(1).maybeSingle(),
        db.from('offline_catalog_products').select('product_id').order('created_at', { ascending: true }),
      ]);

      setMaxProducts(Number(settings?.max_products ?? 10));
      setSelectedIds((selected ?? []).map((item: { product_id: string }) => item.product_id));
      setLoading(false);
    };

    loadData();
  }, []);

  const filteredProducts = useMemo(() => {
    const term = search.toLowerCase();
    return products.filter((product) => {
      const haystack = `${product.productCode} ${product.name} ${product.description} ${product.category}`.toLowerCase();
      return haystack.includes(term);
    });
  }, [products, search]);

  const selectedProducts = useMemo(
    () => products.filter((product) => selectedIds.includes(product.id)),
    [products, selectedIds],
  );

  const limitReached = selectedIds.length >= maxProducts;

  const handleToggleProduct = async (productId: string, checked: boolean) => {
    if (checked) {
      if (selectedIds.includes(productId)) return;
      if (limitReached) {
        toast.error('Limite do plano alcançado para o Catálogo Offline.');
        return;
      }

      const { error } = await (supabase as any)
        .from('offline_catalog_products')
        .insert({ product_id: productId, selected_by: user?.id ?? null });

      if (error) {
        toast.error(error.message);
        return;
      }

      setSelectedIds((prev) => [...prev, productId]);
      return;
    }

    const { error } = await (supabase as any).from('offline_catalog_products').delete().eq('product_id', productId);

    if (error) {
      toast.error(error.message);
      return;
    }

    setSelectedIds((prev) => prev.filter((id) => id !== productId));
  };

  if (loading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-accent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground flex items-center gap-2">
            <BookOpen className="w-8 h-8 text-accent" />
            Catálogo Offline
          </h1>
          <p className="text-muted-foreground mt-1">Selecione os produtos internos exibidos no catálogo offline, sem compartilhamento e sem WhatsApp.</p>
        </div>

        <div className="flex items-center gap-2 self-start">
          <Badge variant="secondary" className="text-sm px-3 py-1">{selectedIds.length} de {maxProducts} produtos selecionados</Badge>
          {user?.role === 'super_admin' && (
            <Button variant="outline" asChild>
              <Link to="/catalogo-offline-config">
                <Settings className="w-4 h-4 mr-2" /> Configurar limite
              </Link>
            </Button>
          )}
        </div>
      </div>

      {limitReached && (
        <div className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
          O limite máximo de produtos do catálogo offline foi atingido. Remova um item para selecionar outro.
        </div>
      )}

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar produtos do estoque..." className="pl-10" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.3fr_1fr]">
        <div className="rounded-xl border bg-card overflow-hidden">
          <div className="border-b px-4 py-3">
            <h2 className="font-semibold text-foreground">Produtos do estoque</h2>
          </div>
          <div className="divide-y">
            {filteredProducts.map((product) => {
              const checked = selectedIds.includes(product.id);
              const disabled = !checked && limitReached;

              return (
                <label key={product.id} className="flex items-center gap-4 p-4 cursor-pointer">
                  <Checkbox checked={checked} disabled={disabled} onCheckedChange={(value) => handleToggleProduct(product.id, value === true)} />
                  <div className="w-16 h-16 rounded-lg bg-muted flex items-center justify-center overflow-hidden shrink-0">
                    {product.image_url ? (
                      <img src={product.image_url} alt={product.name} className="w-full h-full object-contain p-1" />
                    ) : (
                      <Gem className="w-6 h-6 text-accent opacity-40" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-foreground">{product.name}</p>
                      <span className="font-mono text-xs text-muted-foreground">{product.productCode}</span>
                      {product.category && <Badge variant="outline">{product.category}</Badge>}
                    </div>
                    {product.description && <p className="text-sm text-muted-foreground line-clamp-2">{product.description}</p>}
                  </div>
                  <p className="font-semibold text-foreground whitespace-nowrap">R$ {product.price.toLocaleString('pt-BR')}</p>
                </label>
              );
            })}

            {filteredProducts.length === 0 && (
              <div className="p-8 text-center text-muted-foreground">Nenhum produto encontrado.</div>
            )}
          </div>
        </div>

        <div className="rounded-xl border bg-card overflow-hidden">
          <div className="border-b px-4 py-3">
            <h2 className="font-semibold text-foreground">Pré-visualização selecionada</h2>
          </div>
          <div className="p-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
            {selectedProducts.map((product) => (
              <div key={product.id} className="rounded-xl border bg-background overflow-hidden">
                <div className="aspect-square bg-muted flex items-center justify-center overflow-hidden">
                  {product.image_url ? (
                    <img src={product.image_url} alt={product.name} className="w-full h-full object-contain p-3" />
                  ) : (
                    <Gem className="w-10 h-10 text-accent opacity-40" />
                  )}
                </div>
                <div className="p-4 space-y-2">
                  <p className="font-semibold text-foreground">{product.name}</p>
                  <p className="font-mono text-xs text-muted-foreground">{product.productCode}</p>
                  <p className="text-base font-bold text-foreground">R$ {product.price.toLocaleString('pt-BR')}</p>
                  {product.description && <p className="text-sm text-muted-foreground">{product.description}</p>}
                </div>
              </div>
            ))}

            {selectedProducts.length === 0 && (
              <div className="rounded-xl border border-dashed p-6 text-center text-muted-foreground">
                Nenhum produto selecionado para o catálogo offline.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
