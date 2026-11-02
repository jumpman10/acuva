import React, { useState } from 'react';
import { signInAdmin, signUpAdmin, getStoredSupabaseConfig, User } from '../lib/supabase';
import isologo from '../assets/isologo.png';
import { X, Lock, AlertCircle, CheckCircle2, Database } from 'lucide-react';
import { Button, Input, Field } from './ui';

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
      setErrorMsg('Por favor completá todos los campos.');
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
            setSuccessMsg('Usuario creado exitosamente. Si la confirmación por email está activada en Supabase, revisá tu casilla para confirmar el acceso.');
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
        message = 'Credenciales inválidas. Verificá tu correo y contraseña.';
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
    <div className="fixed inset-0 z-50 overflow-y-auto bg-overlay backdrop-blur-[3px]">
      <div className="min-h-full flex items-center justify-center p-2.5 sm:p-4">
        <div className="bg-carnet-ground border border-border-default rounded-[20px] w-full max-w-md overflow-hidden relative my-auto flex flex-col max-h-[calc(100dvh-1.5rem)] sm:max-h-[90vh]">
          {/* Header */}
          <div className="flex items-center justify-between p-4 sm:p-5 border-b border-border-subtle bg-carnet-ground shrink-0">
            <div className="flex items-center gap-2.5">
              <img
                src={isologo}
                alt="Acuva"
                className="w-8 h-8 object-contain shrink-0"
              />
              <div>
                <h3 className="font-bold text-sm sm:text-base text-text-primary">
                  {isSignUp ? 'Crear administrador' : 'Acceso administrador'}
                </h3>
                <p className="text-xs text-text-muted">
                  Autenticación Supabase Auth
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              iconOnly
              icon={X}
              aria-label="Cerrar"
              onClick={onClose}
            />
          </div>

          {/* Body */}
          <div className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1 min-h-0">
            {!isConfigured && (
              <div className="p-3.5 rounded-xl bg-status-warn-soft border border-status-warn-border text-status-warn text-xs space-y-2">
                <div className="flex items-center gap-2 font-bold">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>Supabase no configurado</span>
                </div>
                <p className="text-text-secondary text-[11px]">
                  Para iniciar sesión como administrador se requiere conectar el proyecto con Supabase.
                </p>
                {onOpenSupabaseConfig && (
                  <Button
                    type="button"
                    variant="secondary"
                    size="md"
                    icon={Database}
                    onClick={() => {
                      onClose();
                      onOpenSupabaseConfig();
                    }}
                    className="mt-1"
                  >
                    Configurar conexión ahora
                  </Button>
                )}
              </div>
            )}

            {errorMsg && (
              <div className="p-3 rounded-xl bg-status-danger-soft border border-status-danger-border text-status-danger text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-status-danger shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            {successMsg && (
              <div className="p-3 rounded-xl bg-status-ok-soft border border-status-ok-border text-status-ok text-xs flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-status-ok shrink-0 mt-0.5" />
                <span>{successMsg}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <Field label="Correo electrónico">
                <Input
                  variant="admin"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@acuva.com"
                />
              </Field>

              <Field label="Contraseña">
                <Input
                  variant="admin"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  minLength={6}
                />
              </Field>

              <Button
                type="submit"
                variant="primary"
                size="lg"
                loading={loading}
                disabled={loading || !isConfigured}
                icon={Lock}
                className="w-full mt-2"
              >
                {isSignUp ? 'Registrar administrador' : 'Ingresar como admin'}
              </Button>
            </form>

            {/* Toggle between Sign In and Sign Up */}
            <div className="pt-3 border-t border-border-subtle text-center">
              <button
                type="button"
                onClick={() => {
                  setIsSignUp(!isSignUp);
                  setErrorMsg(null);
                  setSuccessMsg(null);
                }}
                className="text-xs text-text-muted hover:text-text-primary transition-colors underline cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent rounded"
              >
                {isSignUp
                  ? '¿Ya tenés cuenta? Iniciar sesión'
                  : '¿No tenés cuenta de admin? Registrate'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
