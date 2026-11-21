import { useState } from 'react';
import { ActionBar } from './components/ActionBar';
import { ExpedienteList } from './components/ExpedienteList';
import { Header } from './components/Header';
import { UploadZone } from './components/UploadZone';
import type { Expediente } from './types/expediente';

function App() {
  const [expedientes, setExpedientes] = useState<Expediente[]>([]);
  const [analizando, setAnalizando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  const agregarExpedientes = (nuevos: Expediente[]) => {
    setAviso(null);
    setExpedientes((actuales) => [...actuales, ...nuevos]);
  };

  const quitarExpediente = (id: string) => {
    setExpedientes((actuales) => actuales.filter((expediente) => expediente.id !== id));
  };

  const analizarExpedientes = () => {
    setAviso(null);
    setAnalizando(true);
    setTimeout(() => {
      setAnalizando(false);
      setAviso('Análisis disponible próximamente');
    }, 2000);
  };

  return (
    <div className="min-h-screen bg-bg">
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

export default App;
