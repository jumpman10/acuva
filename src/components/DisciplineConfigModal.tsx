import React, { useState } from 'react';
import { DisciplineItem } from '../types';
import { saveDiscipline, deleteDiscipline } from '../lib/storage';
import { Drawer, Button, Input } from './ui';
import { Plus, Edit2, Trash2, Check, X, AlertCircle } from 'lucide-react';
import { formatMoney } from '../lib/status';

export interface DisciplineConfigModalProps {
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
  const [showAddForm, setShowAddForm] = useState(false);
  const [newNombre, setNewNombre] = useState('');
  const [newPrecio, setNewPrecio] = useState<number | ''>('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editNombre, setEditNombre] = useState('');
  const [editPrecio, setEditPrecio] = useState<number | ''>('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const trimmed = newNombre.trim();
    if (!trimmed) {
      setErrorMsg('Ingresá el nombre de la disciplina.');
      return;
    }

    if (newPrecio === '' || Number(newPrecio) <= 0) {
      setErrorMsg('Ingresá un precio válido mayor a 0.');
      return;
    }

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
      setShowAddForm(false);
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
      setErrorMsg('Debe haber al menos una disciplina disponible.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);
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
    <Drawer
      open={isOpen}
      onClose={onClose}
      title="Disciplinas y cuotas"
      subtitle="Tarifas y planes de membresía"
    >
      <div className="space-y-4">
        {errorMsg && (
          <div className="bg-status-danger-soft border border-status-danger-border text-status-danger rounded-xl p-3 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Filas editables nombre + precio */}
        <div className="bg-surface-100 rounded-xl border border-border-subtle divide-y divide-border-subtle overflow-hidden">
          {disciplines.map((item) => {
            const isEditing = editingId === item.id;

            if (isEditing) {
              return (
                <div
                  key={item.id}
                  className="p-3.5 space-y-2.5 bg-surface-200 transition-colors"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <Input
                      variant="admin"
                      value={editNombre}
                      onChange={(e) => setEditNombre(e.target.value)}
                      placeholder="Nombre de disciplina"
                      className="h-9 text-xs"
                    />
                    <Input
                      variant="admin"
                      mono
                      type="number"
                      min="1"
                      step="500"
                      value={editPrecio}
                      onChange={(e) =>
                        setEditPrecio(e.target.value === '' ? '' : Number(e.target.value))
                      }
                      placeholder="Precio"
                      className="h-9 text-xs"
                    />
                  </div>
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="md"
                      disabled={loading}
                      onClick={handleCancelEdit}
                      className="h-8 px-2.5 text-xs"
                    >
                      Cancelar
                    </Button>
                    <Button
                      variant="primary"
                      size="md"
                      loading={loading}
                      icon={Check}
                      onClick={() => handleSaveEdit(item.id)}
                      className="h-8 px-3 text-xs"
                    >
                      Guardar
                    </Button>
                  </div>
                </div>
              );
            }

            return (
              <div
                key={item.id}
                className="px-4 py-3 flex items-center justify-between gap-3 text-xs hover:bg-surface-200 transition-colors"
              >
                <div className="min-w-0">
                  <p className="font-bold text-text-primary text-sm truncate capitalize">
                    {item.nombre}
                  </p>
                  <p className="font-mono text-xs text-text-secondary mt-0.5">
                    {formatMoney(item.precio)} / mes
                  </p>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    iconOnly
                    icon={Edit2}
                    aria-label={`Editar ${item.nombre}`}
                    title="Editar"
                    onClick={() => handleStartEdit(item)}
                  />
                  <Button
                    variant="ghost"
                    iconOnly
                    icon={Trash2}
                    aria-label={`Eliminar ${item.nombre}`}
                    title="Eliminar"
                    disabled={disciplines.length <= 1 || loading}
                    onClick={() => handleDelete(item.id, item.nombre)}
                    className="text-text-muted hover:text-status-danger hover:bg-status-danger-soft"
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* Formulario / Botón para agregar disciplina */}
        {showAddForm ? (
          <form
            onSubmit={handleCreate}
            className="p-4 bg-surface-sunken border border-border-default rounded-xl space-y-3"
          >
            <span className="text-xs font-bold text-text-primary block">
              Nueva disciplina
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <Input
                variant="admin"
                required
                placeholder="Nombre (ej. Natación)"
                value={newNombre}
                onChange={(e) => setNewNombre(e.target.value)}
              />
              <Input
                variant="admin"
                mono
                type="number"
                min="1"
                step="500"
                required
                placeholder="Precio ($)"
                value={newPrecio}
                onChange={(e) =>
                  setNewPrecio(e.target.value === '' ? '' : Number(e.target.value))
                }
              />
            </div>
            <div className="flex items-center justify-end gap-2 pt-1">
              <Button
                type="button"
                variant="secondary"
                size="md"
                onClick={() => {
                  setShowAddForm(false);
                  setErrorMsg(null);
                }}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="md"
                loading={loading}
                icon={Plus}
              >
                Crear disciplina
              </Button>
            </div>
          </form>
        ) : (
          <Button
            type="button"
            variant="secondary"
            size="md"
            icon={Plus}
            onClick={() => {
              setShowAddForm(true);
              setErrorMsg(null);
            }}
            className="w-full"
          >
            Agregar disciplina
          </Button>
        )}
      </div>
    </Drawer>
  );
};
