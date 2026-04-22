import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, Loader2, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface Message {
  id: string;
  order_id: string;
  sender_id: string;
  is_admin: boolean;
  content: string;
  created_at: string;
}

interface SenderInfo {
  username: string;
  avatar_url: string | null;
}

interface Props {
  orderId: string;
  productName: string;
}

const AvatarBubble = ({ username, avatarUrl, size = 32 }: { username: string; avatarUrl: string | null; size?: number }) => {
  const initial = username?.[0]?.toUpperCase() ?? "?";
  const [error, setError] = useState(false);

  return avatarUrl && !error ? (
    <img
      src={avatarUrl}
      alt={username}
      style={{ width: size, height: size }}
      className="rounded-full object-cover flex-shrink-0 ring-2 ring-border"
      onError={() => setError(true)}
    />
  ) : (
    <div
      style={{ width: size, height: size }}
      className="rounded-full flex-shrink-0 bg-primary/20 ring-2 ring-border flex items-center justify-center text-[11px] font-bold text-primary"
    >
      {initial}
    </div>
  );
};

export const OrderChat = ({ orderId, productName }: Props) => {
  const { user, username: myUsername, avatarUrl: myAvatar } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [senders, setSenders] = useState<Record<string, SenderInfo>>({});
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const endRef = useRef<HTMLDivElement>(null);

  // Fetch profile info via SECURITY DEFINER RPC (RLS na tabela profiles bloqueia destinatário)
  const fetchSenders = async (ids: string[]) => {
    const missing = ids.filter((id) => !senders[id]);
    if (missing.length === 0) return;

    const results = await Promise.all(
      missing.map(async (id) => {
        const { data } = await supabase.rpc("get_username_by_id", { _user_id: id });
        return { id, username: (data as string | null) ?? "Usuário" };
      })
    );

    setSenders((prev) => {
      const next = { ...prev };
      results.forEach((r) => {
        next[r.id] = { username: r.username, avatar_url: null };
      });
      return next;
    });
  };

  useEffect(() => {
    let active = true;
    const load = async () => {
      const { data } = await supabase
        .from("order_messages")
        .select("*")
        .eq("order_id", orderId)
        .order("created_at", { ascending: true });
      if (active) {
        const msgs = (data as Message[]) || [];
        setMessages(msgs);
        setLoading(false);
        const ids = [...new Set(msgs.map((m) => m.sender_id))];
        fetchSenders(ids);
      }
    };
    load();

    const ch = supabase
      .channel(`order-chat-${orderId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "order_messages", filter: `order_id=eq.${orderId}` },
        (payload) => {
          const msg = payload.new as Message;
          if (msg.order_id !== orderId) return;
          setMessages((prev) => {
            if (prev.some((m) => m.id === msg.id)) return prev;
            return [...prev, msg];
          });
          fetchSenders([msg.sender_id]);
        }
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(ch);
    };
  }, [orderId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const content = text.trim();
    if (!content) return;
    if (content.length > 1000) return toast.error("Mensagem muito longa");
    setSending(true);
    // SEGURANÇA: is_admin NÃO é enviado pelo cliente — o banco define via trigger
    const { data, error } = await supabase
      .from("order_messages")
      .insert({
        order_id: orderId,
        sender_id: user.id,
        content,
      })
      .select()
      .single();
    setSending(false);
    if (error) {
      toast.error("Erro ao enviar: " + error.message);
      return;
    }
    if (data) {
      setMessages((prev) => (prev.some((m) => m.id === data.id) ? prev : [...prev, data as Message]));
    }
    setText("");
  };

  const [orderStatus, setOrderStatus] = useState<string>("pending");

  useEffect(() => {
    const fetchStatus = async () => {
      const { data } = await supabase.from("orders").select("status").eq("id", orderId).maybeSingle();
      if (data) setOrderStatus(data.status);
    };
    fetchStatus();

    const sub = supabase.channel(`order-status-${orderId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${orderId}` }, (payload) => {
        setOrderStatus(payload.new.status);
      })
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, [orderId]);

  const isDelivered = orderStatus === "delivered";

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden flex flex-col h-[420px]">
      <div className="flex items-center gap-2 border-b border-border px-4 py-3 bg-background/50">
        <MessageSquare className="h-4 w-4 text-primary" />
        <p className="font-medium text-sm">Chat de entrega · {productName}</p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {loading ? (
          <div className="text-center text-sm text-muted-foreground">Carregando...</div>
        ) : messages.length === 0 ? (
          <div className="text-center text-sm text-muted-foreground py-10">
            Pedido aprovado! Comece a conversa para receber seu produto.
          </div>
        ) : (
          messages.map((m) => {
            const mine = m.sender_id === user?.id;
            const sender = senders[m.sender_id];
            const displayName = sender?.username ?? (mine ? (myUsername ?? "Você") : "...");
            
            let avatarUrl = sender?.avatar_url ?? (mine ? myAvatar : null);
            
            if (!avatarUrl && m.sender_id) {
              const { data } = supabase.storage.from("avatars").getPublicUrl(`${m.sender_id}/avatar`);
              avatarUrl = data?.publicUrl || null;
            }

            // Mensagem de Sistema (Entrega)
            if (m.content.startsWith("Sistema - Pedido Marcado como Entregue")) {
              return (
                <div key={m.id} className="flex justify-center my-4">
                  <div className="bg-success/10 border border-success/20 text-success text-[11px] px-4 py-1.5 rounded-full font-medium">
                    {m.content}
                  </div>
                </div>
              );
            }

            return (
              <div key={m.id} className={cn("flex items-start gap-2", mine ? "flex-row-reverse" : "flex-row")}>
                {/* Avatar — always top-aligned */}
                <AvatarBubble username={displayName} avatarUrl={avatarUrl} size={28} />

                <div className={cn(
                  "max-w-[70%] rounded-2xl px-3 py-2 text-sm",
                  mine
                    ? "bg-primary text-primary-foreground rounded-tr-sm"
                    : "bg-muted text-foreground rounded-tl-sm"
                )}>
                  <p className="text-[10px] font-semibold opacity-75 mb-1 whitespace-nowrap">
                    {displayName}
                    {m.is_admin && (
                      <span className="ml-1 text-[9px] bg-yellow-500/20 text-yellow-400 px-1 py-0.5 rounded font-bold">Admin</span>
                    )}
                    <span className="font-normal opacity-60 ml-1">
                      · {new Date(m.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </p>
                  <p className="whitespace-pre-wrap break-words leading-snug">{m.content}</p>
                </div>
              </div>
            );
          })
        )}
        <div ref={endRef} />
      </div>

      <form onSubmit={send} className="border-t border-border p-3 flex gap-2">
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={isDelivered ? "Este chat foi encerrado." : "Digite sua mensagem..."}
          maxLength={1000}
          disabled={sending || isDelivered}
        />
        <Button type="submit" disabled={sending || !text.trim() || isDelivered} size="sm">
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </form>
    </div>
  );
};
