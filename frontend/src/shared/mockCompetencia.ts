import { UBICACION_EJEMPLO } from './mockResults';

/** Coincide con los nombres de archivo en src/assets/cadenas/*.png */
export type Cadena = 'oxxo' | 'neto' | 'bodega' | 'soriana';

export interface InfoCadena {
  id: Cadena;
  nombre: string;
  color: string;
}

/** Colores de ejemplo por cadena, usados solo en el mapa (no son tokens de marca 3B). */
export const CADENAS: Record<Cadena, InfoCadena> = {
  oxxo: { id: 'oxxo', nombre: 'OXXO', color: '#D32F2F' },
  neto: { id: 'neto', nombre: 'Neto', color: '#F39200' },
  bodega: { id: 'bodega', nombre: 'Bodega Aurrera Express', color: '#0054A6' },
  soriana: { id: 'soriana', nombre: 'Soriana Express', color: '#8E2384' },
};

export interface TiendaCompetencia {
  id: string;
  cadena: Cadena;
  nombre: string;
  lat: number;
  lng: number;
}

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
 * la dirección. Distancias: ~300 m, ~650 m, ~850 m, ~1.5 km, ~1.8 km, ~2.3 km,
 * ~2.6 km y ~3.5 km, así los radios de 500 m / 1 km / 3 km muestran
 * resultados distintos (la última siempre queda fuera, incluso a 3 km).
 */
export const TIENDAS_EJEMPLO: TiendaCompetencia[] = [
  { id: 'oxxo-1', cadena: 'oxxo', nombre: 'OXXO Insurgentes Sur', ...desplazar(200, 220) },
  { id: 'neto-1', cadena: 'neto', nombre: 'Neto Del Valle', ...desplazar(-650, 0) },
  { id: 'soriana-1', cadena: 'soriana', nombre: 'Soriana Express Nápoles', ...desplazar(0, 850) },
  { id: 'bodega-1', cadena: 'bodega', nombre: 'Bodega Aurrera Express Roma', ...desplazar(1060, -1060) },
  { id: 'oxxo-2', cadena: 'oxxo', nombre: 'OXXO Nápoles', ...desplazar(-1270, -1270) },
  { id: 'bodega-2', cadena: 'bodega', nombre: 'Bodega Aurrera Express Condesa', ...desplazar(1900, -1300) },
  { id: 'soriana-2', cadena: 'soriana', nombre: 'Soriana Express Condesa', ...desplazar(-2600, 0) },
  { id: 'neto-2', cadena: 'neto', nombre: 'Neto Roma Norte', ...desplazar(0, -3500) },
];

/**
 * Logos opcionales por cadena (src/assets/cadenas/<id>.png). Si una cadena
 * no tiene archivo, el pin usa su inicial. Resuelto en un solo lugar.
 */
const modulosLogos = import.meta.glob<{ default: string }>('../assets/cadenas/*.png', { eager: true });

function idDesdeRuta(ruta: string): string {
  return (ruta.split('/').pop() ?? '').replace(/\.png$/, '');
}

export const LOGOS_CADENA: Partial<Record<Cadena, string>> = Object.entries(modulosLogos).reduce(
  (acumulado, [ruta, modulo]) => {
    acumulado[idDesdeRuta(ruta) as Cadena] = modulo.default;
    return acumulado;
  },
  {} as Partial<Record<Cadena, string>>,
);
