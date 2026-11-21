import { ChevronRight, Eye } from 'lucide-react';
import type { DocumentoAnalisis } from '../../../shared/useSimulatedAnalysis';
import { EstadoIcono } from './EstadoIcono';
import type { PuntoSeleccionado } from './FindingDrawer';
import { ProgressRing, type EstadoAnillo } from './ProgressRing';

interface Props {
  documento: DocumentoAnalisis;
  enValidacion: boolean;
  interactivo: boolean;
  onAbrirPunto: (punto: PuntoSeleccionado) => void;
  onVerArchivos: () => void;
}

export function DocumentCard({ documento, enValidacion, interactivo, onAbrirPunto, onVerArchivos }: Props) {
  const total = documento.reglas.length;
  const resueltos = documento.reglas.filter(
    (regla) => regla.estado !== 'pendiente' && regla.estado !== 'validando',
  ).length;
  const porRevisar = documento.reglas.filter((regla) => regla.estado === 'revisar').length;
  const hayNoCumple = documento.reglas.some((regla) => regla.estado === 'no_cumple');
  const todoPendiente = documento.reglas.every((regla) => regla.estado === 'pendiente');

  let estadoAnillo: EstadoAnillo;
  let etiquetaAnillo: string;
  if (todoPendiente) {
    estadoAnillo = 'en_espera';
    etiquetaAnillo = 'En espera de validación';
  } else if (resueltos < total) {
    estadoAnillo = 'validando';
    etiquetaAnillo = `Validando, ${resueltos} de ${total}`;
  } else if (hayNoCumple) {
    estadoAnillo = 'no_cumple';
    etiquetaAnillo = `Completo, no cumple (${total} de ${total})`;
  } else if (porRevisar > 0) {
    estadoAnillo = 'revisar';
    etiquetaAnillo = `Completo, ${porRevisar} de ${total} requieren revisión`;
  } else {
    estadoAnillo = 'completo';
    etiquetaAnillo = `Completo, ${total} de ${total} verificados`;
  }

  const bordeClase = enValidacion
    ? 'border-2 border-brand'
    : porRevisar > 0
      ? 'border border-warn/50'
      : 'border border-border';

  return (
    <div className={`flex flex-col gap-3 rounded-xl bg-surface p-4 shadow-sm ${bordeClase}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-medium text-ink">{documento.nombre}</p>
          <p
            className={`truncate text-xs ${documento.faltante ? 'font-medium text-error' : 'text-muted'}`}
            title={documento.archivo ?? undefined}
          >
            {documento.archivo ?? 'Documento faltante en el expediente'}
          </p>
          {documento.archivos.length > 0 && (
            <button
              type="button"
              onClick={onVerArchivos}
              className="mt-1.5 inline-flex items-center gap-1 rounded-md border border-border px-2 py-0.5 text-xs font-medium text-ink transition-colors hover:border-brand/50 hover:bg-bg"
            >
              <Eye className="h-3 w-3" aria-hidden="true" />
              {documento.archivos.length === 1 ? 'Ver archivo' : `Ver archivos (${documento.archivos.length})`}
            </button>
          )}
        </div>
        <ProgressRing estado={estadoAnillo} resueltos={resueltos} total={total} etiqueta={etiquetaAnillo} />
      </div>
      <ul className="space-y-1">
        {documento.reglas.map((regla) => {
          const fondoHallazgo =
            regla.estado === 'revisar' ? 'bg-warn/10' : regla.estado === 'no_cumple' ? 'bg-error/10' : '';

          if (!interactivo) {
            return (
              <li
                key={regla.id}
                className={`flex items-start gap-2 rounded-md px-2 py-1.5 text-sm ${fondoHallazgo}`}
              >
                <EstadoIcono estado={regla.estado} className="mt-0.5 h-4 w-4 shrink-0" />
                <span className="text-ink">{regla.etiqueta}</span>
              </li>
            );
          }

          return (
            <li key={regla.id}>
              <button
                type="button"
                onClick={() =>
                  onAbrirPunto({
                    tipoId: documento.tipoId,
                    reglaId: regla.id,
                    reglaEtiqueta: regla.etiqueta,
                    estado: regla.estado,
                    documentoNombre: documento.nombre,
                    documentoArchivo: documento.archivo ?? documento.nombre,
                  })
                }
                className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-bg ${fondoHallazgo}`}
              >
                <EstadoIcono estado={regla.estado} className="mt-0.5 h-4 w-4 shrink-0 self-start" />
                <span className="flex-1 text-ink">{regla.etiqueta}</span>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
