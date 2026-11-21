import { useExpedientes } from '../../shared/hooks/useExpedientes';
import { CorporativaActionBar } from './CorporativaActionBar';
import { CorporativaExpedienteList } from './CorporativaExpedienteList';
import { CorporativaHeader } from './CorporativaHeader';
import { CorporativaUploadZone } from './CorporativaUploadZone';

export function CorporativaApp() {
  const { expedientes, analizando, aviso, agregarExpedientes, quitarExpediente, analizarExpedientes } =
    useExpedientes();

  return (
    <div className="min-h-screen bg-bg pb-20">
      <CorporativaHeader />
      <main className="mx-auto max-w-3xl space-y-6 px-4 py-8 sm:px-6">
        <CorporativaUploadZone onExpedientesCargados={agregarExpedientes} />
        <CorporativaExpedienteList expedientes={expedientes} onQuitar={quitarExpediente} />
        <CorporativaActionBar
          disabled={expedientes.length === 0}
          cargando={analizando}
          aviso={aviso}
          onAnalizar={analizarExpedientes}
        />
      </main>
    </div>
  );
}
