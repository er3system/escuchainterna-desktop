import { describe, expect, it } from 'vitest';
import type { PatientReportPrimitives } from '@/contexts/clinical-records/domain/PatientReport';
import { renderReportPdfHtml } from '@/contexts/clinical-records/infrastructure/pdf/reportPdfHtml';

function report(overrides: Partial<PatientReportPrimitives> = {}): PatientReportPrimitives {
  return {
    id: 'r1',
    patientId: 'p1',
    kind: 'expediente',
    title: 'Historia clínica completa — Ana',
    content: '# Título\n\n## Evolución\n- punto uno\n\nTexto con **negrita**.',
    status: 'firmado',
    signedBy: 'Dra. X',
    licenseNumber: 'TP-9',
    signedByUserId: 'user-1',
    signedAt: '2026-06-13T10:00:00.000Z',
    createdAt: '2026-06-13T09:00:00.000Z',
    updatedAt: '2026-06-13T10:00:00.000Z',
    ...overrides,
  };
}

describe('renderReportPdfHtml', () => {
  it('firmado: renderiza markdown, firma y sin marca de agua', () => {
    const html = renderReportPdfHtml({ report: report(), patientName: 'Ana Pérez', professional: null });
    expect(html).toContain('<h2>Evolución</h2>');
    expect(html).toContain('<li>punto uno</li>');
    expect(html).toContain('<strong>negrita</strong>');
    expect(html).toContain('Ana Pérez');
    expect(html).toContain('Dra. X');
    expect(html).toContain('Firmado el');
    expect(html).not.toContain('class="watermark"');
  });

  it('borrador: incluye marca de agua y pie de borrador', () => {
    const html = renderReportPdfHtml({
      report: report({ status: 'borrador', signedAt: null, signedBy: '', licenseNumber: '' }),
      patientName: 'Ana',
      professional: null,
    });
    expect(html).toContain('class="watermark"');
    expect(html).toContain('DOCUMENTO EN BORRADOR');
  });

  it('escapa HTML del contenido (no inyecta etiquetas)', () => {
    const html = renderReportPdfHtml({
      report: report({ content: 'Hola <script>alert(1)</script> fin' }),
      patientName: 'Ana',
      professional: null,
    });
    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toContain('<script>alert(1)</script>');
  });

  it('incluye el bloque del profesional cuando se provee', () => {
    const html = renderReportPdfHtml({
      report: report(),
      patientName: 'Ana',
      professional: {
        fullName: 'Dra. Sofía',
        professionalLicense: 'TP-123',
        email: 'sofia@demo.test',
        contactPhone: '+57 300',
        contactAddress: 'Calle 1',
        organizationName: 'Clínica X',
        organizationLogoDataUri: null,
      },
    });
    expect(html).toContain('Dra. Sofía');
    expect(html).toContain('TP-123');
    expect(html).toContain('Clínica X');
  });
});
