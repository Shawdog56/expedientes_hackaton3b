import { Loader2, Sparkles } from 'lucide-react';

interface Props {
  disabled: boolean;
  cargando: boolean;
  aviso: string | null;
  onAnalizar: () => void;
}

export function CorporativaActionBar({ disabled, cargando, aviso, onAnalizar }: Props) {
  return (
    <section className="rounded-2xl border border-border bg-surface p-6 text-center shadow-sm sm:p-8">
      <h2 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">Paso 3</h2>
      <p className="mb-6 text-lg font-medium text-ink">Analiza el expediente</p>
      <button
        type="button"
        onClick={onAnalizar}
        disabled={disabled || cargando}
        className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-brand px-5 py-3 font-medium text-white transition-colors hover:bg-brand-dark disabled:cursor-not-allowed disabled:bg-border disabled:text-muted sm:w-auto sm:px-10"
      >
        {cargando ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            Analizando…
          </>
        ) : (
          <>
            <Sparkles className="h-4 w-4" aria-hidden="true" />
            Analizar expedientes
          </>
        )}
      </button>
      {aviso && (
        <p role="status" className="mt-4 text-sm font-medium text-muted">
          {aviso}
        </p>
      )}
    </section>
  );
}
