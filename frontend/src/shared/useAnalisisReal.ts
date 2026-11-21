import { useCallback, useEffect, useRef, useState } from 'react';
import { consultarAuditoria, iniciarAuditoria, type EstadoAuditoria } from '../api/expedientes';
import { dictamenDesdeVeredicto, documentosConResultado } from './resultadosReales';
import type { Expediente } from './types/expediente';
import { crearExpedienteAnalisis, type ExpedienteAnalisis } from './useSimulatedAnalysis';
import { ETAPAS, TIPO_DOCUMENTAL_API, type Etapa, type TipoDocumentalId } from './validationRules';

const INTERVALO_CONSULTA_MS = 2000;
const TODAS_LAS_ETAPAS = ETAPAS.map((etapa) => etapa.id);

const TIPO_POR_API = Object.fromEntries(
  Object.entries(TIPO_DOCUMENTAL_API).map(([tipoId, api]) => [api, tipoId]),
) as Record<string, TipoDocumentalId>;

/** Etapas ya completadas, etapa en curso y progreso según la etapa que reporta el backend. */
const AVANCE: Record<string, { completadas: Etapa[]; actual: Etapa; progreso: number }> = {
  extraer: { completadas: ['clasificar'], actual: 'extraer', progreso: 10 },
  validar_reglas: { completadas: ['clasificar', 'extraer'], actual: 'validar_reglas', progreso: 65 },
  validacion_cruzada: {
    completadas: ['clasificar', 'extraer', 'validar_reglas'],
    actual: 'validacion_cruzada',
    progreso: 80,
  },
  dictamen: {
    completadas: ['clasificar', 'extraer', 'validar_reglas', 'validacion_cruzada'],
    actual: 'dictamen',
    progreso: 95,
  },
};

function conProgreso(actual: ExpedienteAnalisis, estado: EstadoAuditoria, expediente: Expediente): ExpedienteAnalisis {
  const avance = AVANCE[estado.etapa] ?? AVANCE.extraer;
  const enCurso = new Set(estado.documentos_en_curso);
  const fases = estado.documentos ?? [];
  const analizando = fases.filter((doc) => doc.fase === 'analizando').length;
  // El documento con el modelo cuenta medio: así la barra avanza durante las esperas largas.
  const progreso =
    estado.etapa === 'extraer' && estado.documentos_total > 0
      ? 10 + Math.round((50 * (estado.documentos_listos + analizando / 2)) / estado.documentos_total)
      : avance.progreso;
  const nombres = new Map(expediente.documentos.map((doc) => [doc.id, doc.nombre]));
  // Se resalta el documento que está con el modelo; si no hay, el que está en OCR.
  const resaltado =
    fases.find((doc) => doc.fase === 'analizando') ?? fases.find((doc) => doc.fase === 'leyendo');
  const documentoResaltado = expediente.documentos.find((doc) => doc.id === resaltado?.id);
  return {
    ...actual,
    etapasCompletadas: avance.completadas,
    etapaActual: avance.actual,
    progreso,
    progresoReal: {
      documentos: fases.map((doc) => ({ id: doc.id, nombre: nombres.get(doc.id) ?? 'Documento', fase: doc.fase })),
      listos: estado.documentos_listos,
      total: estado.documentos_total,
      delante: estado.en_cola_delante ?? 0,
      iniciadaEn: estado.iniciada_en,
    },
    documentoEnValidacion: documentoResaltado?.tipo_documental
      ? (TIPO_POR_API[documentoResaltado.tipo_documental] ?? null)
      : null,
    documentos: actual.documentos.map((documento) =>
      documento.archivos.some((archivo) => enCurso.has(archivo.id))
        ? { ...documento, reglas: documento.reglas.map((regla) => ({ ...regla, estado: 'validando' as const })) }
        : documento,
    ),
  };
}

/**
 * Análisis real de los expedientes: OCR, modelo de lenguaje y validación cruzada en el backend.
 * Misma interfaz que `useSimulatedAnalysis`, que queda solo para el tutorial. Los expedientes se
 * auditan uno tras otro: el modelo atiende una petición a la vez y así el progreso es claro.
 */
export function useAnalisisReal() {
  const [analisis, setAnalisis] = useState<ExpedienteAnalisis[]>([]);
  const [indiceActual, setIndiceActual] = useState(-1);
  const [corriendo, setCorriendo] = useState(false);
  const [terminado, setTerminado] = useState(false);
  // Cada inicio o reinicio crea una "generación"; una consulta de una generación vieja se descarta.
  const generacionRef = useRef(0);

  useEffect(
    () => () => {
      generacionRef.current += 1;
    },
    [],
  );

  const actualizar = useCallback(
    (indice: number, cambio: (actual: ExpedienteAnalisis) => ExpedienteAnalisis) => {
      setAnalisis((actuales) => actuales.map((item, i) => (i === indice ? cambio(item) : item)));
    },
    [],
  );

  const iniciar = useCallback(
    async (expedientes: Expediente[]) => {
      if (expedientes.length === 0) return;
      const generacion = ++generacionRef.current;
      const vigente = () => generacionRef.current === generacion;
      const esperar = (ms: number) => new Promise((resolver) => window.setTimeout(resolver, ms));

      setAnalisis(expedientes.map(crearExpedienteAnalisis));
      setTerminado(false);
      setCorriendo(true);

      for (let indice = 0; indice < expedientes.length; indice += 1) {
        if (!vigente()) return;
        const expediente = expedientes[indice];
        setIndiceActual(indice);

        const fallar = (mensaje: string) =>
          actualizar(indice, (actual) => ({ ...actual, error: mensaje, etapaActual: null, documentoEnValidacion: null }));

        if (!expediente.idServidor) {
          fallar('El expediente no se guardó en el servidor; vuelve a cargarlo.');
          continue;
        }

        try {
          let estado = await iniciarAuditoria(expediente.idServidor);
          while (estado.estado === 'en_proceso') {
            if (!vigente()) return;
            const instantanea = estado;
            actualizar(indice, (actual) => conProgreso(actual, instantanea, expediente));
            await esperar(INTERVALO_CONSULTA_MS);
            if (!vigente()) return;
            estado = await consultarAuditoria(expediente.idServidor);
          }
          if (!vigente()) return;

          const resultado = estado.resultado;
          if (estado.estado === 'completada' && resultado) {
            actualizar(indice, (actual) => ({
              ...actual,
              documentos: documentosConResultado(actual.documentos, resultado),
              dictamen: dictamenDesdeVeredicto(resultado.veredicto),
              resultadoReal: resultado,
              etapasCompletadas: TODAS_LAS_ETAPAS,
              etapaActual: null,
              documentoEnValidacion: null,
              progreso: 100,
            }));
          } else {
            fallar(estado.error ?? 'La auditoría no terminó.');
          }
        } catch (error) {
          if (vigente()) fallar(error instanceof Error ? error.message : 'No se pudo auditar el expediente.');
        }
      }

      if (!vigente()) return;
      setIndiceActual(-1);
      setCorriendo(false);
      setTerminado(true);
    },
    [actualizar],
  );

  const reiniciar = useCallback(() => {
    generacionRef.current += 1;
    setAnalisis([]);
    setIndiceActual(-1);
    setCorriendo(false);
    setTerminado(false);
  }, []);

  return { analisis, indiceActual, corriendo, terminado, iniciar, reiniciar };
}
