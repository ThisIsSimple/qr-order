import { cn } from "@qr/ui/lib/utils"

/**
 * Brand mark + wordmark. Presentational (no router deps) so it works in any
 * app or server component. Wrap in a <Link> at call sites for navigation.
 * NOTE: "웨잇큐" is a placeholder brand name — change here to rebrand everywhere.
 */
export function Logo({
  className,
  showText = true,
  size = "md",
}: {
  className?: string
  showText?: boolean
  size?: "sm" | "md" | "lg"
}) {
  const mark =
    size === "lg" ? "size-9 text-base" : size === "sm" ? "size-6 text-xs" : "size-7 text-sm"
  const text =
    size === "lg" ? "text-xl" : size === "sm" ? "text-sm" : "text-base"

  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <span
        className={cn(
          "grid place-items-center rounded-lg bg-primary font-extrabold text-primary-foreground",
          mark,
        )}
        aria-hidden
      >
        Q
      </span>
      {showText && (
        <span className={cn("font-bold tracking-tight text-foreground", text)}>
          웨잇큐
        </span>
      )}
    </span>
  )
}
