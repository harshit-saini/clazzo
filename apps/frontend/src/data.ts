/** Placeholder until a real support inbox exists — shown on the Contact page and in the landing footer. */
export const SUPPORT_EMAIL = "support@clazzo.app";

export const faqData = [
  {
    q: "Who is Clazzo for?",
    a: "Schools, colleges, coaching centres and independent tutors. When you register you pick the structure that fits you — classes and sections, centres and batches, or just a simple list of groups — and you can rename or reshape it later.",
  },
  {
    q: "What can I do with it today?",
    a: "Set up your groups and subjects, add students, schedule classes, mark attendance from a phone, create fee invoices and record the payments you receive, and give each student a login to see their own classes, attendance and fees.",
  },
  {
    q: "Can students or guardians pay fees through Clazzo?",
    a: "Not yet. Clazzo tracks invoices and the payments your staff record (cash, bank transfer, UPI and so on). It does not collect money online.",
  },
  {
    q: "Is Clazzo a directory where students can find or compare centres?",
    a: "No. Clazzo is a tool that your institute uses to run its day-to-day work. Students only see the institutes that have added them.",
  },
  {
    q: "How do students get access?",
    a: "An institute adds the student using their email address. The student then logs in with a one-time code sent to that email. If the student is under 18, a parent or guardian first confirms access with a separate code, and can withdraw it at any time.",
  },
  {
    q: "What does it cost?",
    a: "Clazzo is free to use during early access. We will announce paid plans well in advance and will not charge you without your agreement.",
  },
  {
    q: "Where can I read how my data is handled?",
    a: "See the Privacy Policy and Terms linked in the footer. Both are drafts that are still being reviewed, and are labelled that way.",
  },
];

export interface FooterLink {
  label: string;
  /** In-app route (rendered as a router Link). */
  to?: string;
  /** Same-page anchor or mailto: link. */
  href?: string;
}

export const footerColumns: { title: string; links: FooterLink[] }[] = [
  {
    title: "Product",
    links: [
      { label: "How it works", href: "#how" },
      { label: "For institutes", href: "#institutes" },
      { label: "For students", href: "#students" },
      { label: "Pricing", href: "#pricing" },
    ],
  },
  {
    title: "Get started",
    links: [
      { label: "Register your institute", to: "/register" },
      { label: "Student sign up", to: "/student/signup" },
      { label: "Log in", to: "/login" },
      { label: "Guardian consent", to: "/consent/confirm" },
    ],
  },
  {
    title: "Support",
    links: [
      { label: "FAQ", href: "#faq" },
      { label: "Contact", to: "/contact" },
      { label: "Privacy Policy", to: "/privacy" },
      { label: "Terms of Service", to: "/terms" },
    ],
  },
];

export const pricingPlans = [
  {
    id: "early-access",
    name: "Early access",
    price: "Free",
    priceNote: "while we're in early access",
    description: "Everything Clazzo does today, for any school, college, coaching centre or tutor.",
    features: [
      "Flexible structure: classes, sections, centres, batches or simple groups",
      "Students, subjects, timetables and class sessions",
      "Attendance marking on a phone",
      "Fee invoices, recorded payments and overdue tracking",
      "Student portal with guardian consent",
      "Staff accounts for owners, teachers and accountants",
    ],
  },
];
