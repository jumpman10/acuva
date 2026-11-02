import React, { useState } from 'react';
import { signInAdmin, signUpAdmin, getStoredSupabaseConfig, User } from '../lib/supabase';
import isologo from '../assets/isologo.png';
import logo from '../assets/logo.png';
import { Shield, Lock, Mail, KeyRound, AlertCircle, CheckCircle2, RefreshCw, Database, ArrowLeft } from 'lucide-react';

interface AdminLoginPageProps {
  onLoginSuccess: (user: User) => void;
  onNavigateHome: () => void;
  onOpenSupabaseConfig: () => void;
}

export const AdminLoginPage: React.FC<AdminLoginPageProps> = ({
  onLoginSuccess,
  onNavigateHome,
  onOpenSupabaseConfig,
}) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const { isConfigured } = getStoredSupabaseConfig();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const trimmedEmail = email.trim();
    const trimmedPass = password.trim();

    if (!trimmedEmail || !trimmedPass) {
      setErrorMsg('Por favor completa todos los campos.');
      return;
    }

    setLoading(true);

    try {
      if (isSignUp) {
        const { data, error } = await signUpAdmin(trimmedEmail, trimmedPass);
        if (error) {
          throw error;
        }
        if (data.user) {
          if (data.session) {
            onLoginSuccess(data.user);
          } else {
            setSuccessMsg('Usuario creado exitosamente. Si la confirmación por email está activada en Supabase, revisa tu casilla.');
          }
        }
      } else {
        const { data, error } = await signInAdmin(trimmedEmail, trimmedPass);
        if (error) {
          throw error;
        }
        if (data.user) {
          onLoginSuccess(data.user);
        }
      }
    } catch (err: any) {
      console.error('Error de autenticación:', err);
      let message = err.message || 'Error al autenticar con Supabase.';
      if (message.includes('Invalid login credentials')) {
        message = 'Credenciales inválidas. Verifica tu correo y contraseña.';
      } else if (message.includes('Email not confirmed')) {
        message = 'El correo electrónico aún no ha sido confirmado en Supabase.';
      } else if (message.includes('Password should be at least')) {
        message = 'La contraseña debe tener al menos 6 caracteres.';
      }
      setErrorMsg(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto py-8 px-4">
      <div className="bg-[#0f172a] border border-[#34d399] rounded-2xl p-6 sm:p-8 shadow-2xl space-y-6">
        {/* Top return link */}
        <button
          type="button"
          onClick={onNavigateHome}
          className="text-slate-300 hover:text-white text-xs font-mono flex items-center gap-1.5 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Volver al Portal de Socios</span>
        </button>

        {/* Header */}
        <div className="text-center space-y-2">
          <div className="relative inline-block mx-auto mb-1">
            <img
              src={isologo}
              alt="Acuva"
              className="w-14 h-14 mx-auto object-contain drop-shadow-[0_4px_16px_rgba(52,211,153,0.25)]"
            />
            <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-[#34d399] text-[#0f172a] flex items-center justify-center border-2 border-[#0f172a] shadow">
              <Shield className="w-3.5 h-3.5" />
            </div>
          </div>
          <img
            src={logo}
            alt="Acuva"
            className="h-6 mx-auto object-contain"
          />
          <h2 className="text-base font-black tracking-wider text-white uppercase font-mono">
            {isSignUp ? 'Crear Administrador' : 'Panel de Administración'}
          </h2>
          <p className="text-xs text-slate-300 font-mono">
            Acceso exclusivo del personal vía Supabase Auth
          </p>
        </div>

        {/* Supabase connection warning */}
        {!isConfigured && (
          <div className="p-3.5 rounded-xl bg-[#0f172a] border border-amber-500/40 text-white text-xs space-y-2 font-mono">
            <div className="flex items-center gap-2 text-amber-300 font-bold">
              <AlertCircle className="w-4 h-4 text-amber-300" />
              <span>Base de datos no configurada</span>
            </div>
            <p className="text-slate-300 text-[11px]">
              Se requiere conectar Supabase para autenticar al administrador.
            </p>
            <button
              type="button"
              onClick={onOpenSupabaseConfig}
              className="px-3 py-1.5 bg-[#0f172a] hover:bg-[#1e293b] text-white rounded border border-[#34d399] text-[11px] flex items-center gap-1.5"
            >
              <Database className="w-3.5 h-3.5 text-[#34d399]" />
              Configurar Supabase ahora
            </button>
          </div>
        )}

        {/* Error / Success messages */}
        {errorMsg && (
          <div className="p-3 rounded-lg bg-[#0f172a] border border-red-500/50 text-red-400 text-xs font-mono flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="p-3 rounded-lg bg-[#0f172a] border border-[#34d399]/50 text-[#34d399] text-xs font-mono flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-[#34d399] shrink-0 mt-0.5" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-white uppercase font-mono mb-1.5">
              Correo Electrónico
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-[#34d399] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@acuva.com"
                className="w-full bg-[#0f172a] border border-[#34d399] rounded-lg pl-9 pr-3.5 py-2.5 text-sm sm:text-xs text-white placeholder-slate-400 focus:outline-none focus:border-[#34d399] font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-white uppercase font-mono mb-1.5">
              Contraseña
            </label>
            <div className="relative">
              <KeyRound className="w-4 h-4 text-[#34d399] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                minLength={6}
                className="w-full bg-[#0f172a] border border-[#34d399] rounded-lg pl-9 pr-3.5 py-2.5 text-sm sm:text-xs text-white placeholder-slate-400 focus:outline-none focus:border-[#34d399] font-mono"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || !isConfigured}
            className="w-full py-3 px-4 bg-[#34d399] hover:bg-[#34d399]/90 disabled:opacity-50 active:scale-95 text-[#0f172a] font-black text-xs sm:text-sm uppercase tracking-wider rounded-lg transition-all flex items-center justify-center gap-2 shadow-lg"
          >
            {loading ? (
              <RefreshCw className="w-4 h-4 animate-spin text-[#0f172a]" />
            ) : (
              <Lock className="w-4 h-4 stroke-[2.5]" />
            )}
            {isSignUp ? 'Registrar Administrador' : 'Ingresar al Panel'}
          </button>
        </form>

        {/* Toggle sign in / sign up */}
        <div className="pt-3 border-t border-[#34d399]/20 text-center">
          <button
            type="button"
            onClick={() => {
              setIsSignUp(!isSignUp);
              setErrorMsg(null);
              setSuccessMsg(null);
            }}
            className="text-[11px] text-slate-300 hover:text-white font-mono underline"
          >
            {isSignUp
              ? '¿Ya tienes cuenta? Iniciar sesión'
              : '¿No tienes cuenta de admin? Registrarse'}
          </button>
        </div>
      </div>
    </div>
  );
};
