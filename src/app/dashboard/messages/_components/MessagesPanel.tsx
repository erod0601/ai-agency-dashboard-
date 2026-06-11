'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { ArrowLeft } from 'lucide-react'
import type { MessageThread, Message } from '@/types/database'

// ── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diffMs / 60_000)
  if (m < 1)    return 'just now'
  if (m < 60)   return `${m}m ago`
  if (m < 1440) return `${Math.floor(m / 60)}h ago`
  return `${Math.floor(m / 1440)}d ago`
}

function truncate(str: string, len: number): string {
  return str.length <= len ? str : str.slice(0, len) + '…'
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

// ── Component ─────────────────────────────────────────────────────────────────

interface MessagesPanelProps {
  threads: MessageThread[]
  clientId: string
}

export function MessagesPanel({ threads }: MessagesPanelProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const supabase = useMemo(() => createClient(), [])

  const selectedThread = threads.find(t => t.conversation_id === selectedId) ?? null

  async function handleSelectThread(conversationId: string) {
    if (conversationId === selectedId) return
    setSelectedId(conversationId)
    setMessages([])
    setLoading(true)
    const { data, error } = await supabase
      .from('messages')
      .select('id, conversation_id, body, direction, created_at')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
    if (!error && data) setMessages(data as Message[])
    setLoading(false)
  }

  // Auto-scroll to latest message whenever messages update
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  return (
    <div
      className="overflow-hidden rounded-xl border border-border bg-card"
      style={{ height: 'calc(100vh - 8rem)' }}
    >
      <div className="flex h-full">

        {/* ── Thread list ─────────────────────────────────────────────── */}
        <div
          className={cn(
            'flex w-full flex-col border-r border-border md:w-72 md:flex shrink-0',
            // On mobile: hide thread list once a conversation is open
            selectedId ? 'hidden md:flex' : 'flex'
          )}
        >
          <div className="shrink-0 border-b border-border px-4 py-3">
            <h2 className="text-sm font-semibold">Messages</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {threads.length} conversation{threads.length !== 1 ? 's' : ''}
            </p>
          </div>

          <div className="flex-1 overflow-y-auto">
            {threads.length === 0 ? (
              <p className="px-4 py-10 text-center text-sm text-muted-foreground">
                No conversations yet.
              </p>
            ) : (
              threads.map(thread => (
                <button
                  key={thread.conversation_id}
                  type="button"
                  onClick={() => handleSelectThread(thread.conversation_id)}
                  className={cn(
                    'w-full border-b border-border px-4 py-3 text-left transition-colors hover:bg-muted',
                    selectedId === thread.conversation_id && 'bg-muted'
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {thread.contact_name ?? thread.contact_phone ?? 'Unknown'}
                      </p>
                      {thread.contact_name && thread.contact_phone && (
                        <p className="truncate text-xs text-muted-foreground">
                          {thread.contact_phone}
                        </p>
                      )}
                      {thread.last_message_body && (
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">
                          {truncate(thread.last_message_body, 60)}
                        </p>
                      )}
                    </div>
                    <span className="mt-0.5 shrink-0 whitespace-nowrap text-xs text-muted-foreground">
                      {relativeTime(thread.last_message_at)}
                    </span>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* ── Conversation panel ──────────────────────────────────────── */}
        <div
          className={cn(
            'flex min-w-0 flex-1 flex-col',
            // On mobile: hide messages until a thread is selected
            selectedId ? 'flex' : 'hidden md:flex'
          )}
        >
          {!selectedId ? (
            // Empty state — desktop only since mobile hides this panel
            <div className="flex flex-1 items-center justify-center">
              <p className="text-sm text-muted-foreground">Select a conversation</p>
            </div>
          ) : (
            <>
              {/* Header */}
              <div className="flex shrink-0 items-center gap-2 border-b border-border px-4 py-3">
                {/* Back button — mobile only */}
                <button
                  type="button"
                  onClick={() => setSelectedId(null)}
                  className="mr-1 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors md:hidden"
                  aria-label="Back to threads"
                >
                  <ArrowLeft className="size-4" />
                </button>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {selectedThread?.contact_name ?? selectedThread?.contact_phone ?? 'Unknown'}
                  </p>
                  {selectedThread?.contact_name && selectedThread?.contact_phone && (
                    <p className="truncate text-xs text-muted-foreground">
                      {selectedThread.contact_phone}
                    </p>
                  )}
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
                {loading ? (
                  <p className="py-10 text-center text-sm text-muted-foreground">Loading…</p>
                ) : messages.length === 0 ? (
                  <p className="py-10 text-center text-sm text-muted-foreground">No messages.</p>
                ) : (
                  messages.map(msg => (
                    <div
                      key={msg.id}
                      className={cn(
                        'flex',
                        msg.direction === 'outbound' ? 'justify-end' : 'justify-start'
                      )}
                    >
                      <div
                        className={cn(
                          'max-w-[75%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed',
                          msg.direction === 'inbound' && 'bg-muted text-foreground'
                        )}
                        style={
                          msg.direction === 'outbound'
                            ? { backgroundColor: 'var(--brand-color)', color: '#fff' }
                            : undefined
                        }
                      >
                        <p>{msg.body}</p>
                        <p
                          className={cn(
                            'mt-0.5 text-[10px]',
                            msg.direction === 'inbound'
                              ? 'text-muted-foreground'
                              : 'text-white/70'
                          )}
                        >
                          {formatTime(msg.created_at)}
                        </p>
                      </div>
                    </div>
                  ))
                )}
                {/* Scroll anchor */}
                <div ref={bottomRef} />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
