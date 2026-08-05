"use client";
import { useMemo, useState } from "react";
import { collections as seed, flats, rounds } from "@/lib/mock-data";
import { inr, fmtDateDMY, formatPhone } from "@/lib/format";
import { useRole } from "@/context/RoleContext";
import type { Collection, Flat, PaymentMode } from "@/lib/types";

type ViewTab = "history" | "pending";

const BADGE_COLORS = [
  "bg-emerald-500",
  "bg-violet-500",
  "bg-teal-500",
  "bg-sky-500",
  "bg-rose-500",
  "bg-amber-500",
  "bg-indigo-500",
  "bg-fuchsia-500",
];

function badgeColor(flatId: string) {
  let h = 0;
  for (let i = 0; i < flatId.length; i++) h = (h + flatId.charCodeAt(i) * (i + 1)) % BADGE_COLORS.length;
  return BADGE_COLORS[h];
}

function unitLabel(flat: Flat | string) {
  if (typeof flat === "string") {
    const f = flats.find((x) => x.id === flat);
    if (!f) return flat.replace(/^B-/, "");
    return String(f.floor * 100 + f.unit);
  }
  return String(flat.floor * 100 + flat.unit);
}

function shortRound(name: string) {
  return name
    .replace("Monthly Maintenance — ", "")
    .replace(" Repair Fund ", " ")
    .trim();
}

export default function CollectionsPage() {
  const { perms, role } = useRole();
  const [list, setList] = useState<Collection[]>(() => [...seed].sort((a, b) => b.date.localeCompare(a.date)));
  const [tab, setTab] = useState<ViewTab>("history");
  const [flatQ, setFlatQ] = useState("");
  const [roundId, setRoundId] = useState(rounds[0]?.id ?? "all");
  const [modeFilter, setModeFilter] = useState<"all" | PaymentMode>("all");
  const [showForm, setShowForm] = useState(false);

  const [formFlatId, setFormFlatId] = useState(() => flats.find((f) => f.status === "sold")?.id ?? flats[0].id);
  const [formAmount, setFormAmount] = useState(rounds[0]?.amount ?? 1500);
  const [formMode, setFormMode] = useState<PaymentMode>("cash");
  const [formRoundId, setFormRoundId] = useState(rounds[0].id);

  const soldFlats = useMemo(() => flats.filter((f) => f.status === "sold"), []);

  const activeRoundId = roundId === "all" ? rounds[0]?.id : roundId;
  const activeRound = rounds.find((r) => r.id === activeRoundId) ?? rounds[0];

  const paidFlatIdsForRound = useMemo(() => {
    return new Set(list.filter((c) => c.roundId === activeRoundId).map((c) => c.flatId));
  }, [list, activeRoundId]);

  const pendingFlats = useMemo(() => {
    const q = flatQ.trim().toLowerCase().replace(/\s/g, "").replace(/^b-/, "");
    return soldFlats
      .filter((f) => !paidFlatIdsForRound.has(f.id))
      .filter((f) => {
        if (!q) return true;
        const unit = String(f.floor * 100 + f.unit);
        const flatNo = f.flatNo.toLowerCase().replace(/^b-/, "");
        const owner = f.ownerName.toLowerCase().replace(/\s/g, "");
        return flatNo.includes(q) || unit.includes(q) || owner.includes(q) || f.ownerPhone.includes(q);
      })
      .sort((a, b) => a.floor - b.floor || a.unit - b.unit);
  }, [soldFlats, paidFlatIdsForRound, flatQ]);

  const roundStats = useMemo(() => {
    return rounds.map((r) => {
      const paid = new Set(list.filter((c) => c.roundId === r.id).map((c) => c.flatId));
      const collected = paid.size;
      const pending = soldFlats.length - collected;
      return {
        round: r,
        collected,
        pending,
        pendingAmount: pending * r.amount,
        total: soldFlats.length,
      };
    });
  }, [list, soldFlats]);

  const filteredPayments = useMemo(() => {
    const q = flatQ.trim().toLowerCase().replace(/\s/g, "").replace(/^b-/, "");
    return list.filter((c) => {
      if (roundId !== "all" && c.roundId !== roundId) return false;
      if (modeFilter !== "all" && c.mode !== modeFilter) return false;
      if (!q) return true;
      const flat = flats.find((f) => f.id === c.flatId);
      if (!flat) return false;
      const unit = String(flat.floor * 100 + flat.unit);
      const flatNo = flat.flatNo.toLowerCase().replace(/\s/g, "").replace(/^b-/, "");
      const owner = flat.ownerName.toLowerCase().replace(/\s/g, "");
      return flatNo.includes(q) || unit.includes(q) || owner.includes(q) || flat.ownerPhone.includes(q);
    });
  }, [list, flatQ, roundId, modeFilter]);

  const shownTotal = filteredPayments.reduce((s, c) => s + c.amount, 0);
  const pendingTotal = pendingFlats.length * (activeRound?.amount ?? 0);
  const collectedCount = soldFlats.length - pendingFlats.length;

  const hasFilters =
    flatQ.trim() !== "" ||
    modeFilter !== "all" ||
    (tab === "history" && roundId !== "all");

  function clearFilters() {
    setFlatQ("");
    setModeFilter("all");
    if (tab === "history") setRoundId("all");
  }

  function selectPendingFlat(f: Flat) {
    setFlatQ(String(f.floor * 100 + f.unit));
  }

  function openCollect(f: Flat) {
    setFormFlatId(f.id);
    setFormRoundId(activeRoundId);
    setFormAmount(activeRound?.amount ?? 1500);
    setFormMode("cash");
    setShowForm(true);
    setTab("history");
    setFlatQ(String(f.floor * 100 + f.unit));
    setRoundId(activeRoundId);
  }

  function remindHref(f: Flat) {
    const text = `KCT-3 B-Wing Reminder\n\nFlat: ${f.flatNo}\nOwner: ${f.ownerName}\nPending: ${shortRound(activeRound?.name ?? "")} — ${inr(activeRound?.amount ?? 0)}\n\nકૃપા કરીને જલ્દી જમા કરાવો.`;
    return "https://wa.me/91" + f.ownerPhone + "?text=" + encodeURIComponent(text);
  }

  function shareCollection(c: Collection) {
    const flat = flats.find((f) => f.id === c.flatId);
    const round = rounds.find((r) => r.id === c.roundId);
    const text = `KCT-3 B-Wing Collection\nFlat: ${flat?.flatNo ?? c.flatId}\nOwner: ${flat?.ownerName ?? "-"}\nAmount: ${inr(c.amount)}\nMode: ${c.mode}\nPurpose: ${round?.name ?? c.roundId}\nDate: ${fmtDateDMY(c.date)}`;
    return "https://wa.me/" + (flat?.ownerPhone ? "91" + flat.ownerPhone : "") + "?text=" + encodeURIComponent(text);
  }

  function add() {
    if (!formAmount || formAmount <= 0) return;
    setList((l) => [
      {
        id: "c" + Date.now(),
        flatId: formFlatId,
        amount: formAmount,
        date: new Date().toISOString().slice(0, 10),
        mode: formMode,
        roundId: formRoundId,
        createdBy: role,
        sharedToGroup: false,
      },
      ...l,
    ]);
    setShowForm(false);
    setTab("history");
    setFlatQ(formFlatId.replace(/^B-/, ""));
    setRoundId(formRoundId);
  }

  const historyCount = list.length;
  const pendingCountForActive = soldFlats.filter((f) => !paidFlatIdsForRound.has(f.id)).length;

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
        <h1 className="text-[15px] font-bold text-navy">Search by Flat No — Payment History & Dues</h1>
        <p className="mt-1 text-xs leading-relaxed text-slate-500">
          ફ્લેટથી શોધો · Pending ટેબમાં બાકી માલિકો જુઓ · WhatsAppથી યાદ અપાવો.
        </p>

        {/* Main tabs */}
        <div className="mt-3 grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1">
          <button
            type="button"
            onClick={() => setTab("history")}
            className={
              "rounded-lg py-2 text-sm font-semibold transition " +
              (tab === "history" ? "bg-white text-navy shadow-sm" : "text-slate-500")
            }
          >
            History
            <span className={"ml-1.5 text-[11px] " + (tab === "history" ? "text-brand" : "text-slate-400")}>
              {historyCount}
            </span>
          </button>
          <button
            type="button"
            onClick={() => {
              setTab("pending");
              if (roundId === "all") setRoundId(rounds[0].id);
              setModeFilter("all");
            }}
            className={
              "rounded-lg py-2 text-sm font-semibold transition " +
              (tab === "pending" ? "bg-white text-navy shadow-sm" : "text-slate-500")
            }
          >
            Pending
            <span
              className={
                "ml-1.5 rounded-full px-1.5 py-0.5 text-[11px] " +
                (tab === "pending" ? "bg-amber-100 text-amber-700" : "bg-slate-200 text-slate-500")
              }
            >
              {pendingCountForActive}
            </span>
          </button>
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
          <label className="block">
            <span className="mb-1 block text-[11px] font-medium text-slate-500">Flat No / Owner</span>
            <input
              value={flatQ}
              onChange={(e) => setFlatQ(e.target.value)}
              placeholder="e.g. 201"
              className="w-full rounded-xl border border-brand/30 bg-brand/5 px-3 py-2.5 text-sm outline-none focus:border-brand focus:bg-white"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-[11px] font-medium text-slate-500">Purpose (Round)</span>
            <select
              value={tab === "pending" ? activeRoundId : roundId}
              onChange={(e) => setRoundId(e.target.value)}
              className="w-full rounded-xl border border-brand/30 bg-brand/5 px-3 py-2.5 text-sm outline-none focus:border-brand focus:bg-white"
            >
              {tab === "history" && <option value="all">All rounds</option>}
              {rounds.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </label>

          <div className="flex items-end">
            <button
              type="button"
              onClick={clearFilters}
              disabled={!hasFilters}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-600 disabled:opacity-40 sm:w-auto"
            >
              Clear
            </button>
          </div>
        </div>

        {tab === "history" && (
          <div className="mt-3 flex flex-wrap gap-2">
            {(["all", "cash", "bank"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setModeFilter(m)}
                className={
                  "rounded-full border px-3 py-1 text-xs font-medium capitalize transition " +
                  (modeFilter === m
                    ? "border-brand bg-brand text-white"
                    : "border-slate-200 bg-white text-slate-500")
                }
              >
                {m === "all" ? "All modes" : m}
              </button>
            ))}
          </div>
        )}

        {/* Round progress */}
        <ul className="mt-3 space-y-1.5">
          {roundStats.map((s) => (
            <li key={s.round.id} className="flex gap-2 text-xs leading-relaxed text-slate-600">
              <span className="mt-0.5 text-amber-500" aria-hidden>
                ◆
              </span>
              <button
                type="button"
                className="text-left"
                onClick={() => {
                  setRoundId(s.round.id);
                  if (s.pending > 0) setTab("pending");
                }}
              >
                <span className="font-semibold text-navy">{shortRound(s.round.name)}:</span> {s.total} માંથી{" "}
                <span className="font-semibold text-emerald-600">{s.collected}</span> જમા ·{" "}
                <span className="font-semibold text-amber-600">{s.pending}</span> બાકી
                {s.pending > 0 && <span className="text-slate-400"> ({inr(s.pendingAmount)})</span>}
              </button>
            </li>
          ))}
        </ul>

        {/* Pending chips when on pending tab */}
        {tab === "pending" && (
          <div className="mt-3 border-t border-slate-100 pt-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-xs font-semibold text-amber-700">
                {shortRound(activeRound?.name ?? "")} — {pendingFlats.length} flats pending · {inr(pendingTotal)}
              </p>
              <p className="text-[11px] text-slate-400">{collectedCount} collected</p>
            </div>
            {pendingFlats.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {pendingFlats.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => selectPendingFlat(f)}
                    className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white py-1 pl-1 pr-2.5 text-left shadow-sm transition hover:border-brand/40"
                    title={f.ownerName}
                  >
                    <span
                      className={
                        "flex h-6 min-w-6 items-center justify-center rounded-full px-1.5 text-[10px] font-bold text-white " +
                        badgeColor(f.id)
                      }
                    >
                      {unitLabel(f)}
                    </span>
                    <span className="max-w-[88px] truncate text-[11px] font-medium text-slate-600">{f.ownerName}</span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-xs text-emerald-600">આ રાઉન્ડ માટે બધું ક્લિયર ✓</p>
            )}
          </div>
        )}
      </section>

      {perms.canAddFinancial && (
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="text-xs font-semibold text-brand hover:underline"
        >
          {showForm ? "✕ Close form" : "+ Add Collection"}
        </button>
      )}

      {showForm && (
        <section className="space-y-3 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-bold text-navy">New collection</h2>
          <select
            value={formFlatId}
            onChange={(e) => setFormFlatId(e.target.value)}
            className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-brand"
          >
            {soldFlats.map((f) => (
              <option key={f.id} value={f.id}>
                {f.flatNo} — {f.ownerName}
              </option>
            ))}
          </select>
          <select
            value={formRoundId}
            onChange={(e) => {
              setFormRoundId(e.target.value);
              const r = rounds.find((x) => x.id === e.target.value);
              if (r) setFormAmount(r.amount);
            }}
            className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-brand"
          >
            {rounds.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name} ({inr(r.amount)})
              </option>
            ))}
          </select>
          <input
            type="number"
            value={formAmount}
            onChange={(e) => setFormAmount(Number(e.target.value))}
            className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-brand"
          />
          <div className="flex gap-2">
            {(["cash", "bank"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setFormMode(m)}
                className={
                  "flex-1 rounded-xl border px-3 py-2 text-sm capitalize " +
                  (formMode === m ? "border-brand bg-brand/5 font-medium text-brand" : "border-slate-200 text-slate-600")
                }
              >
                {m}
              </button>
            ))}
          </div>
          <button type="button" onClick={add} className="w-full rounded-xl bg-navy py-2.5 text-sm font-medium text-white">
            Save collection
          </button>
        </section>
      )}

      {tab === "history" ? (
        <>
          <div className="flex items-end justify-between px-0.5">
            <div className="text-xs text-slate-400">
              {filteredPayments.length} payment{filteredPayments.length === 1 ? "" : "s"}
            </div>
            <div className="text-right">
              <div className="text-[10px] uppercase tracking-wide text-slate-400">Shown total</div>
              <div className="text-sm font-bold tabular-nums text-brand">{inr(shownTotal)}</div>
            </div>
          </div>

          <section className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
            <ul className="divide-y divide-slate-100">
              {filteredPayments.map((c) => {
                const flat = flats.find((f) => f.id === c.flatId);
                const round = rounds.find((r) => r.id === c.roundId);
                return (
                  <li key={c.id} className="px-3 py-3 sm:px-4">
                    <div className="flex items-start gap-2.5">
                      <span
                        className={
                          "mt-0.5 flex h-8 min-w-8 shrink-0 items-center justify-center rounded-full px-2 text-[11px] font-bold text-white " +
                          badgeColor(c.flatId)
                        }
                      >
                        {unitLabel(c.flatId)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="truncate font-bold text-navy">{flat?.ownerName ?? "—"}</div>
                            <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-400">
                              <span className="tabular-nums">{fmtDateDMY(c.date)}</span>
                              <span className="text-slate-300">·</span>
                              <span className="rounded bg-slate-100 px-1.5 py-0.5 capitalize text-slate-500">{c.mode}</span>
                              <span className="text-slate-300">·</span>
                              <span className="truncate">{shortRound(round?.name ?? c.roundId)}</span>
                            </div>
                          </div>
                          <div className="shrink-0 text-base font-bold tabular-nums text-brand">{inr(c.amount)}</div>
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-1.5">
                          {flat?.ownerPhone && (
                            <a
                              href={shareCollection(c)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-white px-2.5 py-1 text-[11px] font-medium text-emerald-600 hover:bg-emerald-50"
                              title={formatPhone(flat.ownerPhone)}
                            >
                              <span aria-hidden>🟢</span>
                              WhatsApp
                            </a>
                          )}
                          {c.sharedToGroup ? (
                            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-600">
                              ✓ Sent
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-600">
                              Pending share
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
            {filteredPayments.length === 0 && (
              <p className="py-10 text-center text-sm text-slate-400">No payments match your filters.</p>
            )}
          </section>
        </>
      ) : (
        <>
          <div className="flex items-end justify-between px-0.5">
            <div className="text-xs text-slate-400">
              Pending for <span className="font-medium text-navy">{shortRound(activeRound?.name ?? "")}</span>
            </div>
            <div className="text-right">
              <div className="text-[10px] uppercase tracking-wide text-slate-400">Pending total</div>
              <div className="text-sm font-bold tabular-nums text-amber-600">{inr(pendingTotal)}</div>
            </div>
          </div>

          <section className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
            <ul className="divide-y divide-slate-100">
              {pendingFlats.map((f) => (
                <li key={f.id} className="px-3 py-3 sm:px-4">
                  <div className="flex items-start gap-2.5">
                    <span
                      className={
                        "mt-0.5 flex h-8 min-w-8 shrink-0 items-center justify-center rounded-full px-2 text-[11px] font-bold text-white " +
                        badgeColor(f.id)
                      }
                    >
                      {unitLabel(f)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="truncate font-bold text-navy">{f.ownerName}</div>
                          <div className="mt-0.5 text-[11px] text-slate-400">
                            {f.flatNo}
                            {f.ownerPhone ? ` · ${formatPhone(f.ownerPhone)}` : ""}
                          </div>
                        </div>
                        <div className="shrink-0 text-base font-bold tabular-nums text-amber-600">
                          {inr(activeRound?.amount ?? 0)}
                        </div>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        {f.ownerPhone && (
                          <a
                            href={remindHref(f)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-white px-2.5 py-1 text-[11px] font-medium text-emerald-600 hover:bg-emerald-50"
                          >
                            <span aria-hidden>🟢</span>
                            Remind
                          </a>
                        )}
                        {perms.canAddFinancial && (
                          <button
                            type="button"
                            onClick={() => openCollect(f)}
                            className="inline-flex items-center rounded-lg border border-brand/30 bg-brand/5 px-2.5 py-1 text-[11px] font-semibold text-brand hover:bg-brand/10"
                          >
                            + Collect
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
            {pendingFlats.length === 0 && (
              <p className="py-10 text-center text-sm text-emerald-600">No pending flats for this round.</p>
            )}
          </section>
        </>
      )}
    </div>
  );
}
