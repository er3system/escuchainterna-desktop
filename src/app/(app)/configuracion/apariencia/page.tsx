import { PageHeader } from '@/components/ui';
import { AppearanceSettings } from '@/components/appearance/AppearanceSettings';

export default function AparienciaPage() {
  return <div className="mx-auto max-w-5xl"><PageHeader title="Apariencia" subtitle="Un espacio de trabajo a tu ritmo. Elige la luz, el color y el movimiento." /><AppearanceSettings /></div>;
}
