"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ACTIVE_CLIENT_COOKIE, DEFAULT_CLIENT_ID } from "@/lib/active-client-constants";

type Client = {
  id: string;
  name: string;
  industry: string;
  primary_color?: string;
};

type ClientContextType = {
  clients: Client[];
  activeClient: Client | null;
  setActiveClient: (client: Client) => void;
};

const ClientContext = createContext<ClientContextType>({
  clients: [],
  activeClient: null,
  setActiveClient: () => {},
});

// The cookie is the single source of truth for the active client: server pages
// read it via resolveActiveClient(), this provider reads/writes it for the UI.
function readActiveClientCookie(): string | null {
  const match = document.cookie.match(
    new RegExp(`(?:^|; )${ACTIVE_CLIENT_COOKIE}=([^;]*)`)
  );
  return match ? decodeURIComponent(match[1]) : null;
}

function writeActiveClientCookie(id: string) {
  document.cookie = `${ACTIVE_CLIENT_COOKIE}=${encodeURIComponent(id)}; path=/; max-age=31536000; SameSite=Lax`;
}

export function ClientProvider({ children }: { children: ReactNode }) {
  const [clients, setClients] = useState<Client[]>([]);
  const [activeClient, setActiveClientState] = useState<Client | null>(null);
  const supabase = createClient();
  const router = useRouter();

  useEffect(() => {
    async function fetchClients() {
      const { data } = await supabase
        .from("clients")
        .select("id, name, business_type, client_settings(primary_color)")
        .order("name");

      if (data) {
        const flat = data.map((c: any) => ({
          id: c.id,
          name: c.name,
          industry: c.business_type,
          primary_color: c.client_settings?.primary_color ?? "#6366f1",
        }));
        setClients(flat);

        // Restore from cookie (falling back to the pre-cookie localStorage key),
        // then the demo client, then the first client — same order as the
        // server-side resolveActiveClient().
        const saved =
          readActiveClientCookie() ?? localStorage.getItem("activeClientId");
        const initial =
          flat.find((c) => c.id === saved) ??
          flat.find((c) => c.id === DEFAULT_CLIENT_ID) ??
          flat[0];
        if (initial) {
          setActiveClientState(initial);
          // Pin the resolved choice so server pages agree from the next request on
          if (initial.id !== readActiveClientCookie()) {
            writeActiveClientCookie(initial.id);
            router.refresh();
          }
        }
      }
    }
    fetchClients();
  }, []);

  function setActiveClient(client: Client) {
    setActiveClientState(client);
    writeActiveClientCookie(client.id);
    // Re-run server components so every page re-fetches with the new cookie
    router.refresh();
  }

  return (
    <ClientContext.Provider value={{ clients, activeClient, setActiveClient }}>
      {children}
    </ClientContext.Provider>
  );
}

export const useClientContext = () => useContext(ClientContext);
