import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Navbar } from "@/components/Navbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { OrderChat } from "@/components/OrderChat";
import { CheckCircle2, Clock, MessageSquare, ShoppingBag, XCircle, Star, Loader2, Package } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

const DELIVERED_MARKER = "[ENTREGUE]";

interface Order {
  id: string;
  product_name: string;
  product_id: string;
  amount: number;
  status: "pending" | "approved" | "rejected";
  checkout_url: string | null;
  admin_notes: string | null;
  created_at: string;
}

const isDelivered = (o: Order) =>
  o.status === "approved" && !!o.admin_notes?.startsWith(DELIVERED_MARKER);

const noteWithoutMarker = (notes: string | null) =>
  notes?.replace(DELIVERED_MARKER, "").trim() || null;

const Orders = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [openChat, setOpenChat] = useState<string | null>(null);

  // IDs de pedidos que o usuário já avaliou
  const [reviewedIds, setReviewedIds] = useState<Set<string>>(new Set());

  const [reviewOrder, setReviewOrder] = useState<Order | null>(null);
  const [rating, setRating] = useState(5);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState("");
  const [savingReview, setSavingReview] = useState(false);

  const loadOrders = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("orders")
      .select("id, product_name, product_id, amount, status, checkout_url, admin_notes, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    const list = (data as Order[]) || [];
    setOrders(list);
    setLoading(false);

    // Verifica quais pedidos já foram avaliados (busca reviews do usuário para esses product_ids)
    const productIds = list.map((o) => o.product_id).filter(Boolean);
    if (productIds.length && user) {
      const { data: myReviews } = await supabase
        .from("reviews")
        .select("product_id")
        .eq("user_id", user.id)
        .in("product_id", productIds);
      const reviewedProductIds = new Set((myReviews || []).map((r: any) => r.product_id));
      // Mapeia de volta para order ids
      const ids = new Set(list.filter((o) => reviewedProductIds.has(o.product_id)).map((o) => o.id));
      setReviewedIds(ids);
    }
  };

  useEffect(() => {
    document.title = "Meus pedidos — 77 Coins";
    if (!authLoading && !user) {
      navigate("/auth");
      return;
    }
    if (!user) return;
    loadOrders();

    // Realtime: atualiza automaticamente quando o admin muda o status do pedido
    const channel = supabase
      .channel(`orders-user-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "orders",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const updated = payload.new as Order;
          setOrders((prev) =>
            prev.map((o) => (o.id === updated.id ? { ...o, ...updated } : o))
          );
        }
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "orders",
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          // New order inserted — reload full list
          loadOrders();
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, authLoading, navigate]);

  const handleSaveReview = async () => {
    if (!reviewOrder || !user) return;
    if (rating < 1) return toast.error("Escolha de 1 a 5 estrelas.");
    if (!comment.trim()) return toast.error("Escreva um comentário.");
    if (comment.trim().length > 100) return toast.error("Máximo 100 caracteres.");

    setSavingReview(true);
    const { error } = await supabase.from("reviews").insert({
      product_id: reviewOrder.product_id,
      user_id: user.id,
      rating,
      comment: comment.trim(),
    });
    setSavingReview(false);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Avaliação enviada! Ela será analisada pela equipe.");
      setReviewedIds((prev) => new Set([...prev, reviewOrder.id]));
      setReviewOrder(null);
      setComment("");
      setRating(5);
    }
  };

  const openReview = (o: Order) => {
    setReviewOrder(o);
    setRating(5);
    setHover(0);
    setComment("");
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container py-8 max-w-3xl">
        <h1 className="font-display text-3xl font-bold mb-6">Meus pedidos</h1>

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : orders.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground border border-border rounded-2xl">
            <ShoppingBag className="h-12 w-12 mx-auto mb-4 opacity-30" />
            <p className="mb-4">Você ainda não fez nenhum pedido.</p>
            <Button onClick={() => navigate("/produtos")}>Explorar produtos</Button>
          </div>
        ) : (
          <div className="space-y-3">
            {orders.map((o) => {
              const delivered = isDelivered(o);
              const displayNotes = noteWithoutMarker(o.admin_notes);
              const chatOpen = openChat === o.id;
              const alreadyReviewed = reviewedIds.has(o.id);

              // Determina o status visual
              let badgeClass = "border-border text-muted-foreground";
              let BadgeIcon = Clock;
              let badgeLabel = "Em análise";
              if (o.status === "rejected") { badgeClass = "border-destructive text-destructive"; BadgeIcon = XCircle; badgeLabel = "Recusado"; }
              else if (delivered) { badgeClass = "border-primary text-primary"; BadgeIcon = Package; badgeLabel = "Entregue"; }
              else if (o.status === "approved") { badgeClass = "border-success text-success"; BadgeIcon = CheckCircle2; badgeLabel = "Aprovado"; }

              return (
                <div key={o.id} className="rounded-xl border border-border bg-card p-5">
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div>
                      <h3 className="font-display font-semibold">{o.product_name}</h3>
                      <p className="text-sm text-muted-foreground">
                        {new Date(o.created_at).toLocaleString("pt-BR")}
                      </p>
                    </div>
                    <Badge variant="outline" className={`gap-1 ${badgeClass}`}>
                      <BadgeIcon className="h-3 w-3" /> {badgeLabel}
                    </Badge>
                  </div>

                  <div className="flex items-center justify-between gap-4 flex-wrap">
                    <p className="font-display text-xl font-bold text-primary">
                      R$ {Number(o.amount).toFixed(2).replace(".", ",")}
                    </p>
                    <div className="flex gap-2 flex-wrap">
                      {o.status === "pending" && o.checkout_url && (
                        <Button variant="outline" size="sm" asChild>
                          <a href={o.checkout_url} target="_blank" rel="noopener noreferrer">
                            Ir para checkout
                          </a>
                        </Button>
                      )}
                      {(o.status === "approved") && (
                        <Button size="sm" variant="outline" onClick={() => setOpenChat(chatOpen ? null : o.id)}>
                          <MessageSquare className="h-4 w-4" />
                          {chatOpen ? "Fechar chat" : "Abrir chat"}
                        </Button>
                      )}
                      {delivered && !alreadyReviewed && (
                        <Button size="sm" onClick={() => openReview(o)}>
                          <Star className="h-4 w-4" /> Avaliar produto
                        </Button>
                      )}
                      {delivered && alreadyReviewed && (
                        <Badge variant="outline" className="gap-1 text-muted-foreground">
                          <Star className="h-3 w-3 fill-primary text-primary" /> Avaliado
                        </Badge>
                      )}
                    </div>
                  </div>

                  {displayNotes && (
                    <div className="mt-3 pt-3 border-t border-border text-sm">
                      <span className="text-muted-foreground">Mensagem do admin: </span>
                      {displayNotes}
                    </div>
                  )}

                  {chatOpen && o.status === "approved" && (
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

      {/* Modal de avaliação */}
      <Dialog open={!!reviewOrder} onOpenChange={(o) => !o && setReviewOrder(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Avaliar Produto</DialogTitle>
            <DialogDescription>
              Deixe sua avaliação para <strong>{reviewOrder?.product_name}</strong>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {/* Estrelas com hover */}
            <div className="flex justify-center gap-1">
              {[1, 2, 3, 4, 5].map((r) => (
                <button
                  key={r}
                  type="button"
                  onMouseEnter={() => setHover(r)}
                  onMouseLeave={() => setHover(0)}
                  onClick={() => setRating(r)}
                  className="p-1 transition-transform hover:scale-110"
                >
                  <Star
                    className={`h-9 w-9 transition-colors ${
                      r <= (hover || rating) ? "fill-primary text-primary" : "text-muted-foreground"
                    }`}
                  />
                </button>
              ))}
            </div>
            <p className="text-center text-sm text-muted-foreground">
              {rating === 1 ? "Muito ruim" : rating === 2 ? "Ruim" : rating === 3 ? "Regular" : rating === 4 ? "Bom" : "Excelente!"}
            </p>
            <div className="space-y-1">
              <Textarea
                placeholder="Conte sua experiência (até 100 caracteres)"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                maxLength={100}
                rows={3}
              />
              <p className="text-xs text-muted-foreground text-right">{comment.length}/100</p>
            </div>
            <Button className="w-full" onClick={handleSaveReview} disabled={savingReview || rating < 1}>
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
