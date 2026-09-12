import { ReactNode } from 'react';
import { signOut } from 'next-auth/react';

interface Props {
  titulo: string;
  subtitulo?: string;
  nombreUsuario: string;
  permisos: string[];
  children: ReactNode;
  accion?: ReactNode;
}

const NAV_LINKS = [
  { href: '/panel', label: 'Expedientes', permiso: null },
  { href: '/panel/clientes', label: 'Clientes', permiso: null },
  { href: '/panel/usuarios', label: 'Usuarios', permiso: 'administrar_usuarios' },
  { href: '/panel/roles', label: 'Roles y permisos', permiso: 'administrar_configuracion' },
  { href: '/panel/plantillas-tramite', label: 'Plantillas de trámite', permiso: 'administrar_configuracion' },
  { href: '/panel/plantillas-cuestionario', label: 'Plantillas de cuestionario', permiso: 'administrar_configuracion' },
  { href: '/panel/bitacora', label: 'Bitácora', permiso: 'administrar_usuarios' },
  { href: '/panel/perfil', label: 'Mi perfil', permiso: null },
];

export default function PanelLayout({ titulo, subtitulo, nombreUsuario, permisos, children, accion }: Props) {
  const links = NAV_LINKS.filter((l) => !l.permiso || permisos.includes(l.permiso));

  return (
    <div className="min-h-screen bg-canvas">
      <header className="bg-navy text-white">
        <div className="px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/logo-cbs.png" alt="Cross-Border Solutions" className="h-10 w-auto" />
            <div>
              <p className="font-display text-lg leading-tight">Cross-Border Solutions</p>
              <p className="text-xs text-navy-200">Panel interno</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm">{nombreUsuario}</p>
            <button onClick={() => signOut({ callbackUrl: '/login' })} className="text-xs text-navy-200 hover:text-white">
              Cerrar sesión
            </button>
          </div>
        </div>
        <nav className="px-6 flex gap-1 border-t border-white/10 overflow-x-auto">
          {links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-xs uppercase tracking-wide text-navy-200 hover:text-white hover:bg-white/5 px-4 py-3 whitespace-nowrap transition-colors"
            >
              {link.label}
            </a>
          ))}
        </nav>
      </header>

      <main className="p-6 lg:p-10">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="font-display text-2xl text-navy">{titulo}</h1>
            {subtitulo && <p className="text-sm text-ink/60 mt-1">{subtitulo}</p>}
          </div>
          {accion}
        </div>
        <div className="mt-6">{children}</div>
      </main>
    </div>
  );
}
