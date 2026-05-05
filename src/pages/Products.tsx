import { useState } from 'react';
import { useStock, Product } from '@/contexts/StockContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Search, Pencil, Trash2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';


function ProductForm({ product, onSave, onClose }: { product?: Product; onSave: (data: any) => void; onClose: () => void }) {
  const [name, setName] = useState(product?.name || '');
  const [quantity, setQuantity] = useState(product?.quantity?.toString() || '');
  const [price, setPrice] = useState(product?.price?.toString() || '');
  const [category, setCategory] = useState(product?.category || '');
  const [description, setDescription] = useState(product?.description || '');
  const [minStock, setMinStock] = useState(product?.minStock?.toString() || '5');
  const [file, setFile] = useState<File | null>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({ 
      name, 
      quantity: Number(quantity), 
      price: Number(price), 
      category, description, 
      minStock: Number(minStock),
      file });
    //onClose();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2"><Label>Nome *</Label><Input value={name} onChange={e => setName(e.target.value)} required /></div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2"><Label>Quantidade *</Label><Input type="number" min="0" value={quantity} onChange={e => setQuantity(e.target.value)} required /></div>
        <div className="space-y-2"><Label>Preço (R$) *</Label><Input type="number" min="0" step="0.01" value={price} onChange={e => setPrice(e.target.value)} required /></div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2"><Label>Categoria</Label><Input value={category} onChange={e => setCategory(e.target.value)} placeholder="Ex: Anéis" /></div>
        <div className="space-y-2"><Label>Estoque Mín.</Label><Input type="number" min="0" value={minStock} onChange={e => setMinStock(e.target.value)} /></div>
      </div>
      <div className="space-y-2"><Label>Descrição</Label>
      <Input value={description} onChange={e => setDescription(e.target.value)} />
      </div>

     
      <div className="space-y-2">
          <Label>Imagem do Produto</Label>
          <Input type="file" accept="image/*" onChange={handleFileChange} 
          
        />

          {/* 👇 PREVIEW AQUI */}
        {file && (
          <img
            src={URL.createObjectURL(file)}
            alt="preview"
            className="w-20 h-20 object-cover rounded-md mt-2"
          />
        )}


      </div>

      <div className="flex gap-2 justify-end">
        <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
        <Button type="submit" className="gold-gradient text-gold-foreground hover:opacity-90">Salvar</Button>
      </div>
    </form>
  );
}

export default function Products() {
  const { products, addProduct, updateProduct, deleteProduct } = useStock();
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | undefined>();
  const [searchParams] = useSearchParams();

  const isNewFromDashboard = searchParams.get('new') === '1';
  const [showNew] = useState(isNewFromDashboard);

  const filtered = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.category.toLowerCase().includes(search.toLowerCase())
  );

const handleSave = async (data: any) => {
  try {
    if (!import.meta.env.VITE_SUPABASE_URL) {
      throw new Error('Configuração do backend ausente (SUPABASE_URL).');
    }

    let imageUrl: string | null = editingProduct?.image_url ?? null;

    // 👇 upload da imagem
    if (data.file) {
      const file = data.file;
      const fileExt = file.name.split('.').pop() || 'jpg';
      const fileName = `${crypto.randomUUID()}.${fileExt}`;

      const { error: bucketError } = await supabase.storage.from('products').list('', { limit: 1 });
      if (bucketError) {
        throw new Error(
          bucketError.message.toLowerCase().includes('not found')
            ? 'Bucket "products" não encontrado.'
            : `Falha ao validar acesso ao storage: ${bucketError.message}`
        );
      }

      const { error: uploadError } = await supabase.storage
        .from('products')
        .upload(fileName, file, { cacheControl: '3600', upsert: false });

      if (uploadError) {
        throw new Error(`Falha no upload da imagem: ${uploadError.message}`);
      }

      const { data: publicUrl } = supabase.storage
        .from('products')
        .getPublicUrl(fileName);

      if (!publicUrl?.publicUrl) {
        throw new Error('Não foi possível gerar a URL pública da imagem.');
      }

      imageUrl = publicUrl.publicUrl;
    }

    const productData = {
      name: data.name,
      quantity: data.quantity,
      price: data.price,
      category: data.category,
      description: data.description,
      minStock: data.minStock,
      image_url: imageUrl
    };

    if (editingProduct) {
      await updateProduct(editingProduct.id, productData);
    } else {
      await addProduct(productData);
    }

    setEditingProduct(undefined);
    setDialogOpen(false);

  } catch (error) {
    console.error('Erro ao salvar produto:', error);
    alert(error instanceof Error ? error.message : 'Erro ao salvar produto. Veja o console para detalhes.');
  }
};

  const openEdit = (p: Product) => { setEditingProduct(p); setDialogOpen(true); };
  const openNew = () => { setEditingProduct(undefined); setDialogOpen(true); };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Produtos</h1>
          <p className="text-muted-foreground">{products.length} produtos cadastrados</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openNew} className="gold-gradient text-gold-foreground hover:opacity-90">
              <Plus className="w-4 h-4 mr-2" /> Novo Produto
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editingProduct ? 'Editar Produto' : 'Novo Produto'}</DialogTitle></DialogHeader>
            <ProductForm product={editingProduct} onSave={handleSave} onClose={() => setDialogOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input className="pl-10" placeholder="Buscar por nome ou categoria..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <div className="bg-card rounded-xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left p-4 text-sm font-medium text-muted-foreground">Produto</th>
                <th className="text-left p-4 text-sm font-medium text-muted-foreground">Categoria</th>
                <th className="text-right p-4 text-sm font-medium text-muted-foreground">Qtd</th>
                <th className="text-right p-4 text-sm font-medium text-muted-foreground">Preço</th>
                <th className="text-right p-4 text-sm font-medium text-muted-foreground">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p, i) => (
                <motion.tr key={p.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}
                  className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      {p.image_url && (
                        <img
                          src={p.image_url}
                          alt={p.name}
                          className="w-10 h-10 object-cover rounded"
                        />
                      )}
                      <div className="flex flex-col">
                        <p className="font-medium text-foreground">{p.name}</p>
                        {p.description && (
                          <p className="text-xs text-muted-foreground">{p.description}</p>
                        )}
                      </div>
                    </div>
                  </td>
                  
                  <td className="p-4 text-sm text-muted-foreground">{p.category || '—'}</td>
                  <td className="p-4 text-right">
                    <span className={`font-semibold ${p.quantity <= p.minStock ? 'text-destructive' : 'text-foreground'}`}>
                      {p.quantity}
                    </span>
                  </td>
                  <td className="p-4 text-right text-foreground">R$ {p.price.toLocaleString('pt-BR')}</td>
                  <td className="p-4 text-right">
                    <div className="flex gap-1 justify-end">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(p)}><Pencil className="w-4 h-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => deleteProduct(p.id)} className="text-destructive hover:text-destructive"><Trash2 className="w-4 h-4" /></Button>
                    </div>
                  </td>
                </motion.tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">Nenhum produto encontrado</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
