import { AnimatePresence, motion, type Variants } from 'motion/react';
import { GraduationCap } from 'lucide-react';
import { useCallback, useReducer, useState } from 'react';
import { EXPEDIENTES_DEMO } from '../../shared/datosDemo';
import { useExpedientes } from '../../shared/hooks/useExpedientes';
import { CURVA_SALIDA, DURACION, useAnimaciones } from '../../shared/motion';
import type { DocumentoParaVer } from '../../shared/types/expediente';
import { useAnalisisReal } from '../../shared/useAnalisisReal';
import { useSimulatedAnalysis } from '../../shared/useSimulatedAnalysis';
import { DocumentViewer } from './components/DocumentViewer';
import { Tutorial, type TutorialContexto } from './components/Tutorial';
import { ValidationView } from './components/ValidationView';
import { Footer } from './Footer';
import { PanelExpedienteList } from './PanelExpedienteList';
import { PanelHeader } from './PanelHeader';
import { PanelSidebar } from './PanelSidebar';

const VELOCIDAD_TUTORIAL = 4;

interface EstadoTutorial {
  activo: boolean;
  /** Se incrementa al terminar/omitir; se usa como `key` para forzar un montaje limpio de la bandeja. */
  sesion: number;
}

type AccionEstadoTutorial = 'iniciar' | 'terminar';

// Una sola transición por acción (sin varios `set` en secuencia ni
// temporizadores): "terminar" cambia `activo` e incrementa `sesion` a la vez.
function reducirEstadoTutorial(estado: EstadoTutorial, accion: AccionEstadoTutorial): EstadoTutorial {
  if (accion === 'iniciar') return { activo: true, sesion: estado.sesion };
  return { activo: false, sesion: estado.sesion + 1 };
}

export function PanelApp() {
  const { expedientes, expedientesListos, agregarExpedientes, quitarExpediente, reclasificar, aviso } =
    useExpedientes();
  // Análisis real (OCR + modelo de lenguaje en el backend); el simulado queda solo para el tutorial.
  const { analisis, indiceActual, corriendo, terminado, iniciar, reiniciar } = useAnalisisReal();

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

  const [estadoTutorial, dispatchTutorial] = useReducer(reducirEstadoTutorial, { activo: false, sesion: 0 });
  const { reducido } = useAnimaciones();
  const [documentoParaVer, setDocumentoParaVer] = useState<DocumentoParaVer | null>(null);

  const vistaReal = terminado ? 'resultados' : corriendo ? 'analisis' : 'bandeja';
  const vistaDemo = terminadoDemo ? 'resultados' : corriendoDemo ? 'analisis' : 'bandeja';
  const vista = estadoTutorial.activo ? vistaDemo : vistaReal;

  const expedientesMostrados = estadoTutorial.activo ? EXPEDIENTES_DEMO : expedientes;
  const analisisMostrado = estadoTutorial.activo ? analisisDemo : analisis;
  const indiceActualMostrado = estadoTutorial.activo ? indiceActualDemo : indiceActual;
  const terminadoMostrado = estadoTutorial.activo ? terminadoDemo : terminado;

  const iniciarTutorial = useCallback(() => {
    reiniciarDemo();
    dispatchTutorial('iniciar');
  }, [reiniciarDemo]);

  const terminarTutorial = useCallback(() => {
    // `activo` y `sesion` cambian juntos en un solo dispatch: lo que decide
    // qué ve la persona (vista real + bandeja remontada) queda resuelto de
    // una vez. `reiniciarDemo` aparte solo limpia el subsistema del tutorial
    // (nunca se lee una vez `activo` es false, así que su orden no importa).
    dispatchTutorial('terminar');
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

      {estadoTutorial.activo && (
        <div className="flex items-center justify-center gap-1.5 bg-accent/20 px-4 py-1.5 text-center text-xs font-semibold text-ink">
          <GraduationCap className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          Modo tutorial · datos de prueba
        </div>
      )}

      <main className="mx-auto grid w-full max-w-6xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[320px_1fr]">
        <PanelSidebar
          expedientesActuales={expedientesMostrados}
          onExpedientesCargados={estadoTutorial.activo ? () => {} : agregarExpedientes}
        />
        <AnimatePresence mode="wait">
          <motion.div key={vista} initial="oculto" animate="visible" exit="oculto" variants={variantesVista}>
            {vista === 'bandeja' ? (
              <PanelExpedienteList
                key={estadoTutorial.sesion}
                expedientes={expedientesMostrados}
                onQuitar={estadoTutorial.activo ? () => {} : quitarExpediente}
                onReclasificar={estadoTutorial.activo ? () => {} : reclasificar}
                onAnalizar={() =>
                  estadoTutorial.activo ? iniciarDemo(EXPEDIENTES_DEMO, VELOCIDAD_TUTORIAL) : iniciar(expedientesListos)
                }
                // Los datos del tutorial no tienen archivos en el servidor: no se ofrece el visor.
                onVer={estadoTutorial.activo ? undefined : setDocumentoParaVer}
              />
            ) : (
              <ValidationView
                analisis={analisisMostrado}
                indiceActual={indiceActualMostrado}
                terminado={terminadoMostrado}
                onReiniciar={estadoTutorial.activo ? () => {} : reiniciar}
                onVerArchivos={
                  estadoTutorial.activo
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

      {estadoTutorial.activo && (
        <Tutorial activo={estadoTutorial.activo} contexto={contextoTutorial} onTerminar={terminarTutorial} />
      )}
    </div>
  );
}
