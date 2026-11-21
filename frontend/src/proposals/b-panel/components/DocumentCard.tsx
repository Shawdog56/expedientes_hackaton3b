import { ChevronRight, FileX } from 'lucide-react';
import type { DocumentoAnalisis } from '../../../shared/useSimulatedAnalysis';
import { EstadoIcono } from './EstadoIcono';
import type { SeleccionHallazgo } from './FindingDrawer';
import { ProgressRing, type EstadoAnillo } from './ProgressRing';

interface Props {
  documento: DocumentoAnalisis;
  enValidacion: boolean;
  interactivo: boolean;
  onAbrirPunto: (seleccion: SeleccionHallazgo) => void;
}

export function DocumentCard({ documento, enValidacion, interactivo, onAbrirPunto }: Props) {
  if (documento.faltante) {
    return (
      <div className="flex flex-col gap-3 rounded-xl border border-dashed border-border bg-[#FAFAFA] p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-medium text-ink">{documento.nombre}</p>
            <p className="text-xs text-muted">No se encontró en el expediente</p>
          </div>
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-bg">
            <FileX className="h-6 w-6 text-muted" aria-hidden="true" />
          </div>
        </div>
        <ul className="space-y-1">
          {documento.reglas.map((regla) => (
            <li key={regla.id} className="flex items-start gap-2 rounded-md px-2 py-1.5 text-sm text-muted">
              <EstadoIcono estado="pendiente" className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{regla.etiqueta}</span>
            </li>
          ))}
        </ul>
      </div>
    );
  }

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
          <p className="truncate text-xs text-muted">{documento.archivoEjemplo}</p>
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
                    origen: 'punto',
                    tipoId: documento.tipoId,
                    reglaId: regla.id,
                    reglaEtiqueta: regla.etiqueta,
                    estado: regla.estado,
                    documentoNombre: documento.nombre,
                    documentoArchivo: documento.archivoEjemplo,
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
