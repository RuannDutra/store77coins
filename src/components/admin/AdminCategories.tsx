import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Trash2, Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Category {
  id: string;
  name: string;
  slug: string;
}

const slugify = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export const AdminCategories = () => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  const load = async () => {
    const { data } = await supabase.from("categories").select("*").order("name");
    setCategories(data || []);
  };

  useEffect(() => { load(); }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (trimmed.length < 2) return toast.error("Nome muito curto");
    setLoading(true);
    const { error } = await supabase.from("categories").insert({ name: trimmed, slug: slugify(trimmed) });
    setLoading(false);
    if (error) return toast.error(error.message);
    setName("");
    toast.success("Categoria criada");
    load();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Excluir categoria?")) return;
    const { error } = await supabase.from("categories").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Excluída");
    load();
  };

  return (
    <div className="space-y-6 max-w-xl">
      <form onSubmit={handleAdd} className="rounded-xl border border-border bg-card p-5 space-y-4">
        <Label htmlFor="cat">Nova categoria</Label>
        <div className="flex gap-2">
          <Input id="cat" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Free Fire" />
          <Button type="submit" disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Adicionar
          </Button>
        </div>
      </form>

      <div className="rounded-xl border border-border bg-card divide-y divide-border">
        {categories.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground text-center">Nenhuma categoria cadastrada</p>
        ) : (
          categories.map((c) => (
            <div key={c.id} className="flex items-center justify-between p-4">
              <div>
                <p className="font-medium">{c.name}</p>
                <p className="text-xs text-muted-foreground">{c.slug}</p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => handleDelete(c.id)}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
