import { ETAPAS, type Etapa, type EstadoValidacion } from '../../../shared/validationRules';
import { EstadoIcono } from './EstadoIcono';

interface Props {
  etapaActual: Etapa | null;
  etapasCompletadas: Etapa[];
  progreso: number;
}

export function StageBar({ etapaActual, etapasCompletadas, progreso }: Props) {
  return (
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
                <span
                  className={`mx-2 h-px w-4 shrink-0 sm:w-8 ${completada ? 'bg-ok' : 'bg-border'}`}
                  aria-hidden="true"
                />
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
        <div className="h-full rounded-full bg-brand transition-[width] duration-300" style={{ width: `${progreso}%` }} />
      </div>
    </div>
  );
}
