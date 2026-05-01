/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { 
  onAuthStateChanged, 
  User as FirebaseUser 
} from 'firebase/auth';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  doc, 
  setDoc, 
  updateDoc, 
  addDoc, 
  deleteDoc,
  orderBy,
  Timestamp,
  getDoc
} from 'firebase/firestore';
import { 
  LayoutDashboard, 
  Receipt, 
  Target, 
  BookOpen, 
  Calendar as CalendarIcon, 
  LogOut, 
  Plus, 
  TrendingUp, 
  TrendingDown, 
  Wallet, 
  CreditCard, 
  Banknote, 
  PieChart,
  User as UserIcon,
  Users,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  Filter,
  Search,
  ArrowUpRight,
  ArrowDownRight,
  Pencil,
  FileText,
  Trash2,
  PiggyBank,
  Landmark,
  Bell,
  Download,
  Loader2
} from 'lucide-react';
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  isSameMonth, 
  parseISO, 
  addMonths, 
  subMonths,
  isAfter,
  isBefore,
  startOfDay
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Cell,
  PieChart as RePieChart,
  Pie
} from 'recharts';
import ReactMarkdown from 'react-markdown';
import { motion, AnimatePresence } from 'motion/react';

import { auth, db, signInWithGoogle, logout } from './lib/firebase';
import { 
  UserProfile, 
  Couple, 
  Transaction, 
  Goal, 
  MonthlyBill,
  Loan,
  Investment,
  WalletAccount,
  TransactionType, 
  PaymentMethod,
  LearningStep,
  LearningProgress
} from './types';
import { GeminiChatbot } from './components/GeminiChatbot';
import { generateLearningContent, generateFinancialAdvice } from './services/gemini';
import { NotificationService } from './services/notificationService';

// UI Components
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

// --- Constants ---

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string;
    email?: string | null;
    emailVerified?: boolean;
    isAnonymous?: boolean;
    tenantId?: string | null;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  // We throw the JSON string as requested
  throw new Error(JSON.stringify(errInfo));
}

const CATEGORIES = [
  'Alimentação', 'Moradia', 'Transporte', 'Lazer', 'Saúde', 'Educação', 'Investimentos', 'Outros'
];

const LEARNING_STEPS: LearningStep[] = [
  { id: '1', title: 'Consciência Financeira: Registro Diário', category: 'disciplina', content: 'disciplina' },
  { id: '2', title: 'A Importância do Orçamento no Amor e Finanças', category: 'curiosidade', content: 'curiosidade' },
  { id: '3', title: 'O Cofrinho: Sua Reserva de Emergência', category: 'disciplina', content: 'disciplina' },
  { id: '4', title: 'Eliminando Dívidas: A Aba de Empréstimos', category: 'aprendizado', content: 'aprendizado' },
  { id: '5', title: 'Investindo no Futuro: Aportes e Parcelas', category: 'aprendizado', content: 'aprendizado' },
  { id: '6', title: 'Metas SMART: Transformando Sonhos em Dados', category: 'disciplina', content: 'disciplina' },
  { id: '7', title: 'Leitura de Gráficos: Onde o Dinheiro vaza?', category: 'curiosidade', content: 'curiosidade' },
  { id: '8', title: 'Hábitos do Casal: Consistência é Tudo', category: 'disciplina', content: 'disciplina' },
  { id: '9', title: 'A Magia dos Juros Compostos nos Seus Ativos', category: 'aprendizado', content: 'aprendizado' },
  { id: '10', title: 'Independência a Dois: O Plano de Longo Prazo', category: 'aprendizado', content: 'aprendizado' },
];

// --- Error Boundary ---

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean, error: Error | null }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      let errorMessage = "Ocorreu um erro inesperado.";
      try {
        const parsed = JSON.parse(this.state.error?.message || "{}");
        if (parsed.error) {
          errorMessage = `Erro no Firestore (${parsed.operationType}): ${parsed.error}`;
        }
      } catch (e) {
        errorMessage = this.state.error?.message || errorMessage;
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-neutral-50 p-4">
          <Card className="max-w-md w-full border-none shadow-xl">
            <CardHeader className="text-center">
              <div className="mx-auto w-12 h-12 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center mb-4">
                <AlertCircle size={24} />
              </div>
              <CardTitle className="text-xl">Ops! Algo deu errado</CardTitle>
              <CardDescription>
                {errorMessage}
              </CardDescription>
            </CardHeader>
            <CardFooter>
              <Button className="w-full" onClick={() => window.location.reload()}>
                Recarregar Aplicativo
              </Button>
            </CardFooter>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

// --- Main App Component ---

export default function App() {
  return (
    <ErrorBoundary>
      <AppContent />
    </ErrorBoundary>
  );
}

function AppContent() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [couple, setCouple] = useState<Couple | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');

  // Data states
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [monthlyBills, setMonthlyBills] = useState<MonthlyBill[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [wallets, setWallets] = useState<WalletAccount[]>([]);
  const [learningProgress, setLearningProgress] = useState<LearningProgress | null>(null);
  const [partnerProfile, setPartnerProfile] = useState<UserProfile | null>(null);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isStandalone, setIsStandalone] = useState(false);

  // Auth Listener
  useEffect(() => {
    // Check if app is running in standalone mode
    const checkStandalone = () => {
      const isStandaloneMode = window.matchMedia('(display-mode: standalone)').matches || 
                               (window.navigator as any).standalone || 
                               document.referrer.includes('android-app://');
      setIsStandalone(!!isStandaloneMode);
    };
    
    checkStandalone();
    
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        // Fetch or create profile
        const userRef = doc(db, 'users', firebaseUser.uid);
        const userSnap = await getDoc(userRef);
        
        if (userSnap.exists()) {
          setProfile(userSnap.data() as UserProfile);
        } else {
          const newProfile: UserProfile = {
            uid: firebaseUser.uid,
            displayName: firebaseUser.displayName || 'Usuário',
            email: firebaseUser.email || '',
            photoURL: firebaseUser.photoURL || '',
            individualIncome: 0,
            createdAt: new Date().toISOString(),
          };
          await setDoc(userRef, newProfile);
          setProfile(newProfile);
        }
      } else {
        setProfile(null);
        setCouple(null);
        setTransactions([]);
        setGoals([]);
        setMonthlyBills([]);
        setLoans([]);
        setInvestments([]);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  // Couple Listener
  useEffect(() => {
    if (profile?.coupleId) {
      const unsubscribe = onSnapshot(doc(db, 'couples', profile.coupleId), (docSnap) => {
        if (docSnap.exists()) {
          setCouple(docSnap.data() as Couple);
        }
      });
      return unsubscribe;
    }
  }, [profile?.coupleId]);

  // Partner Listener
  useEffect(() => {
    if (couple && profile) {
      const partnerId = couple.members.find(id => id !== profile.uid);
      if (partnerId) {
        const unsubscribe = onSnapshot(doc(db, 'users', partnerId), (docSnap) => {
          if (docSnap.exists()) {
            setPartnerProfile(docSnap.data() as UserProfile);
          }
        });
        return unsubscribe;
      } else {
        setPartnerProfile(null);
      }
    }
  }, [couple, profile]);

  // Data Listeners (Transactions, Goals, Learning)
  useEffect(() => {
    if (profile?.coupleId) {
      const qTransactions = query(
        collection(db, 'transactions'),
        where('coupleId', '==', profile.coupleId),
        orderBy('createdAt', 'desc')
      );
      const unsubTransactions = onSnapshot(qTransactions, (snap) => {
        setTransactions(snap.docs.map(d => ({ ...d.data(), id: d.id }) as Transaction));
      });

      const qGoals = query(
        collection(db, 'goals'),
        where('coupleId', '==', profile.coupleId)
      );
      const unsubGoals = onSnapshot(qGoals, (snap) => {
        setGoals(snap.docs.map(d => ({ ...d.data(), id: d.id }) as Goal));
      });

      const qMonthlyBills = query(
        collection(db, 'monthlyBills'),
        where('coupleId', '==', profile.coupleId),
        orderBy('dueDateDay', 'asc')
      );
      const unsubMonthlyBills = onSnapshot(qMonthlyBills, (snap) => {
        setMonthlyBills(snap.docs.map(d => ({ ...d.data(), id: d.id }) as MonthlyBill));
      });

      const qLoans = query(
        collection(db, 'loans'),
        where('coupleId', '==', profile.coupleId)
      );
      const unsubLoans = onSnapshot(qLoans, (snap) => {
        setLoans(snap.docs.map(d => ({ ...d.data(), id: d.id }) as Loan));
      });

      const qInvestments = query(
        collection(db, 'investments'),
        where('coupleId', '==', profile.coupleId)
      );
      const unsubInvestments = onSnapshot(qInvestments, (snap) => {
        setInvestments(snap.docs.map(d => ({ ...d.data(), id: d.id }) as Investment));
      });

      const qWallets = query(
        collection(db, 'wallets'),
        where('coupleId', '==', profile.coupleId)
      );
      const unsubWallets = onSnapshot(qWallets, (snap) => {
        setWallets(snap.docs.map(d => ({ ...d.data(), id: d.id }) as WalletAccount));
      });

      return () => {
        unsubTransactions();
        unsubGoals();
        unsubMonthlyBills();
        unsubLoans();
        unsubInvestments();
        unsubWallets();
      };
    }
  }, [profile?.coupleId]);

  useEffect(() => {
    if (profile?.uid) {
      const unsubLearning = onSnapshot(doc(db, 'learningProgress', profile.uid), (docSnap) => {
        if (docSnap.exists()) {
          setLearningProgress(docSnap.data() as LearningProgress);
        } else {
          setLearningProgress({ userId: profile.uid, completedSteps: [] });
        }
      });
      return unsubLearning;
    }
  }, [profile?.uid]);

  // Upcoming Bills Notification Check
  useEffect(() => {
    if (monthlyBills.length > 0) {
      NotificationService.checkUpcomingBills(monthlyBills);
    }
  }, [monthlyBills]);

  // PWA Install Prompt Listener
  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      console.log('beforeinstallprompt event fired');
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallApp = async () => {
    if (!deferredPrompt) {
      alert('A instalação já foi concluída ou não é suportada por este navegador/dispositivo no momento.');
      return;
    }
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-neutral-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          <p className="text-neutral-500 font-medium">Carregando Amor & Finanças...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginView />;
  }

  if (!profile?.coupleId) {
    return <CoupleSetupView profile={profile!} setProfile={setProfile} />;
  }

  if (!couple) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-neutral-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          <p className="text-neutral-500 font-medium">Sincronizando dados do casal...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50 flex flex-col md:flex-row">
      {/* Sidebar / Navigation */}
      <aside className="w-full md:w-64 bg-white border-b md:border-r border-neutral-200 flex flex-col">
        <div className="p-6 flex items-center gap-3">
          <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center text-white shadow-lg shadow-primary/20">
            <TrendingUp size={24} />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-neutral-900">Amor & Finanças</h1>
        </div>

        <nav className="flex-1 px-4 space-y-1">
          <NavItem 
            icon={<LayoutDashboard size={20} />} 
            label="Dashboard" 
            active={activeTab === 'dashboard'} 
            onClick={() => setActiveTab('dashboard')} 
          />
          <NavItem 
            icon={<Receipt size={20} />} 
            label="Transações" 
            active={activeTab === 'transactions'} 
            onClick={() => setActiveTab('transactions')} 
          />
          <NavItem 
            icon={<FileText size={20} />} 
            label="Contas Mensais" 
            active={activeTab === 'monthlyBills'} 
            onClick={() => setActiveTab('monthlyBills')} 
          />
          <NavItem 
            icon={<Target size={20} />} 
            label="Metas" 
            active={activeTab === 'goals'} 
            onClick={() => setActiveTab('goals')} 
          />
          <NavItem 
            icon={<Landmark size={20} />} 
            label="Investimentos & Dívidas" 
            active={activeTab === 'finances'} 
            onClick={() => setActiveTab('finances')} 
          />
          <NavItem 
            icon={<CalendarIcon size={20} />} 
            label="Calendário" 
            active={activeTab === 'calendar'} 
            onClick={() => setActiveTab('calendar')} 
          />
          <NavItem 
            icon={<BookOpen size={20} />} 
            label="Trilha de Aprendizado" 
            active={activeTab === 'learning'} 
            onClick={() => setActiveTab('learning')} 
          />
          <NavItem 
            icon={<UserIcon size={20} />} 
            label="Perfil" 
            active={activeTab === 'profile'} 
            onClick={() => setActiveTab('profile')} 
          />
        </nav>

        <div className="p-4 mt-auto border-t border-neutral-100">
          <div className="flex items-center gap-3 p-2 mb-4">
            <Avatar className="h-10 w-10 border-2 border-primary/10">
              <AvatarImage src={profile.photoURL} />
              <AvatarFallback>{profile.displayName[0]}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-neutral-900 truncate">{profile.displayName}</p>
              <p className="text-xs text-neutral-500 truncate">{couple?.name}</p>
            </div>
          </div>
          <Button variant="ghost" className="w-full justify-start text-red-500 hover:text-red-600 hover:bg-red-50" onClick={logout}>
            <LogOut size={20} className="mr-2" />
            Sair
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-4 md:p-8">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {activeTab === 'dashboard' && (
              <DashboardView 
                profile={profile} 
                couple={couple!} 
                transactions={transactions} 
                goals={goals} 
                monthlyBills={monthlyBills}
                partner={partnerProfile}
                wallets={wallets}
                deferredPrompt={deferredPrompt}
                handleInstallApp={handleInstallApp}
                isStandalone={isStandalone}
              />
            )}
            {activeTab === 'transactions' && (
              <TransactionsView 
                profile={profile} 
                couple={couple!} 
                transactions={transactions} 
                partner={partnerProfile}
              />
            )}
            {activeTab === 'goals' && (
              <GoalsView 
                profile={profile} 
                couple={couple!} 
                goals={goals} 
              />
            )}
            {activeTab === 'monthlyBills' && (
              <MonthlyBillsView 
                coupleId={couple!.id} 
                bills={monthlyBills} 
                transactions={transactions}
              />
            )}
            {activeTab === 'finances' && (
              <FinancesView 
                coupleId={couple!.id} 
                loans={loans}
                investments={investments}
              />
            )}
            {activeTab === 'calendar' && (
              <CalendarView 
                transactions={transactions} 
                monthlyBills={monthlyBills}
                profile={profile}
                couple={couple!}
              />
            )}
            {activeTab === 'learning' && (
              <LearningTrailView 
                progress={learningProgress} 
                profile={profile}
              />
            )}
            {activeTab === 'profile' && (
              <ProfileView 
                profile={profile} 
                partner={partnerProfile}
                couple={couple!}
                deferredPrompt={deferredPrompt}
                handleInstallApp={handleInstallApp}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </main>
      <GeminiChatbot 
        profile={profile}
        couple={couple!}
        transactions={transactions}
        goals={goals}
        monthlyBills={monthlyBills}
        loans={loans}
        investments={investments}
        wallets={wallets}
      />
    </div>
  );
}

// --- Sub-Views ---

function LoginView() {
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    if (isLoggingIn) return;
    setIsLoggingIn(true);
    setError(null);
    try {
      await signInWithGoogle();
    } catch (err: any) {
      console.error("Login component error", err);
      if (err.code === 'auth/cancelled-popup-request') {
        setError('Uma tentativa de login já está em andamento. Por favor, aguarde.');
      } else if (err.code === 'auth/popup-closed-by-user') {
        setError('A janela de login foi fechada antes de completar.');
      } else {
        setError('Ocorreu um erro ao tentar entrar com o Google. Tente novamente.');
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md border-none shadow-2xl overflow-hidden">
        <div className="h-32 bg-primary flex items-center justify-center">
          <TrendingUp size={48} className="text-white" />
        </div>
        <CardHeader className="text-center pt-8">
          <CardTitle className="text-3xl font-bold text-neutral-900">Bem-vindo</CardTitle>
          <CardDescription className="text-neutral-500 text-lg">
            Controle suas finanças e construa seu futuro a dois.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-8">
          {error && (
            <div className="mb-4 p-3 bg-rose-50 text-rose-600 text-sm rounded-lg flex items-center gap-2">
              <AlertCircle size={16} />
              {error}
            </div>
          )}
          <Button 
            className="w-full h-12 text-lg font-semibold shadow-lg shadow-primary/20" 
            onClick={handleLogin}
            disabled={isLoggingIn}
          >
            {isLoggingIn ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Entrando...
              </>
            ) : (
              'Entrar com Google'
            )}
          </Button>
          <p className="mt-6 text-center text-sm text-neutral-400">
            Ao entrar, você concorda com nossos termos e política de privacidade.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function CoupleSetupView({ profile, setProfile }: { profile: UserProfile, setProfile: (p: UserProfile) => void }) {
  const [mode, setMode] = useState<'choice' | 'create' | 'join'>('choice');
  const [coupleName, setCoupleName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!coupleName) return;
    setIsLoading(true);
    setError(null);
    try {
      const coupleId = Math.random().toString(36).substring(2, 10).toUpperCase();
      const newCouple: Couple = {
        id: coupleId,
        name: coupleName,
        members: [profile.uid],
        jointIncome: 0,
        createdAt: new Date().toISOString(),
      };
      await setDoc(doc(db, 'couples', coupleId), newCouple);
      await updateDoc(doc(db, 'users', profile.uid), { coupleId });
      setProfile({ ...profile, coupleId });
    } catch (err) {
      setError("Erro ao criar casal. Tente novamente.");
      handleFirestoreError(err, OperationType.WRITE, 'couples');
    } finally {
      setIsLoading(false);
    }
  };

  const handleJoin = async () => {
    if (!inviteCode) return;
    setIsLoading(true);
    setError(null);
    try {
      const coupleRef = doc(db, 'couples', inviteCode);
      const coupleSnap = await getDoc(coupleRef);
      if (coupleSnap.exists()) {
        const coupleData = coupleSnap.data() as Couple;
        if (coupleData.members.length >= 2) {
          setError("Este casal já está completo!");
          setIsLoading(false);
          return;
        }
        await updateDoc(coupleRef, {
          members: [...coupleData.members, profile.uid]
        });
        await updateDoc(doc(db, 'users', profile.uid), { coupleId: inviteCode });
        setProfile({ ...profile, coupleId: inviteCode });
      } else {
        setError("Código de convite inválido.");
      }
    } catch (err) {
      setError("Erro ao entrar no casal. Verifique o código.");
      handleFirestoreError(err, OperationType.WRITE, `couples/${inviteCode}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Configuração de Casal</CardTitle>
          <CardDescription>Para começar, crie um novo casal ou entre em um existente.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <div className="p-3 bg-rose-50 text-rose-600 text-sm rounded-lg flex items-center gap-2">
              <AlertCircle size={16} />
              {error}
            </div>
          )}
          {mode === 'choice' && (
            <div className="grid grid-cols-1 gap-4">
              <Button onClick={() => setMode('create')} className="h-16 text-lg">Criar Novo Casal</Button>
              <Button onClick={() => setMode('join')} variant="outline" className="h-16 text-lg">Entrar com Código</Button>
            </div>
          )}
          {mode === 'create' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Nome do Casal</Label>
                <Input placeholder="Ex: João & Maria" value={coupleName} onChange={e => setCoupleName(e.target.value)} disabled={isLoading} />
              </div>
              <Button onClick={handleCreate} className="w-full" disabled={isLoading}>
                {isLoading ? "Criando..." : "Criar"}
              </Button>
              <Button onClick={() => { setMode('choice'); setError(null); }} variant="ghost" className="w-full" disabled={isLoading}>Voltar</Button>
            </div>
          )}
          {mode === 'join' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Código de Convite</Label>
                <Input placeholder="Cole o código aqui" value={inviteCode} onChange={e => setInviteCode(e.target.value)} disabled={isLoading} />
              </div>
              <Button onClick={handleJoin} className="w-full" disabled={isLoading}>
                {isLoading ? "Entrando..." : "Entrar"}
              </Button>
              <Button onClick={() => { setMode('choice'); setError(null); }} variant="ghost" className="w-full" disabled={isLoading}>Voltar</Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function DashboardView({ 
  profile, 
  couple, 
  transactions, 
  goals, 
  monthlyBills, 
  partner, 
  wallets,
  deferredPrompt,
  handleInstallApp,
  isStandalone
}: { 
  profile: UserProfile, 
  couple: Couple, 
  transactions: Transaction[], 
  goals: Goal[],
  monthlyBills: MonthlyBill[],
  partner: UserProfile | null,
  wallets: WalletAccount[],
  deferredPrompt: any,
  handleInstallApp: () => Promise<void>,
  isStandalone: boolean
}) {
  const [advice, setAdvice] = useState<string>('');
  const [isAdviceLoading, setIsAdviceLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [isWalletDialogOpen, setIsWalletDialogOpen] = useState(false);

  const monthTransactions = transactions.filter(t => isSameMonth(parseISO(t.dueDate), selectedDate));
  
  const totalIncome = monthTransactions.filter(t => t.type === 'income').reduce((acc, t) => acc + t.amount, 0);
  const totalExpenses = monthTransactions.filter(t => t.type === 'expense').reduce((acc, t) => acc + t.amount, 0);
  const monthBalance = totalIncome - totalExpenses;

  // Real money logic
  const availableBalance = wallets.filter(w => !w.isPiggyBank).reduce((acc, w) => acc + w.balance, 0);
  const piggyBalance = wallets.filter(w => w.isPiggyBank).reduce((acc, w) => acc + w.balance, 0);

  const chartData = useMemo(() => {
    const last6Months = Array.from({ length: 6 }).map((_, i) => subMonths(selectedDate, 5 - i));
    return last6Months.map(month => {
      const mTransactions = transactions.filter(t => isSameMonth(parseISO(t.dueDate), month));
      return {
        name: format(month, 'MMM', { locale: ptBR }),
        entradas: mTransactions.filter(t => t.type === 'income').reduce((acc, t) => acc + t.amount, 0),
        saidas: mTransactions.filter(t => t.type === 'expense').reduce((acc, t) => acc + t.amount, 0),
      };
    });
  }, [transactions, selectedDate]);

  const categoryData = useMemo(() => {
    const expenses = monthTransactions.filter(t => t.type === 'expense');
    const categories = Array.from(new Set(expenses.map(t => t.category)));
    return categories.map(cat => ({
      name: cat,
      value: expenses.filter(t => t.category === cat).reduce((acc, t) => acc + t.amount, 0)
    })).sort((a, b) => b.value - a.value);
  }, [monthTransactions]);

  const fetchAdvice = async () => {
    setIsAdviceLoading(true);
    const res = await generateFinancialAdvice(monthTransactions.slice(0, 10), goals);
    setAdvice(res);
    setIsAdviceLoading(false);
  };

  useEffect(() => {
    if (monthTransactions.length > 0) {
      fetchAdvice();
    } else {
      setAdvice('');
    }
  }, [monthTransactions.length, selectedDate]);

  const handlePrevMonth = () => setSelectedDate(subMonths(selectedDate, 1));
  const handleNextMonth = () => setSelectedDate(addMonths(selectedDate, 1));
  const handleCurrentMonth = () => setSelectedDate(new Date());

  return (
    <div className="space-y-8">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1">
          <h2 className="text-3xl font-bold text-neutral-900">Olá, {profile.displayName}!</h2>
          <p className="text-neutral-500">Aqui está o resumo financeiro de {couple?.name || "seu casal"}.</p>
          {deferredPrompt ? (
            <div className="pt-2">
              <Button 
                onClick={handleInstallApp}
                className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 shadow-lg animate-in fade-in slide-in-from-left-2"
                size="sm"
              >
                <Download size={16} />
                Instalar App no Celular
              </Button>
            </div>
          ) : !isStandalone && (
            <div className="mt-2 text-[10px] text-amber-700 bg-amber-50/50 p-2 rounded-lg border border-amber-100/50 max-w-xs">
              <p className="flex items-center gap-1 font-medium">
                <Download size={10} />
                Dica: Instale como aplicativo 
              </p>
              <p className="opacity-80">No Chrome: menu ":" &gt; "Instalar app". No Safari: compartilhar &gt; "Tela de Início".</p>
            </div>
          )}
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center bg-white rounded-xl border border-neutral-200 shadow-sm p-1">
            <Button variant="ghost" size="icon" onClick={handlePrevMonth} className="h-8 w-8">
              <ChevronLeft size={18} />
            </Button>
            <div className="px-4 py-1 min-w-[140px] text-center">
              <span className="text-sm font-bold text-neutral-900 capitalize">
                {format(selectedDate, 'MMMM yyyy', { locale: ptBR })}
              </span>
            </div>
            <Button variant="ghost" size="icon" onClick={handleNextMonth} className="h-8 w-8">
              <ChevronRight size={18} />
            </Button>
          </div>
          
          {!isSameMonth(selectedDate, new Date()) && (
            <Button variant="outline" size="sm" onClick={handleCurrentMonth} className="rounded-xl">
              Mês Atual
            </Button>
          )}

          <div className="hidden sm:flex items-center gap-2 bg-white p-2 rounded-xl border border-neutral-200 shadow-sm">
            <Badge variant="outline" className="text-xs font-mono">{couple?.id}</Badge>
            <span className="text-xs text-neutral-400">Código</span>
          </div>
        </div>
      </header>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard 
          title="Disponível p/ Uso" 
          value={availableBalance} 
          icon={<Wallet className="text-blue-500" />} 
          description="Saldo real em conta"
          trend={availableBalance >= 0 ? 'up' : 'down'}
          onTitleClick={() => setIsWalletDialogOpen(true)}
        />
        <StatCard 
          title="No Cofrinho" 
          value={piggyBalance} 
          icon={<PiggyBank className="text-amber-500" />} 
          description="Reserva guardada"
          onTitleClick={() => setIsWalletDialogOpen(true)}
        />
        <StatCard 
          title="Saldo do Mês (Fluxo)" 
          value={monthBalance} 
          icon={<TrendingUp className="text-emerald-500" />} 
          description="Entradas - Saídas"
          trend={monthBalance >= 0 ? 'up' : 'down'}
        />
        <StatCard 
          title="Renda Conjunta" 
          value={(profile.individualIncome || 0) + (partner?.individualIncome || 0)} 
          icon={<Users className="text-indigo-500" />} 
          description="Base de renda mensal"
        />
      </div>

      <Dialog open={isWalletDialogOpen} onOpenChange={setIsWalletDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Gerenciar Minhas Contas</DialogTitle>
            <DialogDescription>Ajuste o saldo real que você tem hoje para evitar "vazamentos".</DialogDescription>
          </DialogHeader>
          <WalletManager coupleId={couple.id} wallets={wallets} onSuccess={() => setIsWalletDialogOpen(false)} />
        </DialogContent>
      </Dialog>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Chart */}
        <Card className="lg:col-span-2 border-none shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PieChart size={20} className="text-primary" />
              Fluxo de Caixa (6 meses)
            </CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#888' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#888' }} />
                <Tooltip 
                  cursor={{ fill: '#f8f8f8' }}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                />
                <Bar dataKey="entradas" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="saidas" fill="#f43f5e" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* AI Advice & Goals */}
        <div className="space-y-8">
          <Card className="bg-primary text-white border-none shadow-lg shadow-primary/20">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <BookOpen size={20} />
                Conselho do Mentor
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isAdviceLoading ? (
                <div className="flex items-center gap-2 animate-pulse">
                  <div className="w-2 h-2 bg-white rounded-full"></div>
                  <div className="w-2 h-2 bg-white rounded-full"></div>
                  <div className="w-2 h-2 bg-white rounded-full"></div>
                </div>
              ) : (
                <p className="text-primary-foreground/90 leading-relaxed italic">
                  "{advice || 'Adicione algumas transações para receber conselhos personalizados!'}"
                </p>
              )}
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">Próximas Metas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {goals.slice(0, 3).map(goal => (
                <div key={goal.id} className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium text-neutral-700">{goal.title}</span>
                    <span className="text-neutral-500">R$ {goal.currentAmount} / {goal.targetAmount}</span>
                  </div>
                  <Progress value={(goal.currentAmount / goal.targetAmount) * 100} className="h-2" />
                </div>
              ))}
              {goals.length === 0 && <p className="text-sm text-neutral-400 text-center py-4">Nenhuma meta definida.</p>}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Bottom Row: Categories & Recent Transactions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card className="border-none shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Gastos por Categoria</CardTitle>
          </CardHeader>
          <CardContent className="h-[250px] flex items-center justify-center">
            {categoryData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <RePieChart>
                  <Pie
                    data={categoryData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {categoryData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'][index % 6]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </RePieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-neutral-400">Sem dados este mês.</p>
            )}
          </CardContent>
        </Card>

        <div className="space-y-8">
          <Card className="border-none shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <FileText size={18} className="text-primary" />
                Contas do Mês
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {monthlyBills.slice(0, 4).map(bill => (
                  <div key={bill.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-neutral-50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold",
                        bill.paid ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
                      )}>
                        {bill.dueDateDay}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-neutral-900">{bill.title}</p>
                        <p className="text-[10px] text-neutral-500">{bill.category}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-neutral-900">R$ {bill.amount.toLocaleString('pt-BR')}</p>
                      <p className={cn(
                        "text-[10px] font-bold uppercase",
                        bill.paid ? "text-emerald-500" : "text-rose-500"
                      )}>
                        {bill.paid ? 'Pago' : 'Pendente'}
                      </p>
                    </div>
                  </div>
                ))}
                {monthlyBills.length === 0 && (
                  <p className="text-sm text-neutral-400 text-center py-4">Nenhuma conta cadastrada.</p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">Últimas Transações</CardTitle>
            <Button variant="ghost" size="sm" className="text-primary">Ver todas</Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {transactions.slice(0, 5).map(t => (
                <div key={t.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "w-10 h-10 rounded-full flex items-center justify-center",
                      t.type === 'income' ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
                    )}>
                      {t.type === 'income' ? <TrendingUp size={18} /> : <TrendingDown size={18} />}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-neutral-900">{t.description}</p>
                      <div className="flex items-center gap-2">
                        <p className="text-xs text-neutral-500">{format(parseISO(t.dueDate), 'dd/MM/yyyy')}</p>
                        <span className="text-neutral-300">•</span>
                        <div className="flex items-center gap-1">
                          <Avatar className="h-4 w-4">
                            <AvatarImage src={t.createdBy === profile.uid ? profile.photoURL : partner?.photoURL} />
                            <AvatarFallback className="text-[8px]">{t.createdBy === profile.uid ? profile.displayName[0] : (partner?.displayName?.[0] || '?')}</AvatarFallback>
                          </Avatar>
                          <span className="text-[10px] text-neutral-400">
                            {t.createdBy === profile.uid ? 'Você' : (partner?.displayName || 'Parceiro')}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <p className={cn(
                    "text-sm font-bold",
                    t.type === 'income' ? "text-emerald-600" : "text-rose-600"
                  )}>
                    {t.type === 'income' ? '+' : '-'} R$ {t.amount.toLocaleString('pt-BR')}
                  </p>
                </div>
              ))}
              {transactions.length === 0 && <p className="text-sm text-neutral-400 text-center py-4">Nenhuma transação.</p>}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  </div>
  );
}

function StatCard({ title, value, icon, trend, description, onTitleClick }: { 
  title: string, 
  value: number, 
  icon: React.ReactNode, 
  trend?: 'up' | 'down',
  description?: string,
  onTitleClick?: () => void
}) {
  return (
    <Card 
      className={cn(
        "border-none shadow-sm overflow-hidden relative transition-all",
        onTitleClick && "cursor-pointer hover:ring-2 hover:ring-primary/20 hover:bg-neutral-50/50"
      )}
      onClick={onTitleClick}
    >
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardDescription className="text-neutral-500 font-medium flex items-center gap-1">
            {title}
            {onTitleClick && <Pencil size={10} className="text-neutral-300" />}
          </CardDescription>
          <div className="p-2 bg-neutral-50 rounded-lg">{icon}</div>
        </div>
        <CardTitle className="text-2xl font-bold text-neutral-900">
          R$ {value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
        </CardTitle>
      </CardHeader>
      {description && (
        <CardFooter className="pt-0">
          <p className="text-xs text-neutral-400">{description}</p>
        </CardFooter>
      )}
      {trend && (
        <div className={cn(
          "absolute bottom-0 left-0 w-full h-1",
          trend === 'up' ? "bg-emerald-500" : "bg-rose-500"
        )} />
      )}
    </Card>
  );
}

function WalletManager({ coupleId, wallets, onSuccess }: { coupleId: string, wallets: WalletAccount[], onSuccess: () => void }) {
  const [isAdding, setIsAdding] = useState(false);
  const [formData, setFormData] = useState({ name: '', balance: '', isPiggyBank: false, lender: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'wallets'), {
        ...formData,
        balance: Number(formData.balance),
        coupleId,
        createdAt: new Date().toISOString()
      });
      setFormData({ name: '', balance: '', isPiggyBank: false, lender: '' });
      setIsAdding(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'wallets');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateBalance = async (id: string, newBalance: number) => {
    try {
      await updateDoc(doc(db, 'wallets', id), { balance: newBalance });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `wallets/${id}`);
    }
  };

  return (
    <div className="space-y-4 py-4">
      <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2">
        {wallets.map(w => (
          <div key={w.id} className="flex p-3 items-center justify-between bg-neutral-50 rounded-xl border border-neutral-100">
            <div className="flex items-center gap-3">
              <div className={cn("p-2 rounded-lg", w.isPiggyBank ? "bg-amber-100 text-amber-600" : "bg-blue-100 text-blue-600")}>
                {w.isPiggyBank ? <PiggyBank size={18} /> : <Wallet size={18} />}
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-bold text-neutral-900">{w.name}</span>
                <span className="text-[10px] text-neutral-400 capitalize">{w.lender || 'Outros'}</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="text-right">
                <Input 
                  type="number" 
                  className="w-24 h-8 text-right font-mono text-sm border-none bg-transparent hover:bg-neutral-100 focus:bg-white"
                  defaultValue={w.balance}
                  onBlur={(e) => handleUpdateBalance(w.id, Number(e.target.value))}
                />
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => deleteDoc(doc(db, 'wallets', w.id))}>
                <Trash2 size={14} className="text-neutral-400 hover:text-rose-500" />
              </Button>
            </div>
          </div>
        ))}
        {wallets.length === 0 && !isAdding && (
          <p className="text-center text-sm text-neutral-400 py-4">Nenhuma conta ou cofrinho cadastrado.</p>
        )}
      </div>

      {!isAdding ? (
        <Button variant="outline" className="w-full rounded-xl border-dashed" onClick={() => setIsAdding(true)}>
          <Plus size={16} className="mr-2" /> Adicionar Conta/Cofrinho
        </Button>
      ) : (
        <form onSubmit={handleSubmit} className="p-4 bg-neutral-50 rounded-xl border border-neutral-100 space-y-3 animate-in fade-in slide-in-from-top-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Nome da Conta</Label>
              <Input required value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="Ex: Conta Corrente" className="h-8 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Instituição</Label>
              <Input value={formData.lender} onChange={e => setFormData({ ...formData, lender: e.target.value })} placeholder="Ex: Mercado Pago" className="h-8 text-sm" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Saldo Atual</Label>
              <Input required type="number" step="0.01" value={formData.balance} onChange={e => setFormData({ ...formData, balance: e.target.value })} placeholder="0,00" className="h-8 text-sm" />
            </div>
            <div className="flex items-end h-full py-1">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input 
                  type="checkbox" 
                  checked={formData.isPiggyBank} 
                  onChange={e => setFormData({ ...formData, isPiggyBank: e.target.checked })}
                  className="rounded border-neutral-300 text-primary focus:ring-primary"
                />
                <span className="text-xs text-neutral-600">É um Cofrinho?</span>
              </label>
            </div>
          </div>
          <div className="flex gap-2">
            <Button type="submit" size="sm" className="flex-1" disabled={isSubmitting}>Salvar</Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setIsAdding(false)}>Cancelar</Button>
          </div>
        </form>
      )}

      <div className="pt-2 border-t border-neutral-100">
        <Button onClick={onSuccess} className="w-full rounded-xl">Concluir</Button>
      </div>
    </div>
  );
}

function TransactionsView({ profile, couple, transactions, partner }: { profile: UserProfile, couple: Couple, transactions: Transaction[], partner: UserProfile | null }) {
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [filterType, setFilterType] = useState<'all' | 'income' | 'expense'>('all');
  const [search, setSearch] = useState('');

  const filtered = transactions.filter(t => {
    const matchesType = filterType === 'all' || t.type === filterType;
    const matchesSearch = t.description.toLowerCase().includes(search.toLowerCase()) || 
                          t.category.toLowerCase().includes(search.toLowerCase());
    return matchesType && matchesSearch;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-neutral-900">Transações</h2>
          <p className="text-neutral-500">Gerencie as entradas e saídas do casal.</p>
        </div>
        <Dialog open={isAddOpen || !!editingTransaction} onOpenChange={(open) => {
          if (!open) {
            setIsAddOpen(false);
            setEditingTransaction(null);
          }
        }}>
          <DialogTrigger render={<Button size="lg" className="shadow-lg shadow-primary/20" onClick={() => setIsAddOpen(true)} />}>
            <Plus className="mr-2" size={20} />
            Nova Transação
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <TransactionForm 
              coupleId={couple?.id || ""} 
              userId={profile.uid} 
              initialData={editingTransaction || undefined}
              onSuccess={() => {
                setIsAddOpen(false);
                setEditingTransaction(null);
              }} 
            />
          </DialogContent>
        </Dialog>
      </div>

      <Card className="border-none shadow-sm">
        <CardHeader className="pb-0">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" size={18} />
              <Input 
                placeholder="Buscar por descrição ou categoria..." 
                className="pl-10" 
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <Tabs value={filterType} onValueChange={(v: any) => setFilterType(v)} className="w-full md:w-auto">
              <TabsList className="grid grid-cols-3 w-full md:w-[300px]">
                <TabsTrigger value="all">Todas</TabsTrigger>
                <TabsTrigger value="income">Entradas</TabsTrigger>
                <TabsTrigger value="expense">Saídas</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="rounded-xl border border-neutral-100 overflow-hidden">
            <Table>
              <TableHeader className="bg-neutral-50">
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Por</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Pagamento</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(t => (
                  <TableRow key={t.id} className="hover:bg-neutral-50/50 transition-colors">
                    <TableCell className="text-neutral-500 font-medium">
                      {format(parseISO(t.dueDate), 'dd/MM/yyyy')}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-semibold text-neutral-900">{t.description}</span>
                        {!t.paid && <Badge variant="secondary" className="w-fit text-[10px] h-4 px-1 mt-1 bg-amber-50 text-amber-600 border-amber-100">Pendente</Badge>}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Avatar className="h-6 w-6">
                          <AvatarImage src={t.createdBy === profile.uid ? profile.photoURL : partner?.photoURL} />
                          <AvatarFallback className="text-[10px]">{t.createdBy === profile.uid ? profile.displayName[0] : (partner?.displayName?.[0] || '?')}</AvatarFallback>
                        </Avatar>
                        <span className="text-xs text-neutral-600">
                          {t.createdBy === profile.uid ? 'Você' : (partner?.displayName || 'Parceiro')}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-normal">{t.category}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 text-neutral-500">
                        {t.paymentMethod === 'pix' && <TrendingUp size={14} className="text-emerald-500" />}
                        {t.paymentMethod === 'cartao' && <CreditCard size={14} className="text-blue-500" />}
                        {t.paymentMethod === 'dinheiro' && <Banknote size={14} className="text-amber-500" />}
                        <span className="capitalize text-xs">{t.paymentMethod} {t.cardName ? `(${t.cardName})` : ''}</span>
                      </div>
                    </TableCell>
                    <TableCell className={cn(
                      "text-right font-bold",
                      t.type === 'income' ? "text-emerald-600" : "text-rose-600"
                    )}>
                      {t.type === 'income' ? '+' : '-'} R$ {t.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => setEditingTransaction(t)}>
                          <Pencil size={16} className="text-neutral-400 hover:text-primary" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => deleteDoc(doc(db, 'transactions', t.id))}>
                          <Trash2 size={16} className="text-neutral-400 hover:text-red-500" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {filtered.length === 0 && (
              <div className="py-12 text-center space-y-2">
                <AlertCircle className="mx-auto text-neutral-300" size={48} />
                <p className="text-neutral-500 font-medium">Nenhuma transação encontrada.</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function TransactionForm({ coupleId, userId, onSuccess, initialData }: { 
  coupleId: string, 
  userId: string, 
  onSuccess: () => void,
  initialData?: Transaction
}) {
  const [description, setDescription] = useState(initialData?.description || '');
  const [amount, setAmount] = useState(initialData?.amount.toString() || '');
  const [type, setType] = useState<TransactionType>(initialData?.type || 'expense');
  const [category, setCategory] = useState(initialData?.category || CATEGORIES[0]);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(initialData?.paymentMethod || 'pix');
  const [cardName, setCardName] = useState(initialData?.cardName || '');
  const [dueDate, setDueDate] = useState(initialData?.dueDate || format(new Date(), 'yyyy-MM-dd'));
  const [paid, setPaid] = useState(initialData?.paid ?? true);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description || !amount) return;

    setIsLoading(true);
    try {
      const transactionData: Omit<Transaction, 'id'> = {
        coupleId,
        description,
        amount: parseFloat(amount),
        type,
        category,
        paymentMethod,
        dueDate,
        paid,
        createdAt: initialData?.createdAt || new Date().toISOString(),
        createdBy: initialData?.createdBy || userId,
        ...(paymentMethod === 'cartao' ? { cardName } : {})
      };

      if (initialData) {
        await updateDoc(doc(db, 'transactions', initialData.id), transactionData);
      } else {
        await addDoc(collection(db, 'transactions'), transactionData);
      }
      onSuccess();
    } catch (error) {
      handleFirestoreError(error, initialData ? OperationType.UPDATE : OperationType.CREATE, 'transactions');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <DialogHeader>
        <DialogTitle>{initialData ? 'Editar Transação' : 'Nova Transação'}</DialogTitle>
        <DialogDescription>
          {initialData ? 'Altere os detalhes da transação selecionada.' : 'Adicione uma nova entrada ou saída para o casal.'}
        </DialogDescription>
      </DialogHeader>
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2 space-y-2">
          <Label>Descrição</Label>
          <Input required value={description} onChange={e => setDescription(e.target.value)} placeholder="Ex: Aluguel, Supermercado..." />
        </div>
        <div className="space-y-2">
          <Label>Valor (R$)</Label>
          <Input required type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0,00" />
        </div>
        <div className="space-y-2">
          <Label>Tipo</Label>
          <Select value={type} onValueChange={(v: any) => setType(v)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="income">Entrada</SelectItem>
              <SelectItem value="expense">Saída</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Categoria</Label>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CATEGORIES.map(cat => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Forma de Pagamento</Label>
          <Select value={paymentMethod} onValueChange={(v: any) => setPaymentMethod(v)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pix">PIX</SelectItem>
              <SelectItem value="cartao">Cartão</SelectItem>
              <SelectItem value="dinheiro">Dinheiro</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {paymentMethod === 'cartao' && (
          <div className="col-span-2 space-y-2">
            <Label>Nome do Cartão</Label>
            <Input value={cardName} onChange={e => setCardName(e.target.value)} placeholder="Ex: Nubank, Inter..." />
          </div>
        )}
        <div className="space-y-2">
          <Label>Data</Label>
          <Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
        </div>
        <div className="flex items-center gap-2 pt-8">
          <input type="checkbox" id="paid" checked={paid} onChange={e => setPaid(e.target.checked)} className="w-4 h-4 rounded border-neutral-300 text-primary focus:ring-primary" />
          <Label htmlFor="paid">Já está pago?</Label>
        </div>
      </div>
      <DialogFooter>
        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading ? "Salvando..." : "Salvar Transação"}
        </Button>
      </DialogFooter>
    </form>
  );
}

function GoalsView({ profile, couple, goals }: { profile: UserProfile, couple: Couple, goals: Goal[] }) {
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [selectedGoal, setSelectedGoal] = useState<Goal | null>(null);
  const [isProgressOpen, setIsProgressOpen] = useState(false);
  const [progressAmount, setProgressAmount] = useState('');
  const [isSavingProgress, setIsSavingProgress] = useState(false);

  const handleAddProgress = async () => {
    if (!selectedGoal || !progressAmount) return;
    setIsSavingProgress(true);
    try {
      const newAmount = selectedGoal.currentAmount + parseFloat(progressAmount);
      await updateDoc(doc(db, 'goals', selectedGoal.id), { currentAmount: newAmount });
      setIsProgressOpen(false);
      setProgressAmount('');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `goals/${selectedGoal.id}`);
    } finally {
      setIsSavingProgress(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-neutral-900">Metas Financeiras</h2>
          <p className="text-neutral-500">Planejem o futuro e acompanhem o progresso.</p>
        </div>
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger render={<Button size="lg" />}>
            <Plus className="mr-2" size={20} />
            Nova Meta
          </DialogTrigger>
          <DialogContent>
            <GoalForm coupleId={couple?.id || ""} onSuccess={() => setIsAddOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {goals.map(goal => (
          <Card key={goal.id} className="border-none shadow-sm hover:shadow-md transition-shadow">
            <CardHeader>
              <div className="flex justify-between items-start">
                <CardTitle className="text-xl">{goal.title}</CardTitle>
                <Badge variant="secondary" className="bg-primary/10 text-primary border-none">
                  {Math.round((goal.currentAmount / goal.targetAmount) * 100)}%
                </Badge>
              </div>
              <CardDescription>Prazo: {format(parseISO(goal.deadline), 'dd/MM/yyyy')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between text-sm">
                <span className="text-neutral-500">Progresso</span>
                <span className="font-bold text-neutral-900">R$ {goal.currentAmount.toLocaleString('pt-BR')} / {goal.targetAmount.toLocaleString('pt-BR')}</span>
              </div>
              <Progress value={(goal.currentAmount / goal.targetAmount) * 100} className="h-3" />
            </CardContent>
            <CardFooter className="flex gap-2">
              <Button 
                variant="outline" 
                className="flex-1" 
                onClick={() => {
                  setSelectedGoal(goal);
                  setIsProgressOpen(true);
                }}
              >
                Adicionar
              </Button>
              <Button variant="ghost" size="icon" onClick={() => deleteDoc(doc(db, 'goals', goal.id))}>
                <Trash2 size={16} className="text-neutral-400 hover:text-red-500" />
              </Button>
            </CardFooter>
          </Card>
        ))}
        {goals.length === 0 && (
          <div className="col-span-full py-20 text-center bg-white rounded-2xl border-2 border-dashed border-neutral-200">
            <Target className="mx-auto text-neutral-200 mb-4" size={64} />
            <h3 className="text-xl font-bold text-neutral-900">Nenhuma meta ainda</h3>
            <p className="text-neutral-500 max-w-xs mx-auto mt-2">Defina objetivos como uma viagem, reserva de emergência ou a casa própria.</p>
          </div>
        )}
      </div>

      <Dialog open={isProgressOpen} onOpenChange={setIsProgressOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Adicionar Progresso</DialogTitle>
            <DialogDescription>Quanto você quer adicionar à meta "{selectedGoal?.title}"?</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label>Valor (R$)</Label>
            <Input 
              type="number" 
              value={progressAmount} 
              onChange={e => setProgressAmount(e.target.value)} 
              placeholder="0,00"
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsProgressOpen(false)} disabled={isSavingProgress}>Cancelar</Button>
            <Button onClick={handleAddProgress} disabled={isSavingProgress}>
              {isSavingProgress ? "Salvando..." : "Confirmar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MonthlyBillsView({ coupleId, bills, transactions }: { coupleId: string, bills: MonthlyBill[], transactions: Transaction[] }) {
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingBill, setEditingBill] = useState<MonthlyBill | null>(null);

  const totalMonthly = bills.reduce((acc, b) => acc + b.amount, 0);
  const totalPaid = bills.filter(b => b.paid).reduce((acc, b) => acc + b.amount, 0);

  // Suggest budget: Sum of bills + average variable expenses from previous months
  const suggestedBudget = useMemo(() => {
    const historicalExpenses = transactions.filter(t => t.type === 'expense').reduce((acc, t) => acc + t.amount, 0);				 
    // This is overly simple, let's just make it Total Monthly Bills + 30% for variable expenses
    return totalMonthly + (totalMonthly * 0.3);
  }, [bills, transactions, totalMonthly]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-neutral-900">Contas Mensais</h2>
          <p className="text-neutral-500">Acompanhe seus gastos fixos e parcelas.</p>
        </div>
        <Dialog open={isAddOpen || !!editingBill} onOpenChange={(open) => {
          if (!open) {
            setIsAddOpen(false);
            setEditingBill(null);
          }
        }}>
          <DialogTrigger render={<Button size="lg" className="shadow-lg shadow-primary/20" onClick={() => setIsAddOpen(true)} />}>
            <Plus className="mr-2" size={20} />
            Nova Conta
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <MonthlyBillForm 
              coupleId={coupleId} 
              initialData={editingBill || undefined}
              onSuccess={() => {
                setIsAddOpen(false);
                setEditingBill(null);
              }} 
            />
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="border-none shadow-sm bg-primary text-white">
          <CardHeader className="pb-2">
            <CardDescription className="text-primary-foreground/70">Total Mensal</CardDescription>
            <CardTitle className="text-2xl">R$ {totalMonthly.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-none shadow-sm bg-blue-600 text-white">
          <CardHeader className="pb-2">
            <CardDescription className="text-white/70">Orçamento Sugerido</CardDescription>
            <CardTitle className="text-2xl">R$ {suggestedBudget.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-none shadow-sm bg-emerald-500 text-white">
          <CardHeader className="pb-2">
            <CardDescription className="text-white/70">Pago</CardDescription>
            <CardTitle className="text-2xl">R$ {totalPaid.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-none shadow-sm bg-rose-500 text-white">
          <CardHeader className="pb-2">
            <CardDescription className="text-white/70">Pendente</CardDescription>
            <CardTitle className="text-2xl">R$ {(totalMonthly - totalPaid).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card className="border-none shadow-sm">
        <CardContent className="pt-6">
          <div className="rounded-xl border border-neutral-100 overflow-hidden">
            <Table>
              <TableHeader className="bg-neutral-50">
                <TableRow>
                  <TableHead>Dia Venc.</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bills.map(bill => (
                  <TableRow key={bill.id} className="hover:bg-neutral-50/50 transition-colors">
                    <TableCell className="font-medium text-neutral-500">Dia {bill.dueDateDay}</TableCell>
                    <TableCell className="font-semibold text-neutral-900">{bill.title}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-normal">{bill.category}</Badge>
                    </TableCell>
                    <TableCell>
                      <button 
                        onClick={() => updateDoc(doc(db, 'monthlyBills', bill.id), { paid: !bill.paid })}
                        className={cn(
                          "px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider transition-colors",
                          bill.paid ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
                        )}
                      >
                        {bill.paid ? 'Pago' : 'Pendente'}
                      </button>
                    </TableCell>
                    <TableCell className="text-right font-bold text-neutral-900">
                      R$ {bill.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => setEditingBill(bill)}>
                          <Pencil size={16} className="text-neutral-400 hover:text-primary" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => deleteDoc(doc(db, 'monthlyBills', bill.id))}>
                          <Trash2 size={16} className="text-neutral-400 hover:text-red-500" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {bills.length === 0 && (
              <div className="py-12 text-center space-y-2">
                <FileText className="mx-auto text-neutral-300" size={48} />
                <p className="text-neutral-500 font-medium">Nenhuma conta mensal cadastrada.</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function MonthlyBillForm({ coupleId, onSuccess, initialData }: { 
  coupleId: string, 
  onSuccess: () => void,
  initialData?: MonthlyBill
}) {
  const [title, setTitle] = useState(initialData?.title || '');
  const [amount, setAmount] = useState(initialData?.amount.toString() || '');
  const [dueDateDay, setDueDateDay] = useState(initialData?.dueDateDay.toString() || '1');
  const [category, setCategory] = useState(initialData?.category || 'Moradia');
  const [paid, setPaid] = useState(initialData?.paid ?? false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !amount || !dueDateDay) return;

    setIsLoading(true);
    try {
      const billData: Omit<MonthlyBill, 'id'> = {
        coupleId,
        title,
        amount: parseFloat(amount),
        dueDateDay: parseInt(dueDateDay),
        category,
        paid,
        createdAt: initialData?.createdAt || new Date().toISOString(),
      };

      if (initialData) {
        await updateDoc(doc(db, 'monthlyBills', initialData.id), billData);
      } else {
        await addDoc(collection(db, 'monthlyBills'), billData);
      }
      onSuccess();
    } catch (error) {
      handleFirestoreError(error, initialData ? OperationType.UPDATE : OperationType.CREATE, 'monthlyBills');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <DialogHeader>
        <DialogTitle>{initialData ? 'Editar Conta' : 'Nova Conta Mensal'}</DialogTitle>
        <DialogDescription>
          {initialData ? 'Altere os detalhes da conta selecionada.' : 'Adicione uma conta que se repete todos os meses.'}
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Descrição</Label>
          <Input required value={title} onChange={e => setTitle(e.target.value)} placeholder="Ex: Aluguel, Internet, Parcela Carro..." />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Valor (R$)</Label>
            <Input required type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0,00" />
          </div>
          <div className="space-y-2">
            <Label>Dia do Vencimento</Label>
            <Input required type="number" min="1" max="31" value={dueDateDay} onChange={e => setDueDateDay(e.target.value)} />
          </div>
        </div>
        <div className="space-y-2">
          <Label>Categoria</Label>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {['Moradia', 'Transporte', 'Educação', 'Saúde', 'Lazer', 'Assinaturas', 'Outros'].map(cat => (
                <SelectItem key={cat} value={cat}>{cat}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2 pt-2">
          <input type="checkbox" id="bill-paid" checked={paid} onChange={e => setPaid(e.target.checked)} className="w-4 h-4 rounded border-neutral-300 text-primary focus:ring-primary" />
          <Label htmlFor="bill-paid">Já está pago este mês?</Label>
        </div>
      </div>
      <DialogFooter>
        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading ? "Salvando..." : (initialData ? "Salvar Alterações" : "Criar Conta")}
        </Button>
      </DialogFooter>
    </form>
  );
}

function GoalForm({ coupleId, onSuccess }: { coupleId: string, onSuccess: () => void }) {
  const [title, setTitle] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [currentAmount, setCurrentAmount] = useState('0');
  const [deadline, setDeadline] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !targetAmount || !deadline) return;

    setIsLoading(true);
    try {
      const newGoal: Omit<Goal, 'id'> = {
        coupleId,
        title,
        targetAmount: parseFloat(targetAmount),
        currentAmount: parseFloat(currentAmount),
        deadline,
        createdAt: new Date().toISOString(),
      };

      await addDoc(collection(db, 'goals'), newGoal);
      onSuccess();
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'goals');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <DialogHeader>
        <DialogTitle>Nova Meta</DialogTitle>
        <DialogDescription>O que vocês querem conquistar juntos?</DialogDescription>
      </DialogHeader>
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Título da Meta</Label>
          <Input required value={title} onChange={e => setTitle(e.target.value)} placeholder="Ex: Viagem para Paris, Carro Novo..." />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Valor Alvo (R$)</Label>
            <Input required type="number" value={targetAmount} onChange={e => setTargetAmount(e.target.value)} placeholder="0,00" />
          </div>
          <div className="space-y-2">
            <Label>Valor Atual (R$)</Label>
            <Input required type="number" value={currentAmount} onChange={e => setCurrentAmount(e.target.value)} />
          </div>
        </div>
        <div className="space-y-2">
          <Label>Prazo</Label>
          <Input required type="date" value={deadline} onChange={e => setDeadline(e.target.value)} />
        </div>
      </div>
      <DialogFooter>
        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading ? "Criando..." : "Criar Meta"}
        </Button>
      </DialogFooter>
    </form>
  );
}

function CalendarView({ transactions, monthlyBills, profile, couple }: { 
  transactions: Transaction[], 
  monthlyBills: MonthlyBill[],
  profile: UserProfile,
  couple: Couple
}) {
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [addType, setAddType] = useState<'transaction' | 'bill'>('transaction');

  const monthTransactions = useMemo(() => {
    if (!date) return [];
    return transactions.filter(t => isSameMonth(parseISO(t.dueDate), date));
  }, [transactions, date]);

  const monthBills = useMemo(() => {
    if (!date) return [];
    return monthlyBills.map(b => ({
      ...b,
      // Create a virtual date for this month's occurrence
      virtualDate: new Date(date.getFullYear(), date.getMonth(), b.dueDateDay)
    }));
  }, [monthlyBills, date]);

  const selectedDayEntries = useMemo(() => {
    if (!date) return [];
    const tEntries = transactions.filter(t => {
      const tDate = parseISO(t.dueDate);
      return format(tDate, 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd');
    }).map(t => ({ ...t, kind: 'transaction' as const }));

    const bEntries = monthlyBills.filter(b => b.dueDateDay === date.getDate()).map(b => ({ ...b, kind: 'bill' as const }));

    return [...tEntries, ...bEntries];
  }, [transactions, monthlyBills, date]);

  const totalIncome = monthTransactions.filter(t => t.type === 'income').reduce((acc, t) => acc + t.amount, 0);
  const totalExpenses = monthTransactions.filter(t => t.type === 'expense').reduce((acc, t) => acc + t.amount, 0) + 
                        monthBills.reduce((acc, b) => acc + b.amount, 0);
  const balance = totalIncome - totalExpenses;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-neutral-900">Calendário Financeiro</h2>
          <p className="text-neutral-500">Acompanhe seus vencimentos e recebimentos.</p>
        </div>
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger render={<Button size="lg" className="shadow-lg shadow-primary/20" />}>
            <Plus className="mr-2" size={20} />
            Incluir no Calendário
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>O que deseja incluir?</DialogTitle>
              <DialogDescription>Escolha entre uma movimentação única ou uma conta mensal recorrente.</DialogDescription>
            </DialogHeader>
            <Tabs value={addType} onValueChange={(v: any) => setAddType(v)} className="w-full">
              <TabsList className="grid grid-cols-2 mb-4">
                <TabsTrigger value="transaction">Transação</TabsTrigger>
                <TabsTrigger value="bill">Conta Mensal</TabsTrigger>
              </TabsList>
              <TabsContent value="transaction">
                <TransactionForm 
                  coupleId={couple.id} 
                  userId={profile.uid} 
                  initialData={date ? { dueDate: format(date, 'yyyy-MM-dd') } as any : undefined}
                  onSuccess={() => setIsAddOpen(false)} 
                />
              </TabsContent>
              <TabsContent value="bill">
                <MonthlyBillForm 
                  coupleId={couple.id} 
                  initialData={date ? { dueDateDay: date.getDate() } as any : undefined}
                  onSuccess={() => setIsAddOpen(false)} 
                />
              </TabsContent>
            </Tabs>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <Card className="lg:col-span-2 border-none shadow-sm p-4">
          <Calendar
            mode="single"
            selected={date}
            onSelect={setDate}
            className="rounded-md border-none w-full"
            locale={ptBR}
            modifiers={{
              hasEntry: (d) => {
                const dayStr = format(d, 'yyyy-MM-dd');
                const hasT = transactions.some(t => format(parseISO(t.dueDate), 'yyyy-MM-dd') === dayStr);
                const hasB = monthlyBills.some(b => b.dueDateDay === d.getDate());
                return hasT || hasB;
              }
            }}
            modifiersStyles={{
              hasEntry: { fontWeight: 'bold', textDecoration: 'underline', color: 'hsl(var(--primary))' }
            }}
          />
        </Card>

        <div className="space-y-6">
          <Card className="border-none shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-lg">
                {date ? format(date, "dd 'de' MMMM", { locale: ptBR }) : 'Selecione um dia'}
              </CardTitle>
              {date && (
                <Button size="icon" variant="ghost" className="h-8 w-8 text-primary" onClick={() => setIsAddOpen(true)}>
                  <Plus size={18} />
                </Button>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              {selectedDayEntries.length > 0 ? (
                selectedDayEntries.map((entry, idx) => {
                  const isTransaction = 'kind' in entry && entry.kind === 'transaction';
                  const isBill = 'kind' in entry && entry.kind === 'bill';
                  
                  return (
                    <div key={idx} className="flex items-center justify-between p-3 bg-neutral-50 rounded-xl relative overflow-hidden">
                      {isBill && <div className="absolute left-0 top-0 bottom-0 w-1 bg-amber-400" title="Conta Mensal" />}
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "w-2 h-2 rounded-full",
                          (entry as any).type === 'income' ? "bg-emerald-500" : "bg-rose-500"
                        )} />
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-neutral-700">{(entry as any).description || (entry as any).title}</span>
                          <span className="text-[10px] text-neutral-400 uppercase tracking-wider font-bold">
                            {isBill ? 'Conta Mensal' : (entry as any).category}
                          </span>
                        </div>
                      </div>
                      <span className={cn(
                        "text-sm font-bold",
                        (entry as any).type === 'income' ? "text-emerald-600" : "text-rose-600"
                      )}>
                        R$ {(entry as any).amount.toLocaleString('pt-BR')}
                      </span>
                    </div>
                  );
                })
              ) : (
                <div className="py-8 text-center">
                  <p className="text-sm text-neutral-400">Vazio para este dia.</p>
                  <Button variant="link" size="sm" onClick={() => setIsAddOpen(true)} className="mt-2">
                    Adicionar algo?
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm bg-neutral-900 text-white">
            <CardHeader>
              <CardTitle className="text-lg">Previsão do Mês</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between">
                <span className="text-neutral-400">Total Entradas</span>
                <span className="text-emerald-400 font-bold">R$ {totalIncome.toLocaleString('pt-BR')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-400">Total Saídas + Fixos</span>
                <span className="text-rose-400 font-bold">R$ {totalExpenses.toLocaleString('pt-BR')}</span>
              </div>
              <Separator className="bg-neutral-800" />
              <div className="flex justify-between text-lg">
                <span className="font-bold text-neutral-200 text-sm">Balanço Previsto</span>
                <span className={cn(
                  "font-bold",
                  balance >= 0 ? "text-emerald-400" : "text-rose-400"
                )}>
                  R$ {(totalIncome - totalExpenses).toLocaleString('pt-BR')}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function LearningTrailView({ progress, profile }: { progress: LearningProgress | null, profile: UserProfile }) {
  const [selectedStep, setSelectedStep] = useState<LearningStep | null>(null);
  const [aiContent, setAiContent] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);

  const handleStepClick = async (step: LearningStep) => {
    setSelectedStep(step);
    setIsLoading(true);
    const content = await generateLearningContent(step.title);
    setAiContent(content);
    setIsLoading(false);
  };

  const markAsCompleted = async (stepId: string) => {
    if (!progress) return;
    const newCompleted = [...new Set([...progress.completedSteps, stepId])];
    await setDoc(doc(db, 'learningProgress', profile.uid), {
      userId: profile.uid,
      completedSteps: newCompleted
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-neutral-900">Trilha de Aprendizado</h2>
        <p className="text-neutral-500">Desenvolvam curiosidade, disciplina e conhecimento financeiro.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="space-y-4">
          {LEARNING_STEPS.map((step, index) => {
            const isCompleted = progress?.completedSteps.includes(step.id);
            const isSelected = selectedStep?.id === step.id;
            
            return (
              <Card 
                key={step.id} 
                className={cn(
                  "cursor-pointer transition-all border-none shadow-sm hover:shadow-md",
                  isSelected ? "ring-2 ring-primary" : "",
                  isCompleted ? "bg-emerald-50/50" : "bg-white"
                )}
                onClick={() => handleStepClick(step)}
              >
                <CardContent className="p-4 flex items-center gap-4">
                  <div className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center font-bold",
                    isCompleted ? "bg-emerald-500 text-white" : "bg-neutral-100 text-neutral-400"
                  )}>
                    {isCompleted ? <CheckCircle2 size={20} /> : index + 1}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-bold text-neutral-900">{step.title}</p>
                    <Badge variant="outline" className="text-[10px] uppercase tracking-wider mt-1">
                      {step.category}
                    </Badge>
                  </div>
                  <ChevronRight size={16} className="text-neutral-300" />
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Card className="lg:col-span-2 border-none shadow-sm min-h-[500px]">
          <CardHeader>
            <CardTitle>{selectedStep ? selectedStep.title : 'Selecione um passo para começar'}</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                <div className="h-4 bg-neutral-100 rounded animate-pulse w-3/4"></div>
                <div className="h-4 bg-neutral-100 rounded animate-pulse w-full"></div>
                <div className="h-4 bg-neutral-100 rounded animate-pulse w-5/6"></div>
                <div className="h-4 bg-neutral-100 rounded animate-pulse w-2/3"></div>
              </div>
            ) : selectedStep ? (
              <div className="prose prose-neutral max-w-none">
                <ReactMarkdown>{aiContent}</ReactMarkdown>
                <Separator className="my-8" />
                <div className="flex justify-end">
                  {!progress?.completedSteps.includes(selectedStep.id) && (
                    <Button onClick={() => markAsCompleted(selectedStep.id)}>
                      Marcar como Concluído
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full py-20 text-neutral-400">
                <BookOpen size={64} className="mb-4 opacity-20" />
                <p>O conhecimento é a base para a liberdade financeira.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function NavItem({ icon, label, active, onClick }: { icon: React.ReactNode, label: string, active: boolean, onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all",
        active 
          ? "bg-primary text-white shadow-lg shadow-primary/20" 
          : "text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900"
      )}
    >
      {icon}
      {label}
    </button>
  );
}

function FinancesView({ coupleId, loans, investments }: { coupleId: string, loans: Loan[], investments: Investment[] }) {
  const [isLoanDialogOpen, setIsLoanDialogOpen] = useState(false);
  const [isInvestmentDialogOpen, setIsInvestmentDialogOpen] = useState(false);
  const [editingLoan, setEditingLoan] = useState<Loan | null>(null);
  const [editingInvestment, setEditingInvestment] = useState<Investment | null>(null);

  const totalLoans = loans.reduce((acc, l) => {
    if (l.totalInstallments && l.currentInstallment !== undefined) {
      return acc + (l.monthlyPayment * (l.totalInstallments - l.currentInstallment));
    }
    return acc + l.remainingAmount;
  }, 0);

  const totalInvestments = investments.reduce((acc, i) => acc + i.amount, 0);
  
  const investedSoFar = investments.reduce((acc, i) => {
    if (i.totalInstallments && i.currentInstallment !== undefined) {
      return acc + (i.amount * i.currentInstallment);
    }
    return acc + i.amount;
  }, 0);

  return (
    <div className="space-y-8">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-3xl font-bold text-neutral-900">Investimentos & Dívidas</h2>
          <p className="text-neutral-500">Gestão de patrimônio e compromissos financeiros.</p>
        </div>
        <div className="flex flex-wrap gap-3">
           <Dialog open={isInvestmentDialogOpen} onOpenChange={setIsInvestmentDialogOpen}>
            <DialogTrigger render={<Button variant="outline" className="rounded-xl border-emerald-200 text-emerald-700 hover:bg-emerald-50" />}>
              <PiggyBank className="mr-2" size={18} />
              Novo Investimento
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>{editingInvestment ? 'Editar Investimento' : 'Novo Investimento'}</DialogTitle>
                <DialogDescription>Acompanhe seu patrimônio em crescimento.</DialogDescription>
              </DialogHeader>
              <InvestmentForm 
                coupleId={coupleId} 
                initialData={editingInvestment} 
                onSuccess={() => { setIsInvestmentDialogOpen(false); setEditingInvestment(null); }} 
              />
            </DialogContent>
          </Dialog>

          <Dialog open={isLoanDialogOpen} onOpenChange={setIsLoanDialogOpen}>
            <DialogTrigger render={<Button className="rounded-xl" />}>
              <Landmark className="mr-2" size={18} />
              Novo Empréstimo
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>{editingLoan ? 'Editar Empréstimo' : 'Novo Empréstimo'}</DialogTitle>
                <DialogDescription>Controle suas dívidas e juros.</DialogDescription>
              </DialogHeader>
              <LoanForm 
                coupleId={coupleId} 
                initialData={editingLoan} 
                onSuccess={() => { setIsLoanDialogOpen(false); setEditingLoan(null); }} 
              />
            </DialogContent>
          </Dialog>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card className="bg-emerald-50 border-none shadow-sm relative overflow-hidden group">
          <div className="absolute right-[-20px] top-[-20px] opacity-10 group-hover:scale-110 transition-transform">
            <PiggyBank size={120} className="text-emerald-900" />
          </div>
          <CardHeader className="pb-2">
            <CardDescription className="text-emerald-700 font-medium">Patrimônio Atual (Ativos)</CardDescription>
            <CardTitle className="text-3xl font-bold text-emerald-900">R$ {totalInvestments.toLocaleString('pt-BR')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-1">
              <div className="text-xs text-emerald-600 bg-emerald-100/50 p-2 rounded-lg inline-block">
                Investido até agora: R$ {investedSoFar.toLocaleString('pt-BR')}
              </div>
              <p className="text-[10px] text-emerald-500 mt-1">* Soma de aportes realizados</p>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-rose-50 border-none shadow-sm relative overflow-hidden group">
          <div className="absolute right-[-20px] top-[-20px] opacity-10 group-hover:scale-110 transition-transform">
            <Landmark size={120} className="text-rose-900" />
          </div>
          <CardHeader className="pb-2">
            <CardDescription className="text-rose-700 font-medium">Saldo Devedor Projetado</CardDescription>
            <CardTitle className="text-3xl font-bold text-rose-900">R$ {totalLoans.toLocaleString('pt-BR')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-1">
              <div className="text-xs text-rose-600 bg-rose-100/50 p-2 rounded-lg inline-block">
                {loans.length} compromissos ativos
              </div>
              <p className="text-[10px] text-rose-500 mt-1">* Baseado nas parcelas restantes</p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-blue-50 border-none shadow-sm">
          <CardHeader className="pb-2">
            <CardDescription className="text-blue-700 font-medium">Patrimônio Líquido</CardDescription>
            <CardTitle className={cn(
              "text-3xl font-bold",
              totalInvestments - totalLoans >= 0 ? "text-blue-900" : "text-rose-900"
            )}>
              R$ {(totalInvestments - totalLoans).toLocaleString('pt-BR')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-blue-600">Diferença entre ativos e passivos</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card className="border-none shadow-sm">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <PiggyBank size={20} className="text-emerald-500" />
                Investimentos
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ativo</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Parcelas</TableHead>
                  <TableHead>Taxa</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead className="text-right">Opções</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {investments.map(inv => (
                  <TableRow key={inv.id}>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-semibold text-neutral-900">{inv.title}</span>
                        {inv.totalInstallments && (
                          <span className="text-[10px] text-neutral-400">Parcelas: {inv.currentInstallment || 0}/{inv.totalInstallments}</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 hover:bg-emerald-200 border-none">
                        {inv.type}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-neutral-500 text-sm">
                      {inv.totalInstallments ? `${inv.currentInstallment || 0}/${inv.totalInstallments}` : '-'}
                    </TableCell>
                    <TableCell className="text-neutral-500 text-sm">{inv.interestRate ? `${inv.interestRate}%` : '-'}</TableCell>
                    <TableCell className="font-bold text-emerald-600">R$ {inv.amount.toLocaleString('pt-BR')}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => { setEditingInvestment(inv); setIsInvestmentDialogOpen(true); }}>
                          <Pencil size={16} className="text-neutral-400" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => deleteDoc(doc(db, 'investments', inv.id))}>
                          <Trash2 size={16} className="text-neutral-400 hover:text-rose-500" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {investments.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-12">
                      <div className="flex flex-col items-center gap-2">
                        <PiggyBank className="text-neutral-200" size={48} />
                        <p className="text-neutral-400 text-sm">Ainda não há investimentos registrados.</p>
                        <Button variant="link" onClick={() => setIsInvestmentDialogOpen(true)}>Começar a investir?</Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Landmark size={20} className="text-rose-500" />
              Empréstimos & Dívidas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Título</TableHead>
                  <TableHead>Credor</TableHead>
                  <TableHead>Juros</TableHead>
                  <TableHead>Saldo</TableHead>
                  <TableHead className="text-right">Opções</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loans.map(loan => (
                  <TableRow key={loan.id}>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-semibold text-neutral-900">{loan.title}</span>
                        <div className="flex flex-col gap-0.5 mt-0.5">
                          <span className="text-[10px] text-neutral-400">Parcela: R$ {loan.monthlyPayment.toLocaleString('pt-BR')} (Dia {loan.dueDateDay})</span>
                          {loan.totalInstallments ? (
                            <span className="text-[10px] text-primary/70 font-medium">Progresso: {loan.currentInstallment}/{loan.totalInstallments} parcelas</span>
                          ) : null}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-neutral-500 text-sm">{loan.lender}</TableCell>
                    <TableCell className="text-neutral-500 text-sm">{loan.interestRate}%</TableCell>
                    <TableCell className="font-bold text-rose-600">
                      R$ {(loan.totalInstallments && loan.currentInstallment !== undefined 
                          ? loan.monthlyPayment * (loan.totalInstallments - loan.currentInstallment)
                          : loan.remainingAmount).toLocaleString('pt-BR')}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => { setEditingLoan(loan); setIsLoanDialogOpen(true); }}>
                          <Pencil size={16} className="text-neutral-400" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => deleteDoc(doc(db, 'loans', loan.id))}>
                          <Trash2 size={16} className="text-neutral-400 hover:text-rose-500" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {loans.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-12">
                      <div className="flex flex-col items-center gap-2">
                        <Landmark className="text-neutral-200" size={48} />
                        <p className="text-neutral-400 text-sm">Sem dívidas ativas. Excelente!</p>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function LoanForm({ coupleId, initialData, onSuccess }: { coupleId: string, initialData?: Loan | null, onSuccess: () => void }) {
  const [formData, setFormData] = useState({
    title: initialData?.title || '',
    totalAmount: initialData?.totalAmount || 0,
    remainingAmount: initialData?.remainingAmount || 0,
    interestRate: initialData?.interestRate || 0,
    monthlyPayment: initialData?.monthlyPayment || 0,
    dueDateDay: initialData?.dueDateDay || 10,
    lender: initialData?.lender || '',
    totalInstallments: initialData?.totalInstallments || 0,
    currentInstallment: initialData?.currentInstallment || 0,
  });
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      if (initialData) {
        await updateDoc(doc(db, 'loans', initialData.id), formData);
      } else {
        await addDoc(collection(db, 'loans'), {
          ...formData,
          coupleId,
          createdAt: new Date().toISOString()
        });
      }
      onSuccess();
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'loans');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 py-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2 col-span-1 md:col-span-2">
          <Label>Título / Finalidade</Label>
          <Input required value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} placeholder="Ex: Financiamento do Carro" />
        </div>
        <div className="space-y-2">
          <Label>Valor Total Emprestado</Label>
          <Input required type="number" value={formData.totalAmount} onChange={e => setFormData({ ...formData, totalAmount: Number(e.target.value) })} />
        </div>
        <div className="space-y-2">
          <Label>Saldo Devedor Atual</Label>
          <Input required type="number" value={formData.remainingAmount} onChange={e => setFormData({ ...formData, remainingAmount: Number(e.target.value) })} />
        </div>
        <div className="space-y-2">
          <Label>Taxa de Juros (%)</Label>
          <Input required type="number" step="0.01" value={formData.interestRate} onChange={e => setFormData({ ...formData, interestRate: Number(e.target.value) })} />
        </div>
        <div className="space-y-2">
          <Label>Valor da Parcela</Label>
          <Input required type="number" value={formData.monthlyPayment} onChange={e => setFormData({ ...formData, monthlyPayment: Number(e.target.value) })} />
        </div>
        <div className="space-y-2">
          <Label>Dia do Vencimento</Label>
          <Input required type="number" min={1} max={31} value={formData.dueDateDay} onChange={e => setFormData({ ...formData, dueDateDay: Number(e.target.value) })} />
        </div>
        <div className="space-y-2">
          <Label>Instituição Credora</Label>
          <Input required value={formData.lender} onChange={e => setFormData({ ...formData, lender: e.target.value })} placeholder="Ex: Banco do Brasil" />
        </div>
        <div className="space-y-2 text-primary/80 font-semibold flex items-center gap-2 mt-2">
          <Receipt size={16} /> Parcelas
        </div>
        <div className="grid grid-cols-2 gap-4 col-span-1 md:col-span-2">
          <div className="space-y-2">
            <Label>Parcela Atual</Label>
            <Input type="number" value={formData.currentInstallment} onChange={e => setFormData({ ...formData, currentInstallment: Number(e.target.value) })} />
          </div>
          <div className="space-y-2">
            <Label>Total de Parcelas</Label>
            <Input type="number" value={formData.totalInstallments} onChange={e => setFormData({ ...formData, totalInstallments: Number(e.target.value) })} />
          </div>
        </div>
      </div>
      <DialogFooter>
        <Button type="submit" className="w-full h-12 text-lg" disabled={isLoading}>
          {isLoading ? "Salvando..." : (initialData ? "Atualizar Empréstimo" : "Salvar Empréstimo")}
        </Button>
      </DialogFooter>
    </form>
  );
}

function InvestmentForm({ coupleId, initialData, onSuccess }: { coupleId: string, initialData?: Investment | null, onSuccess: () => void }) {
  const [formData, setFormData] = useState({
    title: initialData?.title || '',
    amount: initialData?.amount || 0,
    type: initialData?.type || '',
    interestRate: initialData?.interestRate || 0,
    currentInstallment: initialData?.currentInstallment || 0,
    totalInstallments: initialData?.totalInstallments || 0,
  });
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      if (initialData) {
        await updateDoc(doc(db, 'investments', initialData.id), formData);
      } else {
        await addDoc(collection(db, 'investments'), {
          ...formData,
          coupleId,
          createdAt: new Date().toISOString()
        });
      }
      onSuccess();
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'investments');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 py-4">
      <div className="space-y-2">
        <Label>Descrição do Investimento</Label>
        <Input required value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} placeholder="Ex: Reserva BCB" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Tipo de Ativo</Label>
           <Select value={formData.type} onValueChange={v => setFormData({ ...formData, type: v })}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Capitalização BCB">Capitalização BCB</SelectItem>
              <SelectItem value="CDB/Pós-fixado">CDB/Pós-fixado</SelectItem>
              <SelectItem value="Tesouro Direto">Tesouro Direto</SelectItem>
              <SelectItem value="Ações">Ações</SelectItem>
              <SelectItem value="FIIs">FIIs</SelectItem>
              <SelectItem value="Criptoativos">Criptoativos</SelectItem>
              <SelectItem value="Outros">Outros</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Rendimento Est. (%)</Label>
          <Input type="number" step="0.01" value={formData.interestRate} onChange={e => setFormData({ ...formData, interestRate: Number(e.target.value) })} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Parcela Atual</Label>
          <Input type="number" value={formData.currentInstallment} onChange={e => setFormData({ ...formData, currentInstallment: Number(e.target.value) })} />
        </div>
        <div className="space-y-2">
          <Label>Total de Parcelas</Label>
          <Input type="number" value={formData.totalInstallments} onChange={e => setFormData({ ...formData, totalInstallments: Number(e.target.value) })} />
        </div>
      </div>
      <div className="space-y-2">
        <Label>Valor Investido (Total ou Mensal)</Label>
        <Input required type="number" value={formData.amount} onChange={e => setFormData({ ...formData, amount: Number(e.target.value) })} />
      </div>
      <DialogFooter>
        <Button type="submit" className="w-full h-12 text-lg" disabled={isLoading}>
          {isLoading ? "Salvando..." : (initialData ? "Atualizar Investimento" : "Salvar Investimento")}
        </Button>
      </DialogFooter>
    </form>
  );
}

function ProfileView({ 
  profile, 
  partner, 
  couple, 
  deferredPrompt, 
  handleInstallApp 
}: { 
  profile: UserProfile, 
  partner: UserProfile | null, 
  couple: Couple, 
  deferredPrompt: any, 
  handleInstallApp: () => Promise<void> 
}) {
  const [income, setIncome] = useState(profile.individualIncome.toString());
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const handleSave = async () => {
    setIsSaving(true);
    setSaveStatus('idle');
    try {
      await updateDoc(doc(db, 'users', profile.uid), {
        individualIncome: parseFloat(income) || 0
      });
      setSaveStatus('success');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (error) {
      setSaveStatus('error');
      handleFirestoreError(error, OperationType.UPDATE, `users/${profile.uid}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div>
        <h2 className="text-3xl font-bold text-neutral-900">Seu Perfil</h2>
        <p className="text-neutral-500">Gerencie suas informações individuais e do casal.</p>
      </div>

      <Card className="border-none shadow-sm">
        <CardHeader>
          <CardTitle>Informações Pessoais</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center gap-4">
            <Avatar className="h-20 w-20 border-4 border-primary/10">
              <AvatarImage src={profile.photoURL} />
              <AvatarFallback className="text-2xl">{profile.displayName[0]}</AvatarFallback>
            </Avatar>
            <div>
              <h3 className="text-xl font-bold text-neutral-900">{profile.displayName}</h3>
              <p className="text-neutral-500">{profile.email}</p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="income">Sua Renda Individual Mensal (R$)</Label>
            <Input 
              id="income" 
              type="number" 
              value={income} 
              onChange={e => setIncome(e.target.value)} 
              placeholder="0,00"
            />
            <p className="text-xs text-neutral-400">Esta informação é usada para calcular a renda conjunta do casal.</p>
          </div>

          <div className="space-y-4">
            <Button onClick={handleSave} disabled={isSaving} className="w-full">
              {isSaving ? "Salvando..." : "Salvar Alterações"}
            </Button>

            <Button 
              variant="outline" 
              className="w-full gap-2"
              onClick={async () => {
                const granted = await NotificationService.requestPermission();
                if (granted) {
                  NotificationService.sendNotification('Notificações Ativadas! 🔔', {
                    body: 'Agora você receberá alertas sobre suas contas mensais.'
                  });
                } else {
                  alert('Permissão de notificação negada ou não suportada pelo navegador.');
                }
              }}
            >
              <Bell size={18} />
              Ativar Notificações Push
            </Button>

            {deferredPrompt ? (
              <Button 
                onClick={handleInstallApp}
                className="w-full gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                <Download size={18} />
                Instalar Aplicativo no Celular
              </Button>
            ) : (
              <div className="bg-amber-50 p-4 rounded-lg border border-amber-100">
                <p className="text-sm text-amber-800 font-medium flex items-center gap-2">
                  <Download size={16} />
                  Dica de Instalação
                </p>
                <p className="text-xs text-amber-700 mt-1">
                  Se o botão de instalação não aparecer, você pode adicionar este app à sua tela inicial manualmente através do menu do seu navegador (ex: "Adicionar à tela de início" no Chrome ou "Compartilhar &gt; Adicionar à Tela de Início" no Safari).
                </p>
              </div>
            )}
            
            {saveStatus === 'success' && (
              <p className="text-sm text-emerald-600 text-center font-medium animate-in fade-in slide-in-from-top-1">
                Perfil atualizado com sucesso!
              </p>
            )}
            {saveStatus === 'error' && (
              <p className="text-sm text-rose-600 text-center font-medium animate-in fade-in slide-in-from-top-1">
                Erro ao salvar. Tente novamente.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="border-none shadow-sm">
        <CardHeader>
          <CardTitle>Seu Casal: {couple?.name || "Carregando..."}</CardTitle>
          <CardDescription>Código de convite: <code className="bg-neutral-100 px-2 py-1 rounded text-primary font-bold">{couple?.id}</code></CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-neutral-50 rounded-xl border border-neutral-100">
            <div className="flex items-center gap-3">
              <Avatar className="h-10 w-10">
                <AvatarImage src={profile.photoURL} />
                <AvatarFallback>{profile.displayName[0]}</AvatarFallback>
              </Avatar>
              <div>
                <p className="text-sm font-bold text-neutral-900">{profile.displayName}</p>
                <p className="text-xs text-emerald-600 font-medium">R$ {profile.individualIncome.toLocaleString('pt-BR')}</p>
              </div>
            </div>
            <Badge>Você</Badge>
          </div>

          {partner ? (
            <div className="flex items-center justify-between p-4 bg-neutral-50 rounded-xl border border-neutral-100">
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={partner.photoURL} />
                  <AvatarFallback>{partner.displayName[0]}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-sm font-bold text-neutral-900">{partner.displayName}</p>
                  <p className="text-xs text-emerald-600 font-medium">R$ {partner.individualIncome.toLocaleString('pt-BR')}</p>
                </div>
              </div>
              <Badge variant="outline">Parceiro(a)</Badge>
            </div>
          ) : (
            <div className="p-8 text-center border-2 border-dashed border-neutral-200 rounded-xl">
              <p className="text-neutral-500 mb-2">Aguardando parceiro(a)...</p>
              <p className="text-xs text-neutral-400">Compartilhe o código <span className="font-bold">{couple?.id}</span> para ele(a) entrar.</p>
            </div>
          )}

          <Separator />
          
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium text-neutral-500">Renda Conjunta Total</span>
            <span className="text-xl font-bold text-emerald-600">
              R$ {(profile.individualIncome + (partner?.individualIncome || 0)).toLocaleString('pt-BR')}
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
