import { AnimatePresence, motion, type Variants } from 'motion/react';
import { useExpedientes } from '../../shared/hooks/useExpedientes';
import { CURVA_SALIDA, DURACION, useAnimaciones } from '../../shared/motion';
import { useSimulatedAnalysis } from '../../shared/useSimulatedAnalysis';
import { ValidationView } from './components/ValidationView';
import { Footer } from './Footer';
import { PanelExpedienteList } from './PanelExpedienteList';
import { PanelHeader } from './PanelHeader';
import { PanelSidebar } from './PanelSidebar';

export function PanelApp() {
  const { expedientes, agregarExpedientes, quitarExpediente } = useExpedientes();
  const { analisis, indiceActual, corriendo, terminado, iniciar, reiniciar } = useSimulatedAnalysis();
  const { reducido } = useAnimaciones();

  const vista = terminado ? 'resultados' : corriendo ? 'analisis' : 'bandeja';

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
      <PanelHeader vista={vista} onIrInicio={reiniciar} />
      <main className="mx-auto grid w-full max-w-6xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[320px_1fr]">
        <PanelSidebar expedientesActuales={expedientes} onExpedientesCargados={agregarExpedientes} />
        <AnimatePresence mode="wait">
          <motion.div key={vista} initial="oculto" animate="visible" exit="oculto" variants={variantesVista}>
            {vista === 'bandeja' ? (
              <PanelExpedienteList
                expedientes={expedientes}
                onQuitar={quitarExpediente}
                onAnalizar={() => iniciar(expedientes)}
              />
            ) : (
              <ValidationView
                analisis={analisis}
                indiceActual={indiceActual}
                terminado={terminado}
                onReiniciar={reiniciar}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </main>
      <Footer />
    </div>
  );
}
