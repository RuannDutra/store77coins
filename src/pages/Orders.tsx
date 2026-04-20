import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Navbar } from "@/components/Navbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Clock, ShoppingBag, XCircle } from "lucide-react";

interface Order {
  id: string;
  product_name: string;
  amount: number;
  status: "pending" | "approved" | "rejected";
  checkout_url: string | null;
  admin_notes: string | null;
  created_at: string;
}

const statusConfig = {
  pending: { label: "Em análise", icon: Clock, className: "border-warning text-warning" },
  approved: { label: "Aprovado", icon: CheckCircle2, className: "border-success text-success" },
  rejected: { label: "Recusado", icon: XCircle, className: "border-destructive text-destructive" },
};

const Orders = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    document.title = "Meus pedidos — 77 Coins";
    if (!authLoading && !user) {
      navigate("/auth");
      return;
    }
    if (!user) return;
    supabase
      .from("orders")
      .select("id, product_name, amount, status, checkout_url, admin_notes, created_at")
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        setOrders((data as any) || []);
        setLoading(false);
      });
  }, [user, authLoading, navigate]);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container py-8 max-w-3xl">
        <h1 className="font-display text-3xl font-bold mb-6">Meus pedidos</h1>

        {loading ? (
          <p className="text-muted-foreground">Carregando...</p>
        ) : orders.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground border border-border rounded-2xl">
            <ShoppingBag className="h-12 w-12 mx-auto mb-4 opacity-30" />
            <p className="mb-4">Você ainda não fez nenhum pedido.</p>
            <Button onClick={() => navigate("/")}>Explorar produtos</Button>
          </div>
        ) : (
          <div className="space-y-3">
            {orders.map((o) => {
              const cfg = statusConfig[o.status];
              const Icon = cfg.icon;
              return (
                <div key={o.id} className="rounded-xl border border-border bg-card p-5">
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div>
                      <h3 className="font-display font-semibold">{o.product_name}</h3>
                      <p className="text-sm text-muted-foreground">
                        {new Date(o.created_at).toLocaleString("pt-BR")}
                      </p>
                    </div>
                    <Badge variant="outline" className={`gap-1 ${cfg.className}`}>
                      <Icon className="h-3 w-3" /> {cfg.label}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <p className="font-display text-xl font-bold text-primary">
                      R$ {Number(o.amount).toFixed(2).replace(".", ",")}
                    </p>
                    {o.status === "pending" && o.checkout_url && (
                      <Button variant="outline" size="sm" asChild>
                        <a href={o.checkout_url} target="_blank" rel="noopener noreferrer">
                          Ir para checkout
                        </a>
                      </Button>
                    )}
                  </div>
                  {o.admin_notes && (
                    <div className="mt-3 pt-3 border-t border-border text-sm">
                      <span className="text-muted-foreground">Mensagem do admin: </span>
                      {o.admin_notes}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default Orders;
