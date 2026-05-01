export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  photoURL?: string;
  coupleId?: string;
  individualIncome: number;
  createdAt: string;
}

export interface Couple {
  id: string;
  name: string;
  members: string[];
  jointIncome: number;
  createdAt: string;
}

export type TransactionType = 'income' | 'expense';
export type PaymentMethod = 'pix' | 'dinheiro' | 'cartao';

export interface Transaction {
  id: string;
  coupleId: string;
  description: string;
  amount: number;
  type: TransactionType;
  category: string;
  paymentMethod: PaymentMethod;
  cardName?: string;
  dueDate: string;
  paid: boolean;
  createdAt: string;
  createdBy: string;
}

export interface MonthlyBill {
  id: string;
  coupleId: string;
  title: string;
  amount: number;
  dueDateDay: number; // Day of the month (1-31)
  category: string;
  paid: boolean;
  createdAt: string;
}

export interface Goal {
  id: string;
  coupleId: string;
  title: string;
  targetAmount: number;
  currentAmount: number;
  deadline: string;
  createdAt: string;
}

export interface LearningStep {
  id: string;
  title: string;
  content: string;
  category: 'curiosidade' | 'disciplina' | 'aprendizado';
}

export interface LearningProgress {
  userId: string;
  completedSteps: string[];
}

export interface Loan {
  id: string;
  coupleId: string;
  title: string;
  totalAmount: number;
  remainingAmount: number;
  interestRate: number; // Percentual (%)
  monthlyPayment: number;
  dueDateDay: number;
  totalInstallments?: number;
  currentInstallment?: number;
  lender: string;
  createdAt: string;
}

export interface Investment {
  id: string;
  coupleId: string;
  title: string;
  amount: number;
  type: string;
  interestRate?: number; // Percentual (%)
  totalInstallments?: number;
  currentInstallment?: number;
  createdAt: string;
}

export interface WalletAccount {
  id: string;
  coupleId: string;
  name: string;
  balance: number;
  isPiggyBank: boolean; // Se é um "cofrinho" ou reserva
  lender?: string; // Ex: Mercado Pago, Nubank
  createdAt: string;
}
