import type { ReactNode } from "react";

/** The content column: consistent gutters, a sane max width, room to breathe. */
export function Page({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  return (
    <div className={`mx-auto w-full px-4 py-6 sm:px-6 lg:px-8 lg:py-8 ${wide ? "max-w-7xl" : "max-w-5xl"}`}>
      {children}
    </div>
  );
}
