import { MODULOS } from '@/lib/modulos';

interface Props {
  moduloActivo: number;
  modulosCompletos: number[];
  onSeleccionar: (numero: number) => void;
}

export default function ModuloStepper({ moduloActivo, modulosCompletos, onSeleccionar }: Props) {
  return (
    <nav aria-label="Módulos del expediente" className="space-y-1">
      {MODULOS.map((modulo) => {
        const activo = modulo.numero === moduloActivo;
        const completo = modulosCompletos.includes(modulo.numero);

        return (
          <button
            key={modulo.numero}
            onClick={() => onSeleccionar(modulo.numero)}
            aria-current={activo ? 'step' : undefined}
            className={`w-full text-left px-3 py-2.5 rounded-md text-sm flex items-start gap-3 transition-colors ${
              activo ? 'bg-navy text-white' : 'hover:bg-navy-50 text-ink'
            }`}
          >
            <span
              className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] border ${
                activo
                  ? 'border-gold-400 text-gold-300'
                  : completo
                  ? 'border-gold-500 bg-gold-500 text-white'
                  : 'border-line text-ink/40'
              }`}
            >
              {completo ? '✓' : modulo.numero}
            </span>
            <span>
              <span className="block font-medium leading-tight">{modulo.titulo}</span>
              <span className={`block text-xs mt-0.5 ${activo ? 'text-navy-200' : 'text-ink/50'}`}>
                {modulo.descripcion}
              </span>
            </span>
          </button>
        );
      })}
    </nav>
  );
}
