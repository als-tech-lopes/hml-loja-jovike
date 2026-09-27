import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Search, ShoppingCart, Plus, Minus, Trash2, Send, Gem, Loader2, LogIn, CalendarIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { compareProductSizes } from '@/lib/productSizes';

interface CatalogProduct {
  id: string;
  productCode: string;
  name: string;
  price: number;
  quantity: number;
  category: string;
  description: string;
  image_url?: string;
  variants: Array<{ id: string; variantCode: string; color: string; size: string; quantity: number; price: number; minStock: number; description: string }>;
  variantImages: Array<{ id: string; color: string; imageUrl: string; displayOrder: number }>;
}

interface CartItem {
  cartKey: string;
  productId: string;
  productCode: string;
  name: string;
  price: number;
  quantity: number;
  variantId?: string;
  color?: string;
  size?: string;
  availableQuantity: number;
}

function CatalogProductImage({ src, alt, priority }: { src?: string; alt: string; priority: boolean }) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setLoaded(false);
    setFailed(false);
  }, [src]);

  if (!src || failed) {
    return (
      <div className="aspect-[4/5] bg-muted flex items-center justify-center">
        <Gem className="w-12 h-12 text-accent opacity-40" />
      </div>
    );
  }

  const loading = priority ? 'eager' : 'lazy';
  const fetchPriority = priority ? 'high' : 'auto';

  return (
    <div className="relative aspect-[4/5] overflow-hidden bg-muted" aria-busy={!loaded}>
      {!loaded && <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-muted via-background/70 to-muted" />}
      <img
        src={src}
        alt={alt}
        width="800"
        height="800"
        loading={loading}
        decoding="async"
        fetchPriority={fetchPriority}
        draggable={false}
        onLoad={() => setLoaded(true)}
        onError={() => setFailed(true)}
        className={cn(
          'relative h-full w-full object-cover object-center transition-[opacity,transform] duration-500 ease-out group-hover:scale-[1.025]',
          loaded ? 'opacity-100' : 'opacity-0',
        )}
      />
    </div>
  );
}

export default function Catalog() {
  const navigate = useNavigate();
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [selectedVariants, setSelectedVariants] = useState<Record<string, { color?: string; size?: string }>>({});
  const [selectedImages, setSelectedImages] = useState<Record<string, string>>({});

  // Order fields
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [deliveryDate, setDeliveryDate] = useState<Date | undefined>();
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [orderNote, setOrderNote] = useState('');

  useEffect(() => {
    async function load() {
      const [{ data: prods }, { data: settings }] = await Promise.all([
        supabase.from('products').select('*, product_variants(*), product_variant_images(*)').order('name'),
        supabase.from('settings').select('*').eq('key', 'whatsapp_number').maybeSingle(),
      ]);
      if (prods) setProducts(prods.map(p => ({
        id: p.id, productCode: p.product_code, name: p.name, price: Number(p.price), quantity: p.quantity,
        category: p.category, description: p.description, image_url: p.image_url ?? undefined,
        variants: (p.product_variants || []).map(variant => ({
          id: variant.id, variantCode: variant.variant_code, color: variant.color, size: variant.size, quantity: variant.quantity,
          price: Number(variant.price), minStock: variant.min_stock, description: variant.description,
        })).sort((first, second) => first.color.localeCompare(second.color, 'pt-BR') || compareProductSizes(first.size, second.size)),
        variantImages: (p.product_variant_images || []).map(image => ({ id: image.id, color: image.color, imageUrl: image.image_url, displayOrder: image.display_order })).sort((a, b) => a.displayOrder - b.displayOrder),
      })).filter(product => product.variants.length > 0 ? product.variants.some(variant => variant.quantity > 0) : product.quantity > 0));
      if (settings) setWhatsappNumber(settings.value);
      setLoading(false);
    }
    load();
  }, []);

  const categories = useMemo(
    () => [...new Set(products.map(p => p.category).filter(Boolean))].sort((first, second) => first.localeCompare(second, 'pt-BR')),
    [products],
  );
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const filtered = products.filter(p => {
    const normalizedSearch = search.toLowerCase();
    const matchSearch = p.name.toLowerCase().includes(normalizedSearch) ||
      p.productCode.toLowerCase().includes(normalizedSearch) ||
      p.variants.some(variant => variant.variantCode.toLowerCase().includes(normalizedSearch) || variant.color.toLowerCase().includes(normalizedSearch) || variant.size.toLowerCase().includes(normalizedSearch));
    const matchCategory = !selectedCategory || p.category === selectedCategory;
    return matchSearch && matchCategory;
  });

  const addToCart = (product: CatalogProduct) => {
    const selection = selectedVariants[product.id];
    const variant = product.variants.length > 0
      ? product.variants.find(item => item.color === selection?.color && item.size === selection?.size)
      : undefined;
    if (product.variants.length > 0 && !variant) return;
    const cartKey = variant ? `${product.id}:${variant.id}` : product.id;
    const availableQuantity = variant?.quantity ?? product.quantity;
    setCart(prev => {
      const existing = prev.find(i => i.cartKey === cartKey);
      if (existing && existing.quantity >= availableQuantity) return prev;
      if (existing) {
        return prev.map(i => i.cartKey === cartKey ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, {
        cartKey, productId: product.id, productCode: variant?.variantCode ?? product.productCode, name: product.name,
        price: variant?.price ?? product.price, quantity: 1, variantId: variant?.id, color: variant?.color, size: variant?.size,
        availableQuantity,
      }];
    });
  };

  const updateCartQty = (cartKey: string, delta: number) => {
    setCart(prev => prev.map(i => {
      if (i.cartKey !== cartKey) return i;
      if (delta > 0 && i.quantity >= i.availableQuantity) return i;
      const newQty = i.quantity + delta;
      return newQty <= 0 ? i : { ...i, quantity: newQty };
    }).filter(i => i.quantity > 0));
  };

  const removeFromCart = (cartKey: string) => setCart(prev => prev.filter(i => i.cartKey !== cartKey));
  const cartTotal = cart.reduce((s, i) => s + i.quantity * i.price, 0);
  const cartCount = cart.reduce((s, i) => s + i.quantity, 0);

  const sendWhatsApp = () => {
    if (!whatsappNumber || cart.length === 0 || !clientName.trim() || !clientPhone.trim()) return;

    const itemsText = cart.map(i => `• ${i.name}${i.color ? ` — Cor: ${i.color}` : ''}${i.size ? ` — Tam: ${i.size}` : ''} x${i.quantity} — R$ ${(i.quantity * i.price).toLocaleString('pt-BR')}`).join('\n');

    let message = `🛍️ *Novo Pedido - JKB - OUTFIT*\n\n`;
    message += `*Cliente:* ${clientName.trim()}\n`;
    message += `*Telefone:* ${clientPhone.trim()}\n`;
    if (deliveryDate) message += `*Data de entrega:* ${format(deliveryDate, 'dd/MM/yyyy')}\n`;
    if (deliveryAddress.trim()) message += `*Endereço:* ${deliveryAddress.trim()}\n`;
    message += `\n*Itens:*\n${itemsText}\n\n`;
    message += `*Total: R$ ${cartTotal.toLocaleString('pt-BR')}*`;
    if (orderNote.trim()) message += `\n\n*Observação:* ${orderNote.trim()}`;
    message += `\n\nEnviado pelo catálogo online.`;

    const phone = whatsappNumber.replace(/\D/g, '');
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, '_blank');
  };

  const canSend = whatsappNumber && cart.length > 0 && clientName.trim() && clientPhone.trim();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-accent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg gold-gradient flex items-center justify-center">
              {/*<Gem className="w-5 h-5 text-primary" />*/}
              <img src="/logo_loja.jpg" alt="Logo" className="w-28 h-28 object-contain" />
            </div>
            <span className="font-display text-xl font-bold text-foreground">JKB OUTFIT</span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" className="relative" onClick={() => setCartOpen(true)}>
              <ShoppingCart className="w-4 h-4 mr-2" /> Carrinho
              {cartCount > 0 && (
                <Badge className="absolute -top-2 -right-2 h-5 w-5 p-0 flex items-center justify-center text-xs gold-gradient text-gold-foreground border-0">{cartCount}</Badge>
              )}
            </Button>
            <Button variant="ghost" size="icon" onClick={() => navigate('/')} title="Entrar no sistema">
              <LogIn className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6 sm:py-8 space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-display font-bold text-foreground">Nosso Catálogo</h1>
          <p className="text-muted-foreground">Escolha suas peças favoritas e envie seu pedido</p>
        </div>

        <div className="space-y-3">
          <div className="relative max-w-md mx-auto">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input className="pl-10" placeholder="Buscar produtos..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          {categories.length > 0 && (
            <div className="flex gap-2 justify-center flex-wrap">
              <Button variant={!selectedCategory ? 'default' : 'outline'} size="sm" onClick={() => setSelectedCategory(null)}>Todos</Button>
              {categories.map(cat => (
                <Button key={cat} variant={selectedCategory === cat ? 'default' : 'outline'} size="sm" onClick={() => setSelectedCategory(cat)}>{cat}</Button>
              ))}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4 min-[540px]:grid-cols-2 sm:gap-5 lg:grid-cols-3 xl:grid-cols-4">
          <AnimatePresence>
            {filtered.map((p, i) => {
              const selection = selectedVariants[p.id] || {};
              const colors = [...new Set(p.variants.filter(variant => variant.quantity > 0).map(variant => variant.color))];
              const sizes = [...new Set(p.variants.filter(variant => variant.color === selection.color && variant.quantity > 0).map(variant => variant.size))]
                .sort(compareProductSizes);
              const allSizes = [...new Set(p.variants.filter(variant => variant.quantity > 0).map(variant => variant.size))]
                .sort(compareProductSizes);
              const selectedVariant = p.variants.find(variant => variant.color === selection.color && variant.size === selection.size);
              const colorImages = p.variantImages.filter(image => image.color === selection.color);
              const displayedImage = selectedImages[p.id] || colorImages[0]?.imageUrl || p.image_url;
              const selectedCartKey = selectedVariant ? `${p.id}:${selectedVariant.id}` : p.id;
              const inCart = cart.find(c => c.cartKey === selectedCartKey);
              return (
                <motion.div key={p.id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ delay: Math.min(i, 6) * 0.04 }}
                  className="group overflow-hidden rounded-2xl border bg-card shadow-sm transition-[box-shadow,transform] duration-300 hover:-translate-y-0.5 hover:shadow-xl">
                  <CatalogProductImage
                    key={displayedImage || 'sem-imagem'}
                    src={displayedImage}
                    alt={`${p.name}${selection.color ? ` - ${selection.color}` : ''}`}
                    priority={i < 3}
                  />
                  <div className="p-4 space-y-3">
                    <div>
                      <h3 className="font-display font-semibold text-foreground">{p.name}</h3>
                      {p.category && <Badge variant="secondary" className="mt-1 text-xs">{p.category}</Badge>}
                      {(selectedVariant?.description || p.description) && <p className="text-xs text-muted-foreground mt-1">{selectedVariant?.description || p.description}</p>}
                    </div>
                    {p.variants.length > 0 && (
                      <div className="space-y-3">
                        <div className="rounded-lg border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                          <p><span className="font-semibold text-foreground">Cores:</span> {colors.join(' / ')}</p>
                          <p className="mt-1"><span className="font-semibold text-foreground">Tam.</span> {allSizes.join(' / ')}</p>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <span className="text-xs font-medium text-muted-foreground">Cor</span>
                            <Select value={selection.color || ''} onValueChange={color => {
                              setSelectedVariants(current => ({ ...current, [p.id]: { color, size: undefined } }));
                              const firstImage = p.variantImages.find(image => image.color === color)?.imageUrl;
                              setSelectedImages(current => ({ ...current, [p.id]: firstImage || p.image_url || '' }));
                            }}>
                              <SelectTrigger className="min-h-11"><SelectValue placeholder="Selecione" /></SelectTrigger>
                              <SelectContent>{colors.map(color => <SelectItem key={color} value={color}>{color}</SelectItem>)}</SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1">
                            <span className="text-xs font-medium text-muted-foreground">Tamanho</span>
                            <Select disabled={!selection.color} value={selection.size || ''} onValueChange={size => setSelectedVariants(current => ({ ...current, [p.id]: { ...current[p.id], size } }))}>
                              <SelectTrigger className="min-h-11"><SelectValue placeholder="Selecione" /></SelectTrigger>
                              <SelectContent>{sizes.map(size => <SelectItem key={size} value={size}>{size}</SelectItem>)}</SelectContent>
                            </Select>
                          </div>
                        </div>
                      </div>
                    )}
                    {colorImages.length > 1 && (
                      <div className="flex snap-x gap-2 overflow-x-auto pb-1">
                        {colorImages.map(image => (
                          <button key={image.id} type="button" onClick={() => setSelectedImages(current => ({ ...current, [p.id]: image.imageUrl }))} className={`h-16 w-16 shrink-0 snap-start overflow-hidden rounded-md border-2 ${displayedImage === image.imageUrl ? 'border-primary' : 'border-transparent'}`}>
                            <img src={image.imageUrl} alt={`${p.name} - ${image.color}`} loading="lazy" decoding="async" width="64" height="64" className="h-full w-full object-cover" />
                          </button>
                        ))}
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <span className="text-lg font-bold text-foreground">R$ {(selectedVariant?.price ?? p.price).toLocaleString('pt-BR')}</span>
                      {inCart ? (
                        <div className="flex items-center gap-2">
                          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => updateCartQty(inCart.cartKey, -1)}><Minus className="w-3 h-3" /></Button>
                          <span className="font-semibold text-foreground w-6 text-center">{inCart.quantity}</span>
                          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => updateCartQty(inCart.cartKey, 1)} disabled={inCart.quantity >= inCart.availableQuantity}><Plus className="w-3 h-3" /></Button>
                        </div>
                      ) : (
                        <Button size="sm" className="min-h-11 gold-gradient text-gold-foreground hover:opacity-90" onClick={() => addToCart(p)} disabled={p.variants.length > 0 && !selectedVariant}>
                          <Plus className="w-4 h-4 mr-1" /> Adicionar
                        </Button>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
        {filtered.length === 0 && <p className="text-center text-muted-foreground py-12">Nenhum produto encontrado</p>}
      </div>

      {/* Cart Sheet (sidebar) */}
      <Sheet open={cartOpen} onOpenChange={setCartOpen}>
        <SheetContent className="flex flex-col overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Seu Carrinho</SheetTitle>
            <SheetDescription>Revise seus itens e preencha os dados para enviar o pedido.</SheetDescription>
          </SheetHeader>
          {cart.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Carrinho vazio</p>
          ) : (
            <div className="space-y-4 flex-1">
              {/* Cart items */}
              <div className="divide-y rounded-lg border">
                {cart.map(item => (
                  <div key={item.cartKey} className="flex items-center justify-between p-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{item.name}</p>
                      {(item.color || item.size) && <p className="text-xs text-muted-foreground">{item.color && `Cor: ${item.color}`}{item.color && item.size && ' · '}{item.size && `Tam: ${item.size}`}</p>}
                      <p className="text-xs text-muted-foreground">R$ {item.price.toLocaleString('pt-BR')} un.</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => updateCartQty(item.cartKey, -1)}><Minus className="w-3 h-3" /></Button>
                      <span className="text-sm font-semibold w-5 text-center text-foreground">{item.quantity}</span>
                      <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => updateCartQty(item.cartKey, 1)} disabled={item.quantity >= item.availableQuantity}><Plus className="w-3 h-3" /></Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeFromCart(item.cartKey)}><Trash2 className="w-3 h-3" /></Button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-between font-semibold text-foreground text-lg">
                <span>Total</span>
                <span>R$ {cartTotal.toLocaleString('pt-BR')}</span>
              </div>

              {/* Order form */}
              <div className="space-y-3 border-t pt-4">
                <p className="text-sm font-medium text-foreground">Dados do pedido</p>
                <Input placeholder="Nome *" value={clientName} onChange={e => setClientName(e.target.value)} />
                <Input placeholder="Telefone *" value={clientPhone} onChange={e => setClientPhone(e.target.value)} />
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !deliveryDate && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {deliveryDate ? format(deliveryDate, 'dd/MM/yyyy') : 'Data de entrega (opcional)'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={deliveryDate} onSelect={setDeliveryDate} initialFocus className={cn("p-3 pointer-events-auto")} />
                  </PopoverContent>
                </Popover>
                <Input placeholder="Endereço de entrega (opcional)" value={deliveryAddress} onChange={e => setDeliveryAddress(e.target.value)} />
                <Textarea placeholder="Observação (opcional)" value={orderNote} onChange={e => setOrderNote(e.target.value)} rows={2} />
              </div>

              <Button className="w-full gold-gradient text-gold-foreground hover:opacity-90" onClick={sendWhatsApp} disabled={!canSend}>
                <Send className="w-4 h-4 mr-2" /> {whatsappNumber ? 'Enviar Pedido por WhatsApp' : 'WhatsApp não configurado'}
              </Button>
              {!whatsappNumber && <p className="text-xs text-destructive text-center">O administrador precisa configurar o número de WhatsApp nas configurações.</p>}
              {whatsappNumber && (!clientName.trim() || !clientPhone.trim()) && (
                <p className="text-xs text-muted-foreground text-center">Preencha nome e telefone para enviar.</p>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Mobile FAB */}
      {cartCount > 0 && (
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="fixed bottom-6 right-6 sm:hidden z-40">
          <Button size="lg" className="rounded-full gold-gradient text-gold-foreground shadow-lg h-14 w-14" onClick={() => setCartOpen(true)}>
            <ShoppingCart className="w-5 h-5" />
            <Badge className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-xs bg-destructive text-destructive-foreground border-0">{cartCount}</Badge>
          </Button>
        </motion.div>
      )}
    </div>
  );
}
