import { useState } from 'react';
import {
  ErrorValidacion,
  eliminarExpediente,
  reclasificarDocumento,
  subirExpediente,
  type ExpedienteServidor,
} from '../../api/expedientes';
import type { Expediente, TipoDocumental } from '../types/expediente';
import { esExpedienteListo } from '../utils/expediente';
import { esArchivoPermitido } from '../utils/tiposArchivo';

function datosDelServidor(resultado: ExpedienteServidor): Partial<Expediente> {
  return {
    estado: 'validado',
    idServidor: resultado.id,
    documentos: resultado.documentos,
    tiposFaltantes: resultado.tipos_faltantes,
    tiposDuplicados: resultado.tipos_duplicados,
  };
}

/**
 * Estado de los expedientes cargados y su flujo contra la API: subir (el backend valida,
 * descomprime y clasifica), reclasificar manualmente y eliminar. Lo comparten todas las
 * propuestas de diseño; cada una solo decide cómo se pinta.
 */
export function useExpedientes() {
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
      actualizarExpediente(expediente.id, { estado: 'error', error: 'No contiene documentos PDF, JPG, PNG ni archivos .zip' });
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

  const expedientesListos = expedientes.filter(esExpedienteListo);
  const validando = expedientes.some((expediente) => expediente.estado === 'validando');

  // Marcador de las propuestas A, C y original: el análisis real llega con el servicio de extracción.
  const analizarExpedientes = () => {
    setAviso(null);
    setAnalizando(true);
    setTimeout(() => {
      setAnalizando(false);
      setAviso('Análisis disponible próximamente');
    }, 2000);
  };

  return {
    expedientes,
    expedientesListos,
    validando,
    analizando,
    aviso,
    agregarExpedientes,
    quitarExpediente,
    reclasificar,
    analizarExpedientes,
  };
}
