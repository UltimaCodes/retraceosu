import Link from "next/link";

const LINKS = [
  { href: "/analyze", label: "Analyze" },
  { href: "/history", label: "History" },
  { href: "/farm", label: "Farm" },
  { href: "/player", label: "Players" },
  { href: "/compare", label: "Compare" },
  { href: "/country", label: "Countries" },
];

export function Nav({ active, signOut }: { active?: string; signOut?: boolean }) {
  return (
    <nav className="sticky top-0 z-20 border-b border-line bg-[#231b20]/95 shadow-[0_1px_12px_rgba(0,0,0,0.35)] backdrop-blur-sm">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
        <Link href="/" className="font-display text-xl font-bold tracking-tight text-white">
          Re<span className="text-pink">trace</span>
        </Link>
        <div className="flex h-full items-center gap-1 text-sm sm:gap-2">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`relative flex h-full items-center px-2 font-medium transition hover:text-white sm:px-2.5 ${
                active === l.href
                  ? "text-white after:absolute after:inset-x-1 after:bottom-0 after:h-[3px] after:rounded-t-full after:bg-pink"
                  : "text-white/60"
              }`}
            >
              {l.label}
            </Link>
          ))}
          {signOut && (
            <form action="/api/auth/logout" method="post" className="ml-1">
              <button className="text-white/50 transition hover:text-white">Sign out</button>
            </form>
          )}
        </div>
      </div>
    </nav>
  );
}
