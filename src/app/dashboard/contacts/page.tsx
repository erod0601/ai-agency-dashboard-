"use client";

import { useEffect, useState, useCallback } from "react";
import { useClientContext } from "@/lib/client-context";
import { createClient } from "@/lib/supabase/client";
import {
  Phone,
  MessageSquare,
  Calendar,
  Search,
  Filter,
  ChevronRight,
  X,
  ArrowUpRight,
  Clock,
  User,
  TrendingUp,
  Loader2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { deriveLeadStatus, LEAD_STATUS_CONFIG } from "@/lib/lead-status";
import {
  getAvgTicket,
  estimateContactRevenue,
  formatRevenueLabel,
  hasExactValue,
} from "@/lib/revenue";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Contact {
  id: string;
  client_id: string;
  phone: string;
  email: string | null;
  full_name: string | null;
  source: string | null;
  first_seen_at: string;
  last_seen_at: string;
  crm_external_id: string | null;
  crm_synced_at: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  // from contacts_enriched view
  call_count: number;
  appointment_count: number;
}

interface ContactCall {
  id: string;
  started_at: string;
  duration_seconds: number | null;
  outcome: string | null;
  intent: string | null;
  summary: string | null;
}

interface ContactAppointment {
  id: string;
  scheduled_at: string;
  service_type: string | null;
  status: string;
  notes: string | null;
  estimated_value: number | null;
  created_at: string | null;
}

interface ContactMessage {
  id: string;
  direction: "inbound" | "outbound";
  body: string;
  created_at: string;
}

interface ContactDetail extends Contact {
  calls: ContactCall[];
  appointments: ContactAppointment[];
  messages: ContactMessage[];
  // not yet a real column — populated only if the API adds it later
  tags?: string[] | null;
}

// One unified feed across calls, SMS, and appointments, newest first.
type TimelineEvent =
  | { kind: "call"; ts: string; call: ContactCall }
  | { kind: "sms"; ts: string; message: ContactMessage }
  | { kind: "appointment"; ts: string; appointment: ContactAppointment };

function buildTimeline(detail: ContactDetail): TimelineEvent[] {
  const events: TimelineEvent[] = [
    ...detail.calls.map((call): TimelineEvent => ({ kind: "call", ts: call.started_at, call })),
    ...detail.messages.map((message): TimelineEvent => ({ kind: "sms", ts: message.created_at, message })),
    // An appointment enters the story when it was booked (created_at), not
    // when it happens — the scheduled date is shown on the row instead.
    ...detail.appointments.map((appointment): TimelineEvent => ({
      kind: "appointment",
      ts: appointment.created_at ?? appointment.scheduled_at,
      appointment,
    })),
  ];
  return events.sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime());
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatPhone(raw: string) {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) {
    const d = digits.slice(1);
    return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return raw;
}

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatDuration(secs: number | null) {
  if (!secs) return "—";
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function outcomeColor(outcome: string | null) {
  switch (outcome) {
    case "booked": return "bg-emerald-500/15 text-emerald-400 border-emerald-500/20";
    case "callback": return "bg-amber-500/15 text-amber-400 border-amber-500/20";
    case "completed": return "bg-sky-500/15 text-sky-400 border-sky-500/20";
    case "no_answer": return "bg-zinc-500/15 text-zinc-400 border-zinc-500/20";
    case "voicemail": return "bg-violet-500/15 text-violet-400 border-violet-500/20";
    default: return "bg-zinc-500/15 text-zinc-400 border-zinc-500/20";
  }
}

function apptStatusColor(status: string) {
  switch (status) {
    case "confirmed": return "bg-emerald-500/15 text-emerald-400 border-emerald-500/20";
    case "completed": return "bg-sky-500/15 text-sky-400 border-sky-500/20";
    case "cancelled": return "bg-red-500/15 text-red-400 border-red-500/20";
    case "no_show": return "bg-orange-500/15 text-orange-400 border-orange-500/20";
    default: return "bg-zinc-500/15 text-zinc-400 border-zinc-500/20";
  }
}

function sourceIcon(source: string | null) {
  if (source === "sms") return <MessageSquare className="w-3 h-3" />;
  return <Phone className="w-3 h-3" />;
}

// ─── Contact Row ─────────────────────────────────────────────────────────────

function ContactRow({
  contact,
  selected,
  onClick,
}: {
  contact: Contact;
  selected: boolean;
  onClick: () => void;
}) {
  const displayName = contact.full_name ?? formatPhone(contact.phone);
  const isAnon = !contact.full_name;

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full text-left px-4 py-3.5 border-b border-border/50 transition-all duration-150",
        "hover:bg-accent/40 group",
        selected && "bg-accent border-l-2 border-l-[var(--brand-color,hsl(var(--primary)))]"
      )}
    >
      <div className="flex items-center gap-3">
        {/* Avatar */}
        <div
          className={cn(
            "w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-sm font-semibold",
            isAnon
              ? "bg-muted text-muted-foreground"
              : "bg-[var(--brand-color,hsl(var(--primary)))]/15 text-[var(--brand-color,hsl(var(--primary)))]"
          )}
        >
          {isAnon ? <User className="w-4 h-4" /> : displayName[0].toUpperCase()}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            <span
              className={cn(
                "text-sm font-medium truncate",
                isAnon ? "text-muted-foreground italic" : "text-foreground"
              )}
            >
              {displayName}
            </span>
            <span className="text-muted-foreground/60 shrink-0">
              {sourceIcon(contact.source)}
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {contact.full_name && (
              <span className="truncate">{formatPhone(contact.phone)}</span>
            )}
            <span className="shrink-0 flex items-center gap-1">
              <Phone className="w-2.5 h-2.5" />
              {contact.call_count}
            </span>
            {contact.appointment_count > 0 && (
              <span className="shrink-0 flex items-center gap-1 text-emerald-400">
                <Calendar className="w-2.5 h-2.5" />
                {contact.appointment_count}
              </span>
            )}
          </div>
        </div>

        {/* Last seen + chevron */}
        <div className="text-right shrink-0 flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {relativeTime(contact.last_seen_at)}
          </span>
          <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors" />
        </div>
      </div>
    </button>
  );
}

// ─── Detail Panel ─────────────────────────────────────────────────────────────

function ContactDetailPanel({
  contact,
  avgTicket,
  onClose,
}: {
  contact: ContactDetail | null;
  avgTicket: number;
  onClose: () => void;
}) {
  if (!contact) return null;

  const displayName = contact.full_name ?? formatPhone(contact.phone);

  // Derived, never stored — always consistent with the activity below.
  const hasTwoWaySms =
    contact.messages.some((m) => m.direction === "inbound") &&
    contact.messages.some((m) => m.direction === "outbound");
  const leadStatus = deriveLeadStatus(contact.calls, contact.appointments, contact.metadata, {
    hasTwoWaySms,
  });
  const statusConfig = LEAD_STATUS_CONFIG[leadStatus];
  const revenue = estimateContactRevenue(contact, contact.appointments, avgTicket);
  const timeline = buildTimeline(contact);

  return (
    <Sheet open={!!contact} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto p-0" side="right">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border px-6 py-5">
          <SheetHeader>
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div
                  className="w-11 h-11 rounded-full flex items-center justify-center text-base font-bold shrink-0"
                  style={{ background: "var(--brand-color, hsl(var(--primary)))", opacity: 0.85 }}
                >
                  {contact.full_name ? contact.full_name[0].toUpperCase() : <User className="w-5 h-5" />}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <SheetTitle className="text-base leading-tight">{displayName}</SheetTitle>
                    <Badge variant="outline" className={cn("text-[11px] border", statusConfig.className)}>
                      {statusConfig.label}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {formatPhone(contact.phone)}
                  </p>
                  {(revenue.realized > 0 || revenue.pipeline > 0) && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {revenue.realized > 0 && (
                        <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                          {formatRevenueLabel(revenue.realized)} realized
                        </span>
                      )}
                      {revenue.realized > 0 && revenue.pipeline > 0 && " · "}
                      {revenue.pipeline > 0 && (
                        <span className="text-sky-600 dark:text-sky-400 font-medium">
                          {formatRevenueLabel(revenue.pipeline)} pipeline
                        </span>
                      )}
                    </p>
                  )}
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={onClose} className="shrink-0 -mr-1">
                <X className="w-4 h-4" />
              </Button>
            </div>
          </SheetHeader>

          {/* Quick stats */}
          <div className="grid grid-cols-3 gap-3 mt-4">
            {[
              { icon: Phone, label: "Calls", value: contact.call_count },
              { icon: Calendar, label: "Appts", value: contact.appointment_count },
              {
                icon: Clock,
                label: "First seen",
                value: new Date(contact.first_seen_at).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                }),
              },
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} className="bg-muted/50 rounded-lg px-3 py-2.5 text-center">
                <Icon className="w-3.5 h-3.5 mx-auto mb-1 text-muted-foreground" />
                <div className="text-sm font-semibold">{value}</div>
                <div className="text-[10px] text-muted-foreground uppercase tracking-wide mt-0.5">
                  {label}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="px-6 py-5 space-y-6">
          {/* Tags */}
          {contact.tags && contact.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {contact.tags.map((tag) => (
                <Badge key={tag} variant="secondary" className="text-xs">
                  {tag}
                </Badge>
              ))}
            </div>
          )}

          {/* Unified timeline: calls + SMS + appointments, newest first */}
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-2">
              <Clock className="w-3.5 h-3.5" /> Timeline
            </h3>
            {timeline.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">No activity yet</p>
            ) : (
              <div className="space-y-2">
                {timeline.map((event) => {
                  if (event.kind === "call") {
                    const call = event.call;
                    return (
                      <div
                        key={`call-${call.id}`}
                        className="flex gap-3 rounded-lg border border-border/60 bg-muted/20 p-3 text-sm"
                      >
                        <div className="w-7 h-7 rounded-md bg-muted flex items-center justify-center shrink-0 mt-0.5">
                          <Phone className="w-3.5 h-3.5 text-muted-foreground" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge
                                variant="outline"
                                className={cn("text-[11px] border", outcomeColor(call.outcome))}
                              >
                                {call.outcome ?? "unknown"}
                              </Badge>
                              {call.intent && (
                                <span className="text-xs text-muted-foreground capitalize">
                                  {call.intent.replace(/_/g, " ")}
                                </span>
                              )}
                            </div>
                            <span className="text-xs text-muted-foreground shrink-0">
                              {relativeTime(call.started_at)}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            <span>{formatDuration(call.duration_seconds)}</span>
                            {call.summary && (
                              <span className="truncate text-foreground/70">{call.summary}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  }

                  if (event.kind === "sms") {
                    const msg = event.message;
                    return (
                      <div
                        key={`sms-${msg.id}`}
                        className="flex gap-3 rounded-lg border border-border/60 bg-muted/20 p-3 text-sm"
                      >
                        <div className="w-7 h-7 rounded-md bg-muted flex items-center justify-center shrink-0 mt-0.5">
                          <MessageSquare className="w-3.5 h-3.5 text-muted-foreground" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <span className="text-xs font-medium text-muted-foreground">
                              {msg.direction === "inbound" ? "SMS received" : "SMS sent"}
                            </span>
                            <span className="text-xs text-muted-foreground shrink-0">
                              {relativeTime(msg.created_at)}
                            </span>
                          </div>
                          <p className="text-xs text-foreground/70 line-clamp-2">{msg.body}</p>
                        </div>
                      </div>
                    );
                  }

                  const appt = event.appointment;
                  // "Est." prefix unless a completed appointment carries a real value.
                  const valueLabel = formatRevenueLabel(
                    appt.estimated_value ?? avgTicket,
                    hasExactValue(appt)
                  );
                  return (
                    <div
                      key={`appt-${appt.id}`}
                      className="flex gap-3 rounded-lg border border-border/60 bg-muted/20 p-3 text-sm"
                    >
                      <div className="w-7 h-7 rounded-md bg-muted flex items-center justify-center shrink-0 mt-0.5">
                        <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge
                              variant="outline"
                              className={cn("text-[11px] border", apptStatusColor(appt.status))}
                            >
                              {appt.status}
                            </Badge>
                            {appt.service_type && (
                              <span className="text-xs text-muted-foreground capitalize">
                                {appt.service_type.replace(/_/g, " ")}
                              </span>
                            )}
                            {(appt.status === "confirmed" || appt.status === "booked" || appt.status === "completed") && (
                              <span className="text-xs font-medium tabular-nums text-emerald-600 dark:text-emerald-400">
                                {valueLabel}
                              </span>
                            )}
                          </div>
                          <span className="text-xs text-muted-foreground shrink-0">
                            {new Date(appt.scheduled_at).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              hour: "numeric",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>
                        {appt.notes && (
                          <p className="text-xs text-muted-foreground mt-1">{appt.notes}</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Metadata (dev helper, hide in prod) */}
          {contact.metadata && Object.keys(contact.metadata).length > 0 && (
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-2">
                <TrendingUp className="w-3.5 h-3.5" /> Extra Data
              </h3>
              <pre className="text-[11px] bg-muted/50 rounded-lg p-3 overflow-x-auto text-muted-foreground">
                {JSON.stringify(contact.metadata, null, 2)}
              </pre>
            </section>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ─── Skeleton Loader ──────────────────────────────────────────────────────────

function ContactSkeleton() {
  return (
    <div className="px-4 py-3.5 border-b border-border/50">
      <div className="flex items-center gap-3">
        <Skeleton className="w-9 h-9 rounded-full shrink-0" />
        <div className="flex-1 space-y-1.5">
          <Skeleton className="h-3.5 w-32" />
          <Skeleton className="h-3 w-20" />
        </div>
        <Skeleton className="h-3 w-12" />
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ContactsPage() {
  const { activeClient } = useClientContext();
  const clientId = activeClient?.id ?? null;
  const supabase = createClient();

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [filtered, setFiltered] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("last_seen_at");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ContactDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [avgTicketValue, setAvgTicketValue] = useState<number | null>(null);

  // Client's average job value — feeds the Est. revenue figures in the detail
  // panel. getAvgTicket falls back to the honest placeholder when unset.
  useEffect(() => {
    if (!clientId) return;
    supabase
      .from("client_settings")
      .select("avg_ticket_value")
      .eq("client_id", clientId)
      .single()
      .then(({ data }) => setAvgTicketValue(data?.avg_ticket_value ?? null));
  }, [clientId, supabase]);
  const avgTicket = getAvgTicket({ avg_ticket_value: avgTicketValue });

  // ── Fetch contacts ──────────────────────────────────────────────────────────
  const fetchContacts = useCallback(async () => {
    // Wait for ClientProvider to resolve the active client — never query
    // unfiltered across all clients
    if (!clientId) return;
    setLoading(true);
    const q = supabase
      .from("contacts_enriched")
      .select("*")
      .order(sortBy === "calls" ? "call_count" : sortBy === "name" ? "full_name" : "last_seen_at", {
        ascending: sortBy === "name",
        nullsFirst: false,
      })
      .eq("client_id", clientId);

    const { data, error } = await q.limit(200);
    if (!error && data) {
      setContacts(data as Contact[]);
    }
    setLoading(false);
  }, [clientId, sortBy, supabase]);

  useEffect(() => {
    fetchContacts();
  }, [fetchContacts]);

  // ── Filter ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    let list = [...contacts];

    if (sourceFilter !== "all") {
      list = list.filter(
        (c) => c.source === sourceFilter
      );
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (c) =>
          (c.full_name ?? "").toLowerCase().includes(q) ||
          c.phone.includes(q) ||
          (c.email ?? "").toLowerCase().includes(q)
      );
    }

    setFiltered(list);
  }, [contacts, search, sourceFilter]);

  // ── Fetch detail ────────────────────────────────────────────────────────────
  const openDetail = useCallback(
    async (id: string) => {
      setSelectedId(id);
      setDetailLoading(true);

      const [contactRes, callsRes, apptsRes, messagesRes] = await Promise.all([
        supabase.from("contacts").select("*").eq("id", id).single(),
        supabase
          .from("calls")
          .select("id, started_at, duration_seconds, outcome, intent, summary")
          .eq("contact_id", id)
          .order("started_at", { ascending: false })
          .limit(20),
        supabase
          .from("appointments")
          .select("id, scheduled_at, service_type, status, notes, estimated_value, created_at")
          .eq("contact_id", id)
          .order("scheduled_at", { ascending: false })
          .limit(20),
        supabase
          .from("messages")
          .select("id, direction, body, created_at")
          .eq("contact_id", id)
          .order("created_at", { ascending: false })
          .limit(30),
      ]);

      if (contactRes.data) {
        setDetail({
          ...(contactRes.data as Contact),
          calls: (callsRes.data ?? []) as ContactCall[],
          appointments: (apptsRes.data ?? []) as ContactAppointment[],
          messages: (messagesRes.data ?? []) as ContactMessage[],
        });
      }
      setDetailLoading(false);
    },
    [supabase]
  );

  // ── Stats bar ───────────────────────────────────────────────────────────────
  const totalCalls = contacts.reduce((s, c) => s + c.call_count, 0);
  const totalAppts = contacts.reduce((s, c) => s + c.appointment_count, 0);
  const identified = contacts.filter((c) => c.full_name).length;

  return (
    <div className="flex flex-col h-full">
      {/* Page header */}
      <div className="px-6 py-5 border-b border-border">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Contacts</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Everyone who has called or messaged your client&apos;s AI
            </p>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/60 rounded-lg px-3 py-1.5">
            <ArrowUpRight className="w-3 h-3" />
            {contacts.length.toLocaleString()} contacts
          </div>
        </div>

        {/* Summary pills */}
        {!loading && (
          <div className="flex items-center gap-2 flex-wrap">
            {[
              { label: "Total calls", value: totalCalls.toLocaleString() },
              { label: "Appointments", value: totalAppts.toLocaleString() },
              {
                label: "Identified",
                value: `${identified} / ${contacts.length}`,
              },
            ].map(({ label, value }) => (
              <div
                key={label}
                className="rounded-md bg-muted/50 border border-border/50 px-2.5 py-1 text-xs"
              >
                <span className="text-muted-foreground">{label}: </span>
                <span className="font-medium">{value}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Toolbar */}
      <div className="px-6 py-3 border-b border-border flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            className="pl-8 h-8 text-sm"
            placeholder="Search name, phone, email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <Select value={sourceFilter} onValueChange={(v) => setSourceFilter(v ?? "all")}>
          <SelectTrigger className="h-8 w-28 text-xs">
            <Filter className="w-3 h-3 mr-1.5" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All channels</SelectItem>
            <SelectItem value="voice">Voice only</SelectItem>
            <SelectItem value="sms">SMS only</SelectItem>
            <SelectItem value="both">Both</SelectItem>
          </SelectContent>
        </Select>

        <Select value={sortBy} onValueChange={(v) => setSortBy(v ?? "last_seen_at")}>
          <SelectTrigger className="h-8 w-32 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="last_seen_at">Last active</SelectItem>
            <SelectItem value="first_seen_at">First seen</SelectItem>
            <SelectItem value="call_count">Most calls</SelectItem>
            <SelectItem value="name">Name A–Z</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Contact list */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          Array.from({ length: 10 }).map((_, i) => <ContactSkeleton key={i} />)
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-muted-foreground gap-2">
            <User className="w-10 h-10 opacity-20" />
            <p className="text-sm">
              {search ? "No contacts match your search" : "No contacts yet"}
            </p>
          </div>
        ) : (
          filtered.map((c) => (
            <ContactRow
              key={c.id}
              contact={c}
              selected={selectedId === c.id}
              onClick={() => openDetail(c.id)}
            />
          ))
        )}
      </div>

      {/* Detail panel (slide-over) */}
      {detailLoading ? (
        <Sheet open={true} onOpenChange={() => { setSelectedId(null); setDetailLoading(false); }}>
          <SheetContent className="w-full sm:max-w-lg flex items-center justify-center" side="right">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </SheetContent>
        </Sheet>
      ) : (
        <ContactDetailPanel
          contact={detail}
          avgTicket={avgTicket}
          onClose={() => {
            setDetail(null);
            setSelectedId(null);
          }}
        />
      )}
    </div>
  );
}
