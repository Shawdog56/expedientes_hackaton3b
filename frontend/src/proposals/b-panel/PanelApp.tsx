import { AnimatePresence, motion, type Variants } from 'motion/react';
import { GraduationCap } from 'lucide-react';
import { useCallback, useState } from 'react';
import { EXPEDIENTES_DEMO } from '../../shared/datosDemo';
import { useExpedientes } from '../../shared/hooks/useExpedientes';
import { CURVA_SALIDA, DURACION, useAnimaciones } from '../../shared/motion';
import type { DocumentoParaVer } from '../../shared/types/expediente';
import { useSimulatedAnalysis } from '../../shared/useSimulatedAnalysis';
import { DocumentViewer } from './components/DocumentViewer';
import { Tutorial, type TutorialContexto } from './components/Tutorial';
import { ValidationView } from './components/ValidationView';
import { Footer } from './Footer';
import { PanelExpedienteList } from './PanelExpedienteList';
import { PanelHeader } from './PanelHeader';
import { PanelSidebar } from './PanelSidebar';

const VELOCIDAD_TUTORIAL = 4;

export function PanelApp() {
  const { expedientes, expedientesListos, agregarExpedientes, quitarExpediente, reclasificar, aviso } =
    useExpedientes();
  const { analisis, indiceActual, corriendo, terminado, iniciar, reiniciar } = useSimulatedAnalysis();

  // Instancia independiente para el tutorial: corre sobre datos de prueba sin
  // tocar el estado real, así "restaurar" al terminar es simplemente dejar de
  // leer de aquí (el estado real nunca se modificó).
  const {
    analisis: analisisDemo,
    indiceActual: indiceActualDemo,
    corriendo: corriendoDemo,
    terminado: terminadoDemo,
    iniciar: iniciarDemo,
    reiniciar: reiniciarDemo,
  } = useSimulatedAnalysis();

  const [tutorialActivo, setTutorialActivo] = useState(false);
  const { reducido } = useAnimaciones();
  const [documentoParaVer, setDocumentoParaVer] = useState<DocumentoParaVer | null>(null);

  const vistaReal = terminado ? 'resultados' : corriendo ? 'analisis' : 'bandeja';
  const vistaDemo = terminadoDemo ? 'resultados' : corriendoDemo ? 'analisis' : 'bandeja';
  const vista = tutorialActivo ? vistaDemo : vistaReal;

  const expedientesMostrados = tutorialActivo ? EXPEDIENTES_DEMO : expedientes;
  const analisisMostrado = tutorialActivo ? analisisDemo : analisis;
  const indiceActualMostrado = tutorialActivo ? indiceActualDemo : indiceActual;
  const terminadoMostrado = tutorialActivo ? terminadoDemo : terminado;

  const iniciarTutorial = useCallback(() => {
    reiniciarDemo();
    setTutorialActivo(true);
  }, [reiniciarDemo]);

  const terminarTutorial = useCallback(() => {
    setTutorialActivo(false);
    reiniciarDemo();
  }, [reiniciarDemo]);

  const contextoTutorial: TutorialContexto = { analisisDemo, terminadoDemo, iniciarDemo };

  // La vista que sale sube 8px mientras se desvanece (rápida); la que entra
  // baja 8px hasta su lugar mientras aparece (normal). Con reducir
  // movimiento, solo cambia la opacidad.
  const variantesVista: Variants = reducido
    ? {
        oculto: { opacity: 0, transition: { duration: DURACION.rapida, ease: [...CURVA_SALIDA] } },
        visible: { opacity: 1, transition: { duration: DURACION.rapida, ease: [...CURVA_SALIDA] } },
      }
    : {
        oculto: { opacity: 0, y: -8, transition: { duration: DURACION.rapida, ease: [...CURVA_SALIDA] } },
        visible: { opacity: 1, y: 0, transition: { duration: DURACION.normal, ease: [...CURVA_SALIDA] } },
      };

  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <PanelHeader vista={vista} onIrInicio={reiniciar} onIniciarTutorial={iniciarTutorial} />

      {tutorialActivo && (
        <div className="flex items-center justify-center gap-1.5 bg-accent/20 px-4 py-1.5 text-center text-xs font-semibold text-ink">
          <GraduationCap className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          Modo tutorial · datos de prueba
        </div>
      )}

      <main className="mx-auto grid w-full max-w-6xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[320px_1fr]">
        <PanelSidebar
          expedientesActuales={expedientesMostrados}
          onExpedientesCargados={tutorialActivo ? () => {} : agregarExpedientes}
        />
        <AnimatePresence mode="wait">
          <motion.div key={vista} initial="oculto" animate="visible" exit="oculto" variants={variantesVista}>
            {vista === 'bandeja' ? (
              <PanelExpedienteList
                expedientes={expedientesMostrados}
                onQuitar={tutorialActivo ? () => {} : quitarExpediente}
                onReclasificar={tutorialActivo ? () => {} : reclasificar}
                onAnalizar={() =>
                  tutorialActivo ? iniciarDemo(EXPEDIENTES_DEMO, VELOCIDAD_TUTORIAL) : iniciar(expedientesListos)
                }
                // Los datos del tutorial no tienen archivos en el servidor: no se ofrece el visor.
                onVer={tutorialActivo ? undefined : setDocumentoParaVer}
              />
            ) : (
              <ValidationView
                analisis={analisisMostrado}
                indiceActual={indiceActualMostrado}
                terminado={terminadoMostrado}
                onReiniciar={tutorialActivo ? () => {} : reiniciar}
                onVerArchivos={
                  tutorialActivo
                    ? undefined
                    : (documento) => setDocumentoParaVer({ titulo: documento.nombre, archivos: documento.archivos })
                }
              />
            )}
          </motion.div>
        </AnimatePresence>
        {aviso && (
          <p role="status" className="text-sm font-medium text-error lg:col-start-2">
            {aviso}
          </p>
        )}
      </main>
      <Footer />
      <DocumentViewer documento={documentoParaVer} onCerrar={() => setDocumentoParaVer(null)} />

      <Tutorial activo={tutorialActivo} contexto={contextoTutorial} onTerminar={terminarTutorial} />
    </div>
  );
}
