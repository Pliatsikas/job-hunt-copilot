"use client";

import { useT } from "@/lib/i18n/client";
import { Button } from "@/components/ui/button";

export function PrintButton() {
  const t = useT();
  return (
    <Button type="button" onClick={() => window.print()}>
      {t("common.print")}
    </Button>
  );
}
