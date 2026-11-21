import type { Circle as LeafletCircle } from 'leaflet';
import { Loader2, MapPin } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Circle, CircleMarker, MapContainer, Popup, TileLayer, useMap } from 'react-leaflet';
import { distanciaHaversineMetros } from '../../../shared/geo';
import { TESELAS_OSM, TESELAS_PRINCIPALES } from '../../../shared/mapTiles';
import { COLOR_CADENA, TIENDAS_EJEMPLO, type Cadena } from '../../../shared/mockCompetencia';
import { UBICACION_EJEMPLO } from '../../../shared/mockResults';

type RadioKm = 0.5 | 1 | 2;

const OPCIONES_RADIO: { valor: RadioKm; etiqueta: string }[] = [
  { valor: 0.5, etiqueta: '500 m' },
  { valor: 1, etiqueta: '1 km' },
  { valor: 2, etiqueta: '2 km' },
];

const LIMITE_ERRORES_TESELA = 3;
const TIEMPO_LIMITE_CARGA_MS = 8000;

function leerColorToken(variable: string, respaldo: string): string {
  if (typeof window === 'undefined') return respaldo;
  const valor = getComputedStyle(document.documentElement).getPropertyValue(variable).trim();
  return valor || respaldo;
}

/** Corrige el tamaño de Leaflet al montar y cuando el contenedor cambia de tamaño. */
function MapResizeFix() {
  const map = useMap();

  useEffect(() => {
    const contenedor = map.getContainer();

    const corregir = () => {
      requestAnimationFrame(() => map.invalidateSize());
    };

    corregir();

    const observer = new ResizeObserver(() => corregir());
    observer.observe(contenedor);

    return () => observer.disconnect();
  }, [map]);

  return null;
}

interface RadiusCircleProps {
  centro: [number, number];
  radioMetros: number;
  color: string;
}

/** Dibuja el círculo del radio y ajusta la vista para que quepa completo. */
function RadiusCircle({ centro, radioMetros, color }: RadiusCircleProps) {
  const map = useMap();
  const circuloRef = useRef<LeafletCircle>(null);

  useEffect(() => {
    const circulo = circuloRef.current;
    if (!circulo) return;
    map.fitBounds(circulo.getBounds(), { padding: [24, 24] });
  }, [map, radioMetros, centro]);

  return (
    <Circle
      ref={circuloRef}
      center={centro}
      radius={radioMetros}
      pathOptions={{ color, weight: 2, dashArray: '6 6', fillColor: color, fillOpacity: 0.06 }}
    />
  );
}

export function CompetitionTab() {
  const [radioKm, setRadioKm] = useState<RadioKm>(1);
  const [intento, setIntento] = useState(0);
  const [usarRespaldo, setUsarRespaldo] = useState(false);
  const [cargado, setCargado] = useState(false);
  const [fallo, setFallo] = useState(false);
  const erroresTeselaRef = useRef(0);

  const { direccion, fuente, coincide, coordenadas } = UBICACION_EJEMPLO;
  const colorBrand = useMemo(() => leerColorToken('--color-brand', '#EB1C24'), []);
  const centro = useMemo<[number, number]>(() => [coordenadas.lat, coordenadas.lng], [coordenadas]);

  const tiendasConDistancia = useMemo(
    () =>
      TIENDAS_EJEMPLO.map((tienda) => ({
        ...tienda,
        distancia: distanciaHaversineMetros(coordenadas.lat, coordenadas.lng, tienda.lat, tienda.lng),
      })),
    [coordenadas],
  );

  const radioMetros = radioKm * 1000;
  const tiendasEnRadio = tiendasConDistancia.filter((tienda) => tienda.distancia <= radioMetros);

  const porCadena = useMemo(() => {
    const mapa = new Map<Cadena, { cantidad: number; masCercana: number }>();
    for (const tienda of tiendasEnRadio) {
      const actual = mapa.get(tienda.cadena);
      if (!actual) {
        mapa.set(tienda.cadena, { cantidad: 1, masCercana: tienda.distancia });
      } else {
        mapa.set(tienda.cadena, {
          cantidad: actual.cantidad + 1,
          masCercana: Math.min(actual.masCercana, tienda.distancia),
        });
      }
    }
    return Array.from(mapa.entries()).sort((a, b) => a[1].masCercana - b[1].masCercana);
  }, [tiendasEnRadio]);

  const etiquetaRadio = OPCIONES_RADIO.find((opcion) => opcion.valor === radioKm)?.etiqueta ?? '';

  useEffect(() => {
    if (cargado) return;
    const id = window.setTimeout(() => setFallo(true), TIEMPO_LIMITE_CARGA_MS);
    return () => window.clearTimeout(id);
  }, [intento, cargado]);

  const manejarErrorTesela = () => {
    erroresTeselaRef.current += 1;
    if (erroresTeselaRef.current > LIMITE_ERRORES_TESELA) {
      setUsarRespaldo(true);
    }
  };

  const reintentar = () => {
    erroresTeselaRef.current = 0;
    setUsarRespaldo(false);
    setCargado(false);
    setFallo(false);
    setIntento((valor) => valor + 1);
  };

  const teselas = usarRespaldo ? TESELAS_OSM : TESELAS_PRINCIPALES;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4 shadow-sm sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-2.5">
          <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-brand" aria-hidden="true" />
          <div>
            <p className="font-medium text-ink">{direccion}</p>
            {coincide ? (
              <p className="mt-0.5 text-xs text-muted">
                Dirección tomada de {fuente} · coincide con los demás documentos
              </p>
            ) : (
              <p className="mt-0.5 text-xs text-warn">
                Ubicación aproximada: las direcciones no coinciden entre documentos
              </p>
            )}
          </div>
        </div>

        <div
          role="radiogroup"
          aria-label="Radio de búsqueda"
          className="flex shrink-0 gap-1 self-start rounded-full border border-border bg-bg p-1"
        >
          {OPCIONES_RADIO.map((opcion) => (
            <button
              key={opcion.valor}
              type="button"
              role="radio"
              aria-checked={radioKm === opcion.valor}
              onClick={() => setRadioKm(opcion.valor)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                radioKm === opcion.valor ? 'bg-ink text-white' : 'text-muted hover:text-ink'
              }`}
            >
              {opcion.etiqueta}
            </button>
          ))}
        </div>
      </div>

      <div className="relative h-[420px] w-full overflow-hidden rounded-xl border border-border">
        <MapContainer
          key={intento}
          center={centro}
          zoom={15}
          scrollWheelZoom={false}
          preferCanvas
          className="h-full w-full"
        >
          <TileLayer
            key={usarRespaldo ? 'osm' : 'carto'}
            url={teselas.url}
            attribution={teselas.attribution}
            updateWhenIdle
            keepBuffer={2}
            eventHandlers={{
              load: () => setCargado(true),
              tileerror: manejarErrorTesela,
            }}
          />

          <RadiusCircle centro={centro} radioMetros={radioMetros} color={colorBrand} />

          {tiendasEnRadio.map((tienda) => (
            <CircleMarker
              key={tienda.id}
              center={[tienda.lat, tienda.lng]}
              radius={8}
              pathOptions={{ color: '#FFFFFF', weight: 2, fillColor: COLOR_CADENA[tienda.cadena], fillOpacity: 1 }}
            >
              <Popup>
                {tienda.nombre} · {Math.round(tienda.distancia)} m
              </Popup>
            </CircleMarker>
          ))}

          <CircleMarker
            center={centro}
            radius={10}
            pathOptions={{ color: '#FFFFFF', weight: 3, fillColor: colorBrand, fillOpacity: 1 }}
          >
            <Popup>{direccion}</Popup>
          </CircleMarker>

          <MapResizeFix />
        </MapContainer>

        {!cargado && (
          <div className="absolute inset-0 z-[1000] flex flex-col items-center justify-center gap-2 bg-bg/90">
            {fallo ? (
              <>
                <p className="text-sm font-medium text-ink">No se pudo cargar el mapa</p>
                <button
                  type="button"
                  onClick={reintentar}
                  className="text-sm font-medium text-brand underline underline-offset-2 hover:no-underline"
                >
                  Reintentar
                </button>
              </>
            ) : (
              <>
                <Loader2 className="h-6 w-6 animate-spin text-brand motion-reduce:animate-none" aria-hidden="true" />
                <p className="text-sm text-muted">Cargando mapa…</p>
              </>
            )}
          </div>
        )}
      </div>

      <div className="rounded-xl border border-border bg-surface shadow-sm">
        <p className="border-b border-border px-4 py-3 text-sm font-semibold text-ink">
          {tiendasEnRadio.length} tienda{tiendasEnRadio.length === 1 ? '' : 's'} de autoservicio a {etiquetaRadio}
        </p>
        {porCadena.length === 0 ? (
          <p className="px-4 py-3 text-sm text-muted">No hay tiendas registradas dentro de este radio.</p>
        ) : (
          <ul className="divide-y divide-border">
            {porCadena.map(([cadena, info]) => (
              <li key={cadena} className="flex items-center gap-3 px-4 py-3">
                <span
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
                  style={{ backgroundColor: COLOR_CADENA[cadena] }}
                  aria-hidden="true"
                >
                  {cadena.charAt(0)}
                </span>
                <span className="flex-1 truncate text-sm font-medium text-ink">{cadena}</span>
                <span className="text-xs text-muted">más cercana a {Math.round(info.masCercana)} m</span>
                <span className="text-sm font-semibold text-ink">{info.cantidad}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="flex items-center justify-between gap-2 text-xs text-muted">
        <span>Información de contexto. No influye en el dictamen legal.</span>
        <span className="rounded-full border border-border bg-bg px-2 py-0.5">Datos de ejemplo</span>
      </p>
    </div>
  );
}
