import { CircleX, TriangleAlert } from 'lucide-react';
import { motion } from 'motion/react';
import type { ResultadoAuditoria } from '../../../api/expedientes';
import { obtenerResumenDictamen, type Confianza } from '../../../shared/mockResults';
import { useAnimaciones } from '../../../shared/motion';
import { nivelDeConfianza } from '../../../shared/resultadosReales';
import type { Dictamen, DocumentoAnalisis } from '../../../shared/useSimulatedAnalysis';
import { RecomendacionInicial } from './RecomendacionInicial';

interface Props {
  dictamen: Dictamen;
  documentos: DocumentoAnalisis[];
  /** Con análisis real, la explicación, la confianza y los hallazgos salen de la auditoría. */
  resultadoReal?: ResultadoAuditoria;
}

const NIVEL_CONFIANZA: Record<Confianza, number> = { alta: 3, media: 2, baja: 1 };

function IndicadorConfianza({ confianza, porcentaje }: { confianza: Confianza; porcentaje?: number }) {
  const nivel = NIVEL_CONFIANZA[confianza];

  return (
    <span
      className="inline-flex shrink-0 items-center gap-1.5"
      title="Qué tan seguros estamos de los datos leídos de los documentos"
    >
      <span className="flex items-end gap-0.5" aria-hidden="true">
        {[1, 2, 3].map((barra) => (
          <span
            key={barra}
            className={`w-1 rounded-sm ${barra <= nivel ? 'bg-ink' : 'bg-border'}`}
            style={{ height: `${barra * 4 + 4}px` }}
          />
        ))}
      </span>
      <span className="text-sm text-muted">
        Confianza {confianza}
        {porcentaje !== undefined && ` (${porcentaje}%)`}
      </span>
    </span>
  );
}

export function DictamenBanner({ dictamen, documentos, resultadoReal }: Props) {
  const { reducido } = useAnimaciones();
  const faltantes = documentos.filter((documento) => documento.faltante);
  const documentosFaltantes = faltantes.map((documento) => documento.nombre);
  const ejemplo = obtenerResumenDictamen(dictamen, { documentosFaltantes });
  const confianza = resultadoReal ? nivelDeConfianza(resultadoReal.confianza_veredicto) : ejemplo.confianza;
  const porQue = resultadoReal?.explicacion?.trim() || ejemplo.porQue;
  const criticos = resultadoReal?.hallazgos_criticos ?? [];
  const advertencias = resultadoReal?.hallazgos_advertencias ?? [];

  return (
    <motion.div
      data-tour="recomendacion-inicial"
      initial={reducido ? { opacity: 0 } : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="rounded-[14px] border border-border bg-surface p-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <RecomendacionInicial dictamen={dictamen} />
        <div className="flex flex-wrap items-center gap-4">
          {faltantes.length > 0 ? (
            <span className="flex items-center gap-1.5 text-sm font-medium" style={{ color: '#7A4B00' }}>
              <TriangleAlert className="h-4 w-4 shrink-0" aria-hidden="true" />
              {documentos.length - faltantes.length} de {documentos.length} documentos · falta{' '}
              {documentosFaltantes.join(', ')}
            </span>
          ) : (
            <span className="text-sm text-muted">
              {documentos.length} de {documentos.length} documentos
            </span>
          )}
          <IndicadorConfianza confianza={confianza} porcentaje={resultadoReal?.confianza_veredicto} />
        </div>
      </div>

      <p className="mt-4 whitespace-pre-line text-[15px] leading-[23px] text-ink">{porQue}</p>

      {(criticos.length > 0 || advertencias.length > 0) && (
        <ul className="mt-4 space-y-1.5 border-t border-border pt-4">
          {criticos.map((hallazgo, indice) => (
            <li key={`c-${indice}`} className="flex items-start gap-2 text-sm text-ink">
              <CircleX className="mt-0.5 h-4 w-4 shrink-0 text-error" aria-label="Crítico" />
              {hallazgo.descripcion}
            </li>
          ))}
          {advertencias.map((hallazgo, indice) => (
            <li key={`a-${indice}`} className="flex items-start gap-2 text-sm text-ink">
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-warn" aria-label="Advertencia" />
              {hallazgo.descripcion}
            </li>
          ))}
        </ul>
      )}
    </motion.div>
  );
}
