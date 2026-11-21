import { AnimatePresence, motion } from 'motion/react';
import { RotateCcw } from 'lucide-react';
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

type Pestana = 'legal' | 'competencia';

const PESTANAS: { id: Pestana; etiqueta: string }[] = [
  { id: 'legal', etiqueta: 'Análisis legal' },
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

  const [pestana, setPestana] = useState<Pestana>('legal');
  const [hallazgoAbierto, setHallazgoAbierto] = useState<SeleccionHallazgo | null>(null);

  const seleccionarExpediente = (indice: number) => {
    setSeleccionManual(indice);
    setPestana('legal');
  };

  const actual = analisis[seleccionado];
  if (!actual) return null;

  const finalizado = actual.dictamen !== null;

  const bloqueAnalisisLegal = (
    <div className="space-y-5">
      {finalizado && actual.dictamen && <DictamenBanner dictamen={actual.dictamen} documentos={actual.documentos} />}

      {finalizado ? (
        <StageBar
          etapaActual={actual.etapaActual}
          etapasCompletadas={actual.etapasCompletadas}
          progreso={actual.progreso}
          compacto
        />
      ) : (
        <div className="rounded-xl border border-border bg-surface p-4 shadow-sm">
          <StageBar
            etapaActual={actual.etapaActual}
            etapasCompletadas={actual.etapasCompletadas}
            progreso={actual.progreso}
            compacto={false}
          />
        </div>
      )}

      <div className="grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-4">
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
            />
          </motion.div>
        ))}
      </div>

      {finalizado && <DocumentosResumen archivosNoReconocidos={actual.archivosNoReconocidos} />}
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
          style={{ borderColor: '#CFCFCF' }}
          className="flex min-h-11 shrink-0 items-center gap-2 self-end rounded-[10px] border bg-white px-4 text-sm font-semibold text-ink transition-colors hover:bg-[#F5F5F5]"
        >
          <RotateCcw className="h-[18px] w-[18px] shrink-0 text-ink" aria-hidden="true" />
          Analizar otro lote
        </button>
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
                return (
                  <button
                    key={item.id}
                    type="button"
                    role="tab"
                    id={`tab-${item.id}`}
                    aria-selected={activo}
                    aria-controls={`panel-${item.id}`}
                    onClick={() => setPestana(item.id)}
                    className={`relative px-4 py-2.5 text-sm font-medium transition-colors ${
                      activo ? 'text-ink' : 'text-muted hover:text-ink'
                    }`}
                  >
                    {item.etiqueta}
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
                {pestana === 'competencia' && <CompetitionTab />}
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
