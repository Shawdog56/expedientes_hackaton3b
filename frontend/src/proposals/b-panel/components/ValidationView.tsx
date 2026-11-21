import { ArrowRight, CircleCheck, CircleX, Lock, RotateCcw } from 'lucide-react';
import { AnimatePresence, motion, type Variants } from 'motion/react';
import { useState } from 'react';
import { CURVA_SALIDA, useAnimaciones } from '../../../shared/motion';
import type { DocumentoAnalisis, ExpedienteAnalisis } from '../../../shared/useSimulatedAnalysis';
import { useDecisionFinal } from '../useDecisionFinal';
import { CompetitionTab } from './CompetitionTab';
import { DecisionFinalPanel } from './DecisionFinalPanel';
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
  /** Sin esta función (por ejemplo en el tutorial) no se ofrece el visor de archivos. */
  onVerArchivos?: (documento: DocumentoAnalisis) => void;
}

type Pestana = 'legal' | 'competencia' | 'decision';

const PESTANAS: { id: Pestana; etiqueta: string }[] = [
  { id: 'legal', etiqueta: 'Análisis legal' },
  { id: 'competencia', etiqueta: 'Zona y competencia' },
  { id: 'decision', etiqueta: 'Decisión final' },
];

const VARIANTES_BOTON_REINICIAR: Variants = {
  reposo: { y: 0, boxShadow: '0 0 0 rgba(0,0,0,0)' },
  hover: { y: -1, boxShadow: '0 4px 12px rgba(0,0,0,0.08)' },
};

const VARIANTES_ICONO_REINICIAR: Variants = {
  reposo: { rotate: 0 },
  hover: { rotate: -360 },
};

export function ValidationView({ analisis, indiceActual, terminado, onReiniciar, onVerArchivos }: Props) {
  const { reducido } = useAnimaciones();
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

  const [pestana, setPestana] = useState<Pestana>('legal');
  const [hallazgoAbierto, setHallazgoAbierto] = useState<SeleccionHallazgo | null>(null);
  // Expedientes cuya pestaña "Zona y competencia" ya se abrió: sin verla no se habilita la decisión final.
  const [zonaRevisada, setZonaRevisada] = useState<Record<string, true>>({});
  const { porExpediente, decidir, sinDecision } = useDecisionFinal();

  const seleccionarExpediente = (indice: number) => {
    setSeleccionManual(indice);
    setPestana('legal');
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

  const bloqueAnalisisLegal = (
    <div className="space-y-5">
      {finalizado && actual.dictamen && (
        <DictamenBanner dictamen={actual.dictamen} documentos={actual.documentos} resultadoReal={actual.resultadoReal} />
      )}

      {actual.error && (
        <div role="alert" className="flex items-start gap-2 rounded-xl border border-error/40 bg-error/5 p-4 text-sm text-ink">
          <CircleX className="mt-0.5 h-4 w-4 shrink-0 text-error" aria-hidden="true" />
          <span>
            <strong className="font-semibold">No se pudo auditar este expediente.</strong> {actual.error}
          </span>
        </div>
      )}

      {/* Solo en el análisis real: los expedientes del tutorial no existen en el servidor. */}
      {!finalizado && !actual.error && actual.idServidor && actual.etapaActual === 'extraer' && (
        <p className="text-sm text-muted">
          Leyendo los documentos con OCR y el modelo de lenguaje. Puede tardar varios minutos por expediente.
        </p>
      )}

      {finalizado ? (
        <StageBar
          etapaActual={actual.etapaActual}
          etapasCompletadas={actual.etapasCompletadas}
          progreso={actual.progreso}
          compacto
        />
      ) : (
        <div data-tour="barra-etapas" className="rounded-xl border border-border bg-surface p-4 shadow-sm">
          <StageBar
            etapaActual={actual.etapaActual}
            etapasCompletadas={actual.etapasCompletadas}
            progreso={actual.progreso}
            compacto={false}
          />
        </div>
      )}

      <div data-tour="tarjetas-documentos" className="grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-4">
        {actual.documentos.map((documento, indice) => (
          <motion.div
            key={documento.tipoId}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: indice * 0.08 }}
          >
            <DocumentCard
              documento={documento}
              enValidacion={actual.documentoEnValidacion === documento.tipoId}
              interactivo={finalizado}
              onAbrirPunto={setHallazgoAbierto}
              onVerArchivos={onVerArchivos ? () => onVerArchivos(documento) : undefined}
            />
          </motion.div>
        ))}
      </div>

      {finalizado && <DocumentosResumen archivosNoReconocidos={actual.archivosNoReconocidos} />}

      {finalizado && !revisoZona && (
        <p className="text-sm text-muted">
          Siguiente paso: revisa <strong className="font-medium text-ink">Zona y competencia</strong> para habilitar la
          decisión final.
        </p>
      )}
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
        <motion.button
          type="button"
          data-tour="boton-analizar-otro-lote"
          onClick={onReiniciar}
          initial="reposo"
          whileHover={reducido ? undefined : 'hover'}
          whileFocus={reducido ? undefined : 'hover'}
          whileTap={reducido ? undefined : { scale: 0.97 }}
          variants={reducido ? undefined : VARIANTES_BOTON_REINICIAR}
          transition={{ duration: 0.15 }}
          style={{ borderColor: '#CFCFCF' }}
          className="flex min-h-11 shrink-0 items-center gap-2 self-end rounded-[10px] border bg-white px-4 text-sm font-semibold text-ink transition-colors hover:bg-[#F5F5F5]"
        >
          <motion.span
            className="flex"
            variants={reducido ? undefined : VARIANTES_ICONO_REINICIAR}
            transition={{ duration: 0.5, ease: [...CURVA_SALIDA] }}
          >
            <RotateCcw className="h-[18px] w-[18px] shrink-0 text-ink" aria-hidden="true" />
          </motion.span>
          Analizar otro lote
        </motion.button>
      </div>

      <motion.div
        key={seleccionado}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2 }}
      >
        {finalizado ? (
          <div>
            <div role="tablist" aria-label="Secciones del expediente" className="flex gap-1 border-b border-border">
              {PESTANAS.map((item) => {
                const activo = pestana === item.id;
                const bloqueada = item.id === 'decision' && !revisoZona;
                return (
                  <button
                    key={item.id}
                    type="button"
                    data-tour={`tab-${item.id}`}
                    role="tab"
                    id={`tab-${item.id}`}
                    aria-selected={activo}
                    aria-controls={`panel-${item.id}`}
                    aria-disabled={bloqueada || undefined}
                    title={bloqueada ? 'Revisa primero la pestaña Zona y competencia' : undefined}
                    onClick={() => abrirPestana(item.id)}
                    className={`relative inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-colors ${
                      activo ? 'text-ink' : 'text-muted'
                    } ${bloqueada ? 'cursor-not-allowed opacity-60' : 'hover:text-ink'}`}
                  >
                    {bloqueada && <Lock className="h-3.5 w-3.5" aria-hidden="true" />}
                    {item.etiqueta}
                    {item.id === 'decision' && estadoDecision.decision === 'aceptado' && (
                      <CircleCheck className="h-4 w-4 text-ok" aria-label="Aceptado" />
                    )}
                    {item.id === 'decision' && estadoDecision.decision === 'rechazado' && (
                      <CircleX className="h-4 w-4 text-error" aria-label="Rechazado" />
                    )}
                    {activo && (
                      <motion.span
                        layoutId="subrayado-pestana"
                        className="absolute inset-x-0 -bottom-px h-0.5 bg-brand"
                        transition={{ duration: 0.2 }}
                      />
                    )}
                  </button>
                );
              })}
            </div>

            <AnimatePresence mode="wait">
              <motion.div
                key={pestana}
                role="tabpanel"
                id={`panel-${pestana}`}
                aria-labelledby={`tab-${pestana}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                onAnimationComplete={() => {
                  if (pestana === 'competencia') window.dispatchEvent(new Event('resize'));
                }}
                className="pt-4"
              >
                {pestana === 'legal' && bloqueAnalisisLegal}
                {pestana === 'competencia' && (
                  <div className="space-y-4">
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
                  <DecisionFinalPanel
                    key={actual.expedienteId}
                    analisis={actual}
                    estado={estadoDecision}
                    onDecidir={(decision) => void decidir(actual.expedienteId, actual.idServidor, decision)}
                  />
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        ) : (
          bloqueAnalisisLegal
        )}
      </motion.div>

      <FindingDrawer seleccion={hallazgoAbierto} onCerrar={() => setHallazgoAbierto(null)} />
    </div>
  );
}
