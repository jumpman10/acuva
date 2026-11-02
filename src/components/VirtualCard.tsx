import React, { useEffect, useState, useRef } from 'react';
import QRCode from 'qrcode';
import { toJpeg } from 'html-to-image';
import { Download, Share2, Loader2 } from 'lucide-react';
import { Member } from '../types';
import { getMembershipTone, TONE_CLASSES, formatDate } from '../lib/status';
import { Button, MemberAvatar } from './ui';
import magoLogo from '../assets/mago-logo.png';

interface VirtualCardProps {
  member: Member;
  onClose?: () => void;
  showActions?: boolean;
}

export const VirtualCard: React.FC<VirtualCardProps> = ({
  member,
  onClose: _onClose,
  showActions = true,
}) => {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [isDownloading, setIsDownloading] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  const cardRef = useRef<HTMLDivElement>(null);

  const t = getMembershipTone(member);
  const tone = TONE_CLASSES[t.tone];
  const toneBorder = tone.borderSolid;
  const toneBgSolid = tone.solid;
  const toneBorderSoft = tone.border;

  const isVencido = t.status === 'vencido';
  const daysCount = isVencido ? 0 : Math.max(0, t.days);
  const daysUnit = daysCount === 1 ? 'día' : 'días';

  useEffect(() => {
    QRCode.toDataURL(member.codigo_qr, {
      width: 320,
      margin: 1,
      color: {
        dark: '#000000',
        light: '#ffffff',
      },
    })
      .then((url) => setQrDataUrl(url))
      .catch((err) => console.error('Error generating QR:', err));
  }, [member.codigo_qr]);

  const handleDownload = async () => {
    if (!cardRef.current || isDownloading) return;

    setIsDownloading(true);
    setFeedback(null);
    try {
      const isFileProtocol =
        typeof window !== 'undefined' && window.location.protocol === 'file:';
      const exportOptions = {
        quality: 0.95,
        pixelRatio: 2,
        backgroundColor: '#0b111e',
        cacheBust: !isFileProtocol,
      };

      let dataUrl: string;
      try {
        dataUrl = await toJpeg(cardRef.current, exportOptions);
      } catch (err) {
        console.warn('Reintentando captura con skipFonts:', err);
        dataUrl = await toJpeg(cardRef.current, {
          ...exportOptions,
          skipFonts: true,
          cacheBust: false,
        });
      }

      const cleanLastName = (member.apellido || 'Socio')
        .trim()
        .replace(/\s+/g, '_');
      const cleanDni = (member.dni || member.id.slice(0, 8)).trim();
      const fileName = `Carnet_${cleanLastName}_${cleanDni}.jpg`;

      const link = document.createElement('a');
      link.download = fileName;
      link.href = dataUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Error al generar el carnet en JPG:', error);
      setFeedback({
        type: 'error',
        message:
          'Hubo un inconveniente al generar la imagen del carnet. Por favor intentá nuevamente.',
      });
    } finally {
      setIsDownloading(false);
    }
  };

  const handleShare = async () => {
    setFeedback(null);
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Carnet Acuva - ${member.nombre} ${member.apellido}`,
          text: `Carnet Acuva | Socio: ${member.nombre} ${member.apellido} | DNI: ${member.dni} | Disciplina: ${member.disciplina}`,
          url: window.location.href,
        });
      } catch (e) {
        console.debug('Share dismissed');
      }
    } else {
      try {
        await navigator.clipboard.writeText(
          `Acuva: ${member.nombre} ${member.apellido} (DNI: ${member.dni})`
        );
        setFeedback({
          type: 'success',
          message: 'Información del carnet copiada al portapapeles.',
        });
      } catch {
        setFeedback({
          type: 'error',
          message: 'No se pudo copiar la información al portapapeles.',
        });
      }
    }
  };

  return (
    <div className="flex flex-col items-center w-full max-w-[400px] mx-auto">
      {/* Contenedor carnet */}
      <div
        ref={cardRef}
        className="w-full max-w-[400px] bg-carnet-ground rounded-card pt-[22px] pb-[18px] flex flex-col gap-4 overflow-hidden text-text-primary"
      >
        {/* 1. Header */}
        <div className="px-[22px] flex items-center justify-between gap-3">
          <img
            src={magoLogo}
            alt="Acuva"
            className="h-5 w-auto object-contain shrink-0"
          />
          <span className="text-xs font-bold uppercase tracking-[0.12em] text-text-secondary truncate text-right">
            Socio · {member.disciplina}
          </span>
        </div>

        {/* 2. Panel */}
        <div
          className={`bg-carnet-panel rounded-panel border-y-2 border-x-0 ${toneBorder} pt-6 pb-[26px] flex flex-col gap-[22px]`}
        >
          {/* 3. Socio */}
          <div className="px-[22px] flex items-center gap-3.5">
            <MemberAvatar
              src={member.foto_url}
              name={`${member.nombre} ${member.apellido}`}
              shape="square"
              className="w-[60px] h-[60px]"
            />
            <div className="flex-1 min-w-0">
              <h3 className="text-2xl font-bold leading-tight tracking-[-0.01em] text-text-primary truncate">
                {member.nombre} {member.apellido}
              </h3>
              <div className="flex justify-between items-center font-mono text-xs text-text-secondary mt-1">
                <span>DNI {member.dni}</span>
                <span>{member.telefono}</span>
              </div>
            </div>
          </div>

          {/* 4. Caja del QR */}
          <div
            className={`mr-[26px] bg-carnet-ground border-t-[1.5px] border-r-[1.5px] ${toneBorder} border-b-[1.5px] ${toneBorderSoft} border-l-0 rounded-r-[32px] py-[22px] pl-[22px] pr-6 flex flex-col items-center justify-center`}
          >
            <div className="bg-qr-paper rounded-[20px] p-4 pb-3 flex flex-col items-center">
              {qrDataUrl ? (
                <img
                  src={qrDataUrl}
                  alt={`QR ${member.codigo_qr}`}
                  className="w-[190px] h-[190px] object-contain"
                />
              ) : (
                <div className="w-[190px] h-[190px] flex items-center justify-center text-ink-on-accent">
                  <Loader2 className="w-8 h-8 animate-spin" />
                </div>
              )}
              <span className="font-mono text-xs font-bold text-ink-on-accent tracking-[0.06em] mt-2 text-center">
                {member.codigo_qr}
              </span>
            </div>
          </div>

          {/* 5. Barra de estado */}
          <div
            className={`mr-[26px] h-[68px] ${toneBgSolid} rounded-r-[20px] flex items-center justify-center`}
          >
            <span className="text-[38px] font-bold text-ink-on-accent leading-none select-none">
              {t.label}
            </span>
          </div>

          {/* 6. Fechas */}
          <div className="grid grid-cols-3 px-[22px] pt-3 text-xs items-start">
            <div className="flex flex-col">
              <span className="text-text-muted">Alta</span>
              <span className="font-semibold text-text-primary mt-0.5">
                {formatDate(member.fecha_ingreso)}
              </span>
            </div>
            <div className="flex justify-center">
              <div
                className={`w-[112px] h-[112px] rounded-full bg-carnet-ground border-[1.5px] ${toneBorder} mt-3.5 flex flex-col items-center justify-center`}
              >
                <span className="text-4xl font-bold text-text-primary leading-none">
                  {daysCount}
                </span>
                <span className="text-[15px] font-semibold text-text-secondary leading-none mt-1">
                  {daysUnit}
                </span>
              </div>
            </div>
            <div className="flex flex-col text-right items-end">
              <span className="text-text-muted">Vence</span>
              <span className="font-semibold text-text-primary mt-0.5">
                {formatDate(member.fecha_vencimiento)}
              </span>
            </div>
          </div>
        </div>

        {/* 7. Pie */}
        <p className="text-[11px] uppercase tracking-[0.14em] text-text-faint text-center">
          Mostrá este QR en portería
        </p>
      </div>

      {/* Acciones */}
      {showActions && (
        <div className="flex items-center gap-2 mt-4 w-full max-w-[400px] justify-center no-print">
          <Button
            variant="primary"
            size="lg"
            icon={Download}
            loading={isDownloading}
            disabled={!qrDataUrl || isDownloading}
            onClick={handleDownload}
            className="flex-1"
          >
            {isDownloading ? 'Generando JPG…' : 'Descargar carnet'}
          </Button>
          <Button
            variant="secondary"
            iconOnly
            icon={Share2}
            aria-label="Compartir carnet"
            onClick={handleShare}
            className="h-[52px] w-[52px] min-h-[52px] min-w-[52px] rounded-[14px] shrink-0"
          />
        </div>
      )}

      {/* Mensaje inline */}
      {feedback && (
        <div
          role="status"
          className={`w-full max-w-[400px] mt-3 p-3 rounded-xl text-xs font-semibold text-center border ${
            feedback.type === 'error'
              ? 'bg-status-danger-soft text-status-danger border-status-danger-border'
              : 'bg-status-ok-soft text-status-ok border-status-ok-border'
          }`}
        >
          {feedback.message}
        </div>
      )}
    </div>
  );
};
