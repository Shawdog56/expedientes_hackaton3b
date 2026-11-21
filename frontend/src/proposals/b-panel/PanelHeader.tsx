import logo from '../../assets/logo.jpg';

export function PanelHeader() {
  return (
    <header className="border-b-2 border-brand bg-surface">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-4 sm:px-6">
        <img src={logo} alt="Tiendas 3B" className="h-10 w-10 shrink-0" />
        <div>
          <h1 className="text-lg font-semibold leading-tight text-ink">Revisión de Expedientes</h1>
          <p className="text-xs text-muted">Panel de trabajo · equipo legal</p>
        </div>
      </div>
    </header>
  );
}
