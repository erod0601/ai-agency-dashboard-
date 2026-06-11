'use client'

import { useEffect, useMemo, useState } from 'react'
import { PhoneMissed, PhoneOutgoing, MessageSquare, Moon, X, ArrowLeft, Clock, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { sendSms, startCall } from '@/lib/integrations'
import type { RecentCall } from '@/types/database'

function formatDateTime(iso: string): string {
  const d = new Date(iso)
  return (
    d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) +
    ', ' +
    d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  )
}

function isToday(iso: string): boolean {
  const d = new Date(iso)
  const now = new Date()
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate()
}

function withinDays(iso: string, days: number): boolean {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - days)
  return new Date(iso) >= cutoff
}

const OUTCOME_STYLES: Record<string, { label: string; className: string }> = {
  hung_up:   { label: 'Hung Up',   className: 'bg-rose-50 text-rose-700 border-rose-200' },
  no_answer: { label: 'No Answer', className: 'bg-amber-50 text-amber-700 border-amber-200' },
}

function OutcomeBadge({ outcome }: { outcome: string | null }) {
  if (!outcome) return <span className="text-xs text-muted-foreground">—</span>
  const s = OUTCOME_STYLES[outcome]
  return (
    <Badge variant="outline" className={cn('font-normal', s?.className)}>
      {s?.label ?? outcome.replace(/_/g, ' ')}
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

function Toast({ message }: { message: string }) {
  return (
    <div className="fixed bottom-6 right-6 z-50 rounded-lg border border-border bg-foreground px-4 py-2.5 text-sm text-background shadow-lg">
      {message}
    </div>
  )
}

interface MissedPanelProps {
  calls: RecentCall[]
  clientId: string
}

export function MissedPanel({ calls, clientId }: MissedPanelProps) {
  const [selected, setSelected] = useState<RecentCall | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 2500)
    return () => clearTimeout(t)
  }, [toast])

  const metrics = useMemo(() => ({
    today: calls.filter(c => isToday(c.started_at)).length,
    week: calls.filter(c => withinDays(c.started_at, 7)).length,
    afterHours: calls.filter(c => c.after_hours).length,
    total: calls.length,
  }), [calls])

  async function handleSendText() {
    if (!selected) return
    const res = await sendSms({ clientId, toPhone: selected.contact_phone ?? '', body: '' })
    setToast(res.ok ? 'Text sent' : res.message)
  }

  async function handleStartCall() {
    if (!selected) return
    const res = await startCall({ clientId, toPhone: selected.contact_phone ?? '' })
    setToast(res.ok ? 'Call started' : res.message)
  }

  return (
    <div className="space-y-4">
      {toast && <Toast message={toast} />}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard icon={PhoneMissed} label="Missed Today" value={metrics.today}      hint="since midnight" />
        <MetricCard icon={Clock}       label="This Week"    value={metrics.week}       hint="last 7 days" />
        <MetricCard icon={Moon}        label="After Hours"  value={metrics.afterHours} hint="outside business hours" />
        <MetricCard icon={PhoneMissed} label="All Missed"   value={metrics.total}      hint="hung up or no answer" />
      </div>

      <div className="flex items-start gap-4">
        <div className={cn('min-w-0 flex-1', selected && 'hidden md:block')}>
          <Card className="py-0">
            {calls.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-1 py-16">
                <p className="text-sm font-medium">No missed calls</p>
                <p className="text-xs text-muted-foreground">Your AI is catching everything.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="pl-4">Time</TableHead>
                      <TableHead>Caller</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Outcome</TableHead>
                      <TableHead className="pr-4 text-center">
                        <Moon className="inline size-3.5 text-muted-foreground" />
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {calls.map(call => (
                      <TableRow
                        key={call.id}
                        onClick={() => setSelected(call)}
                        className={cn('cursor-pointer', selected?.id === call.id && 'bg-muted')}
                      >
                        <TableCell className="whitespace-nowrap pl-4 text-muted-foreground">
                          {formatDateTime(call.started_at)}
                        </TableCell>
                        <TableCell className="font-medium">{call.contact_name ?? 'Unknown'}</TableCell>
                        <TableCell className="text-muted-foreground">{call.contact_phone ?? '—'}</TableCell>
                        <TableCell><OutcomeBadge outcome={call.outcome} /></TableCell>
                        <TableCell className="pr-4 text-center">
                          {call.after_hours && <Moon className="inline size-3.5 text-indigo-400" />}
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
              Back to missed calls
            </button>

            <Card className="py-0 md:sticky md:top-6" style={{ maxHeight: 'calc(100vh - 10rem)', overflow: 'hidden' }}>
              <div className="flex h-full flex-col overflow-hidden">
                <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
                  <h3 className="text-sm font-semibold">Missed Call</h3>
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

                  <div>
                    <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Time</p>
                    <p className="text-sm">{formatDateTime(selected.started_at)}</p>
                  </div>

                  <div>
                    <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Outcome</p>
                    <OutcomeBadge outcome={selected.outcome} />
                  </div>

                  {selected.summary && (
                    <div className="rounded-lg border border-violet-200 bg-violet-50 px-3.5 py-3 dark:border-violet-900 dark:bg-violet-950/40">
                      <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-violet-700 dark:text-violet-300">
                        <Sparkles className="size-3.5" />
                        AI Summary
                      </p>
                      <p className="text-sm leading-relaxed text-violet-900 dark:text-violet-200">{selected.summary}</p>
                    </div>
                  )}

                  <div className="space-y-2 border-t border-border pt-4">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Win them back</p>
                    <button
                      type="button"
                      onClick={handleSendText}
                      className="flex w-full items-center justify-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm font-medium transition-colors hover:bg-muted"
                    >
                      <MessageSquare className="size-4" />
                      Send Text
                    </button>
                    <button
                      type="button"
                      onClick={handleStartCall}
                      className="flex w-full items-center justify-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm font-medium transition-colors hover:bg-muted"
                    >
                      <PhoneOutgoing className="size-4" />
                      Call Back
                    </button>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  )
}
