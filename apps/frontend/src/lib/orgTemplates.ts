export type OrgType = "SCHOOL" | "COLLEGE" | "COACHING" | "TUTOR";

export interface OrgTemplate {
  type: OrgType;
  label: string;
  optionLabel: string;
  levels: string[];
  description: string;
}

/// Starting-point structure ladders for each kind of organization. Purely a
/// suggestion — every level here can be renamed, removed, or split further
/// by inserting a new one, both during registration and later from
/// Structure in the dashboard.
export const ORG_TEMPLATES: OrgTemplate[] = [
  {
    type: "SCHOOL",
    label: "School",
    optionLabel: "A school — classes and sections",
    levels: ["Class", "Section"],
    description:
      "Each class (e.g. Class 7) splits into sections (e.g. Section A). Subjects can be shared across a whole class or set per section — so 12A can study Science while 12B studies Commerce. Run more than one campus? Insert a “Campus” level above Class.",
  },
  {
    type: "COLLEGE",
    label: "College",
    optionLabel: "A college — centres, degrees and batches",
    levels: ["Centre", "Degree", "Batch", "Specialization"],
    description:
      "A centre is a campus. Each centre offers degrees (e.g. B.Tech), each degree admits batches by year (e.g. 2024), and each batch splits into specializations or branches (e.g. Mechanical, Computer Science).",
  },
  {
    type: "COACHING",
    label: "Coaching institute",
    optionLabel: "A coaching institute — centres and batches",
    levels: ["Centre", "Batch"],
    description:
      "A centre is a branch location. Each centre runs its own batches (e.g. Class 11 Morning Batch) that students enrol into directly.",
  },
  {
    type: "TUTOR",
    label: "Individual teacher",
    optionLabel: "I teach on my own — a simple group list",
    levels: ["Group"],
    description: "Just a flat list of the groups you teach — no locations, classes or batches needed.",
  },
];

export function templateFor(type: OrgType): OrgTemplate {
  return ORG_TEMPLATES.find((t) => t.type === type) ?? ORG_TEMPLATES[2];
}
