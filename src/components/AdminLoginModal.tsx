import React, { useState } from 'react';
import { signInAdmin, signUpAdmin, getStoredSupabaseConfig, User } from '../lib/supabase';
import isologo from '../assets/isologo.png';
import { X, Shield, Lock, Mail, KeyRound, AlertCircle, CheckCircle2, RefreshCw, Database } from 'lucide-react';

interface AdminLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (user: User) => void;
  onOpenSupabaseConfig?: () => void;
}

export const AdminLoginModal: React.FC<AdminLoginModalProps> = ({
  isOpen,
  onClose,
  onLoginSuccess,
  onOpenSupabaseConfig,
}) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!isOpen) return null;

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
            onClose();
          } else {
            setSuccessMsg('Usuario creado exitosamente. Si la confirmación por email está activada en Supabase, revisa tu casilla para confirmar el acceso.');
          }
        }
      } else {
        const { data, error } = await signInAdmin(trimmedEmail, trimmedPass);
        if (error) {
          throw error;
        }
        if (data.user) {
          onLoginSuccess(data.user);
          onClose();
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
    <div className="fixed inset-0 z-50 overflow-y-auto bg-[#0f172a]/80 backdrop-blur-sm">
      <div className="min-h-full flex items-center justify-center p-2.5 sm:p-4">
        <div className="bg-[#0f172a] border border-[#34d399] rounded-2xl w-full max-w-md overflow-hidden shadow-2xl relative my-auto flex flex-col max-h-[calc(100dvh-1.5rem)] sm:max-h-[90vh]">
          {/* Header */}
          <div className="flex items-center justify-between p-4 sm:p-5 border-b border-[#34d399]/30 bg-[#0f172a] shrink-0">
            <div className="flex items-center gap-2.5">
              <img
                src={isologo}
                alt="Acuva"
                className="w-8 h-8 object-contain shrink-0"
              />
              <div>
                <h3 className="font-black text-sm sm:text-base text-white uppercase tracking-wider">
                  {isSignUp ? 'Crear Administrador' : 'Acceso Administrador'}
                </h3>
                <p className="text-[11px] text-slate-300 font-mono">
                  Autenticación Supabase Auth
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-slate-300 hover:text-white p-1 rounded hover:bg-[#1e293b] transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body */}
          <div className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1 min-h-0">
            {!isConfigured && (
              <div className="p-3 rounded-xl bg-[#0f172a] border border-amber-500/40 text-white text-xs space-y-2 font-mono">
                <div className="flex items-center gap-2 text-amber-300 font-bold">
                  <AlertCircle className="w-4 h-4 text-amber-300" />
                  <span>Supabase no configurado</span>
                </div>
                <p className="text-slate-300 text-[11px]">
                  Para iniciar sesión como administrador se requiere conectar el proyecto con Supabase.
                </p>
                {onOpenSupabaseConfig && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenSupabaseConfig();
                    }}
                    className="px-2.5 py-1.5 bg-[#0f172a] hover:bg-[#1e293b] text-white rounded border border-[#34d399] text-[11px] flex items-center gap-1.5"
                  >
                    <Database className="w-3.5 h-3.5 text-[#34d399]" />
                    Configurar conexión ahora
                  </button>
                )}
              </div>
            )}

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

            <form onSubmit={handleSubmit} className="space-y-3.5">
              <div>
                <label className="block text-[10px] font-bold text-white uppercase font-mono mb-1">
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
                    className="w-full bg-[#0f172a] border border-[#34d399] rounded-lg pl-9 pr-3 py-2.5 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-[#34d399] font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-white uppercase font-mono mb-1">
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
                    className="w-full bg-[#0f172a] border border-[#34d399] rounded-lg pl-9 pr-3 py-2.5 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-[#34d399] font-mono"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || !isConfigured}
                className="w-full py-2.5 sm:py-3 px-4 bg-[#34d399] hover:bg-[#34d399]/90 disabled:opacity-50 active:scale-95 text-[#0f172a] font-black text-xs uppercase tracking-wider rounded-lg transition-all flex items-center justify-center gap-2 mt-2 shadow-lg"
              >
                {loading ? (
                  <RefreshCw className="w-4 h-4 animate-spin text-[#0f172a]" />
                ) : (
                  <Lock className="w-4 h-4 stroke-[2.5]" />
                )}
                {isSignUp ? 'Registrar Administrador' : 'Ingresar como Admin'}
              </button>
            </form>

            {/* Toggle between Sign In and Sign Up */}
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
      </div>
    </div>
  );
};
