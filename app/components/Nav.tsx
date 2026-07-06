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
    <nav className="sticky top-0 z-20 border-b border-line bg-[#231b20]">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
        <Link href="/" className="font-display text-xl font-bold tracking-tight text-white">
          Re<span className="text-pink">trace</span>
        </Link>
        <div className="flex items-center gap-3 text-sm sm:gap-4">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`font-medium transition hover:text-pink ${
                active === l.href ? "text-pink" : "text-white/60"
              }`}
            >
              {l.label}
            </Link>
          ))}
          {signOut && (
            <form action="/api/auth/logout" method="post">
              <button className="text-white/50 transition hover:text-white">Sign out</button>
            </form>
          )}
        </div>
      </div>
    </nav>
  );
}
