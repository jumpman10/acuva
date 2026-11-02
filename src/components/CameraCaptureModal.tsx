import React, { useState, useRef, useEffect } from 'react';
import { Camera, X, RefreshCw, Check, AlertCircle, FlipHorizontal } from 'lucide-react';
import { processCarnetPhoto } from '../lib/imageUtils';
import { Button } from './ui';

interface CameraCaptureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCapture: (dataUrl: string) => void;
}

export const CameraCaptureModal: React.FC<CameraCaptureModalProps> = ({
  isOpen,
  onClose,
  onCapture,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoadingCamera, setIsLoadingCamera] = useState<boolean>(true);
  const [hasMultipleCameras, setHasMultipleCameras] = useState<boolean>(false);

  // Stop current active stream tracks
  const stopStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  };

  // Check if device has multiple cameras (front/back)
  useEffect(() => {
    if (!isOpen) return;

    if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
      navigator.mediaDevices
        .enumerateDevices()
        .then((devices) => {
          const videoInputs = devices.filter((d) => d.kind === 'videoinput');
          setHasMultipleCameras(videoInputs.length > 1);
        })
        .catch(() => {
          setHasMultipleCameras(false);
        });
    }
  }, [isOpen]);

  // Start camera stream when modal is opened or facingMode changes
  useEffect(() => {
    if (!isOpen) {
      stopStream();
      setCapturedPhoto(null);
      setErrorMessage(null);
      return;
    }

    let isMounted = true;
    setIsLoadingCamera(true);
    setErrorMessage(null);
    setCapturedPhoto(null);

    const initCamera = async () => {
      stopStream();

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        if (isMounted) {
          setErrorMessage('Tu navegador no soporta captura de cámara directa.');
          setIsLoadingCamera(false);
        }
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: facingMode },
            width: { ideal: 1080 },
            height: { ideal: 1080 },
          },
          audio: false,
        });

        if (!isMounted) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => {
            if (isMounted) {
              videoRef.current?.play().catch(() => { });
              setIsLoadingCamera(false);
            }
          };
        }
      } catch (err: any) {
        console.error('Error starting camera:', err);
        if (isMounted) {
          setIsLoadingCamera(false);
          if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
            setErrorMessage('Permiso de cámara denegado. Permite el acceso a la cámara en tu navegador.');
          } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
            setErrorMessage('No se encontró ninguna cámara conectada a tu dispositivo.');
          } else {
            setErrorMessage('No se pudo acceder a la cámara (' + (err.message || 'error desconocido') + ').');
          }
        }
      }
    };

    initCamera();

    return () => {
      isMounted = false;
      stopStream();
    };
  }, [isOpen, facingMode]);

  const handleTakeSnapshot = async () => {
    if (!videoRef.current) return;

    try {
      // Process 1:1 square crop directly from video stream
      const compressedDataUrl = await processCarnetPhoto(videoRef.current, {
        size: 400,
        quality: 0.82,
      });
      setCapturedPhoto(compressedDataUrl);
    } catch (err: any) {
      console.error('Error processing carnet snapshot:', err);
      alert('Error al capturar la foto: ' + (err.message || 'intenta nuevamente'));
    }
  };

  const handleConfirmPhoto = () => {
    if (capturedPhoto) {
      onCapture(capturedPhoto);
      stopStream();
      onClose();
    }
  };

  const handleRetake = () => {
    setCapturedPhoto(null);
  };

  const handleToggleFacingMode = () => {
    setFacingMode((prev) => (prev === 'user' ? 'environment' : 'user'));
  };

  const handleCloseModal = () => {
    stopStream();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] overflow-y-auto bg-overlay backdrop-blur-[3px]">
      <div className="min-h-full flex items-center justify-center p-2.5 sm:p-4">
        <div className="bg-carnet-ground border border-border-default rounded-[20px] w-full max-w-md overflow-hidden my-auto flex flex-col max-h-[calc(100dvh-1.5rem)] sm:max-h-[92vh]">
          {/* Header */}
          <div className="p-3.5 border-b border-border-subtle flex items-center justify-between shrink-0 bg-carnet-ground">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-accent text-ink-on-accent flex items-center justify-center">
                <Camera className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-text-primary">
                  Foto del carnet 1:1
                </h3>
                <p className="text-xs text-text-muted">
                  {capturedPhoto ? 'Revisá la foto antes de guardar' : 'Encuadrá el rostro en el recuadro'}
                </p>
              </div>
            </div>

            <Button
              variant="ghost"
              iconOnly
              icon={X}
              aria-label="Cerrar"
              onClick={handleCloseModal}
            />
          </div>

          {/* Viewfinder Content */}
          <div className="p-4 flex flex-col items-center justify-center bg-carnet-ground overflow-y-auto flex-1 min-h-0">
            {errorMessage ? (
              <div className="w-full py-8 px-4 text-center space-y-3 bg-status-danger-soft border border-status-danger-border text-status-danger rounded-2xl">
                <div className="w-12 h-12 rounded-xl bg-status-danger/20 border border-status-danger/40 text-status-danger mx-auto flex items-center justify-center">
                  <AlertCircle className="w-6 h-6" />
                </div>
                <p className="text-xs text-text-secondary max-w-xs mx-auto">
                  {errorMessage}
                </p>
                <Button variant="secondary" onClick={handleCloseModal}>
                  Cerrar y subir archivo
                </Button>
              </div>
            ) : (
              <div className="relative w-72 h-72 sm:w-80 sm:h-80 bg-surface-sunken rounded-2xl border border-accent overflow-hidden flex items-center justify-center">
                {/* Captured Photo Preview Mode */}
                {capturedPhoto ? (
                  <div className="w-full h-full relative">
                    <img
                      src={capturedPhoto}
                      alt="Foto carnet capturada"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute top-2 right-2 bg-carnet-ground/90 border border-border-subtle text-text-secondary rounded text-[10px] px-2 py-0.5">
                      400x400 • 1:1
                    </div>
                  </div>
                ) : (
                  /* Live Camera Stream Mode */
                  <>
                    {isLoadingCamera && (
                      <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-carnet-ground text-text-muted gap-2">
                        <RefreshCw className="w-6 h-6 animate-spin text-accent" />
                        <span className="text-xs">Iniciando cámara...</span>
                      </div>
                    )}

                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className={`w-full h-full object-cover ${
                        facingMode === 'user' ? 'scale-x-[-1]' : ''
                      }`}
                    />

                    {/* 1:1 Carnet Guide Overlay */}
                    <div className="absolute inset-3 border border-border-subtle/50 rounded-xl pointer-events-none flex flex-col items-center justify-between p-2">
                      {/* Corner accents */}
                      <div className="w-full flex justify-between">
                        <div className="w-3.5 h-3.5 border-t-2 border-l-2 border-accent rounded-tl" />
                        <div className="w-3.5 h-3.5 border-t-2 border-r-2 border-accent rounded-tr" />
                      </div>

                      {/* Subtle oval head guideline */}
                      <div className="w-32 h-44 border border-dashed border-border-default rounded-full pointer-events-none flex items-center justify-center">
                        <span className="text-[9px] uppercase tracking-widest text-text-muted">
                          ROSTRO
                        </span>
                      </div>

                      <div className="w-full flex justify-between">
                        <div className="w-3.5 h-3.5 border-b-2 border-l-2 border-accent rounded-bl" />
                        <div className="w-3.5 h-3.5 border-b-2 border-r-2 border-accent rounded-br" />
                      </div>
                    </div>

                    {/* Flip camera button if device has multiple */}
                    {hasMultipleCameras && !isLoadingCamera && (
                      <Button
                        variant="secondary"
                        iconOnly
                        icon={FlipHorizontal}
                        aria-label="Cambiar de cámara"
                        onClick={handleToggleFacingMode}
                        className="absolute top-3 right-3 z-20"
                      />
                    )}
                  </>
                )}
              </div>
            )}

            <p className="text-[11px] text-text-faint mt-2.5 text-center">
              Formato cuadrado 1:1 carnet optimizado (&lt;40KB)
            </p>
          </div>

          {/* Footer Actions */}
          {!errorMessage && (
            <div className="bg-carnet-ground border-t border-border-subtle p-3.5 flex items-center justify-between gap-2.5 shrink-0">
              {capturedPhoto ? (
                <>
                  <Button
                    variant="secondary"
                    icon={RefreshCw}
                    onClick={handleRetake}
                    className="flex-1"
                  >
                    Tomar otra
                  </Button>
                  <Button
                    variant="primary"
                    icon={Check}
                    onClick={handleConfirmPhoto}
                    className="flex-1"
                  >
                    Usar foto
                  </Button>
                </>
              ) : (
                <>
                  <Button variant="secondary" onClick={handleCloseModal}>
                    Cancelar
                  </Button>
                  <Button
                    variant="primary"
                    icon={Camera}
                    disabled={isLoadingCamera}
                    onClick={handleTakeSnapshot}
                    className="flex-1"
                  >
                    Capturar foto
                  </Button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
