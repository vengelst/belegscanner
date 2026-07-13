export type ProblemLinkProps = {
  label: string;
  count: number;
  href?: string;
};

export function ProblemLink({ label, count, href }: ProblemLinkProps) {
  const content = (
    <div className="flex items-center justify-between rounded-xl border border-danger/20 bg-background px-3 py-2 text-sm">
      <span>{label}</span>
      <span className="ml-2 rounded-full bg-danger/10 px-2.5 py-0.5 text-xs font-semibold tabular-nums text-danger">{count}</span>
    </div>
  );
  if (href) return <a href={href} className="hover:opacity-80 transition">{content}</a>;
  return content;
}
