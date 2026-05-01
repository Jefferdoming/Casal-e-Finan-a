import React, { useState, useEffect, useRef } from 'react';
import { Type, FunctionDeclaration } from "@google/genai";
import { MessageCircle, Send, X, Bot, User, Loader2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { motion, AnimatePresence } from 'motion/react';
import { 
  collection, 
  addDoc, 
  updateDoc, 
  doc, 
  deleteDoc 
} from 'firebase/firestore';
import { db } from '@/src/lib/firebase';
import { ai } from '../services/gemini';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { 
  Transaction, 
  Goal, 
  MonthlyBill, 
  Loan, 
  Investment, 
  WalletAccount, 
  UserProfile, 
  Couple 
} from '../types';

interface Message {
  role: 'user' | 'model';
  text: string;
  isCorrecting?: boolean;
}

interface GeminiChatbotProps {
  profile: UserProfile;
  couple: Couple;
  transactions: Transaction[];
  goals: Goal[];
  monthlyBills: MonthlyBill[];
  loans: Loan[];
  investments: Investment[];
  wallets: WalletAccount[];
}

export function GeminiChatbot({ 
  profile, 
  couple, 
  transactions, 
  goals, 
  monthlyBills, 
  loans, 
  investments, 
  wallets 
}: GeminiChatbotProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    { role: 'model', text: 'Olá! Sou seu mentor financeiro do Amor & Finanças. Como posso ajudar vocês hoje? Posso responder perguntas sobre seus gastos ou ajudar a corrigir informações.' }
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  // Function Declarations for corrections
  const updateTransactionFn: FunctionDeclaration = {
    name: "updateTransaction",
    description: "Atualiza o valor ou categoria de uma transação existente.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        id: { type: Type.STRING, description: "O ID da transação a ser atualizada." },
        amount: { type: Type.NUMBER, description: "O novo valor da transação." },
        category: { type: Type.STRING, description: "A nova categoria da transação." },
        description: { type: Type.STRING, description: "A nova descrição da transação." }
      },
      required: ["id"]
    }
  };

  const addTransactionFn: FunctionDeclaration = {
    name: "addTransaction",
    description: "Adiciona uma nova transação (entrada ou saída).",
    parameters: {
      type: Type.OBJECT,
      properties: {
        description: { type: Type.STRING, description: "Descrição do gasto/ganho." },
        amount: { type: Type.NUMBER, description: "Valor monetário." },
        type: { type: Type.STRING, enum: ["income", "expense"], description: "Tipo: income (entrada) ou expense (saída)." },
        category: { type: Type.STRING, description: "Categoria do gasto." },
        paymentMethod: { type: Type.STRING, enum: ["pix", "dinheiro", "cartao"], description: "Forma de pagamento." },
        dueDate: { type: Type.STRING, description: "Data no formato YYYY-MM-DD." }
      },
      required: ["description", "amount", "type", "category", "paymentMethod", "dueDate"]
    }
  };

  const updateWalletBalanceFn: FunctionDeclaration = {
    name: "updateWalletBalance",
    description: "Atualiza o saldo de uma conta bancária ou cofrinho.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        id: { type: Type.STRING, description: "O ID da carteira/conta." },
        balance: { type: Type.NUMBER, description: "O novo saldo da conta." }
      },
      required: ["id", "balance"]
    }
  };

  const deleteTransactionFn: FunctionDeclaration = {
    name: "deleteTransaction",
    description: "Remove uma transação do histórico.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        id: { type: Type.STRING, description: "O ID da transação a ser removida." }
      },
      required: ["id"]
    }
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = input;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMessage }]);
    setIsLoading(true);

    try {
      const context = `
        Dados Atuais do Casal (${couple.name}):
        
        Saldos:
        ${wallets.map(w => `- ${w.name} (${w.lender || 'Outros'}): R$ ${w.balance} [ID: ${w.id}] ${w.isPiggyBank ? '(COFRINHO)' : ''}`).join('\n')}
        
        Transações Recentes:
        ${transactions.slice(0, 15).map(t => `- ${t.dueDate}: ${t.description} (R$ ${t.amount}) [${t.type}] [ID: ${t.id}]`).join('\n')}
        
        Contas Mensais:
        ${monthlyBills.map(b => `- ${b.title} (Dia ${b.dueDateDay}): R$ ${b.amount} [ID: ${b.id}]`).join('\n')}
        
        Metas:
        ${goals.map(g => `- ${g.title}: R$ ${g.currentAmount}/R$ ${g.targetAmount} [ID: ${g.id}]`).join('\n')}
        
        Empréstimos:
        ${loans.map(l => `- ${l.title}: R$ ${l.remainingAmount} restante [ID: ${l.id}]`).join('\n')}
      `;

      const systemInstruction = `
        Você é o Mentor Financeiro do app "Amor & Finanças". Seu objetivo é ajudar o casal ${couple.name} a gerir sua vida financeira com amor e inteligência.
        
        Você tem acesso aos dados reais deles (listados abaixo). 
        Se eles pedirem para "corrigir" algo, use as funções disponíveis. 
        Sempre confirme com o usuário o que você vai fazer antes de chamar uma função se houver ambiguidade.
        
        Seja empático, encorajador e direto. Não dê respostas muito longas.
        Use os IDs fornecidos para operações de atualização.
        
        CONTEXTO ATUAL:
        ${context}
      `;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: messages.concat({ role: 'user', text: userMessage }).map(m => ({
          role: m.role,
          parts: [{ text: m.text }]
        })),
        config: {
          systemInstruction,
          tools: [{ functionDeclarations: [updateTransactionFn, addTransactionFn, updateWalletBalanceFn, deleteTransactionFn] }]
        }
      });

      const functionCalls = response.functionCalls;
      if (functionCalls && functionCalls.length > 0) {
        for (const call of functionCalls) {
          if (call.name === 'updateTransaction') {
            const { id, ...updates } = call.args as any;
            await updateDoc(doc(db, 'transactions', id), updates);
            setMessages(prev => [...prev, { role: 'model', text: `✅ Transação atualizada com sucesso: ${updates.description || ''} (R$ ${updates.amount || ''})` }]);
          } else if (call.name === 'addTransaction') {
            const data = call.args as any;
            await addDoc(collection(db, 'transactions'), {
              ...data,
              coupleId: couple.id,
              createdBy: profile.uid,
              createdAt: new Date().toISOString(),
              paid: true
            });
            setMessages(prev => [...prev, { role: 'model', text: `✅ Nova transação adicionada: ${data.description} (R$ ${data.amount})` }]);
          } else if (call.name === 'updateWalletBalance') {
            const { id, balance } = call.args as any;
            await updateDoc(doc(db, 'wallets', id), { balance });
            setMessages(prev => [...prev, { role: 'model', text: `✅ Saldo da conta atualizado para R$ ${balance}.` }]);
          } else if (call.name === 'deleteTransaction') {
            const { id } = call.args as any;
            await deleteDoc(doc(db, 'transactions', id));
            setMessages(prev => [...prev, { role: 'model', text: `✅ Transação removida com sucesso.` }]);
          }
        }
      } else {
        const textResponse = response.text || 'Desculpe, não consegui processar sua solicitação no momento.';
        setMessages(prev => [...prev, { role: 'model', text: textResponse }]);
      }

    } catch (error: any) {
      console.error('Gemini Error:', error);
      let errorMessage = 'Ops! Tive um problema ao me conectar. Tente novamente em instantes.';
      
      const isPlaceholder = process.env.GEMINI_API_KEY === 'MY_GEMINI_API_KEY' || !process.env.GEMINI_API_KEY;

      if (error?.message?.includes('API_KEY_INVALID') || isPlaceholder) {
        errorMessage = 'Erro de configuração: Chave da API inválida ou não configurada. Por favor, adicione sua GEMINI_API_KEY nas configurações.';
      } else if (error?.message?.includes('quota')) {
        errorMessage = 'Minha cota de processamento foi atingida por agora. Tente novamente mais tarde!';
      }

      setMessages(prev => [...prev, { role: 'model', text: errorMessage }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {/* Floating Toggle Button */}
      <Button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 w-14 h-14 rounded-full shadow-2xl z-50 p-0"
        size="icon"
      >
        {isOpen ? <X size={28} /> : <MessageCircle size={28} />}
        {!isOpen && (
           <span className="absolute -top-1 -right-1 flex h-4 w-4">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
            <span className="relative inline-flex rounded-full h-4 w-4 bg-primary border-2 border-white"></span>
          </span>
        )}
      </Button>

      {/* Chat Window */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 50, scale: 0.9 }}
            className="fixed bottom-24 right-6 w-[380px] h-[550px] z-50"
          >
            <Card className="h-full flex flex-col border-none shadow-2xl overflow-hidden ring-1 ring-neutral-200">
              <CardHeader className="bg-primary text-white p-4 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                    <Bot size={24} />
                  </div>
                  <div>
                    <CardTitle className="text-lg">Mentor Amor & Finanças</CardTitle>
                    <p className="text-xs text-white/70">Sempre online para ajudar</p>
                  </div>
                </div>
              </CardHeader>
              
              <CardContent 
                ref={scrollRef}
                className="flex-1 overflow-y-auto p-4 space-y-4 bg-neutral-50/50"
              >
                {messages.map((m, i) => (
                  <div 
                    key={i} 
                    className={cn(
                      "flex gap-2 max-w-[85%]",
                      m.role === 'user' ? "ml-auto flex-row-reverse" : "mr-auto"
                    )}
                  >
                    <div className={cn(
                      "w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-1",
                      m.role === 'user' ? "bg-primary/10 text-primary" : "bg-white border text-neutral-400"
                    )}>
                      {m.role === 'user' ? <User size={16} /> : <Bot size={16} />}
                    </div>
                    <div className={cn(
                      "p-3 rounded-2xl text-sm leading-relaxed",
                      m.role === 'user' 
                        ? "bg-primary text-white" 
                        : "bg-white border border-neutral-100 text-neutral-700 shadow-sm"
                    )}>
                      <div className="prose prose-sm prose-neutral max-w-none">
                        <ReactMarkdown>
                          {m.text}
                        </ReactMarkdown>
                      </div>
                    </div>
                  </div>
                ))}
                {isLoading && (
                  <div className="flex gap-2 mr-auto max-w-[85%] animate-pulse">
                     <div className="w-8 h-8 rounded-lg bg-white border flex items-center justify-center shrink-0 mt-1">
                      <Bot size={16} className="text-neutral-300" />
                    </div>
                    <div className="p-3 rounded-2xl bg-white border border-neutral-100 text-neutral-400 text-sm">
                      <Loader2 size={16} className="animate-spin" />
                    </div>
                  </div>
                )}
              </CardContent>

              <CardFooter className="p-4 bg-white border-t border-neutral-100 shrink-0">
                <form onSubmit={handleSendMessage} className="w-full flex gap-2">
                  <Input 
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    placeholder="Pergunte algo ou peça para corrigir..."
                    className="flex-1 rounded-xl bg-neutral-50 border-none h-11 focus:ring-1 focus:ring-primary/20"
                    disabled={isLoading}
                  />
                  <Button 
                    type="submit" 
                    size="icon" 
                    className="shrink-0 h-11 w-11 rounded-xl"
                    disabled={isLoading || !input.trim()}
                  >
                    <Send size={18} />
                  </Button>
                </form>
              </CardFooter>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
