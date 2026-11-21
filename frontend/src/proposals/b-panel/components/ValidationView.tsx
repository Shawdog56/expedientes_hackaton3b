import { useState } from 'react';
import type { ExpedienteAnalisis } from '../../../shared/useSimulatedAnalysis';
import { CompetitionTab } from './CompetitionTab';
import { DictamenBanner } from './DictamenBanner';
import { DocumentCard } from './DocumentCard';
import { DocumentosResumen } from './DocumentosResumen';
import { ExpedienteSwitcher } from './ExpedienteSwitcher';
import { FindingDrawer, type SeleccionHallazgo } from './FindingDrawer';
import { StageBar } from './StageBar';

interface Props {
  analisis: ExpedienteAnalisis[];
  indiceActual: number;
  terminado: boolean;
  onReiniciar: () => void;
}

type Pestana = 'validaciones' | 'competencia';

const PESTANAS: { id: Pestana; etiqueta: string }[] = [
  { id: 'validaciones', etiqueta: 'Validaciones' },
  { id: 'competencia', etiqueta: 'Zona y competencia' },
];

export function ValidationView({ analisis, indiceActual, terminado, onReiniciar }: Props) {
  // Mientras corre, la selección sigue al expediente en curso (derivado, sin
  // estado propio). Al terminar, el usuario puede elegir libremente; se
  // recuerda el último índice en curso como punto de partida (ajustado
  // durante el render, siguiendo el patrón de React para esto).
  const [ultimoIndiceConocido, setUltimoIndiceConocido] = useState(0);
  if (!terminado && indiceActual >= 0 && indiceActual !== ultimoIndiceConocido) {
    setUltimoIndiceConocido(indiceActual);
  }
  const [seleccionManual, setSeleccionManual] = useState<number | null>(null);
  const seleccionado = terminado
    ? (seleccionManual ?? ultimoIndiceConocido)
    : indiceActual >= 0
      ? indiceActual
      : 0;

  const [pestana, setPestana] = useState<Pestana>('validaciones');
  const [hallazgoAbierto, setHallazgoAbierto] = useState<SeleccionHallazgo | null>(null);

  const seleccionarExpediente = (indice: number) => {
    setSeleccionManual(indice);
    setPestana('validaciones');
  };

  const actual = analisis[seleccionado];
  if (!actual) return null;

  const finalizado = actual.dictamen !== null;

  const bloqueValidaciones = (
    <div className="space-y-5">
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
            interactivo={finalizado}
            onAbrirPunto={setHallazgoAbierto}
          />
        ))}
      </div>
    </div>
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        {analisis.length > 1 ? (
          <ExpedienteSwitcher
            analisis={analisis}
            indiceEnCurso={indiceActual}
            seleccionado={seleccionado}
            interactivo={terminado}
            onSeleccionar={seleccionarExpediente}
          />
        ) : (
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted">Expediente 1 de 1</p>
            <h2 className="truncate text-lg font-semibold text-ink">{actual.nombre}</h2>
          </div>
        )}
        <button
          type="button"
          onClick={onReiniciar}
          className="shrink-0 text-sm font-medium text-brand underline underline-offset-2 hover:no-underline"
        >
          Analizar otro lote
        </button>
      </div>

      {finalizado && actual.dictamen && (
        <>
          <DictamenBanner dictamen={actual.dictamen} documentos={actual.documentos} />
          <DocumentosResumen archivosNoReconocidos={actual.archivosNoReconocidos} />
        </>
      )}

      {finalizado ? (
        <div>
          <div role="tablist" aria-label="Secciones del expediente" className="flex gap-1 border-b border-border">
            {PESTANAS.map((item) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                id={`tab-${item.id}`}
                aria-selected={pestana === item.id}
                aria-controls={`panel-${item.id}`}
                onClick={() => setPestana(item.id)}
                className={`border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
                  pestana === item.id ? 'border-brand text-ink' : 'border-transparent text-muted hover:text-ink'
                }`}
              >
                {item.etiqueta}
              </button>
            ))}
          </div>

          <div role="tabpanel" id={`panel-${pestana}`} aria-labelledby={`tab-${pestana}`} className="pt-4">
            {pestana === 'validaciones' && bloqueValidaciones}
            {pestana === 'competencia' && <CompetitionTab />}
          </div>
        </div>
      ) : (
        bloqueValidaciones
      )}

      <FindingDrawer seleccion={hallazgoAbierto} onCerrar={() => setHallazgoAbierto(null)} />
    </div>
  );
}
