import React from 'react';
import { Member } from '../types';
import { VirtualCard } from './VirtualCard';
import { Drawer } from './ui';

export interface VirtualCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  member: Member | null;
  onBack?: () => void;
}

export const VirtualCardModal: React.FC<VirtualCardModalProps> = ({
  isOpen,
  onClose,
  member,
  onBack,
}) => {
  if (!member) return null;

  return (
    <Drawer
      open={isOpen}
      onClose={onClose}
      onBack={onBack}
      title="Carnet digital"
      subtitle={`${member.nombre} ${member.apellido}`}
    >
      <div className="flex justify-center py-2">
        <VirtualCard member={member} onClose={onClose} />
      </div>
    </Drawer>
  );
};
