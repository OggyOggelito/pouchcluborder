import SkeletonList from "@/components/ui/Skeleton";

/**
 * The app-wide loading state.
 *
 * Before this there was no `loading.tsx` anywhere, so every slow page was a
 * blank white screen — which on a stockroom connection is indistinguishable
 * from a broken one. A route with a distinctive shape can still add its own.
 */
export default function Loading() {
  return (
    <main className="mx-auto max-w-2xl px-4 pb-16 pt-6">
      <div aria-hidden className="mb-5">
        <div className="h-8 w-40 animate-pulse rounded-lg bg-raised" />
        <div className="mt-2 h-4 w-56 animate-pulse rounded-lg bg-raised" />
      </div>
      <SkeletonList rows={4} />
    </main>
  );
}
