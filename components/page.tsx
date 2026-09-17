import type { ReactNode } from "react";

/**
 * The content column: consistent gutters, a sane max width, room to breathe.
 * Content rises in over 200 ms when it arrives — the skeleton before it fades
 * the same way, so the hand-off reads as one motion rather than a swap.
 */
export function Page({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  return (
    <div className={`mx-auto w-full px-4 py-6 sm:px-6 lg:px-8 lg:py-8 animate-in fade-in slide-in-from-bottom-1 duration-200 ${wide ? "max-w-7xl" : "max-w-5xl"}`}>
      {children}
    </div>
  );
}
