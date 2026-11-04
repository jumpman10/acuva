import React, { useState } from 'react';
import { LogIn } from 'lucide-react';
import { login, authErrorMessage, type LoginResult } from '../../lib/authService';
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
  passwordHint = 'Si te dio de alta tu gimnasio, es tu DNI',
  disabled = false,
}) => {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
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

    setLoading(true);
    try {
      const result = await login(trimmedId, trimmedPass);
      onSuccess(result);
    } catch (err) {
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
          onChange={(e) => setIdentifier(e.target.value)}
          disabled={loading || disabled}
          required
        />
      </Field>

      <Field label="Contraseña" hint={passwordHint} htmlFor="login-password">
        <Input
          id="login-password"
          variant="portal"
          type="password"
          autoComplete="current-password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={loading || disabled}
          required
        />
      </Field>

      <Button
        type="submit"
        variant="primary"
        size="lg"
        icon={LogIn}
        loading={loading}
        disabled={disabled}
        className="w-full h-[54px]"
      >
        {submitLabel}
      </Button>
    </form>
  );
};
