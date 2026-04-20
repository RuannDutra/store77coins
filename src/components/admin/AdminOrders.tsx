import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CheckCircle2, Clock, XCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";

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
  profiles?: { username: string } | null;
}

export const AdminOrders = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [filter, setFilter] = useState<"pending" | "approved" | "rejected" | "all">("pending");
  const [acting, setActing] = useState<Order | null>(null);
  const [action, setAction] = useState<"approved" | "rejected">("approved");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    let q = supabase.from("orders").select("*").order("created_at", { ascending: false });
    if (filter !== "all") q = q.eq("status", filter);
    const { data } = await q;

    // Fetch usernames separately (RLS allows admin to read all profiles via has_role check on user_roles, but profile RLS is owner-only)
    // We'll fetch via a single in() on profiles using admin role bypass... simplest: just show user_id short
    setOrders((data as any) || []);
  };

  useEffect(() => { load(); }, [filter]);

  const openAction = (o: Order, a: "approved" | "rejected") => {
    setActing(o);
    setAction(a);
    setNotes(o.admin_notes || "");
  };

  const handleSave = async () => {
    if (!acting) return;
    setSaving(true);
    const { error } = await supabase
      .from("orders")
      .update({ status: action, admin_notes: notes.trim() || null })
      .eq("id", acting.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(`Pedido ${action === "approved" ? "aprovado" : "recusado"}`);
    setActing(null);
    setNotes("");
    load();
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap">
        {(["pending", "approved", "rejected", "all"] as const).map((f) => (
          <Button key={f} variant={filter === f ? "default" : "outline"} size="sm" onClick={() => setFilter(f)}>
            {f === "pending" ? "Em análise" : f === "approved" ? "Aprovados" : f === "rejected" ? "Recusados" : "Todos"}
          </Button>
        ))}
      </div>

      <div className="rounded-xl border border-border bg-card divide-y divide-border">
        {orders.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground text-center">Nenhum pedido</p>
        ) : (
          orders.map((o) => (
            <div key={o.id} className="p-4 space-y-3">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <p className="font-medium">{o.product_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(o.created_at).toLocaleString("pt-BR")} · Cliente: {o.user_id.slice(0, 8)}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <p className="font-display text-lg font-bold text-primary">
                    R$ {Number(o.amount).toFixed(2).replace(".", ",")}
                  </p>
                  <Badge variant="outline" className="gap-1">
                    {o.status === "pending" && <><Clock className="h-3 w-3" /> Em análise</>}
                    {o.status === "approved" && <><CheckCircle2 className="h-3 w-3 text-success" /> Aprovado</>}
                    {o.status === "rejected" && <><XCircle className="h-3 w-3 text-destructive" /> Recusado</>}
                  </Badge>
                </div>
              </div>
              {o.admin_notes && <p className="text-sm text-muted-foreground italic">{o.admin_notes}</p>}
              {o.status === "pending" && (
                <div className="flex gap-2 pt-2">
                  <Button size="sm" onClick={() => openAction(o, "approved")}>
                    <CheckCircle2 className="h-4 w-4" /> Aprovar
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => openAction(o, "rejected")}>
                    <XCircle className="h-4 w-4" /> Recusar
                  </Button>
                  {o.checkout_url && (
                    <Button size="sm" variant="outline" asChild>
                      <a href={o.checkout_url} target="_blank" rel="noopener noreferrer">Checkout</a>
                    </Button>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      <Dialog open={!!acting} onOpenChange={(o) => !o && setActing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{action === "approved" ? "Aprovar pedido" : "Recusar pedido"}</DialogTitle>
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
