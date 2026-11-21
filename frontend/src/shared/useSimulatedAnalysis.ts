import { useCallback, useEffect, useRef, useState } from 'react';
import type { Expediente } from './types/expediente';
import {
  ETAPAS,
  REGLAS_VALIDACION,
  resultadoRegla,
  TIPO_DOCUMENTAL_API,
  type Etapa,
  type EstadoValidacion,
  type TipoDocumentalId,
} from './validationRules';

const DURACION_ETAPA_MS = 600;
const DURACION_PUNTO_MS = 400;

export interface EstadoRegla {
  id: string;
  etiqueta: string;
  estado: EstadoValidacion;
}

export interface DocumentoAnalisis {
  tipoId: TipoDocumentalId;
  nombre: string;
  /** Archivo(s) del expediente clasificados con este tipo; null si el documento falta. */
  archivo: string | null;
  faltante: boolean;
  reglas: EstadoRegla[];
}

export type Dictamen = 'cumple' | 'revision' | 'no_cumple';

export interface ExpedienteAnalisis {
  expedienteId: string;
  nombre: string;
  etapaActual: Etapa | null;
  etapasCompletadas: Etapa[];
  progreso: number;
  documentoEnValidacion: TipoDocumentalId | null;
  documentos: DocumentoAnalisis[];
  dictamen: Dictamen | null;
}

function crearDocumentosIniciales(expediente: Expediente): DocumentoAnalisis[] {
  return REGLAS_VALIDACION.map((tipo) => {
    const encontrados = expediente.documentos.filter(
      (documento) => documento.tipo_documental === TIPO_DOCUMENTAL_API[tipo.id],
    );
    const [primero] = encontrados;
    return {
      tipoId: tipo.id,
      nombre: tipo.nombre,
      archivo: primero
        ? encontrados.length > 1
          ? `${primero.nombre} y ${encontrados.length - 1} más`
          : primero.nombre
        : null,
      faltante: !primero,
      reglas: tipo.reglas.map((regla) => ({ id: regla.id, etiqueta: regla.etiqueta, estado: 'pendiente' as const })),
    };
  });
}

function crearExpedienteAnalisis(expediente: Expediente): ExpedienteAnalisis {
  return {
    expedienteId: expediente.id,
    nombre: expediente.nombre,
    etapaActual: null,
    etapasCompletadas: [],
    progreso: 0,
    documentoEnValidacion: null,
    documentos: crearDocumentosIniciales(expediente),
    dictamen: null,
  };
}

const TODAS_LAS_ETAPAS = ETAPAS.map((etapa) => etapa.id);
const TOTAL_PUNTOS = REGLAS_VALIDACION.reduce((total, tipo) => total + tipo.reglas.length, 0);

/**
 * Simula el análisis multiagente de una lista de expedientes ya clasificados por el
 * backend, uno por uno, avanzando etapas y puntos de validación con temporizadores. Los
 * archivos mostrados y los documentos faltantes salen de la clasificación real; el resto
 * del resultado es de ejemplo hasta que exista el servicio de extracción.
 */
export function useSimulatedAnalysis() {
  const [analisis, setAnalisis] = useState<ExpedienteAnalisis[]>([]);
  const [indiceActual, setIndiceActual] = useState(-1);
  const [corriendo, setCorriendo] = useState(false);
  const [terminado, setTerminado] = useState(false);

  const timersRef = useRef<number[]>([]);
  const canceladoRef = useRef(false);

  const limpiarTimers = useCallback(() => {
    timersRef.current.forEach((id) => window.clearTimeout(id));
    timersRef.current = [];
  }, []);

  useEffect(
    () => () => {
      canceladoRef.current = true;
      limpiarTimers();
    },
    [limpiarTimers],
  );

  const esperar = useCallback(
    (ms: number) =>
      new Promise<void>((resolve) => {
        const id = window.setTimeout(() => {
          timersRef.current = timersRef.current.filter((pendiente) => pendiente !== id);
          resolve();
        }, ms);
        timersRef.current.push(id);
      }),
    [],
  );

  const actualizarExpediente = useCallback((indice: number, cambios: Partial<ExpedienteAnalisis>) => {
    setAnalisis((actuales) => actuales.map((item, i) => (i === indice ? { ...item, ...cambios } : item)));
  }, []);

  const actualizarRegla = useCallback(
    (indiceExpediente: number, tipoId: TipoDocumentalId, reglaId: string, estado: EstadoValidacion) => {
      setAnalisis((actuales) =>
        actuales.map((item, i) => {
          if (i !== indiceExpediente) return item;
          return {
            ...item,
            documentos: item.documentos.map((documento) =>
              documento.tipoId === tipoId
                ? {
                    ...documento,
                    reglas: documento.reglas.map((regla) => (regla.id === reglaId ? { ...regla, estado } : regla)),
                  }
                : documento,
            ),
          };
        }),
      );
    },
    [],
  );

  const iniciar = useCallback(
    async (expedientes: Expediente[]) => {
      if (expedientes.length === 0) return;

      canceladoRef.current = false;
      limpiarTimers();
      setAnalisis(expedientes.map(crearExpedienteAnalisis));
      setTerminado(false);
      setCorriendo(true);

      for (let indice = 0; indice < expedientes.length; indice += 1) {
        if (canceladoRef.current) return;
        setIndiceActual(indice);

        actualizarExpediente(indice, { etapaActual: 'clasificar', progreso: 5 });
        await esperar(DURACION_ETAPA_MS);
        if (canceladoRef.current) return;

        actualizarExpediente(indice, {
          etapasCompletadas: ['clasificar'],
          etapaActual: 'extraer',
          progreso: 20,
        });
        await esperar(DURACION_ETAPA_MS);
        if (canceladoRef.current) return;

        actualizarExpediente(indice, {
          etapasCompletadas: ['clasificar', 'extraer'],
          etapaActual: 'validar_reglas',
          progreso: 40,
        });

        let puntosResueltos = 0;
        for (const tipo of REGLAS_VALIDACION) {
          if (canceladoRef.current) return;
          actualizarExpediente(indice, { documentoEnValidacion: tipo.id });
          const documentoFaltante = !expedientes[indice].documentos.some(
            (documento) => documento.tipo_documental === TIPO_DOCUMENTAL_API[tipo.id],
          );

          for (const regla of tipo.reglas) {
            if (canceladoRef.current) return;
            actualizarRegla(indice, tipo.id, regla.id, 'validando');
            await esperar(DURACION_PUNTO_MS);
            if (canceladoRef.current) return;

            actualizarRegla(
              indice,
              tipo.id,
              regla.id,
              resultadoRegla(tipo.id, regla.id, documentoFaltante),
            );
            puntosResueltos += 1;
            actualizarExpediente(indice, { progreso: 40 + (puntosResueltos / TOTAL_PUNTOS) * 20 });
          }
        }
        actualizarExpediente(indice, { documentoEnValidacion: null });

        actualizarExpediente(indice, {
          etapasCompletadas: ['clasificar', 'extraer', 'validar_reglas'],
          etapaActual: 'validacion_cruzada',
          progreso: 60,
        });
        await esperar(DURACION_ETAPA_MS);
        if (canceladoRef.current) return;

        actualizarExpediente(indice, {
          etapasCompletadas: ['clasificar', 'extraer', 'validar_reglas', 'validacion_cruzada'],
          etapaActual: 'dictamen',
          progreso: 80,
        });
        await esperar(DURACION_ETAPA_MS);
        if (canceladoRef.current) return;

        setAnalisis((actuales) => {
          const expedienteActual = actuales[indice];
          const hayNoCumple = expedienteActual.documentos.some((documento) =>
            documento.reglas.some((regla) => regla.estado === 'no_cumple'),
          );
          const hayRevisar = expedienteActual.documentos.some((documento) =>
            documento.reglas.some((regla) => regla.estado === 'revisar'),
          );
          const dictamen: Dictamen = hayNoCumple ? 'no_cumple' : hayRevisar ? 'revision' : 'cumple';

          return actuales.map((item, i) =>
            i === indice
              ? { ...item, etapasCompletadas: TODAS_LAS_ETAPAS, etapaActual: null, progreso: 100, dictamen }
              : item,
          );
        });

        await esperar(DURACION_ETAPA_MS / 2);
        if (canceladoRef.current) return;
      }

      setIndiceActual(-1);
      setCorriendo(false);
      setTerminado(true);
    },
    [actualizarExpediente, actualizarRegla, esperar, limpiarTimers],
  );

  const reiniciar = useCallback(() => {
    canceladoRef.current = true;
    limpiarTimers();
    setAnalisis([]);
    setIndiceActual(-1);
    setCorriendo(false);
    setTerminado(false);
  }, [limpiarTimers]);

  return { analisis, indiceActual, corriendo, terminado, iniciar, reiniciar };
}
