import React, { useState } from 'react';
import { LogIn } from 'lucide-react';
import { login, authErrorMessage, FirstLoginRequiredError, type LoginResult } from '../../lib/authService';
import { Alert, Button, Field, Input } from '../ui';

export interface LoginFormProps {
  onSuccess: (result: LoginResult) => void;
  submitLabel?: string;
  identifierLabel?: string;
  identifierPlaceholder?: string;
  passwordHint?: React.ReactNode;
  disabled?: boolean;
}

/**
 * Formulario único de ingreso (DNI o email + contraseña).
 * Lo usan /login y el portal de cada local.
 */
export const LoginForm: React.FC<LoginFormProps> = ({
  onSuccess,
  submitLabel = 'Ingresar',
  identifierLabel = 'DNI o email',
  identifierPlaceholder = '43928104 o tu@email.com',
  passwordHint,
  disabled = false,
}) => {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [firstLogin, setFirstLogin] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedId = identifier.trim();
    const trimmedPass = password.trim();
    if (!trimmedId || !trimmedPass) {
      setError('Completá tu DNI o email y tu contraseña.');
      return;
    }

    if (firstLogin && passwordConfirm.trim() !== trimmedPass) {
      setError('Las dos contraseñas no coinciden. Escribilas de nuevo.');
      return;
    }

    setLoading(true);
    try {
      const result = await login(trimmedId, trimmedPass, firstLogin ? passwordConfirm.trim() : undefined);
      onSuccess(result);
    } catch (err) {
      if (err instanceof FirstLoginRequiredError) {
        setFirstLogin(true);
        return;
      }
      setError(authErrorMessage(err, 'No pudimos iniciar sesión. Probá de nuevo.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-[18px]" noValidate>
      {error && <Alert>{error}</Alert>}

      <Field label={identifierLabel} htmlFor="login-identifier">
        <Input
          id="login-identifier"
          variant="portal"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          placeholder={identifierPlaceholder}
          value={identifier}
          onChange={(e) => {
            setIdentifier(e.target.value);
            setFirstLogin(false);
            setPasswordConfirm('');
          }}
          disabled={loading || disabled}
          required
        />
      </Field>

      {firstLogin && (
        <p className="bg-accent-soft text-accent border border-accent rounded-xl px-3.5 py-3 text-[13px] leading-snug">
          Es tu primer ingreso. Elegí una contraseña de al menos 8 caracteres: con tu DNI y esa contraseña vas a entrar de ahora en más.
        </p>
      )}

      <Field
        label={firstLogin ? 'Elegí tu contraseña' : 'Contraseña'}
        hint={passwordHint}
        htmlFor="login-password"
      >
        <Input
          id="login-password"
          variant="portal"
          type="password"
          autoComplete={firstLogin ? 'new-password' : 'current-password'}
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={loading || disabled}
          required
        />
      </Field>

      {firstLogin && (
        <Field label="Repetí tu contraseña" htmlFor="login-password-confirm">
          <Input
            id="login-password-confirm"
            variant="portal"
            type="password"
            autoComplete="new-password"
            placeholder="••••••••"
            value={passwordConfirm}
            onChange={(e) => setPasswordConfirm(e.target.value)}
            disabled={loading || disabled}
            required
          />
        </Field>
      )}

      <Button
        type="submit"
        variant="primary"
        size="lg"
        icon={LogIn}
        loading={loading}
        disabled={disabled}
        className="w-full h-[54px]"
      >
        {firstLogin ? 'Crear contraseña e ingresar' : submitLabel}
      </Button>
    </form>
  );
};
