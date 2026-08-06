import type { Flat, ChargeRound, Collection, Expense, FundTransfer, FlatDue, Vehicle, Notice } from "./types";

const OWNERS = [
  "રાજેશ પટેલ",
  "નિલેશ શાહ",
  "અમિત દેસાઈ",
  "કિરણ મહેતા",
  "ભાવિન જોશી",
  "સંજય ત્રિવેદી",
  "હાર્દિક પંચાલ",
  "મિતેશ વોરા",
  "પરેશ ગાંધી",
  "ધવલ મોદી",
  "જયેશ સોલંકી",
  "રોનક શાહ",
  "વિશાલ ચૌહાણ",
  "કેતન ભટ્ટ",
  "અલ્પેશ રાણા",
  "મનીષ પરમાર",
  "તેજસ શાહ",
  "રાકેશ અમીન",
  "ચિરાગ દવે",
  "નિકુંજ પંડ્યા",
  "હિતેશ પટેલ",
  "દર્શન શાહ",
  "આશિષ રાવલ",
  "જિગ્નેશ શેલડિયા",
  "પ્રતિક શાહ",
];

// 6 unsold (builder) flats
const UNSOLD = new Set(["B-904", "B-1004", "B-1104", "B-1203", "B-1303", "B-1304"]);

/** Sample flats currently on rent (owner remains for dues) */
const ON_RENT: Record<string, { name: string; phone: string }> = {
  "B-102": { name: "મેહુલ જોશી", phone: "9876512345" },
  "B-205": { name: "સ્નેહા રાવલ", phone: "9823456789" },
  "B-403": { name: "કૌશિક પટેલ", phone: "9898765432" },
  "B-701": { name: "પ્રિયા શાહ", phone: "9811223344" },
};

export const flats: Flat[] = (() => {
  const list: Flat[] = [];
  let i = 0;
  for (let floor = 1; floor <= 13; floor++) {
    for (let unit = 1; unit <= 4; unit++) {
      const num = floor * 100 + unit;
      const flatNo = "B-" + num;
      const unsold = UNSOLD.has(flatNo);
      const owner = OWNERS[i % OWNERS.length];
      const rent = !unsold ? ON_RENT[flatNo] : undefined;
      list.push({
        id: flatNo,
        wing: "B",
        flatNo,
        floor,
        unit,
        ownerName: unsold ? "કોઈ માલિક નથી" : owner,
        ownerPhone: unsold ? "" : "98" + String(250000000 + i * 13337).slice(0, 8),
        status: unsold ? "unsold" : "sold",
        onRent: !!rent,
        renterName: rent?.name,
        renterPhone: rent?.phone,
      });
      i++;
    }
  }
  return list;
})();

export const rounds: ChargeRound[] = [
  { id: "r-aug25", name: "Monthly Maintenance — Aug 2025", amount: 1500, date: "2025-08-01" },
  { id: "r-lift", name: "Lift Repair Fund 2025", amount: 2000, date: "2025-07-10" },
];

const PENDING_MONTHLY = new Set(["B-102", "B-204", "B-301", "B-403", "B-502", "B-604", "B-701", "B-803"]);

export const collections: Collection[] = (() => {
  const cols: Collection[] = [];
  let n = 0;
  const sold = flats.filter((f) => f.status === "sold");
  // Monthly maintenance
  sold.forEach((f, idx) => {
    if (!PENDING_MONTHLY.has(f.flatNo)) {
      cols.push({
        id: "c" + ++n,
        flatId: f.id,
        amount: 1500,
        date: "2025-08-0" + ((idx % 9) + 1),
        mode: idx % 2 === 0 ? "bank" : "cash",
        roundId: "r-aug25",
        createdBy: "editor",
        sharedToGroup: idx % 4 !== 0,
      });
    }
  });
  // Lift fund (first 30 sold flats have paid)
  sold.slice(0, 30).forEach((f, idx) => {
    cols.push({
      id: "c" + ++n,
      flatId: f.id,
      amount: 2000,
      date: "2025-07-1" + (idx % 9),
      mode: idx % 3 === 0 ? "cash" : "bank",
      roundId: "r-lift",
      createdBy: "superadmin",
      sharedToGroup: idx % 3 !== 0,
    });
  });
  return cols;
})();

export const expenses: Expense[] = [
  {
    id: "e1",
    name: "સિક્યોરિટી સ્ટાફ પે — ઓગસ્ટ",
    amount: 18000,
    date: "2025-08-05",
    category: "Security",
    paidFrom: "bank",
    createdBy: "superadmin",
    hasBill: true,
    sharedToGroup: true,
  },
  {
    id: "e2",
    name: "હાઉસકીપિંગ સર્વિસ",
    amount: 8000,
    date: "2025-08-04",
    category: "Housekeeping",
    paidFrom: "cash",
    createdBy: "superadmin",
    hasBill: true,
    sharedToGroup: true,
  },
  {
    id: "e3",
    name: "કોમન લાઇટ બિલ",
    amount: 6500,
    date: "2025-08-03",
    category: "Electricity",
    paidFrom: "bank",
    createdBy: "superadmin",
    hasBill: true,
    sharedToGroup: false,
  },
  {
    id: "e4",
    name: "વોટર ટેન્કર",
    amount: 3000,
    date: "2025-08-02",
    category: "Water",
    paidFrom: "cash",
    createdBy: "superadmin",
    sharedToGroup: true,
  },
  {
    id: "e5",
    name: "લિફ્ટ સર્વિસિંગ",
    amount: 4500,
    date: "2025-07-28",
    category: "Lift",
    paidFrom: "bank",
    createdBy: "superadmin",
    hasBill: true,
    sharedToGroup: true,
  },
  {
    id: "e6",
    name: "સ્વતંત્રતા દિવસ કાર્યક્રમ",
    amount: 1080,
    date: "2025-08-15",
    category: "Event",
    paidFrom: "cash",
    createdBy: "editor",
    sharedToGroup: true,
  },
  {
    id: "e7",
    name: "B-502 પ્લમ્બિંગ રિપેર",
    amount: 2500,
    date: "2025-07-22",
    category: "Flat Expense",
    paidFrom: "cash",
    createdBy: "editor",
    hasBill: true,
    sharedToGroup: false,
  },
  {
    id: "e8",
    name: "ગાર્ડન મેઈન્ટેનન્સ",
    amount: 2200,
    date: "2025-07-18",
    category: "Maintenance",
    paidFrom: "bank",
    createdBy: "superadmin",
    sharedToGroup: true,
  },
];
export const fundTransfers: FundTransfer[] = [
  { id: "t1", amount: 20000, date: "2025-08-01", createdBy: "superadmin" },
];

const PLATE_SERIES = ["HX", "RQ", "PK", "AB", "CD", "EF", "GH", "JK", "LM", "NP"];

export const vehicles: Vehicle[] = (() => {
  const list: Vehicle[] = [];
  let n = 0;
  const sold = flats.filter((f) => f.status === "sold");
  sold.forEach((f, idx) => {
    // Most flats have 1–2 vehicles; skip a few to keep the list realistic
    if (idx % 7 === 0) return;
    const series = PLATE_SERIES[idx % PLATE_SERIES.length];
    const base = 1000 + ((idx * 137) % 9000);
    list.push({
      id: "v" + ++n,
      flatId: f.id,
      number: `GJ05${series}${base}`,
      type: idx % 3 === 0 ? "car" : idx % 3 === 1 ? "bike" : "scooter",
      sticker: idx % 5 !== 0,
    });
    if (idx % 4 === 0) {
      list.push({
        id: "v" + ++n,
        flatId: f.id,
        number: `GJ05${PLATE_SERIES[(idx + 3) % PLATE_SERIES.length]}${base + 17}`,
        type: idx % 2 === 0 ? "bike" : "car",
        sticker: true,
      });
    }
  });
  return list;
})();

export const notices: Notice[] = [
  {
    id: "n1",
    title: "પાણી સપ્લાય — કામચલાઉ બંધ",
    body: "આવતીકાલે સવારે 10 થી બપોરે 2 વાગ્યા સુધી અંડરગ્રાઉન્ડ ટેન્કી ક્લિનિંગને કારણે B-Wingમાં પાણી સપ્લાય બંધ રહેશે. કૃપા કરીને પાણીનો સંગ્રહ કરી લેજો.",
    category: "urgent",
    date: "2025-08-04",
    pinned: true,
    createdBy: "superadmin",
  },
  {
    id: "n2",
    title: "માસિક મેન્ટેનન્સ — ઓગસ્ટ 2025",
    body: "ઓગસ્ટ મહિનાનું મેન્ટેનન્સ ₹1,500 તા. 10 ઓગસ્ટ સુધી જમા કરાવવા વિનંતી. કેશ અથવા બેંક ટ્રાન્સફર સ્વીકાર્ય છે.",
    category: "payment",
    date: "2025-08-01",
    pinned: true,
    createdBy: "superadmin",
  },
  {
    id: "n3",
    title: "લિફ્ટ સર્વિસિંગ શેડ્યૂલ",
    body: "બંને લિફ્ટનું સર્વિસિંગ તા. 8 ઓગસ્ટે સવારે 9 થી 12 વાગ્યા સુધી થશે. આ સમય દરમિયાન સીડીનો ઉપયોગ કરવા વિનંતી.",
    category: "maintenance",
    date: "2025-08-03",
    createdBy: "editor",
  },
  {
    id: "n4",
    title: "સ્વતંત્રતા દિવસ કાર્યક્રમ",
    body: "15 ઓગસ્ટે સવારે 8 વાગ્યે પોડિયમ પર ધ્વજવંદન અને નાસ્તો યોજાશે. બધા સભ્યોને આમંત્રણ છે.",
    category: "event",
    date: "2025-07-30",
    createdBy: "editor",
  },
  {
    id: "n5",
    title: "પાર્કિંગ સ્ટીકર રિન્યુઅલ",
    body: "નવા વાહન સ્ટીકર માટે સોસાયટી ઓફિસમાં અરજી કરો. સ્ટીકર વગરના વાહનને બેઝમેન્ટમાં પાર્કિંગની મંજૂરી નહીં મળે.",
    category: "general",
    date: "2025-07-25",
    createdBy: "superadmin",
  },
  {
    id: "n6",
    title: "AGM નોટિસ — સપ્ટેમ્બર 2025",
    body: "વાર્ષિક સામાન્ય સભા તા. 14 સપ્ટેમ્બરે સાંજે 5 વાગ્યે સોસાયટી હોલમાં યોજાશે. એજન્ડા અને હિસાબની નકલ ટૂંક સમયમાં શેર થશે.",
    category: "general",
    date: "2025-07-20",
    createdBy: "superadmin",
  },
];

export function computeDues(): FlatDue[] {
  const expected = rounds.reduce((s, r) => s + r.amount, 0);
  return flats
    .filter((f) => f.status === "sold")
    .map((flat) => {
      const paid = collections.filter((c) => c.flatId === flat.id).reduce((s, c) => s + c.amount, 0);
      return { flat, expected, paid, pending: Math.max(expected - paid, 0) };
    });
}

export function stats() {
  const totalCollected = collections.reduce((s, c) => s + c.amount, 0);
  const totalExpense = expenses.reduce((s, e) => s + e.amount, 0);
  const cashCollected = collections.filter((c) => c.mode === "cash").reduce((s, c) => s + c.amount, 0);
  const bankCollected = collections.filter((c) => c.mode === "bank").reduce((s, c) => s + c.amount, 0);
  const cashExpense = expenses.filter((e) => e.paidFrom === "cash").reduce((s, e) => s + e.amount, 0);
  const bankExpense = expenses.filter((e) => e.paidFrom === "bank").reduce((s, e) => s + e.amount, 0);
  const transferred = fundTransfers.reduce((s, t) => s + t.amount, 0);
  const cash = cashCollected - cashExpense - transferred;
  const bank = bankCollected - bankExpense + transferred;
  const dues = computeDues();
  const pendingAmount = dues.reduce((s, d) => s + d.pending, 0);
  const pendingFlats = dues.filter((d) => d.pending > 0).length;
  const zeroCollection = dues.filter((d) => d.paid === 0).length;
  const sold = flats.filter((f) => f.status === "sold").length;
  const fourWheelers = vehicles.filter((v) => v.type === "car").length;
  const twoWheelers = vehicles.filter((v) => v.type === "bike" || v.type === "scooter").length;
  // Keep Total Balance = Cash + Bank so the summary always reconciles
  const balance = cash + bank;
  return {
    total: flats.length,
    sold,
    unsold: flats.length - sold,
    totalCollected,
    totalExpense,
    balance,
    cash,
    bank,
    pendingAmount,
    pendingFlats,
    zeroCollection,
    fourWheelers,
    twoWheelers,
    dues,
  };
}
