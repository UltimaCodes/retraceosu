// self-contained scroller so long lists don't stretch the page
export function ScrollBox({
  children,
  maxH = "max-h-72",
}: {
  children: React.ReactNode;
  maxH?: string;
}) {
  return (
    <div className={`${maxH} space-y-2 overflow-y-auto rounded-lg bg-black/10 p-1.5 pr-2`}>
      {children}
    </div>
  );
}
