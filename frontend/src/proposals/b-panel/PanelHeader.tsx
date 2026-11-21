import logo from '../../assets/logo-3b.png';

export function PanelHeader() {
  return (
    <header className="border-b-[3px] border-brand bg-ink">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-4 sm:px-6">
        <img src={logo} alt="Tiendas 3B" className="h-10 w-10 shrink-0" />
        <div>
          <h1 className="text-[20px] font-semibold leading-tight text-white">Revisión de Expedientes</h1>
          <p className="text-[13px] text-[#BDBDBD]">Análisis multiagente de documentación legal</p>
        </div>
      </div>
    </header>
  );
}
