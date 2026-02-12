import { useState, useCallback } from "react";
import emailjs from "@emailjs/browser";
import { useToast } from "@/hooks/use-toast";

const emailTemplates = (
  storeName:string,
  data: any,
  theoretical:number,
  status:string
) => {
  return (` <!DOCTYPE html>
     <html>
     <head>
        <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 0; background-color: #f4f4f4; }
            .container { max-width: 600px; margin: 20px auto; background: #ffffff; border-top: 8px solid #FF8C00; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 10px rgba(0,0,0,0.1); }
            .header { padding: 20px; text-align: center; background-color: #ffffff; }
            .content { padding: 30px; color: #333333; }
        
            /* Badge dinamici per lo stato */
            .status-label {
                padding: 6px 12px;
                border-radius: 20px;
                font-weight: bold;
                font-size: 14px;
                text-transform: uppercase;
            }
            .status-green { background-color: #d4edda; color: #155724; }
            .status-yellow { background-color: #fff3cd; color: #856404; }
            .status-red { background-color: #f8d7da; color: #721c24; }

            .data-table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            .data-table td { padding: 12px 8px; border-bottom: 1px solid #eee; }
            .label { font-weight: bold; color: #666; width: 40%; }
            .value { text-align: right; font-weight: 500; }
        
            .footer { background: #f9f9f9; padding: 15px; text-align: center; font-size: 12px; color: #999; }
            .orange-text { color: #FF8C00; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h2 style="margin:0;">Notifica chiusura di cassa per <br/><span class="orange-text">${storeName}</span></h2>
            </div>
        
            <div class="content">
                <p>La chiusura è stata salvata correttamente.<br/>Ecco un breve riepilogo: </p>
            
                <div style="text-align: center; margin-bottom: 25px;">
                    <span class="status-label ${status === 'ok' ? 'status-green': status === 'ko'? 'status-red' : 'status-yellow'}">Stato: ${status == 'ok' ? 'Bilanciato': status == 'ko'? 'Errore' : 'Attenzione'}</span>
                </div>

                <table class="data-table">
                    <tr>
                        <td class="label">Data:</td>
                        <td class="value">${data.date}</td>
                    </tr>
                    <tr>
                        <td class="label">Compilato da:</td>
                        <td class="value">${data.compilerName}</td>
                    </tr>
                    <tr>
                        <td class="label">Totale Vendite:</td>
                        <td class="value">€ ${data.totalSalesAmount}</td>
                    </tr>
                    <tr>
                        <td class="label">Fondo Cassa Attuale:</td>
                        <td class="value">€ ${data.actualCashFund || 0}</td>
                    </tr>
                    ${status !== 'ok' ? `
                        <tr>
                            <td class="label">Fondo Cassa Teorico:</td>
                            <td class="value" style="color: #d9534f;">€ ${theoretical || 0}</td>
                        </tr>
                    ` : ''}
                    <tr>
                        <td class="label">Prelievo per versamento in Banca:</td>
                        <td class="value">€ ${data.bankWithdrawalAmount || 0}</td>
                    </tr>
                </table>

                <h3 style="margin-top: 25px; border-bottom: 2px solid #FF8C00; padding-bottom: 5px;">Dettaglio Spese</h3>
                <table class="data-table">
                    ${data.expenses.map((e:any) => `
                    <tr>
                        <td class="label">${e.description}</td>
                        <td class="value">€ ${e.amount}</td>
                    </tr>
                    `).join('')  || '<p style="font-style: italic; margin-top: 5px;">Nessuna spesa segnalata</p>' }
                </table>

                <div style="margin-top: 20px; padding: 15px; background: #fffaf0; border-left: 4px solid #FF8C00;">
                    <strong>Note:</strong><br>
                    <p style="font-style: italic; margin-top: 5px;">${data.notes || 'Nessuna nota inserita'}</p>
                </div>
            </div>

            <div class="footer">
                * Notifica Generata Automaticamente *
            </div>
        </div>
    </body>
</html>`)
};

// React hook
type SendMailFunction = (
    email_negozio: string,
    storeName:string,
    data: any[],
    theoretical:number,
    status:string
) => Promise<void>;

export const useSendInvite = () => {
    const [sent, setSent] = useState(false);
    const {toast} = useToast();

    // Funzione per inviare la mail
    const sendMail: SendMailFunction = useCallback(async (
       email_negozio: string,
       storeName:string,
       data: any,
       theoretical:number,
       status: string
      ) => {
        setSent(false);
        try {
          // Genera il messaggio 
          const message = emailTemplates(
            storeName,
            data,
            theoretical,
            status
          );
          
          const subject = `Nuova Chiusura - ${storeName}`;

          if (!message.trim()) {
            toast({title:'Errore', description: "Impossibile inviare: tipo di invito non è valido." , variant:'destructive'});
            return;
          }

          // INVIO EMAIL con EmailJS
          await emailjs.send(
            import.meta.env.VITE_EMAILJS_SERVICE,
            import.meta.env.VITE_EMAILJS_TEMPLATE,
            {
              subject : subject,
              email_invitato: email_negozio,
              email_mittente: 'alessiagiannalia28@gmail.com',
              message: message.trim()
            },
            import.meta.env.VITE_EMAILJS_PUBLIC_KEY
          );
        
          setSent(true);
          toast({title:'Dati salvati e notifica inviata.', description:'', variant:'default'})
        } catch (err: any) {
            console.error("Errore durante l'invio :", err);
            setSent(false);
            toast({title:'Errore', description:"Si è verificato un errore durante l'invio. Controlla la connessione a internet e riprova.", variant: 'destructive'});
        }
    }, []);
    
    return { sendMail, sent };
};