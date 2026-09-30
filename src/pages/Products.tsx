import { useRef, useState } from 'react';
import { useStock, Product } from '@/contexts/StockContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Loader2, Plus, Search, Pencil, Trash2, X } from 'lucide-react';
import { motion } from 'framer-motion';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { orderProductSizes, STANDARD_PRODUCT_SIZES } from '@/lib/productSizes';

const PRODUCT_CATEGORIES = [
  'Bermuda',
  'Boné',
  'Calças',
  'Short',
  'Camisas',
  'Regata',
  'Carteira',
  'Casacos',
  'Calçados',
  'Cintos',
  'Conjuntos',
  'Cordões',
  'Cuecas',
  'Bolsas',
  'Óculos',
  'Perfumes',
  'Relógio',
];
const CUSTOM_CATEGORY_VALUE = '__custom_category__';
const MAX_PRODUCT_IMAGE_DIMENSION = 1600;
const PRODUCT_IMAGE_QUALITY = 0.82;

function formatProductName(value: string) {
  const cleanedName = value.trim().replace(/\s+/g, ' ').toLocaleLowerCase('pt-BR');
  return cleanedName.replace(/(^|[\s'’/-])(\p{L})/gu, (_, separator: string, letter: string) => `${separator}${letter.toLocaleUpperCase('pt-BR')}`);
}

function productNameKey(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
    .replace(/[^a-z0-9]/g, '');
}

async function optimizeProductImage(file: File) {
  if (!file.type.startsWith('image/') || ['image/gif', 'image/svg+xml'].includes(file.type) || typeof createImageBitmap !== 'function') {
    return file;
  }

  try {
    const bitmap = await createImageBitmap(file);
    const largestDimension = Math.max(bitmap.width, bitmap.height);
    const scale = Math.min(1, MAX_PRODUCT_IMAGE_DIMENSION / largestDimension);
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext('2d');

    if (!context) {
      bitmap.close();
      return file;
    }

    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();

    const optimizedBlob = await new Promise<Blob | null>(resolve => {
      canvas.toBlob(resolve, 'image/webp', PRODUCT_IMAGE_QUALITY);
    });
    if (!optimizedBlob || (optimizedBlob.size >= file.size && scale === 1)) return file;

    const baseName = file.name.replace(/\.[^.]+$/, '') || 'produto';
    return new File([optimizedBlob], `${baseName}.webp`, { type: 'image/webp', lastModified: Date.now() });
  } catch {
    return file;
  }
}

interface ColorDraft {
  id: string;
  name: string;
  sizes: string[];
  customSize: string;
  existingImages: string[];
  files: File[];
}

interface VariantOverride {
  id?: string;
  variantCode?: string;
  customized: boolean;
  quantity: string;
  price: string;
  minStock: string;
  description: string;
}

let colorDraftSequence = 0;
const createColorDraftId = () => `color-${++colorDraftSequence}`;
const normalizedOption = (value: string) => value.trim().toLocaleLowerCase('pt-BR');
const variantKey = (colorId: string, size: string) => `${colorId}::${normalizedOption(size)}`;

function createInitialColors(product?: Product): ColorDraft[] {
  const colorNames = [...new Set([
    ...(product?.variants.map(variant => variant.color) || []),
    ...(product?.variantImages.map(image => image.color) || []),
  ])];

  return colorNames.map(name => ({
    id: createColorDraftId(),
    name,
    sizes: [...new Set(product?.variants
      .filter(variant => normalizedOption(variant.color) === normalizedOption(name))
      .map(variant => variant.size) || [])],
    customSize: '',
    existingImages: product?.variantImages
      .filter(image => normalizedOption(image.color) === normalizedOption(name))
      .map(image => image.imageUrl) || [],
    files: [],
  }));
}

function ProductForm({ product, onSave, onClose, isSaving }: { product?: Product; onSave: (data: any) => Promise<void>; onClose: () => void; isSaving: boolean }) {
  const initialCategory = product?.category?.trim() || '';
  const [name, setName] = useState(product?.name || '');
  const [quantity, setQuantity] = useState(product?.variants[0]?.quantity?.toString() || product?.quantity?.toString() || '');
  const [purchasePrice, setPurchasePrice] = useState(product?.purchasePrice?.toString() || '');
  const [price, setPrice] = useState(product?.price?.toString() || '');
  const [category, setCategory] = useState(initialCategory);
  const [customCategory, setCustomCategory] = useState(Boolean(initialCategory && !PRODUCT_CATEGORIES.includes(initialCategory)));
  const [description, setDescription] = useState(product?.description || '');
  const [minStock, setMinStock] = useState(product?.variants[0]?.minStock?.toString() || product?.minStock?.toString() || '5');
  const [file, setFile] = useState<File | null>(null);
  const [usesVariations, setUsesVariations] = useState(Boolean(product?.variants.length || product?.variantImages.length));
  const [colors, setColors] = useState<ColorDraft[]>(() => createInitialColors(product));
  const [addingColor, setAddingColor] = useState(false);
  const [newColorName, setNewColorName] = useState('');
  const [openColorIds, setOpenColorIds] = useState<Set<string>>(() => new Set(colors.length === 1 ? colors.map(color => color.id) : []));
  const [variantOverrides, setVariantOverrides] = useState<Record<string, VariantOverride>>(() => Object.fromEntries(
    (product?.variants || []).map(variant => {
      const color = colors.find(item => normalizedOption(item.name) === normalizedOption(variant.color));
      return [variantKey(color?.id || variant.color, variant.size), {
        id: variant.id,
        variantCode: variant.variantCode,
        customized: variant.quantity !== (product?.variants[0]?.quantity ?? product?.quantity) ||
          variant.price !== product?.price || variant.minStock !== (product?.variants[0]?.minStock ?? product?.minStock) ||
          variant.description !== product?.description,
        quantity: variant.quantity.toString(), price: variant.price.toString(), minStock: variant.minStock.toString(), description: variant.description,
      }];
    }),
  ));

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;
    const formattedName = formatProductName(name);
    if (!formattedName) {
      toast.error('Informe o nome do produto.');
      return;
    }
    if (newColorName.trim()) {
      toast.error('Confirme a nova cor clicando em Adicionar ou pressionando Enter.');
      return;
    }
    const completedColors = usesVariations
      ? colors.map(color => ({ ...color, name: color.name.trim(), sizes: orderProductSizes(color.sizes.map(size => size.trim()).filter(Boolean)) }))
      : [];
    if (usesVariations && completedColors.length === 0) {
      toast.error('Adicione pelo menos uma cor para o produto com variações.');
      return;
    }
    if (completedColors.some(color => !color.name)) {
      toast.error('Informe o nome de todas as cores.');
      return;
    }
    if (new Set(completedColors.map(color => normalizedOption(color.name))).size !== completedColors.length) {
      toast.error('Não é possível repetir a mesma cor.');
      return;
    }
    if (completedColors.some(color => color.sizes.length === 0)) {
      toast.error('Selecione pelo menos um tamanho para cada cor.');
      return;
    }
    if (completedColors.some(color => new Set(color.sizes.map(normalizedOption)).size !== color.sizes.length)) {
      toast.error('Não é possível repetir tamanhos dentro da mesma cor.');
      return;
    }
    const completedVariants = completedColors.flatMap(color => color.sizes.map(size => {
      const override = variantOverrides[variantKey(color.id, size)];
      return {
        id: override?.id,
        variantCode: override?.variantCode,
        color: color.name,
        size,
        quantity: Number(override?.customized ? override.quantity : quantity),
        price: Number(override?.customized ? override.price : price),
        minStock: Number(override?.customized ? override.minStock : minStock),
        description: override?.customized ? override.description.trim() : description.trim(),
      };
    }));
    if (completedVariants.some(variant => variant.quantity < 0 || variant.price < 0 || variant.minStock < 0 || !Number.isInteger(variant.quantity) || !Number.isFinite(variant.price) || !Number.isInteger(variant.minStock))) {
      toast.error('Revise os valores de quantidade, preço e estoque mínimo das variações.');
      return;
    }
    if (!Number.isInteger(Number(quantity)) || Number(quantity) < 0 || !Number.isInteger(Number(minStock)) || Number(minStock) < 0 || !Number.isFinite(Number(purchasePrice)) || Number(purchasePrice) < 0 || !Number.isFinite(Number(price)) || Number(price) < 0) {
      toast.error('Revise os valores de compra e venda do produto.');
      return;
    }
    await onSave({
      name: formattedName,
      quantity: completedVariants.length > 0 ? completedVariants.reduce((sum, variant) => sum + variant.quantity, 0) : Number(quantity),
      purchasePrice: Number(purchasePrice),
      price: Number(price), 
      category: category.trim(), description,
      minStock: completedVariants.length > 0 ? completedVariants.reduce((sum, variant) => sum + variant.minStock, 0) : Number(minStock),
      file,
      variants: completedVariants,
      colors: completedColors });
    //onClose();
  };

  const generatedCombinations = usesVariations
    ? colors.flatMap(color => orderProductSizes(color.sizes).map(size => ({ color: color.name.trim() || 'Cor sem nome', size, key: variantKey(color.id, size) })))
    : [];

  const updateColor = (colorId: string, update: Partial<ColorDraft>) => {
    setColors(current => current.map(color => color.id === colorId ? { ...color, ...update } : color));
  };

  const addColor = () => {
    const colorName = newColorName.trim();
    if (!colorName) {
      toast.error('Informe o nome da cor.');
      return;
    }
    if (colors.some(color => normalizedOption(color.name) === normalizedOption(colorName))) {
      toast.error(`A cor "${colorName}" já foi adicionada.`);
      return;
    }

    const colorId = createColorDraftId();
    setColors(current => [{
      id: colorId, name: colorName, sizes: [], customSize: '', existingImages: [], files: [],
    }, ...current]);
    setOpenColorIds(current => new Set(current).add(colorId));
    setNewColorName('');
    setAddingColor(false);
  };

  const toggleSize = (color: ColorDraft, size: string, checked: boolean) => {
    const exists = color.sizes.some(item => normalizedOption(item) === normalizedOption(size));
    if (checked && !exists) updateColor(color.id, { sizes: [...color.sizes, size] });
    if (!checked && exists) updateColor(color.id, { sizes: color.sizes.filter(item => normalizedOption(item) !== normalizedOption(size)) });
  };

  const addCustomSize = (color: ColorDraft) => {
    const value = color.customSize.trim();
    if (!value) return;
    if (color.sizes.some(size => normalizedOption(size) === normalizedOption(value))) {
      toast.error(`O tamanho "${value}" já foi adicionado nesta cor.`);
      return;
    }
    updateColor(color.id, { sizes: [...color.sizes, value], customSize: '' });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {product && (
        <div className="space-y-2"><Label>Código</Label><Input value={product.productCode} readOnly className="bg-muted font-mono" /></div>
      )}
      <div className="space-y-2">
        <Label>Nome *</Label>
        <Input
          value={name}
          onChange={event => setName(event.target.value)}
          onBlur={() => setName(current => formatProductName(current))}
          placeholder="Ex: Camisa Polo"
          required
        />
        <p className="text-xs text-muted-foreground">O nome será padronizado e comparado sem diferenciar acentos, espaços, pontuação ou letras maiúsculas.</p>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="space-y-2"><Label>Quantidade *</Label><Input type="number" min="0" value={quantity} onChange={e => setQuantity(e.target.value)} required /></div>
        <div className="space-y-2"><Label>Valor de compra (R$) *</Label><Input type="number" min="0" step="0.01" value={purchasePrice} onChange={e => setPurchasePrice(e.target.value)} required /></div>
        <div className="space-y-2"><Label>Valor de venda (R$) *</Label><Input type="number" min="0" step="0.01" value={price} onChange={e => setPrice(e.target.value)} required /></div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Categoria</Label>
          <Select value={customCategory ? CUSTOM_CATEGORY_VALUE : category} onValueChange={value => {
            if (value === CUSTOM_CATEGORY_VALUE) {
              setCustomCategory(true);
              if (PRODUCT_CATEGORIES.includes(category)) setCategory('');
              return;
            }
            setCustomCategory(false);
            setCategory(value);
          }}>
            <SelectTrigger><SelectValue placeholder="Selecione uma categoria" /></SelectTrigger>
            <SelectContent>
              {PRODUCT_CATEGORIES.map(option => <SelectItem key={option} value={option}>{option}</SelectItem>)}
              <SelectItem value={CUSTOM_CATEGORY_VALUE}>Personalizar...</SelectItem>
            </SelectContent>
          </Select>
          {customCategory && <Input value={category} onChange={event => setCategory(event.target.value)} placeholder="Digite a categoria personalizada" autoFocus />}
        </div>
        <div className="space-y-2"><Label>Estoque mínimo padrão</Label><Input type="number" min="0" value={minStock} onChange={e => setMinStock(e.target.value)} /></div>
      </div>
      <div className="space-y-2"><Label>Descrição padrão</Label>
      <Input value={description} onChange={e => setDescription(e.target.value)} />
      </div>

      <div className="rounded-lg border p-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <Label htmlFor="uses-variations">Cadastrar cores e tamanhos</Label>
            <p className="mt-1 text-xs text-muted-foreground">Ative somente quando o produto possuir variações.</p>
          </div>
          <Switch id="uses-variations" checked={usesVariations} onCheckedChange={setUsesVariations} />
        </div>
      </div>

      {usesVariations && (
        <div className="space-y-3 rounded-lg border p-4">
          <div className="flex items-center justify-between gap-2">
            <div><Label>Cores e tamanhos</Label><p className="mt-1 text-xs text-muted-foreground">Cada cor possui apenas os tamanhos selecionados dentro dela.</p></div>
            {!addingColor && (
              <Button type="button" variant="outline" size="sm" onClick={() => setAddingColor(true)}><Plus className="mr-1 h-4 w-4" /> Cor</Button>
            )}
          </div>
          {addingColor && (
            <div className="flex items-end gap-2 rounded-lg border bg-background p-3">
              <div className="flex-1 space-y-1">
                <Label htmlFor="new-color-name" className="text-xs">Nova cor *</Label>
                <Input
                  id="new-color-name"
                  value={newColorName}
                  onChange={event => setNewColorName(event.target.value)}
                  onKeyDown={event => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      addColor();
                    }
                    if (event.key === 'Escape') {
                      setNewColorName('');
                      setAddingColor(false);
                    }
                  }}
                  placeholder="Ex: Preto"
                  autoFocus
                />
              </div>
              <Button type="button" variant="outline" onClick={addColor}>Adicionar</Button>
              <Button type="button" variant="ghost" size="icon" aria-label="Cancelar nova cor" onClick={() => { setNewColorName(''); setAddingColor(false); }}><X className="h-4 w-4" /></Button>
            </div>
          )}
          {colors.map((color, index) => (
            <details
              key={color.id}
              open={openColorIds.has(color.id)}
              onToggle={event => {
                const isOpen = event.currentTarget.open;
                setOpenColorIds(current => {
                  if (current.has(color.id) === isOpen) return current;
                  const next = new Set(current);
                  if (isOpen) next.add(color.id);
                  else next.delete(color.id);
                  return next;
                });
              }}
              className="rounded-lg border bg-muted/30"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-3">
                <span className="font-medium">{color.name.trim() || `Nova cor ${index + 1}`}</span>
                <span className="text-xs text-muted-foreground">{color.sizes.length} {color.sizes.length === 1 ? 'tamanho' : 'tamanhos'}</span>
              </summary>
              <div className="space-y-4 border-t p-3">
                <div className="flex gap-2">
                  <div className="flex-1 space-y-1"><Label className="text-xs">Cor *</Label><Input value={color.name} onChange={event => updateColor(color.id, { name: event.target.value })} placeholder="Ex: Preto" /></div>
                  <Button type="button" variant="ghost" size="icon" className="mt-5" aria-label={`Remover cor ${color.name || index + 1}`} onClick={() => setColors(current => current.filter(item => item.id !== color.id))}><Trash2 className="h-4 w-4" /></Button>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs">Tamanhos desta cor *</Label>
                  <div className="flex flex-wrap gap-4">
                    {STANDARD_PRODUCT_SIZES.map(size => (
                      <label key={size} className="flex cursor-pointer items-center gap-2 text-sm">
                        <Checkbox checked={color.sizes.some(item => normalizedOption(item) === normalizedOption(size))} onCheckedChange={checked => toggleSize(color, size, checked === true)} />
                        {size}
                      </label>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Input value={color.customSize} onChange={event => updateColor(color.id, { customSize: event.target.value })} onKeyDown={event => {
                      if (event.key === 'Enter') { event.preventDefault(); addCustomSize(color); }
                    }} placeholder="Outro tamanho: 34, XG, Único..." />
                    <Button type="button" variant="outline" onClick={() => addCustomSize(color)}>Adicionar</Button>
                  </div>
                  {color.sizes.length > 0 && <div className="flex flex-wrap gap-2">{orderProductSizes(color.sizes).map(size => <span key={normalizedOption(size)} className="inline-flex items-center gap-1 rounded-full bg-background px-3 py-1 text-sm">{size}<button type="button" onClick={() => toggleSize(color, size, false)} aria-label={`Remover tamanho ${size} da cor ${color.name}`}><X className="h-3 w-3" /></button></span>)}</div>}
                </div>

                <div className="space-y-2">
                  <Label className="text-xs">Imagens desta cor (opcional)</Label>
                  <Input type="file" accept="image/*" multiple onChange={event => {
                    const files = Array.from(event.target.files || []);
                    updateColor(color.id, { files: [...color.files, ...files] });
                    event.target.value = '';
                  }} />
                  {(color.existingImages.length > 0 || color.files.length > 0) && (
                    <div className="flex flex-wrap gap-2">
                      {color.existingImages.map(imageUrl => <div key={imageUrl} className="relative"><img src={imageUrl} alt={color.name} className="h-20 w-20 rounded-md object-cover" /><button type="button" className="absolute -right-1 -top-1 rounded-full bg-destructive text-destructive-foreground" onClick={() => updateColor(color.id, { existingImages: color.existingImages.filter(url => url !== imageUrl) })}><X className="h-4 w-4" /></button></div>)}
                      {color.files.map((imageFile, fileIndex) => <div key={`${imageFile.name}-${fileIndex}`} className="relative"><img src={URL.createObjectURL(imageFile)} alt={color.name} className="h-20 w-20 rounded-md object-cover" /><button type="button" className="absolute -right-1 -top-1 rounded-full bg-destructive text-destructive-foreground" onClick={() => updateColor(color.id, { files: color.files.filter((_, imageIndex) => imageIndex !== fileIndex) })}><X className="h-4 w-4" /></button></div>)}
                    </div>
                  )}
                </div>
              </div>
            </details>
          ))}
          {colors.length === 0 && <p className="rounded-md bg-muted/40 p-3 text-sm text-muted-foreground">Adicione uma cor e selecione seus tamanhos.</p>}
        </div>
      )}

      {generatedCombinations.length > 0 && (
        <div className="space-y-3 rounded-lg border p-4">
          <div>
            <Label>Combinações geradas ({generatedCombinations.length})</Label>
            <p className="text-xs text-muted-foreground mt-1">Cada combinação recebe uma ramificação única do código principal. Abra e personalize somente as exceções.</p>
          </div>
          <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
            {generatedCombinations.map(combination => {
              const override = variantOverrides[combination.key];
              const customized = override?.customized === true;
              return (
                <details key={combination.key} className="rounded-lg border bg-background">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-3">
                    <span className="font-medium text-sm">{combination.color} — {combination.size}</span>
                    <span className="text-right text-xs text-muted-foreground">
                      <span className="block font-mono">{override?.variantCode || 'Subcódigo gerado ao salvar'}</span>
                      <span>{customized ? 'Personalizada' : `Padrão · ${quantity} un. · R$ ${Number(price || 0).toLocaleString('pt-BR')}`}</span>
                    </span>
                  </summary>
                  <div className="space-y-3 border-t p-3">
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <Checkbox checked={customized} onCheckedChange={checked => setVariantOverrides(current => ({
                        ...current,
                        [combination.key]: {
                          id: current[combination.key]?.id,
                          variantCode: current[combination.key]?.variantCode,
                          customized: checked === true,
                          quantity: current[combination.key]?.quantity ?? quantity,
                          price: current[combination.key]?.price ?? price,
                          minStock: current[combination.key]?.minStock ?? minStock,
                          description: current[combination.key]?.description ?? description,
                        },
                      }))} />
                      Usar valores específicos nesta variação
                    </label>
                    {customized && (
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1"><Label className="text-xs">Quantidade</Label><Input type="number" min="0" value={override.quantity} onChange={event => setVariantOverrides(current => ({ ...current, [combination.key]: { ...current[combination.key], quantity: event.target.value } }))} /></div>
                        <div className="space-y-1"><Label className="text-xs">Preço (R$)</Label><Input type="number" min="0" step="0.01" value={override.price} onChange={event => setVariantOverrides(current => ({ ...current, [combination.key]: { ...current[combination.key], price: event.target.value } }))} /></div>
                        <div className="space-y-1"><Label className="text-xs">Estoque mínimo</Label><Input type="number" min="0" value={override.minStock} onChange={event => setVariantOverrides(current => ({ ...current, [combination.key]: { ...current[combination.key], minStock: event.target.value } }))} /></div>
                        <div className="space-y-1"><Label className="text-xs">Descrição</Label><Input value={override.description} onChange={event => setVariantOverrides(current => ({ ...current, [combination.key]: { ...current[combination.key], description: event.target.value } }))} /></div>
                      </div>
                    )}
                  </div>
                </details>
              );
            })}
          </div>
        </div>
      )}

     
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
        <Button type="button" variant="ghost" onClick={onClose} disabled={isSaving}>Cancelar</Button>
        <Button type="submit" className="gold-gradient text-gold-foreground hover:opacity-90" disabled={isSaving}>
          {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {isSaving ? 'Salvando...' : 'Salvar'}
        </Button>
      </div>
    </form>
  );
}

export default function Products() {
  const { products, addProduct, updateProduct, deleteProduct } = useStock();
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | undefined>();
  const [deletingProductId, setDeletingProductId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const saveInProgressRef = useRef(false);
  const [searchParams] = useSearchParams();

  const isNewFromDashboard = searchParams.get('new') === '1';
  const [showNew] = useState(isNewFromDashboard);

  const handleDeleteProduct = async (product: Product) => {
    if (!window.confirm(`Excluir o produto "${product.name}"? Esta ação não poderá ser desfeita.`)) return;

    setDeletingProductId(product.id);
    try {
      await deleteProduct(product.id);
      toast.success('Produto excluído com sucesso.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível excluir o produto.');
    } finally {
      setDeletingProductId(null);
    }
  };

  const filtered = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.category.toLowerCase().includes(search.toLowerCase()) ||
    p.productCode.toLowerCase().includes(search.trim().toLowerCase()) ||
    p.variants.some(variant => variant.variantCode?.toLowerCase().includes(search.trim().toLowerCase()) || variant.color.toLowerCase().includes(search.toLowerCase()) || variant.size.toLowerCase().includes(search.toLowerCase()))
  );

const handleSave = async (data: any) => {
  if (saveInProgressRef.current) return;
  saveInProgressRef.current = true;
  setIsSaving(true);

  try {
    if (!import.meta.env.VITE_SUPABASE_URL) {
      throw new Error('Configuração do backend ausente (SUPABASE_URL).');
    }

    const normalizedName = formatProductName(data.name);
    const { data: existingProducts, error: nameLookupError } = await supabase
      .from('products')
      .select('id, name');
    if (nameLookupError) throw new Error(`Falha ao validar o nome do produto: ${nameLookupError.message}`);

    const duplicatedProduct = existingProducts?.find(existing =>
      existing.id !== editingProduct?.id && productNameKey(existing.name) === productNameKey(normalizedName),
    );
    if (duplicatedProduct) {
      throw new Error(`Já existe um produto cadastrado com o nome "${duplicatedProduct.name}".`);
    }

    let imageUrl: string | null = editingProduct?.image_url ?? null;
    const uploadProductImage = async (file: File) => {
      const optimizedFile = await optimizeProductImage(file);
      const fileExt = optimizedFile.name.split('.').pop() || 'webp';
      const fileName = `${crypto.randomUUID()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage
        .from('products')
        .upload(fileName, optimizedFile, { cacheControl: '31536000', contentType: optimizedFile.type, upsert: false });
      if (uploadError) {
        throw new Error(uploadError.message.toLowerCase().includes('not found')
          ? 'Bucket "products" não encontrado.'
          : `Falha no upload da imagem: ${uploadError.message}`);
      }
      const { data: publicUrl } = supabase.storage
        .from('products')
        .getPublicUrl(fileName);
      if (!publicUrl?.publicUrl) throw new Error('Não foi possível gerar a URL pública da imagem.');
      return publicUrl.publicUrl;
    };

    const [uploadedMainImage, uploadedColorImages] = await Promise.all([
      data.file ? uploadProductImage(data.file) : Promise.resolve(null),
      Promise.all((data.colors as ColorDraft[]).map(async color => ({
        color: color.name,
        urls: [...color.existingImages, ...await Promise.all(color.files.map(uploadProductImage))],
      }))),
    ]);
    if (uploadedMainImage) imageUrl = uploadedMainImage;

    const variantImages: Array<{ color: string; imageUrl: string; displayOrder: number }> = uploadedColorImages
      .flatMap(({ color, urls }) => urls.map((imageUrl, displayOrder) => ({ color, imageUrl, displayOrder })));
    if (!imageUrl && variantImages.length > 0) imageUrl = variantImages[0].imageUrl;

    const productData = {
      name: normalizedName,
      quantity: data.quantity,
      purchasePrice: data.purchasePrice,
      price: data.price,
      category: data.category,
      description: data.description,
      minStock: data.minStock,
      image_url: imageUrl,
      variants: data.variants,
      variantImages,
    };

    if (editingProduct) {
      await updateProduct(editingProduct.id, productData);
      toast.success('Produto atualizado com sucesso.');
    } else {
      const createdProduct = await addProduct(productData);
      toast.success(`Produto ${createdProduct.productCode} cadastrado com sucesso.`);
    }

    setEditingProduct(undefined);
    setDialogOpen(false);

  } catch (error) {
    console.error('Erro ao salvar produto:', error);
    toast.error(error instanceof Error ? error.message : 'Erro ao salvar produto.');
  } finally {
    saveInProgressRef.current = false;
    setIsSaving(false);
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
        <Dialog open={dialogOpen} onOpenChange={open => { if (!isSaving) setDialogOpen(open); }}>
          <DialogTrigger asChild>
            <Button onClick={openNew} className="gold-gradient text-gold-foreground hover:opacity-90">
              <Plus className="w-4 h-4 mr-2" /> Novo Produto
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{editingProduct ? 'Editar Produto' : 'Novo Produto'}</DialogTitle></DialogHeader>
            <ProductForm product={editingProduct} onSave={handleSave} onClose={() => setDialogOpen(false)} isSaving={isSaving} />
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input className="pl-10" placeholder="Buscar por código, nome ou categoria..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <div className="bg-card rounded-xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left p-4 text-sm font-medium text-muted-foreground">Produto</th>
                <th className="text-left p-4 text-sm font-medium text-muted-foreground">Código</th>
                <th className="text-left p-4 text-sm font-medium text-muted-foreground">Categoria</th>
                <th className="text-left p-4 text-sm font-medium text-muted-foreground">Variações</th>
                <th className="text-right p-4 text-sm font-medium text-muted-foreground">Estoque total</th>
                <th className="text-right p-4 text-sm font-medium text-muted-foreground">Compra</th>
                <th className="text-right p-4 text-sm font-medium text-muted-foreground">Venda</th>
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
                  
                  <td className="p-4 text-sm font-mono font-medium text-foreground whitespace-nowrap">{p.productCode}</td>
                  <td className="p-4 text-sm text-muted-foreground">{p.category || '—'}</td>
                  <td className="p-4 text-sm text-muted-foreground">
                    {p.variants.length > 0 ? (
                      <div className="space-y-1">
                        {p.variants.map(variant => (
                          <div key={variant.id || `${variant.color}:${variant.size}`} className="whitespace-nowrap">
                            <span className="mr-2 font-mono text-xs text-foreground">{variant.variantCode}</span>
                            <span>{variant.color}/{variant.size}</span>
                            <span className="ml-2 text-xs">{variant.quantity} un.</span>
                          </div>
                        ))}
                      </div>
                    ) : '—'}
                  </td>
                  <td className="p-4 text-right">
                    <span className={`font-semibold ${p.quantity <= p.minStock ? 'text-destructive' : 'text-foreground'}`}>
                      {p.quantity}
                    </span>
                  </td>
                  <td className="p-4 text-right text-muted-foreground">R$ {p.purchasePrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                  <td className="p-4 text-right text-foreground">R$ {p.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                  <td className="p-4 text-right">
                    <div className="flex gap-1 justify-end">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(p)}><Pencil className="w-4 h-4" /></Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteProduct(p)}
                        className="text-destructive hover:text-destructive"
                        disabled={deletingProductId === p.id}
                        title={`Excluir ${p.name}`}
                      >
                        {deletingProductId === p.id
                          ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                          : <Trash2 className="w-4 h-4" />}
                      </Button>
                    </div>
                  </td>
                </motion.tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={8} className="p-8 text-center text-muted-foreground">Nenhum produto encontrado</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
