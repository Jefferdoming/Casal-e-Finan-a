import { MonthlyBill } from '../types';

export class NotificationService {
  static async requestPermission(): Promise<boolean> {
    if (!('Notification' in window)) {
      console.warn('Este navegador não suporta notificações desktop');
      return false;
    }

    if (Notification.permission === 'granted') {
      return true;
    }

    if (Notification.permission !== 'denied') {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    }

    return false;
  }

  static async sendNotification(title: string, options?: NotificationOptions) {
    if (Notification.permission === 'granted') {
      return new Notification(title, {
        icon: '/icon.svg',
        ...options,
      });
    }
  }

  static checkUpcomingBills(bills: MonthlyBill[]) {
    const today = new Date();
    const currentDay = today.getDate();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();

    bills.forEach(bill => {
      // Se a conta não estiver paga
      if (!bill.paid) {
        const daysToDue = bill.dueDateDay - currentDay;

        // Notificar se vence hoje ou amanhã
        if (daysToDue === 0) {
          this.sendNotification('Conta Vence Hoje! 🚨', {
            body: `A conta "${bill.title}" de R$ ${bill.amount} vence hoje. Não esqueça de pagar!`,
            tag: `bill-today-${bill.id}`,
          });
        } else if (daysToDue === 1) {
          this.sendNotification('Conta Vence Amanhã 📅', {
            body: `Lembrete: A conta "${bill.title}" de R$ ${bill.amount} vence amanhã.`,
            tag: `bill-tomorrow-${bill.id}`,
          });
        }
      }
    });
  }
}
