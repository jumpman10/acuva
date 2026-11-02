import React, { useEffect, useState, useRef } from 'react';
import QRCode from 'qrcode';
import { toJpeg } from 'html-to-image';
import { Member } from '../types';
import { getCalculatedStatus, formatDisplayDate } from '../lib/dateUtils';
import isologo from '../assets/isologo.png';
import {
  Download,
  Share2,
  Calendar,
  Phone,
  Dumbbell,
  Check,
  AlertCircle,
  QrCode,
  User,
  Loader2,
} from 'lucide-react';

interface VirtualCardProps {
  member: Member;
  onClose?: () => void;
  showActions?: boolean;
}

export const VirtualCard: React.FC<VirtualCardProps> = ({ member, onClose, showActions = true }) => {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [isDownloading, setIsDownloading] = useState<boolean>(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const statusInfo = getCalculatedStatus(member.fecha_vencimiento, member.estado_pago);

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
    try {
      const exportOptions = {
        quality: 0.95,
        pixelRatio: 2,
        backgroundColor: '#0f172a',
        cacheBust: true,
        filter: (node: Node) => {
          if (node instanceof Element && node.getAttribute('data-export-hide') === 'true') {
            return false;
          }
          return true;
        },
      };

      let dataUrl: string;
      try {
        dataUrl = await toJpeg(cardRef.current, exportOptions);
      } catch (err) {
        console.warn('Reintentando captura con skipFonts:', err);
        dataUrl = await toJpeg(cardRef.current, {
          ...exportOptions,
          skipFonts: true,
        });
      }

      const cleanLastName = (member.apellido || 'Socio')
        .trim()
        .replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ_-]/g, '_');
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
      alert('Hubo un inconveniente al generar la imagen del carnet. Por favor intentá nuevamente.');
    } finally {
      setIsDownloading(false);
    }
  };

  const handleShare = async () => {
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
      navigator.clipboard.writeText(`Acuva: ${member.nombre} ${member.apellido} (DNI: ${member.dni})`);
      alert('Información del carnet copiada al portapapeles');
    }
  };

  const daysTotal = 30;
  const daysLeft = Math.max(0, Math.min(statusInfo.daysRemaining, daysTotal));
  const progressPercent = Math.min(100, Math.max(5, (daysLeft / daysTotal) * 100));

  return (
    <div className="flex flex-col items-center w-full max-w-sm mx-auto">
      {/* Physical Virtual Card UI - Black & White Minimalist Design */}
      <div
        ref={cardRef}
        className="w-full bg-[#0f172a] rounded-2xl p-4 sm:p-5 border border-[#34d399]/40 shadow-2xl relative overflow-hidden text-white"
      >
        {/* Top Header */}
        <div className="flex items-center justify-between border-b border-[#34d399]/30 pb-3 mb-4">
          <div className="flex items-center gap-2.5">
            <img
              src={isologo}
              alt="Acuva"
              className="w-8 h-8 rounded-lg object-contain shrink-0"
            />
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-black text-sm tracking-widest text-white uppercase">Acuva</span>
                <span className="text-[9px] font-mono uppercase px-1.5 py-0.5 rounded bg-[#0f172a] text-white border border-[#34d399]/40">
                  PASS
                </span>
              </div>
              <p className="text-[10px] text-slate-300 tracking-wider uppercase">Socio Digital</p>
            </div>
          </div>

          {/* Status Badge */}
          <div data-export-hide="true" className="flex items-center">
            {statusInfo.membershipStatus === 'activo' ? (
              <span className="px-2.5 py-1 rounded-md text-[11px] font-bold bg-[#34d399] text-[#0f172a] border border-[#34d399] flex items-center gap-1">
                <Check className="w-3 h-3 stroke-[3]" />
                AL DÍA
              </span>
            ) : statusInfo.membershipStatus === 'por_vencer' ? (
              <span className="px-2.5 py-1 rounded-md text-[11px] font-bold bg-[#0f172a] text-amber-300 border border-amber-500/40 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                POR VENCER
              </span>
            ) : (
              <span className="px-2.5 py-1 rounded-md text-[11px] font-bold bg-[#0f172a] text-red-400 border border-red-500/40 line-through">
                VENCIDO
              </span>
            )}
          </div>
        </div>

        {/* Member Profile Row */}
        <div className="flex items-center gap-3.5 mb-4">
          {member.foto_url ? (
            <img
              src={member.foto_url}
              alt={`${member.nombre} ${member.apellido}`}
              className="w-16 h-16 rounded-xl object-cover border border-[#34d399]/40 bg-[#0f172a] shrink-0 transition-all"
              crossOrigin="anonymous"
            />
          ) : (
            <div className="w-16 h-16 rounded-xl border border-dashed border-[#34d399]/40 bg-[#0f172a] flex flex-col items-center justify-center text-white/50 shrink-0">
              <User className="w-6 h-6 stroke-[1.5] text-white/40 mb-0.5" />
              <span className="text-[8px] font-mono tracking-tighter uppercase text-slate-300">
                Sin foto
              </span>
            </div>
          )}

          <div className="flex-1 min-w-0">
            <h4 className="text-base sm:text-lg font-black text-white truncate leading-tight tracking-tight">
              {member.nombre} {member.apellido}
            </h4>
            <p className="text-xs text-slate-300 font-mono mt-0.5">DNI: {member.dni}</p>

            <div className="mt-1.5 flex items-center">
              <span className="inline-flex items-center gap-1 text-[11px] font-medium bg-[#0f172a] text-white px-2 py-0.5 rounded border border-[#34d399]/40">
                <Dumbbell className="w-3 h-3 text-[#34d399]" />
                {member.disciplina}
              </span>
            </div>
          </div>
        </div>

        {/* QR Code Container - Pure High Contrast */}
        <div className="bg-white rounded-xl p-3 flex flex-col items-center justify-center my-3">
          {qrDataUrl ? (
            <img src={qrDataUrl} alt="QR Membresía" className="w-44 h-44 object-contain" />
          ) : (
            <div className="w-44 h-44 flex items-center justify-center text-black">
              <QrCode className="w-10 h-10 animate-spin" />
            </div>
          )}
          <div className="text-[10px] font-mono font-bold text-black tracking-wider text-center mt-1">
            {member.codigo_qr}
          </div>
          <div className="text-[9px] text-neutral-600 uppercase tracking-widest text-center mt-0.5">
            Escanear en portería
          </div>
        </div>

        {/* Days Remaining Counter */}
        <div data-export-hide="true" className="bg-[#0f172a] rounded-xl p-3 border border-[#34d399]/40 mb-3">
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="text-slate-300 font-medium">Días restantes:</span>
            <span
              className={`font-black text-sm font-mono ${statusInfo.daysRemaining <= 2
                ? statusInfo.daysRemaining < 0
                  ? 'text-red-400'
                  : 'text-amber-300 underline decoration-amber-300 decoration-2'
                : 'text-[#34d399]'
                }`}
            >
              {statusInfo.daysRemaining < 0
                ? `${Math.abs(statusInfo.daysRemaining)} DÍAS VENCIDO`
                : `${statusInfo.daysRemaining} DÍAS`}
            </span>
          </div>

          {/* Progress bar */}
          <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden border border-[#34d399]/30">
            <div
              className="h-full bg-[#34d399] transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-300 mt-2.5 pt-2 border-t border-[#34d399]/20">
            <div className="flex items-center gap-1">
              <Calendar className="w-3 h-3 text-[#34d399]" />
              <span>Alta: {formatDisplayDate(member.fecha_ingreso)}</span>
            </div>
            <div className="flex items-center gap-1 font-semibold text-white">
              <span>Vence: {formatDisplayDate(member.fecha_vencimiento)}</span>
            </div>
          </div>
        </div>

        {/* Card Footer Info */}
        <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-[#34d399]/20">
          <span className="flex items-center gap-1 font-mono">
            <Phone className="w-3 h-3 text-[#34d399]" /> {member.telefono}
          </span>
          {member.fecha_nacimiento && (
            <span className="font-mono text-[9px] text-slate-400">
              Nac: {formatDisplayDate(member.fecha_nacimiento)}
            </span>
          )}
          <span className="font-mono text-[9px] uppercase">ID: {member.id.slice(0, 8)}</span>
        </div>
      </div>

      {/* Action Buttons - Mobile friendly */}
      {showActions && (
        <div className="flex items-center gap-2 mt-3 w-full justify-center no-print">
          <button
            onClick={handleDownload}
            disabled={!qrDataUrl || isDownloading}
            className="flex-1 py-2.5 px-3 bg-[#34d399] hover:bg-[#34d399]/90 active:scale-95 disabled:opacity-50 disabled:pointer-events-none text-[#0f172a] text-xs font-black rounded-xl border border-[#34d399] shadow-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer"
          >
            {isDownloading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Generando JPG...</span>
              </>
            ) : (
              <>
                <Download className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>Descargar Carnet (JPG)</span>
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
};
