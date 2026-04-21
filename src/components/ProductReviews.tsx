import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Star, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Review {
  id: string;
  user_id: string;
  rating: number;
  comment: string;
  created_at: string;
}

interface Props {
  productId: string;
}

export const ProductReviews = ({ productId }: Props) => {
  const { user } = useAuth();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [usernames, setUsernames] = useState<Record<string, string>>({});
  const [canReview, setCanReview] = useState(false);
  const [alreadyReviewed, setAlreadyReviewed] = useState(false);
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const loadReviews = async () => {
    const { data } = await supabase
      .from("reviews")
      .select("id, user_id, rating, comment, created_at")
      .eq("product_id", productId)
      .eq("approved", true)
      .order("created_at", { ascending: false });
    const list = (data as any) || [];
    setReviews(list);
    const uids: string[] = Array.from(new Set(list.map((r: Review) => r.user_id)));
    if (uids.length) {
      const { data: profs } = await supabase.from("profiles").select("id, username").in("id", uids);
      const map: Record<string, string> = {};
      (profs || []).forEach((p: any) => (map[p.id] = p.username));
      setUsernames(map);
    }
  };

  useEffect(() => {
    loadReviews();
  }, [productId]);

  useEffect(() => {
    if (!user) {
      setCanReview(false);
      setAlreadyReviewed(false);
      return;
    }
    const check = async () => {
      const [{ data: orders }, { data: existing }] = await Promise.all([
        supabase
          .from("orders")
          .select("id")
          .eq("user_id", user.id)
          .eq("product_id", productId)
          .eq("status", "approved")
          .limit(1),
        supabase
          .from("reviews")
          .select("id")
          .eq("user_id", user.id)
          .eq("product_id", productId)
          .maybeSingle(),
      ]);
      setCanReview((orders || []).length > 0);
      setAlreadyReviewed(!!existing);
    };
    check();
  }, [user, productId]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || rating < 1) return toast.error("Escolha de 1 a 5 estrelas");
    const c = comment.trim();
    if (!c) return toast.error("Escreva um comentário");
    if (c.length > 100) return toast.error("Máximo 100 caracteres");

    setSubmitting(true);
    const { error } = await supabase.from("reviews").insert({
      product_id: productId,
      user_id: user.id,
      rating,
      comment: c,
    });
    setSubmitting(false);
    if (error) return toast.error(error.message);
    toast.success("Avaliação enviada! Aguardando aprovação do admin.");
    setAlreadyReviewed(true);
    setRating(0);
    setComment("");
  };

  const avg = reviews.length ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : 0;

  return (
    <div className="mt-12 border-t border-border pt-8">
      <div className="flex items-center justify-between mb-6">
        <h2 className="font-display text-2xl font-bold">Avaliações</h2>
        {reviews.length > 0 && (
          <div className="flex items-center gap-2">
            <div className="flex">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star key={i} className={cn("h-4 w-4", i < Math.round(avg) ? "fill-primary text-primary" : "text-muted")} />
              ))}
            </div>
            <span className="text-sm font-medium">{avg.toFixed(1)} ({reviews.length})</span>
          </div>
        )}
      </div>

      {canReview && !alreadyReviewed && (
        <form onSubmit={submit} className="rounded-xl border border-border bg-card p-5 mb-6 space-y-3">
          <p className="text-sm font-medium">Deixe sua avaliação</p>
          <div className="flex gap-1">
            {Array.from({ length: 5 }).map((_, i) => {
              const v = i + 1;
              return (
                <button
                  key={i}
                  type="button"
                  onMouseEnter={() => setHover(v)}
                  onMouseLeave={() => setHover(0)}
                  onClick={() => setRating(v)}
                  className="p-1"
                >
                  <Star
                    className={cn(
                      "h-7 w-7 transition-colors",
                      v <= (hover || rating) ? "fill-primary text-primary" : "text-muted hover:text-primary/50"
                    )}
                  />
                </button>
              );
            })}
          </div>
          <Textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Conte sua experiência (até 100 caracteres)"
            maxLength={100}
            rows={2}
          />
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">{comment.length}/100</p>
            <Button type="submit" disabled={submitting || rating < 1}>
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Enviar
            </Button>
          </div>
        </form>
      )}

      {alreadyReviewed && (
        <p className="text-sm text-muted-foreground mb-6 italic">
          Você já avaliou este produto. Aguarde a aprovação do admin (caso ainda esteja pendente).
        </p>
      )}

      {reviews.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">
          Ainda não há avaliações para este produto.
        </p>
      ) : (
        <div className="space-y-3">
          {reviews.map((r) => (
            <div key={r.id} className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">{usernames[r.user_id] || "Usuário"}</span>
                  <div className="flex">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star key={i} className={cn("h-3.5 w-3.5", i < r.rating ? "fill-primary text-primary" : "text-muted")} />
                    ))}
                  </div>
                </div>
                <span className="text-xs text-muted-foreground">
                  {new Date(r.created_at).toLocaleDateString("pt-BR")}
                </span>
              </div>
              <p className="text-sm">{r.comment}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
