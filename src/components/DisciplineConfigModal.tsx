import React, { useState, useMemo, useEffect } from 'react';
import { DisciplineItem } from '../types';
import { saveDiscipline, deleteDiscipline } from '../lib/storage';
import { Pagination } from './Pagination';
import { X, Settings, Plus, Edit2, Trash2, Check, AlertCircle, RefreshCw, DollarSign, FileSpreadsheet } from 'lucide-react';
import { exportDisciplinesToExcel } from '../lib/excelExport';

interface DisciplineConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  disciplines: DisciplineItem[];
  onDisciplinesChange: () => Promise<void>;
}

export const DisciplineConfigModal: React.FC<DisciplineConfigModalProps> = ({
  isOpen,
  onClose,
  disciplines,
  onDisciplinesChange,
}) => {
  const [newNombre, setNewNombre] = useState('');
  const [newPrecio, setNewPrecio] = useState<number | ''>('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editNombre, setEditNombre] = useState('');
  const [editPrecio, setEditPrecio] = useState<number | ''>('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 15;

  useEffect(() => {
    const maxPage = Math.max(1, Math.ceil(disciplines.length / PAGE_SIZE));
    if (currentPage > maxPage) {
      setCurrentPage(maxPage);
    }
  }, [disciplines.length, currentPage]);

  const paginatedDisciplines = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return disciplines.slice(start, start + PAGE_SIZE);
  }, [disciplines, currentPage]);

  if (!isOpen) return null;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const trimmed = newNombre.trim();
    if (!trimmed) {
      setErrorMsg('Ingresa el nombre de la disciplina.');
      return;
    }

    if (newPrecio === '' || Number(newPrecio) <= 0) {
      setErrorMsg('Ingresa un precio válido mayor a 0.');
      return;
    }

    // Check duplicate
    if (disciplines.some((d) => d.nombre.toLowerCase() === trimmed.toLowerCase())) {
      setErrorMsg('Ya existe una disciplina con ese nombre.');
      return;
    }

    setLoading(true);
    try {
      await saveDiscipline({
        nombre: trimmed,
        precio: Number(newPrecio),
      });
      setNewNombre('');
      setNewPrecio('');
      await onDisciplinesChange();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al guardar la disciplina.');
    } finally {
      setLoading(false);
    }
  };

  const handleStartEdit = (item: DisciplineItem) => {
    setEditingId(item.id);
    setEditNombre(item.nombre);
    setEditPrecio(item.precio);
    setErrorMsg(null);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditNombre('');
    setEditPrecio('');
  };

  const handleSaveEdit = async (id: string) => {
    setErrorMsg(null);
    const trimmed = editNombre.trim();
    if (!trimmed) {
      setErrorMsg('El nombre no puede estar vacío.');
      return;
    }
    if (editPrecio === '' || Number(editPrecio) <= 0) {
      setErrorMsg('El precio debe ser mayor a 0.');
      return;
    }

    // Check duplicate name excluding self
    if (disciplines.some((d) => d.id !== id && d.nombre.toLowerCase() === trimmed.toLowerCase())) {
      setErrorMsg('Ya existe otra disciplina con ese nombre.');
      return;
    }

    setLoading(true);
    try {
      await saveDiscipline({
        id,
        nombre: trimmed,
        precio: Number(editPrecio),
      });
      setEditingId(null);
      await onDisciplinesChange();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al actualizar disciplina.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string, nombre: string) => {
    if (disciplines.length <= 1) {
      alert('Debe haber al menos una disciplina disponible.');
      return;
    }

    if (!confirm(`¿Estás seguro de eliminar la disciplina "${nombre}"?`)) {
      return;
    }

    setLoading(true);
    try {
      await deleteDiscipline(id);
      await onDisciplinesChange();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al eliminar disciplina.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-[#0f172a]/80 backdrop-blur-sm">
      <div className="min-h-full flex items-center justify-center p-2.5 sm:p-4">
        <div className="bg-[#0f172a] border border-[#34d399] rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl relative my-auto flex flex-col max-h-[calc(100dvh-1.5rem)] sm:max-h-[90vh]">
          {/* Header */}
          <div className="flex items-center justify-between p-4 sm:p-5 border-b border-[#34d399]/30 bg-[#0f172a] shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#34d399] text-[#0f172a] flex items-center justify-center font-bold">
                <Settings className="w-4 h-4 text-[#0f172a]" />
              </div>
              <div>
                <h2 className="text-base font-black text-white uppercase tracking-wider">
                  Configurar Disciplinas y Precios
                </h2>
                <p className="text-[11px] text-slate-300 font-mono">
                  Tarifas fijas de cuotas mensuales
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-slate-300 hover:text-white p-1 rounded hover:bg-[#1e293b] transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body */}
          <div className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1 min-h-0">
            {errorMsg && (
              <div className="p-2.5 rounded-lg bg-[#0f172a] border border-red-500/50 text-red-400 text-xs font-mono flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Add Form */}
            <form
              onSubmit={handleCreate}
              className="bg-[#0f172a] p-3 sm:p-3.5 rounded-xl border border-[#34d399]/40 space-y-3"
            >
              <span className="text-[10px] font-bold text-white uppercase font-mono block">
                Agregar Nueva Disciplina
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                <div className="sm:col-span-6">
                  <input
                    type="text"
                    required
                    placeholder="Nombre (ej. Natación, Boxeo)"
                    value={newNombre}
                    onChange={(e) => setNewNombre(e.target.value)}
                    className="w-full bg-[#0f172a] border border-[#34d399] rounded-lg px-3 py-2 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-[#34d399] font-mono"
                  />
                </div>
                <div className="sm:col-span-4">
                  <div className="relative">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#34d399] text-xs font-mono">
                      $
                    </span>
                    <input
                      type="number"
                      min="1"
                      step="500"
                      required
                      placeholder="Precio Cuota"
                      value={newPrecio}
                      onChange={(e) => setNewPrecio(e.target.value === '' ? '' : Number(e.target.value))}
                      className="w-full bg-[#0f172a] border border-[#34d399] rounded-lg pl-6 pr-2.5 py-2 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-[#34d399] font-mono"
                    />
                  </div>
                </div>
                <div className="sm:col-span-2">
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full h-full py-2 px-3 bg-[#34d399] hover:bg-[#34d399]/90 active:scale-95 text-[#0f172a] font-black text-xs uppercase tracking-wider rounded-lg transition-all flex items-center justify-center gap-1 shadow-sm"
                  >
                    <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                    <span>Crear</span>
                  </button>
                </div>
              </div>
            </form>

            {/* Disciplines List */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-white uppercase font-mono block">
                  Disciplinas Activas ({disciplines.length})
                </span>
                <button
                  type="button"
                  onClick={() => exportDisciplinesToExcel(disciplines)}
                  disabled={disciplines.length === 0}
                  className="px-2 py-0.5 bg-[#0f172a] hover:bg-[#1e293b] disabled:opacity-40 text-white text-[11px] rounded border border-[#34d399]/40 flex items-center gap-1 font-mono transition-colors shadow-sm"
                  title="Descargar disciplinas en Excel (.xlsx)"
                >
                  <FileSpreadsheet className="w-3 h-3 text-[#34d399]" />
                  <span>Exportar Excel</span>
                </button>
              </div>

              <div className="divide-y divide-[#34d399]/20 border border-[#34d399]/40 rounded-xl overflow-hidden bg-[#0f172a]">
                {paginatedDisciplines.map((d) => {
                  const isEditing = editingId === d.id;

                  if (isEditing) {
                    return (
                      <div
                        key={d.id}
                        className="p-3 bg-[#0f172a] flex flex-col sm:flex-row items-center gap-2"
                      >
                        <input
                          type="text"
                          value={editNombre}
                          onChange={(e) => setEditNombre(e.target.value)}
                          className="w-full sm:flex-1 bg-[#0f172a] border border-[#34d399] rounded-lg px-2.5 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-[#34d399]"
                        />
                        <div className="relative w-full sm:w-36">
                          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#34d399] text-xs font-mono">
                            $
                          </span>
                          <input
                            type="number"
                            min="1"
                            step="500"
                            value={editPrecio}
                            onChange={(e) =>
                              setEditPrecio(e.target.value === '' ? '' : Number(e.target.value))
                            }
                            className="w-full bg-[#0f172a] border border-[#34d399] rounded-lg pl-6 pr-2 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-[#34d399]"
                          />
                        </div>
                        <div className="flex items-center gap-1.5 self-end sm:self-center">
                          <button
                            type="button"
                            onClick={() => handleSaveEdit(d.id)}
                            className="p-1.5 bg-[#34d399] text-[#0f172a] hover:bg-[#34d399]/90 rounded-md transition-colors"
                            title="Guardar cambios"
                          >
                            <Check className="w-4 h-4 stroke-[2.5]" />
                          </button>
                          <button
                            type="button"
                            onClick={handleCancelEdit}
                            className="p-1.5 bg-[#0f172a] text-slate-300 hover:text-white rounded-md border border-[#34d399]/40 transition-colors"
                            title="Cancelar"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={d.id}
                      className="p-3 flex items-center justify-between gap-3 hover:bg-[#1e293b]/50 transition-colors"
                    >
                      <div className="min-w-0">
                        <h4 className="text-xs sm:text-sm font-bold text-white tracking-wide uppercase font-mono truncate">
                          {d.nombre}
                        </h4>
                        <p className="text-[11px] font-mono text-slate-300 mt-0.5">
                          Cuota oficial: <span className="text-[#34d399] font-bold">${Number(d.precio).toLocaleString('es-AR')}</span>
                        </p>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleStartEdit(d)}
                          className="p-1.5 text-slate-300 hover:text-white hover:bg-[#1e293b] rounded-lg border border-transparent hover:border-[#34d399] transition-colors"
                          title="Editar disciplina y precio"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(d.id, d.nombre)}
                          className="p-1.5 text-slate-300 hover:text-red-400 hover:bg-[#1e293b] rounded-lg border border-transparent hover:border-red-500/40 transition-colors"
                          title="Eliminar disciplina"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {disciplines.length > 0 && (
                <Pagination
                  currentPage={currentPage}
                  totalItems={disciplines.length}
                  pageSize={PAGE_SIZE}
                  onPageChange={setCurrentPage}
                  itemLabel="disciplinas"
                  className="pt-1"
                />
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="p-3 sm:p-4 border-t border-[#34d399]/30 bg-[#0f172a] flex justify-between items-center text-[11px] font-mono text-slate-400 shrink-0">
            <span>Los cambios aplicarán a los nuevos socios y cuotas calculadas.</span>
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 bg-[#0f172a] hover:bg-[#1e293b] text-white rounded-lg border border-[#34d399]/40"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
