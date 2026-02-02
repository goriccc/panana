import "./admin.css";
import { AdminHeader } from "./_components/AdminHeader";
import { AdminSidebar } from "./_components/AdminSidebar";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="admin-scope min-h-dvh bg-[#07070B] font-sans text-white">
      <div className="mx-auto flex w-full max-w-[1200px] gap-6 px-6 py-8">
        <AdminSidebar />

        <div className="min-w-0 flex-1">
          <AdminHeader />

          <main className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}

