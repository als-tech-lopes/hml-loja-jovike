import { Button } from '@/components/ui/button';
import { Settings as SettingsIcon } from 'lucide-react';

export default function Settings() {
  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-3xl font-display font-bold text-foreground">Configurações</h1>
        <p className="text-muted-foreground">Ajustes gerais do sistema</p>
      </div>

      <div className="bg-card rounded-xl border p-6 space-y-4">
        <div className="flex items-center gap-2">
          <SettingsIcon className="w-5 h-5 text-accent" />
          <h2 className="text-lg font-semibold text-foreground">Configurações Gerais</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          As configurações do catálogo e WhatsApp foram movidas para o módulo <strong>Catálogo</strong> no menu lateral.
        </p>
      </div>
    </div>
  );
}
