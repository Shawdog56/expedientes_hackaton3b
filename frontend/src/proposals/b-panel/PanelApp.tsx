import { AnimatePresence, motion, type Variants } from 'motion/react';
import { useState } from 'react';
import { useExpedientes } from '../../shared/hooks/useExpedientes';
import { CURVA_SALIDA, DURACION, useAnimaciones } from '../../shared/motion';
import type { DocumentoParaVer } from '../../shared/types/expediente';
import { useSimulatedAnalysis } from '../../shared/useSimulatedAnalysis';
import { DocumentViewer } from './components/DocumentViewer';
import { ValidationView } from './components/ValidationView';
import { Footer } from './Footer';
import { PanelExpedienteList } from './PanelExpedienteList';
import { PanelHeader } from './PanelHeader';
import { PanelSidebar } from './PanelSidebar';

export function PanelApp() {
  const { expedientes, expedientesListos, agregarExpedientes, quitarExpediente, reclasificar, aviso } =
    useExpedientes();
  const { analisis, indiceActual, corriendo, terminado, iniciar, reiniciar } = useSimulatedAnalysis();
  const { reducido } = useAnimaciones();
  const [documentoParaVer, setDocumentoParaVer] = useState<DocumentoParaVer | null>(null);

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
                onReclasificar={reclasificar}
                onAnalizar={() => iniciar(expedientesListos)}
                onVer={setDocumentoParaVer}
              />
            ) : (
              <ValidationView
                analisis={analisis}
                indiceActual={indiceActual}
                terminado={terminado}
                onReiniciar={reiniciar}
                onVerArchivos={(documento) =>
                  setDocumentoParaVer({ titulo: documento.nombre, archivos: documento.archivos })
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
    </div>
  );
}
