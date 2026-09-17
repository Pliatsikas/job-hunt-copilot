"use client";

import { useActionState, useRef, useState } from "react";
import { removePhoto, savePhoto, type PhotoState } from "@/lib/cv/actions";
import { useT } from "@/lib/i18n/client";
import { Button } from "@/components/ui/button";

const MAX_SIDE = 640;

/**
 * Resizes in the browser (canvas → JPEG) so the server only ever sees a
 * small data URL: no upload endpoint, no storage service, nothing to clean
 * up. The picked file is shown at once; "Save" posts the data URL.
 */
export function PhotoForm({ current }: { current: string | null }) {
  const t = useT();
  const [state, action, pending] = useActionState<PhotoState, FormData>(savePhoto, {});
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [readError, setReadError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function onPick(file: File | undefined) {
    setReadError(null);
    if (!file) return;
    try {
      setDataUrl(await shrink(file));
    } catch {
      setReadError(t("cvEditor.photoBad"));
    }
  }

  const shown = dataUrl ?? current;

  return (
    <div className="flex flex-wrap items-start gap-4">
      <div className="size-28 shrink-0 overflow-hidden rounded-xl bg-muted">
        {shown && (
          // A data URL: next/image has nothing to optimise here.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={shown} alt="" className="size-full object-cover object-top" />
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <p className="text-sm text-muted-foreground">{t("cvEditor.photoNote")}</p>
        <form action={action} className="flex flex-wrap items-center gap-2">
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => onPick(e.target.files?.[0])} />
          <input type="hidden" name="photo" value={dataUrl ?? ""} />
          <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
            {t("cvEditor.choosePhoto")}
          </Button>
          {dataUrl && (
            <Button type="submit" size="sm" pending={pending}>
              {t("common.save")}
            </Button>
          )}
        </form>
        {current && !dataUrl && (
          <form action={removePhoto}>
            <Button type="submit" variant="ghost" size="sm">
              {t("cvEditor.removePhoto")}
            </Button>
          </form>
        )}
        {(readError || state.error) && (
          <p role="alert" className="text-sm text-destructive">
            {readError ?? state.error}
          </p>
        )}
        {state.savedAt && !state.error && (
          <p role="status" className="text-sm text-muted-foreground animate-in fade-in duration-300">
            {t("cvEditor.photoSaved")}
          </p>
        )}
      </div>
    </div>
  );
}

async function shrink(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no canvas");
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  // Quality steps down until the data URL fits the server's cap.
  for (const q of [0.85, 0.75, 0.6, 0.45]) {
    const url = canvas.toDataURL("image/jpeg", q);
    if (url.length <= 300 * 1024) return url;
  }
  throw new Error("too large");
}
