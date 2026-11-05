import React from 'react';
import {
  ArrowRight,
  Building2,
  CircleDollarSign,
  LogIn,
  QrCode,
  ScanLine,
  Smartphone,
} from 'lucide-react';
import { Button } from './ui';
import { PortalFooter } from './PortalShell';
import isologo from '../assets/isologo.png';

export interface LandingPageProps {
  onNavigate: (to: string) => void;
}

const FEATURES = [
  {
    icon: Smartphone,
    title: 'Carnet digital con QR',
    text: 'Cada socio tiene su carnet en el celular, con foto, estado de la cuota y días restantes.',
  },
  {
    icon: ScanLine,
    title: 'Control de ingreso',
    text: 'Escaneás el QR desde cualquier teléfono o tablet. Sin molinetes ni lectores caros.',
  },
  {
    icon: CircleDollarSign,
    title: 'Morosidad bajo control',
    text: 'Ves quién está al día, quién vence esta semana y quién debe, y registrás los pagos en segundos.',
  },
];

const STEPS = [
  { n: '1', title: 'Creá la cuenta de tu gimnasio', text: 'Te damos un link propio, ej. acuva.com.ar/tu-gimnasio.' },
  { n: '2', title: 'Pegá el QR en la recepción', text: 'Tus socios lo escanean, se suman y ya tienen su carnet.' },
  { n: '3', title: 'Controlá el ingreso', text: 'Escaneás el carnet en la puerta y Acuva te dice si está al día.' },
];

/** / — landing pública de Acuva. */
export const LandingPage: React.FC<LandingPageProps> = ({ onNavigate }) => {
  return (
    <div className="w-full">
      {/* Hero */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 pt-12 sm:pt-20 pb-12 sm:pb-16 grid lg:grid-cols-[1.15fr_1fr] gap-10 lg:gap-14 items-center">
        <div className="flex flex-col gap-5">
          <span className="self-start text-[11px] font-extrabold uppercase tracking-[0.12em] text-accent bg-accent-soft border border-accent-border px-3 py-1.5 rounded-full">
            Para gimnasios, estudios y clubes
          </span>
          <h1 className="text-[36px] sm:text-[48px] font-extrabold tracking-[-0.02em] leading-[1.05] text-text-primary">
            El carnet digital
            <br />
            <span className="text-accent">de tu gimnasio.</span>
          </h1>
          <p className="text-base sm:text-lg text-text-secondary leading-relaxed max-w-xl">
            Socios con QR en el celular, ingreso controlado desde cualquier teléfono y la cuota de
            cada uno a la vista. Todo desde el navegador.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 pt-1">
            <Button variant="primary" size="lg" icon={Building2} onClick={() => onNavigate('/local/registro')}>
              Registrar mi gimnasio
            </Button>
            <Button variant="secondary" size="lg" icon={LogIn} onClick={() => onNavigate('/login')}>
              Ingresar
            </Button>
          </div>
        </div>

        {/* Ilustración: carnet + QR del local */}
        <div aria-hidden="true" className="relative mx-auto w-full max-w-[360px]">
          <div className="bg-carnet-ground border border-border-default rounded-card p-5 space-y-4">
            <div className="flex items-center justify-between">
              <img src={isologo} alt="" className="w-8 h-8 object-contain" />
              <span className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-status-ok bg-status-ok-soft border border-status-ok-border px-2.5 py-1 rounded-full">
                Al día
              </span>
            </div>
            <div className="bg-carnet-panel border border-border-subtle rounded-2xl p-4 flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-avatar-bg border border-accent-border text-accent font-extrabold flex items-center justify-center">
                AP
              </div>
              <div className="min-w-0">
                <p className="text-lg font-bold text-text-primary leading-tight">Ana Pérez</p>
                <p className="text-xs font-mono text-text-muted">DNI 43.928.104</p>
                <p className="text-xs text-text-secondary mt-1">Funcional · 18 días</p>
              </div>
            </div>
            <div className="bg-qr-paper rounded-2xl p-5 flex items-center justify-center">
              <QrCode className="w-32 h-32 text-ink-on-accent" strokeWidth={1.25} />
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="border-t border-border-subtle bg-surface-100">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-12 sm:py-16 grid sm:grid-cols-3 gap-4">
          {FEATURES.map(({ icon: Icon, title, text }) => (
            <div key={title} className="bg-bg-base border border-border-subtle rounded-[20px] p-5 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-accent-soft border border-accent-border text-accent flex items-center justify-center">
                <Icon className="w-5 h-5" aria-hidden="true" />
              </div>
              <h2 className="text-lg font-bold text-text-primary">{title}</h2>
              <p className="text-sm text-text-muted leading-relaxed">{text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Cómo funciona */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
        <h2 className="text-[24px] sm:text-[28px] font-extrabold tracking-[-0.02em] text-text-primary mb-6">
          Cómo funciona
        </h2>
        <ol className="grid sm:grid-cols-3 gap-4">
          {STEPS.map((step) => (
            <li key={step.n} className="border border-border-default rounded-[20px] p-5 space-y-2">
              <span className="w-8 h-8 rounded-full bg-surface-200 border border-border-default text-accent font-extrabold text-sm flex items-center justify-center">
                {step.n}
              </span>
              <h3 className="text-[15px] font-bold text-text-primary">{step.title}</h3>
              <p className="text-sm text-text-muted leading-relaxed">{step.text}</p>
            </li>
          ))}
        </ol>

        <div className="mt-8 bg-surface-portal border border-border-default rounded-[20px] p-5 flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex-1">
            <h3 className="text-[15px] font-bold text-text-primary">¿Sos socio?</h3>
            <p className="text-sm text-text-muted leading-relaxed">
              Escaneá el QR de la recepción de tu gimnasio o entrá al link que te pasaron. Si ya
              tenés cuenta, ingresá con tu DNI o email.
            </p>
          </div>
          <Button variant="secondary" icon={ArrowRight} onClick={() => onNavigate('/login')}>
            Ver mi carnet
          </Button>
        </div>
      </section>

      <div className="pb-10">
        <PortalFooter />
      </div>
    </div>
  );
};
