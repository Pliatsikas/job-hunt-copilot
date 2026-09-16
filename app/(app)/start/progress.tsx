export function Progress({ step, label }: { step: 1 | 2 | 3; label: string }) {
  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground" aria-label={label}>
      {[1, 2, 3].map((n) => (
        <span key={n} className={`h-1 w-8 rounded-full ${n <= step ? "bg-primary" : "bg-border"}`} aria-hidden />
      ))}
      <span>{label}</span>
    </div>
  );
}
