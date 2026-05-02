"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { createClient } from "@/lib/supabase/client";

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

export function ClientProvider({ children }: { children: ReactNode }) {
  const [clients, setClients] = useState<Client[]>([]);
  const [activeClient, setActiveClientState] = useState<Client | null>(null);
  const supabase = createClient();

  useEffect(() => {
    async function fetchClients() {
      const { data } = await supabase
        .from("clients")
        .select("id, name, industry, client_settings(primary_color)")
        .order("name");

      if (data) {
        const flat = data.map((c: any) => ({
          id: c.id,
          name: c.name,
          industry: c.industry,
          primary_color: c.client_settings?.primary_color ?? "#6366f1",
        }));
        setClients(flat);
        // Default to first client (or restore from localStorage)
        const saved = localStorage.getItem("activeClientId");
        const initial = flat.find((c) => c.id === saved) ?? flat[0];
        if (initial) setActiveClientState(initial);
      }
    }
    fetchClients();
  }, []);

  function setActiveClient(client: Client) {
    setActiveClientState(client);
    localStorage.setItem("activeClientId", client.id);
  }

  return (
    <ClientContext.Provider value={{ clients, activeClient, setActiveClient }}>
      {children}
    </ClientContext.Provider>
  );
}

export const useClientContext = () => useContext(ClientContext);
