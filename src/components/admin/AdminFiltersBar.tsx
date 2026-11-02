import React from 'react';
import { Search, FileSpreadsheet, UserPlus } from 'lucide-react';
import { Input, Button } from '../ui';

export interface AdminFiltersBarProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  statusFilter: 'all' | 'activo' | 'por_vencer' | 'vencido';
  onStatusFilterChange: (status: 'all' | 'activo' | 'por_vencer' | 'vencido') => void;
  disciplineFilter: string;
  onDisciplineFilterChange: (disc: string) => void;
  disciplinesList: string[];
  totalMembers: number;
  activeMembers: number;
  expiringMembers: number;
  expiredMembers: number;
  onExportExcel: () => void;
  exportDisabled?: boolean;
  onOpenNewMember?: () => void;
}

export const AdminFiltersBar: React.FC<AdminFiltersBarProps> = ({
  searchQuery,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  disciplineFilter,
  onDisciplineFilterChange,
  disciplinesList,
  totalMembers,
  activeMembers,
  expiringMembers,
  expiredMembers,
  onExportExcel,
  exportDisabled,
  onOpenNewMember,
}) => {
  const chips = [
    { id: 'all' as const, label: 'Todos', count: totalMembers },
    { id: 'activo' as const, label: 'Al día', count: activeMembers },
    { id: 'por_vencer' as const, label: 'Por vencer', count: expiringMembers },
    { id: 'vencido' as const, label: 'Vencidos', count: expiredMembers },
  ];

  return (
    <div className="space-y-3 select-none">
      {/* State Chips */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
        {chips.map((chip) => {
          const isActive = statusFilter === chip.id;
          return (
            <button
              key={chip.id}
              type="button"
              onClick={() => onStatusFilterChange(chip.id)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer flex items-center gap-1.5 ${
                isActive
                  ? 'bg-accent text-ink-on-accent font-bold shadow-sm'
                  : 'border border-border-default text-text-secondary hover:text-text-primary hover:bg-surface-hover'
              }`}
            >
              <span>{chip.label}</span>
              <span
                className={`font-mono text-[11px] ${
                  isActive ? 'text-ink-on-accent/80' : 'text-text-muted'
                }`}
              >
                {chip.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Inputs & Actions */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 flex-1 min-w-0">
          {/* Search Input */}
          <div className="relative flex-1 min-w-[200px]">
            <Search
              size={16}
              className="text-text-muted absolute left-3.5 top-3.5 pointer-events-none"
            />
            <Input
              variant="admin"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Buscar por nombre o DNI"
              className="pl-9.5 w-full"
            />
          </div>

          {/* Discipline Select */}
          <select
            value={disciplineFilter}
            onChange={(e) => onDisciplineFilterChange(e.target.value)}
            className="h-11 bg-surface-sunken border border-border-default text-text-primary text-xs rounded-xl px-3.5 focus:border-accent focus:outline-none transition-colors cursor-pointer shrink-0"
          >
            <option value="all">Todas las disciplinas</option>
            {disciplinesList.map((d) => (
              <option key={d} value={d} className="bg-surface-100 text-text-primary">
                {d}
              </option>
            ))}
          </select>
        </div>

        {/* Buttons */}
        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="secondary"
            icon={FileSpreadsheet}
            onClick={onExportExcel}
            disabled={exportDisabled}
          >
            Excel
          </Button>

          {onOpenNewMember && (
            <Button
              variant="primary"
              icon={UserPlus}
              onClick={onOpenNewMember}
            >
              Nuevo socio
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};
