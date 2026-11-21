import { PROPUESTAS, type PropuestaId } from '../types/propuesta';

interface Props {
  actual: PropuestaId;
  onCambiar: (propuesta: PropuestaId) => void;
}

export function PropuestaSelector({ actual, onCambiar }: Props) {
  return (
    <div
      role="navigation"
      aria-label="Selector de propuestas de diseño"
      className="fixed bottom-4 right-4 z-50 flex items-center gap-1 rounded-full border border-border bg-surface/95 p-1 shadow-lg backdrop-blur"
    >
      {PROPUESTAS.map((propuesta) => (
        <button
          key={propuesta.id}
          type="button"
          onClick={() => onCambiar(propuesta.id)}
          aria-pressed={actual === propuesta.id}
          className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
            actual === propuesta.id
              ? 'bg-brand text-white'
              : 'text-muted hover:bg-bg hover:text-ink'
          }`}
        >
          {propuesta.etiqueta}
        </button>
      ))}
    </div>
  );
}
