import { AdminSidebar } from './AdminSidebar';
import { requireAdmin } from './requireAdmin';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();

  return (
    <div className="min-h-screen bg-bg">
      <AdminSidebar adminEmail={admin.email} />
      <main className="ml-60 min-h-screen px-8 py-6">{children}</main>
    </div>
  );
}
