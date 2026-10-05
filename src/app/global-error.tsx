'use client';

/**
 * Fallback de último recurso: se muestra si falla el propio layout raíz, así que
 * REEMPLAZA <html>/<body> y no puede depender de los estilos de la app (estilos inline).
 */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="es">
      <body
        style={{
          margin: 0,
          minHeight: '100dvh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'system-ui, -apple-system, Segoe UI, sans-serif',
          background: '#f5f5fa',
          color: '#1b1b29',
          padding: 24,
        }}
      >
        <div style={{ maxWidth: 440, textAlign: 'center' }}>
          <p
            style={{
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: '#5f6e3a',
            }}
          >
            EscuchaInterna
          </p>
          <h1 style={{ fontSize: 22, fontWeight: 700, marginTop: 12 }}>Algo salió mal</h1>
          <p style={{ color: '#5b5b6b', marginTop: 8, lineHeight: 1.5 }}>
            Ocurrió un error inesperado. Vuelve a intentarlo; si el problema continúa, escríbenos a
            hola@escuchainterna.com.
          </p>
          <button
            onClick={() => reset()}
            style={{
              marginTop: 20,
              border: 'none',
              borderRadius: 10,
              background: '#16181d',
              color: '#fff',
              fontWeight: 600,
              fontSize: 14,
              padding: '10px 18px',
              cursor: 'pointer',
            }}
          >
            Reintentar
          </button>
        </div>
      </body>
    </html>
  );
}
