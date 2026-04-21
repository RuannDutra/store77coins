import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Star, Check, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface Review {
  id: string;
  product_id: string;
  user_id: string;
  rating: number;
  comment: string;
  approved: boolean;
  created_at: string;
  products?: { name: string } | null;
}

export const AdminReviews = () => {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [filter, setFilter] = useState<"pending" | "approved" | "all">("pending");
  const [usernames, setUsernames] = useState<Record<string, string>>({});

  const load = async () => {
    let q = supabase
      .from("reviews")
      .select("*, products(name)")
      .order("created_at", { ascending: false });
    if (filter === "pending") q = q.eq("approved", false);
    else if (filter === "approved") q = q.eq("approved", true);

    const { data } = await q;
    const list = (data as any) || [];
    setReviews(list);

    const uids: string[] = Array.from(new Set(list.map((r: Review) => r.user_id as string)));
    if (uids.length) {
      const { data: profs } = await supabase.from("profiles").select("id, username").in("id", uids);
      const map: Record<string, string> = {};
      (profs || []).forEach((p: any) => (map[p.id] = p.username));
      setUsernames(map);
    }
  };

  useEffect(() => { load(); }, [filter]);

  const approve = async (id: string) => {
    const { error } = await supabase.from("reviews").update({ approved: true }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Avaliação aprovada");
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Remover esta avaliação?")) return;
    const { error } = await supabase.from("reviews").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Removida");
    load();
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {(["pending", "approved", "all"] as const).map((f) => (
          <Button key={f} variant={filter === f ? "default" : "outline"} size="sm" onClick={() => setFilter(f)}>
            {f === "pending" ? "Aguardando" : f === "approved" ? "Aprovadas" : "Todas"}
          </Button>
        ))}
      </div>

      <div className="rounded-xl border border-border bg-card divide-y divide-border">
        {reviews.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground text-center">Nenhuma avaliação</p>
        ) : (
          reviews.map((r) => (
            <div key={r.id} className="p-4 space-y-2">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">{r.products?.name || "Produto removido"}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="flex">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star key={i} className={`h-3.5 w-3.5 ${i < r.rating ? "fill-primary text-primary" : "text-muted"}`} />
                      ))}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      por {usernames[r.user_id] || "..."} · {new Date(r.created_at).toLocaleString("pt-BR")}
                    </span>
                  </div>
                </div>
                <Badge variant="outline" className={r.approved ? "border-success text-success" : "border-warning text-warning"}>
                  {r.approved ? "Aprovada" : "Pendente"}
                </Badge>
              </div>
              <p className="text-sm">{r.comment}</p>
              <div className="flex gap-2 pt-1">
                {!r.approved && (
                  <Button size="sm" onClick={() => approve(r.id)}>
                    <Check className="h-4 w-4" /> Aprovar
                  </Button>
                )}
                <Button size="sm" variant="outline" onClick={() => remove(r.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" /> Remover
                </Button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
