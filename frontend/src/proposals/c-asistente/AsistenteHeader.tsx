export function AsistenteHeader() {
  return (
    <header className="border-b border-border bg-surface">
      <div className="mx-auto flex max-w-2xl items-center justify-center gap-3 px-4 py-5 sm:px-6">
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-brand text-sm font-bold text-white"
          aria-hidden="true"
        >
          3B
        </div>
        <h1 className="text-lg font-semibold text-ink sm:text-xl">Revisión de Expedientes</h1>
      </div>
    </header>
  );
}
