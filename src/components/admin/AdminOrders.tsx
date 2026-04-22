import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CheckCircle2, Clock, XCircle, Loader2, MessageSquare, Package } from "lucide-react";
import { toast } from "sonner";
import { OrderChat } from "@/components/OrderChat";

// "delivered" não existe no enum do banco. Usamos status "approved" + prefixo em admin_notes
const DELIVERED_MARKER = "[ENTREGUE]";

interface Order {
  id: string;
  product_name: string;
  amount: number;
  status: "pending" | "approved" | "rejected";
  checkout_url: string | null;
  external_id: string | null;
  admin_notes: string | null;
  created_at: string;
  user_id: string;
}

// Helpers para detectar/gerenciar o marcador de "entregue"
const isDelivered = (o: Order) =>
  o.status === "approved" && !!o.admin_notes?.startsWith(DELIVERED_MARKER);

const noteWithoutMarker = (notes: string | null) =>
  notes?.replace(DELIVERED_MARKER, "").trim() || null;

type UIStatus = "pending" | "approved" | "delivered" | "rejected" | "all";

export const AdminOrders = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [filter, setFilter] = useState<UIStatus>("pending");
  const [acting, setActing] = useState<Order | null>(null);
  const [action, setAction] = useState<"approved" | "rejected" | "delivered">("approved");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [openChat, setOpenChat] = useState<string | null>(null);
  const [usernames, setUsernames] = useState<Record<string, string>>({});

  const load = async () => {
    // Para "delivered", buscamos approved e filtramos no cliente
    let q = supabase.from("orders").select("*").order("created_at", { ascending: false });
    if (filter === "delivered") {
      q = q.eq("status", "approved");
    } else if (filter !== "all") {
      q = q.eq("status", filter);
    }
    const { data } = await q;
    let list = (data as Order[]) || [];

    // Filtra no cliente para separar "approved real" de "delivered"
    if (filter === "approved") {
      list = list.filter((o) => !isDelivered(o));
    } else if (filter === "delivered") {
      list = list.filter((o) => isDelivered(o));
    }

    setOrders(list);

    const uids: string[] = Array.from(new Set(list.map((o) => o.user_id)));
    if (uids.length) {
      const { data: profs } = await supabase.from("profiles").select("id, username").in("id", uids);
      const map: Record<string, string> = {};
      (profs || []).forEach((p: any) => (map[p.id] = p.username));
      setUsernames(map);
    }
  };

  useEffect(() => {
    load();

    // Realtime: novos pedidos e mudanças de status aparecem sem F5
    const channel = supabase
      .channel("admin-orders-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "orders" },
        () => {
          // Reload for inserts to get full data including joins
          load();
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "orders" },
        (payload) => {
          const updated = payload.new as Order;
          setOrders((prev) => {
            const exists = prev.some((o) => o.id === updated.id);
            if (!exists) return prev; // different filter view — ignore
            return prev.map((o) => (o.id === updated.id ? { ...o, ...updated } : o));
          });
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "orders" },
        (payload) => {
          setOrders((prev) => prev.filter((o) => o.id !== (payload.old as any).id));
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [filter]);

  const openAction = (o: Order, a: "approved" | "rejected" | "delivered") => {
    setActing(o);
    setAction(a);
    // Remove o marcador ao abrir o modal para edição
    setNotes(noteWithoutMarker(o.admin_notes) || "");
  };

  const handleSave = async () => {
    if (!acting) return;
    setSaving(true);

    // Para "delivered", salvamos como approved + prefixo no admin_notes
    const dbStatus = action === "delivered" ? "approved" : action;
    const dbNotes =
      action === "delivered"
        ? `${DELIVERED_MARKER}${notes.trim() ? " " + notes.trim() : ""}`
        : notes.trim() || null;

    const { error } = await supabase
      .from("orders")
      .update({ status: dbStatus, admin_notes: dbNotes })
      .eq("id", acting.id);

    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(
      action === "approved" ? "Pedido aprovado" :
      action === "delivered" ? "Pedido marcado como entregue" :
      "Pedido recusado"
    );
    setActing(null);
    setNotes("");
    load();
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Tem certeza que deseja excluir este pedido?")) return;

    const { error } = await supabase.from("orders").delete().eq("id", id);
    
    if (error) {
      toast.error("Erro ao excluir no banco: " + error.message);
    } else {
      setOrders((prev) => prev.filter((o) => o.id !== id));
      toast.success("Pedido excluído definitivamente.");
    }
  };

  const filters: UIStatus[] = ["pending", "approved", "delivered", "rejected", "all"];
  const filterLabel: Record<UIStatus, string> = {
    pending: "Em análise",
    approved: "Aprovados",
    delivered: "Entregues",
    rejected: "Recusados",
    all: "Todos",
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap">
        {filters.map((f) => (
          <Button key={f} variant={filter === f ? "default" : "outline"} size="sm" onClick={() => setFilter(f)}>
            {filterLabel[f]}
          </Button>
        ))}
      </div>

      <div className="rounded-xl border border-border bg-card divide-y divide-border">
        {orders.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground text-center">Nenhum pedido</p>
        ) : (
          orders.map((o) => {
            const delivered = isDelivered(o);
            const displayNotes = noteWithoutMarker(o.admin_notes);

            return (
              <div key={o.id} className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <p className="font-medium">{o.product_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(o.created_at).toLocaleString("pt-BR")} · Cliente:{" "}
                      <span className="text-foreground font-medium">
                        {usernames[o.user_id] || o.user_id.slice(0, 8)}
                      </span>
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <p className="font-display text-lg font-bold text-primary">
                      R$ {Number(o.amount).toFixed(2).replace(".", ",")}
                    </p>
                    <Badge variant="outline" className="gap-1">
                      {o.status === "pending" && <><Clock className="h-3 w-3" /> Em análise</>}
                      {o.status === "approved" && !delivered && <><CheckCircle2 className="h-3 w-3 text-success" /> Aprovado</>}
                      {delivered && <><Package className="h-3 w-3 text-primary" /> Entregue</>}
                      {o.status === "rejected" && <><XCircle className="h-3 w-3 text-destructive" /> Recusado</>}
                    </Badge>
                  </div>
                </div>

                {displayNotes && (
                  <p className="text-sm text-muted-foreground italic">{displayNotes}</p>
                )}

                {o.status === "pending" && (
                  <div className="flex gap-2 pt-2 flex-wrap">
                    <Button size="sm" onClick={() => openAction(o, "approved")}>
                      <CheckCircle2 className="h-4 w-4" /> Aprovar
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => openAction(o, "rejected")}>
                      <XCircle className="h-4 w-4" /> Recusar
                    </Button>
                    <Button size="sm" variant="ghost" className="text-destructive" onClick={() => handleDelete(o.id)}>
                      Excluir
                    </Button>
                    {o.checkout_url && (
                      <Button size="sm" variant="outline" asChild>
                        <a href={o.checkout_url} target="_blank" rel="noopener noreferrer">Checkout</a>
                      </Button>
                    )}
                  </div>
                )}

                {o.status === "approved" && !delivered && (
                  <div className="flex gap-2 pt-2 flex-wrap">
                    <Button size="sm" onClick={() => openAction(o, "delivered")}>
                      <Package className="h-4 w-4" /> Marcar como Entregue
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setOpenChat(openChat === o.id ? null : o.id)}>
                      <MessageSquare className="h-4 w-4" />
                      {openChat === o.id ? "Fechar chat" : "Abrir chat com cliente"}
                    </Button>
                    <Button size="sm" variant="ghost" className="text-destructive" onClick={() => handleDelete(o.id)}>
                      Excluir
                    </Button>
                  </div>
                )}

                {(delivered || o.status === "rejected") && (
                  <div className="pt-2 flex gap-2">
                    <Button size="sm" variant="ghost" className="text-destructive" onClick={() => handleDelete(o.id)}>
                      Excluir
                    </Button>
                  </div>
                )}

                {o.status === "approved" && openChat === o.id && (
                  <div className="mt-3">
                    <OrderChat orderId={o.id} productName={o.product_name} />
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      <Dialog open={!!acting} onOpenChange={(o) => !o && setActing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {action === "approved" ? "Aprovar pedido" :
               action === "delivered" ? "Marcar como Entregue" :
               "Recusar pedido"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">{acting?.product_name}</p>
            <Textarea
              placeholder="Mensagem para o cliente (opcional)"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
            />
            <Button className="w-full" onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Confirmar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
