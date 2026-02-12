import React, { useState } from 'react';
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/lib/supabase";
import { Button, Input, Card } from "@/components/ui-kit";
import { useToast } from "@/hooks/use-toast";
import { Layout } from "@/components/layout";
import { 
  User, 
  Mail, 
  Lock, 
  ShieldCheck, 
  Eye, 
  EyeOff, 
  Loader2 
} from 'lucide-react';

export default function ProfilePage() {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [isLoading, setIsLoading] = useState(false);
  const [showPasswords, setShowPasswords] = useState({ old: false, new: false, confirm: false });
  
  const [passwords, setPasswords] = useState({
    old: '',
    new: '',
    confirm: ''
  });

  const handlePasswordChange = async (e: React.FormEvent) => {
  e.preventDefault();
  setIsLoading(true);

  // 1. Validazioni Client
  if (passwords.new !== passwords.confirm) {
    setIsLoading(false);
    return toast({ title: "Errore", description: "Le nuove password non corrispondono", variant: "destructive" });
  }

  try {
    // 2. VERIFICA PASSWORD ATTUALE
    // Proviamo a fare un login silenzioso con l'email dell'utente e la vecchia password
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: user?.email || '',
      password: passwords.old,
    });

    if (signInError) {
      // Se il login fallisce, la vecchia password è sbagliata
      throw new Error("vecchia_password_errata");
    }

    // 3. AGGIORNAMENTO PASSWORD (ora siamo sicuri dell'identità)
    const { error: updateError } = await supabase.auth.updateUser({ 
      password: passwords.new 
    });

    if (updateError) throw updateError;

    toast({ 
      title: "Successo", 
      description: "Password aggiornata correttamente",
    });
    
    setPasswords({ old: '', new: '', confirm: '' });

  } catch (err: any) {
    // 4. SWITCH MESSAGGI IN ITALIANO
    let messaggioInItaliano = "Si è verificato un errore imprevisto.";
    
    // Gestiamo sia i codici di errore di Supabase che il nostro errore custom
    const errorMsg = err.message;

    switch (true) {
      case errorMsg === "vecchia_password_errata":
      case errorMsg.includes("Invalid login credentials"):
        messaggioInItaliano = "La password attuale non è corretta.";
        break;
      case errorMsg.includes("Password should be at least 6 characters"):
        messaggioInItaliano = "La nuova password deve contenere almeno 6 caratteri.";
        break;
      case errorMsg.includes("New password should be different from the old password."):
        messaggioInItaliano = "La nuova password deve essere diversa da quella attuale.";
        break;
      case errorMsg.includes("too many requests"):
        messaggioInItaliano = "Troppi tentativi falliti. Riprova tra qualche minuto.";
        break;
      default:
        messaggioInItaliano = errorMsg || messaggioInItaliano;
    }

    toast({ 
      title: "Errore", 
      description: messaggioInItaliano, 
      variant: "destructive" 
    });
  } finally {
    setIsLoading(false);
  }
};

  return (
    <Layout>
    <Card>
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-2 mb-2">
        <h1 className="text-3xl font-bold text-[#431407]">Profilo</h1>
      </div>

      <Card className="p-6 bg-white border-[#fed7aa] rounded-3xl shadow-sm">
        <div className="flex items-center gap-6">
          <div className="w-20 h-20 bg-orange-100 rounded-2xl flex items-center justify-center text-orange-600 shrink-0 shadow-inner">
            <User size={40} />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-2xl font-bold text-gray-900 break-words">{user?.username}</h2>
            <div className="flex flex-col items-start gap-2 mt-1">
              <span className="px-2 py-0.5 bg-orange-50 text-orange-600 text-xs font-bold rounded-full uppercase tracking-wider border border-orange-100 mb-1">
                {user?.role}
              </span>
              <span className="text-gray-500 text-sm flex gap-1 break-all">
                <Mail size={14} className="shrink-0 mt-1"/> {user?.email}
              </span>
            </div>
          </div>
        </div>
      </Card>

        {/* CAMBIO PASSWORD */}
        <Card className="p-8 bg-white border-[#fed7aa] rounded-3xl shadow-sm">
        <div className="flex items-center justify-between mb-8">
          <h3 className="text-xl font-bold text-[#431407] flex items-center gap-2">
            <Lock size={20} className="text-orange-500" />
            Sicurezza Account
          </h3>
          <ShieldCheck size={20} className="text-green-500" />
        </div>

        <form onSubmit={handlePasswordChange} className="space-y-6">
          <div className="space-y-5">
            {/* Password Vecchia */}
            <div>
              <label className="text-sm font-semibold text-gray-700 ml-1">Password Attuale</label>
              <div className="relative mt-1.5">
                <Input 
                  type={showPasswords.old ? "text" : "password"}
                  value={passwords.old}
                  onChange={e => setPasswords({...passwords, old: e.target.value})}
                  placeholder="La tua password attuale"
                />
                <button 
                  type="button" 
                  onClick={() => setShowPasswords({...showPasswords, old: !showPasswords.old})} 
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-orange-500"
                >
                  {showPasswords.old ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>

            <hr className="border-gray-100 my-2" />

            {/* Nuova Password */}
            <div>
              <label className="text-sm font-semibold text-gray-700 ml-1">Nuova Password</label>
              <div className="relative mt-1.5">
                <Input 
                  type={showPasswords.new ? "text" : "password"}
                  value={passwords.new}
                  onChange={e => setPasswords({...passwords, new: e.target.value})}
                  placeholder="Minimo 6 caratteri"
                />
                <button 
                  type="button" 
                  onClick={() => setShowPasswords({...showPasswords, new: !showPasswords.new})} 
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-orange-500"
                >
                  {showPasswords.new ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>

            {/* Conferma Password */}
            <div>
              <label className="text-sm font-semibold text-gray-700 ml-1">Conferma Nuova Password</label>
              <div className="relative mt-1.5">
                <Input 
                  type={showPasswords.confirm ? "text" : "password"}
                  value={passwords.confirm}
                  onChange={e => setPasswords({...passwords, confirm: e.target.value})}
                  placeholder="Ripeti la nuova password"
                />
                <button 
                  type="button" 
                  onClick={() => setShowPasswords({...showPasswords, confirm: !showPasswords.confirm})} 
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-orange-500"
                >
                  {showPasswords.confirm ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>
          </div>

          <Button 
            type="submit" 
            disabled={isLoading || !passwords.new}
            className="bg-[#f97316] hover:bg-[#ea580c] text-white w-full py-6 rounded-xl font-bold text-lg shadow-lg shadow-orange-100 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
          >
            {isLoading ? <Loader2 className="animate-spin" /> : <ShieldCheck size={20} />}
            {isLoading ? 'Aggiornamento...' : 'Aggiorna Password'}
          </Button>
        </form>
      </Card>

      <div className="text-center">
        <p className="text-xs text-gray-400 uppercase tracking-widest font-bold">ControlClose Secure ID</p>
      </div>
    </div>
    </Card>
    </Layout>
  );
}