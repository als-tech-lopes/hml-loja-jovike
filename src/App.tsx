import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { StockProvider } from "@/contexts/StockContext";
import { SettingsProvider } from "@/contexts/SettingsContext";
import AppLayout from "@/components/AppLayout";
import LoginPage from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import Products from "@/pages/Products";
import Movements from "@/pages/Movements";
import Sales from "@/pages/Sales";
import Catalog from "@/pages/Catalog";
import Settings from "@/pages/Settings";
import CatalogManagement from "@/pages/CatalogManagement";
import OfflineCatalog from "@/pages/OfflineCatalog";
import OfflineCatalogSettings from "@/pages/OfflineCatalogSettings";
import UserManagement from "@/pages/UserManagement";
import BillingManagement from "@/pages/BillingManagement";
import PlanTemplates from "@/pages/PlanTemplates";
import Reports from "@/pages/Reports";
import SellerCommissions from "@/pages/SellerCommissions";
import NotFound from "./pages/NotFound";
import { Loader2 } from "lucide-react";

const queryClient = new QueryClient();

const moduleRoutes: { module: keyof import('@/contexts/AuthContext').ModulePermissions; path: string }[] = [
  { module: 'dashboard', path: '/dashboard' },
  { module: 'products', path: '/produtos' },
  { module: 'movements', path: '/movimentacoes' },
  { module: 'sales', path: '/vendas' },
  { module: 'reports', path: '/relatorios' },
];

function getFirstAccessibleRoute(hasAccess: (m: keyof import('@/contexts/AuthContext').ModulePermissions) => boolean): string {
  for (const r of moduleRoutes) {
    if (hasAccess(r.module)) return r.path;
  }
  return '/vendas';
}

function ProtectedRoute({ children, module }: { children: React.ReactNode; module?: string }) {
  const { isAuthenticated, hasAccess, loading, trialInfo, user } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center bg-background"><Loader2 className="w-8 h-8 animate-spin text-accent" /></div>;
  if (!isAuthenticated) return <Navigate to="/" replace />;
  // If trial expired and not super_admin, redirect to billing page
  if (trialInfo?.expired && user?.role !== 'super_admin') return <Navigate to="/plano" replace />;
  if (module && !hasAccess(module as any)) return <Navigate to={getFirstAccessibleRoute(hasAccess)} replace />;
  return <AppLayout>{children}</AppLayout>;
}

function AdminRoute({ children, module }: { children: React.ReactNode; module?: string }) {
  const { isAuthenticated, user, loading, hasAccess, isModuleEnabled } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center bg-background"><Loader2 className="w-8 h-8 animate-spin text-accent" /></div>;
  if (!isAuthenticated) return <Navigate to="/" replace />;
  if (user?.role !== 'admin' && user?.role !== 'super_admin') return <Navigate to="/dashboard" replace />;
  if (module && user?.role !== 'super_admin' && !isModuleEnabled(module)) return <Navigate to={getFirstAccessibleRoute(hasAccess)} replace />;
  return <AppLayout>{children}</AppLayout>;
}

function SuperAdminRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, user, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center bg-background"><Loader2 className="w-8 h-8 animate-spin text-accent" /></div>;
  if (!isAuthenticated) return <Navigate to="/" replace />;
  if (user?.role !== 'super_admin') return <Navigate to="/dashboard" replace />;
  return <AppLayout>{children}</AppLayout>;
}

function AuthGate() {
  const { isAuthenticated, hasAccess, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center bg-background"><Loader2 className="w-8 h-8 animate-spin text-accent" /></div>;
  if (isAuthenticated) return <Navigate to={getFirstAccessibleRoute(hasAccess)} replace />;
  return <LoginPage />;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AuthProvider>
        <StockProvider>
          <SettingsProvider>
            <BrowserRouter>
              <Routes>
                <Route path="/" element={<AuthGate />} />
                <Route path="/dashboard" element={<ProtectedRoute module="dashboard"><Dashboard /></ProtectedRoute>} />
                <Route path="/produtos" element={<ProtectedRoute module="products"><Products /></ProtectedRoute>} />
                <Route path="/movimentacoes" element={<ProtectedRoute module="movements"><Movements /></ProtectedRoute>} />
                <Route path="/vendas" element={<ProtectedRoute module="sales"><Sales /></ProtectedRoute>} />
                <Route path="/relatorios" element={<ProtectedRoute module="reports"><Reports /></ProtectedRoute>} />
                <Route path="/catalogo" element={<Catalog />} />
                <Route path="/catalogo-admin" element={<AdminRoute module="catalog"><CatalogManagement /></AdminRoute>} />
                <Route path="/catalogo-offline" element={<AdminRoute module="offline_catalog"><OfflineCatalog /></AdminRoute>} />
                <Route path="/catalogo-offline-config" element={<SuperAdminRoute><OfflineCatalogSettings /></SuperAdminRoute>} />
                <Route path="/configuracoes" element={<AdminRoute module="settings"><Settings /></AdminRoute>} />
                <Route path="/usuarios" element={<AdminRoute module="user_management"><UserManagement /></AdminRoute>} />
                <Route path="/plano" element={<AdminRoute module="billing"><BillingManagement /></AdminRoute>} />
                <Route path="/comissoes" element={<AdminRoute module="commissions"><SellerCommissions /></AdminRoute>} />
                <Route path="/templates-plano" element={<AdminRoute><PlanTemplates /></AdminRoute>} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </BrowserRouter>
          </SettingsProvider>
        </StockProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
