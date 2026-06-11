import { redirect } from 'next/navigation'

// The overview moved to /dashboard/analytics; this route just forwards there.
export default function DashboardPage() {
  redirect('/dashboard/analytics')
}
