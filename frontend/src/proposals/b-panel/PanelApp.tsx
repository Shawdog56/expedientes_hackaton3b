import { useExpedientes } from '../../shared/hooks/useExpedientes';
import { useSimulatedAnalysis } from '../../shared/useSimulatedAnalysis';
import { ValidationView } from './components/ValidationView';
import { PanelExpedienteList } from './PanelExpedienteList';
import { PanelHeader } from './PanelHeader';
import { PanelSidebar } from './PanelSidebar';

export function PanelApp() {
  const { expedientes, expedientesListos, agregarExpedientes, quitarExpediente, reclasificar, aviso } =
    useExpedientes();
  const { analisis, indiceActual, corriendo, terminado, iniciar, reiniciar } = useSimulatedAnalysis();

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
          />
        ) : (
          <PanelExpedienteList
            expedientes={expedientes}
            onQuitar={quitarExpediente}
            onReclasificar={reclasificar}
            onAnalizar={() => iniciar(expedientesListos)}
          />
        )}
        {aviso && (
          <p role="status" className="text-sm font-medium text-error lg:col-start-2">
            {aviso}
          </p>
        )}
      </main>
    </div>
  );
}
