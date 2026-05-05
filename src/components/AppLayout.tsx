import React from 'react';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AppSidebar';
import { useAuth } from '@/contexts/AuthContext';
import { AlertTriangle } from 'lucide-react';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { trialInfo, user } = useAuth();
  const showTrialBanner = trialInfo && user?.role !== 'super_admin' && trialInfo.days_remaining !== null && trialInfo.days_remaining <= 3;

  const trialMessage = trialInfo?.days_remaining !== null && trialInfo?.days_remaining !== undefined
    ? trialInfo.days_remaining < 0
      ? 'Seu período de demonstração foi encerrado. Escolha um plano para continuar.'
      : trialInfo.days_remaining === 0
        ? 'Seu período de demonstração termina hoje.'
        : trialInfo.days_remaining === 1
          ? 'Seu período de demonstração termina amanhã.'
          : `Seu período de demonstração termina em ${trialInfo.days_remaining} dias.`
    : '';

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          {showTrialBanner && (
            <div className={`px-4 py-2 text-sm font-medium flex items-center gap-2 ${trialInfo.days_remaining! < 0 ? 'bg-destructive text-destructive-foreground' : 'bg-accent text-accent-foreground'}`}>
              <AlertTriangle className="w-4 h-4 shrink-0" />
              {trialMessage}
            </div>
          )}
          <header className="h-14 flex items-center border-b bg-card px-4">
            <SidebarTrigger />
          </header>
          <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-auto">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}