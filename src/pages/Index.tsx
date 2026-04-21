import { useEffect } from "react";
import { Link } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Coins, Shield, Zap, ArrowRight } from "lucide-react";

const Index = () => {
  useEffect(() => {
    document.title = "77 Coins — Marketplace de itens e moedas";
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute("content", "Compre contas, jogos, gift cards, gold, itens digitais e mais na 77 Coins.");
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-glow pointer-events-none" />
        <div className="container relative py-20 md:py-32">
          <div className="mx-auto max-w-3xl text-center animate-fade-in">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/5 px-4 py-1.5 text-xs font-medium text-primary mb-6">
              <Zap className="h-3.5 w-3.5" />
              MARKETPLACE OFICIAL
            </div>
            <h1 className="font-display text-5xl md:text-7xl font-bold tracking-tight leading-[1.05] mb-6">
              Seus coins,<br />
              <span className="text-gradient-yellow">entregues no estilo.</span>
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10">
              Contas, jogos, gift cards, gold, itens digitais e mais!
            </p>
            <div className="flex flex-wrap items-center justify-center gap-4">
              <Button asChild size="lg" className="text-base h-12 px-8">
                <Link to="/produtos">
                  Ver produtos
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-muted-foreground mt-12">
              <div className="flex items-center gap-2"><Shield className="h-4 w-4 text-primary" /> Pagamento seguro</div>
              <div className="flex items-center gap-2"><Zap className="h-4 w-4 text-primary" /> Entrega rápida</div>
              <div className="flex items-center gap-2"><Coins className="h-4 w-4 text-primary" /> Melhores preços</div>
            </div>
          </div>
        </div>
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
