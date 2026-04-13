import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

export async function generateLearningContent(topic: string) {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Você é um mentor financeiro para casais. Gere um texto educativo, curto e motivador sobre o tema: "${topic}". 
      O foco deve ser em casais que querem sair do vermelho e construir um futuro juntos. 
      Use uma linguagem que desperte curiosidade, disciplina e aprendizado. 
      Formate em Markdown.`,
      config: {
        temperature: 0.7,
      }
    });
    return response.text || "Não foi possível gerar o conteúdo no momento.";
  } catch (error) {
    console.error("Error generating learning content:", error);
    return "Erro ao conectar com o mentor financeiro.";
  }
}

export async function generateFinancialAdvice(transactions: any[], goals: any[]) {
  try {
    const summary = transactions.map(t => `${t.type}: ${t.description} (R$ ${t.amount})`).join(', ');
    const goalsSummary = goals.map(g => `${g.title}: ${g.currentAmount}/${g.targetAmount}`).join(', ');

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Com base nessas transações: [${summary}] e metas: [${goalsSummary}], dê um conselho financeiro rápido (máximo 3 frases) para este casal melhorar sua saúde financeira.`,
      config: {
        temperature: 0.7,
      }
    });
    return response.text || "Continue acompanhando seus gastos!";
  } catch (error) {
    console.error("Error generating financial advice:", error);
    return "Mantenha o foco nas suas metas!";
  }
}
