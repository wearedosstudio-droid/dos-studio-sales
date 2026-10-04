import type { Metadata } from "next";
import Image from "next/image";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Acceso" };

export default function LoginPage() {
  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      <section className="relative hidden overflow-hidden bg-violet-deep p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="flex items-center gap-3">
          <Image src="/brand/isotype.png" alt="" width={36} height={36} className="rounded-md bg-white p-1" />
          <span className="font-display text-lg font-semibold">Dos Studio</span>
        </div>
        <div>
          <p className="font-display text-4xl font-semibold leading-tight">
            Empresa, problema, oportunidad.
            <br />
            <span className="text-violet-soft/70">Y el siguiente paso.</span>
          </p>
          <p className="mt-4 max-w-sm text-sm text-violet-soft/70">Panel comercial interno.</p>
        </div>
        <div
          aria-hidden
          className="pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full bg-violet opacity-40 blur-3xl"
        />
      </section>

      <section className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <Image src="/brand/isotype.png" alt="" width={32} height={32} />
            <span className="font-display text-lg font-semibold">Dos Studio Sales</span>
          </div>
          <h1 className="text-2xl font-semibold">Acceso</h1>
          <p className="mb-8 mt-1 text-sm text-graphite">Solo para el equipo de Dos Studio.</p>
          <LoginForm />
        </div>
      </section>
    </main>
  );
}
