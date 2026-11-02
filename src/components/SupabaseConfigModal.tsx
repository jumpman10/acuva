import React, { useState, useEffect } from 'react';
import {
  getStoredSupabaseConfig,
  saveStoredSupabaseConfig,
  clearStoredSupabaseConfig,
  testSupabaseConnection,
  resetSupabaseClient,
  SUPABASE_SQL_SCRIPT,
} from '../lib/supabase';
import { Drawer, Button, Field, Input, StatusBadge } from './ui';
import { Shield, Copy, Check, AlertCircle } from 'lucide-react';

export interface SupabaseConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfigSaved: () => void;
}

export const SupabaseConfigModal: React.FC<SupabaseConfigModalProps> = ({
  isOpen,
  onClose,
  onConfigSaved,
}) => {
  const [url, setUrl] = useState('');
  const [anonKey, setAnonKey] = useState('');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [copiedSql, setCopiedSql] = useState(false);
  const [showSql, setShowSql] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const config = getStoredSupabaseConfig();
      setUrl(config.url);
      setAnonKey(config.anonKey);
      setTestResult(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleTestAndSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim() || !anonKey.trim()) {
      setTestResult({
        success: false,
        message: 'Ingresá la URL y la Anon Key de tu proyecto Supabase.',
      });
      return;
    }

    setTesting(true);
    setTestResult(null);

    const result = await testSupabaseConnection(url.trim(), anonKey.trim());
    setTestResult(result);
    setTesting(false);

    if (result.success) {
      saveStoredSupabaseConfig(url.trim(), anonKey.trim());
      resetSupabaseClient();
      onConfigSaved();
    }
  };

  const handleDisconnect = () => {
    clearStoredSupabaseConfig();
    resetSupabaseClient();
    setUrl('');
    setAnonKey('');
    setTestResult(null);
    onConfigSaved();
  };

  const copySql = () => {
    navigator.clipboard.writeText(SUPABASE_SQL_SCRIPT);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2500);
  };

  const config = getStoredSupabaseConfig();

  return (
    <Drawer
      open={isOpen}
      onClose={onClose}
      title="Configurar Supabase"
      subtitle="PostgreSQL & Autenticación de Socios"
      footer={
        <div className="flex items-center justify-between gap-3">
          {config.isConfigured ? (
            <Button
              type="button"
              variant="danger"
              size="md"
              onClick={handleDisconnect}
            >
              Desconectar
            </Button>
          ) : (
            <div />
          )}

          <Button
            type="submit"
            variant="primary"
            size="md"
            loading={testing}
            icon={Shield}
            form="supabase-form"
          >
            Probar y Conectar
          </Button>
        </div>
      }
    >
      <form id="supabase-form" onSubmit={handleTestAndSave} className="space-y-4">
        {/* Status header indicator */}
        <div className="flex items-center justify-between p-3.5 bg-surface-100 rounded-xl border border-border-subtle">
          <span className="text-xs text-text-muted">Estado de conexión</span>
          <StatusBadge tone={config.isConfigured ? 'ok' : 'warn'}>
            {config.isConfigured ? 'Conectado' : 'Almacenamiento Local'}
          </StatusBadge>
        </div>

        <div className="p-3 bg-surface-sunken rounded-xl border border-border-default text-text-muted space-y-1 text-xs">
          <p>1. Ingresá la URL y la anon key de tu proyecto Supabase.</p>
          <p>2. Ejecutá el script SQL en el editor de Supabase para inicializar las tablas.</p>
        </div>

        <Field label="Project URL">
          <Input
            variant="admin"
            type="url"
            required
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://xyz.supabase.co"
            className="focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
          />
        </Field>

        <Field label="Anon Public Key">
          <textarea
            rows={3}
            required
            value={anonKey}
            onChange={(e) => setAnonKey(e.target.value)}
            placeholder="eyJhbGciOiJIUzI1NiIsIn..."
            className="w-full bg-surface-sunken border border-border-default rounded-xl px-3.5 py-2.5 text-xs text-text-primary placeholder:text-text-faint font-mono focus:border-accent focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent transition-colors"
          />
        </Field>

        {testResult && (
          <div
            className={`p-3.5 rounded-xl border text-xs flex items-center gap-2 ${
              testResult.success
                ? 'bg-status-ok-soft border-status-ok-border text-status-ok'
                : 'bg-status-danger-soft border-status-danger-border text-status-danger'
            }`}
          >
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{testResult.message}</span>
          </div>
        )}

        {/* Script SQL */}
        <div className="pt-3 border-t border-border-subtle space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-text-secondary">
              Script SQL de Tablas
            </span>
            <div className="flex items-center gap-1.5">
              <Button
                type="button"
                variant="ghost"
                size="md"
                onClick={() => setShowSql(!showSql)}
                className="h-8 px-2 text-xs"
              >
                {showSql ? 'Ocultar' : 'Ver'}
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="md"
                icon={copiedSql ? Check : Copy}
                onClick={copySql}
                className="h-8 px-2.5 text-xs"
              >
                {copiedSql ? 'Copiado' : 'Copiar'}
              </Button>
            </div>
          </div>

          {showSql && (
            <pre className="bg-surface-sunken border border-border-default rounded-xl p-3 text-[11px] font-mono text-text-secondary max-h-48 overflow-auto">
              {SUPABASE_SQL_SCRIPT}
            </pre>
          )}
        </div>
      </form>
    </Drawer>
  );
};
