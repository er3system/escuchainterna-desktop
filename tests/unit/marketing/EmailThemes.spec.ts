import { describe, expect, it } from 'vitest';
import {
  EMAIL_THEMES,
  isEmailThemeId,
  isThemedEmailBody,
  renderEmailTheme,
} from '@/shared/infrastructure/email-themes/emailThemes';

describe('temas de correo', () => {
  it('expone exactamente los 3 temas de la spec (6.15)', () => {
    expect(EMAIL_THEMES.map((theme) => theme.id)).toEqual(['calido', 'profesional', 'minimal']);
    expect(isEmailThemeId('calido')).toBe(true);
    expect(isEmailThemeId('oscuro')).toBe(false);
  });

  it('envuelve el contenido en un documento HTML completo con el nombre del profesional', () => {
    for (const theme of EMAIL_THEMES) {
      const html = renderEmailTheme(theme.id, 'Hola María,\nTe esperamos.', {
        professionalName: 'Psic. Ana Torres',
        organizationName: 'Clínica Bienestar',
      });
      expect(html).toMatch(/^<!DOCTYPE html>/);
      expect(html).toContain('Psic. Ana Torres');
      expect(html).toContain('Clínica Bienestar');
      expect(html).toContain('Hola María,<br/>Te esperamos.');
      expect(isThemedEmailBody(html)).toBe(true);
    }
  });

  it('escapa HTML del contenido (el texto del mensaje se trata como datos)', () => {
    const html = renderEmailTheme('minimal', '<script>alert(1)</script>', { professionalName: 'Ana' });
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('no re-envuelve cuerpos que ya vienen con tema', () => {
    const themed = renderEmailTheme('profesional', 'Hola', { professionalName: 'Ana' });
    expect(isThemedEmailBody(themed)).toBe(true);
    expect(isThemedEmailBody('Hola, este es un texto plano')).toBe(false);
  });

  it('enlaza las URLs del contenido como anclas clicables', () => {
    const html = renderEmailTheme('calido', 'Paga aquí: https://pay.demo/abc', {
      professionalName: 'Ana',
    });
    expect(html).toContain('<a href="https://pay.demo/abc"');
  });

  it('muestra un botón de acción (CTA) cuando se pasa una liga de acción', () => {
    const html = renderEmailTheme('profesional', 'Tu sesión te espera.', {
      professionalName: 'Ana',
      action: { label: 'Pagar', url: 'https://pay.demo/abc' },
    });
    expect(html).toContain('Pagar');
    expect(html).toContain('href="https://pay.demo/abc"');
  });

  it('deja a EscuchaInterna solo como una línea discreta al pie', () => {
    const html = renderEmailTheme('minimal', 'Hola', { professionalName: 'Ana' });
    expect(html).toContain('Enviado con EscuchaInterna');
    // El nombre del profesional aparece antes (es el protagonista visual).
    expect(html.indexOf('Ana')).toBeLessThan(html.indexOf('Enviado con EscuchaInterna'));
  });
});
