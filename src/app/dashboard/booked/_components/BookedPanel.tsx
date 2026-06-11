'use client'

import { useMemo, useState } from 'react'
import { CalendarDays, CalendarCheck, DollarSign, Phone, MessageSquare, X, ArrowLeft, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import type { Appointment } from '@/types/database'

function formatDateTime(iso: string): string {
  const d = new Date(iso)
  return (
    d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) +
    ', ' +
    d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  )
}

function isToday(iso: string): boolean {
  const d = new Date(iso)
  const now = new Date()
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate()
}

function titleCase(s: string | null): string {
  if (!s) return '—'
  return s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

const usd = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)

// appointments.status: confirmed | cancelled | completed | no_show | booked
const STATUS_STYLES: Record<string, { label: string; className: string }> = {
  confirmed: { label: 'Confirmed', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  booked:    { label: 'Booked',    className: 'bg-sky-50 text-sky-700 border-sky-200' },
  completed: { label: 'Completed', className: 'bg-slate-100 text-slate-600 border-slate-200' },
  cancelled: { label: 'Cancelled', className: 'bg-rose-50 text-rose-700 border-rose-200' },
  no_show:   { label: 'No Show',   className: 'bg-amber-50 text-amber-700 border-amber-200' },
}

const STATUS_OPTIONS = [
  { value: 'all', label: 'All Statuses' },
  ...Object.entries(STATUS_STYLES).map(([value, s]) => ({ value, label: s.label })),
]

function StatusBadge({ status }: { status: string | null }) {
  if (!status) return <span className="text-xs text-muted-foreground">—</span>
  const s = STATUS_STYLES[status]
  return (
    <Badge variant="outline" className={cn('font-normal', s?.className)}>
      {s?.label ?? titleCase(status)}
    </Badge>
  )
}

function MetricCard({ icon: Icon, label, value, hint }: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: number | string
  hint: string
}) {
  return (
    <Card className="gap-1 px-4 py-3">
      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Icon className="size-3.5" />
        {label}
      </div>
      <p className="text-2xl font-semibold tabular-nums">{value}</p>
      <p className="text-xs text-muted-foreground">{hint}</p>
    </Card>
  )
}

interface BookedPanelProps {
  appointments: Appointment[]
}

export function BookedPanel({ appointments }: BookedPanelProps) {
  const [statusFilter, setStatusFilter] = useState('all')
  const [selected, setSelected] = useState<Appointment | null>(null)

  const now = Date.now()

  const metrics = useMemo(() => {
    const active = appointments.filter(a => a.status === 'confirmed' || a.status === 'booked')
    const upcoming = active.filter(a => new Date(a.scheduled_at).getTime() >= now)
    return {
      today: active.filter(a => isToday(a.scheduled_at)).length,
      upcoming: upcoming.length,
      completed: appointments.filter(a => a.status === 'completed').length,
      pipeline: upcoming.reduce((s, a) => s + (a.estimated_value ?? 0), 0),
    }
  }, [appointments, now])

  const filtered = useMemo(
    () => (statusFilter === 'all' ? appointments : appointments.filter(a => a.status === statusFilter)),
    [appointments, statusFilter]
  )

  const statusLabel = STATUS_OPTIONS.find(o => o.value === statusFilter)?.label ?? 'All Statuses'

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard icon={CalendarDays}  label="Today"          value={metrics.today}     hint="on the calendar" />
        <MetricCard icon={Clock}         label="Upcoming"       value={metrics.upcoming}  hint="confirmed or booked" />
        <MetricCard icon={CalendarCheck} label="Completed"      value={metrics.completed} hint="all time" />
        <MetricCard icon={DollarSign}    label="Pipeline Value" value={usd(metrics.pipeline)} hint="upcoming appointments" />
      </div>

      <div className="flex items-start gap-4">
        <div className={cn('min-w-0 flex-1 space-y-4', selected && 'hidden md:block')}>
          <div className="flex items-center gap-2">
            <Select value={statusFilter} onValueChange={v => setStatusFilter(v ?? 'all')}>
              <SelectTrigger className="h-8 w-40">
                <SelectValue>{statusLabel}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map(o => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="ml-auto text-xs text-muted-foreground">
              {filtered.length} appointment{filtered.length !== 1 ? 's' : ''}
            </span>
          </div>

          <Card className="py-0">
            {filtered.length === 0 ? (
              <div className="flex items-center justify-center py-16">
                <p className="text-sm text-muted-foreground">No appointments match the selected filter.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="pl-4">When</TableHead>
                      <TableHead>Contact</TableHead>
                      <TableHead>Service</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Via</TableHead>
                      <TableHead className="pr-4 text-right">Value</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map(appt => (
                      <TableRow
                        key={appt.id}
                        onClick={() => setSelected(appt)}
                        className={cn('cursor-pointer', selected?.id === appt.id && 'bg-muted')}
                      >
                        <TableCell className="whitespace-nowrap pl-4 text-muted-foreground">
                          {formatDateTime(appt.scheduled_at)}
                        </TableCell>
                        <TableCell className="font-medium">{appt.contact_name ?? 'Unknown'}</TableCell>
                        <TableCell className="text-muted-foreground">{titleCase(appt.service_type)}</TableCell>
                        <TableCell><StatusBadge status={appt.status} /></TableCell>
                        <TableCell>
                          {appt.bookedVia === 'call' ? (
                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Phone className="size-3" /> Call
                            </span>
                          ) : appt.bookedVia === 'sms' ? (
                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                              <MessageSquare className="size-3" /> Text
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="pr-4 text-right tabular-nums">
                          {appt.estimated_value != null ? usd(appt.estimated_value) : '—'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </Card>
        </div>

        {selected && (
          <div className="w-full shrink-0 md:w-80">
            <button
              type="button"
              onClick={() => setSelected(null)}
              className="mb-3 flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground md:hidden"
            >
              <ArrowLeft className="size-4" />
              Back to appointments
            </button>

            <Card className="py-0 md:sticky md:top-6" style={{ maxHeight: 'calc(100vh - 10rem)', overflow: 'hidden' }}>
              <div className="flex h-full flex-col overflow-hidden">
                <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
                  <h3 className="text-sm font-semibold">Appointment Details</h3>
                  <button
                    type="button"
                    onClick={() => setSelected(null)}
                    className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    aria-label="Close"
                  >
                    <X className="size-4" />
                  </button>
                </div>

                <div className="flex-1 space-y-5 overflow-y-auto px-4 py-4">
                  <div>
                    <p className="text-sm font-medium">{selected.contact_name ?? 'Unknown'}</p>
                    {selected.contact_phone && (
                      <p className="text-xs text-muted-foreground">{selected.contact_phone}</p>
                    )}
                  </div>

                  <Field label="Scheduled">
                    <p className="text-sm">{formatDateTime(selected.scheduled_at)}</p>
                    {selected.duration_minutes != null && (
                      <p className="text-xs text-muted-foreground">{selected.duration_minutes} minutes</p>
                    )}
                  </Field>

                  <Field label="Service">
                    <p className="text-sm">{titleCase(selected.service_type)}</p>
                  </Field>

                  <Field label="Status">
                    <StatusBadge status={selected.status} />
                  </Field>

                  <Field label="Booked via">
                    <p className="text-sm capitalize">{selected.bookedVia === 'sms' ? 'Text conversation' : selected.bookedVia === 'call' ? 'AI phone call' : 'Unknown'}</p>
                  </Field>

                  {selected.estimated_value != null && (
                    <Field label="Estimated value">
                      <p className="text-sm tabular-nums">{usd(selected.estimated_value)}</p>
                    </Field>
                  )}

                  {selected.notes && (
                    <Field label="Notes">
                      <p className="text-sm leading-relaxed text-muted-foreground">{selected.notes}</p>
                    </Field>
                  )}

                  {selected.google_calendar_event_id && (
                    <Field label="Calendar">
                      <p className="text-sm text-muted-foreground">Synced to Google Calendar</p>
                    </Field>
                  )}
                </div>
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      {children}
    </div>
  )
}
