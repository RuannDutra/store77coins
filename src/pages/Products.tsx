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
  active: boolean;
  categories: { id: string; name: string } | null;
}

interface Category {
  id: string;
  name: string;
  slug: string;
}

interface RatingMap {
  [productId: string]: { avg: number; count: number };
}

const Products = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [ratings, setRatings] = useState<RatingMap>({});

  useEffect(() => {
    document.title = "Produtos — 77 Coins";
    const load = async () => {
      try {
        const [prodsRes, catsRes, revsRes] = await Promise.all([
          supabase
            .from("products")
            .select("id, name, price, image_url, delivery_type, category_id, active, categories(id, name)")
            .eq("active", true)
            .order("created_at", { ascending: false }),
          supabase.from("categories").select("id, name, slug").order("name"),
          supabase.from("reviews").select("product_id, rating").eq("approved", true),
        ]);

        setProducts((prodsRes.data as any) || []);
        setCategories(catsRes.data || []);

        const revs = revsRes.data;

        // Calcula média por produto
        const map: RatingMap = {};
        (revs || []).forEach((r: any) => {
          if (!map[r.product_id]) map[r.product_id] = { avg: 0, count: 0 };
          map[r.product_id].count += 1;
          map[r.product_id].avg += r.rating;
        });
        Object.keys(map).forEach((id) => {
          if (map[id].count > 0) {
            map[id].avg = map[id].avg / map[id].count;
          }
        });
        setRatings(map);

        setLoading(false);
      } catch (err) {
        console.error("Erro ao carregar produtos:", err);
        setLoading(false);
      }
    };
    load();

    const ch = supabase.channel("products-realtime")
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, () => {
        load();
      })
      .subscribe();

    return () => { supabase.removeChannel(ch); };
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

      <div className="container py-10 flex flex-col md:flex-row gap-8">
        {categories.length > 0 && (
          <aside className="w-full md:w-64 shrink-0">
            <div className="sticky top-24 space-y-4">
              <h2 className="font-display font-semibold text-lg">Categorias</h2>
              <div className="flex flex-col gap-1">
                <Button
                  variant={activeCategory === null ? "default" : "ghost"}
                  className="justify-start"
                  onClick={() => setActiveCategory(null)}
                >
                  Todos os Produtos
                </Button>
                {categories.map((cat) => (
                  <Button
                    key={cat.id}
                    variant={activeCategory === cat.id ? "default" : "ghost"}
                    className="justify-start"
                    onClick={() => setActiveCategory(cat.id)}
                  >
                    {cat.name}
                  </Button>
                ))}
              </div>
            </div>
          </aside>
        )}

        <main className="flex-1">
          {loading ? (
            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="aspect-[3/4] rounded-xl bg-card animate-pulse" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-20 text-muted-foreground rounded-2xl border border-border border-dashed bg-card/50">
              <Coins className="h-12 w-12 mx-auto mb-4 opacity-30" />
              <p>Nenhum produto disponível nesta categoria.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filtered.map((p) => (
                <ProductCard
                  key={p.id}
                  id={p.id}
                  name={p.name}
                  price={Number(p.price)}
                  image_url={p.image_url}
                  delivery_type={p.delivery_type}
                  category={p.categories}
                  avgRating={ratings[p.id]?.avg ?? null}
                  reviewCount={ratings[p.id]?.count ?? 0}
                />
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default Products;
