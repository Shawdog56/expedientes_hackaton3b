import { CircleCheck, CircleX, TriangleAlert } from 'lucide-react';
import type { Dictamen, ExpedienteAnalisis } from '../../../shared/useSimulatedAnalysis';
import { EstadoIcono } from './EstadoIcono';

interface Props {
  analisis: ExpedienteAnalisis[];
  indiceEnCurso: number;
  seleccionado: number;
  interactivo: boolean;
  onSeleccionar: (indice: number) => void;
}

function IconoDictamen({ dictamen }: { dictamen: Dictamen }) {
  if (dictamen === 'cumple') return <CircleCheck className="h-4 w-4 text-ok" aria-hidden="true" />;
  if (dictamen === 'revision') return <TriangleAlert className="h-4 w-4 text-warn" aria-hidden="true" />;
  return <CircleX className="h-4 w-4 text-error" aria-hidden="true" />;
}

export function ExpedienteSwitcher({ analisis, indiceEnCurso, seleccionado, interactivo, onSeleccionar }: Props) {
  return (
    <div role="group" aria-label="Expedientes del lote" className="flex flex-wrap gap-2">
      {analisis.map((item, indice) => {
        const activo = indice === seleccionado;

        return (
          <button
            key={item.expedienteId}
            type="button"
            disabled={!interactivo}
            aria-current={activo || undefined}
            onClick={() => onSeleccionar(indice)}
            className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
              activo ? 'border-brand bg-brand-soft text-ink' : 'border-border bg-surface text-muted'
            } ${interactivo ? 'cursor-pointer hover:border-brand/60' : 'cursor-default'}`}
          >
            {item.dictamen ? (
              <IconoDictamen dictamen={item.dictamen} />
            ) : (
              <EstadoIcono estado={indice === indiceEnCurso ? 'validando' : 'pendiente'} className="h-4 w-4" />
            )}
            <span className="max-w-[10rem] truncate">{item.nombre}</span>
          </button>
        );
      })}
    </div>
  );
}
