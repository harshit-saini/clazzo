export const faqData = [
  {
    q: "Is Clazzo free for students?",
    a: "Yes. Browsing, comparing and messaging coaching centers is free. Some centers charge for enrollment or demo classes, and that's always shown clearly before you pay.",
  },
  {
    q: "How do I register my coaching center?",
    a: 'Click "Register Your Coaching Center," add your institute\'s details, courses and batches, and your profile goes live after a quick verification.',
  },
  {
    q: "How does payment work?",
    a: "Students pay course fees directly through the platform. Coaching centers receive payouts on a regular cycle, with every transaction tracked in the dashboard.",
  },
  {
    q: "Are coaching centers verified?",
    a: "Every center goes through a basic verification check before its profile is listed publicly.",
  },
  {
    q: "Can I change or cancel my plan?",
    a: "Coaching centers can upgrade, downgrade or cancel anytime from account settings. There's no lock-in contract.",
  },
  {
    q: "Can students try a class before enrolling?",
    a: "Many coaching centers offer a demo class, bookable directly from their profile before you commit.",
  },
];

export const footerColumns = [
  {
    title: "Product",
    links: [
      { label: "Features", href: "#features" },
      { label: "Pricing", href: "#pricing" },
      { label: "For Coaching Centers", href: "#centers" },
      { label: "For Students", href: "#students" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About", href: "#" },
      { label: "Careers", href: "#" },
      { label: "Blog", href: "#" },
      { label: "Contact", href: "#" },
    ],
  },
  {
    title: "Support",
    links: [
      { label: "Help Center", href: "#" },
      { label: "FAQ", href: "#faq" },
      { label: "Terms", href: "#" },
      { label: "Privacy", href: "#" },
    ],
  },
];

export const categories = [
  "JEE",
  "NEET",
  "UPSC",
  "CAT/MBA",
  "School Tuitions (K-12)",
  "Coding/IT",
  "Banking Exams",
  "Music/Arts",
  "GATE",
];

export const testimonials = [
  {
    quote:
      "Before Clazzo, most of our enrollments came from word of mouth. Now students find us searching by subject and area, and our batches fill up before the term even starts.",
    initial: "P",
    name: "Priya Nair",
    role: "Owner, Nair's Science Academy",
    tag: "Institute Owner",
    accent: "accent" as const,
    rating: 5,
  },
  {
    quote:
      "I compared four NEET coaching centers near me on Clazzo before picking one — same evening I booked a demo class and could see real reviews from students already enrolled.",
    initial: "A",
    name: "Ananya Rao",
    role: "NEET aspirant, Bengaluru",
    tag: "Student",
    accent: "accent-2" as const,
    rating: 5,
  },
  {
    quote:
      "Fee reminders used to eat up a whole afternoon every month. Now the dashboard tells me exactly who's due, and parents get a nudge automatically.",
    initial: "R",
    name: "Rakesh Mehta",
    role: "Director, Mehta IAS Academy",
    tag: "Institute Owner",
    accent: "accent" as const,
    rating: 5,
  },
  {
    quote:
      "I booked a free demo class before paying for anything. That alone made me trust the platform enough to enroll in a full batch.",
    initial: "F",
    name: "Farhan Sheikh",
    role: "Class 12 student, Pune",
    tag: "Student",
    accent: "accent-2" as const,
    rating: 4.5,
  },
];

export const stats = [
  { value: "500+", label: "Coaching centers", accent: "accent" as const },
  { value: "10,000+", label: "Students", accent: "accent-2" as const },
  { value: "40+", label: "Cities", accent: "accent" as const },
  { value: "4.7/5", label: "Average rating", accent: "accent-2" as const },
];

export const pricingPlans = [
  {
    id: "free",
    name: "Free",
    price: "₹0",
    description: "For centers just getting started.",
    features: ["1 batch listed", "Basic profile page", "Student inquiries via Clazzo"],
    cta: "Get started",
    ctaVariant: "btn-secondary" as const,
    highlighted: false,
  },
  {
    id: "growth",
    name: "Growth",
    price: "₹1,499",
    description: "For growing institutes with multiple batches.",
    features: ["Unlimited courses & batches", "Fee & attendance tracking", "Priority placement in search"],
    cta: "Get started",
    ctaVariant: "btn-primary" as const,
    highlighted: true,
  },
  {
    id: "pro",
    name: "Pro",
    price: "₹3,999",
    description: "For multi-branch institutes.",
    features: ["Everything in Growth", "Analytics dashboard", "Multi-branch management", "Dedicated support"],
    cta: "Get started",
    ctaVariant: "btn-secondary" as const,
    highlighted: false,
  },
];
