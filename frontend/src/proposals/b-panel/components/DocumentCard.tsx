import type { DocumentoAnalisis } from '../../../shared/useSimulatedAnalysis';
import { EstadoIcono } from './EstadoIcono';
import { ProgressRing, type EstadoAnillo } from './ProgressRing';

interface Props {
  documento: DocumentoAnalisis;
  enValidacion: boolean;
}

export function DocumentCard({ documento, enValidacion }: Props) {
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
      <ul className="space-y-1.5">
        {documento.reglas.map((regla) => (
          <li key={regla.id} className="flex items-start gap-2 text-sm">
            <EstadoIcono estado={regla.estado} className="mt-0.5 h-4 w-4 shrink-0" />
            <span className="text-ink">{regla.etiqueta}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
