import { Button } from "@/components/ui/button"; 
import { Card } from "@/components/ui/card";
import { CheckCircle2, ArrowRight } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

export default function EmailConfirmed() {
    const { logout } = useAuth();

    return (
    <div className="min-h-screen bg-[#fffaf7] flex items-center justify-center p-4">
      <Card className="max-w-md w-full p-8 text-center shadow-xl border-[#fed7aa] rounded-3xl bg-white">
        {/* Icona Successo Animata */}
        <div className="flex justify-center mb-6">
          <div className="bg-orange-100 p-4 rounded-full">
            <CheckCircle2 className="w-16 h-16 text-orange-500" />
          </div>
        </div>

        {/* Testo di Benvenuto */}
        <h1 className="text-3xl font-bold text-[#431407] mb-2">
          Email Confermata!
        </h1>
        <p className="text-[#7c2d12] mb-8">
          Il tuo account è ora attivo. Puoi accedere alla piattaforma utilizzando la tua email e la password temporanea che hai ricevuto.
        </p>

        {/* Pulsante per il Login */}
        <Button 
          onClick={() => { localStorage.removeItem("email_just_confirmed"); logout()}}
          className="w-full bg-[#f97316] hover:bg-[#ea580c] text-white py-6 text-lg font-bold rounded-xl transition-all group"
        >
          Vai al Login
          <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
        </Button>

        <p className="mt-6 text-sm text-orange-400 italic">
          ControlClose &copy; 2026 - Sistema Gestionale Interno
        </p>
      </Card>
    </div>
  );
}