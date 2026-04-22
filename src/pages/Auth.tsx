import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Coins, Loader2, Check, X, Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";

const fakeEmail = (u: string) => `${u.toLowerCase()}@77coins.local`;

const validateUsername = (u: string): string | null => {
  if (!u) return "Informe um usuário";
  if (/\s/.test(u)) return "Não pode conter espaços";
  if (/^[._]/.test(u)) return "Não pode começar com pontuação";
  if (u.length < 3) return "Mínimo 3 caracteres";
  if (u.length > 30) return "Máximo 30 caracteres";
  if (!/^[a-zA-Z0-9_]+$/.test(u)) return "Use apenas letras, números e _";
  return null;
};

const passwordChecks = (p: string) => ({
  length: p.length >= 8,
  special: /[^A-Za-z0-9]/.test(p),
});

const Auth = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { user } = useAuth();
  const [mode, setMode] = useState<"login" | "signup" | "forgot">(params.get("mode") === "signup" ? "signup" : "login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [touchedU, setTouchedU] = useState(false);
  const [touchedP, setTouchedP] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (user) navigate("/");
  }, [user, navigate]);

  // Reset password visibility when switching modes
  useEffect(() => { setShowPassword(false); }, [mode]);

  const userError = useMemo(() => validateUsername(username), [username]);
  const pwChecks = useMemo(() => passwordChecks(password), [password]);
  const pwValid = pwChecks.length && pwChecks.special;

  const showUserError = touchedU && userError && username.length > 0;
  const showPwError = mode === "signup" && touchedP && !pwValid && password.length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouchedU(true);
    setTouchedP(true);

    if (userError) return toast.error(userError);
    if (mode === "signup" && !pwValid) return toast.error("A senha não cumpre os requisitos");
    if (mode === "login" && password.length < 1) return toast.error("Informe a senha");

    setLoading(true);
    try {
      if (mode === "forgot") {
        let resetEmail = username;
        if (!username.includes("@")) {
          const { data } = await supabase.from("profiles").select("email").eq("username", username).maybeSingle();
          if (data?.email) {
            resetEmail = data.email;
          } else {
            toast.error("Usuário não encontrado ou sem e-mail cadastrado");
            return;
          }
        }
        
        if (resetEmail.endsWith("@77coins.local")) {
          toast.error("Esta conta não possui um e-mail real para recuperação.");
          return;
        }

        const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
          redirectTo: `${window.location.origin}/profile`,
        });

        if (error) {
          toast.error(error.message);
        } else {
          toast.success("Link de recuperação enviado para o e-mail associado!");
          setMode("login");
        }
        return;
      }

      if (mode === "signup") {
        // Check if username is taken
        const { data: existingUser } = await supabase.from("profiles").select("id").eq("username", username).maybeSingle();
        if (existingUser) {
          toast.error("Já existe um usuário com aquele nome");
          return;
        }

        const loginEmail = fakeEmail(username);
        const { error } = await supabase.auth.signUp({
          email: loginEmail,
          password,
          options: {
            data: { username },
          },
        });
        if (error) {
          if (error.message.includes("already registered")) {
            toast.error("Já existe um usuário com aquele nome");
          } else {
            toast.error(error.message);
          }
          return;
        }
        toast.success("Conta criada com sucesso!");
        navigate("/");
      } else {
        let loginEmail = username;
        if (!username.includes("@")) {
          const { data } = await supabase.from("profiles").select("email").eq("username", username).maybeSingle();
          if (data?.email) {
            loginEmail = data.email;
          } else {
            // Se tentou entrar com username e ele não está na tabela
            toast.error("Usuário Inválido");
            return;
          }
        }
        const { error } = await supabase.auth.signInWithPassword({ email: loginEmail, password });
        if (error) {
          if (error.message.includes("Invalid login credentials")) {
            toast.error("Senha Inválida");
          } else {
            toast.error(error.message);
          }
          return;
        }
        toast.success("Bem-vindo de volta!");
        navigate("/");
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
            {mode === "login" ? "Entrar" : mode === "signup" ? "Criar conta" : "Recuperar Senha"}
          </h1>
          <p className="text-sm text-muted-foreground mb-6">
            {mode === "login" 
              ? "Acesse sua conta para comprar" 
              : mode === "signup" 
                ? "Cadastre-se em segundos" 
                : "Informe seu usuário ou e-mail para receber um link de recuperação"}
          </p>

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <>
                <div className="space-y-2">
                  <Label htmlFor="username">Usuário</Label>
                  <Input
                    id="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    onBlur={() => setTouchedU(true)}
                    placeholder="seu_usuario"
                    autoComplete="username"
                    className={cn(showUserError && "border-destructive focus-visible:ring-destructive")}
                    required
                  />
                  {mode === "signup" && (
                    <p className={cn("text-xs", showUserError ? "text-destructive" : "text-muted-foreground")}>
                      {showUserError ? userError : "Sem espaços, sem começar com número ou pontuação."}
                    </p>
                  )}
                </div>
                {mode !== "forgot" && (
                <div className="space-y-2">
                  <Label htmlFor="password">Senha</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      onBlur={() => setTouchedP(true)}
                      placeholder="••••••••"
                      autoComplete={mode === "login" ? "current-password" : "new-password"}
                      className={cn("pr-10", showPwError && "border-destructive focus-visible:ring-destructive")}
                      required
                    />
                    <button
                      type="button"
                      tabIndex={-1}
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-white/60 hover:text-white transition-colors"
                      aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {mode === "signup" && (
                    <ul className="text-xs space-y-1 pt-1">
                      <li className={cn("flex items-center gap-1.5", pwChecks.length ? "text-success" : showPwError ? "text-destructive" : "text-muted-foreground")}>
                        {pwChecks.length ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                        Mais de 8 caracteres
                      </li>
                      <li className={cn("flex items-center gap-1.5", pwChecks.special ? "text-success" : showPwError ? "text-destructive" : "text-muted-foreground")}>
                        {pwChecks.special ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                        Pelo menos 1 caractere especial
                      </li>
                    </ul>
                  )}
                  {mode === "login" && (
                    <div className="flex justify-end pt-1">
                      <button
                        type="button"
                        onClick={() => setMode("forgot")}
                        className="text-xs text-muted-foreground hover:text-primary transition-colors"
                      >
                        Esqueceu a senha?
                      </button>
                    </div>
                  )}
                </div>
              )}
              </>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {mode === "login" ? "Entrar" : mode === "signup" ? "Criar conta" : "Enviar link"}
            </Button>
          </form>

          <button
            type="button"
            onClick={() => setMode(mode === "login" ? "signup" : "login")}
            className="w-full mt-6 text-sm text-muted-foreground hover:text-primary transition-colors"
          >
            {mode === "login" ? "Não tem conta? Cadastre-se" : mode === "signup" ? "Já tem conta? Entrar" : "Voltar para o login"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Auth;
