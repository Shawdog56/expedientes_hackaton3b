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

/**
 * Tiendas alrededor del inmueble de `UBICACION_EJEMPLO` (shared/mockResults.ts).
 * Distancias aproximadas: ~300 m, ~650 m, ~850 m, ~1.5 km, ~1.8 km y ~2.6 km,
 * para que los radios de 500 m / 1 km / 2 km muestren resultados distintos.
 */
export const TIENDAS_EJEMPLO: TiendaCompetencia[] = [
  { id: 'oxxo-1', cadena: 'OXXO', nombre: 'OXXO Insurgentes Sur', lat: 19.3791, lng: -99.1642 },
  { id: 'neto-1', cadena: 'Neto', nombre: 'Neto Del Valle', lat: 19.37146, lng: -99.1663 },
  { id: 'soriana-1', cadena: 'Soriana Express', nombre: 'Soriana Express Nápoles', lat: 19.3773, lng: -99.15821 },
  { id: 'bodega-1', cadena: 'Bodega Aurrera Express', nombre: 'Bodega Aurrera Express Roma', lat: 19.38683, lng: -99.1764 },
  { id: 'oxxo-2', cadena: 'OXXO', nombre: 'OXXO Nápoles', lat: 19.36598, lng: -99.17829 },
  { id: 'soriana-2', cadena: 'Soriana Express', nombre: 'Soriana Express Condesa', lat: 19.35394, lng: -99.1663 },
];
