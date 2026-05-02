'use client'

import { useState } from 'react'
import { Building2, Palette, Bot, Bell, Plug } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import type { Client, ClientSettings, UserRole } from '@/types/database'

// ── Static config ──────────────────────────────────────────────────────────────

const US_TIMEZONES = [
  { value: 'America/New_York',    label: 'Eastern Time (ET)' },
  { value: 'America/Chicago',     label: 'Central Time (CT)' },
  { value: 'America/Denver',      label: 'Mountain Time (MT)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
  { value: 'America/Anchorage',   label: 'Alaska Time (AKT)' },
  { value: 'Pacific/Honolulu',    label: 'Hawaii Time (HT)' },
]

const BUSINESS_TYPES = [
  { value: 'med_spa',       label: 'Med Spa' },
  { value: 'home_services', label: 'Home Services' },
]

const CRM_PROVIDERS = [
  { value: 'none',         label: 'None' },
  { value: 'gohighlevel',  label: 'GoHighLevel' },
  { value: 'hubspot',      label: 'HubSpot' },
  { value: 'custom',       label: 'Custom' },
]

type SettingsTab = 'business' | 'branding' | 'ai' | 'notifications' | 'crm'

const ALL_TABS: { id: SettingsTab; label: string; icon: React.ElementType }[] = [
  { id: 'business',      label: 'Business Info',     icon: Building2 },
  { id: 'branding',      label: 'Branding',          icon: Palette   },
  { id: 'ai',            label: 'AI Configuration',  icon: Bot       },
  { id: 'notifications', label: 'Notifications',     icon: Bell      },
  { id: 'crm',           label: 'CRM Integration',   icon: Plug      },
]

const CLIENT_OWNER_TABS: SettingsTab[] = ['business', 'branding', 'notifications']

// ── Small reusable pieces ─────────────────────────────────────────────────────

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <p className="mb-1.5 text-sm font-medium">{children}</p>
}

function ReadOnlyField({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="rounded-md border border-border bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
        {value || '—'}
      </p>
    </div>
  )
}

function TextInput({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  type?: string
}) {
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-ring focus:ring-2 focus:ring-ring/20"
      />
    </div>
  )
}

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex items-center gap-3 text-left"
    >
      <span
        className={cn(
          'relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors',
          checked ? 'bg-primary' : 'bg-input'
        )}
      >
        <span
          className={cn(
            'pointer-events-none inline-block size-4 rounded-full bg-white shadow-sm transition-transform',
            checked ? 'translate-x-4' : 'translate-x-0'
          )}
        />
      </span>
      <span className="text-sm">{label}</span>
    </button>
  )
}

// ── Toast ─────────────────────────────────────────────────────────────────────

type ToastState = { message: string; type: 'success' | 'error' } | null

function Toast({ toast }: { toast: ToastState }) {
  if (!toast) return null
  return (
    <div
      className={cn(
        'fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-lg border px-4 py-3 text-sm shadow-lg',
        toast.type === 'success'
          ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
          : 'border-rose-200 bg-rose-50 text-rose-800'
      )}
    >
      {toast.type === 'success' ? '✓' : '✗'} {toast.message}
    </div>
  )
}

// ── Section wrapper ────────────────────────────────────────────────────────────

function Section({
  title,
  description,
  children,
  onSave,
  saving,
}: {
  title: string
  description?: string
  children: React.ReactNode
  onSave: () => void
  saving: boolean
}) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-semibold">{title}</h2>
        {description && (
          <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      <div className="space-y-4">{children}</div>
      <div className="flex justify-end border-t border-border pt-4">
        <Button type="button" onClick={onSave} disabled={saving} size="sm">
          {saving ? 'Saving…' : 'Save changes'}
        </Button>
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export interface SettingsPanelProps {
  clientId: string
  role: UserRole
  client: Client | null
  settings: ClientSettings | null
}

export function SettingsPanel({ clientId, role, client, settings }: SettingsPanelProps) {
  const isAgency = role === 'agency'
  const crmConfig = (settings?.crm_config ?? {}) as Record<string, unknown>

  const visibleTabs = ALL_TABS.filter(t =>
    isAgency ? true : CLIENT_OWNER_TABS.includes(t.id)
  )

  const [activeTab, setActiveTab] = useState<SettingsTab>(visibleTabs[0]?.id ?? 'business')
  const [toast, setToast] = useState<ToastState>(null)
  const [saving, setSaving] = useState(false)

  // Business Info
  const [bizName, setBizName]     = useState(client?.name ?? '')
  const [bizType, setBizType]     = useState(client?.business_type ?? '')
  const [timezone, setTimezone]   = useState(client?.timezone ?? '')

  // Branding
  const [displayName, setDisplayName] = useState(settings?.display_name ?? '')
  const [primaryColor, setPrimaryColor] = useState(settings?.primary_color ?? '#6366f1')
  const [avgTicket, setAvgTicket]     = useState(String(settings?.avg_ticket_value ?? ''))

  // AI Config
  const [retellAgentId, setRetellAgentId] = useState(String(crmConfig.retell_agent_id ?? ''))
  const [twilioPhone, setTwilioPhone]     = useState(String(crmConfig.twilio_phone_number ?? ''))
  const [agentName, setAgentName]         = useState(String(crmConfig.agent_name ?? ''))

  // Notifications
  const [alertEmail, setAlertEmail]         = useState(String(crmConfig.alert_email ?? ''))
  const [summaryEmail, setSummaryEmail]     = useState(String(crmConfig.summary_email ?? ''))
  const [receiveDailySummary, setReceiveDailySummary]         = useState(Boolean(crmConfig.daily_summary_enabled))
  const [receiveMissedCallAlerts, setReceiveMissedCallAlerts] = useState(Boolean(crmConfig.missed_call_alerts_enabled))

  // CRM
  const [crmProvider, setCrmProvider]     = useState(settings?.crm_provider ?? 'none')
  const [crmExternalId, setCrmExternalId] = useState(String(crmConfig.external_id ?? ''))
  const [webhookUrl, setWebhookUrl]       = useState(String(crmConfig.webhook_url ?? ''))

  // Tracks full crm_config in memory so saves across sections don't clobber each other.
  const [currentCrmConfig, setCurrentCrmConfig] = useState<Record<string, unknown>>(crmConfig)

  const phoneNumber = String(currentCrmConfig.phone_number ?? '')

  function showToast(message: string, type: 'success' | 'error') {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  // ── Save handlers ──────────────────────────────────────────────────────────

  async function saveBusinessInfo() {
    setSaving(true)
    const supabase = createClient()
    const { error } = await supabase
      .from('clients')
      .update({
        name: bizName,
        business_type: bizType || null,
        timezone: timezone || null,
      })
      .eq('id', clientId)
    setSaving(false)
    showToast(error ? error.message : 'Business info saved.', error ? 'error' : 'success')
  }

  async function saveBranding() {
    setSaving(true)
    const supabase = createClient()
    const payload: Record<string, unknown> = {
      client_id: clientId,
      display_name: displayName || null,
      primary_color: primaryColor || null,
    }
    if (isAgency) payload.avg_ticket_value = avgTicket ? Number(avgTicket) : null
    const { error } = await supabase.from('client_settings').upsert(payload)
    setSaving(false)
    showToast(error ? error.message : 'Branding saved.', error ? 'error' : 'success')
  }

  async function saveAIConfig() {
    setSaving(true)
    const supabase = createClient()
    const newCrmConfig: Record<string, unknown> = {
      ...currentCrmConfig,
      agent_name: agentName || null,
      ...(isAgency && {
        retell_agent_id: retellAgentId || null,
        twilio_phone_number: twilioPhone || null,
      }),
    }
    const { error } = await supabase
      .from('client_settings')
      .upsert({ client_id: clientId, crm_config: newCrmConfig })
    if (!error) setCurrentCrmConfig(newCrmConfig)
    setSaving(false)
    showToast(error ? error.message : 'AI configuration saved.', error ? 'error' : 'success')
  }

  async function saveNotifications() {
    setSaving(true)
    const supabase = createClient()
    const newCrmConfig: Record<string, unknown> = {
      ...currentCrmConfig,
      alert_email: alertEmail || null,
      summary_email: summaryEmail || null,
      daily_summary_enabled: receiveDailySummary,
      missed_call_alerts_enabled: receiveMissedCallAlerts,
    }
    const { error } = await supabase
      .from('client_settings')
      .upsert({ client_id: clientId, crm_config: newCrmConfig })
    if (!error) setCurrentCrmConfig(newCrmConfig)
    setSaving(false)
    showToast(error ? error.message : 'Notification settings saved.', error ? 'error' : 'success')
  }

  async function saveCRM() {
    setSaving(true)
    const supabase = createClient()
    const newCrmConfig: Record<string, unknown> = {
      ...currentCrmConfig,
      external_id: crmExternalId || null,
      ...(isAgency && { webhook_url: webhookUrl || null }),
    }
    const { error } = await supabase.from('client_settings').upsert({
      client_id: clientId,
      crm_provider: crmProvider === 'none' ? null : crmProvider,
      crm_config: newCrmConfig,
    })
    if (!error) setCurrentCrmConfig(newCrmConfig)
    setSaving(false)
    showToast(error ? error.message : 'CRM settings saved.', error ? 'error' : 'success')
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex gap-6">
      {/* Left tab sidebar */}
      <aside className="w-44 shrink-0">
        <nav className="space-y-0.5">
          {visibleTabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setActiveTab(id)}
              className={cn(
                'flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors',
                activeTab === id
                  ? 'bg-muted font-medium text-foreground'
                  : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
              )}
            >
              <Icon className="size-4 shrink-0" />
              {label}
            </button>
          ))}
        </nav>
      </aside>

      {/* Right panel */}
      <Card className="min-w-0 flex-1 py-0">
        <div className="p-6">

          {activeTab === 'business' && (
            <Section
              title="Business Info"
              description="Basic information about this business."
              onSave={saveBusinessInfo}
              saving={saving}
            >
              <TextInput
                label="Business name"
                value={bizName}
                onChange={setBizName}
                placeholder="Acme Med Spa"
              />

              {isAgency && (
                <div>
                  <FieldLabel>Business type</FieldLabel>
                  <Select value={bizType} onValueChange={v => setBizType(v ?? '')}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      {BUSINESS_TYPES.map(t => (
                        <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div>
                <FieldLabel>Timezone</FieldLabel>
                <Select value={timezone} onValueChange={v => setTimezone(v ?? '')}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select timezone" />
                  </SelectTrigger>
                  <SelectContent>
                    {US_TIMEZONES.map(tz => (
                      <SelectItem key={tz.value} value={tz.value}>{tz.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <ReadOnlyField label="Phone number" value={phoneNumber || null} />
            </Section>
          )}

          {activeTab === 'branding' && (
            <Section
              title="Branding"
              description="Customize how this client's portal looks."
              onSave={saveBranding}
              saving={saving}
            >
              <TextInput
                label="Display name"
                value={displayName}
                onChange={setDisplayName}
                placeholder="Acme"
              />

              <div>
                <FieldLabel>Primary color</FieldLabel>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={primaryColor}
                    onChange={e => {
                      setPrimaryColor(e.target.value)
                      document.documentElement.style.setProperty('--brand-color', e.target.value)
                    }}
                    className="h-9 w-16 cursor-pointer rounded-md border border-border bg-background p-1"
                  />
                  <span className="font-mono text-sm text-muted-foreground">{primaryColor}</span>
                  <span className="ml-auto flex items-center gap-1.5 rounded-md border border-border bg-muted/50 px-2.5 py-1 text-xs text-muted-foreground">
                    <span
                      className="inline-block size-3 rounded-sm"
                      style={{ backgroundColor: primaryColor }}
                    />
                    Sidebar preview
                  </span>
                </div>
              </div>

              {isAgency && (
                <TextInput
                  label="Avg ticket value ($)"
                  value={avgTicket}
                  onChange={setAvgTicket}
                  placeholder="150"
                  type="number"
                />
              )}
            </Section>
          )}

          {activeTab === 'ai' && (
            <Section
              title="AI Configuration"
              description="Configure the AI voice agent for this client."
              onSave={saveAIConfig}
              saving={saving}
            >
              {isAgency && (
                <>
                  <TextInput
                    label="Retell Agent ID"
                    value={retellAgentId}
                    onChange={setRetellAgentId}
                    placeholder="agent_xxxxxxxxxxxxxxxx"
                  />
                  <TextInput
                    label="Twilio Phone Number"
                    value={twilioPhone}
                    onChange={setTwilioPhone}
                    placeholder="+15550001234"
                  />
                </>
              )}
              <TextInput
                label="AI Agent Name"
                value={agentName}
                onChange={setAgentName}
                placeholder="Sarah"
              />
            </Section>
          )}

          {activeTab === 'notifications' && (
            <Section
              title="Notifications"
              description="Control how and where alerts are delivered."
              onSave={saveNotifications}
              saving={saving}
            >
              <TextInput
                label="Email for missed call alerts"
                value={alertEmail}
                onChange={setAlertEmail}
                type="email"
                placeholder="alerts@example.com"
              />
              <TextInput
                label="Email for daily summary"
                value={summaryEmail}
                onChange={setSummaryEmail}
                type="email"
                placeholder="summary@example.com"
              />
              <div className="space-y-3 pt-1">
                <Toggle
                  checked={receiveMissedCallAlerts}
                  onChange={setReceiveMissedCallAlerts}
                  label="Receive missed call alerts"
                />
                <Toggle
                  checked={receiveDailySummary}
                  onChange={setReceiveDailySummary}
                  label="Receive daily summary"
                />
              </div>
            </Section>
          )}

          {activeTab === 'crm' && (
            <Section
              title="CRM Integration"
              description="Connect this client to an external CRM."
              onSave={saveCRM}
              saving={saving}
            >
              <div>
                <FieldLabel>CRM Provider</FieldLabel>
                <Select value={crmProvider} onValueChange={v => setCrmProvider(v ?? 'none')}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select CRM" />
                  </SelectTrigger>
                  <SelectContent>
                    {CRM_PROVIDERS.map(p => (
                      <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <TextInput
                label="CRM External ID"
                value={crmExternalId}
                onChange={setCrmExternalId}
                placeholder="contact_xxxxxxxx"
              />

              {isAgency && (
                <TextInput
                  label="Webhook URL"
                  value={webhookUrl}
                  onChange={setWebhookUrl}
                  type="url"
                  placeholder="https://hooks.example.com/webhook"
                />
              )}
            </Section>
          )}

        </div>
      </Card>

      <Toast toast={toast} />
    </div>
  )
}
