import { useAuth } from "@/hooks/use-auth";
import { Button, Input } from "@/components/ui-kit";
import { useState } from "react";
import { AlertCircle } from "lucide-react";
import { LogIn, Mail, Lock, KeyRound, CheckCircle2, EyeOff, Eye } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Spinner } from "@/components/modals";

interface LoginProps {
  onLogin: () => void;
}

type ResetStep = 'request' | 'verify' | 'success';

export default function LoginPage({ onLogin }: LoginProps) {
  // Stati Login
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Stati Reset Password
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [resetStep, setResetStep] = useState<ResetStep>('request');
  const [resetEmail, setResetEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const { login, isLoggingIn, loginError } = useAuth();

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    login({ email, password });
  };

  // codice OTP per recupero password
  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(resetEmail);
      if (resetError) throw resetError;
      setResetStep('verify');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore nell\'invio del codice');
    } finally {
      setIsLoading(false);
    }
  };

  // Verifica il codice e aggiorna la password
  const handleVerifyAndReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    
    try {
      if (newPassword !== confirmPassword) {
        setError("Le password non corrispondono");
        setIsLoading(false);
        return;
      }

      if (newPassword.length < 6) {
        setError("La password deve avere almeno 6 caratteri");
        setIsLoading(false);
        return;
      }

      const { error: verifyError } = await supabase.auth.verifyOtp({
        email: resetEmail,
        token: otpCode,
        type: 'recovery',
      });

      if (verifyError) throw verifyError;

      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) {
        await supabase.auth.signOut(); 
        throw updateError;
      }

      setResetStep('success');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Errore sconosciuto';
  
      if (errorMessage === 'Token has expired or is invalid') {
        setError('Il codice inserito è errato o non è valido. Riprova.');
      } else if (errorMessage.includes('New password should be different from the old password')) {
        setError('La nuova password non può essere uguale a quella attuale.');
      } else {
        setError(errorMessage);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendAndRestart = async () => {
    setIsLoading(true);
    setError(null);
    setOtpCode('');
  
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(resetEmail);
      if (resetError) throw resetError;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore nel re-invio');
    } finally {
      setIsLoading(false);
    }
  };

  if (showResetPassword) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FFF8F0] p-4 relative overflow-hidden">
        <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
          <div className="text-center mb-2">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 text-primary mb-4 shadow-inner">
              <KeyRound className="w-8 h-8" />
            </div>
            <h1 className="text-3xl font-display font-bold text-gray-900">Recupero Password</h1>
          </div>

          {resetStep === 'request' && (
            <form onSubmit={handleRequestOtp} className="space-y-6">
              <p className="text-muted-foreground mt-0 mb-10 text-[15px]">Inserisci la tua mail per ricevere il codice di sicurezza.</p>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
                  <Input
                    id='email'
                    type="email"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    className="w-full pl-11 pr-4 py-3 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="tuo@email.com"
                    required
                  />
                </div>
              </div>
              <Button 
                type="submit" 
                size="lg" 
                disabled={isLoading}
                className="w-full font-medium flex items-center justify-center gap-2"
              >
                {isLoading ? 'Invio in corso...' : 'Invia Codice'}
              </Button>
            </form>
          )}

          {resetStep === 'verify' && (
            <form onSubmit={handleVerifyAndReset} className="space-y-4">
              <p className="text-neutral-600 text-center mb-4">Codice inviato a <b>{resetEmail}</b></p>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Codice OTP</label>
                <Input
                  type="text"
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value)}
                  className="w-full px-4 py-3 border border-neutral-300 rounded-lg text-center text-xl tracking-widest font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="123456"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Nuova Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
                  <Input
                    type={showPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full pl-11 pr-11 py-3 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="••••••••"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1 mt-2">Conferma Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
                    <Input
                      type={showConfirmPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full pl-11 pr-11 py-3 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                      placeholder="••••••••"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
                    >
                      {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>
              </div> 

              {(error || loginError) && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4 flex items-start gap-3">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                    <p className="text-red-800 text-sm">{(error || loginError)}</p>
                  </div>

                  { error?.includes('Il codice inserito è errato o non è valido. Riprova.') && (
                    <div>
                      <p className="text-red-800 text-sm">Il codice OTP non è più valido.</p>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleResendAndRestart}
                        disabled={isLoading}
                        className="text-xs w-fit"
                      >
                        {isLoading ? 'Invio in corso...' : 'Invia un nuovo codice'}
                      </Button>
                    </div>
                  )}
                </div>
              )}

              <Button 
                type="submit" 
                size="lg" 
                disabled={isLoading}
                className="w-full font-medium flex items-center justify-center gap-2"
              >
                {isLoading ? 'Verifica e Aggiorna...' : 'Aggiorna Password'}
              </Button>
            </form>
          )}

          {resetStep === 'success' && (
            <div className="text-center space-y-4">
              <CheckCircle2 className="w-12 h-12 text-orange-500 mx-auto" />
              <p className="text-neutral-800 font-medium">Password aggiornata con successo!</p>
              <Button 
                type="submit" 
                size="lg" 
                onClick={() => { setShowResetPassword(false); setResetStep('request')}}
                className="w-full font-medium flex items-center justify-center gap-2"
              >
                Vai al Login
              </Button>
            </div>
          )}

          {resetStep !== 'success' && (
            <button onClick={() => { setShowResetPassword(false); setResetStep('request');setError(null); setResetEmail(''); setOtpCode(''); setNewPassword(''); setConfirmPassword('')}} className="w-full mt-4 text-neutral-500 hover:text-neutral-800 text-sm">
              Annulla e torna al login
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#FFF8F0] p-4 relative overflow-hidden">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 text-primary mb-4 shadow-inner">
            <LogIn className="w-8 h-8" />
          </div>
          <h1 className="text-3xl font-display font-bold text-gray-900">Bentornato</h1>
          <p className="text-muted-foreground mt-2">Accedi per gestire le chiusure del tuo negozio</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
         
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-neutral-700 mb-2">
              Email
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-11 pr-4 py-3 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="tuo@email.com"
                required
              />
            </div>
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-neutral-700 mb-2">
              Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-11 pr-4 py-3 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="••••••••"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>
          {(error || loginError) && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-red-800 text-sm">{(error || loginError)}</p>
            </div>
          )}

          <Button 
            type="submit" 
            size="lg" 
            disabled={isLoading}
            className="w-full font-medium flex items-center justify-center gap-2"
          >
            <LogIn className="w-5 h-5" />
            {isLoading ? 'Accesso in corso...' : 'Accedi'}
          </Button>

          <button
            type="button"
            onClick={() => {setShowResetPassword(true); setShowPassword(false)}}
            className="w-full text-sm text-neutral-600 hover:text-neutral-900 mt-2"
          >
            Password dimenticata?
          </button>
        </form>
      </div>
      {(isLoggingIn && !loginError) && (<Spinner/>)}
    </div>
  );
}
