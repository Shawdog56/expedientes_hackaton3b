import { motion, useReducedMotion } from 'motion/react';
import logo from '../../assets/logo.jpg';

export function PanelMarca() {
  const prefiereReducido = useReducedMotion();

  return (
    <motion.div
      initial={prefiereReducido ? undefined : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      style={{ background: 'linear-gradient(135deg, var(--color-brand), var(--color-brand-dark))' }}
      className="relative hidden h-full flex-col justify-between overflow-hidden px-10 py-8 text-white md:flex md:w-1/2"
    >
      <div
        className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-white/[0.06]"
        aria-hidden="true"
      />

      <div className="relative z-10 flex items-center gap-3">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white p-1.5">
          <img src={logo} alt="" aria-hidden="true" className="h-full w-full object-contain" />
        </span>
        <span className="text-base font-semibold">Revisión de Expedientes</span>
      </div>

      <div className="relative z-10 flex flex-col items-center text-center">
        <div className="flex h-[280px] w-[280px] items-center justify-center rounded-full bg-white p-10 shadow-lg">
          <img src={logo} alt="Tiendas 3B" className="h-full w-full object-contain" />
        </div>
        <h1 className="mt-8 text-[34px] font-bold leading-tight">Expedientes revisados, con evidencia.</h1>
        <p className="mt-3 max-w-md text-white/85">
          Revisión inicial de la documentación legal de inmuebles para el equipo de expansión de Tiendas 3B.
        </p>
      </div>

      <p className="relative z-10 text-sm text-white/70">Prototipo · Hackatón Reto 1 · Expedientes</p>
    </motion.div>
  );
}
