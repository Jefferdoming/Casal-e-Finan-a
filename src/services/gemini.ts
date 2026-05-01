import { GoogleGenAI } from "@google/genai";

const apiKey = (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY') ? process.env.GEMINI_API_KEY : "";
if (!apiKey) {
  console.warn("GEMINI_API_KEY is missing or using placeholder. AI features will fallback to local suggestions.");
} else {
  console.log("GEMINI_API_KEY detected (length: " + apiKey.length + ")");
}
let aiInstance: any = null;

const getAi = () => {
  if (!aiInstance && apiKey) {
    aiInstance = new GoogleGenAI({ apiKey });
  }
  return aiInstance;
};

export const ai = {
  models: {
    generateContent: async (args: any) => {
      const client = getAi();
      if (!client) throw new Error("API Key logic: Missing key");
      return client.models.generateContent(args);
    }
  }
};

const mockLearningContent: Record<string, string> = {
  "Consciência Financeira: Registro Diário": "### Registrando o Diário Financeiro\n\nA clareza é o primeiro passo para a liberdade do casal. Quando vocês registram cada café, cada mercado ou despesa de transporte diariamente, vocês param de 'perder dinheiro' sem saber para onde ele foi.\n\n**Na prática:** Utilize o botão (+) na aba **Transações** toda vez que houver um gasto. Ao final da semana, revejam juntos. Essa rotina gera a consciência necessária para decidir o que faz sentido cortar e o que é prioridade.",
  "A Importância do Orçamento no Amor e Finanças": "### O Orçamento do Casal é um Compromisso\n\nOrçamento não é restrição, é direcionamento! É combinar para onde o dinheiro deve ir para que os sonhos do casal se realizem. É a ferramenta mais poderosa para alinhar expectativas.\n\n**Na prática:** Acessem a aba **Gastos**. Definam juntos um valor limite para categorias como 'Mercado', 'Lazer' e 'Transporte'. Quando o orçamento é feito em conjunto, o estresse diminui drasticamente.",
  "O Cofrinho: Sua Reserva de Emergência": "### A Paz Espiritual do Casal: Reserva de Emergência\n\nImprevistos acontecem, mas para o casal financeiramente organizado, eles não viram catástrofes. Ter uma reserva de emergência é cuidar da saúde mental um do outro.\n\n**Na prática:** O objetivo é ter entre 3 a 6 meses do custo de vida mensal de vocês. Comecem criando uma meta na aba **Metas** chamada 'Reserva de Emergência' e façam aportes constantes na aba **Investimentos**.",
  "Eliminando Dívidas: A Aba de Empréstimos": "### A Liberdade Financeira Começa com Dívida Zero\n\nJuros altos são os inimigos número um do amor financeiro. Eliminar dívidas é devolver ao orçamento do casal recursos que hoje evaporam em pagamentos de juros.\n\n**Na prática:** Listem todas as dívidas na aba **Empréstimos**. Foquem em quitar primeiro aquelas com os juros mais altos (cartão de crédito, cheque especial). Façam um plano de pagamento realista e mantenham a regularidade.",
  "Investindo no Futuro: Aportes e Parcelas": "### Construindo o Amanhã, Juntos\n\nInvestir não é só para quem tem muito dinheiro; é para quem tem grandes sonhos. Ao investir juntos, vocês consolidam um futuro onde o dinheiro trabalha para o casal.\n\n**Na prática:** Com a base do orçamento organizada, definam uma porcentagem do ganho mensal para investir. Usem a aba **Investimentos** para monitorar o crescimento dos seus ativos. A consistência nos aportes vence a tentativa de encontrar o 'investimento mágico'.",
  "Metas SMART: Transformando Sonhos em Dados": "### Do Sonho ao Ação: Metas SMART\n\n'Quero economizar' é um desejo. 'Quero economizar R$ 5.000 para a viagem de férias em 10 meses' é uma Meta SMART (Específica, Mensurável, Atingível, Relevante, Temporal).\n\n**Na prática:** Todo sonho do casal deve virar um registro na aba **Metas**. Definam o objetivo, o valor total e o prazo. O app ajudará vocês a entenderem quanto precisam economizar por mês para concretizar.",
  "Leitura de Gráficos: Onde o Dinheiro vaza?": "### Decifrando os Dados: Identificando os Vazamentos\n\nO Dashboard não serve apenas para bonito, ele é o termômetro da saúde financeira de vocês. Quando vocês visualizam onde o dinheiro está sendo gasto, vocês percebem padrões que antes eram invisíveis.\n\n**Na prática:** Analisem semanalmente os gráficos no **Dashboard**. Se a categoria 'Lazer' ou 'Comida fora' estiver ultrapassando o planejado com frequência, usem isso como base para uma conversa honesta e ajuste do orçamento na aba **Gastos**.",
  "Hábitos do Casal: Consistência é Tudo": "### A Disciplina que Une o Casal\n\nNão é um mês de sacrifício que muda o futuro, é a consistência de hábitos saudáveis ao longo de anos. A disciplina financeira é uma forma de demonstrar respeito pelos objetivos compartilhados.\n\n**Na prática:** Definam um horário fixo na semana, como a 'Noite das Finanças', para abrir o app juntos, registrar o que faltou, checar se as metas estão em dia e revisar o próximo mês. Isso cria cumplicidade.",
  "A Magia dos Juros Compostos nos Seus Ativos": "### O Juro Composto: O Oitavo Milagre do Mundo\n\nO juro composto é o efeito 'bola de neve' a favor do casal. Quanto mais cedo vocês começam a investir, maior o tempo que o dinheiro tem para se multiplicar.\n\n**Na prática:** Registrem seus ativos na aba **Investimentos**. Vejam a mágica acontecer ao longo do tempo. O segredo é reinvestir os rendimentos, permitindo que eles gerem ainda mais rendimentos.",
  "Independência a Dois: O Plano de Longo Prazo": "### Rumo à Independência Financeira\n\nE se o casal pudesse escolher trabalhar por amor e não por obrigação? A independência financeira é o plano de longo prazo que dá tranquilidade para as decisões de médio prazo.\n\n**Na prática:** Usem todas as ferramentas do app de forma integrada. Comecem com o registro (Transações), controlem (Gastos), eliminem entraves (Empréstimos), e invistam o excedente (Meta/Investimentos). O app é o guia para essa jornada."
};

const defaultLearningContent = "Planejar o futuro financeiro a dois é uma jornada incrível de aprendizado. Explore as ferramentas que preparamos no 'Amor & Finanças' para organizar sua vida financeira e crescer juntos!";

const mockAdviceResponses = [
  "Vocês estão no caminho certo! Continuem registrando os gastos para manter a sintonia financeira.",
  "Que tal revisar as metas na aba 'Metas'? Pequenos ajustes de economia podem acelerar seus sonhos!",
  "A consistência é chave para construir um futuro próspero. Mantenha os registros em dia!",
  "Dinheiro não precisa ser motivo de estresse. Usem o app para conversar abertamente sobre seus objetivos."
];

export async function generateLearningContent(topic: string) {
  try {
    if (!apiKey) {
       return mockLearningContent[topic] || defaultLearningContent;
    }
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Você é um mentor financeiro para casais no aplicativo "Amor & Finanças". 
      Gere um texto educativo, curto e motivador sobre o tema: "${topic}". 
      
      IMPORTANTE:
      1. Explique a teoria por trás do tema.
      2. Conecte essa teoria com a prática específica dentro do nosso site "Amor & Finanças" (ex: "use a aba Metas para...", "registre suas parcelas em Investimentos para...").
      3. O foco deve ser em casais que querem construir intimidade com o app e fidelizar o uso com propósito.
      4. Use uma linguagem que desperte curiosidade, disciplina e aprendizado. 
      5. Formate em Markdown bem estruturado.`,
      config: {
        temperature: 0.7,
      }
    });
    
    return response.text || "Não foi possível gerar o conteúdo no momento.";
  } catch (error) {
    console.error("Error generating learning content:", error);
    return defaultLearningContent;
  }
}

export async function generateFinancialAdvice(transactions: any[], goals: any[]) {
  try {
    if (!apiKey) {
       return mockAdviceResponses[Math.floor(Math.random() * mockAdviceResponses.length)];
    }
    // Ensure data is valid
    if (!Array.isArray(transactions) || !Array.isArray(goals)) {
       return "Comece a registrar seus gastos para eu te ajudar!";
    }
    
    const summary = transactions.map(t => `${t.type}: ${t.description} (R$ ${t.amount || 0})`).join(', ');
    const goalsSummary = goals.map(g => `${g.title}: ${g.currentAmount || 0}/${g.targetAmount || 0}`).join(', ');

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Com base nessas transações: [${summary || 'Nenhuma transação este mês'}] e metas: [${goalsSummary || 'Nenhuma meta ativa'}], dê um conselho financeiro rápido (máximo 2 frases) para este casal melhorar sua saúde financeira. Seja carinhoso e direto.`,
      config: {
        temperature: 0.7,
      }
    });
    
    return response.text || "Mantenha o foco nas suas metas!";
  } catch (error) {
    console.error("Error generating financial advice:", error);
    return mockAdviceResponses[Math.floor(Math.random() * mockAdviceResponses.length)];
  }
}
