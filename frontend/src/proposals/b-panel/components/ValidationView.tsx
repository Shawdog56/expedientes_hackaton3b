import { ArrowRight, CircleCheck, CircleX, Lock } from 'lucide-react';
import { useState } from 'react';
import type { DocumentoAnalisis, ExpedienteAnalisis } from '../../../shared/useSimulatedAnalysis';
import { useDecisionFinal } from '../useDecisionFinal';
import { CompetitionTab } from './CompetitionTab';
import { DecisionFinalPanel } from './DecisionFinalPanel';
import { DictamenBanner } from './DictamenBanner';
import { DocumentCard } from './DocumentCard';
import { ExpedienteSwitcher } from './ExpedienteSwitcher';
import { FindingDrawer, type PuntoSeleccionado } from './FindingDrawer';
import { StageBar } from './StageBar';

interface Props {
  analisis: ExpedienteAnalisis[];
  indiceActual: number;
  terminado: boolean;
  onReiniciar: () => void;
  onVerArchivos: (documento: DocumentoAnalisis) => void;
}

type Pestana = 'validaciones' | 'competencia' | 'decision';

const PESTANAS: { id: Pestana; etiqueta: string }[] = [
  { id: 'validaciones', etiqueta: 'Validaciones' },
  { id: 'competencia', etiqueta: 'Zona y competencia' },
  { id: 'decision', etiqueta: 'Decisión final' },
];

export function ValidationView({ analisis, indiceActual, terminado, onReiniciar, onVerArchivos }: Props) {
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
  const [puntoAbierto, setPuntoAbierto] = useState<PuntoSeleccionado | null>(null);
  // Expedientes cuya pestaña "Zona y competencia" ya se abrió: sin verla no se habilita la decisión final.
  const [zonaRevisada, setZonaRevisada] = useState<Record<string, true>>({});
  const { porExpediente, decidir, sinDecision } = useDecisionFinal();

  const seleccionarExpediente = (indice: number) => {
    setSeleccionManual(indice);
    setPestana('validaciones');
  };

  const actual = analisis[seleccionado];
  if (!actual) return null;

  const finalizado = actual.dictamen !== null;
  const revisoZona = zonaRevisada[actual.expedienteId] === true;
  const estadoDecision = porExpediente[actual.expedienteId] ?? sinDecision;

  const abrirPestana = (destino: Pestana) => {
    if (destino === 'decision' && !revisoZona) return;
    if (destino === 'competencia') {
      setZonaRevisada((actuales) => ({ ...actuales, [actual.expedienteId]: true }));
    }
    setPestana(destino);
  };

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
            onAbrirPunto={setPuntoAbierto}
            onVerArchivos={() => onVerArchivos(documento)}
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
        <DictamenBanner dictamen={actual.dictamen} totalDocumentos={actual.documentos.length} />
      )}

      {finalizado ? (
        <div>
          <div role="tablist" aria-label="Secciones del expediente" className="flex gap-1 border-b border-border">
            {PESTANAS.map(({ id, etiqueta }) => {
              const bloqueada = id === 'decision' && !revisoZona;
              const activa = pestana === id;
              return (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  id={`tab-${id}`}
                  aria-selected={activa}
                  aria-controls={`panel-${id}`}
                  aria-disabled={bloqueada || undefined}
                  title={bloqueada ? 'Revisa primero la pestaña Zona y competencia' : undefined}
                  onClick={() => abrirPestana(id)}
                  className={`inline-flex items-center gap-1.5 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
                    activa ? 'border-brand text-ink' : 'border-transparent text-muted'
                  } ${bloqueada ? 'cursor-not-allowed opacity-60' : 'hover:text-ink'}`}
                >
                  {bloqueada && <Lock className="h-3.5 w-3.5" aria-hidden="true" />}
                  {etiqueta}
                  {id === 'decision' && estadoDecision.decision === 'aceptado' && (
                    <CircleCheck className="h-4 w-4 text-ok" aria-label="Aceptado" />
                  )}
                  {id === 'decision' && estadoDecision.decision === 'rechazado' && (
                    <CircleX className="h-4 w-4 text-error" aria-label="Rechazado" />
                  )}
                </button>
              );
            })}
          </div>

          {pestana === 'validaciones' && (
            <div role="tabpanel" id="panel-validaciones" aria-labelledby="tab-validaciones" className="space-y-4 pt-4">
              {bloqueValidaciones}
              {!revisoZona && (
                <p className="text-sm text-muted">
                  Siguiente paso: revisa <strong className="font-medium text-ink">Zona y competencia</strong> para
                  habilitar la decisión final.
                </p>
              )}
            </div>
          )}
          {pestana === 'competencia' && (
            <div role="tabpanel" id="panel-competencia" aria-labelledby="tab-competencia" className="space-y-4 pt-4">
              <CompetitionTab />
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => abrirPestana('decision')}
                  className="inline-flex items-center gap-2 rounded-md bg-brand px-4 py-2.5 font-medium text-white transition-colors hover:bg-brand-dark"
                >
                  Continuar a la decisión final
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            </div>
          )}
          {pestana === 'decision' && (
            <div role="tabpanel" id="panel-decision" aria-labelledby="tab-decision" className="pt-4">
              <DecisionFinalPanel
                key={actual.expedienteId}
                analisis={actual}
                estado={estadoDecision}
                onDecidir={(decision) => void decidir(actual.expedienteId, actual.idServidor, decision)}
              />
            </div>
          )}
        </div>
      ) : (
        bloqueValidaciones
      )}

      <FindingDrawer punto={puntoAbierto} onCerrar={() => setPuntoAbierto(null)} />
    </div>
  );
}
