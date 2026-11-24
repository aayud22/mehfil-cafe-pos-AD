import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';

export default function HistoryLoading() {
  return (
    <div className="space-y-6">
      {/* Header Skeleton */}
      <div className="border-b border-border pb-4 space-y-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-72" />
      </div>

      {/* Summary Strip Skeleton */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card className="p-4 border-border">
          <Skeleton className="h-4 w-28 mb-2" />
          <Skeleton className="h-8 w-20" />
        </Card>
        <Card className="p-4 border-border">
          <Skeleton className="h-4 w-32 mb-2" />
          <Skeleton className="h-8 w-36" />
        </Card>
      </div>

      {/* Filter Card Skeleton */}
      <Card className="p-4 border-border">
        <div className="space-y-3">
          <Skeleton className="h-8 w-full max-w-sm" />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Skeleton className="h-11 w-full" />
            <Skeleton className="h-11 w-full" />
            <Skeleton className="h-11 w-full" />
          </div>
        </div>
      </Card>

      {/* Table Skeletons */}
      <Card className="p-4 border-border">
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-lg" />
          ))}
        </div>
      </Card>
    </div>
  );
}
