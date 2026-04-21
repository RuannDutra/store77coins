import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Navbar } from "@/components/Navbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { OrderChat } from "@/components/OrderChat";
import { CheckCircle2, Clock, MessageSquare, ShoppingBag, XCircle, Star, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

interface Order {
  id: string;
  product_name: string;
  product_id: string;
  amount: number;
  status: "pending" | "approved" | "rejected" | "delivered";
  checkout_url: string | null;
  admin_notes: string | null;
  created_at: string;
}

const statusConfig = {
  pending: { label: "Em análise", icon: Clock, className: "border-warning text-warning" },
  approved: { label: "Aprovado", icon: CheckCircle2, className: "border-success text-success" },
  delivered: { label: "Entregue", icon: CheckCircle2, className: "border-primary text-primary" },
  rejected: { label: "Recusado", icon: XCircle, className: "border-destructive text-destructive" },
};

const Orders = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [openChat, setOpenChat] = useState<string | null>(null);

  const [reviewOrder, setReviewOrder] = useState<Order | null>(null);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [savingReview, setSavingReview] = useState(false);

  const handleSaveReview = async () => {
    if (!reviewOrder || !user) return;
    if (!comment.trim()) return toast.error("Escreva um comentário.");
    setSavingReview(true);
    const { error } = await supabase.from("reviews").insert({
      product_id: reviewOrder.product_id, // Wait, I don't have product_id in the select query! Let me add it.
      user_id: user.id,
      rating,
      comment: comment.trim(),
    });
    setSavingReview(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Avaliação enviada! Ela será analisada pela equipe.");
      setReviewOrder(null);
      setComment("");
      setRating(5);
    }
  };

  useEffect(() => {
    document.title = "Meus pedidos — 77 Coins";
    if (!authLoading && !user) {
      navigate("/auth");
      return;
    }
    if (!user) return;
    supabase
      .from("orders")
      .select("id, product_name, product_id, amount, status, checkout_url, admin_notes, created_at")
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
            <Button onClick={() => navigate("/produtos")}>Explorar produtos</Button>
          </div>
        ) : (
          <div className="space-y-3">
            {orders.map((o) => {
              const cfg = statusConfig[o.status];
              const Icon = cfg.icon;
              const chatOpen = openChat === o.id;
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
                  <div className="flex items-center justify-between gap-4 flex-wrap">
                    <p className="font-display text-xl font-bold text-primary">
                      R$ {Number(o.amount).toFixed(2).replace(".", ",")}
                    </p>
                    <div className="flex gap-2">
                      {o.status === "pending" && o.checkout_url && (
                        <Button variant="outline" size="sm" asChild>
                          <a href={o.checkout_url} target="_blank" rel="noopener noreferrer">
                            Ir para checkout
                          </a>
                        </Button>
                      )}
                      {(o.status === "approved" || o.status === "delivered") && (
                        <Button size="sm" variant="outline" onClick={() => setOpenChat(chatOpen ? null : o.id)}>
                          <MessageSquare className="h-4 w-4" />
                          {chatOpen ? "Fechar chat" : "Abrir chat"}
                        </Button>
                      )}
                      {o.status === "delivered" && (
                        <Button size="sm" onClick={() => setReviewOrder(o)}>
                          <Star className="h-4 w-4" /> Avaliar Produto
                        </Button>
                      )}
                    </div>
                  </div>
                  {o.admin_notes && (
                    <div className="mt-3 pt-3 border-t border-border text-sm">
                      <span className="text-muted-foreground">Mensagem do admin: </span>
                      {o.admin_notes}
                    </div>
                  )}
                  {chatOpen && (o.status === "approved" || o.status === "delivered") && (
                    <div className="mt-4">
                      <OrderChat orderId={o.id} productName={o.product_name} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Dialog open={!!reviewOrder} onOpenChange={(o) => !o && setReviewOrder(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Avaliar Produto</DialogTitle>
            <DialogDescription>Deixe sua avaliação para {reviewOrder?.product_name}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex justify-center gap-2">
              {[1, 2, 3, 4, 5].map((r) => (
                <button key={r} type="button" onClick={() => setRating(r)}>
                  <Star className={`h-8 w-8 ${rating >= r ? "fill-primary text-primary" : "text-muted-foreground"}`} />
                </button>
              ))}
            </div>
            <Textarea
              placeholder="Escreva seu comentário sobre o produto..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={4}
            />
            <Button className="w-full" onClick={handleSaveReview} disabled={savingReview}>
              {savingReview && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Enviar Avaliação
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Orders;
