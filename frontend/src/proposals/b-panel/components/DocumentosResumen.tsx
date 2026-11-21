interface Props {
  archivosNoReconocidos: string[];
}

/** Nota de archivos que no corresponden a ningún tipo documental; va debajo de la tarjeta de dictamen. */
export function DocumentosResumen({ archivosNoReconocidos }: Props) {
  if (archivosNoReconocidos.length === 0) return null;

  return (
    <p className="text-xs text-muted">
      {archivosNoReconocidos.length} archivo{archivosNoReconocidos.length === 1 ? '' : 's'} no reconocido
      {archivosNoReconocidos.length === 1 ? '' : 's'}: {archivosNoReconocidos.join(', ')}
    </p>
  );
}
