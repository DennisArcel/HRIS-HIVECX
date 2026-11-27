const LEFT = '<path d="M14.5 5.5 8 12l6.5 6.5"/>';
const RIGHT = '<path d="M9.5 5.5 16 12l-6.5 6.5"/>';
const BELL = '<path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15z"/><path d="M10 21a2 2 0 0 0 4 0"/>';
const USER = '<circle cx="12" cy="8.5" r="3.8"/><path d="M4.5 20c1.3-3.6 4-5.3 7.5-5.3s6.2 1.7 7.5 5.3"/>';
const X = '<path d="M6 6l12 12M18 6 6 18"/>';

const IP: Record<string, string> = {
  home: '<path d="M4 11 12 4l8 7"/><path d="M6 10.5V20h12v-9.5"/><path d="M10 20v-5h4v5"/>',
  cal: '<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 9.5h17M8 3v4M16 3v4"/>',
  plane: '<path d="M10.5 20.5 12 15l7.5-2.2a2 2 0 0 0 0-3.8L5 5.5l1.8 5.4L4 13l3 2.2L7.5 20z"/>',
  wallet: '<rect x="3" y="6" width="18" height="13" rx="2.5"/><path d="M3 10h18M16.5 14.5h1.5"/>',
  grid: '<rect x="3.5" y="3.5" width="7" height="7" rx="1.6"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.6"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.6"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.6"/>',
  users: '<circle cx="9" cy="8.5" r="3.4"/><path d="M2.5 19.5c1.2-3.2 3.7-4.8 6.5-4.8s5.3 1.6 6.5 4.8"/><path d="M16 5.6a3.4 3.4 0 0 1 0 6.6M17.5 14.9c2 .7 3.4 2.2 4 4.6"/>',
  chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  mega: '<path d="M4 10v4a1.5 1.5 0 0 0 1.5 1.5H8l7 4.5V5.5L8 10H5.5A1.5 1.5 0 0 0 4 11.5z"/><path d="M18.5 9a4.5 4.5 0 0 1 0 6"/>',
  qr: '<rect x="3.5" y="3.5" width="6.5" height="6.5" rx="1.2"/><rect x="14" y="3.5" width="6.5" height="6.5" rx="1.2"/><rect x="3.5" y="14" width="6.5" height="6.5" rx="1.2"/><path d="M14 14h2.5v2.5H14zM18 18h2.5v2.5H18zM18 14h2.5M14 18v2.5"/>',
  out: '<path d="M14 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h8"/><path d="M11 12h10M17.5 8.5 21 12l-3.5 3.5"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  moon: '<path d="M20 14.5A8.5 8.5 0 0 1 9.5 4 8.5 8.5 0 1 0 20 14.5z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5 5l1.8 1.8M17.2 17.2 19 19M19 5l-1.8 1.8M6.8 17.2 5 19"/>',

  /* added: month arrows, notification bell, profile, close (with common aliases) */
  left: LEFT, prev: LEFT, chevl: LEFT, "chevron-left": LEFT, "arrow-left": LEFT,
  right: RIGHT, next: RIGHT, chevr: RIGHT, "chevron-right": RIGHT, "arrow-right": RIGHT,
  bell: BELL, notif: BELL, notifications: BELL, notification: BELL,
  user: USER, profile: USER,
  x: X, close: X,
};

export function Icon({ name }: { name: string }) {
  if (!IP[name] && process.env.NODE_ENV !== "production") console.warn("Missing icon:", name);
  return (
    <svg
      className="i"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: IP[name] ?? "" }}
    />
  );
}