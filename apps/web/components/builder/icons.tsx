export const ICONS = {
  bolt: "M13 2L3 14h8l-1 8 10-12h-8z",
  clock: "M12 2a10 10 0 1 0 0 20a10 10 0 1 0 0-20zM12 6v6l4 2",
  mail: "M3 5h18v14H3zM3 7l9 6 9-6",
  rows: "M3 3h18v18H3zM3 9h18M3 15h18M9 3v18",
  chat: "M21 12a8 8 0 0 1-11.5 7.2L3 21l1.8-6A8 8 0 1 1 21 12z",
  filter: "M3 4h18l-7 8v7l-4 2v-9z",
  timer: "M12 2a10 10 0 1 0 0 20a10 10 0 1 0 0-20zM12 6v6",
  okBadge: "M12 2a10 10 0 1 0 0 20a10 10 0 1 0 0-20zM9 12l2 2 4-4",
  idleBadge: "M12 2a10 10 0 1 0 0 20a10 10 0 1 0 0-20zM12 6v6l4 2",
};

export function Icon({ d, size = 16, className = "" }: { d: string; size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d={d} />
    </svg>
  );
}
