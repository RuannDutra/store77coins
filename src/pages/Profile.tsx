import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, User, KeyRound, Camera } from "lucide-react";

const Profile = () => {
  const { user, avatarUrl: ctxAvatar, username: ctxUsername } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<{ username: string; email: string | null; avatar_url: string | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [newPassword, setNewPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    document.title = "Meu Perfil — 77 Coins";
    if (!user) {
      navigate("/auth");
      return;
    }

    const fetchProfile = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("username, email, avatar_url")
        .eq("id", user.id)
        .maybeSingle();

      if (data) {
        setProfile(data as any);
      }
      setLoading(false);
    };

    fetchProfile();
  }, [user, navigate]);

  const handleAvatarUpload = async (file: File) => {
    if (!user) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Imagem muito grande. Máximo 2 MB.");
      return;
    }
    setUploadingAvatar(true);
    const ext = file.name.split(".").pop();
    const path = `${user.id}/avatar.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(path, file, { upsert: true });
    if (uploadError) {
      toast.error("Erro no upload: " + uploadError.message);
      setUploadingAvatar(false);
      return;
    }
    const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);
    // Add cache-busting so the new image is immediately visible
    const avatarUrl = `${urlData.publicUrl}?t=${Date.now()}`;
    const { error: updateError } = await supabase
      .from("profiles")
      .update({ avatar_url: avatarUrl } as any)
      .eq("id", user.id);
    if (updateError) {
      toast.error("Erro ao salvar: " + updateError.message);
      setUploadingAvatar(false);
      return;
    }
    setProfile((prev) => prev ? { ...prev, avatar_url: avatarUrl } : prev);
    toast.success("Foto de perfil atualizada!");
    setUploadingAvatar(false);
  };

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

  const avatarUrl = profile?.avatar_url ?? ctxAvatar;
  const username = profile?.username ?? ctxUsername ?? "";
  const initial = username?.[0]?.toUpperCase() ?? "?";

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container py-10 max-w-2xl">
        <h1 className="font-display text-3xl font-bold mb-6">Meu Perfil</h1>

        <div className="grid gap-8">
          {/* Account info + avatar */}
          <div className="rounded-2xl border border-border bg-card p-6 shadow-card-dark">
            <h2 className="flex items-center gap-2 font-display text-xl font-semibold mb-5">
              <User className="h-5 w-5 text-primary" /> Dados da Conta
            </h2>

            <div className="flex items-center gap-5 mb-5">
              {/* Avatar preview */}
              <div className="relative group">
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt="avatar"
                    className="h-20 w-20 rounded-full object-cover ring-2 ring-primary/40"
                  />
                ) : (
                  <div className="h-20 w-20 rounded-full bg-primary/20 ring-2 ring-primary/40 flex items-center justify-center text-2xl font-bold text-primary">
                    {initial}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploadingAvatar}
                  className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                >
                  {uploadingAvatar ? (
                    <Loader2 className="h-5 w-5 text-white animate-spin" />
                  ) : (
                    <Camera className="h-5 w-5 text-white" />
                  )}
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && handleAvatarUpload(e.target.files[0])}
                />
              </div>

              <div>
                <p className="text-xs text-muted-foreground mb-1">Foto de perfil</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploadingAvatar}
                >
                  {uploadingAvatar ? (
                    <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Enviando...</>
                  ) : (
                    <><Camera className="h-4 w-4 mr-2" /> Alterar foto</>
                  )}
                </Button>
                <p className="text-xs text-muted-foreground mt-1">JPG, PNG, GIF · máx. 2 MB</p>
              </div>
            </div>

            <div>
              <Label className="text-muted-foreground">Usuário</Label>
              <div className="font-medium text-lg mt-1">{username || "Carregando..."}</div>
            </div>
          </div>

          {/* Change password */}
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
