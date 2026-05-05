import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface SettingsContextType {
  whatsappNumber: string;
  setWhatsappNumber: (n: string) => Promise<void>;
  loading: boolean;
}

const SettingsContext = createContext<SettingsContextType | null>(null);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [whatsappNumber, setWhatsappNumberState] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from('settings').select('*').eq('key', 'whatsapp_number').maybeSingle()
      .then(({ data }) => {
        if (data) setWhatsappNumberState(data.value);
        setLoading(false);
      });
  }, []);

  const setWhatsappNumber = useCallback(async (n: string) => {
    await supabase.from('settings').update({ value: n }).eq('key', 'whatsapp_number');
    setWhatsappNumberState(n);
  }, []);

  return (
    <SettingsContext.Provider value={{ whatsappNumber, setWhatsappNumber, loading }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used within SettingsProvider');
  return ctx;
}
