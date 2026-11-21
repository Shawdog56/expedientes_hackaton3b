export interface FuenteTeselas {
  url: string;
  attribution: string;
}

const CARTO_KEY = import.meta.env.VITE_CARTO_KEY;

/** OSM estándar: siempre funciona sin configuración, es el respaldo garantizado. */
export const TESELAS_OSM: FuenteTeselas = {
  url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  attribution: '&copy; OpenStreetMap contributors',
};

/**
 * Fuente principal: CARTO Voyager si hay `VITE_CARTO_KEY` configurada
 * (ver frontend/.env.example); si no, cae directo a OSM para no mostrar
 * la marca de agua "API KEY REQUIRED" de CARTO sin key.
 */
export const TESELAS_PRINCIPALES: FuenteTeselas = CARTO_KEY
  ? {
      url: `https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png?key=${CARTO_KEY}`,
      attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
    }
  : TESELAS_OSM;
