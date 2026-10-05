import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { PageHeader } from '@/components/ui';
import { NewPatientForm } from './NewPatientForm';

export default function NuevoPacientePage() {
  return (
    <div className="mx-auto max-w-3xl">
      <Link
        href="/pacientes"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-primary dark:text-accent-2 hover:underline"
      >
        <ArrowLeft size={16} />
        Volver a pacientes
      </Link>
      <PageHeader
        title="Nuevo paciente"
        subtitle="Solo el nombre es obligatorio; el resto puedes completarlo después en el expediente."
      />
      <NewPatientForm />
    </div>
  );
}
