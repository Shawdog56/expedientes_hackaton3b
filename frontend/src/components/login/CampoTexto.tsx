import type { InputHTMLAttributes, ReactNode } from 'react';

interface Props extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> {
  id: string;
  etiqueta: string;
  icono: ReactNode;
  enfocado: boolean;
  onEnfocar: () => void;
  onDesenfocar: () => void;
  derecha?: ReactNode;
}

export function CampoTexto({
  id,
  etiqueta,
  icono,
  enfocado,
  onEnfocar,
  onDesenfocar,
  derecha,
  ...inputProps
}: Props) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-muted">
        {etiqueta}
      </label>
      <div className="relative">
        <span
          className={`pointer-events-none absolute left-3 top-1/2 flex -translate-y-1/2 transition-colors ${
            enfocado ? 'text-brand' : 'text-muted'
          }`}
        >
          {icono}
        </span>
        <input
          id={id}
          onFocus={onEnfocar}
          onBlur={onDesenfocar}
          style={enfocado ? { boxShadow: '0 0 0 3px rgba(235, 28, 36, 0.15)' } : undefined}
          className={`w-full rounded-[10px] border py-3 pl-10 text-sm text-ink outline-none transition-[border-color,box-shadow] duration-200 ${
            enfocado ? 'border-brand' : 'border-gray-300'
          } ${derecha ? 'pr-10' : 'pr-3'}`}
          {...inputProps}
        />
        {derecha && <span className="absolute right-2 top-1/2 -translate-y-1/2">{derecha}</span>}
      </div>
    </div>
  );
}
