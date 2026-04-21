import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { User, Search, ShieldCheck } from "lucide-react";

interface ProfileRow {
  id: string;
  username: string;
  email: string | null;
  created_at: string;
}

interface OrderRow {
  id: string;
  user_id: string;
  product_name: string;
  amount: number;
  status: "pending" | "approved" | "rejected";
  created_at: string;
}

export const AdminUsers = () => {
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [adminIds, setAdminIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const [{ data: p }, { data: o }, { data: r }] = await Promise.all([
        supabase.from("profiles").select("id, username, email, created_at").order("created_at", { ascending: false }),
        supabase.from("orders").select("id, user_id, product_name, amount, status, created_at").order("created_at", { ascending: false }),
        supabase.from("user_roles").select("user_id, role").eq("role", "admin"),
      ]);
      setProfiles((p as any) || []);
      setOrders((o as any) || []);
      setAdminIds(new Set(((r as any) || []).map((x: any) => x.user_id)));
      setLoading(false);
    };
    load();
  }, []);

  const filtered = profiles.filter((p) =>
    p.username.toLowerCase().includes(search.toLowerCase()) ||
    (p.email || "").toLowerCase().includes(search.toLowerCase())
  );

  const ordersByUser = (uid: string) => orders.filter((o) => o.user_id === uid);

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-card p-4">
        <p className="text-xs text-muted-foreground mb-3">
          🔒 Por segurança, senhas são criptografadas e não podem ser visualizadas — nem mesmo pelo admin.
        </p>
        <div className="relative">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por usuário ou email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground text-center py-8">Carregando...</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">Nenhum usuário</p>
      ) : (
        <div className="space-y-3">
          {filtered.map((u) => {
            const userOrders = ordersByUser(u.id);
            const isAdmin = adminIds.has(u.id);

            return (
              <div key={u.id} className="rounded-xl border border-border bg-card p-4">
                <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
                  <div className="flex items-center gap-3">
                    <div className={`h-10 w-10 rounded-full flex items-center justify-center flex-shrink-0 ${isAdmin ? "bg-primary/20 ring-2 ring-primary/40" : "bg-muted"}`}>
                      <User className={`h-5 w-5 ${isAdmin ? "text-primary" : "text-muted-foreground"}`} />
                    </div>
                    <div>
                      <p className="font-medium flex items-center gap-2 flex-wrap">
                        {u.username}
                        {isAdmin && (
                          <Badge className="bg-primary/15 text-primary border border-primary/30 hover:bg-primary/20 text-[10px]">
                            <ShieldCheck className="h-3 w-3 mr-1" />
                            admin
                          </Badge>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {u.email || "—"} · cadastrado em {new Date(u.created_at).toLocaleDateString("pt-BR")}
                      </p>
                    </div>
                  </div>
                  <Badge variant="outline">{userOrders.length} pedido(s)</Badge>
                </div>

                {userOrders.length > 0 && (
                  <div className="border-t border-border pt-3 space-y-1.5">
                    {userOrders.slice(0, 5).map((o) => (
                      <div key={o.id} className="flex items-center justify-between text-sm">
                        <span className="truncate">{o.product_name}</span>
                        <div className="flex items-center gap-3 flex-shrink-0">
                          <span className="text-primary font-medium">R$ {Number(o.amount).toFixed(2).replace(".", ",")}</span>
                          <Badge variant="outline" className="text-xs">
                            {o.status === "pending" ? "Em análise" : o.status === "approved" ? "Aprovado" : "Recusado"}
                          </Badge>
                        </div>
                      </div>
                    ))}
                    {userOrders.length > 5 && (
                      <p className="text-xs text-muted-foreground">+{userOrders.length - 5} pedidos antigos</p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
