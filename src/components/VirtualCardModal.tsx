import React from 'react';
import { Member } from '../types';
import { VirtualCard } from './VirtualCard';
import { Drawer } from './ui';

interface VirtualCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  member: Member | null;
}

export const VirtualCardModal: React.FC<VirtualCardModalProps> = ({
  isOpen,
  onClose,
  member,
}) => {
  if (!member) return null;

  return (
    <Drawer
      open={isOpen}
      onClose={onClose}
      title="Carnet digital"
      subtitle={`${member.nombre} ${member.apellido}`}
    >
      <div className="flex justify-center py-2">
        <VirtualCard member={member} onClose={onClose} />
      </div>
    </Drawer>
  );
};
