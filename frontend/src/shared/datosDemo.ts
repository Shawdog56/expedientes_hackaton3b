import type { Expediente } from './types/expediente';

/**
 * Expedientes fijos para el tutorial guiado. El orden importa: coincide con
 * `obtenerEscenario` en `mockResults.ts` (índice 0 = superficie que no
 * coincide, índice 1 = Uso de Suelo faltante), porque `useSimulatedAnalysis`
 * elige el escenario de cada expediente por su posición en el lote.
 */
export const EXPEDIENTES_DEMO: Expediente[] = [
  {
    id: 'tutorial-1',
    nombre: 'Av. Insurgentes Sur 1457',
    origen: 'carpeta',
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
  },
  {
    id: 'tutorial-2',
    nombre: 'Paseo de la Reforma 2200',
    origen: 'zip',
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
  },
];
