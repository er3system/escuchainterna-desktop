import { Building2, Eye, ShieldCheck, Stethoscope } from 'lucide-react';
import {
  parsePermissionPresets,
  PERMISSION_PRESETS_KEY,
} from '@/contexts/identity/application/admin-save-permission-presets/AdminSavePermissionPresets';
import { createAdminUseCases } from '@/contexts/identity/infrastructure/createAdminUseCases';
import { Card, PageHeader } from '@/components/ui';
import { requireAdmin } from '../requireAdmin';
import { PresetsEditor } from './PresetsEditor';

const ROLES = [
  {
    icon: ShieldCheck,
    name: 'admin',
    title: 'Administración de la plataforma',
    who: 'El dueño de la plataforma.',
    access: 'Accede a /admin y a toda la aplicación. Crea cuentas de cualquier rol sin paywall.',
  },
  {
    icon: Building2,
    name: 'org_master',
    title: 'Perfil maestro de organización',
    who: 'La cuenta maestra de una empresa, universidad o clínica.',
    access: 'Accede a /organizacion (miembros, supervisión, branding) además de su consulta normal.',
  },
  {
    icon: Eye,
    name: 'professor',
    title: 'Supervisión académica',
    who: 'Supervisor académico dentro de una organización.',
    access:
      'Accede a /supervision (solo lectura de sus supervisados, sin configuración de pagos) y a su consulta si la tiene.',
  },
  {
    icon: Stethoscope,
    name: 'psychologist',
    title: 'Psicólogo/a',
    who: 'Profesional individual o miembro de una organización.',
    access: 'La aplicación normal: agenda, pacientes, expediente, pagos, mensajes, marketing y biblioteca.',
  },
];

export default async function AdminRolesPage() {
  await requireAdmin();
  const presets = parsePermissionPresets(await createAdminUseCases().settings.get(PERMISSION_PRESETS_KEY)).map(
    (preset) => ({ name: preset.name, permissions: { ...preset.permissions } }),
  );

  return (
    <div>
      <PageHeader
        title="Roles y permisos"
        subtitle="Los roles de plataforma son fijos; las plantillas de permisos se reutilizan al crear miembros de organización"
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {ROLES.map(({ icon: Icon, name, title, who, access }) => (
          <Card key={name}>
            <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-primary-light text-primary">
              <Icon size={18} />
            </span>
            <p className="text-sm font-semibold text-ink">{title}</p>
            <p className="mt-0.5 text-xs font-medium text-ink-soft">
              <code className="rounded bg-bg px-1.5 py-0.5">{name}</code>
            </p>
            <p className="mt-2 text-xs text-ink-soft">{who}</p>
            <p className="mt-1.5 text-xs text-ink-soft">{access}</p>
          </Card>
        ))}
      </div>

      <Card>
        <h2 className="text-base font-semibold text-ink">Plantillas de permisos de membresía</h2>
        <p className="mb-4 mt-1 text-sm text-ink-soft">
          Se guardan en la configuración de plataforma (clave <code>permission_presets</code>) y aparecen como
          punto de partida al crear usuarios con organización en la sección Cuentas.
        </p>
        <PresetsEditor initialPresets={presets} />
      </Card>
    </div>
  );
}
