import { useExpedientes } from '../../shared/hooks/useExpedientes';
import { ActionBar } from './ActionBar';
import { ExpedienteList } from './ExpedienteList';
import { Header } from './Header';
import { UploadZone } from './UploadZone';

export function OriginalApp() {
  const { expedientes, analizando, aviso, agregarExpedientes, quitarExpediente, analizarExpedientes } =
    useExpedientes();

  return (
    <div className="min-h-screen bg-bg pb-20">
      <Header />
      <main className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6">
        <UploadZone onExpedientesCargados={agregarExpedientes} />
        <ExpedienteList expedientes={expedientes} onQuitar={quitarExpediente} />
        <ActionBar
          disabled={expedientes.length === 0}
          cargando={analizando}
          onAnalizar={analizarExpedientes}
        />
        {aviso && (
          <p role="status" className="text-right text-sm font-medium text-muted">
            {aviso}
          </p>
        )}
      </main>
    </div>
  );
}
