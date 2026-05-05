import { useState, useEffect } from 'react';
import { useSettings } from '@/contexts/SettingsContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Save, MessageCircle, ExternalLink, Loader2, Copy, Share2, BookOpen } from 'lucide-react';

export default function CatalogManagement() {
  const { whatsappNumber, setWhatsappNumber } = useSettings();
  const [phone, setPhone] = useState(whatsappNumber);
  const [saving, setSaving] = useState(false);

  useEffect(() => { setPhone(whatsappNumber); }, [whatsappNumber]);

  const catalogUrl = `${window.location.origin}/catalogo`;

  const handleSave = async () => {
    setSaving(true);
    await setWhatsappNumber(phone);
    toast.success('Configurações do catálogo salvas!');
    setSaving(false);
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(catalogUrl);
    toast.success('Link copiado para a área de transferência!');
  };

  const handleShare = async () => {
    if (navigator.share) {
      await navigator.share({ title: 'Catálogo Online', url: catalogUrl });
    } else {
      handleCopyLink();
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-3xl font-display font-bold text-foreground flex items-center gap-2">
          <BookOpen className="w-8 h-8 text-accent" />
          Catálogo Online
        </h1>
        <p className="text-muted-foreground mt-1">Gerencie o catálogo público e o número de WhatsApp para pedidos.</p>
      </div>

      {/* WhatsApp */}
      <div className="bg-card rounded-xl border p-6 space-y-4">
        <div className="flex items-center gap-2">
          <MessageCircle className="w-5 h-5 text-accent" />
          <h2 className="text-lg font-semibold text-foreground">WhatsApp para Pedidos</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Número de WhatsApp que receberá os pedidos do catálogo online. Use o formato com código do país (ex: 5511999999999).
        </p>
        <div className="space-y-2">
          <Label>Número do WhatsApp</Label>
          <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="5511999999999" />
        </div>
        <div className="flex justify-end">
          <Button onClick={handleSave} className="gold-gradient text-gold-foreground hover:opacity-90" disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />} Salvar
          </Button>
        </div>
      </div>

      {/* Link do catálogo */}
      <div className="bg-card rounded-xl border p-6 space-y-4">
        <div className="flex items-center gap-2">
          <ExternalLink className="w-5 h-5 text-accent" />
          <h2 className="text-lg font-semibold text-foreground">Link do Catálogo</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Compartilhe este link com seus clientes para que possam visualizar os produtos e fazer pedidos.
        </p>
        <div className="flex items-center gap-2">
          <Input value={catalogUrl} readOnly className="bg-muted" />
          <Button variant="outline" size="icon" onClick={handleCopyLink} title="Copiar link">
            <Copy className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={handleShare} title="Compartilhar">
            <Share2 className="w-4 h-4" />
          </Button>
        </div>
        <a href="/catalogo" target="_blank" rel="noopener noreferrer" className="text-sm text-accent hover:underline inline-flex items-center gap-1">
          <ExternalLink className="w-3 h-3" /> Abrir catálogo online
        </a>
      </div>
    </div>
  );
}
