import { useAuth, ModulePermissions } from '@/contexts/AuthContext';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Trash2, Shield, User, Loader2, UserPlus, Pencil, Power, Crown } from 'lucide-react';
import { motion } from 'framer-motion';
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const moduleLabels: Record<keyof ModulePermissions, string> = {
  dashboard: 'Dashboard',
  products: 'Produtos',
  movements: 'Movimentações',
  sales: 'Vendas',
  reports: 'Relatórios',
};

async function callAdminUsers(action: string, body: Record<string, unknown>) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('Sua sessão expirou. Entre novamente para continuar.');

  const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-users`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
      'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    },
    body: JSON.stringify({ action, ...body }),
  });
  const data = await res.json().catch(() => null);
  if (!data) throw new Error('A função de usuários não respondeu corretamente. Verifique se ela está ativa.');
  if (!res.ok) throw new Error(data.error || 'Erro desconhecido');
  return data;
}

export default function UserManagement() {
  const { user, users, updateUserPermissions, refreshUsers } = useAuth();
  const isSuperAdmin = user?.role === 'super_admin';
  const isAdmin = user?.role === 'admin';
  const [deleting, setDeleting] = useState<string | null>(null);
  const [toggling, setToggling] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<typeof users[0] | null>(null);
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'user' as string });
  const [editForm, setEditForm] = useState({ name: '', email: '', password: '', role: 'user' as string });
  const [submitting, setSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Admin cannot see super_admin users
  const otherUsers = users
    .filter(u => u.id !== user?.id)
    .filter(u => isAdmin ? u.role !== 'super_admin' : true)
    .filter(u => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q) || u.role.toLowerCase().includes(q);
    });

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim() || !form.password.trim()) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }
    setSubmitting(true);
    try {
      await callAdminUsers('create', {
        name: form.name,
        email: form.email,
        password: form.password,
        role: form.role,
      });
      toast.success('Usuário criado com sucesso');
      setForm({ name: '', email: '', password: '', role: 'user' });
      setCreateOpen(false);
      await refreshUsers();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setSubmitting(true);
    try {
      // Admin can only update basic info, not role
      const payload: Record<string, unknown> = {
        userId: editingUser.id,
        name: editForm.name || undefined,
        email: editForm.email || undefined,
        password: editForm.password || undefined,
      };
      // Only super_admin can change roles
      if (isSuperAdmin) {
        payload.role = editForm.role;
      }
      await callAdminUsers('update', payload);
      toast.success('Usuário atualizado com sucesso');
      setEditOpen(false);
      setEditingUser(null);
      await refreshUsers();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleActive = async (u: typeof users[0]) => {
    const newActive = !(u as any).is_active;
    setToggling(u.id);
    try {
      await callAdminUsers('toggle_active', { userId: u.id, is_active: newActive });
      toast.success(newActive ? 'Usuário ativado' : 'Usuário desativado');
      await refreshUsers();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setToggling(null);
    }
  };

  const handleDelete = async (userId: string) => {
    if (!confirm('Tem certeza que deseja excluir este usuário? Esta ação é irreversível.')) return;
    setDeleting(userId);
    try {
      await callAdminUsers('delete', { userId });
      toast.success('Usuário excluído');
      await refreshUsers();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setDeleting(null);
    }
  };

  const openEdit = (u: typeof users[0]) => {
    setEditingUser(u);
    setEditForm({ name: u.name, email: u.email, password: '', role: u.role });
    setEditOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Gerenciar Usuários</h1>
          <p className="text-muted-foreground">
            {isSuperAdmin ? 'Controle total de usuários e permissões' : 'Edite informações dos usuários'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Input
            placeholder="Pesquisar usuários..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-48 sm:w-64"
          />

          {/* Only super_admin can create users */}
          {isSuperAdmin && (
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
              <DialogTrigger asChild>
                <Button className="gold-gradient text-gold-foreground font-semibold">
                  <UserPlus className="w-4 h-4 mr-2" /> Novo Usuário
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Cadastrar Novo Usuário</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleCreate} className="space-y-4">
                  <div className="space-y-2">
                    <Label>Nome *</Label>
                    <Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Nome completo" required />
                  </div>
                  <div className="space-y-2">
                    <Label>Email *</Label>
                    <Input type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} placeholder="email@exemplo.com" required />
                  </div>
                  <div className="space-y-2">
                    <Label>Senha *</Label>
                    <Input type="password" value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} placeholder="Mínimo 6 caracteres" required />
                  </div>
                  <div className="space-y-2">
                    <Label>Tipo de Usuário</Label>
                    <Select value={form.role} onValueChange={v => setForm(p => ({ ...p, role: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="user">Usuário</SelectItem>
                        <SelectItem value="admin">Administrador</SelectItem>
                        <SelectItem value="super_admin">Super Admin</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button type="submit" className="w-full" disabled={submitting}>
                    {submitting && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                    Criar Usuário
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Usuário</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEdit} className="space-y-4">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input value={editForm.name} onChange={e => setEditForm(p => ({ ...p, name: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" value={editForm.email} onChange={e => setEditForm(p => ({ ...p, email: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Nova Senha (deixe em branco para manter)</Label>
              <Input type="password" value={editForm.password} onChange={e => setEditForm(p => ({ ...p, password: e.target.value }))} placeholder="••••••••" />
            </div>
            {/* Only super_admin can change roles */}
            {isSuperAdmin && (
              <div className="space-y-2">
                <Label>Tipo de Usuário</Label>
                <Select value={editForm.role} onValueChange={v => setEditForm(p => ({ ...p, role: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">Usuário</SelectItem>
                    <SelectItem value="admin">Administrador</SelectItem>
                    <SelectItem value="super_admin">Super Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Salvar Alterações
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <div className="space-y-4">
        {otherUsers.map((u, i) => (
          <motion.div key={u.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
            className={`bg-card rounded-xl border p-6 ${(u as any).is_active === false ? 'opacity-60' : ''}`}>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                  {u.role === 'super_admin' ? <Crown className="w-5 h-5 text-accent" /> :
                   u.role === 'admin' ? <Shield className="w-5 h-5 text-accent" /> : <User className="w-5 h-5 text-muted-foreground" />}
                </div>
                <div>
                  <p className="font-semibold text-foreground">{u.name}</p>
                  <p className="text-sm text-muted-foreground">{u.email}</p>
                </div>
                <Badge variant={u.role === 'super_admin' ? 'default' : u.role === 'admin' ? 'default' : 'secondary'}>
                  {u.role === 'super_admin' ? 'Super Admin' : u.role === 'admin' ? 'Admin' : 'Usuário'}
                </Badge>
                {(u as any).is_active === false && (
                  <Badge variant="destructive">Inativo</Badge>
                )}
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" onClick={() => openEdit(u)} title="Editar">
                  <Pencil className="w-4 h-4" />
                </Button>
                {/* Admin can toggle active, super_admin can do everything */}
                <Button variant="ghost" size="icon" onClick={() => handleToggleActive(u)} disabled={toggling === u.id}
                  title={(u as any).is_active === false ? 'Ativar' : 'Desativar'}>
                  {toggling === u.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Power className="w-4 h-4" />}
                </Button>
                {/* Only super_admin can delete users */}
                {isSuperAdmin && (
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(u.id)} className="text-destructive hover:text-destructive" disabled={deleting === u.id}>
                    {deleting === u.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  </Button>
                )}
              </div>
            </div>

            {/* Only super_admin can manage permissions */}
            {isSuperAdmin && u.role !== 'admin' && u.role !== 'super_admin' && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {(Object.keys(moduleLabels) as (keyof ModulePermissions)[]).map(mod => (
                  <div key={mod} className="flex items-center justify-between gap-2 p-3 rounded-lg bg-muted/50">
                    <span className="text-sm font-medium text-foreground">{moduleLabels[mod]}</span>
                    <Switch
                      checked={u.permissions[mod]}
                      onCheckedChange={checked => {
                        updateUserPermissions(u.id, { ...u.permissions, [mod]: checked });
                      }}
                    />
                  </div>
                ))}
              </div>
            )}
            {u.role === 'admin' && (
              <p className="text-sm text-muted-foreground">Administradores têm acesso total a todos os módulos.</p>
            )}
            {u.role === 'super_admin' && (
              <p className="text-sm text-muted-foreground">Super Admin tem acesso total ao sistema.</p>
            )}
          </motion.div>
        ))}
        {otherUsers.length === 0 && (
          <div className="text-center p-8 text-muted-foreground">Nenhum usuário encontrado</div>
        )}
      </div>
    </div>
  );
}
