import { useState } from 'react';
import { useExpedientes } from '../../shared/hooks/useExpedientes';
import type { DocumentoParaVer } from '../../shared/types/expediente';
import { useSimulatedAnalysis } from '../../shared/useSimulatedAnalysis';
import { DocumentViewer } from './components/DocumentViewer';
import { ValidationView } from './components/ValidationView';
import { PanelExpedienteList } from './PanelExpedienteList';
import { PanelHeader } from './PanelHeader';
import { PanelSidebar } from './PanelSidebar';

export function PanelApp() {
  const { expedientes, expedientesListos, agregarExpedientes, quitarExpediente, reclasificar, aviso } =
    useExpedientes();
  const { analisis, indiceActual, corriendo, terminado, iniciar, reiniciar } = useSimulatedAnalysis();
  const [documentoParaVer, setDocumentoParaVer] = useState<DocumentoParaVer | null>(null);

  const enAnalisis = corriendo || terminado;

  return (
    <div className="min-h-screen bg-bg pb-20">
      <PanelHeader />
      <main className="mx-auto grid max-w-6xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[320px_1fr]">
        <PanelSidebar expedientesActuales={expedientes} onExpedientesCargados={agregarExpedientes} />
        {enAnalisis ? (
          <ValidationView
            analisis={analisis}
            indiceActual={indiceActual}
            terminado={terminado}
            onReiniciar={reiniciar}
            onVerArchivos={(documento) =>
              setDocumentoParaVer({ titulo: documento.nombre, archivos: documento.archivos })
            }
          />
        ) : (
          <PanelExpedienteList
            expedientes={expedientes}
            onQuitar={quitarExpediente}
            onReclasificar={reclasificar}
            onAnalizar={() => iniciar(expedientesListos)}
            onVer={setDocumentoParaVer}
          />
        )}
        {aviso && (
          <p role="status" className="text-sm font-medium text-error lg:col-start-2">
            {aviso}
          </p>
        )}
      </main>
      <DocumentViewer documento={documentoParaVer} onCerrar={() => setDocumentoParaVer(null)} />
    </div>
  );
}
