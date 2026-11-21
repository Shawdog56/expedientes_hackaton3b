const RADIO_TIERRA_METROS = 6371000;

function aRadianes(grados: number): number {
  return (grados * Math.PI) / 180;
}

/** Distancia en metros entre dos coordenadas usando la fórmula de haversine. */
export function distanciaHaversineMetros(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLat = aRadianes(lat2 - lat1);
  const dLng = aRadianes(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(aRadianes(lat1)) * Math.cos(aRadianes(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return RADIO_TIERRA_METROS * c;
}
