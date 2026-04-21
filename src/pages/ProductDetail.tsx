import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Clock, Loader2, ShieldCheck, Zap, ArrowLeft } from "lucide-react";
import { ProductReviews } from "@/components/ProductReviews";

interface Product {
  id: string;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  delivery_type: "automatic" | "manual";
  checkout_url: string | null;
  variants?: { name: string; price: number; checkout_url: string }[] | null;
  categories: { name: string } | null;
}

const ProductDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [product, setProduct] = useState<Product | null>(null);
  const [selectedVariant, setSelectedVariant] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState(false);

  useEffect(() => {
    if (!id) return;
    supabase
      .from("products")
      .select("id, name, description, price, image_url, delivery_type, checkout_url, categories(name)")
      .eq("id", id)
      .maybeSingle()
      .then(({ data }) => {
        setProduct(data as any);
        setLoading(false);
        if (data) document.title = `${(data as any).name} — 77 Coins`;
      });
  }, [id]);

  const handleBuy = async () => {
    if (!user) {
      navigate("/auth");
      return;
    }
    if (!product) return;

    const variant = product.variants && selectedVariant !== null ? product.variants[selectedVariant] : null;
    const checkout_url = variant ? variant.checkout_url : product.checkout_url;
    const amount = variant ? variant.price : product.price;
    const product_name = variant ? `${product.name} - ${variant.name}` : product.name;

    if (!checkout_url) {
      toast.error("Checkout indisponível para este produto");
      return;
    }

    setBuying(true);
    const { data, error } = await supabase
      .from("orders")
      .insert({
        user_id: user.id,
        product_id: product.id,
        product_name,
        amount,
        checkout_url,
        status: "pending",
      })
      .select("id")
      .single();

    setBuying(false);

    if (error) {
      toast.error("Erro ao criar pedido");
      return;
    }

    toast.success("Pedido criado! Redirecionando para o checkout...");
    setTimeout(() => {
      window.open(checkout_url, "_blank");
      navigate("/orders");
    }, 800);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container py-20 text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container py-20 text-center">
          <p className="text-muted-foreground">Produto não encontrado</p>
          <Button variant="outline" className="mt-4" onClick={() => navigate("/")}>Voltar</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container py-8">
        <Button variant="ghost" size="sm" onClick={() => navigate("/")} className="mb-6">
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Button>

        <div className="grid md:grid-cols-2 gap-8 lg:gap-12">
          <div className="overflow-hidden rounded-2xl border border-border">
            {product.image_url ? (
              <img src={product.image_url} alt={product.name} className="w-full h-auto block" />
            ) : (
              <div className="flex aspect-square items-center justify-center text-muted-foreground bg-card">
                <span className="font-display text-6xl">77</span>
              </div>
            )}
          </div>

          <div className="flex flex-col">
            {product.categories && (
              <span className="text-xs font-medium uppercase tracking-wider text-primary mb-2">
                {product.categories.name}
              </span>
            )}
            <h1 className="font-display text-3xl md:text-4xl font-bold mb-4">{product.name}</h1>

            <div className="flex items-center gap-3 mb-6">
              <Badge variant="outline" className="gap-1">
                {product.delivery_type === "automatic" ? (
                  <><Zap className="h-3 w-3" /> Entrega automática</>
                ) : (
                  <><Clock className="h-3 w-3" /> Entrega manual</>
                )}
              </Badge>
            </div>

            {product.description && (
              <p className="text-muted-foreground leading-relaxed mb-8 whitespace-pre-wrap">
                {product.description}
              </p>
            )}

            <div className="mt-auto rounded-2xl border border-border bg-card p-6">
              {product.variants && product.variants.length > 0 && (
                <div className="mb-6 space-y-3">
                  <p className="text-sm font-medium">Selecione uma opção:</p>
                  <div className="grid gap-2">
                    {product.variants.map((v, idx) => (
                      <button
                        key={idx}
                        onClick={() => setSelectedVariant(idx)}
                        className={`flex justify-between items-center p-3 rounded-lg border text-left transition-colors ${
                          selectedVariant === idx ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
                        }`}
                      >
                        <span className="font-medium">{v.name}</span>
                        <span className="text-primary font-bold">R$ {Number(v.price).toFixed(2).replace(".", ",")}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              
              <div className="flex items-end justify-between mb-4">
                <div>
                  <p className="text-sm text-muted-foreground">Preço</p>
                  <p className="font-display text-4xl font-bold text-primary">
                    R$ {Number(product.variants && selectedVariant !== null ? product.variants[selectedVariant].price : product.price).toFixed(2).replace(".", ",")}
                  </p>
                </div>
              </div>
              <Button size="lg" className="w-full text-base" onClick={handleBuy} disabled={buying}>
                {buying && <Loader2 className="h-4 w-4 animate-spin" />}
                Comprar agora
              </Button>
              <div className="flex items-center justify-center gap-2 mt-4 text-xs text-muted-foreground">
                <ShieldCheck className="h-3.5 w-3.5" />
                Pagamento seguro via GOAT Pay
              </div>
              <p className="text-xs text-muted-foreground text-center mt-2">
                Após o pagamento, seu pedido fica em análise por até 24h.
              </p>
            </div>
          </div>
        </div>

        <ProductReviews productId={product.id} />
      </div>
    </div>
  );
};

export default ProductDetail;
