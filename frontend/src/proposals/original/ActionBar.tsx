import { Loader2, Sparkles } from 'lucide-react';

interface Props {
  disabled: boolean;
  cargando: boolean;
  onAnalizar: () => void;
}

export function ActionBar({ disabled, cargando, onAnalizar }: Props) {
  return (
    <div className="flex justify-end">
      <button
        type="button"
        onClick={onAnalizar}
        disabled={disabled || cargando}
        className="inline-flex items-center gap-2 rounded-lg bg-brand px-5 py-2.5 font-medium text-white transition-colors hover:bg-brand-dark disabled:cursor-not-allowed disabled:bg-border disabled:text-muted"
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
    </div>
  );
}
