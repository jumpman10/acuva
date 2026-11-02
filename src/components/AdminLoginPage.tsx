import React, { useState } from 'react';
import { signInAdmin, signUpAdmin, getStoredSupabaseConfig, User } from '../lib/supabase';
import isologo from '../assets/isologo.png';
import logo from '../assets/logo.png';
import { Card, Field, Input, Button } from './ui';
import {
  Shield,
  Lock,
  AlertCircle,
  CheckCircle2,
  Database,
  ArrowLeft,
} from 'lucide-react';

export interface AdminLoginPageProps {
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
          } else {
            setSuccessMsg(
              'Usuario creado exitosamente. Si la confirmación por email está activada en Supabase, revisá tu casilla.'
            );
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
    <div className="w-full max-w-md mx-auto py-8 px-4">
      <Card className="p-6 sm:p-8 space-y-6">
        {/* Top return link */}
        <Button
          type="button"
          variant="ghost"
          size="md"
          icon={ArrowLeft}
          onClick={onNavigateHome}
          className="text-xs -ml-2 text-text-muted hover:text-text-primary"
        >
          Volver al Portal de Socios
        </Button>

        {/* Header */}
        <div className="text-center space-y-2.5">
          <div className="relative inline-block mx-auto mb-1">
            <img
              src={isologo}
              alt="Acuva"
              className="w-14 h-14 mx-auto object-contain drop-shadow-[0_4px_16px_rgba(52,211,153,0.25)]"
            />
            <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-accent text-ink-on-accent flex items-center justify-center border-2 border-surface-100 shadow">
              <Shield className="w-3.5 h-3.5" />
            </div>
          </div>
          <img src={logo} alt="Acuva" className="h-6 mx-auto object-contain" />
          <h2 className="text-base font-bold tracking-wide text-text-primary uppercase">
            {isSignUp ? 'Crear Administrador' : 'Panel de Administración'}
          </h2>
          <p className="text-xs text-text-muted">
            Acceso exclusivo del personal vía Supabase Auth
          </p>
        </div>

        {/* Supabase connection warning */}
        {!isConfigured && (
          <div className="p-3.5 rounded-xl bg-status-warn-soft border border-status-warn-border text-status-warn text-xs space-y-2">
            <div className="flex items-center gap-2 font-bold">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>Base de datos no configurada</span>
            </div>
            <p className="text-text-secondary text-[11px]">
              Se requiere conectar Supabase para autenticar al administrador.
            </p>
            <Button
              type="button"
              variant="secondary"
              size="md"
              icon={Database}
              onClick={onOpenSupabaseConfig}
              className="w-full mt-1"
            >
              Configurar Supabase ahora
            </Button>
          </div>
        )}

        {/* Error / Success messages */}
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

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <Field label="Correo electrónico">
            <Input
              variant="admin"
              mono
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
              mono
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
            {isSignUp ? 'Registrar Administrador' : 'Ingresar al Panel'}
          </Button>
        </form>

        {/* Toggle sign in / sign up */}
        <div className="pt-3 border-t border-border-subtle text-center">
          <button
            type="button"
            onClick={() => {
              setIsSignUp(!isSignUp);
              setErrorMsg(null);
              setSuccessMsg(null);
            }}
            className="text-xs text-text-muted hover:text-text-primary transition-colors underline cursor-pointer"
          >
            {isSignUp
              ? '¿Ya tenés cuenta? Iniciar sesión'
              : '¿No tenés cuenta de admin? Registrarse'}
          </button>
        </div>
      </Card>
    </div>
  );
};
