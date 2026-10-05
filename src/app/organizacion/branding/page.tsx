import { Card, PageHeader } from '@/components/ui';
import { requireOrgMaster, getOrganization } from '../orgData';
import { BrandingForm } from './BrandingForm';
import { FreeServiceToggle } from './FreeServiceToggle';
import { PatientOwnershipToggle } from './PatientOwnershipToggle';
import { AccessPolicyControl } from './AccessPolicyControl';

export default async function BrandingPage() {
  const { organization } = await requireOrgMaster();
  // Releemos para reflejar el último logo/slug/servicio sin costo tras guardar.
  const current = (await getOrganization(organization.id)) ?? organization;

  return (
    <div>
      <PageHeader
        title="Ajustes y branding"
        subtitle="Personaliza el logo, el identificador y la política de costo con la que tu equipo y tus pacientes verán a la organización."
      />
      <Card className="max-w-2xl">
        <BrandingForm
          organizationId={current.id}
          organizationName={current.name}
          currentSlug={current.slug}
          hasLogo={Boolean(current.logoPath)}
          // El nombre del archivo cambia en cada subida ⇒ rompe la caché del <img>.
          logoVersion={current.logoPath ? encodeURIComponent(current.logoPath.split('/').pop() ?? '0') : '0'}
        />
      </Card>
      <Card className="mt-4 max-w-2xl">
        <FreeServiceToggle initialEnabled={current.freeService} />
      </Card>
      <Card className="mt-4 max-w-2xl">
        <PatientOwnershipToggle initialInstitutional={current.patientOwnership === 'institucion'} />
      </Card>
      {current.patientOwnership === 'institucion' ? (
        <Card className="mt-4 max-w-2xl">
          <AccessPolicyControl
            initialPolicy={current.accessPolicy}
            initialProfessorCanWiden={current.professorCanWiden}
          />
        </Card>
      ) : null}
    </div>
  );
}
