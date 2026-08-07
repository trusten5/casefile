import Link from "next/link";
import { Avatar } from "@/components/Avatar";

export type ContactTreeNode = {
  id: string;
  name: string;
  role: string | null;
  companyName: string | null;
  children: ContactTreeNode[];
};

type Category = { value: string; label: string; roots: ContactTreeNode[] };

function TreeNode({ node }: { node: ContactTreeNode }) {
  const detail = [node.role, node.companyName].filter(Boolean).join(" — ");
  return (
    <li>
      <Link
        href={`/contacts/${node.id}`}
        className="flex min-w-0 items-center gap-2 rounded py-1 hover:bg-tab/10"
      >
        <Avatar name={node.name} />
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium text-ink">{node.name}</span>
          {detail && <span className="block truncate text-xs text-ink-soft">{detail}</span>}
        </span>
      </Link>
      {node.children.length > 0 && (
        <ul className="ml-4 space-y-1 border-l border-paper-line pl-4">
          {node.children.map((child) => (
            <TreeNode key={child.id} node={child} />
          ))}
        </ul>
      )}
    </li>
  );
}

// A referral chain (A introduced you to B introduced you to C) nests as
// children under the referring contact regardless of category; a contact
// with no specific referrer roots under its "how met" category instead.
// Hand-rolled nested <ul>s rather than an SVG node-link diagram — the tree's
// depth/width varies per user, and the browser's own block layout handles
// that without a positioning algorithm to get right.
export function ContactTree({ categories }: { categories: Category[] }) {
  const active = categories.filter((c) => c.roots.length > 0);

  if (active.length === 0) {
    return (
      <p className="mt-3 text-sm text-ink-soft">
        Add a few contacts (and who introduced you, if anyone) to see how your network connects.
      </p>
    );
  }

  return (
    <div className="mt-3 grid gap-4 sm:grid-cols-2">
      {active.map((cat) => (
        <div key={cat.value} className="rounded border border-paper-line bg-tab/10 p-4">
          <p className="font-mono text-xs uppercase tracking-wide text-ink-soft">{cat.label}</p>
          <ul className="mt-3 space-y-1">
            {cat.roots.map((root) => (
              <TreeNode key={root.id} node={root} />
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
