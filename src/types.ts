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
