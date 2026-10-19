"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { FOLDERS } from "@/lib/os";
import { registerUpload } from "@/app/(app)/documents/actions";

const MAX = 50 * 1024 * 1024;

function safeName(name: string) {
  const dot = name.lastIndexOf(".");
  const base = (dot > 0 ? name.slice(0, dot) : name)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9-_]+/g, "-")
    .slice(0, 80);
  const ext = dot > 0 ? name.slice(dot + 1).toLowerCase().replace(/[^a-z0-9]/g, "") : "";
  return ext ? `${base}.${ext}` : base;
}

/** Sube archivos directamente a Supabase Storage (hasta 50 MB cada uno). */
export function DocumentUploader({ clientId, defaultFolder = "contrato" }: { clientId: string; defaultFolder?: string }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [folder, setFolder] = useState(defaultFolder);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [over, setOver] = useState(false);

  async function upload(files: File[]) {
    if (!files.length) return;
    setBusy(true);
    setMessage(null);
    const supabase = createClient();
    let ok = 0;
    for (const file of files) {
      if (file.size > MAX) {
        setMessage(`«${file.name}» pesa más de 50 MB.`);
        continue;
      }
      const path = `${clientId}/${folder}/${Date.now()}-${safeName(file.name)}`;
      const { error } = await supabase.storage.from("documents").upload(path, file, { contentType: file.type || undefined });
      if (error) {
        setMessage(`No se pudo subir «${file.name}».`);
        continue;
      }
      const res = await registerUpload({ clientId, folder, name: file.name, path, mime: file.type, size: file.size });
      if (res.error) setMessage(res.error);
      else ok++;
    }
    setBusy(false);
    if (ok) {
      setMessage(ok === 1 ? "Archivo subido." : `${ok} archivos subidos.`);
      router.refresh();
    }
    if (input.current) input.current.value = "";
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        upload(Array.from(e.dataTransfer.files));
      }}
      className={`rounded-xl border-2 border-dashed p-4 transition ${over ? "border-violet bg-violet-soft/50" : "border-line"}`}
    >
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="upload-folder" className="label">
            Carpeta
          </label>
          <select id="upload-folder" value={folder} onChange={(e) => setFolder(e.target.value)} className="input w-auto">
            {FOLDERS.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
        </div>
        <label className={`btn-primary cursor-pointer ${busy ? "pointer-events-none opacity-60" : ""}`}>
          {busy ? "Subiendo…" : "Subir archivos"}
          <input ref={input} type="file" multiple className="sr-only" onChange={(e) => upload(Array.from(e.target.files ?? []))} />
        </label>
        <p className="text-xs text-graphite">o arrástralos aquí · cualquier formato, hasta 50 MB</p>
      </div>
      {message && (
        <p role="status" className="mt-3 text-sm text-graphite">
          {message}
        </p>
      )}
    </div>
  );
}
