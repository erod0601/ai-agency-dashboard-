"use client";

import { useClientContext } from "@/lib/client-context";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function ClientSwitcher() {
  const { clients, activeClient, setActiveClient } = useClientContext();

  return (
    <Select
      value={activeClient?.id ?? ""}
      onValueChange={(id) => {
        const found = clients.find((c) => c.id === id);
        // setActiveClient writes the activeClientId cookie and refreshes,
        // so server pages re-fetch for the new client
        if (found) setActiveClient(found);
      }}
    >
      <SelectTrigger className="w-48">
        <SelectValue placeholder="Select client">
          {activeClient?.name}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {clients.map((c) => (
          <SelectItem key={c.id} value={c.id}>
            {c.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
