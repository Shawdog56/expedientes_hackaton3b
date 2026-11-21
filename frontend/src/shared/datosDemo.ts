import type { DocumentoValidado, Expediente, TipoDocumental } from './types/expediente';

/** Documento ya clasificado, como lo devolvería el backend, para los datos del tutorial. */
function documentoDemo(expedienteId: string, nombre: string, tamano: number, tipo: TipoDocumental): DocumentoValidado {
  return {
    id: `${expedienteId}-${tipo}`,
    nombre,
    ruta: nombre,
    tamano,
    paginas: 1,
    formato: 'pdf',
    tipo_documental: tipo,
    estado_clasificacion: 'clasificado',
    fuente_clasificacion: 'nombre',
    agente: null,
    estado_extraccion: 'pendiente',
  };
}

/**
 * Expedientes fijos para el tutorial guiado. El análisis toma los documentos faltantes de la
 * clasificación (`documentos`), igual que con expedientes reales: el primero está completo y en el
 * segundo falta Uso de Suelo. El orden importa porque `obtenerEscenario` en `mockResults.ts` elige
 * el resto del resultado de ejemplo por la posición en el lote. No tienen `idServidor`: no existen
 * en el servidor, así que el tutorial no ofrece el visor de archivos.
 */
export const EXPEDIENTES_DEMO: Expediente[] = [
  {
    id: 'tutorial-1',
    nombre: 'Av. Insurgentes Sur 1457',
    origen: 'carpeta',
    estado: 'validado',
    archivos: [
      { nombre: 'escritura_publica_84521.pdf', ruta: 'tutorial-1/escritura_publica_84521.pdf', tamano: 420_000 },
      { nombre: 'boleta_predial_2026.pdf', ruta: 'tutorial-1/boleta_predial_2026.pdf', tamano: 180_000 },
      {
        nombre: 'alineamiento_numero_oficial.pdf',
        ruta: 'tutorial-1/alineamiento_numero_oficial.pdf',
        tamano: 210_000,
      },
      { nombre: 'constancia_uso_suelo.pdf', ruta: 'tutorial-1/constancia_uso_suelo.pdf', tamano: 195_000 },
    ],
    tamanoTotal: 420_000 + 180_000 + 210_000 + 195_000,
    documentos: [
      documentoDemo('tutorial-1', 'escritura_publica_84521.pdf', 420_000, 'escrituras'),
      documentoDemo('tutorial-1', 'boleta_predial_2026.pdf', 180_000, 'predial'),
      documentoDemo('tutorial-1', 'alineamiento_numero_oficial.pdf', 210_000, 'alineamiento_numero_oficial'),
      documentoDemo('tutorial-1', 'constancia_uso_suelo.pdf', 195_000, 'uso_suelo'),
    ],
    rechazados: [],
    tiposFaltantes: [],
    tiposDuplicados: [],
  },
  {
    id: 'tutorial-2',
    nombre: 'Paseo de la Reforma 2200',
    origen: 'zip',
    estado: 'validado',
    archivos: [
      { nombre: 'escritura_publica_90213.pdf', ruta: 'tutorial-2/escritura_publica_90213.pdf', tamano: 390_000 },
      { nombre: 'boleta_predial_2026.pdf', ruta: 'tutorial-2/boleta_predial_2026.pdf', tamano: 170_000 },
      {
        nombre: 'alineamiento_numero_oficial.pdf',
        ruta: 'tutorial-2/alineamiento_numero_oficial.pdf',
        tamano: 205_000,
      },
    ],
    tamanoTotal: 390_000 + 170_000 + 205_000,
    documentos: [
      documentoDemo('tutorial-2', 'escritura_publica_90213.pdf', 390_000, 'escrituras'),
      documentoDemo('tutorial-2', 'boleta_predial_2026.pdf', 170_000, 'predial'),
      documentoDemo('tutorial-2', 'alineamiento_numero_oficial.pdf', 205_000, 'alineamiento_numero_oficial'),
    ],
    rechazados: [],
    tiposFaltantes: ['uso_suelo'],
    tiposDuplicados: [],
  },
];
