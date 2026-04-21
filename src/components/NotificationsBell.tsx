import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Bell, MessageSquare, ShoppingBag, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface Notif {
  id: string;
  type: "message" | "order_approved" | "order_rejected";
  title: string;
  body: string;
  created_at: string;
  read: boolean;
  href: string;
}

const STORAGE_KEY = (uid: string) => `77c_notif_seen_${uid}`;

// Short 440Hz ping WAV encoded as base64 — plays without user-gesture restriction
const PING_WAV = "data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAA" +
  "EAAQAAgD4AAIA+AAABAAgAZGF0YUoGAAAAAAAAMgBjAIoApAC1AL" +
  "YApACKAGMAngAzAAAA0v+u/5T/hf+E/5T/rv/S//8AUQCAAJ0Aqg" +
  "CqAJ0AgABRAP//0v+u/5T/hf+E/5T/rv/S//8AUQCAAJ0AqgCqAJ" +
  "0AgABRAP//0v+u/5T/hf+E/5T/rv/S//8AUQCAAJ0AqgCqAJ0AgABR" +
  "AP//0v+u/5T/hf+E/5T/rv/SAAAAAA==";

const playNotifSound = () => {
  try {
    const audio = new Audio(PING_WAV);
    audio.volume = 0.4;
    audio.play().catch(() => {/* blocked by browser policy — silent */});
  } catch {
    // Not supported — silent
  }
};

export const NotificationsBell = () => {
  const { user, isAdmin } = useAuth();
  const [notifs, setNotifs] = useState<Notif[]>([]);
  const [open, setOpen] = useState(false);

  const getSeen = (): Set<string> => {
    if (!user) return new Set();
    try {
      return new Set(JSON.parse(localStorage.getItem(STORAGE_KEY(user.id)) || "[]"));
    } catch {
      return new Set();
    }
  };

  const persistSeen = (set: Set<string>) => {
    if (!user) return;
    localStorage.setItem(STORAGE_KEY(user.id), JSON.stringify([...set]));
  };

  // Initial load
  useEffect(() => {
    if (!user) return;
    let active = true;

    const load = async () => {
      const seen = getSeen();
      const list: Notif[] = [];

      // Orders updates (status changes from pending)
      const { data: orders } = await supabase
        .from("orders")
        .select("id, product_name, status, updated_at")
        .neq("status", "pending")
        .order("updated_at", { ascending: false })
        .limit(20);

      (orders || []).forEach((o: any) => {
        const id = `order-${o.id}-${o.status}`;
        if (seen.has(id)) return; // Skip already seen
        // Only notify the buyer about their own status changes
        list.push({
          id,
          type: o.status === "approved" ? ("order_approved" as const) : ("order_rejected" as const),
          title: o.status === "approved" ? "Pedido aprovado!" : "Pedido recusado",
          body: o.product_name,
          created_at: o.updated_at,
          read: false,
          href: "/orders",
        });
      });

      // Messages: get all order_ids the user can see
      const { data: msgs } = await supabase
        .from("order_messages")
        .select("id, order_id, sender_id, is_admin, content, created_at")
        .neq("sender_id", user.id)
        .order("created_at", { ascending: false })
        .limit(20);

      (msgs || []).forEach((m: any) => {
        const id = `msg-${m.id}`;
        if (seen.has(id)) return; // Skip already seen
        list.push({
          id,
          type: "message" as const,
          title: m.is_admin ? "Nova mensagem do admin" : "Nova mensagem do cliente",
          body: m.content.slice(0, 60),
          created_at: m.created_at,
          read: false,
          href: isAdmin ? "/admin" : "/orders",
        });
      });

      list.sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
      if (active) setNotifs(list.slice(0, 30));
    };
    load();

    // Realtime: new messages
    const ch = supabase
      .channel(`notif-${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "order_messages" },
        (payload) => {
          const m: any = payload.new;
          if (m.sender_id === user.id) return;
          setNotifs((prev) => {
            const id = `msg-${m.id}`;
            if (prev.some((n) => n.id === id)) return prev;
            playNotifSound();
            return [
              {
                id,
                type: "message" as const,
                title: m.is_admin ? "Nova mensagem do admin" : "Nova mensagem do cliente",
                body: String(m.content).slice(0, 60),
                created_at: m.created_at,
                read: false,
                href: isAdmin ? "/admin" : "/orders",
              },
              ...prev,
            ].slice(0, 30);
          });
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "orders" },
        (payload) => {
          const o: any = payload.new;
          const old: any = payload.old;
          if (o.status === old.status) return;
          if (o.status === "pending") return;
          setNotifs((prev) => {
            const id = `order-${o.id}-${o.status}`;
            if (prev.some((n) => n.id === id)) return prev;
            playNotifSound();
            return [
              {
                id,
                type: o.status === "approved" ? ("order_approved" as const) : ("order_rejected" as const),
                title: o.status === "approved" ? "Pedido aprovado!" : "Pedido recusado",
                body: o.product_name,
                created_at: o.updated_at,
                read: false,
                href: "/orders",
              },
              ...prev,
            ].slice(0, 30);
          });
        }
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(ch);
    };
  }, [user, isAdmin]);

  if (!user) return null;

  const unread = notifs.filter((n) => !n.read).length;

  const markAllRead = () => {
    const seen = getSeen();
    notifs.forEach((n) => seen.add(n.id));
    persistSeen(seen);
    // Remove all notifications from the list
    setNotifs([]);
    setOpen(false);
  };

  const onOpen = (o: boolean) => {
    setOpen(o);
    if (o && unread > 0) {
      // delay so user sees the unread state briefly
      setTimeout(markAllRead, 800);
    }
  };

  return (
    <Popover open={open} onOpenChange={onOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="relative">
          <Bell className="h-4 w-4" />
          {unread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between p-3 border-b border-border">
          <p className="font-medium text-sm">Notificações</p>
          {unread > 0 && (
            <button onClick={markAllRead} className="text-xs text-primary hover:underline">
              Marcar todas como lidas
            </button>
          )}
        </div>
        <div className="max-h-96 overflow-y-auto">
          {notifs.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-10">
              Nenhuma notificação
            </p>
          ) : (
            notifs.map((n) => {
              const Icon =
                n.type === "message" ? MessageSquare :
                n.type === "order_approved" ? CheckCircle2 : XCircle;
              return (
                <Link
                  key={n.id}
                  to={n.href}
                  onClick={() => {
                    // Mark this single notification as read
                    const seen = getSeen();
                    seen.add(n.id);
                    persistSeen(seen);
                    setNotifs((prev) => prev.filter((item) => item.id !== n.id));
                    setOpen(false);
                  }}
                  className={cn(
                    "flex gap-3 p-3 border-b border-border hover:bg-muted/50 transition-colors",
                    !n.read && "bg-primary/5"
                  )}
                >
                  <Icon className={cn(
                    "h-4 w-4 mt-0.5 flex-shrink-0",
                    n.type === "order_approved" ? "text-success" :
                    n.type === "order_rejected" ? "text-destructive" : "text-primary"
                  )} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{n.title}</p>
                    <p className="text-xs text-muted-foreground truncate">{n.body}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {new Date(n.created_at).toLocaleString("pt-BR")}
                    </p>
                  </div>
                  {!n.read && <div className="h-2 w-2 rounded-full bg-primary mt-1.5 flex-shrink-0" />}
                </Link>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};
