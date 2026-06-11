'use client'

import { useEffect, useMemo, useState } from 'react'
import { Phone, MessageSquare, Moon, Sparkles, PhoneOutgoing, ArrowLeft } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { sendSms, startCall } from '@/lib/integrations'
import type { RecentCall, MessageThread } from '@/types/database'

function formatDateTime(iso: string): string {
  const d = new Date(iso)
  return (
    d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) +
    ', ' +
    d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  )
}

function formatRelative(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diffMs / 60_000)
  if (mins < 1) return 'now'
  if (mins < 60) return `${mins}m`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d`
  return formatDateTime(iso).split(',')[0]
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return '—'
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

function titleCase(s: string | null): string {
  if (!s) return '—'
  return s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

function initials(name: string | null): string {
  if (!name) return '?'
  return name.split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('')
}

const OUTCOME_STYLES: Record<string, { label: string; className: string }> = {
  booked:           { label: 'Booked',    className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  voicemail:        { label: 'Voicemail', className: 'bg-sky-50 text-sky-700 border-sky-200' },
  hung_up:          { label: 'Hung Up',   className: 'bg-rose-50 text-rose-700 border-rose-200' },
  no_answer:        { label: 'No Answer', className: 'bg-amber-50 text-amber-700 border-amber-200' },
  follow_up_needed: { label: 'Follow Up', className: 'bg-amber-50 text-amber-700 border-amber-200' },
  info_only:        { label: 'Info Only', className: 'bg-slate-100 text-slate-600 border-slate-200' },
}

type InboxItem =
  | { kind: 'call'; id: string; at: string; call: RecentCall }
  | { kind: 'sms'; id: string; at: string; thread: MessageThread }

type Filter = 'all' | 'calls' | 'texts'

interface InboxPanelProps {
  calls: RecentCall[]
  threads: MessageThread[]
  clientId: string
}

export function InboxPanel({ calls, threads, clientId }: InboxPanelProps) {
  const [filter, setFilter] = useState<Filter>('all')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 2500)
    return () => clearTimeout(t)
  }, [toast])

  const items = useMemo<InboxItem[]>(() => {
    const callItems: InboxItem[] = calls.map(c => ({ kind: 'call', id: `call-${c.id}`, at: c.started_at, call: c }))
    const smsItems: InboxItem[] = threads.map(t => ({ kind: 'sms', id: `sms-${t.conversation_id}`, at: t.last_message_at, thread: t }))
    return [...callItems, ...smsItems].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
  }, [calls, threads])

  const filtered = useMemo(() => {
    if (filter === 'calls') return items.filter(i => i.kind === 'call')
    if (filter === 'texts') return items.filter(i => i.kind === 'sms')
    return items
  }, [items, filter])

  const selected = useMemo(
    () => filtered.find(i => i.id === selectedId) ?? filtered[0] ?? null,
    [filtered, selectedId]
  )

  async function handleSendText(phone: string | null) {
    const res = await sendSms({ clientId, toPhone: phone ?? '', body: '' })
    setToast(res.ok ? 'Text sent' : res.message)
  }

  async function handleStartCall(phone: string | null) {
    const res = await startCall({ clientId, toPhone: phone ?? '' })
    setToast(res.ok ? 'Call started' : res.message)
  }

  const FILTERS: { id: Filter; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'calls', label: 'Calls' },
    { id: 'texts', label: 'Texts' },
  ]

  return (
    <div className="space-y-4">
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 rounded-lg border border-border bg-foreground px-4 py-2.5 text-sm text-background shadow-lg">
          {toast}
        </div>
      )}

      <div className="grid items-start gap-4 lg:grid-cols-[340px_minmax(0,1fr)]">
        {/* Left: unified feed */}
        <Card className={cn('gap-0 overflow-hidden py-0', selected && 'hidden lg:block')}>
          <div className="flex items-center justify-between border-b border-border px-3 py-2.5">
            <h3 className="text-sm font-semibold">
              Inbox <span className="font-normal text-muted-foreground">{filtered.length}</span>
            </h3>
            <div className="flex gap-1">
              {FILTERS.map(f => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFilter(f.id)}
                  className={cn(
                    'rounded-md px-2.5 py-1 text-xs transition-colors',
                    filter === f.id
                      ? 'bg-muted font-medium text-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <div className="max-h-[calc(100vh-16rem)] overflow-y-auto">
            {filtered.length === 0 ? (
              filter === 'texts' ? (
                <div className="flex flex-col items-center gap-1 px-4 py-12 text-center">
                  <MessageSquare className="size-5 text-muted-foreground" />
                  <p className="text-sm font-medium">No text conversations yet</p>
                  <p className="text-xs text-muted-foreground">
                    Two-way SMS lands here once messaging is connected.
                  </p>
                </div>
              ) : (
                <p className="px-3 py-10 text-center text-sm text-muted-foreground">Nothing here yet.</p>
              )
            ) : (
              filtered.map(item => {
                const isSel = selected?.id === item.id
                const name = item.kind === 'call' ? item.call.contact_name : item.thread.contact_name
                const snippet = item.kind === 'call'
                  ? (item.call.summary ?? titleCase(item.call.outcome))
                  : (item.thread.last_message_body ?? 'Text conversation')
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSelectedId(item.id)}
                    className={cn(
                      'block w-full border-b border-border px-3 py-2.5 text-left transition-colors last:border-b-0 hover:bg-muted/60',
                      isSel && 'bg-muted'
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <div className={cn(
                        'flex size-7 shrink-0 items-center justify-center rounded-full',
                        item.kind === 'call' ? 'bg-violet-100 text-violet-700' : 'bg-sky-100 text-sky-700'
                      )}>
                        {item.kind === 'call' ? <Phone className="size-3.5" /> : <MessageSquare className="size-3.5" />}
                      </div>
                      <p className="min-w-0 flex-1 truncate text-sm font-medium">{name ?? 'Unknown'}</p>
                      <span className="shrink-0 text-xs text-muted-foreground">{formatRelative(item.at)}</span>
                    </div>
                    <p className="mt-1 line-clamp-2 pl-9 text-xs leading-relaxed text-muted-foreground">{snippet}</p>
                  </button>
                )
              })
            )}
          </div>
        </Card>

        {/* Right: detail */}
        <Card className="gap-0 overflow-hidden py-0">
          {!selected ? (
            <div className="flex items-center justify-center py-24">
              <p className="text-sm text-muted-foreground">Select a conversation.</p>
            </div>
          ) : selected.kind === 'call' ? (
            <CallDetail
              call={selected.call}
              onBack={() => setSelectedId(null)}
              onText={() => handleSendText(selected.call.contact_phone)}
              onCall={() => handleStartCall(selected.call.contact_phone)}
            />
          ) : (
            <ThreadDetail
              thread={selected.thread}
              onBack={() => setSelectedId(null)}
              onText={() => handleSendText(selected.thread.contact_phone)}
            />
          )}
        </Card>
      </div>
    </div>
  )
}

function DetailHeader({ name, sub, color, onBack }: { name: string; sub: string; color: 'violet' | 'sky'; onBack: () => void }) {
  return (
    <div className="flex items-center gap-3 border-b border-border px-4 py-3">
      <button
        type="button"
        onClick={onBack}
        className="text-muted-foreground transition-colors hover:text-foreground lg:hidden"
        aria-label="Back to inbox"
      >
        <ArrowLeft className="size-4" />
      </button>
      <div className={cn(
        'flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
        color === 'violet' ? 'bg-violet-100 text-violet-700' : 'bg-sky-100 text-sky-700'
      )}>
        {initials(name)}
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold">{name}</p>
        <p className="text-xs text-muted-foreground">{sub}</p>
      </div>
    </div>
  )
}

function ActionRow({ onText, onCall }: { onText: () => void; onCall?: () => void }) {
  return (
    <div className="flex gap-2 border-t border-border px-4 py-3">
      <button
        type="button"
        onClick={onText}
        className="flex flex-1 items-center justify-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm font-medium transition-colors hover:bg-muted"
      >
        <MessageSquare className="size-4" />
        Send Text
      </button>
      {onCall && (
        <button
          type="button"
          onClick={onCall}
          className="flex flex-1 items-center justify-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm font-medium transition-colors hover:bg-muted"
        >
          <PhoneOutgoing className="size-4" />
          Start Call
        </button>
      )}
    </div>
  )
}

function CallDetail({ call, onBack, onText, onCall }: {
  call: RecentCall
  onBack: () => void
  onText: () => void
  onCall: () => void
}) {
  const oc = call.outcome ? OUTCOME_STYLES[call.outcome] : undefined
  return (
    <div className="flex flex-col">
      <DetailHeader
        name={call.contact_name ?? 'Unknown'}
        sub={`${call.contact_phone ?? 'No phone'} · ${formatDateTime(call.started_at)}`}
        color="violet"
        onBack={onBack}
      />

      <div className="space-y-4 px-4 py-4">
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span className="tabular-nums">{formatDuration(call.duration_seconds)}</span>
          {call.outcome && (
            <Badge variant="outline" className={cn('font-normal', oc?.className)}>
              {oc?.label ?? titleCase(call.outcome)}
            </Badge>
          )}
          {call.intent && <span>{titleCase(call.intent)}</span>}
          {call.sentiment && <span className="capitalize">{call.sentiment} sentiment</span>}
          {call.after_hours && <Moon className="size-3 text-indigo-400" />}
        </div>

        <div className="rounded-lg border border-violet-200 bg-violet-50 px-3.5 py-3 dark:border-violet-900 dark:bg-violet-950/40">
          <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-violet-700 dark:text-violet-300">
            <Sparkles className="size-3.5" />
            AI Summary
          </p>
          <p className="text-sm leading-relaxed text-violet-900 dark:text-violet-200">
            {call.summary ?? 'No summary available for this call.'}
          </p>
        </div>

        {call.recording_url && (
          <a
            href={call.recording_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block text-sm text-primary hover:underline"
          >
            Listen to recording →
          </a>
        )}
      </div>

      <ActionRow onText={onText} onCall={onCall} />
    </div>
  )
}

function ThreadDetail({ thread, onBack, onText }: {
  thread: MessageThread
  onBack: () => void
  onText: () => void
}) {
  return (
    <div className="flex flex-col">
      <DetailHeader
        name={thread.contact_name ?? 'Unknown'}
        sub={`${thread.contact_phone ?? 'No phone'} · ${formatDateTime(thread.last_message_at)}`}
        color="sky"
        onBack={onBack}
      />

      <div className="space-y-4 px-4 py-4">
        {thread.last_message_body && (
          <div className="rounded-lg bg-muted px-3.5 py-3">
            <p className="mb-1 text-xs font-medium text-muted-foreground">Latest message</p>
            <p className="text-sm leading-relaxed">{thread.last_message_body}</p>
          </div>
        )}
        <p className="text-xs text-muted-foreground">
          Full two-way texting opens here once SMS integration is connected.
        </p>
      </div>

      <ActionRow onText={onText} />
    </div>
  )
}
