import { useState } from 'react';
import { ActionBar } from './components/ActionBar';
import { ExpedienteList } from './components/ExpedienteList';
import { Header } from './components/Header';
import { UploadZone } from './components/UploadZone';
import {
  ErrorValidacion,
  eliminarExpediente,
  reclasificarDocumento,
  subirExpediente,
  type ExpedienteServidor,
} from './api/expedientes';
import type { Expediente, TipoDocumental } from './types/expediente';
import { esArchivoPermitido } from './utils/tiposArchivo';

function datosDelServidor(resultado: ExpedienteServidor): Partial<Expediente> {
  return {
    estado: 'validado',
    idServidor: resultado.id,
    documentos: resultado.documentos,
    tiposFaltantes: resultado.tipos_faltantes,
    tiposDuplicados: resultado.tipos_duplicados,
  };
}

function App() {
  const [expedientes, setExpedientes] = useState<Expediente[]>([]);
  const [analizando, setAnalizando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  const actualizarExpediente = (id: string, cambios: Partial<Expediente>) => {
    setExpedientes((actuales) =>
      actuales.map((expediente) => (expediente.id === id ? { ...expediente, ...cambios } : expediente)),
    );
  };

  const validarExpediente = async (expediente: Expediente) => {
    const hayArchivosParaSubir = expediente.archivos.some(
      (archivo) => archivo.file && esArchivoPermitido(archivo.nombre),
    );
    if (!hayArchivosParaSubir) {
      actualizarExpediente(expediente.id, {
        estado: 'error',
        error: 'No contiene archivos PDF ni .zip',
      });
      return;
    }

    try {
      const resultado = await subirExpediente(expediente);
      actualizarExpediente(expediente.id, {
        ...datosDelServidor(resultado),
        rechazados: [...expediente.rechazados, ...resultado.rechazados],
      });
    } catch (error) {
      const esValidacion = error instanceof ErrorValidacion;
      actualizarExpediente(expediente.id, {
        estado: 'error',
        error: error instanceof Error ? error.message : 'No se pudo validar el expediente',
        rechazados: [...expediente.rechazados, ...(esValidacion ? error.rechazados : [])],
      });
    }
  };

  const agregarExpedientes = (nuevos: Expediente[]) => {
    setAviso(null);
    setExpedientes((actuales) => [...actuales, ...nuevos]);
    nuevos.forEach(validarExpediente);
  };

  const reclasificar = async (id: string, documentoId: string, tipo: TipoDocumental | null) => {
    try {
      const resultado = await reclasificarDocumento(documentoId, tipo);
      actualizarExpediente(id, datosDelServidor(resultado));
    } catch (error) {
      setAviso(error instanceof Error ? error.message : 'No se pudo reclasificar el documento');
    }
  };

  const quitarExpediente = (id: string) => {
    const expediente = expedientes.find((item) => item.id === id);
    if (expediente?.idServidor) void eliminarExpediente(expediente.idServidor);
    setExpedientes((actuales) => actuales.filter((item) => item.id !== id));
  };

  const expedientesValidos = expedientes.filter(
    (expediente) => expediente.estado === 'validado' && expediente.documentos.length > 0,
  );
  const validando = expedientes.some((expediente) => expediente.estado === 'validando');

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
        <ExpedienteList
          expedientes={expedientes}
          onQuitar={quitarExpediente}
          onReclasificar={reclasificar}
        />
        <ActionBar
          disabled={expedientesValidos.length === 0 || validando}
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
