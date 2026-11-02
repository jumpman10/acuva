import React, { useState, useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Member, AccessLog } from '../types';
import { getCalculatedStatus } from '../lib/dateUtils';
import { getMembershipTone, TONE_CLASSES, formatMoney } from '../lib/status';
import { playSuccessChime, playWarningBeep } from '../lib/sound';
import { Drawer, Button, Input, MemberAvatar } from './ui';
import { RefreshCw, ScanLine, AlertCircle } from 'lucide-react';

export interface QrScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  members: Member[];
  onLogAccess: (log: Omit<AccessLog, 'id' | 'timestamp'>) => Promise<void>;
  onRenewMember: (memberId: string) => Promise<void>;
}

export const QrScannerModal: React.FC<QrScannerModalProps> = ({
  isOpen,
  onClose,
  members,
  onLogAccess,
  onRenewMember: _onRenewMember,
}) => {
  const [scannedResult, setScannedResult] = useState<string | null>(null);
  const [matchedMember, setMatchedMember] = useState<Member | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [manualCode, setManualCode] = useState('');

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const containerId = 'acuva-qr-reader';

  const processQrToken = (rawText: string) => {
    setScannedResult(rawText);
    const cleaned = rawText.trim();

    const found = members.find(
      (m) =>
        m.codigo_qr.toUpperCase() === cleaned.toUpperCase() ||
        m.dni === cleaned ||
        cleaned.includes(m.dni) ||
        m.id === cleaned
    );

    if (found) {
      setMatchedMember(found);
      const status = getCalculatedStatus(found.fecha_vencimiento, found.estado_pago);
      const isAuthorized =
        status.membershipStatus !== 'vencido' &&
        (found.estado_pago === 'pagado' || found.estado_pago === 'parcial');

      if (isAuthorized) {
        playSuccessChime();
      } else {
        playWarningBeep();
      }

      const motivo = isAuthorized
        ? found.estado_pago === 'parcial'
          ? `Acceso Válido (Saldo pendiente: ${formatMoney(found.saldo_pendiente || 0)})`
          : 'Acceso Válido - Al Día'
        : found.estado_pago === 'pendiente' || found.estado_pago === 'saldo'
        ? 'Cuota impaga'
        : 'Membresía vencida';

      onLogAccess({
        member_id: found.id,
        dni: found.dni,
        member_name: `${found.nombre} ${found.apellido}`,
        disciplina: found.disciplina,
        autorizado: isAuthorized,
        motivo,
      });
    } else {
      setMatchedMember(null);
      playWarningBeep();
    }
  };

  useEffect(() => {
    let isMounted = true;

    if (isOpen && !scannedResult) {
      setCameraError(null);

      const startScanner = async () => {
        try {
          const html5QrCode = new Html5Qrcode(containerId);
          scannerRef.current = html5QrCode;

          const config = {
            fps: 10,
            qrbox: { width: 220, height: 220 },
            aspectRatio: 1.0,
          };

          await html5QrCode.start(
            { facingMode: 'environment' },
            config,
            (decodedText) => {
              if (isMounted) {
                html5QrCode
                  .stop()
                  .then(() => {
                    processQrToken(decodedText);
                  })
                  .catch(() => {
                    processQrToken(decodedText);
                  });
              }
            },
            () => {}
          );

          if (isMounted) {
            setIsScanning(true);
          }
        } catch {
          if (isMounted) {
            setCameraError(
              'Cámara no disponible o sin permisos. Podés ingresar el DNI manualmente debajo.'
            );
            setIsScanning(false);
          }
        }
      };

      const timer = setTimeout(() => {
        startScanner();
      }, 300);

      return () => {
        isMounted = false;
        clearTimeout(timer);
        if (scannerRef.current && scannerRef.current.isScanning) {
          scannerRef.current.stop().catch(() => {});
        }
      };
    }

    return () => {
      if (scannerRef.current && scannerRef.current.isScanning) {
        scannerRef.current.stop().catch(() => {});
      }
    };
  }, [isOpen, scannedResult]);

  const handleResetScan = () => {
    setScannedResult(null);
    setMatchedMember(null);
    setManualCode('');
  };

  const handleManualSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    processQrToken(manualCode.trim());
  };

  const handleClose = () => {
    if (scannerRef.current && scannerRef.current.isScanning) {
      scannerRef.current.stop().catch(() => {});
    }
    onClose();
  };

  if (!isOpen) return null;

  return (
    <Drawer
      open={isOpen}
      onClose={handleClose}
      title="Control de acceso"
      subtitle="Portería Acuva"
    >
      <div className="space-y-4">
        {/* STATE 1: SCANNING */}
        {!scannedResult && (
          <div className="space-y-4">
            {/* Vista de cámara (html5-qrcode) en caja rounded-[20px] con marco accent */}
            <div className="relative rounded-[20px] overflow-hidden bg-carnet-ground aspect-square max-w-[280px] mx-auto border-2 border-accent flex flex-col items-center justify-center">
              <div id={containerId} className="w-full h-full" />
              <div className="absolute inset-4 pointer-events-none border border-accent/40 rounded-xl flex items-center justify-center">
                <div className="w-10 h-0.5 bg-accent" />
              </div>
            </div>

            {/* Texto: Apuntá al QR del carnet del socio */}
            <p className="text-xs text-text-muted text-center font-medium">
              Apuntá al QR del carnet del socio
            </p>

            {cameraError && (
              <div className="bg-status-warn-soft border border-status-warn-border text-status-warn rounded-xl p-3 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{cameraError}</span>
              </div>
            )}

            {/* Fila de respaldo: Input admin mono "DNI o código de carnet" + Button primary "Validar" */}
            <form onSubmit={handleManualSearch} className="flex items-center gap-2 pt-2">
              <Input
                variant="admin"
                mono
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                placeholder="DNI o código de carnet"
                className="flex-1"
              />
              <Button type="submit" variant="primary">
                Validar
              </Button>
            </form>
          </div>
        )}

        {/* STATE 2: SCAN RESULT INSPECTION */}
        {scannedResult && (
          <div className="space-y-4">
            {matchedMember ? (
              (() => {
                const membership = getMembershipTone(matchedMember);
                const isAuthorized =
                  membership.status !== 'vencido' &&
                  (matchedMember.estado_pago === 'pagado' ||
                    matchedMember.estado_pago === 'parcial');

                const toneType: 'ok' | 'danger' = isAuthorized ? 'ok' : 'danger';
                const tone = TONE_CLASSES[toneType];

                // Motivo text
                let motivo = '';
                if (isAuthorized) {
                  if (
                    matchedMember.estado_pago === 'parcial' &&
                    (matchedMember.saldo_pendiente ?? 0) > 0
                  ) {
                    motivo = `Saldo pendiente ${formatMoney(matchedMember.saldo_pendiente ?? 0)}`;
                  } else {
                    motivo = 'Membresía al día';
                  }
                } else {
                  if (
                    matchedMember.estado_pago === 'pendiente' ||
                    matchedMember.estado_pago === 'saldo'
                  ) {
                    motivo = 'Cuota impaga';
                  } else {
                    motivo = 'Membresía vencida';
                  }
                }

                return (
                  <div className="space-y-4">
                    {/* Tarjeta grande con borde y fondo suave del tono, avatar, nombre, disciplina, "Autorizado" (ok) o "Denegado" (danger) con el motivo */}
                    <div
                      className={`p-5 rounded-[20px] border ${tone.bg} ${tone.border} space-y-4 select-none`}
                    >
                      <div className="flex items-center gap-3.5">
                        <MemberAvatar
                          src={matchedMember.foto_url}
                          name={`${matchedMember.nombre} ${matchedMember.apellido}`}
                          className="w-14 h-14 text-base shrink-0"
                        />
                        <div className="min-w-0 flex-1">
                          <h4 className="text-lg font-bold text-text-primary leading-tight truncate">
                            {matchedMember.nombre} {matchedMember.apellido}
                          </h4>
                          <p className="text-xs text-text-muted truncate mt-0.5 capitalize">
                            {matchedMember.disciplina} ·{' '}
                            <span className="font-mono text-text-secondary">
                              {matchedMember.dni}
                            </span>
                          </p>
                        </div>
                      </div>

                      <div className="pt-3 border-t border-border-subtle flex items-center justify-between">
                        <div>
                          <span
                            className={`text-2xl font-bold font-mono tracking-wide ${tone.text}`}
                          >
                            {isAuthorized ? 'Autorizado' : 'Denegado'}
                          </span>
                          <span className="text-xs text-text-muted block mt-0.5">
                            {motivo}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Button "Escanear siguiente" */}
                    <Button
                      variant="primary"
                      size="lg"
                      icon={ScanLine}
                      onClick={handleResetScan}
                      className="w-full"
                    >
                      Escanear siguiente
                    </Button>
                  </div>
                );
              })()
            ) : (
              /* Código inexistente: "Código no encontrado" con Button "Reintentar" */
              <div className="text-center py-8 space-y-4 bg-surface-100 rounded-[20px] border border-border-subtle p-5">
                <div className="text-lg font-bold text-text-primary font-mono">
                  Código no encontrado
                </div>
                <p className="text-xs text-text-muted font-mono break-all px-2">
                  "{scannedResult}"
                </p>
                <Button
                  variant="primary"
                  icon={RefreshCw}
                  onClick={handleResetScan}
                  className="mx-auto"
                >
                  Reintentar
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </Drawer>
  );
};
