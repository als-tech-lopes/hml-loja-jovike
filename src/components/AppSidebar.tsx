import { useAuth, type ModulePermissions } from '@/contexts/AuthContext';
import { NavLink } from '@/components/NavLink';
import { LayoutDashboard, Package, ArrowDownUp, Users, LogOut, ShoppingBag, Settings, Crown, FileBarChart, LayoutTemplate, BookOpen, Library, Wallet } from 'lucide-react';
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarFooter, useSidebar,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import type { SystemModuleKey } from '@/lib/systemModules';

const menuItems: { title: string; url: string; icon: typeof LayoutDashboard; module: keyof ModulePermissions | null }[] = [
  { title: 'Dashboard', url: '/dashboard', icon: LayoutDashboard, module: 'dashboard' },
  { title: 'Produtos', url: '/produtos', icon: Package, module: 'products' },
  { title: 'Movimentações', url: '/movimentacoes', icon: ArrowDownUp, module: 'movements' },
  { title: 'Vendas', url: '/vendas', icon: ShoppingBag, module: 'sales' },
  { title: 'Relatórios', url: '/relatorios', icon: FileBarChart, module: 'reports' },
];

const adminItems: { title: string; url: string; icon: typeof LayoutDashboard; moduleKey: SystemModuleKey }[] = [
  { title: 'Usuários', url: '/usuarios', icon: Users, moduleKey: 'user_management' },
  { title: 'Catálogo', url: '/catalogo-admin', icon: BookOpen, moduleKey: 'catalog' },
  { title: 'Catálogo Offline', url: '/catalogo-offline', icon: Library, moduleKey: 'offline_catalog' },
  { title: 'Configurações', url: '/configuracoes', icon: Settings, moduleKey: 'settings' },
  { title: 'Plano e Cobrança', url: '/plano', icon: Crown, moduleKey: 'billing' },
  { title: 'Comissões', url: '/comissoes', icon: Wallet, moduleKey: 'commissions' },
];

const superAdminItems: { title: string; url: string; icon: typeof LayoutDashboard; moduleKey: SystemModuleKey }[] = [
  { title: 'Templates de Plano', url: '/templates-plano', icon: LayoutTemplate, moduleKey: 'plan_templates' },
];

export function AppSidebar() {
  const { user, logout, hasAccess, isModuleEnabled } = useAuth();
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';
  const visibleItems = menuItems.filter(item => !item.module || hasAccess(item.module));
  const visibleAdminItems = adminItems.filter(item => user?.role === 'super_admin' || isModuleEnabled(item.moduleKey));

  return (
    <Sidebar collapsible="icon" className="sidebar-glow">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="px-4 py-6">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg gold-gradient flex items-center justify-center flex-shrink-0">
                {/*<Gem className="w-4 h-4 text-primary" />*/}
                <img src="/logo_loja.jpg" alt="Logo" className="w-28 h-28 object-contain" />
              </div>
              {!collapsed && <span className="font-display text-lg font-bold text-sidebar-accent-foreground">JKB OUTFIT</span>}
            </div>
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {visibleItems.map(item => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink to={item.url} end className="hover:bg-sidebar-accent/50" activeClassName="bg-sidebar-accent text-sidebar-primary font-medium">
                      <item.icon className="mr-2 h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {(user?.role === 'admin' || user?.role === 'super_admin') && (
          <SidebarGroup>
            <SidebarGroupLabel>{!collapsed && 'Administração'}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {visibleAdminItems.map(item => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild>
                      <NavLink to={item.url} end className="hover:bg-sidebar-accent/50" activeClassName="bg-sidebar-accent text-sidebar-primary font-medium">
                        <item.icon className="mr-2 h-4 w-4" />
                        {!collapsed && <span>{item.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
                {user?.role === 'super_admin' && superAdminItems.map(item => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild>
                      <NavLink to={item.url} end className="hover:bg-sidebar-accent/50" activeClassName="bg-sidebar-accent text-sidebar-primary font-medium">
                        <item.icon className="mr-2 h-4 w-4" />
                        {!collapsed && <span>{item.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="p-4">
        {!collapsed && user && (
          <div className="px-2 mb-2">
            <p className="text-sm font-medium text-sidebar-accent-foreground">{user.name}</p>
            <p className="text-xs text-sidebar-foreground">{user.role === 'super_admin' ? 'Super Admin' : user.role === 'admin' ? 'Administrador' : 'Usuário'}</p>
          </div>
        )}
        <Button variant="ghost" onClick={logout} className="w-full justify-start text-sidebar-foreground hover:text-sidebar-accent-foreground hover:bg-sidebar-accent">
          <LogOut className="w-4 h-4 mr-2" />
          {!collapsed && 'Sair'}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
