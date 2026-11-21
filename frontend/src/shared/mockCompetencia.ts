import { UBICACION_EJEMPLO } from './mockResults';

export type Cadena = 'OXXO' | 'Neto' | 'Bodega Aurrera Express' | 'Soriana Express';

export interface TiendaCompetencia {
  id: string;
  cadena: Cadena;
  nombre: string;
  lat: number;
  lng: number;
}

/** Colores de ejemplo por cadena, usados solo en el mapa (no son tokens de marca 3B). */
export const COLOR_CADENA: Record<Cadena, string> = {
  OXXO: '#D32F2F',
  Neto: '#F39200',
  'Bodega Aurrera Express': '#0054A6',
  'Soriana Express': '#8E2384',
};

const { lat: LAT_BASE, lng: LNG_BASE } = UBICACION_EJEMPLO.coordenadas;
const METROS_POR_GRADO_LAT = 111320;
const METROS_POR_GRADO_LNG = 111320 * Math.cos((LAT_BASE * Math.PI) / 180);

/** Desplaza la coordenada del inmueble N metros al norte y E metros al este. */
function desplazar(metrosNorte: number, metrosEste: number): { lat: number; lng: number } {
  return {
    lat: LAT_BASE + metrosNorte / METROS_POR_GRADO_LAT,
    lng: LNG_BASE + metrosEste / METROS_POR_GRADO_LNG,
  };
}

/**
 * Tiendas generadas a partir de la coordenada del inmueble (`UBICACION_EJEMPLO`
 * en shared/mockResults.ts), para que siempre queden alrededor sin importar
 * la dirección. Distancias: ~300 m, ~650 m, ~850 m, ~1.5 km, ~1.8 km y ~2.6 km,
 * así los radios de 500 m / 1 km / 2 km muestran resultados distintos.
 */
export const TIENDAS_EJEMPLO: TiendaCompetencia[] = [
  { id: 'oxxo-1', cadena: 'OXXO', nombre: 'OXXO Insurgentes Sur', ...desplazar(200, 220) },
  { id: 'neto-1', cadena: 'Neto', nombre: 'Neto Del Valle', ...desplazar(-650, 0) },
  { id: 'soriana-1', cadena: 'Soriana Express', nombre: 'Soriana Express Nápoles', ...desplazar(0, 850) },
  { id: 'bodega-1', cadena: 'Bodega Aurrera Express', nombre: 'Bodega Aurrera Express Roma', ...desplazar(1060, -1060) },
  { id: 'oxxo-2', cadena: 'OXXO', nombre: 'OXXO Nápoles', ...desplazar(-1270, -1270) },
  { id: 'soriana-2', cadena: 'Soriana Express', nombre: 'Soriana Express Condesa', ...desplazar(-2600, 0) },
];
