import React, { useState, useEffect, useRef } from 'react';
import { Member, DisciplineItem, PaymentStatus, PaymentMethod, MembershipStatus, Local } from '../types';
import { calculateNextExpiration, formatDateISO } from '../lib/dateUtils';
import { processCarnetPhoto } from '../lib/imageUtils';
import { deleteMember } from '../lib/storage';
import { createMemberByLocal } from '../lib/authService';
import { CameraCaptureModal } from './CameraCaptureModal';
import { Drawer, Button, Field, Input, MemberAvatar } from './ui';
import { Camera, Upload, Trash2, AlertCircle } from 'lucide-react';

export interface MemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: any) => Promise<void>;
  member?: Member | null;
  disciplines: DisciplineItem[];
  onDelete?: (id: string) => Promise<void>;
  currentLocal?: Local | { id: string } | null;
}

const PAYMENT_METHODS: PaymentMethod[] = [
  'Efectivo',
  'Transferencia',
  'Tarjeta de débito',
  'Tarjeta de crédito',
  'Pago con QR',
];

export const MemberModal: React.FC<MemberModalProps> = ({
  isOpen,
  onClose,
  onSave,
  member,
  disciplines,
  onDelete,
  currentLocal: _currentLocal,
}) => {
  const [name, setName] = useState('');
  const [dni, setDni] = useState('');
  const [fechaNacimiento, setFechaNacimiento] = useState('');
  const [telefono, setTelefono] = useState('');
  const [disciplina, setDisciplina] = useState('');
  const [fechaIngreso, setFechaIngreso] = useState(formatDateISO(new Date()));
  const [fechaVencimiento, setFechaVencimiento] = useState('');
  const [montoMensual, setMontoMensual] = useState<number>(28000);
  const [estadoPago, setEstadoPago] = useState<PaymentStatus>('pagado');
  const [saldoPendiente, setSaldoPendiente] = useState<number>(0);
  const [metodoPago, setMetodoPago] = useState<PaymentMethod>('Efectivo');
  const [fotoUrl, setFotoUrl] = useState('');
  const [notas, setNotas] = useState('');
  const [accesoApp, setAccesoApp] = useState(false);

  const [loading, setLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isProcessingPhoto, setIsProcessingPhoto] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (member) {
      const initialName =
        member.full_name ||
        [member.nombre, member.apellido].filter(Boolean).join(' ') ||
        '';
      setName(initialName);
      setDni(member.dni);
      setFechaNacimiento(member.fecha_nacimiento || '');
      setTelefono(member.phone || member.telefono || '');
      setDisciplina(member.disciplina);
      setFechaIngreso(member.fecha_ingreso);
      setFechaVencimiento(member.fecha_vencimiento);
      setMontoMensual(member.monto_mensual || 28000);
      setEstadoPago(member.estado_pago === 'pendiente' ? 'saldo' : member.estado_pago);
      setSaldoPendiente(member.saldo_pendiente || 0);
      setMetodoPago(member.metodo_pago || 'Efectivo');
      setFotoUrl(member.foto_url || '');
      setNotas(member.notas || '');
    } else {
      const today = formatDateISO(new Date());
      const defaultDisc = disciplines[0] || { nombre: 'Musculación', precio: 28000 };
      setName('');
      setDni('');
      setFechaNacimiento('');
      setTelefono('');
      setDisciplina(defaultDisc.nombre);
      setFechaIngreso(today);
      setFechaVencimiento(calculateNextExpiration(today));
      setMontoMensual(defaultDisc.precio);
      setEstadoPago('pagado');
      setSaldoPendiente(0);
      setMetodoPago('Efectivo');
      setFotoUrl('');
      setNotas('');
      setAccesoApp(false);
    }
    setShowDeleteConfirm(false);
    setFormError(null);
  }, [member, isOpen, disciplines]);

  const handleIngresoChange = (val: string) => {
    setFechaIngreso(val);
    setFechaVencimiento(calculateNextExpiration(val));
  };

  const handleDisciplineChange = (selectedName: string) => {
    setDisciplina(selectedName);
    const found = disciplines.find((d) => d.nombre === selectedName);
    if (found) {
      setMontoMensual(found.precio);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessingPhoto(true);
    try {
      const compressed = await processCarnetPhoto(file, { size: 400, quality: 0.82 });
      setFotoUrl(compressed);
    } catch (err: any) {
      console.error('Error al procesar foto carnet:', err);
      setFormError('Error al procesar la imagen: ' + (err.message || 'formato incompatible'));
    } finally {
      setIsProcessingPhoto(false);
      e.target.value = '';
    }
  };

  const handleCameraCapture = (capturedDataUrl: string) => {
    setFotoUrl(capturedDataUrl);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    const trimmedDni = dni.trim();
    const trimmedPhone = telefono.trim();

    if (!trimmedName || !trimmedDni) {
      setFormError('Por favor completá Nombre Completo y DNI.');
      return;
    }

    setLoading(true);
    setFormError(null);
    try {
      // 1. Alta de la ficha con control de cupo (sin usuario en Auth: el socio
      //    crea su contraseña en su primer ingreso si el acceso está habilitado)
      if (!member) {
        await createMemberByLocal({
          name: trimmedName,
          dni: trimmedDni,
          phone: trimmedPhone || undefined,
          accesoApp,
        });
      }

      const calculatedVencimiento = fechaVencimiento || calculateNextExpiration(fechaIngreso);
      const isConSaldo = estadoPago === 'saldo' || estadoPago === 'pendiente';
      const estadoMembresia: MembershipStatus = isConSaldo ? 'vencido' : 'activo';

      // Derivar nombre y apellido para compatibilidad con vistas de carnet y tablas
      const nameParts = trimmedName.split(/\s+/);
      const derivedNombre = nameParts[0] || '';
      const derivedApellido = nameParts.slice(1).join(' ') || '';

      await onSave({
        nombre: derivedNombre,
        apellido: derivedApellido,
        full_name: trimmedName,
        dni: trimmedDni,
        fecha_nacimiento: fechaNacimiento.trim() || undefined,
        telefono: trimmedPhone,
        phone: trimmedPhone,
        disciplina: disciplina || disciplines[0]?.nombre || 'Musculación',
        fecha_ingreso: fechaIngreso,
        fecha_vencimiento: calculatedVencimiento,
        estado_membresia: estadoMembresia,
        estado_pago: estadoPago,
        saldo_pendiente:
          estadoPago === 'parcial' || estadoPago === 'saldo'
            ? Number(saldoPendiente > 0 ? saldoPendiente : estadoPago === 'saldo' ? montoMensual : 0)
            : 0,
        metodo_pago: metodoPago,
        monto_mensual: Number(montoMensual),
        foto_url: fotoUrl.trim(),
        notas: notas.trim(),
      });

      // 2. Alerta de confirmación tras el registro exitoso
      if (!member) {
        alert(
          accesoApp
            ? 'Socio registrado. Ya puede ingresar con su DNI: en el primer ingreso elige su contraseña.'
            : 'Socio registrado. Podés darle su carnet desde el detalle del socio.'
        );
      }

      onClose();
    } catch (err: any) {
      console.error(err);
      setFormError('Error al guardar socio: ' + (err.message || 'Error desconocido'));
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!member) return;
    setIsDeleting(true);
    setFormError(null);
    try {
      if (onDelete) {
        await onDelete(member.id);
      } else {
        await deleteMember(member.id);
      }
      onClose();
    } catch (err: any) {
      console.error('Error al eliminar socio:', err);
      setFormError('No se pudo eliminar al socio. Por favor reintentá.');
    } finally {
      setIsDeleting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <Drawer
        open={isOpen}
        onClose={onClose}
        title={member ? 'Editar socio' : 'Nuevo socio'}
        subtitle="Datos del carnet"
        footer={
          <div className="space-y-2">
            <Button
              type="submit"
              variant="primary"
              size="lg"
              loading={loading}
              disabled={loading || isDeleting}
              className="w-full"
              form="member-form"
            >
              {member ? 'Guardar cambios' : 'Crear socio'}
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="md"
              disabled={loading || isDeleting}
              onClick={onClose}
              className="w-full"
            >
              Cancelar
            </Button>
          </div>
        }
      >
        <form id="member-form" onSubmit={handleSubmit} className="space-y-5">
          {formError && (
            <div className="bg-status-danger-soft border border-status-danger-border text-status-danger rounded-xl p-3 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          {/* Bloque "Foto del socio" con avatar 72px y Button secondary "Tomar con la cámara o subir" */}
          <div className="bg-surface-100 border border-border-subtle rounded-2xl p-4 space-y-3">
            <span className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-text-muted block">
              Foto del socio
            </span>
            <div className="flex items-center gap-4">
              <MemberAvatar
                src={fotoUrl}
                name={name || 'Nuevo socio'}
                className="w-[72px] h-[72px] text-2xl shrink-0"
              />
              <div className="space-y-2 min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    icon={Camera}
                    disabled={isProcessingPhoto}
                    onClick={() => setIsCameraOpen(true)}
                  >
                    Tomar con la cámara o subir
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    icon={Upload}
                    disabled={isProcessingPhoto}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    Subir
                  </Button>
                  {fotoUrl && (
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => setFotoUrl('')}
                      className="text-status-danger hover:bg-status-danger-soft"
                    >
                      Quitar
                    </Button>
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  disabled={isProcessingPhoto}
                  className="hidden"
                />
                <p className="text-[11px] text-text-muted">
                  Formato cuadrado 1:1 optimizado para el carnet digital.
                </p>
              </div>
            </div>
          </div>

          {/* Campos en grilla de 2 columnas en desktop */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <Field label="Nombre Completo" className="sm:col-span-2">
              <Input
                variant="admin"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ej. Marcos Maidana"
              />
            </Field>

            <Field label="DNI" hint={member ? 'Es el usuario del socio, no se puede cambiar' : undefined}>
              <Input
                variant="admin"
                mono
                required
                inputMode="numeric"
                value={dni}
                onChange={(e) => setDni(e.target.value)}
                placeholder="40123456"
                disabled={Boolean(member)}
              />
            </Field>

            <Field label="Teléfono / WhatsApp" hint="Opcional">
              <Input
                variant="admin"
                mono
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
                placeholder="+54 9 11 1234 5678"
              />
            </Field>

            <Field label="Fecha de nacimiento">
              <Input
                variant="admin"
                type="date"
                value={fechaNacimiento}
                onChange={(e) => setFechaNacimiento(e.target.value)}
              />
            </Field>

            <Field label="Disciplina">
              <div className="relative">
                <select
                  value={disciplina}
                  onChange={(e) => handleDisciplineChange(e.target.value)}
                  className="w-full h-11 bg-surface-sunken border border-border-default rounded-xl px-3.5 text-sm text-text-primary focus:border-accent focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent appearance-none cursor-pointer transition-colors"
                >
                  {disciplines.map((d) => (
                    <option key={d.id} value={d.nombre} className="bg-surface-100 text-text-primary">
                      {d.nombre} (${d.precio.toLocaleString('es-AR')})
                    </option>
                  ))}
                </select>
                <div className="absolute inset-y-0 right-0 flex items-center pr-3.5 pointer-events-none text-text-muted text-xs">
                  ▼
                </div>
              </div>
            </Field>

            <Field label="Cuota mensual ($)">
              <Input
                variant="admin"
                type="number"
                min="0"
                step="500"
                value={montoMensual}
                onChange={(e) => setMontoMensual(Number(e.target.value) || 0)}
              />
            </Field>

            <Field label="Fecha de ingreso">
              <Input
                variant="admin"
                type="date"
                value={fechaIngreso}
                onChange={(e) => handleIngresoChange(e.target.value)}
              />
            </Field>

            <Field label="Vencimiento inicial">
              <Input
                variant="admin"
                type="date"
                value={fechaVencimiento}
                onChange={(e) => setFechaVencimiento(e.target.value)}
              />
            </Field>

            <Field label="Método de pago">
              <div className="relative">
                <select
                  value={metodoPago}
                  onChange={(e) => setMetodoPago(e.target.value as PaymentMethod)}
                  disabled={estadoPago === 'saldo' || estadoPago === 'pendiente'}
                  className="w-full h-11 bg-surface-sunken border border-border-default rounded-xl px-3.5 text-sm text-text-primary focus:border-accent focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent appearance-none cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {PAYMENT_METHODS.map((method) => (
                    <option key={method} value={method} className="bg-surface-100 text-text-primary">
                      {method}
                    </option>
                  ))}
                </select>
                <div className="absolute inset-y-0 right-0 flex items-center pr-3.5 pointer-events-none text-text-muted text-xs">
                  ▼
                </div>
              </div>
            </Field>
          </div>

          {/* Estado de pago inicial */}
          <div className="bg-surface-sunken border border-border-default rounded-xl p-3.5 space-y-2.5">
            <span className="text-xs font-bold text-text-secondary block">
              Estado de pago inicial
            </span>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setEstadoPago('pagado')}
                className={`py-2 px-2 rounded-xl text-xs font-bold border transition-all text-center cursor-pointer focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent ${
                  estadoPago === 'pagado'
                    ? 'border-accent bg-accent-soft text-accent'
                    : 'border-border-default bg-surface-100 text-text-secondary hover:text-text-primary'
                }`}
              >
                Pagado
              </button>
              <button
                type="button"
                onClick={() => setEstadoPago('parcial')}
                className={`py-2 px-2 rounded-xl text-xs font-bold border transition-all text-center cursor-pointer focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent ${
                  estadoPago === 'parcial'
                    ? 'border-status-warn bg-status-warn-soft text-status-warn'
                    : 'border-border-default bg-surface-100 text-text-secondary hover:text-text-primary'
                }`}
              >
                Parcial
              </button>
              <button
                type="button"
                onClick={() => {
                  setEstadoPago('saldo');
                  if (!saldoPendiente) setSaldoPendiente(montoMensual);
                }}
                className={`py-2 px-2 rounded-xl text-xs font-bold border transition-all text-center cursor-pointer focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent ${
                  estadoPago === 'saldo' || estadoPago === 'pendiente'
                    ? 'border-status-danger bg-status-danger-soft text-status-danger'
                    : 'border-border-default bg-surface-100 text-text-secondary hover:text-text-primary'
                }`}
              >
                Saldo
              </button>
            </div>

            {(estadoPago === 'parcial' || estadoPago === 'saldo') && (
              <div className="pt-2 border-t border-border-subtle flex items-center justify-between gap-3">
                <span className="text-xs text-status-warn font-semibold">
                  Saldo pendiente ($):
                </span>
                <div className="w-36">
                  <Input
                    variant="admin"
                    type="number"
                    min="0"
                    step="100"
                    value={saldoPendiente}
                    onChange={(e) => setSaldoPendiente(Number(e.target.value) || 0)}
                    className="h-9 text-xs text-right"
                    placeholder={String(montoMensual)}
                  />
                </div>
              </div>
            )}
          </div>

          {!member && (
            <label className="flex items-start gap-3 bg-surface-sunken border border-border-default rounded-xl p-3.5 cursor-pointer">
              <input
                type="checkbox"
                checked={accesoApp}
                onChange={(e) => setAccesoApp(e.target.checked)}
                className="mt-0.5 w-4 h-4 accent-accent"
              />
              <span className="space-y-0.5">
                <span className="text-xs font-bold text-text-secondary block">Permitir acceso a la app</span>
                <span className="text-[11px] text-text-muted block">
                  El socio ingresa con su DNI y elige su contraseña la primera vez. Si no lo marcás, solo tiene el carnet que le des.
                </span>
              </span>
            </label>
          )}

          {/* Notas */}
          <Field label="Notas u observaciones" hint="Opcional">
            <Input
              variant="admin"
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              placeholder="Objetivos, apto médico, lesiones previas..."
            />
          </Field>

          {/* Eliminar: Button danger con confirmación dentro del Drawer, sin confirm() */}
          {member && (
            <div className="pt-4 border-t border-border-subtle">
              {showDeleteConfirm ? (
                <div className="bg-status-danger-soft border border-status-danger-border rounded-xl p-3.5 space-y-2.5">
                  <p className="text-xs font-semibold text-status-danger">
                    ¿Confirmás que querés eliminar a este socio? Esta acción es definitiva.
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="danger"
                      size="md"
                      loading={isDeleting}
                      onClick={handleDelete}
                    >
                      Confirmar eliminación
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      size="md"
                      disabled={isDeleting}
                      onClick={() => setShowDeleteConfirm(false)}
                    >
                      Cancelar
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  type="button"
                  variant="danger"
                  size="md"
                  icon={Trash2}
                  onClick={() => setShowDeleteConfirm(true)}
                >
                  Eliminar socio
                </Button>
              )}
            </div>
          )}
        </form>
      </Drawer>

      {/* Modal de Cámara para Captura 1:1 */}
      <CameraCaptureModal
        isOpen={isCameraOpen}
        onClose={() => setIsCameraOpen(false)}
        onCapture={handleCameraCapture}
      />
    </>
  );
};
