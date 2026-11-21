import { CircleCheck } from 'lucide-react';
import { motion } from 'motion/react';
import { CURVA_SALIDA, useAnimaciones } from '../../../shared/motion';
import { ETAPAS, type Etapa, type EstadoValidacion } from '../../../shared/validationRules';
import { EstadoIcono } from './EstadoIcono';

interface Props {
  etapaActual: Etapa | null;
  etapasCompletadas: Etapa[];
  progreso: number;
  /** Al terminar, se reemplaza la barra completa por una línea discreta. */
  compacto: boolean;
}

export function StageBar({ etapaActual, etapasCompletadas, progreso, compacto }: Props) {
  const { reducido } = useAnimaciones();

  return (
    <motion.div
      layout={!reducido}
      transition={{ duration: 0.3, ease: [...CURVA_SALIDA] }}
      style={{ overflow: 'hidden' }}
    >
      {compacto ? (
        <p className="flex items-center gap-2 text-[13px] text-muted">
          <CircleCheck className="h-4 w-4 shrink-0 text-ok" aria-hidden="true" />
          Análisis completo · {ETAPAS.length} etapas
        </p>
      ) : (
        <div>
          <ol className="flex flex-wrap items-center gap-x-1 gap-y-3">
            {ETAPAS.map((etapa, indice) => {
              const completada = etapasCompletadas.includes(etapa.id);
              const actual = etapa.id === etapaActual;
              const estado: EstadoValidacion = completada ? 'verificado' : actual ? 'validando' : 'pendiente';

              return (
                <li key={etapa.id} className="flex items-center">
                  <div className="flex items-center gap-1.5">
                    <EstadoIcono estado={estado} className="h-4 w-4" />
                    <span className={`text-xs font-medium ${completada || actual ? 'text-ink' : 'text-muted'}`}>
                      {etapa.etiqueta}
                    </span>
                  </div>
                  {indice < ETAPAS.length - 1 && (
                    <span className="relative mx-2 h-px w-4 shrink-0 overflow-hidden bg-border sm:w-8" aria-hidden="true">
                      <motion.span
                        className="absolute inset-0 bg-ok"
                        style={{ transformOrigin: 'left' }}
                        initial={false}
                        animate={{ scaleX: completada ? 1 : 0 }}
                        transition={reducido ? { duration: 0 } : { duration: 0.25, ease: [...CURVA_SALIDA] }}
                      />
                    </span>
                  )}
                </li>
              );
            })}
          </ol>
          <div
            className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-border"
            role="progressbar"
            aria-valuenow={Math.round(progreso)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Progreso del expediente"
          >
            <div
              className="h-full rounded-full bg-brand transition-[width] duration-300"
              style={{ width: `${progreso}%` }}
            />
          </div>
        </div>
      )}
    </motion.div>
  );
}
