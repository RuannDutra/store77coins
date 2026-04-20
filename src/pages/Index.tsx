import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Navbar } from "@/components/Navbar";
import { ProductCard } from "@/components/ProductCard";
import { Button } from "@/components/ui/button";
import { Coins, Shield, Zap } from "lucide-react";

interface Product {
  id: string;
  name: string;
  price: number;
  image_url: string | null;
  delivery_type: "automatic" | "manual";
  category_id: string | null;
  categories: { id: string; name: string } | null;
}

interface Category {
  id: string;
  name: string;
  slug: string;
}

const Index = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    document.title = "77 Coins — Marketplace de itens e moedas";
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute("content", "Compre moedas, contas e itens com entrega rápida e segura na 77 Coins.");

    const load = async () => {
      const [{ data: prods }, { data: cats }] = await Promise.all([
        supabase
          .from("products")
          .select("id, name, price, image_url, delivery_type, category_id, categories(id, name)")
          .eq("active", true)
          .order("created_at", { ascending: false }),
        supabase.from("categories").select("id, name, slug").order("name"),
      ]);
      setProducts((prods as any) || []);
      setCategories(cats || []);
      setLoading(false);
    };
    load();
  }, []);

  const filtered = activeCategory
    ? products.filter((p) => p.category_id === activeCategory)
    : products;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border">
        <div className="absolute inset-0 bg-glow pointer-events-none" />
        <div className="container relative py-16 md:py-24">
          <div className="mx-auto max-w-3xl text-center animate-fade-in">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/5 px-4 py-1.5 text-xs font-medium text-primary mb-6">
              <Zap className="h-3.5 w-3.5" />
              MARKETPLACE OFICIAL
            </div>
            <h1 className="font-display text-5xl md:text-7xl font-bold tracking-tight leading-[1.05] mb-6">
              Suas moedas,<br />
              <span className="text-gradient-yellow">entregues no jato.</span>
            </h1>
            <p className="text-lg text-muted-foreground max-w-xl mx-auto mb-8">
              Compre itens, contas e recargas com checkout seguro via GOAT Pay e suporte direto com o vendedor.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-muted-foreground">
              <div className="flex items-center gap-2"><Shield className="h-4 w-4 text-primary" /> Pagamento seguro</div>
              <div className="flex items-center gap-2"><Zap className="h-4 w-4 text-primary" /> Entrega rápida</div>
              <div className="flex items-center gap-2"><Coins className="h-4 w-4 text-primary" /> Melhores preços</div>
            </div>
          </div>
        </div>
      </section>

      {/* Categories */}
      {categories.length > 0 && (
        <section className="border-b border-border">
          <div className="container py-4 overflow-x-auto">
            <div className="flex gap-2 min-w-max">
              <Button
                variant={activeCategory === null ? "default" : "outline"}
                size="sm"
                onClick={() => setActiveCategory(null)}
              >
                Todos
              </Button>
              {categories.map((cat) => (
                <Button
                  key={cat.id}
                  variant={activeCategory === cat.id ? "default" : "outline"}
                  size="sm"
                  onClick={() => setActiveCategory(cat.id)}
                >
                  {cat.name}
                </Button>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Products grid */}
      <section className="container py-12">
        <h2 className="font-display text-2xl font-bold mb-6">Produtos em destaque</h2>
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="aspect-[3/4] rounded-xl bg-card animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            <Coins className="h-12 w-12 mx-auto mb-4 opacity-30" />
            <p>Nenhum produto disponível ainda.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filtered.map((p) => (
              <ProductCard
                key={p.id}
                id={p.id}
                name={p.name}
                price={Number(p.price)}
                image_url={p.image_url}
                delivery_type={p.delivery_type}
                category={p.categories}
              />
            ))}
          </div>
        )}
      </section>

      <footer className="border-t border-border py-8">
        <div className="container text-center text-sm text-muted-foreground">
          © {new Date().getFullYear()} 77 Coins · Todos os direitos reservados
        </div>
      </footer>
    </div>
  );
};

export default Index;
