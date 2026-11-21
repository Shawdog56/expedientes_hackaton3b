import type { ExpedienteAnalisis } from '../../../shared/useSimulatedAnalysis';
import { DictamenChip, QueueList } from './QueueList';
import { DocumentCard } from './DocumentCard';
import { StageBar } from './StageBar';

interface Props {
  analisis: ExpedienteAnalisis[];
  indiceActual: number;
  terminado: boolean;
  onReiniciar: () => void;
}

export function ValidationView({ analisis, indiceActual, terminado, onReiniciar }: Props) {
  if (terminado) {
    return (
      <div className="mx-auto w-full max-w-2xl space-y-4">
        <h2 className="text-center text-lg font-semibold text-ink">Análisis completado</h2>
        <ul className="divide-y divide-border rounded-xl border border-border bg-surface shadow-sm">
          {analisis.map((item) => (
            <li key={item.expedienteId} className="flex items-center justify-between gap-3 px-4 py-3">
              <span className="truncate font-medium text-ink">{item.nombre}</span>
              <DictamenChip dictamen={item.dictamen} />
            </li>
          ))}
        </ul>
        <div className="text-center">
          <button
            type="button"
            onClick={onReiniciar}
            className="text-sm font-medium text-brand underline underline-offset-2 hover:no-underline"
          >
            Analizar otro lote
          </button>
        </div>
      </div>
    );
  }

  const actual = analisis[indiceActual];
  if (!actual) return null;

  const otros = analisis.filter((_, indice) => indice !== indiceActual);

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-muted">
          Expediente {indiceActual + 1} de {analisis.length}
        </p>
        <h2 className="truncate text-lg font-semibold text-ink">{actual.nombre}</h2>
      </div>

      <div className="rounded-xl border border-border bg-surface p-4 shadow-sm">
        <StageBar
          etapaActual={actual.etapaActual}
          etapasCompletadas={actual.etapasCompletadas}
          progreso={actual.progreso}
        />
      </div>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-4">
        {actual.documentos.map((documento) => (
          <DocumentCard
            key={documento.tipoId}
            documento={documento}
            enValidacion={actual.documentoEnValidacion === documento.tipoId}
          />
        ))}
      </div>

      <QueueList items={otros} />
    </div>
  );
}
