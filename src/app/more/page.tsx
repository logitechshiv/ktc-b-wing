import Link from "next/link";

const modules = [
  { name: "Dues", desc: "Pending by flat", icon: "📌", href: "/dues" },
  { name: "Notices", desc: "Announcements board", icon: "📢", href: "/notices" },
  { name: "Charge Rounds", desc: "Create dues rounds", icon: "🧾" },
  { name: "Fund Transfer", desc: "Cash → Bank", icon: "🔁" },
  { name: "Complaints", desc: "Maintenance requests", icon: "🛠️" },
  { name: "Documents", desc: "AGM, accounts, bylaws", icon: "📁" },
  { name: "Reports", desc: "CSV & PDF export", icon: "📊" },
  { name: "Users", desc: "Admins & roles", icon: "👤" },
  { name: "Settings", desc: "Society info", icon: "⚙️" },
];

export default function MorePage() {
  return (
    <div className="space-y-4">
      <h1 className="text-lg font-bold text-navy">More</h1>
      <div className="grid grid-cols-2 gap-3">
        {modules.map((m) => {
          const body = (
            <>
              <div className="text-2xl">{m.icon}</div>
              <div className="mt-2 font-medium text-slate-800">{m.name}</div>
              <div className="text-xs text-slate-400">{m.desc}</div>
              {"href" in m && m.href ? (
                <span className="mt-2 inline-block rounded-full bg-brand/10 px-2 py-0.5 text-[10px] font-medium text-brand">
                  Open
                </span>
              ) : (
                <span className="mt-2 inline-block rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500">
                  Coming soon
                </span>
              )}
            </>
          );
          if ("href" in m && m.href) {
            return (
              <Link
                key={m.name}
                href={m.href}
                className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm transition hover:border-brand/30"
              >
                {body}
              </Link>
            );
          }
          return (
            <div key={m.name} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
              {body}
            </div>
          );
        })}
      </div>
    </div>
  );
}
