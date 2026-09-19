import type { CvTemplate } from "@/lib/schemas/cv-design";
import { ClassicTemplate } from "./classic";
import { MinimalTemplate } from "./minimal";
import { ModernTemplate } from "./modern";
import type { TemplateProps } from "./shared";
import { SidebarTemplate } from "./sidebar";

export type { TemplateProps } from "./shared";

const TEMPLATES: Record<CvTemplate, (props: TemplateProps) => React.JSX.Element> = {
  sidebar: SidebarTemplate,
  classic: ClassicTemplate,
  modern: ModernTemplate,
  minimal: MinimalTemplate,
};

/** One entry point: the design says which template, the props say what. */
export function CvTemplateView(props: TemplateProps) {
  const Template = TEMPLATES[props.design.template];
  return <Template {...props} />;
}

export const TEMPLATE_NAMES: Record<CvTemplate, { en: string; el: string }> = {
  sidebar: { en: "Sidebar", el: "Πλαϊνή στήλη" },
  classic: { en: "Classic", el: "Κλασικό" },
  modern: { en: "Modern", el: "Μοντέρνο" },
  minimal: { en: "Minimal", el: "Λιτό" },
};
