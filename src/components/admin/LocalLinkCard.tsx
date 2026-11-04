import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Check, Copy, Download, ExternalLink, Pencil, QrCode as QrIcon } from 'lucide-react';
import type { Local } from '../../types';
import { updateLocalSlug, authErrorMessage, isLocalFull } from '../../lib/authService';
import { isReservedSlug, isValidSlugFormat, localDisplayUrl, localUrl, slugify } from '../../lib/routes';
import { Alert, Button, Drawer, Field, Input } from '../ui';

export interface LocalLinkCardProps {
  local: Local;
  onLocalUpdated: (local: Local) => void;
}

/** Lee un token de color de @theme (canvas y qrcode no entienden clases; qrcode exige hex). */
function themeColor(token: string, fallback: string): string {
  if (typeof window === 'undefined') return fallback;
  const value = getComputedStyle(document.documentElement).getPropertyValue(`--color-${token}`).trim();
  return value || fallback;
}

const qrColors = () => ({
  dark: themeColor('ink-on-accent', '#000'),
  light: themeColor('qr-paper', '#fff'),
});

/** Arma un PNG imprimible: nombre del local, QR y link. */
async function buildPosterPng(name: string, slug: string): Promise<string> {
  const width = 1080;
  const height = 1400;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas no disponible');

  const colors = qrColors();
  ctx.fillStyle = colors.light;
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = colors.dark;
  ctx.textAlign = 'center';
  ctx.font = '800 64px "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.fillText(name, width / 2, 150, width - 120);

  ctx.font = '600 38px "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.fillText('Escaneá para ver tu carnet de socio', width / 2, 225, width - 120);

  const qrUrl = await QRCode.toDataURL(localUrl(slug), {
    width: 820,
    margin: 1,
    errorCorrectionLevel: 'M',
    color: colors,
  });
  const img = new Image();
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error('No se pudo generar el QR'));
    img.src = qrUrl;
  });
  ctx.drawImage(img, (width - 820) / 2, 300, 820, 820);

  ctx.font = '700 44px ui-monospace, Menlo, Consolas, monospace';
  ctx.fillText(localDisplayUrl(slug), width / 2, 1215, width - 120);

  ctx.font = '600 30px "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.globalAlpha = 0.6;
  ctx.fillText('Acuva · Carnets QR', width / 2, 1320);
  ctx.globalAlpha = 1;

  return canvas.toDataURL('image/png');
}

/**
 * Link y QR del local para que sus socios ingresen (acuva.com.ar/{slug}),
 * con el cupo de socios vinculados.
 */
export const LocalLinkCard: React.FC<LocalLinkCardProps> = ({ local, onLocalUpdated }) => {
  const [copied, setCopied] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const [isEditing, setIsEditing] = useState(false);
  const [slugDraft, setSlugDraft] = useState(local.slug || '');
  const [savingSlug, setSavingSlug] = useState(false);
  const [slugError, setSlugError] = useState<string | null>(null);

  const slug = local.slug;
  const linked = local.linked_members_count ?? 0;
  const max = local.max_members ?? 0;
  const ratio = max > 0 ? Math.min(1, linked / max) : 1;
  const full = isLocalFull(local);
  const nearFull = !full && ratio >= 0.9;

  const meterTone = full ? 'bg-status-danger' : nearFull ? 'bg-status-warn' : 'bg-accent';
  const countTone = full ? 'text-status-danger' : nearFull ? 'text-status-warn' : 'text-text-primary';

  useEffect(() => {
    setSlugDraft(local.slug || '');
  }, [local.slug]);

  useEffect(() => {
    if (!isDrawerOpen || !slug) return;
    QRCode.toDataURL(localUrl(slug), {
      width: 480,
      margin: 1,
      errorCorrectionLevel: 'M',
      color: qrColors(),
    })
      .then(setQrDataUrl)
      .catch((err) => console.error('Error generating local QR:', err));
  }, [isDrawerOpen, slug]);

  if (!slug) {
    return (
      <div className="mb-4 bg-status-warn-soft border border-status-warn-border text-status-warn rounded-2xl px-4 py-3 text-sm font-medium">
        Tu gimnasio todavía no tiene link para socios. Corré la migración de Supabase
        (01_locales_slug_y_vinculos.sql) y recargá la página.
      </div>
    );
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(localUrl(slug));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      window.prompt('Copiá el link para tus socios:', localUrl(slug));
    }
  };

  const handleDownload = async () => {
    setDownloading(true);
    setDownloadError(null);
    try {
      const png = await buildPosterPng(local.name, slug);
      const a = document.createElement('a');
      a.href = png;
      a.download = `qr-${slug}.png`;
      a.click();
    } catch (err) {
      setDownloadError(authErrorMessage(err, 'No se pudo descargar el QR. Probá de nuevo.'));
    } finally {
      setDownloading(false);
    }
  };

  const handleSaveSlug = async (e: React.FormEvent) => {
    e.preventDefault();
    setSlugError(null);
    const candidate = slugify(slugDraft);

    if (!isValidSlugFormat(candidate)) {
      setSlugError('El link tiene que tener entre 3 y 40 caracteres: letras, números y guiones.');
      return;
    }
    if (isReservedSlug(candidate)) {
      setSlugError('Ese link está reservado por Acuva. Probá con otro.');
      return;
    }
    if (candidate === slug) {
      setIsEditing(false);
      return;
    }

    setSavingSlug(true);
    try {
      const saved = await updateLocalSlug(candidate);
      onLocalUpdated({ ...local, slug: saved });
      setIsEditing(false);
    } catch (err) {
      setSlugError(authErrorMessage(err, 'No pudimos guardar el link.'));
    } finally {
      setSavingSlug(false);
    }
  };

  return (
    <>
      <section
        aria-label="Link para tus socios"
        className="mb-4 bg-surface-100 border border-border-subtle rounded-[20px] p-4 flex flex-col md:flex-row md:items-center gap-4"
      >
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="w-10 h-10 rounded-xl bg-accent-soft border border-accent-border text-accent flex items-center justify-center shrink-0">
            <QrIcon className="w-5 h-5" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-text-muted">
              Link para tus socios
            </p>
            <a
              href={localUrl(slug)}
              target="_blank"
              rel="noreferrer"
              className="text-[13px] font-mono font-semibold tracking-[0.04em] text-text-primary hover:text-accent truncate block focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent rounded"
            >
              {localDisplayUrl(slug)}
            </a>
          </div>
        </div>

        <div className="md:w-[180px] shrink-0">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-xs text-text-muted">Socios vinculados</span>
            <span className={`text-[13px] font-bold font-mono ${countTone}`}>
              {linked}/{max}
            </span>
          </div>
          <div
            className="mt-1.5 h-1.5 rounded-full bg-surface-200 overflow-hidden"
            role="meter"
            aria-label="Cupo de socios"
            aria-valuemin={0}
            aria-valuemax={max}
            aria-valuenow={linked}
          >
            <div className={`h-full rounded-full ${meterTone}`} style={{ width: `${ratio * 100}%` }} />
          </div>
          {full && <p className="mt-1 text-xs text-status-danger">Cupo lleno: no se pueden sumar socios.</p>}
        </div>

        <div className="flex gap-2 shrink-0">
          <Button variant="secondary" icon={copied ? Check : Copy} onClick={handleCopy} className="flex-1 md:flex-none">
            {copied ? 'Copiado' : 'Copiar'}
          </Button>
          <Button variant="secondary" icon={QrIcon} onClick={() => setIsDrawerOpen(true)} className="flex-1 md:flex-none">
            Ver QR
          </Button>
        </div>
      </section>

      <Drawer
        open={isDrawerOpen}
        onClose={() => {
          setIsDrawerOpen(false);
          setIsEditing(false);
          setSlugError(null);
        }}
        title="QR para tus socios"
        subtitle="Imprimilo y pegalo en la recepción"
        footer={
          <Button
            variant="primary"
            size="lg"
            icon={Download}
            loading={downloading}
            onClick={handleDownload}
            className="w-full"
          >
            Descargar QR para imprimir
          </Button>
        }
      >
        <div className="space-y-5">
          {downloadError && <Alert>{downloadError}</Alert>}

          <div className="bg-carnet-ground border border-border-default rounded-2xl p-5 flex flex-col items-center gap-4">
            <p className="text-base font-bold text-text-primary text-center">{local.name}</p>
            <div className="bg-qr-paper rounded-2xl p-3 w-full max-w-[260px] aspect-square flex items-center justify-center">
              {qrDataUrl ? (
                <img src={qrDataUrl} alt={`Código QR de ${localDisplayUrl(slug)}`} className="w-full h-full" />
              ) : (
                <span className="text-xs text-ink-on-accent">Generando QR...</span>
              )}
            </div>
            <p className="text-[13px] font-mono font-semibold tracking-[0.04em] text-text-secondary text-center break-all">
              {localDisplayUrl(slug)}
            </p>
          </div>

          <p className="text-[13px] text-text-muted leading-relaxed">
            Tus socios escanean este QR, ingresan con su DNI o crean su cuenta, y quedan vinculados a
            tu gimnasio mientras haya cupo ({linked}/{max}).
          </p>

          <div className="flex gap-2">
            <Button variant="secondary" icon={copied ? Check : Copy} onClick={handleCopy} className="flex-1">
              {copied ? 'Copiado' : 'Copiar link'}
            </Button>
            <Button
              variant="secondary"
              icon={ExternalLink}
              onClick={() => window.open(localUrl(slug), '_blank', 'noopener')}
              className="flex-1"
            >
              Abrir
            </Button>
          </div>

          <div className="border-t border-border-subtle pt-4">
            {isEditing ? (
              <form onSubmit={handleSaveSlug} className="space-y-3">
                {slugError && <Alert>{slugError}</Alert>}
                <Field
                  label="Tu link"
                  hint={`${window.location.host}/…`}
                  htmlFor="local-slug"
                >
                  <Input
                    id="local-slug"
                    mono
                    autoCapitalize="none"
                    spellCheck={false}
                    value={slugDraft}
                    onChange={(e) => setSlugDraft(e.target.value)}
                    disabled={savingSlug}
                    maxLength={40}
                  />
                </Field>
                <p className="text-xs text-text-muted">
                  Si lo cambiás, el QR que ya imprimiste deja de funcionar.
                </p>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      setIsEditing(false);
                      setSlugDraft(slug);
                      setSlugError(null);
                    }}
                    disabled={savingSlug}
                    className="flex-1"
                  >
                    Cancelar
                  </Button>
                  <Button type="submit" variant="secondary" loading={savingSlug} className="flex-1">
                    Guardar link
                  </Button>
                </div>
              </form>
            ) : (
              <Button variant="ghost" icon={Pencil} onClick={() => setIsEditing(true)} className="w-full">
                Cambiar el link
              </Button>
            )}
          </div>
        </div>
      </Drawer>
    </>
  );
};
