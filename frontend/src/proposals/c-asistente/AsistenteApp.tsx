import { useState } from 'react';
import { useExpedientes } from '../../shared/hooks/useExpedientes';
import { AsistenteHeader } from './AsistenteHeader';
import { AsistentePaso1 } from './AsistentePaso1';
import { AsistentePaso2 } from './AsistentePaso2';
import { AsistentePaso3 } from './AsistentePaso3';
import { AsistenteStepper } from './AsistenteStepper';
import type { PasoAsistente } from './types';

export function AsistenteApp() {
  const { expedientes, analizando, aviso, agregarExpedientes, quitarExpediente, analizarExpedientes } =
    useExpedientes();
  const [paso, setPaso] = useState<PasoAsistente>(1);

  const analisisIniciado = analizando || aviso !== null;
  const pasoMaximoHabilitado: PasoAsistente = analisisIniciado ? 3 : expedientes.length > 0 ? 2 : 1;

  const continuarAPaso2 = () => setPaso(2);
  const volverAPaso1 = () => setPaso(1);
  const volverAPaso2 = () => setPaso(2);

  const manejarAnalizar = () => {
    setPaso(3);
    analizarExpedientes();
  };

  return (
    <div className="min-h-screen bg-bg pb-20">
      <AsistenteHeader />
      <AsistenteStepper pasoActual={paso} pasoMaximoHabilitado={pasoMaximoHabilitado} onIrAPaso={setPaso} />
      <main className="py-4">
        {paso === 1 && (
          <AsistentePaso1
            expedientesCount={expedientes.length}
            onExpedientesCargados={agregarExpedientes}
            onContinuar={continuarAPaso2}
          />
        )}
        {paso === 2 && (
          <AsistentePaso2
            expedientes={expedientes}
            onQuitar={quitarExpediente}
            onVolver={volverAPaso1}
            onAnalizar={manejarAnalizar}
          />
        )}
        {paso === 3 && <AsistentePaso3 cargando={analizando} aviso={aviso} onVolver={volverAPaso2} />}
      </main>
    </div>
  );
}
