import { CircleCheck, TriangleAlert } from 'lucide-react';
import type { DocumentoAnalisis } from '../../../shared/useSimulatedAnalysis';

interface Props {
  documentos: DocumentoAnalisis[];
  archivosNoReconocidos: string[];
}

export function DocumentosResumen({ documentos, archivosNoReconocidos }: Props) {
  const faltantes = documentos.filter((documento) => documento.faltante);
  const recibidos = documentos.length - faltantes.length;

  return (
    <div className="space-y-1">
      <p className="flex items-center gap-2 text-sm text-ink">
        {faltantes.length > 0 ? (
          <TriangleAlert className="h-4 w-4 shrink-0 text-warn" aria-hidden="true" />
        ) : (
          <CircleCheck className="h-4 w-4 shrink-0 text-ok" aria-hidden="true" />
        )}
        <span>
          Documentos: {recibidos} de {documentos.length} recibidos
          {faltantes.length > 0 && ` · falta ${faltantes.map((documento) => documento.nombre).join(', ')}`}
        </span>
      </p>
      {archivosNoReconocidos.length > 0 && (
        <p className="pl-6 text-xs text-muted">
          {archivosNoReconocidos.length} archivo{archivosNoReconocidos.length === 1 ? '' : 's'} no reconocido
          {archivosNoReconocidos.length === 1 ? '' : 's'}: {archivosNoReconocidos.join(', ')}
        </p>
      )}
    </div>
  );
}
