export type SystemModuleKey =
  | 'dashboard'
  | 'products'
  | 'movements'
  | 'sales'
  | 'reports'
  | 'catalog'
  | 'offline_catalog'
  | 'user_management'
  | 'settings'
  | 'billing'
  | 'plan_templates'
  | 'data_export'
  | 'commissions';

export interface SystemModuleDefinition {
  key: SystemModuleKey;
  label: string;
}

export const SYSTEM_MODULES: SystemModuleDefinition[] = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'products', label: 'Produtos' },
  { key: 'movements', label: 'Movimentações' },
  { key: 'sales', label: 'Vendas' },
  { key: 'reports', label: 'Relatórios' },
  { key: 'catalog', label: 'Catálogo' },
  { key: 'offline_catalog', label: 'Catálogo Offline' },
  { key: 'user_management', label: 'Cadastro de Usuários' },
  { key: 'settings', label: 'Configurações' },
  { key: 'billing', label: 'Plano e Cobrança' },
  { key: 'plan_templates', label: 'Templates de Plano' },
  { key: 'data_export', label: 'Exportação de Dados' },
  { key: 'commissions', label: 'Comissão de Vendedores' },
];

export const SYSTEM_MODULE_LABELS = Object.fromEntries(
  SYSTEM_MODULES.map((module) => [module.key, module.label]),
) as Record<SystemModuleKey, string>;

export const SYSTEM_MODULE_ORDER = new Map(
  SYSTEM_MODULES.map((module, index) => [module.key, index]),
);