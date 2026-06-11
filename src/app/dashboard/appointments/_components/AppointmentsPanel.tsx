'use client'

import { useState, useMemo } from 'react'
import { Phone, MessageSquare, X, ArrowLeft, ChevronLeft, ChevronRight, LayoutList, CalendarDays } from 'lucide-react'
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

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDateTime(iso: string): string {
  const d = new Date(iso)
  return (
    d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) +
    ', ' +
    d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  )
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

function formatServiceType(s: string | null): string {
  if (!s) return '—'
  return s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

// ── Status badge ──────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<string, { label: string; className: string }> = {
  confirmed:  { label: 'Confirmed',  className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  cancelled:  { label: 'Cancelled',  className: 'bg-rose-50 text-rose-700 border-rose-200' },
  completed:  { label: 'Completed',  className: 'bg-slate-100 text-slate-600 border-slate-200' },
  no_show:    { label: 'No Show',    className: 'bg-amber-50 text-amber-700 border-amber-200' },
}

function StatusBadge({ status }: { status: string | null }) {
  if (!status) return <span className="text-xs text-muted-foreground">—</span>
  const style = STATUS_STYLES[status]
  const label = style?.label ?? status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
  return (
    <Badge variant="outline" className={cn('font-normal', style?.className)}>
      {label}
    </Badge>
  )
}

// ── Booked via icon ────────────────────────────────────────────────────────────

function BookedViaIcon({ via }: { via: string | null }) {
  if (via === 'call') return <Phone className="size-3.5 text-muted-foreground" />
  if (via === 'sms')  return <MessageSquare className="size-3.5 text-muted-foreground" />
  return <span className="text-xs text-muted-foreground">{via ?? '—'}</span>
}

// ── Filter config ─────────────────────────────────────────────────────────────

type DateRange = '7d' | '30d' | '90d' | 'upcoming' | 'all'

const DATE_RANGE_LABELS: Record<DateRange, string> = {
  '7d':      'Last 7 days',
  '30d':     'Last 30 days',
  '90d':     'Last 90 days',
  'upcoming':'Upcoming',
  'all':     'All time',
}

const STATUS_OPTIONS = [
  { value: 'all',       label: 'All Statuses' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'completed', label: 'Completed' },
  { value: 'no_show',   label: 'No Show' },
]

const BOOKED_VIA_OPTIONS = [
  { value: 'all',  label: 'All Sources' },
  { value: 'call', label: 'Call' },
  { value: 'sms',  label: 'SMS' },
]

// ── Detail panel ──────────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      {children}
    </div>
  )
}

function DetailPanel({ appt, onClose }: { appt: Appointment; onClose: () => void }) {
  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
        <h3 className="text-sm font-semibold">Appointment Details</h3>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <X className="size-4" />
        </button>
      </div>
      <div className="flex-1 space-y-5 overflow-y-auto px-4 py-4">
        <Field label="Contact">
          <p className="text-sm font-medium">{appt.contact_name ?? 'Unknown'}</p>
          {appt.contact_phone && <p className="text-xs text-muted-foreground">{appt.contact_phone}</p>}
        </Field>
        <Field label="Scheduled">
          <p className="text-sm">{formatDateTime(appt.scheduled_at)}</p>
        </Field>
        <Field label="Status">
          <StatusBadge status={appt.status} />
        </Field>
        <Field label="Service">
          <p className="text-sm">{formatServiceType(appt.service_type)}</p>
        </Field>
        <Field label="Booked Via">
          <div className="flex items-center gap-1.5 text-sm">
            <BookedViaIcon via={appt.bookedVia} />
            {appt.bookedVia !== 'unknown'
              ? appt.bookedVia.charAt(0).toUpperCase() + appt.bookedVia.slice(1)
              : '—'}
          </div>
        </Field>
        {appt.notes && (
          <Field label="Notes">
            <p className="text-sm leading-relaxed text-muted-foreground">{appt.notes}</p>
          </Field>
        )}
        {appt.call_id && (
          <Field label="Linked Call">
            <p className="font-mono text-xs text-muted-foreground">{appt.call_id}</p>
          </Field>
        )}
        <Field label="Created">
          <p className="text-sm text-muted-foreground">{formatDateTime(appt.created_at)}</p>
        </Field>
      </div>
    </div>
  )
}

// ── Calendar view ─────────────────────────────────────────────────────────────

const WEEK_DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

function getCalendarGrid(date: Date): (Date | null)[] {
  const year = date.getFullYear()
  const month = date.getMonth()
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  const grid: (Date | null)[] = []

  for (let i = 0; i < firstDay.getDay(); i++) grid.push(null)
  for (let d = 1; d <= lastDay.getDate(); d++) grid.push(new Date(year, month, d))
  while (grid.length % 7 !== 0) grid.push(null)

  return grid
}

function CalendarView({
  appointments,
  selectedAppt,
  onSelectAppt,
}: {
  appointments: Appointment[]
  selectedAppt: Appointment | null
  onSelectAppt: (a: Appointment) => void
}) {
  const [calMonth, setCalMonth] = useState(new Date())
  const [selectedDay, setSelectedDay] = useState<Date | null>(null)

  const today = new Date()

  const monthAppts = useMemo(() => {
    const y = calMonth.getFullYear()
    const m = calMonth.getMonth()
    return appointments.filter(a => {
      const d = new Date(a.scheduled_at)
      return d.getFullYear() === y && d.getMonth() === m
    })
  }, [appointments, calMonth])

  const byDay = useMemo(() => {
    const map = new Map<string, Appointment[]>()
    for (const a of monthAppts) {
      const key = new Date(a.scheduled_at).toDateString()
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(a)
    }
    return map
  }, [monthAppts])

  const dayAppointments = selectedDay
    ? (byDay.get(selectedDay.toDateString()) ?? [])
    : []

  const grid = getCalendarGrid(calMonth)

  return (
    <div className="space-y-4">
      {/* Month navigation */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => { setCalMonth(d => new Date(d.getFullYear(), d.getMonth() - 1, 1)); setSelectedDay(null) }}
          className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          <ChevronLeft className="size-4" />
        </button>
        <p className="text-sm font-semibold">
          {calMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
        </p>
        <button
          type="button"
          onClick={() => { setCalMonth(d => new Date(d.getFullYear(), d.getMonth() + 1, 1)); setSelectedDay(null) }}
          className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          <ChevronRight className="size-4" />
        </button>
      </div>

      {/* Calendar grid */}
      <Card className="py-0 overflow-hidden">
        {/* Week day headers */}
        <div className="grid grid-cols-7 border-b border-border">
          {WEEK_DAYS.map(d => (
            <div key={d} className="py-2 text-center text-xs font-medium text-muted-foreground">
              {d}
            </div>
          ))}
        </div>

        {/* Day cells */}
        <div className="grid grid-cols-7">
          {grid.map((day, i) => {
            const count = day ? (byDay.get(day.toDateString())?.length ?? 0) : 0
            const isToday = day ? isSameDay(day, today) : false
            const isSelected = day && selectedDay ? isSameDay(day, selectedDay) : false

            return (
              <button
                key={i}
                type="button"
                disabled={!day}
                onClick={() => day && setSelectedDay(isSelected ? null : day)}
                className={cn(
                  'relative flex h-12 flex-col items-center justify-center border-b border-r border-border text-sm transition-colors',
                  !day && 'invisible',
                  day && 'hover:bg-muted',
                  isSelected && 'bg-muted',
                  isToday && 'font-bold',
                  // Remove right border on last column, bottom border on last row
                  (i + 1) % 7 === 0 && 'border-r-0',
                  i >= grid.length - 7 && 'border-b-0'
                )}
              >
                <span className={cn(
                  'flex size-7 items-center justify-center rounded-full text-sm',
                  isToday && !isSelected && 'bg-foreground text-background',
                )}>{day?.getDate()}</span>
                {count > 0 && (
                  <span className="absolute bottom-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-semibold text-primary-foreground">
                    {count}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </Card>

      {/* Selected day's appointments */}
      {selectedDay && (
        <div className="space-y-2">
          <p className="text-sm font-semibold">
            {selectedDay.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              {dayAppointments.length} appointment{dayAppointments.length !== 1 ? 's' : ''}
            </span>
          </p>

          {dayAppointments.length === 0 ? (
            <p className="text-sm text-muted-foreground">No appointments this day.</p>
          ) : (
            dayAppointments.map(appt => (
              <button
                key={appt.id}
                type="button"
                onClick={() => onSelectAppt(appt)}
                className={cn(
                  'w-full rounded-lg border border-border bg-card px-4 py-3 text-left transition-colors hover:bg-muted',
                  selectedAppt?.id === appt.id && 'bg-muted'
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{appt.contact_name ?? 'Unknown'}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatTime(appt.scheduled_at)}
                      {appt.service_type && ` · ${formatServiceType(appt.service_type)}`}
                    </p>
                  </div>
                  <StatusBadge status={appt.status} />
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

interface AppointmentsPanelProps {
  appointments: Appointment[]
}

export function AppointmentsPanel({ appointments }: AppointmentsPanelProps) {
  const [view, setView] = useState<'table' | 'calendar'>('table')
  const [dateRange, setDateRange] = useState<DateRange>('30d')
  const [statusFilter, setStatusFilter] = useState('all')
  const [bookedViaFilter, setBookedViaFilter] = useState('all')
  const [selectedAppt, setSelectedAppt] = useState<Appointment | null>(null)

  // Table-view client-side filtering
  const filtered = useMemo(() => {
    let result = appointments

    if (dateRange !== 'all') {
      const today = new Date()
      today.setHours(0, 0, 0, 0)

      if (dateRange === 'upcoming') {
        result = result.filter(a => new Date(a.scheduled_at) >= today)
      } else {
        const days = dateRange === '7d' ? 7 : dateRange === '30d' ? 30 : 90
        const cutoff = new Date()
        cutoff.setDate(cutoff.getDate() - days)
        result = result.filter(a => new Date(a.scheduled_at) >= cutoff)
      }
    }

    if (statusFilter !== 'all')    result = result.filter(a => a.status === statusFilter)
    if (bookedViaFilter !== 'all') result = result.filter(a => a.bookedVia === bookedViaFilter)

    return result
  }, [appointments, dateRange, statusFilter, bookedViaFilter])

  const statusLabel    = STATUS_OPTIONS.find(o => o.value === statusFilter)?.label ?? 'All Statuses'
  const bookedViaLabel = BOOKED_VIA_OPTIONS.find(o => o.value === bookedViaFilter)?.label ?? 'All Sources'

  return (
    <div className="space-y-4">
      {/* View toggle — top right */}
      <div className="flex items-center justify-end">
        <div className="flex overflow-hidden rounded-lg border border-border">
          <button
            type="button"
            onClick={() => setView('table')}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors',
              view === 'table'
                ? 'bg-foreground text-background'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <LayoutList className="size-3.5" /> Table
          </button>
          <button
            type="button"
            onClick={() => setView('calendar')}
            className={cn(
              'flex items-center gap-1.5 border-l border-border px-3 py-1.5 text-xs font-medium transition-colors',
              view === 'calendar'
                ? 'bg-foreground text-background'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <CalendarDays className="size-3.5" /> Calendar
          </button>
        </div>
      </div>

      {/* ── Calendar view ─────────────────────────────────────────────── */}
      {view === 'calendar' && (
        <div className="flex items-start gap-4">
          <div className={cn('min-w-0 flex-1', selectedAppt && 'hidden md:block')}>
            <CalendarView
              appointments={appointments}
              selectedAppt={selectedAppt}
              onSelectAppt={setSelectedAppt}
            />
          </div>

          {selectedAppt && (
            <div className="w-full md:w-80 shrink-0">
              <button
                type="button"
                onClick={() => setSelectedAppt(null)}
                className="mb-3 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors md:hidden"
              >
                <ArrowLeft className="size-4" /> Back
              </button>
              <Card className="py-0 md:sticky md:top-6" style={{ maxHeight: 'calc(100vh - 10rem)', overflow: 'hidden' }}>
                <DetailPanel appt={selectedAppt} onClose={() => setSelectedAppt(null)} />
              </Card>
            </div>
          )}
        </div>
      )}

      {/* ── Table view ────────────────────────────────────────────────── */}
      {view === 'table' && (
        <div className="flex items-start gap-4">
          <div className={cn('min-w-0 flex-1 space-y-4', selectedAppt && 'hidden md:block')}>
            {/* Filters */}
            <div className="flex flex-wrap items-center gap-2">
              <Select value={dateRange} onValueChange={v => setDateRange(v as DateRange)}>
                <SelectTrigger className="h-8 w-36">
                  <SelectValue>{DATE_RANGE_LABELS[dateRange]}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {(Object.entries(DATE_RANGE_LABELS) as [DateRange, string][]).map(([v, label]) => (
                    <SelectItem key={v} value={v}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={statusFilter} onValueChange={v => setStatusFilter(v ?? 'all')}>
                <SelectTrigger className="h-8 w-36">
                  <SelectValue>{statusLabel}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map(o => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={bookedViaFilter} onValueChange={v => setBookedViaFilter(v ?? 'all')}>
                <SelectTrigger className="h-8 w-32">
                  <SelectValue>{bookedViaLabel}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {BOOKED_VIA_OPTIONS.map(o => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <span className="ml-auto text-xs text-muted-foreground">
                {filtered.length} appointment{filtered.length !== 1 ? 's' : ''}
              </span>
            </div>

            {/* Table */}
            <Card className="py-0">
              {filtered.length === 0 ? (
                <div className="flex items-center justify-center py-16">
                  <p className="text-sm text-muted-foreground">No appointments match the selected filters.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="pl-4">Date</TableHead>
                        <TableHead>Contact</TableHead>
                        <TableHead>Phone</TableHead>
                        <TableHead>Service</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="pr-4 text-center">Via</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.map(appt => (
                        <TableRow
                          key={appt.id}
                          onClick={() => setSelectedAppt(appt)}
                          className={cn('cursor-pointer', selectedAppt?.id === appt.id && 'bg-muted')}
                        >
                          <TableCell className="pl-4 whitespace-nowrap text-muted-foreground">
                            {formatDateTime(appt.scheduled_at)}
                          </TableCell>
                          <TableCell className="font-medium">
                            {appt.contact_name ?? 'Unknown'}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {appt.contact_phone ?? '—'}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {formatServiceType(appt.service_type)}
                          </TableCell>
                          <TableCell>
                            <StatusBadge status={appt.status} />
                          </TableCell>
                          <TableCell className="pr-4 text-center">
                            <BookedViaIcon via={appt.bookedVia} />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </Card>
          </div>

          {/* Detail panel */}
          {selectedAppt && (
            <div className="w-full md:w-80 shrink-0">
              <button
                type="button"
                onClick={() => setSelectedAppt(null)}
                className="mb-3 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors md:hidden"
              >
                <ArrowLeft className="size-4" /> Back to appointments
              </button>
              <Card
                className="py-0 md:sticky md:top-6"
                style={{ maxHeight: 'calc(100vh - 10rem)', overflow: 'hidden' }}
              >
                <DetailPanel appt={selectedAppt} onClose={() => setSelectedAppt(null)} />
              </Card>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
