import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { logout } from "@/app/login/actions";
import { Nav } from "@/components/Nav";

// Todas las páginas del panel dependen de la sesión: nunca se sirven en caché.
export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Segunda barrera además del middleware.
  if (!user) redirect("/login");

  return (
    <div className="min-h-screen lg:flex">
      {/* Sidebar escritorio */}
      <aside className="hidden w-60 shrink-0 flex-col border-r border-line bg-paper px-4 py-6 lg:flex lg:h-screen lg:sticky lg:top-0">
        <Link href="/dashboard" className="mb-8 flex items-center gap-2.5 px-2">
          <Image src="/brand/isotype.png" alt="" width={28} height={28} />
          <span className="font-display text-base font-semibold">Dos Studio Sales</span>
        </Link>

        <Link href="/companies/new" className="btn-primary mb-6">
          + Nueva empresa
        </Link>

        <Nav variant="sidebar" />

        <div className="mt-auto border-t border-line pt-4">
          <p className="truncate px-2 text-xs text-graphite" title={user.email ?? ""}>
            {user.email}
          </p>
          <form action={logout}>
            <button type="submit" className="mt-2 px-2 text-xs font-medium text-graphite hover:text-violet">
              Cerrar sesión
            </button>
          </form>
        </div>
      </aside>

      {/* Barra superior móvil / tablet */}
      <header className="sticky top-0 z-10 border-b border-line bg-paper/95 backdrop-blur lg:hidden">
        <div className="flex items-center justify-between px-4 py-3">
          <Link href="/dashboard" className="flex items-center gap-2">
            <Image src="/brand/isotype.png" alt="" width={24} height={24} />
            <span className="font-display text-sm font-semibold">Dos Studio Sales</span>
          </Link>
          <div className="flex items-center gap-2">
            <Link href="/companies/new" className="btn-primary px-3 py-1.5 text-xs">
              + Nueva
            </Link>
            <form action={logout}>
              <button type="submit" className="btn-secondary px-3 py-1.5 text-xs">
                Salir
              </button>
            </form>
          </div>
        </div>
        <div className="px-3 pb-2">
          <Nav variant="top" />
        </div>
      </header>

      <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
    </div>
  );
}
