export interface Clerk {
  id: string;
  name: string;
  password?: string; // Optional password to protect privacy
  createdAt: any; // Firestore Timestamp
}

export interface PayrollEntry {
  id: string;
  clerkName: string;
  meatJerkyCount: number;
  salaryRate: number;
  totalSalary: number;
  isVerified: boolean;
  isPaid: boolean;
  createdAt: any; // Firestore Timestamp
  updatedAt: any; // Firestore Timestamp
}

export interface ShopSettings {
  jerkyRate: number;
}
