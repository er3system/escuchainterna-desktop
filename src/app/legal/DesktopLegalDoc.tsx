import { LegalHeader, LegalP, LegalSection } from './LegalDoc';
import { DESKTOP_LEGAL_VERSIONS } from '@/shared/legal/legalVersions';

export function DesktopTerms() {
  return (
    <>
      <LegalHeader title="Condiciones de uso · Edición PC" subtitle="EscuchaInterna es una aplicación local de código abierto." updatedAt={DESKTOP_LEGAL_VERSIONS.terms} />
      <LegalSection number={1} title="Licencia del programa">
        <LegalP>El código de esta edición se distribuye bajo la licencia MIT. El texto completo de la licencia acompaña al código fuente y al instalador. El software se ofrece tal como está, sin garantía. Los contenidos, catálogos y publicaciones de terceros se rigen por sus propias licencias.</LegalP>
      </LegalSection>
      <LegalSection number={2} title="Uso profesional">
        <LegalP>La aplicación permite organizar la consulta y registrar información. El profesional revisa los documentos y las sugerencias antes de utilizarlos. El programa no sustituye el juicio clínico, un diagnóstico profesional ni la atención de urgencias.</LegalP>
      </LegalSection>
      <LegalSection number={3} title="Custodia de la instalación">
        <LegalP>Los datos se guardan en esta PC y no se sincronizan automáticamente con un servicio alojado. Corresponde a quien usa la instalación proteger el equipo, conservar la contraseña y mantener copias de seguridad completas junto con las claves de cifrado.</LegalP>
      </LegalSection>
      <LegalSection number={4} title="Servicios externos">
        <LegalP>Las integraciones requieren configuración y conexión a internet. Una entrada en el registro de mensajes local no acredita una entrega al destinatario. Los enlaces de reserva, firma y sesión de esta instalación solo funcionan desde este equipo.</LegalP>
      </LegalSection>
    </>
  );
}

export function DesktopPrivacy() {
  return (
    <>
      <LegalHeader title="Privacidad · Edición PC" subtitle="Dónde se guardan los datos de esta instalación." updatedAt={DESKTOP_LEGAL_VERSIONS.privacy} />
      <LegalSection number={1} title="Almacenamiento local">
        <LegalP>Esta edición guarda la cuenta, la agenda, los pacientes y los documentos en carpetas de esta PC. Puedes consultar sus ubicaciones en Configuración. El contenido clínico y los nuevos adjuntos de pacientes se cifran. Los archivos antiguos pueden conservar su formato original; las fotos de perfil y logos no son adjuntos clínicos. Protege también el disco y la cuenta de Windows.</LegalP>
      </LegalSection>
      <LegalSection number={2} title="Acceso y copias">
        <LegalP>El acceso al programa requiere tu cuenta local. No existe sincronización automática con escuchainterna.com ni recuperación de contraseña por correo incluida. Una copia de seguridad puede contener información de pacientes: guárdala en un destino protegido y conserva las claves necesarias para restaurarla.</LegalP>
      </LegalSection>
      <LegalSection number={3} title="Conexiones opcionales">
        <LegalP>Sin proveedores externos configurados, los mensajes quedan registrados en la instalación y el asistente utiliza el modo local. Si configuras un proveedor de correo, WhatsApp o IA remota, las funciones que lo invoquen podrán transmitir al proveedor la información necesaria. Revisa la configuración y la autorización de los pacientes antes de activar esas funciones.</LegalP>
      </LegalSection>
      <LegalSection number={4} title="Tus pacientes y documentos">
        <LegalP>El profesional a cargo determina qué información registra, a quién autoriza a acceder y cuánto tiempo la conserva. La exportación y eliminación de la cuenta están disponibles en Configuración → Seguridad. Exportar los registros en JSON no reemplaza el respaldo completo de archivos y claves.</LegalP>
      </LegalSection>
    </>
  );
}
