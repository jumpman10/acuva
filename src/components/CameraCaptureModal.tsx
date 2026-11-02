import React, { useState, useRef, useEffect } from 'react';
import { Camera, X, RefreshCw, Check, AlertCircle, FlipHorizontal } from 'lucide-react';
import { processCarnetPhoto } from '../lib/imageUtils';

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
    <div className="fixed inset-0 z-[60] overflow-y-auto bg-[#0f172a]/80 backdrop-blur-md">
      <div className="min-h-full flex items-center justify-center p-2.5 sm:p-4">
        <div className="bg-[#0f172a] border border-[#34d399] rounded-2xl w-full max-w-md overflow-hidden shadow-2xl my-auto flex flex-col max-h-[calc(100dvh-1.5rem)] sm:max-h-[92vh]">
          {/* Header */}
          <div className="p-3.5 border-b border-[#34d399]/30 flex items-center justify-between shrink-0 bg-[#0f172a]">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-[#34d399] border border-[#34d399] flex items-center justify-center text-[#0f172a]">
                <Camera className="w-3.5 h-3.5" />
              </div>
              <div>
                <h3 className="text-xs sm:text-sm font-black text-white uppercase font-mono tracking-wide">
                  Foto Carnet 1:1
                </h3>
                <p className="text-[10px] text-slate-300 font-mono">
                  {capturedPhoto ? 'Revisa la foto antes de guardar' : 'Encuadra el rostro en el recuadro'}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleCloseModal}
              className="w-7 h-7 rounded-lg bg-[#0f172a] hover:bg-[#1e293b] text-slate-300 hover:text-white flex items-center justify-center transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Viewfinder Content */}
          <div className="p-4 flex flex-col items-center justify-center bg-[#0f172a] overflow-y-auto flex-1 min-h-0">
            {errorMessage ? (
              <div className="w-full py-12 px-4 text-center space-y-3">
                <div className="w-12 h-12 rounded-xl bg-red-950/40 border border-red-900/60 text-red-400 mx-auto flex items-center justify-center">
                  <AlertCircle className="w-6 h-6" />
                </div>
                <p className="text-xs text-slate-300 font-mono max-w-xs mx-auto">
                  {errorMessage}
                </p>
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-4 py-1.5 rounded-lg bg-[#0f172a] border border-[#34d399]/40 text-white text-xs font-mono hover:bg-[#1e293b]"
                >
                  Cerrar y subir archivo
                </button>
              </div>
            ) : (
              <div className="relative w-72 h-72 sm:w-80 sm:h-80 rounded-2xl overflow-hidden bg-[#0f172a] border-2 border-[#34d399] shadow-inner flex items-center justify-center">
                {/* Captured Photo Preview Mode */}
                {capturedPhoto ? (
                  <div className="w-full h-full relative">
                    <img
                      src={capturedPhoto}
                      alt="Foto carnet capturada"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute top-2 right-2 bg-[#0f172a]/80 backdrop-blur-sm px-2 py-0.5 rounded text-[10px] font-mono text-white border border-[#34d399]">
                      400x400 • 1:1
                    </div>
                  </div>
                ) : (
                  /* Live Camera Stream Mode */
                  <>
                    {isLoadingCamera && (
                      <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-[#0f172a] text-slate-300 gap-2">
                        <RefreshCw className="w-6 h-6 animate-spin text-[#34d399]" />
                        <span className="text-[11px] font-mono">Iniciando cámara...</span>
                      </div>
                    )}

                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className={`w-full h-full object-cover ${facingMode === 'user' ? 'scale-x-[-1]' : ''
                        }`}
                    />

                    {/* 1:1 Carnet Guide Overlay */}
                    <div className="absolute inset-3 border border-white/30 rounded-xl pointer-events-none flex flex-col items-center justify-between p-2">
                      {/* Corner accents */}
                      <div className="w-full flex justify-between">
                        <div className="w-3.5 h-3.5 border-t-2 border-l-2 border-[#34d399] rounded-tl" />
                        <div className="w-3.5 h-3.5 border-t-2 border-r-2 border-[#34d399] rounded-tr" />
                      </div>

                      {/* Subtle oval head guideline */}
                      <div className="w-32 h-44 border border-dashed border-white/35 rounded-full pointer-events-none flex items-center justify-center">
                        <span className="text-[9px] uppercase font-mono tracking-widest text-white/50">
                          ROSTRO
                        </span>
                      </div>

                      <div className="w-full flex justify-between">
                        <div className="w-3.5 h-3.5 border-b-2 border-l-2 border-[#34d399] rounded-bl" />
                        <div className="w-3.5 h-3.5 border-b-2 border-r-2 border-[#34d399] rounded-br" />
                      </div>
                    </div>

                    {/* Flip camera button if device has multiple */}
                    {hasMultipleCameras && !isLoadingCamera && (
                      <button
                        type="button"
                        onClick={handleToggleFacingMode}
                        title="Cambiar cámara frontal/trasera"
                        className="absolute top-3 right-3 z-20 p-2 bg-[#0f172a]/80 hover:bg-[#1e293b] text-white rounded-lg border border-[#34d399] backdrop-blur-sm transition-colors"
                      >
                        <FlipHorizontal className="w-4 h-4 text-[#34d399]" />
                      </button>
                    )}
                  </>
                )}
              </div>
            )}

            <p className="text-[10px] text-slate-400 font-mono mt-2.5 text-center">
              Formato cuadrado 1:1 carnet optimizado (&lt;40KB)
            </p>
          </div>

          {/* Footer Actions */}
          {!errorMessage && (
            <div className="p-3.5 border-t border-[#34d399]/30 bg-[#0f172a] flex items-center justify-between gap-2.5 shrink-0">
              {capturedPhoto ? (
                <>
                  <button
                    type="button"
                    onClick={handleRetake}
                    className="flex-1 py-2 px-3 rounded-lg border border-[#34d399]/40 text-white hover:bg-[#1e293b] text-xs font-mono flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Tomar otra
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmPhoto}
                    className="flex-1 py-2 px-3 rounded-lg bg-[#34d399] hover:bg-[#34d399]/90 text-[#0f172a] font-black uppercase text-xs tracking-wider font-mono flex items-center justify-center gap-1.5 transition-colors shadow-lg"
                  >
                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                    Usar foto
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={handleCloseModal}
                    className="py-2 px-4 rounded-lg border border-[#34d399]/40 text-white hover:bg-[#1e293b] text-xs font-mono transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleTakeSnapshot}
                    disabled={isLoadingCamera}
                    className="flex-1 py-2.5 px-4 rounded-lg bg-[#34d399] hover:bg-[#34d399]/90 active:scale-95 disabled:opacity-50 text-[#0f172a] font-black uppercase text-xs tracking-wider font-mono flex items-center justify-center gap-2 transition-all shadow-lg"
                  >
                    <Camera className="w-4 h-4 stroke-[2.5]" />
                    Capturar Foto
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
