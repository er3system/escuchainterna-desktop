'use client';

import { Printer } from 'lucide-react';
import { Button } from '@/components/ui';

export function PrintButton() {
  return (
    <Button type="button" onClick={() => window.print()}>
      <Printer size={15} /> Imprimir / guardar PDF
    </Button>
  );
}
