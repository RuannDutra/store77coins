import { useEffect, useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Coins, Loader2 } from "lucide-react";

const usernameSchema = z.string().trim().min(3, "Mínimo 3 caracteres").max(30, "Máximo 30 caracteres").regex(/^[a-zA-Z0-9_]+$/, "Apenas letras, números e _");
const passwordSchema = z.string().min(6, "Mínimo 6 caracteres").max(100);

const Auth = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { user } = useAuth();
  const [mode, setMode] = useState<"login" | "signup">(params.get("mode") === "signup" ? "signup" : "login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) navigate("/");
  }, [user, navigate]);

  // Convert username -> internal email so Supabase auth (which requires email) works
  const fakeEmail = (u: string) => `${u.toLowerCase()}@77coins.local`;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const u = usernameSchema.parse(username);
      const p = passwordSchema.parse(password);
      const email = fakeEmail(u);

      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password: p,
          options: {
            emailRedirectTo: window.location.origin,
            data: { username: u },
          },
        });
        if (error) {
          if (error.message.includes("already registered")) {
            toast.error("Esse usuário já existe. Faça login.");
          } else {
            toast.error(error.message);
          }
          return;
        }
        toast.success("Conta criada! Bem-vindo.");
        navigate("/");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password: p });
        if (error) {
          toast.error("Usuário ou senha inválidos");
          return;
        }
        toast.success("Bem-vindo de volta!");
        navigate("/");
      }
    } catch (err) {
      if (err instanceof z.ZodError) {
        toast.error(err.errors[0].message);
      } else {
        toast.error("Erro inesperado");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6 relative overflow-hidden">
      <div className="absolute inset-0 bg-glow pointer-events-none" />
      <div className="relative w-full max-w-md">
        <Link to="/" className="flex items-center justify-center gap-2 mb-8">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-primary shadow-yellow">
            <Coins className="h-6 w-6 text-primary-foreground" strokeWidth={2.5} />
          </div>
          <span className="font-display text-2xl font-bold">
            77 <span className="text-gradient-yellow">Coins</span>
          </span>
        </Link>

        <div className="rounded-2xl border border-border bg-card p-8 shadow-card-dark">
          <h1 className="font-display text-2xl font-bold mb-1">
            {mode === "login" ? "Entrar" : "Criar conta"}
          </h1>
          <p className="text-sm text-muted-foreground mb-6">
            {mode === "login" ? "Acesse sua conta para comprar" : "Cadastre-se em segundos"}
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">Usuário</Label>
              <Input
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="seu_usuario"
                autoComplete="username"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {mode === "login" ? "Entrar" : "Criar conta"}
            </Button>
          </form>

          <button
            type="button"
            onClick={() => setMode(mode === "login" ? "signup" : "login")}
            className="w-full mt-6 text-sm text-muted-foreground hover:text-primary transition-colors"
          >
            {mode === "login" ? "Não tem conta? Cadastre-se" : "Já tem conta? Entrar"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Auth;
