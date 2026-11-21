import { useExpedientes } from '../../shared/hooks/useExpedientes';
import { useSimulatedAnalysis } from '../../shared/useSimulatedAnalysis';
import { ValidationView } from './components/ValidationView';
import { Footer } from './Footer';
import { PanelExpedienteList } from './PanelExpedienteList';
import { PanelHeader } from './PanelHeader';
import { PanelSidebar } from './PanelSidebar';

export function PanelApp() {
  const { expedientes, agregarExpedientes, quitarExpediente } = useExpedientes();
  const { analisis, indiceActual, corriendo, terminado, iniciar, reiniciar } = useSimulatedAnalysis();

  const enAnalisis = corriendo || terminado;

  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <PanelHeader />
      <main className="mx-auto grid w-full max-w-6xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[320px_1fr]">
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
            onAnalizar={() => iniciar(expedientes)}
          />
        )}
      </main>
      <Footer />
    </div>
  );
}
