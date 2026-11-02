import React from 'react';
import { Member } from '../types';
import { VirtualCard } from './VirtualCard';
import isologo from '../assets/isologo.png';
import { X, Printer } from 'lucide-react';

interface VirtualCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  member: Member | null;
}

export const VirtualCardModal: React.FC<VirtualCardModalProps> = ({ isOpen, onClose, member }) => {
  if (!isOpen || !member) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-[#0f172a]/80 backdrop-blur-sm">
      <div className="min-h-full flex items-center justify-center p-2.5 sm:p-4">
        <div className="bg-[#0f172a] border border-[#34d399] rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl relative my-auto flex flex-col max-h-[calc(100dvh-1.5rem)] sm:max-h-[90vh]">
          {/* Header */}
          <div className="flex items-center justify-between p-3.5 border-b border-[#34d399]/30 bg-[#0f172a] no-print shrink-0">
            <div className="flex items-center gap-2.5">
              <img src={isologo} alt="Acuva" className="w-7 h-7 object-contain shrink-0" />
              <div>
                <h3 className="font-black text-xs sm:text-sm text-white uppercase tracking-wider">Carnet Virtual</h3>
                <p className="text-[10px] text-slate-300 font-mono">Credencial Acuva</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-[#1e293b] transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="p-4 overflow-y-auto flex-1 min-h-0">
            <VirtualCard member={member} onClose={onClose} />
          </div>
        </div>
      </div>
    </div>
  );
};
