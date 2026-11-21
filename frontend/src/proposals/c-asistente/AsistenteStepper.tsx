import { Check, ChevronRight } from 'lucide-react';
import type { PasoAsistente } from './types';

const PASOS: { numero: PasoAsistente; etiqueta: string }[] = [
  { numero: 1, etiqueta: 'Cargar' },
  { numero: 2, etiqueta: 'Revisar archivos' },
  { numero: 3, etiqueta: 'Analizar' },
];

interface Props {
  pasoActual: PasoAsistente;
  pasoMaximoHabilitado: PasoAsistente;
  onIrAPaso: (paso: PasoAsistente) => void;
}

export function AsistenteStepper({ pasoActual, pasoMaximoHabilitado, onIrAPaso }: Props) {
  return (
    <ol
      aria-label="Progreso del análisis"
      className="mx-auto flex max-w-2xl items-center justify-center gap-1 px-4 py-6 sm:gap-2 sm:px-6"
    >
      {PASOS.map((paso, indice) => {
        const completado = paso.numero < pasoActual;
        const activo = paso.numero === pasoActual;
        const habilitado = paso.numero <= pasoMaximoHabilitado;

        return (
          <li key={paso.numero} className="flex items-center gap-1 sm:gap-2">
            <button
              type="button"
              onClick={() => onIrAPaso(paso.numero)}
              disabled={!habilitado}
              aria-current={activo ? 'step' : undefined}
              aria-label={`Paso ${paso.numero}: ${paso.etiqueta}`}
              className={`flex items-center gap-2 rounded-full px-2 py-1 transition-colors ${
                habilitado ? 'cursor-pointer' : 'cursor-not-allowed'
              }`}
            >
              <span
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-sm font-semibold ${
                  activo
                    ? 'border-brand bg-brand text-white'
                    : completado
                      ? 'border-brand bg-brand-soft text-brand'
                      : 'border-border bg-surface text-muted'
                }`}
              >
                {completado ? <Check className="h-4 w-4" aria-hidden="true" /> : paso.numero}
              </span>
              <span className={`hidden text-sm font-medium sm:inline ${activo ? 'text-ink' : 'text-muted'}`}>
                {paso.numero}. {paso.etiqueta}
              </span>
            </button>
            {indice < PASOS.length - 1 && (
              <ChevronRight
                className={`h-4 w-4 shrink-0 ${completado ? 'text-brand' : 'text-border'}`}
                aria-hidden="true"
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}
