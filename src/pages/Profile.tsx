import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, User, KeyRound } from "lucide-react";

const Profile = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<{ username: string; email: string | null } | null>(null);
  const [loading, setLoading] = useState(true);
  
  const [newPassword, setNewPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => {
    document.title = "Meu Perfil — 77 Coins";
    if (!user) {
      navigate("/auth");
      return;
    }

    const fetchProfile = async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("username, email")
        .eq("id", user.id)
        .maybeSingle();
      
      if (data) {
        setProfile(data);
      }
      setLoading(false);
    };

    fetchProfile();
  }, [user, navigate]);

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 8) {
      return toast.error("A nova senha deve ter no mínimo 8 caracteres.");
    }
    
    setSavingPassword(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setSavingPassword(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Senha atualizada com sucesso!");
    setNewPassword("");
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

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container py-10 max-w-2xl">
        <h1 className="font-display text-3xl font-bold mb-6">Meu Perfil</h1>

        <div className="grid gap-8">
          <div className="rounded-2xl border border-border bg-card p-6 shadow-card-dark">
            <h2 className="flex items-center gap-2 font-display text-xl font-semibold mb-4">
              <User className="h-5 w-5 text-primary" /> Dados da Conta
            </h2>
            <div className="space-y-4">
              <div>
                <Label className="text-muted-foreground">Usuário</Label>
                <div className="font-medium text-lg mt-1">{profile?.username || "Carregando..."}</div>
              </div>

            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-6 shadow-card-dark">
            <h2 className="flex items-center gap-2 font-display text-xl font-semibold mb-4">
              <KeyRound className="h-5 w-5 text-primary" /> Alterar Senha
            </h2>
            <form onSubmit={handleUpdatePassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="newPassword">Nova Senha</Label>
                <Input
                  id="newPassword"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                />
              </div>
              <Button type="submit" disabled={savingPassword || !newPassword}>
                {savingPassword && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Atualizar Senha
              </Button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;
