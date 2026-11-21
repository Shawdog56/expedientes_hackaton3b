import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useRef } from 'react';
import { useAnimaciones } from '../../../shared/motion';

interface Props {
  abierto: boolean;
  mensaje: string;
  textoCancelar: string;
  textoConfirmar: string;
  onCancelar: () => void;
  onConfirmar: () => void;
}

/** Diálogo de confirmación reutilizable: fade del fondo + escala de la caja, atrapa el foco y se cierra con Esc. */
export function ConfirmDialog({ abierto, mensaje, textoCancelar, textoConfirmar, onCancelar, onConfirmar }: Props) {
  const { reducido, transicionRapida } = useAnimaciones();
  const cajaRef = useRef<HTMLDivElement>(null);
  const cancelarRef = useRef<HTMLButtonElement>(null);
  const elementoPrevioRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (abierto) {
      elementoPrevioRef.current = document.activeElement as HTMLElement | null;
      cancelarRef.current?.focus();
    } else {
      elementoPrevioRef.current?.focus();
    }
  }, [abierto]);

  useEffect(() => {
    if (!abierto) return;

    const manejarTeclado = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape') {
        evento.preventDefault();
        onCancelar();
        return;
      }
      if (evento.key !== 'Tab' || !cajaRef.current) return;

      const focosables = cajaRef.current.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (focosables.length === 0) return;
      const primero = focosables[0];
      const ultimo = focosables[focosables.length - 1];

      if (evento.shiftKey && document.activeElement === primero) {
        evento.preventDefault();
        ultimo.focus();
      } else if (!evento.shiftKey && document.activeElement === ultimo) {
        evento.preventDefault();
        primero.focus();
      }
    };

    document.addEventListener('keydown', manejarTeclado);
    return () => document.removeEventListener('keydown', manejarTeclado);
  }, [abierto, onCancelar]);

  return (
    <AnimatePresence>
      {abierto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            className="absolute inset-0 bg-ink/40"
            onClick={onCancelar}
            aria-hidden="true"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={transicionRapida}
          />
          <motion.div
            ref={cajaRef}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="confirmar-dialogo-titulo"
            initial={reducido ? { opacity: 0 } : { opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={reducido ? { opacity: 0 } : { opacity: 0, scale: 0.96 }}
            transition={transicionRapida}
            className="relative w-full max-w-sm rounded-xl bg-surface p-5 shadow-xl"
          >
            <p id="confirmar-dialogo-titulo" className="text-sm font-medium text-ink">
              {mensaje}
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                ref={cancelarRef}
                type="button"
                onClick={onCancelar}
                className="rounded-md border border-border px-3 py-2 text-sm font-medium text-ink transition-colors hover:bg-bg"
              >
                {textoCancelar}
              </button>
              <button
                type="button"
                onClick={onConfirmar}
                className="rounded-md bg-brand px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-dark"
              >
                {textoConfirmar}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
