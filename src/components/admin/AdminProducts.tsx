import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Edit, Loader2, Plus, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";

interface Category { id: string; name: string; }
interface Product {
  id: string;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  category_id: string | null;
  delivery_type: "automatic" | "manual";
  active: boolean;
  product_secrets?: {
    checkout_url: string | null;
    variants_urls: { name: string; checkout_url: string }[] | null;
  } | null;
  variants?: { name: string; price: number }[] | null;
  categories?: { name: string } | null;
}

const empty = {
  name: "",
  description: "",
  price: "",
  image_url: "",
  category_id: "",
  delivery_type: "manual" as "automatic" | "manual",
  active: true,
  checkout_url: "",
  type: "normal" as "normal" | "dynamic",
  variants: [] as { name: string; price: string; checkout_url: string }[],
};

export const AdminProducts = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const load = async () => {
    try {
      setProducts([]); // Limpa para mostrar loading visual se necessário
      
      const [prodsRes, catsRes] = await Promise.all([
        supabase.from("products").select("*").order("created_at", { ascending: false }),
        supabase.from("categories").select("id, name").order("name"),
      ]);

      if (prodsRes.error) throw prodsRes.error;
      
      const prods = prodsRes.data || [];
      const cats = catsRes.data || [];

      // Busca segredos separadamente para evitar erro de relacionamento no cache do Supabase
      const { data: secrets, error: secretsError } = await supabase
        .from("product_secrets")
        .select("*")
        .in("product_id", prods.map(p => p.id));

      if (secretsError) {
        console.warn("Erro ao buscar segredos:", secretsError);
      }

      // Une os produtos com seus segredos e categorias
      const merged = prods.map(p => ({
        ...p,
        product_secrets: secrets?.find(s => s.product_id === p.id) || null,
        categories: cats.find(c => c.id === p.category_id) || null
      }));

      setProducts(merged as any);
      setCategories(cats);
    } catch (err: any) {
      console.error("Erro no AdminProducts:", err);
      toast.error("Erro ao carregar: " + (err.message || "Erro desconhecido"));
    }
  };

  useEffect(() => { load(); }, []);

  const openNew = () => {
    setEditing(null);
    setForm(empty);
    setOpen(true);
  };

  const openEdit = (p: Product) => {
    setEditing(p);
    // PostgREST returns child tables as arrays in 1:1 if not explicitly cast, handle both cases
    const secretsData = Array.isArray(p.product_secrets) ? p.product_secrets[0] : p.product_secrets;
    const secrets = secretsData || { checkout_url: "", variants_urls: [] };
    setForm({
      name: p.name,
      description: p.description || "",
      price: String(p.price),
      image_url: p.image_url || "",
      category_id: p.category_id || "",
      delivery_type: p.delivery_type,
      active: p.active,
      checkout_url: secrets.checkout_url || "",
      type: secrets.variants_urls && secrets.variants_urls.length > 0 ? "dynamic" : "normal",
      variants: p.variants ? p.variants.map((v: any, idx: number) => ({
        ...v,
        price: String(v.price),
        checkout_url: secrets.variants_urls?.[idx]?.checkout_url || ""
      })) : [],
    });
    setOpen(true);
  };

  const addVariant = () => {
    setForm(f => ({ ...f, variants: [...f.variants, { name: "", price: "", checkout_url: "" }] }));
  };

  const updateVariant = (index: number, field: string, value: string) => {
    const newVariants = [...form.variants];
    newVariants[index] = { ...newVariants[index], [field]: value };
    setForm(f => ({ ...f, variants: newVariants }));
  };

  const removeVariant = (index: number) => {
    setForm(f => ({ ...f, variants: f.variants.filter((_, i) => i !== index) }));
  };

  const handleUpload = async (file: File) => {
    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { error } = await supabase.storage.from("product-images").upload(path, file);
    if (error) {
      toast.error("Erro no upload");
      setUploading(false);
      return;
    }
    const { data } = supabase.storage.from("product-images").getPublicUrl(path);
    setForm((f) => ({ ...f, image_url: data.publicUrl }));
    setUploading(false);
    toast.success("Imagem enviada");
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return toast.error("Nome obrigatório");
    
    let price = 0;
    if (form.type === "normal") {
      price = parseFloat(form.price);
      if (isNaN(price) || price < 0) return toast.error("Preço inválido");
    } else {
      if (form.variants.length === 0) return toast.error("Adicione pelo menos uma opção");
      price = Math.min(...form.variants.map(v => parseFloat(v.price) || 0));
    }

    setSaving(true);
    const payload: any = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      price,
      image_url: form.image_url || null,
      category_id: form.category_id || null,
      delivery_type: form.delivery_type,
      active: form.active,
      checkout_url: null, // Segredo salvo na tabela product_secrets
      variants: form.type === "dynamic" 
        ? form.variants.map(v => ({ name: v.name.trim(), price: parseFloat(v.price) })) 
        : null,
    };

    const { data: savedProd, error: prodError } = editing
      ? await supabase.from("products").update(payload).eq("id", editing.id).select().single()
      : await supabase.from("products").insert(payload).select().single();

    if (prodError) {
      setSaving(false);
      return toast.error(prodError.message);
    }

    // Save secrets
    if (savedProd) {
      const secretsPayload = {
        product_id: savedProd.id,
        checkout_url: form.type === "normal" ? form.checkout_url.trim() || null : null,
        variants_urls: form.type === "dynamic" ? form.variants.map(v => ({ name: v.name.trim(), checkout_url: v.checkout_url.trim() })) : null,
      };
      await supabase.from("product_secrets").upsert(secretsPayload);
    }

    setSaving(false);
    toast.success(editing ? "Produto atualizado" : "Produto criado");
    setOpen(false);
    load();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) {
      toast.error("Erro ao excluir no banco: " + error.message);
      load(); // Recarrega para restaurar o item se falhou
    } else {
      setProducts((prev) => prev.filter((p) => p.id !== id));
      toast.success("Produto removido definitivamente.");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">{products.length} produto(s)</p>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={openNew}><Plus className="h-4 w-4" /> Novo produto</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editing ? "Editar produto" : "Novo produto"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSave} className="space-y-4">
              <div className="space-y-2">
                <Label>Nome</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
              </div>
              <div className="space-y-2">
                <Label>Descrição</Label>
                <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={4} />
              </div>
              <div className="space-y-2">
                <Label>Tipo de Anúncio</Label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="type" checked={form.type === "normal"} onChange={() => setForm({ ...form, type: "normal" })} />
                    Normal (Único preço e link)
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="type" checked={form.type === "dynamic"} onChange={() => setForm({ ...form, type: "dynamic" })} />
                    Dinâmico (Múltiplas opções)
                  </label>
                </div>
              </div>
              {form.type === "normal" ? (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Preço (R$)</Label>
                    <Input type="number" step="0.01" min="0" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} required />
                  </div>
                  <div className="space-y-2">
                    <Label>URL do checkout (GOAT Pay)</Label>
                    <Input
                      type="url"
                      placeholder="https://checkout.goatpay.com/..."
                      value={form.checkout_url}
                      onChange={(e) => setForm({ ...form, checkout_url: e.target.value })}
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-3 border p-4 rounded-lg bg-muted/50">
                  <div className="flex justify-between items-center">
                    <Label>Opções do Produto</Label>
                    <Button type="button" size="sm" variant="outline" onClick={addVariant}>
                      <Plus className="h-4 w-4 mr-1" /> Add Opção
                    </Button>
                  </div>
                  {form.variants.map((v, idx) => (
                    <div key={idx} className="flex gap-2 items-start bg-card p-3 rounded border">
                      <div className="flex-1 space-y-2">
                        <Input placeholder="Nome da opção (ex: 1000 Coins)" value={v.name} onChange={(e) => updateVariant(idx, "name", e.target.value)} required />
                        <div className="flex gap-2">
                          <Input className="w-24" type="number" step="0.01" placeholder="Preço" value={v.price} onChange={(e) => updateVariant(idx, "price", e.target.value)} required />
                          <Input className="flex-1" type="url" placeholder="Link de checkout" value={v.checkout_url} onChange={(e) => updateVariant(idx, "checkout_url", e.target.value)} required />
                        </div>
                      </div>
                      <Button type="button" variant="ghost" size="icon" className="text-destructive mt-1" onClick={() => removeVariant(idx)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  {form.variants.length === 0 && <p className="text-sm text-muted-foreground text-center py-2">Nenhuma opção adicionada</p>}
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Categoria</Label>
                  <Select value={form.category_id} onValueChange={(v) => setForm({ ...form, category_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                    <SelectContent>
                      {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Tipo de entrega</Label>
                  <Select value={form.delivery_type} onValueChange={(v: any) => setForm({ ...form, delivery_type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="manual">Manual</SelectItem>
                      <SelectItem value="automatic">Automática</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Imagem</Label>
                <div className="flex items-center gap-3">
                  {form.image_url && <img src={form.image_url} alt="" className="h-16 w-16 rounded object-cover" />}
                  <label className="flex-1">
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])}
                    />
                    <div className="flex items-center justify-center gap-2 border border-dashed border-border rounded-lg p-3 cursor-pointer hover:border-primary transition-colors text-sm">
                      {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                      {uploading ? "Enviando..." : "Enviar imagem"}
                    </div>
                  </label>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="active">Ativo (visível na loja)</Label>
                <Switch id="active" checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} />
              </div>
              <Button type="submit" className="w-full" disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                Salvar
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="rounded-xl border border-border bg-card divide-y divide-border">
        {products.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground text-center">Nenhum produto</p>
        ) : (
          products.map((p) => (
            <div key={p.id} className="flex items-center gap-4 p-4">
              <div className="h-14 w-14 rounded-lg bg-muted overflow-hidden flex-shrink-0">
                {p.image_url && <img src={p.image_url} alt={p.name} className="h-full w-full object-cover" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{p.name}</p>
                <p className="text-xs text-muted-foreground">
                  {p.categories?.name || "Sem categoria"} · R$ {Number(p.price).toFixed(2)} · {p.active ? "Ativo" : "Inativo"}
                </p>
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="sm" onClick={() => openEdit(p)}><Edit className="h-4 w-4" /></Button>
                <Button variant="ghost" size="sm" onClick={() => handleDelete(p.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
