import { TriangleAlert } from 'lucide-react';
import { motion } from 'motion/react';
import { obtenerResumenDictamen, type Confianza } from '../../../shared/mockResults';
import { useAnimaciones } from '../../../shared/motion';
import type { Dictamen, DocumentoAnalisis } from '../../../shared/useSimulatedAnalysis';
import { RecomendacionInicial } from './RecomendacionInicial';

interface Props {
  dictamen: Dictamen;
  documentos: DocumentoAnalisis[];
}

const NIVEL_CONFIANZA: Record<Confianza, number> = { alta: 3, media: 2, baja: 1 };

function IndicadorConfianza({ confianza }: { confianza: Confianza }) {
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
      <span className="text-sm text-muted">Confianza {confianza}</span>
    </span>
  );
}

export function DictamenBanner({ dictamen, documentos }: Props) {
  const { reducido } = useAnimaciones();
  const faltantes = documentos.filter((documento) => documento.faltante);
  const documentosFaltantes = faltantes.map((documento) => documento.nombre);
  const { confianza, porQue } = obtenerResumenDictamen(dictamen, { documentosFaltantes });

  return (
    <motion.div
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
          <IndicadorConfianza confianza={confianza} />
        </div>
      </div>

      <p className="mt-4 text-[15px] leading-[23px] text-ink">{porQue}</p>
    </motion.div>
  );
}
