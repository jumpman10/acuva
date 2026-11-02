import React from 'react';
import { Search, FileSpreadsheet } from 'lucide-react';

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
}) => {
  return (
    <div className="space-y-3">
      {/* DESKTOP BAR (Single unified horizontal bar on lg+) */}
      <div className="hidden lg:flex items-center justify-between gap-3 bg-[#0e1626] border border-slate-800 rounded-xl px-3 py-2.5 shadow-sm">
        {/* Left: Search input */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Buscar por nombre, DNI o teléfono..."
            className="w-72 bg-[#090e17] border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-[#34d399] transition-colors"
          />
        </div>

        {/* Center: Filter Chips */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => onStatusFilterChange('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              statusFilter === 'all'
                ? 'bg-[#34d399] text-[#080c14] font-black shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
            }`}
          >
            Todos {totalMembers}
          </button>
          <button
            onClick={() => onStatusFilterChange('activo')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              statusFilter === 'activo'
                ? 'bg-[#34d399] text-[#080c14] font-black shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
            }`}
          >
            Al día {activeMembers}
          </button>
          <button
            onClick={() => onStatusFilterChange('por_vencer')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              statusFilter === 'por_vencer'
                ? 'bg-[#34d399] text-[#080c14] font-black shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
            }`}
          >
            Por vencer {expiringMembers}
          </button>
          <button
            onClick={() => onStatusFilterChange('vencido')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              statusFilter === 'vencido'
                ? 'bg-[#34d399] text-[#080c14] font-black shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
            }`}
          >
            Vencidos {expiredMembers}
          </button>
        </div>

        {/* Right: Disciplines dropdown & Excel export */}
        <div className="flex items-center gap-2">
          <select
            value={disciplineFilter}
            onChange={(e) => onDisciplineFilterChange(e.target.value)}
            className="bg-[#090e17] text-slate-300 text-xs border border-slate-800 rounded-lg px-3 py-2 focus:border-[#34d399] focus:outline-none cursor-pointer"
          >
            <option value="all">Todas las disciplinas</option>
            {disciplinesList.map((d) => (
              <option key={d} value={d} className="bg-[#090e17] text-white">
                {d}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={onExportExcel}
            disabled={exportDisabled}
            className="px-3 py-2 bg-[#090e17] hover:bg-slate-800/70 disabled:opacity-40 text-slate-300 hover:text-white text-xs font-semibold rounded-lg border border-slate-800 flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
            title="Descargar socios en Excel (.xlsx)"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-[#34d399]" />
            <span>Excel</span>
          </button>
        </div>
      </div>

      {/* MOBILE BAR (Stacked layout on < lg) */}
      <div className="lg:hidden space-y-2.5">
        {/* Search input with rounded container */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Buscar nombre, DNI o teléfono"
            className="w-full bg-[#0e1626] border border-slate-800 rounded-xl pl-10 pr-3 py-2.5 text-sm text-white placeholder-slate-400 focus:outline-none focus:border-[#34d399] transition-colors shadow-sm"
          />
        </div>

        {/* Filter chips (Horizontal scroll) */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
          <button
            onClick={() => onStatusFilterChange('all')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
              statusFilter === 'all'
                ? 'bg-[#34d399] text-[#080c14] font-black shadow-sm'
                : 'bg-[#0e1626] border border-slate-800 text-slate-300 hover:text-white'
            }`}
          >
            Todos {totalMembers}
          </button>
          <button
            onClick={() => onStatusFilterChange('activo')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
              statusFilter === 'activo'
                ? 'bg-[#34d399] text-[#080c14] font-black shadow-sm'
                : 'bg-[#0e1626] border border-slate-800 text-slate-300 hover:text-white'
            }`}
          >
            Al día {activeMembers}
          </button>
          <button
            onClick={() => onStatusFilterChange('por_vencer')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
              statusFilter === 'por_vencer'
                ? 'bg-[#34d399] text-[#080c14] font-black shadow-sm'
                : 'bg-[#0e1626] border border-slate-800 text-slate-300 hover:text-white'
            }`}
          >
            Por vencer {expiringMembers}
          </button>
          <button
            onClick={() => onStatusFilterChange('vencido')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
              statusFilter === 'vencido'
                ? 'bg-[#34d399] text-[#080c14] font-black shadow-sm'
                : 'bg-[#0e1626] border border-slate-800 text-slate-300 hover:text-white'
            }`}
          >
            Vencidos {expiredMembers}
          </button>
        </div>
      </div>
    </div>
  );
};

