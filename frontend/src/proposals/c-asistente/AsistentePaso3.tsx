import { ArrowLeft, Loader2, Sparkles } from 'lucide-react';

interface Props {
  cargando: boolean;
  aviso: string | null;
  onVolver: () => void;
}

export function AsistentePaso3({ cargando, aviso, onVolver }: Props) {
  return (
    <div className="mx-auto max-w-md px-4 text-center sm:px-6">
      <div className="rounded-xl border border-border bg-surface px-6 py-12 shadow-sm">
        {cargando ? (
          <>
            <Loader2 className="mx-auto mb-4 h-10 w-10 animate-spin text-brand" aria-hidden="true" />
            <p className="font-medium text-ink">Analizando expedientes…</p>
            <p className="mt-1 text-sm text-muted">Esto puede tomar unos segundos.</p>
          </>
        ) : (
          <>
            <Sparkles className="mx-auto mb-4 h-10 w-10 text-brand" aria-hidden="true" />
            <p role="status" className="font-medium text-ink">
              {aviso ?? 'Análisis disponible próximamente'}
            </p>
            <p className="mt-1 text-sm text-muted">El equipo multiagente estará disponible más adelante.</p>
          </>
        )}
      </div>
      <button
        type="button"
        onClick={onVolver}
        className="mt-4 inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 font-medium text-ink transition-colors hover:bg-bg"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Volver a revisar
      </button>
    </div>
  );
}
