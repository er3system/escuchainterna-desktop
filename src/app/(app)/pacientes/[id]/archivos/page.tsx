import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Download, FileArchive, FileImage, FileText, File as FileIcon } from 'lucide-react';
import { ListPatientFiles } from '@/contexts/clinical-records/application/list-patient-files/ListPatientFiles';
import { SqlitePatientFileRepository } from '@/contexts/clinical-records/infrastructure/persistence/SqlitePatientFileRepository';
import { requireSessionUserId } from '@/shared/infrastructure/auth/session';
import { BYTES_PER_GB, getStorageUsage } from '@/shared/infrastructure/storage-billing/StorageQuotaGate';
import { EmptyState } from '@/components/ui';
import { UploadFiles } from './UploadFiles';
import { DeleteFileButton } from './DeleteFileButton';

function formatGb(bytes: number): string {
  return `${(bytes / BYTES_PER_GB).toFixed(bytes < BYTES_PER_GB ? 2 : 1)} GB`;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function iconFor(mime: string) {
  if (mime.startsWith('image/')) return FileImage;
  if (mime === 'application/pdf' || mime.startsWith('text/')) return FileText;
  if (mime.includes('zip') || mime.includes('compressed')) return FileArchive;
  return FileIcon;
}

export default async function ArchivosPage({ params }: { params: Promise<{ id: string }> }) {
  const ownerUserId = await requireSessionUserId();
  const { id } = await params;
  const files = await new ListPatientFiles(new SqlitePatientFileRepository(ownerUserId)).execute(id);
  const { usedBytes, limitBytes } = await getStorageUsage(ownerUserId);
  const usedPct = limitBytes ? Math.min(100, Math.round((usedBytes / limitBytes) * 100)) : 0;
  const nearFull = limitBytes !== null && usedBytes / limitBytes >= 0.9;

  return (
    <div>
      <div className="mb-4">
        <UploadFiles patientId={id} />
      </div>

      {limitBytes !== null ? (
        <div className="mb-4 rounded-card border border-line bg-surface p-3">
          <div className="flex items-center justify-between text-xs">
            <span className="text-ink-soft">Almacenamiento de tus adjuntos</span>
            <span className={`font-medium ${nearFull ? 'text-warning' : 'text-ink'}`}>
              {formatGb(usedBytes)} de {formatGb(limitBytes)}
            </span>
          </div>
          <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-bg">
            <div
              className={`h-full rounded-full ${nearFull ? 'bg-warning' : 'bg-primary'}`}
              style={{ width: `${usedPct}%` }}
            />
          </div>
        </div>
      ) : null}

      {files.length === 0 ? (
        <EmptyState
          title="Sin archivos"
          description="Sube documentos, consentimientos, resultados o cualquier material del paciente (máximo 20 MB por archivo)."
        />
      ) : (
        <div className="overflow-x-auto rounded-card border border-line bg-surface shadow-card">
          <table className="w-full min-w-[920px] text-sm">
            <thead>
              <tr className="border-b border-line bg-bg text-left text-xs font-semibold uppercase tracking-wide text-ink-soft">
                <th className="px-4 py-3">Nombre</th>
                <th className="px-4 py-3">Tipo</th>
                <th className="px-4 py-3">Tamaño</th>
                <th className="px-4 py-3">Fecha</th>
                <th className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {files.map((file) => {
                const Icon = iconFor(file.mime);
                return (
                  <tr key={file.id} className="hover:bg-bg/60">
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-2 font-medium text-ink">
                        <Icon size={16} className="shrink-0 text-primary dark:text-accent-2" />
                        {file.filename}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-ink-soft">{file.mime}</td>
                    <td className="px-4 py-3 text-ink-soft">{formatSize(file.size)}</td>
                    <td className="px-4 py-3 text-ink-soft">
                      {format(new Date(file.uploadedAt), "d MMM yyyy, HH:mm", { locale: es })}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1.5">
                        <a
                          href={`/api/pacientes/${id}/archivos/${file.id}`}
                          className="inline-flex items-center gap-1 rounded-lg bg-primary-light px-2.5 py-1 text-xs font-medium text-primary hover:bg-primary hover:text-white"
                        >
                          <Download size={13} /> Descargar
                        </a>
                        <DeleteFileButton patientId={id} fileId={file.id} filename={file.filename} />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
