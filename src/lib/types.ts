export type Role = "superadmin" | "editor";
export type FlatStatus = "sold" | "unsold";
export type PaymentMode = "cash" | "bank";

export interface Flat {
  id: string;
  wing: string;
  flatNo: string;
  floor: number;
  unit: number;
  ownerName: string;
  /** Gujarati display name */
  ownerNameGu: string;
  ownerPhone: string;
  status: FlatStatus;
  /** Sold flat currently given on rent */
  onRent?: boolean;
  renterName?: string;
  renterNameGu?: string;
  renterPhone?: string;
}

export interface ChargeRound {
  id: string;
  name: string;
  amount: number;
  date: string;
}

export interface Collection {
  id: string;
  flatId: string;
  amount: number;
  date: string;
  mode: PaymentMode;
  roundId: string;
  note?: string;
  createdBy: string;
  sharedToGroup?: boolean;
}

export interface Expense {
  id: string;
  name: string;
  amount: number;
  date: string;
  category: string;
  note?: string;
  paidFrom: PaymentMode;
  createdBy: string;
  hasBill?: boolean;
  sharedToGroup?: boolean;
}

export interface FundTransfer {
  id: string;
  amount: number;
  date: string;
  createdBy: string;
}

export interface FlatDue {
  flat: Flat;
  expected: number;
  paid: number;
  pending: number;
}

export type VehicleType = "car" | "bike" | "scooter";

export interface Vehicle {
  id: string;
  flatId: string;
  number: string;
  type: VehicleType;
  sticker: boolean;
}

export type NoticeCategory = "general" | "maintenance" | "event" | "payment" | "urgent";

export interface Notice {
  id: string;
  title: string;
  body: string;
  category: NoticeCategory;
  date: string;
  pinned?: boolean;
  createdBy: string;
}
