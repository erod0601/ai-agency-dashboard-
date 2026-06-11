import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent } from '@/components/ui/card'

export default function DashboardLoading() {
  return (
    <div className="space-y-6">
      {/* Metric tiles */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardContent>
              <div className="flex items-center justify-between mb-3">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="size-4 rounded" />
              </div>
              <Skeleton className="h-7 w-20" />
              <Skeleton className="mt-2 h-3 w-32" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardContent>
            <Skeleton className="h-4 w-56 mb-4" />
            <Skeleton className="h-52 w-full rounded-lg" />
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <Skeleton className="h-4 w-48 mb-4" />
            <Skeleton className="mx-auto h-44 w-44 rounded-full" />
            <div className="mt-4 space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-3 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card className="py-0">
        <div className="px-4 py-3 border-b border-border">
          <Skeleton className="h-4 w-28" />
        </div>
        <div className="px-4 py-3 space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full rounded-lg" />
          ))}
        </div>
      </Card>
    </div>
  )
}
