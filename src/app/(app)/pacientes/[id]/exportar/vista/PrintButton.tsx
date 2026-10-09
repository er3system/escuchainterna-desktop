'use client';

import { DocumentPrintActions } from '@/components/desktop/DocumentPrintActions';

export function PrintButton({ patientName }: { patientName: string }) {
  return <DocumentPrintActions fileName={`Expediente-${patientName}`} />;
}
