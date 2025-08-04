export interface Transaction {
  id: string;
  date: any; // Using 'any' for now, will be a Timestamp from Firebase
  description: string;
  amount: number;
  token: string;
}

export interface Wallet {
  id:string;
  token: string;
  balance: number;
}
