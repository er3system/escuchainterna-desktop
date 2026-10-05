import { PageHeader } from '@/components/ui';
import { requireAdmin } from '../requireAdmin';
import { CalculadoraClient } from './CalculadoraClient';

export const metadata = { title: 'Calculadora · Administración · EscuchaInterna' };

export default async function AdminCalculadoraPage() {
  await requireAdmin();
  return (
    <div>
      <PageHeader
        title="Calculadora de costos y precios"
        subtitle="Estima costo-para-ti vs precio sugerido vs margen de una organización. Herramienta interna; los valores son aproximados y editables."
      />
      <CalculadoraClient />
    </div>
  );
}
