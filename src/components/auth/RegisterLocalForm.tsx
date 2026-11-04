import React, { useState } from 'react';
import { Building2, CheckCircle2 } from 'lucide-react';
import { registerLocal, authErrorMessage } from '../../lib/authService';
import { Alert, Button, Field, Input } from '../ui';

export interface RegisterLocalFormProps {
  /** Se llama cuando la cuenta quedó creada con sesión abierta. */
  onRegistered: () => Promise<void> | void;
  onBackToLogin: () => void;
}

/** Alta de un gimnasio (rol local). El link /{slug} se genera solo con el nombre. */
export const RegisterLocalForm: React.FC<RegisterLocalFormProps> = ({ onRegistered, onBackToLogin }) => {
  const [localName, setLocalName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingConfirmation, setPendingConfirmation] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!localName.trim() || !ownerName.trim() || !email.trim() || !password) {
      setError('Completá el nombre del gimnasio, tu nombre, email y contraseña.');
      return;
    }
    if (password.length < 6) {
      setError('La contraseña tiene que tener al menos 6 caracteres.');
      return;
    }

    setLoading(true);
    try {
      const authData = await registerLocal({
        localName: localName.trim(),
        ownerName: ownerName.trim(),
        phone: phone.trim() || undefined,
        email: email.trim(),
        password,
        plan: 'standard',
      });

      if (authData.session) {
        await onRegistered();
      } else {
        setPendingConfirmation(true);
      }
    } catch (err) {
      setError(authErrorMessage(err, 'No pudimos crear la cuenta del gimnasio. Probá de nuevo.'));
    } finally {
      setLoading(false);
    }
  };

  if (pendingConfirmation) {
    return (
      <div className="flex flex-col gap-4">
        <div
          role="status"
          className="bg-status-ok-soft border border-status-ok-border rounded-xl p-4 flex items-start gap-3"
        >
          <CheckCircle2 className="w-5 h-5 text-status-ok shrink-0 mt-0.5" aria-hidden="true" />
          <div className="space-y-1">
            <p className="text-sm font-bold text-text-primary">Revisá tu email</p>
            <p className="text-[13px] text-text-secondary leading-snug">
              Te mandamos un link para confirmar la cuenta de {localName.trim()}. Después ingresá con
              tu email y contraseña.
            </p>
          </div>
        </div>
        <Button variant="secondary" size="lg" onClick={onBackToLogin} className="w-full">
          Ir a ingresar
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-[18px]" noValidate>
      {error && <Alert>{error}</Alert>}

      <Field label="Nombre del gimnasio" htmlFor="local-name">
        <Input
          id="local-name"
          variant="portal"
          autoComplete="organization"
          placeholder="Power Gym"
          value={localName}
          onChange={(e) => setLocalName(e.target.value)}
          disabled={loading}
          required
        />
      </Field>

      <Field label="Tu nombre" htmlFor="local-owner">
        <Input
          id="local-owner"
          variant="portal"
          autoComplete="name"
          placeholder="Juan Pérez"
          value={ownerName}
          onChange={(e) => setOwnerName(e.target.value)}
          disabled={loading}
          required
        />
      </Field>

      <Field label="Teléfono" hint="Opcional" htmlFor="local-phone">
        <Input
          id="local-phone"
          variant="portal"
          mono
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="381 555 1234"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          disabled={loading}
        />
      </Field>

      <Field label="Email" htmlFor="local-email">
        <Input
          id="local-email"
          variant="portal"
          type="email"
          autoComplete="email"
          autoCapitalize="none"
          placeholder="gimnasio@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={loading}
          required
        />
      </Field>

      <Field label="Contraseña" hint="Mínimo 6 caracteres" htmlFor="local-password">
        <Input
          id="local-password"
          variant="portal"
          type="password"
          autoComplete="new-password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={loading}
          minLength={6}
          required
        />
      </Field>

      <Button
        type="submit"
        variant="primary"
        size="lg"
        icon={Building2}
        loading={loading}
        className="w-full h-[54px]"
      >
        Crear cuenta del gimnasio
      </Button>
    </form>
  );
};
