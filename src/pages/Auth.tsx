import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Coins, Loader2, Check, X, Eye, EyeOff, ArrowLeft } from "lucide-react";
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

const validateEmail = (e: string): string | null => {
  if (!e) return "Informe um email";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return "Email inválido";
  return null;
};

const passwordChecks = (p: string) => ({
  length: p.length >= 8,
  special: /[^A-Za-z0-9]/.test(p),
});

type Mode = "login" | "signup" | "forgot-email" | "forgot-code" | "forgot-newpw";

const Auth = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { user } = useAuth();
  const [mode, setMode] = useState<Mode>(params.get("mode") === "signup" ? "signup" : "login");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [touchedU, setTouchedU] = useState(false);
  const [touchedE, setTouchedE] = useState(false);
  const [touchedP, setTouchedP] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Forgot password state
  const [resetEmail, setResetEmail] = useState("");
  const [resetCode, setResetCode] = useState("");
  const [newPassword, setNewPassword] = useState("");

  useEffect(() => {
    if (user) navigate("/");
  }, [user, navigate]);

  useEffect(() => { setShowPassword(false); }, [mode]);

  const userError = useMemo(() => validateUsername(username), [username]);
  const emailError = useMemo(() => validateEmail(email), [email]);
  const pwChecks = useMemo(() => passwordChecks(password), [password]);
  const pwValid = pwChecks.length && pwChecks.special;
  const newPwChecks = useMemo(() => passwordChecks(newPassword), [newPassword]);
  const newPwValid = newPwChecks.length && newPwChecks.special;

  const showUserError = touchedU && userError && username.length > 0;
  const showEmailError = touchedE && emailError && email.length > 0;
  const showPwError = mode === "signup" && touchedP && !pwValid && password.length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouchedU(true);
    setTouchedP(true);
    setTouchedE(true);

    if (userError) return toast.error(userError);
    if (mode === "signup" && emailError) return toast.error(emailError);
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
        const { data: existingEmail } = await supabase.rpc("get_email_by_username", { _username: username });
        if (existingEmail) {
          toast.error("Já existe um usuário com aquele nome");
          return;
        }

        // Verifica se email já está em uso
        const { data: emailInUse } = await supabase.rpc("user_exists_by_email", { _email: email });
        if (emailInUse) {
          toast.error("Já existe uma conta com esse email");
          return;
        }

        const loginEmail = fakeEmail(username);
        const { error } = await supabase.auth.signUp({
          email: loginEmail,
          password,
          options: {
            data: { username, email },
            emailRedirectTo: window.location.origin,
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

        // Salva email no profile (trigger handle_new_user já cria profile, mas com email do fakeEmail —
        // precisamos sobrescrever com o email real informado)
        // Fazemos via update após signup. O usuário acabou de logar, então pode atualizar próprio profile.
        await new Promise((r) => setTimeout(r, 500));
        const { data: { user: created } } = await supabase.auth.getUser();
        if (created) {
          await supabase.from("profiles").update({ email }).eq("id", created.id);
        }

        toast.success("Conta criada com sucesso!");
        navigate("/");
      } else {
        let loginEmail = username;
        if (!username.includes("@")) {
          const { data: foundEmail } = await supabase.rpc("get_email_by_username", { _username: username });
          if (foundEmail) {
            loginEmail = foundEmail as string;
          } else {
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

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (validateEmail(resetEmail)) return toast.error("Email inválido");
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-reset-code", { body: { email: resetEmail } });
      if (error || (data as any)?.error) {
        const errMsg = (data as any)?.error ?? error?.message ?? "";
        if (errMsg === "not_found" || errMsg.includes("not_found")) {
          toast.error("Não existe nenhuma conta com esse email");
        } else {
          toast.error("Erro ao enviar código: " + errMsg);
        }
        return;
      }
      toast.success("Código enviado para seu email!");
      setMode("forgot-code");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = (e: React.FormEvent) => {
    e.preventDefault();
    if (resetCode.length !== 4 || !/^\d{4}$/.test(resetCode)) {
      return toast.error("Código deve ter 4 dígitos");
    }
    setMode("forgot-newpw");
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPwValid) return toast.error("A senha não cumpre os requisitos");
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("reset-password-with-code", {
        body: { email: resetEmail, code: resetCode, newPassword },
      });
      if (error || (data as any)?.error) {
        toast.error("Erro: " + ((data as any)?.error ?? error?.message));
        return;
      }
      toast.success("Senha alterada! Faça login.");
      setMode("login");
      setResetEmail("");
      setResetCode("");
      setNewPassword("");
    } finally {
      setLoading(false);
    }
  };

  const isForgot = mode.startsWith("forgot");

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
          {isForgot && (
            <button
              type="button"
              onClick={() => setMode("login")}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary mb-3 transition-colors"
            >
              <ArrowLeft className="h-3 w-3" /> Voltar para login
            </button>
          )}

          <h1 className="font-display text-2xl font-bold mb-1">

            {mode === "login" && "Entrar"}
            {mode === "signup" && "Criar conta"}
            {mode === "forgot-email" && "Esqueci minha senha"}
            {mode === "forgot-code" && "Verificar código"}
            {mode === "forgot-newpw" && "Nova senha"}
          </h1>
          <p className="text-sm text-muted-foreground mb-6">
            {mode === "login" && "Acesse sua conta para comprar"}
            {mode === "signup" && "Cadastre-se em segundos"}
            {mode === "forgot-email" && "Informe seu email para receber um código"}
            {mode === "forgot-code" && `Código de 4 dígitos enviado para ${resetEmail}`}
            {mode === "forgot-newpw" && "Defina uma nova senha"}

          </p>

          {/* LOGIN / SIGNUP */}
          {(mode === "login" || mode === "signup") && (
            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
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

              {mode === "signup" && (
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onBlur={() => setTouchedE(true)}
                    placeholder="seu@email.com"
                    autoComplete="email"
                    className={cn(showEmailError && "border-destructive focus-visible:ring-destructive")}
                    required
                  />
                  <p className={cn("text-xs", showEmailError ? "text-destructive" : "text-muted-foreground")}>
                    {showEmailError ? emailError : "Usaremos para recuperação de senha."}
                  </p>
                </div>

              )}

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
                  <button
                    type="button"
                    onClick={() => setMode("forgot-email")}
                    className="text-xs text-muted-foreground hover:text-primary transition-colors"
                  >
                    Esqueci minha senha
                  </button>
                )}
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                {mode === "login" ? "Entrar" : "Criar conta"}
              </Button>
            </form>
          )}

          {/* FORGOT — STEP 1: EMAIL */}
          {mode === "forgot-email" && (
            <form onSubmit={handleSendCode} className="space-y-4" noValidate>
              <div className="space-y-2">
                <Label htmlFor="resetEmail">Email da conta</Label>
                <Input
                  id="resetEmail"
                  type="email"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  placeholder="seu@email.com"
                  autoComplete="email"
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Enviar código
              </Button>
            </form>
          )}

          {/* FORGOT — STEP 2: CODE */}
          {mode === "forgot-code" && (
            <form onSubmit={handleVerifyCode} className="space-y-4" noValidate>
              <div className="space-y-2">
                <Label htmlFor="code">Código (4 dígitos)</Label>
                <Input
                  id="code"
                  inputMode="numeric"
                  pattern="\d{4}"
                  maxLength={4}
                  value={resetCode}
                  onChange={(e) => setResetCode(e.target.value.replace(/\D/g, "").slice(0, 4))}
                  placeholder="0000"
                  className="text-center text-2xl tracking-[0.5em] font-mono"
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading || resetCode.length !== 4}>
                Continuar
              </Button>
              <button
                type="button"
                onClick={() => setMode("forgot-email")}
                className="w-full text-xs text-muted-foreground hover:text-primary transition-colors"
              >
                Reenviar código
              </button>
            </form>
          )}

          {/* FORGOT — STEP 3: NEW PASSWORD */}
          {mode === "forgot-newpw" && (
            <form onSubmit={handleResetPassword} className="space-y-4" noValidate>
              <div className="space-y-2">
                <Label htmlFor="newpw">Nova senha</Label>
                <div className="relative">
                  <Input
                    id="newpw"
                    type={showPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="new-password"
                    className="pr-10"
                    required
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/60 hover:text-white transition-colors"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <ul className="text-xs space-y-1 pt-1">
                  <li className={cn("flex items-center gap-1.5", newPwChecks.length ? "text-success" : "text-muted-foreground")}>
                    {newPwChecks.length ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                    Mais de 8 caracteres
                  </li>
                  <li className={cn("flex items-center gap-1.5", newPwChecks.special ? "text-success" : "text-muted-foreground")}>
                    {newPwChecks.special ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                    Pelo menos 1 caractere especial
                  </li>
                </ul>
              </div>
              <Button type="submit" className="w-full" disabled={loading || !newPwValid}>
                {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Alterar senha
              </Button>
            </form>
          )}

          {(mode === "login" || mode === "signup") && (
            <button
              type="button"
              onClick={() => setMode(mode === "login" ? "signup" : "login")}
              className="w-full mt-6 text-sm text-muted-foreground hover:text-primary transition-colors"
            >
              {mode === "login" ? "Não tem conta? Cadastre-se" : "Já tem conta? Entrar"}
            </button>
          )}

        </div>
      </div>
    </div>
  );
};

export default Auth;
