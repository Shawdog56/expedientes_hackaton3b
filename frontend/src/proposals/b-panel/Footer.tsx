import logo from '../../assets/logo-3b.png';

export function Footer() {
  return (
    <footer className="mt-auto bg-ink">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-[22px] sm:px-6">
        <div className="flex items-center gap-2.5">
          <img src={logo} alt="" aria-hidden="true" className="h-7 w-7 shrink-0" />
          <span className="text-[13px] font-semibold text-white">Tiendas 3B · Expansión</span>
        </div>
        <p className="text-[13px] text-[#BDBDBD]">
          Recomendación inicial generada por agentes. La decisión final es del equipo legal.
        </p>
        <p className="text-[13px] text-[#BDBDBD]">Prototipo · Hackatón Reto 1</p>
      </div>
    </footer>
  );
}
