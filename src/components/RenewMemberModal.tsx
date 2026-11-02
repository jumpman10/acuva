import React, { useState, useEffect, useMemo } from 'react';
import {
  Member,
  DisciplineItem,
  PaymentMethod,
  PaymentMethodDetail,
  RenewMemberOptions,
} from '../types';
import {
  calculateNextExpiration,
  formatDateISO,
} from '../lib/dateUtils';
import { formatMoney } from '../lib/status';
import { playSuccessChime } from '../lib/sound';
import { Drawer, Button, Field, Input } from './ui';
import {
  Banknote,
  Smartphone,
  CreditCard,
  WalletCards,
  QrCode,
  Split,
  AlertCircle,
  BadgeAlert,
} from 'lucide-react';

export interface RenewMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  member: Member | null;
  disciplines: DisciplineItem[];
  onConfirmRenew: (memberId: string, options: RenewMemberOptions) => Promise<void>;
  onBack?: () => void;
}

type SinglePaymentMethod =
  | 'Efectivo'
  | 'Transferencia'
  | 'Tarjeta de débito'
  | 'Tarjeta de crédito'
  | 'Pago con QR';

const PAYMENT_METHODS_OPTIONS = [
  { id: 'Efectivo' as const, label: 'Efectivo', icon: Banknote },
  { id: 'Transferencia' as const, label: 'Transferencia', icon: Smartphone },
  { id: 'Tarjeta de débito' as const, label: 'Débito', icon: CreditCard },
  { id: 'Tarjeta de crédito' as const, label: 'Crédito', icon: WalletCards },
  { id: 'Pago con QR' as const, label: 'Pago QR', icon: QrCode },
];

export const RenewMemberModal: React.FC<RenewMemberModalProps> = ({
  isOpen,
  onClose,
  member,
  disciplines,
  onConfirmRenew,
  onBack,
}) => {
  const [modoCobro, setModoCobro] = useState<'renovacion' | 'saldar_deuda'>('renovacion');
  const [fechaRenovacion, setFechaRenovacion] = useState(formatDateISO(new Date()));
  const [fechaVencimiento, setFechaVencimiento] = useState('');
  const [disciplina, setDisciplina] = useState('');
  const [precioDisciplina, setPrecioDisciplina] = useState<number>(28000);

  // Amount being paid today
  const [montoAbonado, setMontoAbonado] = useState<number>(28000);

  // Payment split mode
  const [esMixto, setEsMixto] = useState<boolean>(false);
  const [metodoSimple, setMetodoSimple] = useState<SinglePaymentMethod>('Efectivo');

  // Mixed breakdown
  const [montoEfectivo, setMontoEfectivo] = useState<number>(0);
  const [montoTransferencia, setMontoTransferencia] = useState<number>(0);
  const [montoDebito, setMontoDebito] = useState<number>(0);
  const [montoCredito, setMontoCredito] = useState<number>(0);
  const [montoQr, setMontoQr] = useState<number>(0);

  const [notas, setNotas] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Initialize modal state when opened
  useEffect(() => {
    if (member && isOpen) {
      const today = formatDateISO(new Date());
      setFechaRenovacion(today);
      setModoCobro('renovacion');

      const currentDisc = member.disciplina || (disciplines[0]?.nombre ?? 'Musculación');
      setDisciplina(currentDisc);

      const matchedDisc = disciplines.find((d) => d.nombre === currentDisc);
      const feeAmount = matchedDisc?.precio || member.monto_mensual || 28000;
      setPrecioDisciplina(feeAmount);
      setMontoAbonado(feeAmount);

      // Reset payment mode
      setEsMixto(false);
      setMetodoSimple(
        member.metodo_pago && member.metodo_pago !== 'Mixto'
          ? (member.metodo_pago as SinglePaymentMethod)
          : 'Efectivo'
      );
      setMontoEfectivo(feeAmount);
      setMontoTransferencia(0);
      setMontoDebito(0);
      setMontoCredito(0);
      setMontoQr(0);
      setNotas('');
      setFormError(null);

      // Calculate expiration
      const baseDate =
        member.fecha_vencimiento && member.fecha_vencimiento >= today
          ? member.fecha_vencimiento
          : today;
      setFechaVencimiento(calculateNextExpiration(baseDate));
    }
  }, [member, isOpen, disciplines]);

  // When switching modes (Renovación vs Saldar Deuda)
  const handleModoCobroChange = (nuevoModo: 'renovacion' | 'saldar_deuda') => {
    setModoCobro(nuevoModo);
    setFormError(null);
    if (nuevoModo === 'saldar_deuda') {
      const deuda = member?.saldo_pendiente || 0;
      setMontoAbonado(deuda);
      setMontoEfectivo(deuda);
      setMontoTransferencia(0);
      setMontoDebito(0);
      setMontoCredito(0);
      setMontoQr(0);
    } else {
      setMontoAbonado(precioDisciplina);
      setMontoEfectivo(precioDisciplina);
      setMontoTransferencia(0);
      setMontoDebito(0);
      setMontoCredito(0);
      setMontoQr(0);
    }
  };

  // Recalculate expiration when renewal date changes
  const handleRenovacionChange = (newRenovacionDate: string) => {
    setFechaRenovacion(newRenovacionDate);
    if (!member) return;
    const baseDate =
      member.fecha_vencimiento && member.fecha_vencimiento >= newRenovacionDate
        ? member.fecha_vencimiento
        : newRenovacionDate;
    setFechaVencimiento(calculateNextExpiration(baseDate));
  };

  // Handle discipline change
  const handleDisciplineChange = (selectedName: string) => {
    setDisciplina(selectedName);
    const found = disciplines.find((d) => d.nombre === selectedName);
    if (found) {
      setPrecioDisciplina(found.precio);
      if (modoCobro === 'renovacion') {
        setMontoAbonado(found.precio);
        setMontoEfectivo(found.precio);
        setMontoTransferencia(0);
        setMontoDebito(0);
        setMontoCredito(0);
        setMontoQr(0);
      }
    }
  };

  // Switch to/from mixed payment
  const handleToggleMixto = (activarMixto: boolean) => {
    setEsMixto(activarMixto);
    setFormError(null);
    if (activarMixto) {
      const mitad = Math.floor(montoAbonado / 2);
      setMontoEfectivo(mitad);
      setMontoTransferencia(montoAbonado - mitad);
      setMontoDebito(0);
      setMontoCredito(0);
      setMontoQr(0);
    }
  };

  // Mixed totals and validation
  const sumaDesglose = useMemo(() => {
    return (
      Number(montoEfectivo || 0) +
      Number(montoTransferencia || 0) +
      Number(montoDebito || 0) +
      Number(montoCredito || 0) +
      Number(montoQr || 0)
    );
  }, [montoEfectivo, montoTransferencia, montoDebito, montoCredito, montoQr]);

  const diferenciaDesglose = montoAbonado - sumaDesglose;
  const desgloseValido = !esMixto || diferenciaDesglose === 0;

  // Partial payment debt calculation
  const saldoPendienteCalculado = useMemo(() => {
    if (modoCobro === 'saldar_deuda') {
      const deudaActual = member?.saldo_pendiente || 0;
      return Math.max(0, deudaActual - montoAbonado);
    }
    return Math.max(0, precioDisciplina - montoAbonado);
  }, [modoCobro, member?.saldo_pendiente, precioDisciplina, montoAbonado]);

  const esPagoParcial = modoCobro === 'renovacion' && montoAbonado < precioDisciplina;

  // Auto-fill remainder button for mixed methods
  const autoCompletarResto = (
    metodoDestino: 'Efectivo' | 'Transferencia' | 'Tarjeta de débito' | 'Tarjeta de crédito' | 'Pago con QR'
  ) => {
    const restante = montoAbonado - sumaDesglose;
    if (metodoDestino === 'Efectivo') {
      setMontoEfectivo(Math.max(0, montoEfectivo + restante));
    } else if (metodoDestino === 'Transferencia') {
      setMontoTransferencia(Math.max(0, montoTransferencia + restante));
    } else if (metodoDestino === 'Tarjeta de débito') {
      setMontoDebito(Math.max(0, montoDebito + restante));
    } else if (metodoDestino === 'Tarjeta de crédito') {
      setMontoCredito(Math.max(0, montoCredito + restante));
    } else if (metodoDestino === 'Pago con QR') {
      setMontoQr(Math.max(0, montoQr + restante));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!member) return;
    if (montoAbonado < 0) {
      setFormError('El monto a abonar no puede ser negativo.');
      return;
    }
    if (esMixto && !desgloseValido) {
      setFormError(
        `La suma del desglose (${formatMoney(sumaDesglose)}) no coincide con el total a cobrar (${formatMoney(montoAbonado)}).`
      );
      return;
    }

    setLoading(true);
    setFormError(null);
    try {
      const detallesList: PaymentMethodDetail[] = [];
      let metodoFinal: PaymentMethod | string = metodoSimple;

      if (esMixto) {
        if (montoEfectivo > 0) detallesList.push({ metodo: 'Efectivo', monto: montoEfectivo });
        if (montoTransferencia > 0) detallesList.push({ metodo: 'Transferencia', monto: montoTransferencia });
        if (montoDebito > 0) detallesList.push({ metodo: 'Tarjeta de débito', monto: montoDebito });
        if (montoCredito > 0) detallesList.push({ metodo: 'Tarjeta de crédito', monto: montoCredito });
        if (montoQr > 0) detallesList.push({ metodo: 'Pago con QR', monto: montoQr });

        const nombresMetodos = detallesList.map((d) => d.metodo).join(' + ');
        metodoFinal = detallesList.length > 1 ? `Mixto (${nombresMetodos})` : (detallesList[0]?.metodo || 'Mixto');
      } else {
        detallesList.push({ metodo: metodoSimple, monto: montoAbonado });
      }

      await onConfirmRenew(member.id, {
        monto: montoAbonado,
        metodo: metodoFinal,
        detalles: detallesList,
        disciplina: modoCobro === 'renovacion' ? disciplina : member.disciplina,
        fechaRenovacion,
        fechaVencimiento: modoCobro === 'renovacion' ? fechaVencimiento : member.fecha_vencimiento,
        saldoPendiente: saldoPendienteCalculado,
        esPagoSaldo: modoCobro === 'saldar_deuda',
        notas: notas.trim() || undefined,
      });

      playSuccessChime();
      onClose();
    } catch (err) {
      console.error('Error al registrar pago/renovación:', err);
      setFormError('Ocurrió un error al registrar el pago. Por favor reintentá.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !member) return null;

  const isPaidThroughFuture =
    member.fecha_vencimiento && member.fecha_vencimiento >= fechaRenovacion;
  const tieneDeudaPrevia = (member.saldo_pendiente || 0) > 0;

  return (
    <Drawer
      open={isOpen}
      onClose={onClose}
      onBack={onBack}
      title={modoCobro === 'saldar_deuda' ? 'Cobro de saldo' : 'Cobro y renovación'}
      subtitle={`${member.nombre} ${member.apellido} · ${member.dni}`}
      footer={
        <div className="space-y-2">
          <Button
            type="submit"
            variant="primary"
            size="lg"
            loading={loading}
            disabled={loading || (esMixto && !desgloseValido)}
            className="w-full"
            form="renew-form"
          >
            {modoCobro === 'saldar_deuda' ? 'Cobrar saldo ahora' : 'Cobrar y renovar ahora'}
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="md"
            disabled={loading}
            onClick={onClose}
            className="w-full"
          >
            Cancelar
          </Button>
        </div>
      }
    >
      <form id="renew-form" onSubmit={handleSubmit} className="space-y-4">
        {/* Error message */}
        {formError && (
          <div className="bg-status-danger-soft border border-status-danger-border text-status-danger rounded-xl p-3 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{formError}</span>
          </div>
        )}

        {/* Si tiene saldo: aviso warn "Saldo deudor pendiente $X" */}
        {tieneDeudaPrevia && (
          <div className="bg-status-warn-soft border border-status-warn-border text-status-warn rounded-xl p-3.5 space-y-2.5 text-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-bold">
                <BadgeAlert className="w-4 h-4 shrink-0" />
                <span>Saldo deudor pendiente {formatMoney(member.saldo_pendiente || 0)}</span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 pt-0.5">
              <button
                type="button"
                onClick={() => handleModoCobroChange('renovacion')}
                className={`py-2 px-2.5 rounded-xl text-xs font-bold transition-all border text-center cursor-pointer focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent ${
                  modoCobro === 'renovacion'
                    ? 'bg-accent text-ink-on-accent border-accent'
                    : 'bg-surface-sunken text-text-secondary border-border-default hover:text-text-primary'
                }`}
              >
                Renovar nuevo mes
              </button>
              <button
                type="button"
                onClick={() => handleModoCobroChange('saldar_deuda')}
                className={`py-2 px-2.5 rounded-xl text-xs font-bold transition-all border text-center cursor-pointer focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent ${
                  modoCobro === 'saldar_deuda'
                    ? 'bg-status-warn text-ink-on-accent border-status-warn'
                    : 'bg-surface-sunken text-status-warn border-status-warn-border hover:bg-status-warn-soft'
                }`}
              >
                Saldar deuda ({formatMoney(member.saldo_pendiente || 0)})
              </button>
            </div>
          </div>
        )}

        {/* Disciplina (select) */}
        {modoCobro === 'renovacion' && (
          <Field label="Disciplina">
            <div className="relative">
              <select
                value={disciplina}
                onChange={(e) => handleDisciplineChange(e.target.value)}
                className="w-full h-11 bg-surface-sunken border border-border-default rounded-xl px-3.5 text-sm text-text-primary focus:border-accent focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent appearance-none cursor-pointer transition-colors"
              >
                {disciplina && !disciplines.some((d) => d.nombre === disciplina) && (
                  <option value={disciplina} className="bg-surface-100 text-text-primary">
                    {disciplina}
                  </option>
                )}
                {disciplines.map((d) => (
                  <option key={d.id} value={d.nombre} className="bg-surface-100 text-text-primary">
                    {d.nombre} — {formatMoney(d.precio)}
                  </option>
                ))}
              </select>
              <div className="absolute inset-y-0 right-0 flex items-center pr-3.5 pointer-events-none text-text-muted text-xs">
                ▼
              </div>
            </div>
          </Field>
        )}

        {/* "Monto a cobrar hoy" (Input admin grande, text-2xl font-extrabold) */}
        <Field
          label="Monto a cobrar hoy"
          hint={
            modoCobro === 'renovacion'
              ? `Cuota lista: ${formatMoney(precioDisciplina)}`
              : `Deuda: ${formatMoney(member.saldo_pendiente || 0)}`
          }
        >
          <div className="relative">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted font-bold text-xl select-none">
              $
            </span>
            <Input
              variant="admin"
              type="number"
              min="0"
              step="100"
              required
              value={montoAbonado === 0 ? '' : montoAbonado}
              onChange={(e) => {
                const val = Number(e.target.value) || 0;
                setMontoAbonado(val);
                if (!esMixto) {
                  setMontoEfectivo(val);
                }
              }}
              className="pl-8 text-2xl font-extrabold h-14"
              placeholder="0"
            />
          </div>
        </Field>

        {/* Si el monto es menor a la cuota: aviso warn "Cobro parcial: quedará un saldo de $X" */}
        {esPagoParcial && (
          <div className="bg-status-warn-soft border border-status-warn-border text-status-warn rounded-xl p-3 flex items-start gap-2.5 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold block">
                Cobro parcial: quedará un saldo de {formatMoney(saldoPendienteCalculado)}
              </span>
              <span className="text-text-secondary text-[11px] mt-0.5 block">
                El socio abonará menos que la cuota oficial ({formatMoney(precioDisciplina)}).
              </span>
            </div>
          </div>
        )}

        {modoCobro === 'saldar_deuda' && montoAbonado < (member.saldo_pendiente || 0) && (
          <div className="bg-status-warn-soft border border-status-warn-border text-status-warn rounded-xl p-3 flex items-start gap-2.5 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>
              Cobro parcial: quedará un saldo de {formatMoney(saldoPendienteCalculado)}
            </span>
          </div>
        )}

        {/* Método de pago */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-[13px] font-bold text-text-secondary">
              Método de pago
            </label>
            {/* Toggle "Dividir pago" */}
            <button
              type="button"
              onClick={() => handleToggleMixto(!esMixto)}
              className={`text-xs font-semibold px-2.5 py-1 rounded-lg border transition-colors flex items-center gap-1.5 cursor-pointer ${
                esMixto
                  ? 'border-accent bg-accent-soft text-accent'
                  : 'border-border-default bg-surface-sunken text-text-muted hover:text-text-secondary'
              }`}
            >
              <Split className="w-3.5 h-3.5" />
              <span>Dividir pago</span>
            </button>
          </div>

          {/* Grilla de 5 opciones con ícono */}
          {!esMixto ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {PAYMENT_METHODS_OPTIONS.map((pm) => {
                const isSelected = metodoSimple === pm.id;
                const Icon = pm.icon;
                return (
                  <button
                    key={pm.id}
                    type="button"
                    onClick={() => setMetodoSimple(pm.id)}
                    className={`p-3 rounded-xl border text-xs font-bold transition-all flex flex-col items-center justify-center gap-1.5 cursor-pointer ${
                      isSelected
                        ? 'border-accent bg-accent-soft text-accent'
                        : 'border-border-default bg-surface-sunken text-text-secondary hover:border-border-default/80 hover:text-text-primary'
                    }`}
                  >
                    <Icon className="w-5 h-5 shrink-0" strokeWidth={2} />
                    <span>{pm.label}</span>
                  </button>
                );
              })}
            </div>
          ) : (
            /* Montos por método (lógica de detalles existente) */
            <div className="bg-surface-sunken border border-border-default rounded-xl p-3.5 space-y-3">
              <div className="text-[11px] text-text-muted flex items-center justify-between pb-1 border-b border-border-subtle">
                <span>Indicá cuánto abona con cada método:</span>
                <span className="text-text-primary">
                  Total: <strong>{formatMoney(montoAbonado)}</strong>
                </span>
              </div>

              {[
                {
                  label: 'Efectivo',
                  icon: Banknote,
                  value: montoEfectivo,
                  setter: setMontoEfectivo,
                  id: 'Efectivo' as const,
                },
                {
                  label: 'Transferencia',
                  icon: Smartphone,
                  value: montoTransferencia,
                  setter: setMontoTransferencia,
                  id: 'Transferencia' as const,
                },
                {
                  label: 'Débito',
                  icon: CreditCard,
                  value: montoDebito,
                  setter: setMontoDebito,
                  id: 'Tarjeta de débito' as const,
                },
                {
                  label: 'Crédito',
                  icon: WalletCards,
                  value: montoCredito,
                  setter: setMontoCredito,
                  id: 'Tarjeta de crédito' as const,
                },
                {
                  label: 'Pago QR',
                  icon: QrCode,
                  value: montoQr,
                  setter: setMontoQr,
                  id: 'Pago con QR' as const,
                },
              ].map((item) => (
                <div key={item.id} className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-text-secondary w-28 shrink-0">
                    <item.icon className="w-4 h-4 text-text-muted shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </div>
                  <div className="flex items-center gap-1.5 flex-1">
                    <Input
                      variant="admin"
                      type="number"
                      min="0"
                      step="100"
                      value={item.value || ''}
                      onChange={(e) => item.setter(Number(e.target.value) || 0)}
                      placeholder="0"
                      className="text-right h-9 text-xs"
                    />
                    {diferenciaDesglose !== 0 && (
                      <Button
                        variant="secondary"
                        size="md"
                        onClick={() => autoCompletarResto(item.id)}
                        className="h-9 px-2 text-[11px] whitespace-nowrap shrink-0"
                        title="Asignar saldo restante"
                      >
                        Resto
                      </Button>
                    )}
                  </div>
                </div>
              ))}

              {/* Cuadratura */}
              <div
                className={`pt-2 border-t border-border-subtle flex items-center justify-between text-xs ${
                  desgloseValido ? 'text-status-ok' : 'text-status-warn font-bold'
                }`}
              >
                <span>
                  {desgloseValido ? '✓ Desglose balanceado:' : '⚠️ Diferencia en desglose:'}
                </span>
                <span>
                  Suma: {formatMoney(sumaDesglose)}{' '}
                  {diferenciaDesglose !== 0 && (
                    <span className="text-status-warn">
                      ({diferenciaDesglose > 0 ? `faltan ${formatMoney(diferenciaDesglose)}` : `sobran ${formatMoney(Math.abs(diferenciaDesglose))}`})
                    </span>
                  )}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* "Nuevo vencimiento" calculado con calculateNextExpiration, editable */}
        {modoCobro === 'renovacion' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Fecha de cobro">
              <Input
                variant="admin"
                mono
                type="date"
                required
                value={fechaRenovacion}
                onChange={(e) => handleRenovacionChange(e.target.value)}
              />
            </Field>
            <Field
              label="Nuevo vencimiento"
              hint={isPaidThroughFuture ? '+1 mes acumulado' : '1 mes desde cobro'}
            >
              <Input
                variant="admin"
                mono
                type="date"
                required
                value={fechaVencimiento}
                onChange={(e) => setFechaVencimiento(e.target.value)}
              />
            </Field>
          </div>
        )}

        {/* Notas opcional */}
        <Field label="Notas" hint="Opcional">
          <Input
            variant="admin"
            type="text"
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            placeholder="Ej. Seña entregada en caja, compromiso de saldo"
          />
        </Field>
      </form>
    </Drawer>
  );
};
