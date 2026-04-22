import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area
} from "recharts";
import { 
  Calendar as CalendarIcon, 
  TrendingUp, 
  Users, 
  ShoppingBag, 
  DollarSign,
  Trash2,
  RefreshCw,
  ArrowUpRight
} from "lucide-react";
import { format, subDays, startOfDay, endOfDay, isWithinInterval } from "date-fns";
import { ptBR } from "date-fns/locale";
import { DateRange } from "react-day-picker";
import { toast } from "sonner";

interface Order {
  id: string;
  amount: number;
  status: string;
  created_at: string;
  product_name: string;
  user_id: string;
}

export const AdminDashboard = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [date, setDate] = useState<DateRange | undefined>({
    from: subDays(new Date(), 30),
    to: new Date(),
  });
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("orders")
      .select("*")
      .order("created_at", { ascending: true });

    if (error) {
      toast.error("Erro ao carregar dados do dashboard");
    } else {
      setOrders(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();

    // Inscrição em tempo real para novos pedidos ou mudanças de status
    const channel = supabase
      .channel("admin-dashboard-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders" },
        () => {
          load();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este pedido?")) return;
    
    const { error } = await supabase.from("orders").delete().eq("id", id);
    if (error) {
      toast.error("Erro ao excluir pedido");
    } else {
      toast.success("Pedido excluído");
      setOrders(prev => prev.filter(o => o.id !== id));
    }
  };

  // Filtragem e Processamento de Dados
  const filteredOrders = orders.filter(o => {
    if (!date?.from || !date?.to) return true;
    const orderDate = new Date(o.created_at);
    return isWithinInterval(orderDate, { start: startOfDay(date.from), end: endOfDay(date.to) });
  });

  const approvedOrders = filteredOrders.filter(o => o.status === "approved" || o.status === "delivered");
  const totalSales = approvedOrders.reduce((sum, o) => sum + Number(o.amount), 0);
  const avgTicket = approvedOrders.length > 0 ? totalSales / approvedOrders.length : 0;

  // Formatação para o gráfico (agrupar por dia)
  const chartData = approvedOrders.reduce((acc: any[], order) => {
    const day = format(new Date(order.created_at), "dd/MM");
    const existing = acc.find(item => item.name === day);
    if (existing) {
      existing.total += Number(order.amount);
    } else {
      acc.push({ name: day, total: Number(order.amount) });
    }
    return acc;
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Métricas de Vendas</h2>
          <p className="text-muted-foreground">Acompanhe o desempenho da sua loja em tempo real.</p>
        </div>
        
        <div className="flex items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="justify-start text-left font-normal w-[260px]">
                <CalendarIcon className="mr-2 h-4 w-4" />
                {date?.from ? (
                  date.to ? (
                    <>
                      {format(date.from, "dd/MM/yyyy")} - {format(date.to, "dd/MM/yyyy")}
                    </>
                  ) : (
                    format(date.from, "dd/MM/yyyy")
                  )
                ) : (
                  <span>Selecione um período</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                initialFocus
                mode="range"
                defaultMonth={date?.from}
                selected={date}
                onSelect={setDate}
                numberOfMonths={2}
                locale={ptBR}
              />
            </PopoverContent>
          </Popover>
          <Button variant="ghost" size="icon" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Cards de Métricas */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="bg-card/50 backdrop-blur-sm border-primary/20 shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Receita Total</CardTitle>
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <DollarSign className="h-4 w-4 text-primary" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">R$ {totalSales.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
              <TrendingUp className="h-3 w-3 text-primary" /> No período selecionado
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card/50 backdrop-blur-sm border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Vendas Aprovadas</CardTitle>
            <div className="h-8 w-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <ShoppingBag className="h-4 w-4 text-blue-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{approvedOrders.length}</div>
            <p className="text-xs text-muted-foreground mt-1">Pedidos concluídos</p>
          </CardContent>
        </Card>

        <Card className="bg-card/50 backdrop-blur-sm border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Ticket Médio</CardTitle>
            <div className="h-8 w-8 rounded-lg bg-purple-500/10 flex items-center justify-center">
              <ArrowUpRight className="h-4 w-4 text-purple-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">R$ {avgTicket.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
            <p className="text-xs text-muted-foreground mt-1">Por pedido aprovado</p>
          </CardContent>
        </Card>
      </div>

      {/* Gráfico */}
      <Card className="p-6 bg-card/30 backdrop-blur-md">
        <CardHeader className="px-0 pt-0">
          <CardTitle className="text-lg flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Volume de Vendas Diárias
          </CardTitle>
        </CardHeader>
        <div className="h-[300px] w-full mt-4">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
              <XAxis 
                dataKey="name" 
                axisLine={false} 
                tickLine={false} 
                tick={{fontSize: 12, fill: 'hsl(var(--muted-foreground))'}} 
                dy={10}
              />
              <YAxis 
                axisLine={false} 
                tickLine={false} 
                tick={{fontSize: 12, fill: 'hsl(var(--muted-foreground))'}} 
                tickFormatter={(val) => `R$${val}`}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--card))', 
                  borderColor: 'hsl(var(--border))',
                  borderRadius: '12px'
                }}
                itemStyle={{ color: 'hsl(var(--primary))' }}
                labelStyle={{ color: 'hsl(var(--foreground))', fontWeight: 'bold' }}
                formatter={(val) => [`R$ ${Number(val).toFixed(2)}`, 'Vendas']}
              />
              <Area 
                type="monotone" 
                dataKey="total" 
                stroke="hsl(var(--primary))" 
                strokeWidth={3}
                fillOpacity={1} 
                fill="url(#colorTotal)" 
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Lista de Pedidos com Exclusão */}
      <Card className="overflow-hidden bg-card/50 border-border">
        <CardHeader className="bg-muted/30">
          <CardTitle className="text-lg">Pedidos Recentes (Filtro Aplicado)</CardTitle>
        </CardHeader>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data</TableHead>
              <TableHead>Produto</TableHead>
              <TableHead>Valor</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredOrders.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-10 text-muted-foreground">
                  Nenhum pedido encontrado no período.
                </TableCell>
              </TableRow>
            ) : (
              [...filteredOrders].reverse().slice(0, 10).map((o) => (
                <TableRow key={o.id} className="hover:bg-muted/20 transition-colors">
                  <TableCell className="text-xs">
                    {format(new Date(o.created_at), "dd/MM/yyyy HH:mm")}
                  </TableCell>
                  <TableCell className="font-medium">{o.product_name}</TableCell>
                  <TableCell>R$ {Number(o.amount).toFixed(2)}</TableCell>
                  <TableCell>
                    <Badge variant={
                      o.status === 'approved' || o.status === 'delivered' ? 'default' : 
                      o.status === 'pending' ? 'secondary' : 'destructive'
                    }>
                      {o.status === 'approved' ? 'Aprovado' : o.status === 'delivered' ? 'Entregue' : o.status === 'pending' ? 'Pendente' : 'Recusado'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="text-destructive hover:bg-destructive/10"
                      onClick={() => handleDelete(o.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
};
