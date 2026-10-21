"use client";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { subscribeNotifications } from "@/lib/notifications";
import { resilient } from "@/lib/resilient";
import type { AppNotification } from "@/lib/types";
import { useAuth } from "./AuthProvider";

interface NotifState {
  items: AppNotification[];
  state: "loading" | "ready" | "error";
  unread: number;
}
const Ctx = createContext<NotifState>({ items: [], state: "loading", unread: 0 });
export const useNotifications = () => useContext(Ctx);

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [items, setItems] = useState<AppNotification[]>([]);
  const [state, setState] = useState<NotifState["state"]>("loading");

  useEffect(() => {
    if (!user) return;
    setState("loading");
    return resilient<AppNotification[]>((ok, err) => subscribeNotifications(user.uid, ok, err), (n) => { setItems(n); setState("ready"); }, () => setState("error"), { scope: "notifications" });
  }, [user]);

  const value = useMemo(() => ({ items, state, unread: items.filter((n) => !n.read).length }), [items, state]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
