export function CorporativaHeader() {
  return (
    <header className="bg-brand">
      <div className="mx-auto flex max-w-3xl flex-col items-center gap-2 px-4 py-8 text-center sm:px-6">
        <div
          className="flex h-14 w-14 items-center justify-center rounded-md bg-white text-lg font-bold text-brand shadow-sm"
          aria-hidden="true"
        >
          3B
        </div>
        <h1 className="text-2xl font-semibold text-white sm:text-3xl">Revisión de Expedientes</h1>
        <p className="text-sm text-white/80">Análisis documental para el equipo legal</p>
      </div>
      <div className="h-1.5 bg-accent" aria-hidden="true" />
    </header>
  );
}
