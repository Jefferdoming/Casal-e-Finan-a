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
  ArrowDownRight
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
  TransactionType, 
  PaymentMethod,
  LearningStep,
  LearningProgress
} from './types';
import { generateLearningContent, generateFinancialAdvice } from './services/gemini';

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

const CATEGORIES = [
  'Alimentação', 'Moradia', 'Transporte', 'Lazer', 'Saúde', 'Educação', 'Investimentos', 'Outros'
];

const LEARNING_STEPS: LearningStep[] = [
  { id: '1', title: 'O Primeiro Passo: Transparência', category: 'curiosidade', content: 'curiosidade' },
  { id: '2', title: 'Criando um Orçamento Conjunto', category: 'disciplina', content: 'disciplina' },
  { id: '3', title: 'O Poder dos Juros Compostos', category: 'aprendizado', content: 'aprendizado' },
  { id: '4', title: 'Saindo do Vermelho: Estratégias', category: 'disciplina', content: 'disciplina' },
  { id: '5', title: 'Metas de Curto e Longo Prazo', category: 'aprendizado', content: 'aprendizado' },
];

// --- Main App Component ---

export default function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [couple, setCouple] = useState<Couple | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');

  // Data states
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [learningProgress, setLearningProgress] = useState<LearningProgress | null>(null);
  const [partnerProfile, setPartnerProfile] = useState<UserProfile | null>(null);

  // Auth Listener
  useEffect(() => {
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

      return () => {
        unsubTransactions();
        unsubGoals();
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
            icon={<Target size={20} />} 
            label="Metas" 
            active={activeTab === 'goals'} 
            onClick={() => setActiveTab('goals')} 
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
                partner={partnerProfile}
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
            {activeTab === 'calendar' && (
              <CalendarView 
                transactions={transactions} 
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
              />
            )}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}

// --- Sub-Views ---

function LoginView() {
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
          <Button 
            className="w-full h-12 text-lg font-semibold shadow-lg shadow-primary/20" 
            onClick={signInWithGoogle}
          >
            Entrar com Google
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

  const handleCreate = async () => {
    if (!coupleName) return;
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
  };

  const handleJoin = async () => {
    if (!inviteCode) return;
    const coupleRef = doc(db, 'couples', inviteCode);
    const coupleSnap = await getDoc(coupleRef);
    if (coupleSnap.exists()) {
      const coupleData = coupleSnap.data() as Couple;
      if (coupleData.members.length >= 2) {
        alert("Este casal já está completo!");
        return;
      }
      await updateDoc(coupleRef, {
        members: [...coupleData.members, profile.uid]
      });
      await updateDoc(doc(db, 'users', profile.uid), { coupleId: inviteCode });
      setProfile({ ...profile, coupleId: inviteCode });
    } else {
      alert("Código de convite inválido.");
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
                <Input placeholder="Ex: João & Maria" value={coupleName} onChange={e => setCoupleName(e.target.value)} />
              </div>
              <Button onClick={handleCreate} className="w-full">Criar</Button>
              <Button onClick={() => setMode('choice')} variant="ghost" className="w-full">Voltar</Button>
            </div>
          )}
          {mode === 'join' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Código de Convite</Label>
                <Input placeholder="Cole o código aqui" value={inviteCode} onChange={e => setInviteCode(e.target.value)} />
              </div>
              <Button onClick={handleJoin} className="w-full">Entrar</Button>
              <Button onClick={() => setMode('choice')} variant="ghost" className="w-full">Voltar</Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function DashboardView({ profile, couple, transactions, goals, partner }: { 
  profile: UserProfile, 
  couple: Couple, 
  transactions: Transaction[], 
  goals: Goal[],
  partner: UserProfile | null
}) {
  const [advice, setAdvice] = useState<string>('');
  const [isAdviceLoading, setIsAdviceLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());

  const monthTransactions = transactions.filter(t => isSameMonth(parseISO(t.dueDate), selectedDate));
  
  const totalIncome = monthTransactions.filter(t => t.type === 'income').reduce((acc, t) => acc + t.amount, 0);
  const totalExpenses = monthTransactions.filter(t => t.type === 'expense').reduce((acc, t) => acc + t.amount, 0);
  const balance = totalIncome - totalExpenses;

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
          title="Saldo do Mês" 
          value={balance} 
          icon={<Wallet className="text-blue-500" />} 
          trend={balance >= 0 ? 'up' : 'down'}
        />
        <StatCard 
          title="Entradas" 
          value={totalIncome} 
          icon={<TrendingUp className="text-emerald-500" />} 
        />
        <StatCard 
          title="Saídas" 
          value={totalExpenses} 
          icon={<TrendingDown className="text-rose-500" />} 
        />
        <StatCard 
          title="Renda Conjunta" 
          value={(profile.individualIncome || 0) + (partner?.individualIncome || 0)} 
          icon={<Users className="text-amber-500" />} 
          description="Renda individual + parceiro"
        />
      </div>

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
  );
}

function StatCard({ title, value, icon, trend, description }: { 
  title: string, 
  value: number, 
  icon: React.ReactNode, 
  trend?: 'up' | 'down',
  description?: string
}) {
  return (
    <Card className="border-none shadow-sm overflow-hidden relative">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardDescription className="text-neutral-500 font-medium">{title}</CardDescription>
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

function TransactionsView({ profile, couple, transactions, partner }: { profile: UserProfile, couple: Couple, transactions: Transaction[], partner: UserProfile | null }) {
  const [isAddOpen, setIsAddOpen] = useState(false);
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
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger render={<Button size="lg" className="shadow-lg shadow-primary/20" />}>
            <Plus className="mr-2" size={20} />
            Nova Transação
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <TransactionForm coupleId={couple?.id || ""} userId={profile.uid} onSuccess={() => setIsAddOpen(false)} />
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
                      <Button variant="ghost" size="icon" onClick={() => deleteDoc(doc(db, 'transactions', t.id))}>
                        <LogOut size={16} className="text-neutral-400 hover:text-red-500" />
                      </Button>
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

function TransactionForm({ coupleId, userId, onSuccess }: { coupleId: string, userId: string, onSuccess: () => void }) {
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [type, setType] = useState<TransactionType>('expense');
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('pix');
  const [cardName, setCardName] = useState('');
  const [dueDate, setDueDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [paid, setPaid] = useState(true);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description || !amount) return;

    const newTransaction: Omit<Transaction, 'id'> = {
      coupleId,
      description,
      amount: parseFloat(amount),
      type,
      category,
      paymentMethod,
      cardName: paymentMethod === 'cartao' ? cardName : undefined,
      dueDate,
      paid,
      createdAt: new Date().toISOString(),
      createdBy: userId,
    };

    await addDoc(collection(db, 'transactions'), newTransaction);
    onSuccess();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <DialogHeader>
        <DialogTitle>Nova Transação</DialogTitle>
        <DialogDescription>Adicione uma nova entrada ou saída para o casal.</DialogDescription>
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
        <Button type="submit" className="w-full">Salvar Transação</Button>
      </DialogFooter>
    </form>
  );
}

function GoalsView({ profile, couple, goals }: { profile: UserProfile, couple: Couple, goals: Goal[] }) {
  const [isAddOpen, setIsAddOpen] = useState(false);

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
                <span className="font-bold text-neutral-900">R$ {goal.currentAmount} / {goal.targetAmount}</span>
              </div>
              <Progress value={(goal.currentAmount / goal.targetAmount) * 100} className="h-3" />
            </CardContent>
            <CardFooter className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={async () => {
                const amount = prompt("Quanto deseja adicionar?");
                if (amount) {
                  const newAmount = goal.currentAmount + parseFloat(amount);
                  await updateDoc(doc(db, 'goals', goal.id), { currentAmount: newAmount });
                }
              }}>
                Adicionar
              </Button>
              <Button variant="ghost" size="icon" onClick={() => deleteDoc(doc(db, 'goals', goal.id))}>
                <LogOut size={16} className="text-neutral-400 hover:text-red-500" />
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
    </div>
  );
}

function GoalForm({ coupleId, onSuccess }: { coupleId: string, onSuccess: () => void }) {
  const [title, setTitle] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [currentAmount, setCurrentAmount] = useState('0');
  const [deadline, setDeadline] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !targetAmount || !deadline) return;

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
        <Button type="submit" className="w-full">Criar Meta</Button>
      </DialogFooter>
    </form>
  );
}

function CalendarView({ transactions }: { transactions: Transaction[] }) {
  const [date, setDate] = useState<Date | undefined>(new Date());

  const monthTransactions = useMemo(() => {
    if (!date) return [];
    return transactions.filter(t => isSameMonth(parseISO(t.dueDate), date));
  }, [transactions, date]);

  const selectedDayTransactions = useMemo(() => {
    if (!date) return [];
    return transactions.filter(t => {
      const tDate = parseISO(t.dueDate);
      return format(tDate, 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd');
    });
  }, [transactions, date]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-neutral-900">Calendário Financeiro</h2>
        <p className="text-neutral-500">Acompanhe seus vencimentos e recebimentos.</p>
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
              hasTransaction: (d) => transactions.some(t => format(parseISO(t.dueDate), 'yyyy-MM-dd') === format(d, 'yyyy-MM-dd'))
            }}
            modifiersStyles={{
              hasTransaction: { fontWeight: 'bold', textDecoration: 'underline', color: 'hsl(var(--primary))' }
            }}
          />
        </Card>

        <div className="space-y-6">
          <Card className="border-none shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">
                {date ? format(date, "dd 'de' MMMM", { locale: ptBR }) : 'Selecione um dia'}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {selectedDayTransactions.length > 0 ? (
                selectedDayTransactions.map(t => (
                  <div key={t.id} className="flex items-center justify-between p-3 bg-neutral-50 rounded-xl">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "w-2 h-2 rounded-full",
                        t.type === 'income' ? "bg-emerald-500" : "bg-rose-500"
                      )} />
                      <span className="text-sm font-medium text-neutral-700">{t.description}</span>
                    </div>
                    <span className={cn(
                      "text-sm font-bold",
                      t.type === 'income' ? "text-emerald-600" : "text-rose-600"
                    )}>
                      R$ {t.amount}
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-sm text-neutral-400 text-center py-8">Nenhuma conta para este dia.</p>
              )}
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm bg-neutral-900 text-white">
            <CardHeader>
              <CardTitle className="text-lg">Resumo do Mês</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between">
                <span className="text-neutral-400">Total Entradas</span>
                <span className="text-emerald-400 font-bold">R$ {monthTransactions.filter(t => t.type === 'income').reduce((acc, t) => acc + t.amount, 0)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-400">Total Saídas</span>
                <span className="text-rose-400 font-bold">R$ {monthTransactions.filter(t => t.type === 'expense').reduce((acc, t) => acc + t.amount, 0)}</span>
              </div>
              <Separator className="bg-neutral-800" />
              <div className="flex justify-between text-lg">
                <span className="font-bold">Saldo</span>
                <span className="font-bold">R$ {monthTransactions.filter(t => t.type === 'income').reduce((acc, t) => acc + t.amount, 0) - monthTransactions.filter(t => t.type === 'expense').reduce((acc, t) => acc + t.amount, 0)}</span>
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

function ProfileView({ profile, partner, couple }: { profile: UserProfile, partner: UserProfile | null, couple: Couple }) {
  const [income, setIncome] = useState(profile.individualIncome.toString());
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    await updateDoc(doc(db, 'users', profile.uid), {
      individualIncome: parseFloat(income) || 0
    });
    setIsSaving(false);
    alert("Perfil atualizado!");
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

          <Button onClick={handleSave} disabled={isSaving} className="w-full">
            {isSaving ? "Salvando..." : "Salvar Alterações"}
          </Button>
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
