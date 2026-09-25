import type { CvDesign } from "../lib/schemas/cv-design";
import type { StructuredCv } from "../lib/schemas/structured-cv";

/**
 * The demo account's structured CV (T11), in both languages, so a visitor
 * opening the builder sees a finished CV rather than an empty form. Written
 * by hand, not generated: the seed must not spend model calls or vary
 * between deploys. Same fictional person as `CV_TEXT` in seed.ts.
 */
export const DEMO_DESIGN: CvDesign = { template: "sidebar", accent: "navy", showPhoto: false };

export const DEMO_CV_EN: StructuredCv = {
  name: "Demo User",
  subtitle: "Fullstack Developer · React, Node.js, PostgreSQL",
  about:
    "Fullstack developer with two years of professional experience. I build React frontends with TypeScript and Next.js, design PostgreSQL schemas, and write REST APIs in Node.js. I have shipped and maintained two internal tools used daily by a team of twelve.",
  contacts: [
    { id: "contact-1", kind: "email", value: "demo@example.com", href: "" },
    { id: "contact-2", kind: "location", value: "Athens, Greece", href: "" },
    { id: "contact-3", kind: "github", value: "github.com/demo-user", href: "" },
  ],
  skillGroups: [
    { id: "skills-1", label: "Frontend", skills: [{ id: "skills-1-s1", name: "React" }, { id: "skills-1-s2", name: "TypeScript" }, { id: "skills-1-s3", name: "Next.js" }] },
    { id: "skills-2", label: "Backend & Databases", skills: [{ id: "skills-2-s1", name: "Node.js" }, { id: "skills-2-s2", name: "Express" }, { id: "skills-2-s3", name: "PostgreSQL" }] },
    { id: "skills-3", label: "Tools", skills: [{ id: "skills-3-s1", name: "Docker" }, { id: "skills-3-s2", name: "Git" }] },
  ],
  languages: [
    { id: "lang-1", name: "Greek", level: "Native" },
    { id: "lang-2", name: "English", level: "C2" },
  ],
  certifications: [{ id: "cert-1", name: "PHP Crash Course", issuer: "Udemy", year: "2026" }],
  interests: [{ id: "interest-1", name: "running" }, { id: "interest-2", name: "chess" }],
  experience: [
    {
      id: "exp-1",
      title: "Fullstack Developer",
      org: "Northwind Labs",
      date: "2024 – present",
      location: "Athens",
      links: [],
      bullets: [
        { id: "exp-1-b1", text: "Built and maintained two internal tools used daily by a team of twelve." },
        { id: "exp-1-b2", text: "Designed PostgreSQL schemas and wrote REST APIs in Node.js with Express." },
        { id: "exp-1-b3", text: "Containerised the stack with Docker for local development and deployment." },
      ],
    },
    {
      id: "exp-2",
      title: "Junior Developer",
      org: "Aegean Software",
      date: "2023 – 2024",
      location: "Athens",
      links: [],
      bullets: [
        { id: "exp-2-b1", text: "Shipped React features for a customer portal used by 4,000 accounts." },
        { id: "exp-2-b2", text: "Migrated a legacy jQuery admin screen to React and TypeScript." },
      ],
    },
  ],
  education: [
    {
      id: "edu-1",
      title: "BSc Computer Science",
      org: "University of Athens",
      date: "2019 – 2023",
      location: "Athens",
      links: [],
      bullets: [{ id: "edu-1-b1", text: "Thesis on query performance in relational databases." }],
    },
  ],
  projects: [
    {
      id: "proj-1",
      title: "Shift Planner",
      org: "Next.js, PostgreSQL, Prisma",
      date: "2025",
      location: "",
      links: [{ id: "proj-1-l1", label: "github.com/demo-user/shift-planner", href: "" }],
      bullets: [
        { id: "proj-1-b1", text: "Rota planning for small teams, with conflict detection and CSV export." },
        { id: "proj-1-b2", text: "Used by two cafés in Athens to plan weekly shifts." },
      ],
    },
  ],
};

export const DEMO_CV_EL: StructuredCv = {
  ...DEMO_CV_EN,
  subtitle: "Fullstack Developer · React, Node.js, PostgreSQL",
  about:
    "Fullstack developer με δύο χρόνια επαγγελματικής εμπειρίας. Φτιάχνω frontends σε React με TypeScript και Next.js, σχεδιάζω σχήματα PostgreSQL και γράφω REST APIs σε Node.js. Έχω παραδώσει και συντηρήσει δύο εσωτερικά εργαλεία που χρησιμοποιεί καθημερινά ομάδα δώδεκα ατόμων.",
  contacts: [
    { id: "contact-1", kind: "email", value: "demo@example.com", href: "" },
    { id: "contact-2", kind: "location", value: "Αθήνα, Ελλάδα", href: "" },
    { id: "contact-3", kind: "github", value: "github.com/demo-user", href: "" },
  ],
  skillGroups: [
    { id: "skills-1", label: "Frontend", skills: DEMO_CV_EN.skillGroups[0].skills },
    { id: "skills-2", label: "Backend & Βάσεις", skills: DEMO_CV_EN.skillGroups[1].skills },
    { id: "skills-3", label: "Εργαλεία", skills: DEMO_CV_EN.skillGroups[2].skills },
  ],
  languages: [
    { id: "lang-1", name: "Ελληνικά", level: "Μητρική" },
    { id: "lang-2", name: "Αγγλικά", level: "C2" },
  ],
  certifications: [{ id: "cert-1", name: "PHP Crash Course", issuer: "Udemy", year: "2026" }],
  interests: [{ id: "interest-1", name: "τρέξιμο" }, { id: "interest-2", name: "σκάκι" }],
  experience: [
    {
      ...DEMO_CV_EN.experience[0],
      date: "2024 – σήμερα",
      location: "Αθήνα",
      bullets: [
        { id: "exp-1-b1", text: "Έφτιαξα και συντήρησα δύο εσωτερικά εργαλεία που χρησιμοποιεί καθημερινά ομάδα δώδεκα ατόμων." },
        { id: "exp-1-b2", text: "Σχεδίασα σχήματα PostgreSQL και έγραψα REST APIs σε Node.js με Express." },
        { id: "exp-1-b3", text: "Έβαλα το stack σε Docker για ανάπτυξη και deployment." },
      ],
    },
    {
      ...DEMO_CV_EN.experience[1],
      title: "Junior Developer",
      date: "2023 – 2024",
      location: "Αθήνα",
      bullets: [
        { id: "exp-2-b1", text: "Ανέπτυξα features σε React για πύλη πελατών με 4.000 λογαριασμούς." },
        { id: "exp-2-b2", text: "Μετέφερα παλιά οθόνη διαχείρισης από jQuery σε React και TypeScript." },
      ],
    },
  ],
  education: [
    {
      ...DEMO_CV_EN.education[0],
      title: "Πτυχίο Πληροφορικής",
      org: "Πανεπιστήμιο Αθηνών",
      location: "Αθήνα",
      bullets: [{ id: "edu-1-b1", text: "Πτυχιακή για την απόδοση ερωτημάτων σε σχεσιακές βάσεις." }],
    },
  ],
  projects: [
    {
      ...DEMO_CV_EN.projects[0],
      bullets: [
        { id: "proj-1-b1", text: "Πρόγραμμα βαρδιών για μικρές ομάδες, με έλεγχο συγκρούσεων και εξαγωγή CSV." },
        { id: "proj-1-b2", text: "Το χρησιμοποιούν δύο καφέ στην Αθήνα για τον εβδομαδιαίο προγραμματισμό." },
      ],
    },
  ],
};
