import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Pipeline Admin",
  robots: "noindex, nofollow",
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[var(--background)]">
      <nav className="border-b border-[var(--border)] px-6 py-3 flex items-center gap-6">
        <span className="font-bold text-lg">SEOCRACKA</span>
        <a href="/admin" className="text-sm text-[var(--muted)] hover:text-[var(--foreground)]">
          Dashboard
        </a>
        <a href="/admin/queue" className="text-sm text-[var(--muted)] hover:text-[var(--foreground)]">
          Post Queue
        </a>
      </nav>
      <main className="p-6 max-w-6xl mx-auto">{children}</main>
    </div>
  );
}
