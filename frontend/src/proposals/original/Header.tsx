export function Header() {
  return (
    <header className="border-b border-border bg-surface">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <div className="flex items-center gap-3">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-brand text-sm font-bold text-white"
            aria-hidden="true"
          >
            3B
          </div>
          <h1 className="text-lg font-semibold text-ink sm:text-xl">Revisión de Expedientes</h1>
        </div>
        <p className="hidden shrink-0 text-sm text-muted sm:block">Análisis multiagente</p>
      </div>
    </header>
  );
}
