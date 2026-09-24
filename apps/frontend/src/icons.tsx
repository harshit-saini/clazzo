interface IconProps {
  size?: number;
  color?: string;
  strokeWidth?: number;
}

const base = (size: number) => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
});

export function SchoolIcon({ size = 24, color = "currentColor", strokeWidth = 2.75 }: IconProps) {
  return (
    <svg {...base(size)} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 21h18" />
      <path d="M5 21V7l7-4 7 4v14" />
      <path d="M9 21v-6h6v6" />
    </svg>
  );
}

export function UsersIcon({ size = 24, color = "currentColor", strokeWidth = 2.75 }: IconProps) {
  return (
    <svg {...base(size)} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

export function FeeIcon({ size = 24, color = "currentColor", strokeWidth = 2.75 }: IconProps) {
  return (
    <svg {...base(size)} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <rect width="20" height="14" x="2" y="5" rx="2" />
      <line x1="2" x2="22" y1="10" y2="10" />
    </svg>
  );
}

export function SearchIcon({ size = 24, color = "currentColor", strokeWidth = 2.75 }: IconProps) {
  return (
    <svg {...base(size)} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

export function FilterIcon({ size = 24, color = "currentColor", strokeWidth = 2.75 }: IconProps) {
  return (
    <svg {...base(size)} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <line x1="5" x2="5" y1="19" y2="5" />
      <circle cx="5" cy="10" r="2" />
      <line x1="12" x2="12" y1="19" y2="5" />
      <circle cx="12" cy="15" r="2" />
      <line x1="19" x2="19" y1="19" y2="5" />
      <circle cx="19" cy="8" r="2" />
    </svg>
  );
}

export function GraduationCapIcon({ size = 24, color = "currentColor", strokeWidth = 2.75 }: IconProps) {
  return (
    <svg {...base(size)} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 10 12 5 2 10l10 5 10-5Z" />
      <path d="M6 12v5c0 1.66 2.69 3 6 3s6-1.34 6-3v-5" />
    </svg>
  );
}

export function StarOutlineIcon({ size = 24, color = "currentColor", strokeWidth = 1.5 }: IconProps) {
  return (
    <svg {...base(size)} fill="none" stroke={color} strokeWidth={strokeWidth}>
      <path d="m12 2 3.09 6.26L22 9.27l-5 4.87L18.18 21 12 17.77 5.82 21 7 14.14l-5-4.87 6.91-1.01L12 2Z" />
    </svg>
  );
}

export function StarFilledIcon({ size = 24, color = "currentColor" }: IconProps) {
  return (
    <svg {...base(size)} fill={color} stroke="none">
      <path d="m12 2 3.09 6.26L22 9.27l-5 4.87L18.18 21 12 17.77 5.82 21 7 14.14l-5-4.87 6.91-1.01L12 2Z" />
    </svg>
  );
}

export function VideoIcon({ size = 24, color = "currentColor", strokeWidth = 2.75 }: IconProps) {
  return (
    <svg {...base(size)} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <path d="m22 8-6 4 6 4V8Z" />
      <rect width="14" height="12" x="2" y="6" rx="2" />
    </svg>
  );
}

export function CalendarIcon({ size = 24, color = "currentColor", strokeWidth = 2.75 }: IconProps) {
  return (
    <svg {...base(size)} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <rect width="18" height="18" x="3" y="4" rx="2" />
      <line x1="16" x2="16" y1="2" y2="6" />
      <line x1="8" x2="8" y1="2" y2="6" />
      <line x1="3" x2="21" y1="10" y2="10" />
    </svg>
  );
}

export function AttendanceIcon({ size = 24, color = "currentColor", strokeWidth = 2.75 }: IconProps) {
  return (
    <svg {...base(size)} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <rect width="8" height="4" x="8" y="2" rx="1" />
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <path d="m9 14 2 2 4-4" />
    </svg>
  );
}

export function BarChartIcon({ size = 24, color = "currentColor", strokeWidth = 2.75 }: IconProps) {
  return (
    <svg {...base(size)} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 3v18h18" />
      <path d="M18 17V9" />
      <path d="M13 17V5" />
      <path d="M8 17v-3" />
    </svg>
  );
}

export function CheckCircleIcon({ size = 24, color = "currentColor", strokeWidth = 2.75 }: IconProps) {
  return (
    <svg {...base(size)} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

export function ShieldCheckIcon({ size = 24, color = "currentColor", strokeWidth = 2.75 }: IconProps) {
  return (
    <svg {...base(size)} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

export function CheckIcon({ size = 24, color = "currentColor", strokeWidth = 3 }: IconProps) {
  return (
    <svg {...base(size)} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

export function MenuIcon({ size = 24, color = "currentColor", strokeWidth = 2.75 }: IconProps) {
  return (
    <svg {...base(size)} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <line x1="4" x2="20" y1="6" y2="6" />
      <line x1="4" x2="20" y1="12" y2="12" />
      <line x1="4" x2="20" y1="18" y2="18" />
    </svg>
  );
}

export function ChevronRightIcon({ size = 24, color = "currentColor", strokeWidth = 2.75 }: IconProps) {
  return (
    <svg {...base(size)} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 18l6-6-6-6" />
    </svg>
  );
}

export function PlusIcon({ size = 24, color = "currentColor", strokeWidth = 2.75 }: IconProps) {
  return (
    <svg {...base(size)} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function XIcon({ size = 24, color = "currentColor", strokeWidth = 2.75 }: IconProps) {
  return (
    <svg {...base(size)} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}

export function InstagramIcon({ size = 24, color = "currentColor", strokeWidth = 2.75 }: IconProps) {
  return (
    <svg {...base(size)} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <rect width="20" height="20" x="2" y="2" rx="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
    </svg>
  );
}

export function LinkedinIcon({ size = 24, color = "currentColor", strokeWidth = 2.75 }: IconProps) {
  return (
    <svg {...base(size)} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4V8h4v1.5A5 5 0 0 1 16 8z" />
      <rect width="4" height="12" x="2" y="9" />
      <circle cx="4" cy="4" r="2" />
    </svg>
  );
}

export function FacebookIcon({ size = 24, color = "currentColor", strokeWidth = 2.75 }: IconProps) {
  return (
    <svg {...base(size)} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
    </svg>
  );
}
