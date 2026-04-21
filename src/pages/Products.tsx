import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Navbar } from "@/components/Navbar";
import { ProductCard } from "@/components/ProductCard";
import { Button } from "@/components/ui/button";
import { Coins } from "lucide-react";

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

const Products = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    document.title = "Produtos — 77 Coins";
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

      <section className="border-b border-border">
        <div className="container py-8">
          <h1 className="font-display text-3xl md:text-4xl font-bold mb-2">Produtos</h1>
          <p className="text-muted-foreground">Escolha sua categoria e finalize com segurança.</p>
        </div>
      </section>

      {categories.length > 0 && (
        <section className="border-b border-border sticky top-16 bg-background/95 backdrop-blur z-10">
          <div className="container py-3 overflow-x-auto">
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

      <section className="container py-10">
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="aspect-[3/4] rounded-xl bg-card animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            <Coins className="h-12 w-12 mx-auto mb-4 opacity-30" />
            <p>Nenhum produto disponível nesta categoria.</p>
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
    </div>
  );
};

export default Products;
