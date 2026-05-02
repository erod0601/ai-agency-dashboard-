"use client";

import { useRouter } from "next/navigation";
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
  const router = useRouter();

  return (
    <Select
      value={activeClient?.id ?? ""}
      onValueChange={(id) => {
        const found = clients.find((c) => c.id === id);
        if (found) {
          setActiveClient(found);
          // Update the URL so the server page re-fetches metrics for the new client
          router.push(`?client_id=${id}`);
        }
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
