import { useEffect } from "react";
import { Link } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Coins, Shield, Zap, ArrowRight, MessageCircle } from "lucide-react";

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
        <div className="w-full max-w-[1920px] mx-auto relative py-24 md:py-40 px-6">
          <div className="mx-auto max-w-4xl text-center animate-fade-in flex flex-col items-center justify-center">

            <h1 className="font-display text-5xl md:text-7xl font-bold tracking-tight leading-[1.05] mb-6">
              Seus coins,<br />
              <span className="text-gradient-yellow">entregues no estilo.</span>
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-6">
              Contas, jogos, gift cards, gold, itens digitais e mais!
            </p>

            <a
              href="https://discord.gg/3W4vr94sPe"
              target="_blank"
              rel="noopener noreferrer"
              className="group inline-flex items-center gap-3 mb-10 px-5 py-3 rounded-xl border border-border bg-card hover:border-primary/50 hover:bg-card/80 transition-all shadow-card-dark"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#5865F2]/15">
                <MessageCircle className="h-4 w-4 text-[#5865F2]" />
              </div>
              <div className="text-left">
                <p className="text-xs text-muted-foreground leading-tight">Comunidade</p>
                <p className="text-sm font-semibold leading-tight">Clique aqui para entrar no Discord</p>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
            </a>

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


    </div>
  );
};

export default Index;
