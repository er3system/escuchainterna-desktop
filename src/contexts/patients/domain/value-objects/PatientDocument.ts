import { formatPatientDocument, isDocumentTypeKey, type DocumentTypeKey } from './documentTypes';

/**
 * Documento de identificación del paciente (tipo + número), §5 de
 * docs/cuentas-institucionales-spec.md. UNA sola fuente (vive en `patients`; la
 * historia lo lee/escribe, no lo duplica). Se guarda en claro como el resto de
 * identificadores (nombre/email/teléfono): cifrarlo rompería la búsqueda.
 */
export class PatientDocument {
  private constructor(
    private readonly type: DocumentTypeKey | '',
    private readonly number: string,
  ) {}

  /** Normaliza: tipo desconocido → '', número recortado. No lanza (dato opcional). */
  public static of(type: string, number: string): PatientDocument {
    return new PatientDocument(isDocumentTypeKey(type) ? type : '', number.trim());
  }

  public static empty(): PatientDocument {
    return new PatientDocument('', '');
  }

  public typeValue(): DocumentTypeKey | '' {
    return this.type;
  }

  public numberValue(): string {
    return this.number;
  }

  /** Sin número no hay documento útil (un tipo suelto no identifica a nadie). */
  public hasNumber(): boolean {
    return this.number !== '';
  }

  public isEmpty(): boolean {
    return this.type === '' && this.number === '';
  }

  public format(): string {
    return formatPatientDocument(this.type, this.number);
  }
}
