import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { Download, ShoppingBag, ArrowDownUp, Package, TrendingUp, TrendingDown, AlertTriangle, Star } from 'lucide-react';
import { format, parseISO, isWithinInterval, startOfDay, endOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import * as XLSX from 'xlsx';

export default function Reports() {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedProduct, setSelectedProduct] = useState('all');
  const [movementType, setMovementType] = useState('all');
  const [activeTab, setActiveTab] = useState('vendas');
  const [exportType, setExportType] = useState('all');

  const { data: sales = [] } = useQuery({
    queryKey: ['reports-sales'],
    queryFn: async () => {
      const { data } = await supabase.from('sales').select('*').order('created_at', { ascending: false });
      return data || [];
    },
  });

  const { data: saleItems = [] } = useQuery({
    queryKey: ['reports-sale-items'],
    queryFn: async () => {
      const { data } = await supabase.from('sale_items').select('*');
      return data || [];
    },
  });

  const { data: movements = [] } = useQuery({
    queryKey: ['reports-movements'],
    queryFn: async () => {
      const { data } = await supabase.from('movements').select('*').order('created_at', { ascending: false });
      return data || [];
    },
  });

  const { data: products = [] } = useQuery({
    queryKey: ['reports-products'],
    queryFn: async () => {
      const { data } = await supabase.from('products').select('*').order('name');
      return data || [];
    },
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ['reports-profiles'],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('user_id, name, email');
      return data || [];
    },
  });

  const sellerName = (userId: string | null | undefined) => {
    if (!userId) return 'Não informado';
    const p = profiles.find((p: any) => p.user_id === userId);
    return p ? (p.name || p.email || 'Não informado') : 'Não informado';
  };

  const dateFilter = (dateStr: string) => {
    if (!startDate && !endDate) return true;
    const d = parseISO(dateStr);
    if (startDate && endDate) return isWithinInterval(d, { start: startOfDay(parseISO(startDate)), end: endOfDay(parseISO(endDate)) });
    if (startDate) return d >= startOfDay(parseISO(startDate));
    if (endDate) return d <= endOfDay(parseISO(endDate));
    return true;
  };

  const filteredSales = useMemo(() => sales.filter(s => dateFilter(s.created_at)), [sales, startDate, endDate]);
  const filteredMovements = useMemo(() =>
    movements.filter(m => dateFilter(m.created_at) && (movementType === 'all' || m.type === movementType) && (selectedProduct === 'all' || m.product_id === selectedProduct)),
    [movements, startDate, endDate, movementType, selectedProduct]
  );

  const filteredSaleItems = useMemo(() => {
    const saleIds = new Set(filteredSales.map(s => s.id));
    return saleItems.filter(si => saleIds.has(si.sale_id) && (selectedProduct === 'all' || si.product_id === selectedProduct));
  }, [saleItems, filteredSales, selectedProduct]);

  // Sales KPIs
  const totalSales = filteredSales.length;
  const totalRevenue = filteredSales.reduce((sum, s) => sum + Number(s.total), 0);
  const totalItemsSold = filteredSaleItems.reduce((sum, si) => sum + si.quantity, 0);

  // Movement KPIs
  const totalEntries = filteredMovements.filter(m => m.type === 'entrada').reduce((sum, m) => sum + m.quantity, 0);
  const totalExits = filteredMovements.filter(m => m.type === 'saida').reduce((sum, m) => sum + m.quantity, 0);

  // Product KPIs
  const totalProducts = products.length;
  const totalStock = products.reduce((sum, p) => sum + p.quantity, 0);
  const lowStockProducts = products.filter(p => p.quantity <= p.min_stock);

  // Top selling products
  const topProducts = useMemo(() => {
    const map = new Map<string, { name: string; qty: number; revenue: number }>();
    filteredSaleItems.forEach(si => {
      const existing = map.get(si.product_id) || { name: si.product_name, qty: 0, revenue: 0 };
      existing.qty += si.quantity;
      existing.revenue += si.quantity * Number(si.unit_price);
      map.set(si.product_id, existing);
    });
    return Array.from(map.values()).sort((a, b) => b.qty - a.qty).slice(0, 10);
  }, [filteredSaleItems]);

  // Sales by month chart data
  const salesByMonth = useMemo(() => {
    const map = new Map<string, { month: string; total: number; count: number }>();
    filteredSales.forEach(s => {
      const key = format(parseISO(s.created_at), 'yyyy-MM');
      const label = format(parseISO(s.created_at), 'MMM/yy', { locale: ptBR });
      const existing = map.get(key) || { month: label, total: 0, count: 0 };
      existing.total += Number(s.total);
      existing.count += 1;
      map.set(key, existing);
    });
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([, v]) => v);
  }, [filteredSales]);

  // Movements by month chart data
  const movementsByMonth = useMemo(() => {
    const map = new Map<string, { month: string; entradas: number; saidas: number }>();
    filteredMovements.forEach(m => {
      const key = format(parseISO(m.created_at), 'yyyy-MM');
      const label = format(parseISO(m.created_at), 'MMM/yy', { locale: ptBR });
      const existing = map.get(key) || { month: label, entradas: 0, saidas: 0 };
      if (m.type === 'entrada') existing.entradas += m.quantity;
      else existing.saidas += m.quantity;
      map.set(key, existing);
    });
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([, v]) => v);
  }, [filteredMovements]);

  const exportToExcel = () => {
    const wb = XLSX.utils.book_new();
    const salesData = filteredSales.map(s => ({
      'Data': format(parseISO(s.created_at), 'dd/MM/yyyy HH:mm'),
      'Cliente': s.client_name,
      'Vendedor': sellerName((s as any).created_by),
      'Telefone': s.client_phone,
      'Pagamento': s.payment_method,
      'Total': Number(s.total),
      'Observação': s.note,
    }));
    const movData = filteredMovements.map(m => ({
      'Data': format(parseISO(m.created_at), 'dd/MM/yyyy HH:mm'),
      'Produto': m.product_name,
      'Tipo': m.type === 'entrada' ? 'Entrada' : 'Saída',
      'Quantidade': m.quantity,
      'Observação': m.note,
    }));
    const prodData = products.map(p => ({
      'Nome': p.name,
      'Categoria': p.category,
      'Preço': Number(p.price),
      'Estoque': p.quantity,
      'Estoque Mínimo': p.min_stock,
      'Status': p.quantity <= p.min_stock ? 'Baixo' : 'Normal',
    }));

    const sheets = {
      sales: { name: 'Vendas', data: salesData },
      movements: { name: 'Movimentações', data: movData },
      products: { name: 'Produtos', data: prodData },
    } as const;

    if (exportType === 'sales') {
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sheets.sales.data), sheets.sales.name);
    } else if (exportType === 'movements') {
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sheets.movements.data), sheets.movements.name);
    } else if (exportType === 'products') {
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sheets.products.data), sheets.products.name);
    } else {
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sheets.sales.data), sheets.sales.name);
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sheets.movements.data), sheets.movements.name);
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sheets.products.data), sheets.products.name);
    }

    XLSX.writeFile(wb, `relatorio_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
  };

  const salesChartConfig = { total: { label: 'Receita', color: 'hsl(var(--primary))' }, count: { label: 'Vendas', color: 'hsl(var(--accent))' } };
  const movChartConfig = { entradas: { label: 'Entradas', color: 'hsl(142 71% 45%)' }, saidas: { label: 'Saídas', color: 'hsl(0 84% 60%)' } };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-bold text-foreground">Relatórios</h1>
        <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
          <Select value={exportType} onValueChange={setExportType}>
            <SelectTrigger className="sm:w-[220px]">
              <SelectValue placeholder="Selecione o relatório" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="sales">Relatório de Vendas</SelectItem>
              <SelectItem value="movements">Relatório de Movimentações</SelectItem>
              <SelectItem value="products">Relatório de Produtos</SelectItem>
              <SelectItem value="all">Todos</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={exportToExcel} className="gap-2">
            <Download className="w-4 h-4" /> Exportar Excel
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground mb-1 block">Data Inicial</label>
              <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground mb-1 block">Data Final</label>
              <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground mb-1 block">Produto</label>
              <Select value={selectedProduct} onValueChange={setSelectedProduct}>
                <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {products.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground mb-1 block">Tipo Movimentação</label>
              <Select value={movementType} onValueChange={setMovementType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="entrada">Entrada</SelectItem>
                  <SelectItem value="saida">Saída</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="vendas">Vendas</TabsTrigger>
          <TabsTrigger value="movimentacoes">Movimentações</TabsTrigger>
          <TabsTrigger value="produtos">Produtos</TabsTrigger>
        </TabsList>

        {/* ---- VENDAS ---- */}
        <TabsContent value="vendas" className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card><CardContent className="pt-6 flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center"><ShoppingBag className="w-6 h-6 text-primary" /></div>
              <div><p className="text-sm text-muted-foreground">Total de Vendas</p><p className="text-2xl font-bold">{totalSales}</p></div>
            </CardContent></Card>
            <Card><CardContent className="pt-6 flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-accent/10 flex items-center justify-center"><TrendingUp className="w-6 h-6 text-accent" /></div>
              <div><p className="text-sm text-muted-foreground">Valor Total</p><p className="text-2xl font-bold">R$ {totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p></div>
            </CardContent></Card>
            <Card><CardContent className="pt-6 flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center"><Package className="w-6 h-6 text-primary" /></div>
              <div><p className="text-sm text-muted-foreground">Itens Vendidos</p><p className="text-2xl font-bold">{totalItemsSold}</p></div>
            </CardContent></Card>
          </div>

          {salesByMonth.length > 0 && (
            <Card><CardHeader><CardTitle className="text-base">Vendas por Mês</CardTitle></CardHeader>
              <CardContent>
                <ChartContainer config={salesChartConfig} className="h-[300px] w-full">
                  <BarChart data={salesByMonth}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="total" name="total" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ChartContainer>
              </CardContent>
            </Card>
          )}

          {topProducts.length > 0 && (
            <Card><CardHeader><CardTitle className="text-base flex items-center gap-2"><Star className="w-4 h-4 text-accent" /> Produtos Mais Vendidos</CardTitle></CardHeader>
              <CardContent>
                <Table><TableHeader><TableRow>
                  <TableHead>#</TableHead><TableHead>Produto</TableHead><TableHead className="text-right">Qtd</TableHead><TableHead className="text-right">Receita</TableHead>
                </TableRow></TableHeader><TableBody>
                  {topProducts.map((p, i) => (
                    <TableRow key={i}><TableCell>{i + 1}</TableCell><TableCell>{p.name}</TableCell><TableCell className="text-right">{p.qty}</TableCell><TableCell className="text-right">R$ {p.revenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</TableCell></TableRow>
                  ))}
                </TableBody></Table>
              </CardContent>
            </Card>
          )}

          <Card><CardHeader><CardTitle className="text-base">Detalhamento de Vendas</CardTitle></CardHeader>
            <CardContent>
              <Table><TableHeader><TableRow>
                <TableHead>Data</TableHead><TableHead>Cliente</TableHead><TableHead>Vendedor</TableHead><TableHead>Pagamento</TableHead><TableHead className="text-right">Total</TableHead>
              </TableRow></TableHeader><TableBody>
                {filteredSales.slice(0, 50).map(s => (
                  <TableRow key={s.id}>
                    <TableCell>{format(parseISO(s.created_at), 'dd/MM/yyyy HH:mm')}</TableCell>
                    <TableCell>{s.client_name}</TableCell>
                    <TableCell>{sellerName((s as any).created_by)}</TableCell>
                    <TableCell><Badge variant="outline">{s.payment_method}</Badge></TableCell>
                    <TableCell className="text-right font-medium">R$ {Number(s.total).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</TableCell>
                  </TableRow>
                ))}
              </TableBody></Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ---- MOVIMENTAÇÕES ---- */}
        <TabsContent value="movimentacoes" className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card><CardContent className="pt-6 flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-green-500/10 flex items-center justify-center"><TrendingUp className="w-6 h-6 text-green-500" /></div>
              <div><p className="text-sm text-muted-foreground">Total Entradas</p><p className="text-2xl font-bold">{totalEntries}</p></div>
            </CardContent></Card>
            <Card><CardContent className="pt-6 flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-red-500/10 flex items-center justify-center"><TrendingDown className="w-6 h-6 text-red-500" /></div>
              <div><p className="text-sm text-muted-foreground">Total Saídas</p><p className="text-2xl font-bold">{totalExits}</p></div>
            </CardContent></Card>
            <Card><CardContent className="pt-6 flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center"><ArrowDownUp className="w-6 h-6 text-primary" /></div>
              <div><p className="text-sm text-muted-foreground">Total Movimentações</p><p className="text-2xl font-bold">{filteredMovements.length}</p></div>
            </CardContent></Card>
          </div>

          {movementsByMonth.length > 0 && (
            <Card><CardHeader><CardTitle className="text-base">Entradas vs Saídas por Mês</CardTitle></CardHeader>
              <CardContent>
                <ChartContainer config={movChartConfig} className="h-[300px] w-full">
                  <BarChart data={movementsByMonth}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="entradas" name="entradas" fill="hsl(142 71% 45%)" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="saidas" name="saidas" fill="hsl(0 84% 60%)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ChartContainer>
              </CardContent>
            </Card>
          )}

          <Card><CardHeader><CardTitle className="text-base">Histórico de Movimentações</CardTitle></CardHeader>
            <CardContent>
              <Table><TableHeader><TableRow>
                <TableHead>Data</TableHead><TableHead>Produto</TableHead><TableHead>Tipo</TableHead><TableHead className="text-right">Quantidade</TableHead><TableHead>Observação</TableHead>
              </TableRow></TableHeader><TableBody>
                {filteredMovements.slice(0, 50).map(m => (
                  <TableRow key={m.id}>
                    <TableCell>{format(parseISO(m.created_at), 'dd/MM/yyyy HH:mm')}</TableCell>
                    <TableCell>{m.product_name}</TableCell>
                    <TableCell><Badge variant={m.type === 'entrada' ? 'default' : 'destructive'}>{m.type === 'entrada' ? 'Entrada' : 'Saída'}</Badge></TableCell>
                    <TableCell className="text-right font-medium">{m.quantity}</TableCell>
                    <TableCell className="text-muted-foreground">{m.note}</TableCell>
                  </TableRow>
                ))}
              </TableBody></Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ---- PRODUTOS ---- */}
        <TabsContent value="produtos" className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card><CardContent className="pt-6 flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center"><Package className="w-6 h-6 text-primary" /></div>
              <div><p className="text-sm text-muted-foreground">Total Produtos</p><p className="text-2xl font-bold">{totalProducts}</p></div>
            </CardContent></Card>
            <Card><CardContent className="pt-6 flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-accent/10 flex items-center justify-center"><Package className="w-6 h-6 text-accent" /></div>
              <div><p className="text-sm text-muted-foreground">Total em Estoque</p><p className="text-2xl font-bold">{totalStock}</p></div>
            </CardContent></Card>
            <Card><CardContent className="pt-6 flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-destructive/10 flex items-center justify-center"><AlertTriangle className="w-6 h-6 text-destructive" /></div>
              <div><p className="text-sm text-muted-foreground">Estoque Baixo</p><p className="text-2xl font-bold">{lowStockProducts.length}</p></div>
            </CardContent></Card>
          </div>

          {lowStockProducts.length > 0 && (
            <Card><CardHeader><CardTitle className="text-base flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-destructive" /> Produtos com Estoque Baixo</CardTitle></CardHeader>
              <CardContent>
                <Table><TableHeader><TableRow>
                  <TableHead>Produto</TableHead><TableHead>Categoria</TableHead><TableHead className="text-right">Estoque</TableHead><TableHead className="text-right">Mínimo</TableHead>
                </TableRow></TableHeader><TableBody>
                  {lowStockProducts.map(p => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.name}</TableCell>
                      <TableCell>{p.category}</TableCell>
                      <TableCell className="text-right"><Badge variant="destructive">{p.quantity}</Badge></TableCell>
                      <TableCell className="text-right">{p.min_stock}</TableCell>
                    </TableRow>
                  ))}
                </TableBody></Table>
              </CardContent>
            </Card>
          )}

          <Card><CardHeader><CardTitle className="text-base">Todos os Produtos</CardTitle></CardHeader>
            <CardContent>
              <Table><TableHeader><TableRow>
                <TableHead>Produto</TableHead><TableHead>Categoria</TableHead><TableHead className="text-right">Preço</TableHead><TableHead className="text-right">Estoque</TableHead><TableHead>Status</TableHead>
              </TableRow></TableHeader><TableBody>
                {products.map(p => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell>{p.category}</TableCell>
                    <TableCell className="text-right">R$ {Number(p.price).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</TableCell>
                    <TableCell className="text-right">{p.quantity}</TableCell>
                    <TableCell><Badge variant={p.quantity <= p.min_stock ? 'destructive' : 'outline'}>{p.quantity <= p.min_stock ? 'Baixo' : 'Normal'}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody></Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
