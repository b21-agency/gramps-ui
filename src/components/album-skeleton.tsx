import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

/**
 * Loading placeholder in the same full-width layout as the album pages:
 * toolbar line, hero (visual + title block), then a row of three equal-height cards.
 */
export function AlbumSkeleton({ media = false }: { media?: boolean }) {
  return (
    <div className="px-4 py-6 sm:px-6 lg:px-10 lg:py-8 2xl:px-14" aria-busy="true">
      <Skeleton className="mb-6 h-5 w-40" />
      <div className="flex flex-col gap-8 lg:flex-row lg:gap-12">
        <Skeleton
          className={cn(
            'h-[19rem] w-full shrink-0 rounded-3xl',
            media ? 'lg:h-[30rem] lg:w-[40rem] 2xl:h-[34rem] 2xl:w-[52rem]' : 'lg:h-[28.75rem] lg:w-[23rem] 2xl:h-[35rem] 2xl:w-[28rem]',
          )}
        />
        <div className="flex-1 space-y-4 lg:pt-4">
          <Skeleton className="h-16 w-3/4" />
          <Skeleton className="h-6 w-1/3" />
          <div className="flex gap-10 pt-4">
            <Skeleton className="h-12 w-36" />
            <Skeleton className="h-12 w-36" />
          </div>
          <Skeleton className="mt-6 h-3 w-full" />
          <div className="flex gap-2 pt-4">
            <Skeleton className="h-9 w-32 rounded-full" />
            <Skeleton className="h-9 w-24 rounded-full" />
            <Skeleton className="h-9 w-20 rounded-full" />
          </div>
        </div>
      </div>
      <div className="mt-10 grid gap-6 lg:grid-cols-[22rem_minmax(0,1fr)] 2xl:grid-cols-[24rem_minmax(0,1fr)_26rem]">
        <Skeleton className="h-96 rounded-3xl" />
        <Skeleton className="h-96 rounded-3xl" />
        <Skeleton className="hidden h-96 rounded-3xl 2xl:block" />
      </div>
    </div>
  )
}

/** Generic page placeholder: big title, intro line, full-width content block. */
export function PageSkeletonFull() {
  return (
    <div className="space-y-4 px-4 py-6 sm:px-6 lg:px-10 lg:py-8 2xl:px-14" aria-busy="true">
      <Skeleton className="h-12 w-72" />
      <Skeleton className="h-4 w-96 max-w-full" />
      <Skeleton className="mt-6 h-14 w-full rounded-2xl" />
      <Skeleton className="h-96 w-full rounded-3xl" />
    </div>
  )
}
