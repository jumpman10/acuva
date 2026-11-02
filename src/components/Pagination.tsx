import React from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

interface PaginationProps {
  currentPage: number;
  totalItems: number;
  pageSize?: number;
  onPageChange: (page: number) => void;
  className?: string;
  itemLabel?: string;
}

function getPaginationItems(current: number, total: number): (number | string)[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  if (current <= 4) {
    return [1, 2, 3, 4, 5, '...', total];
  }

  if (current >= total - 3) {
    return [1, '...', total - 4, total - 3, total - 2, total - 1, total];
  }

  return [1, '...', current - 1, current, current + 1, '...', total];
}

export const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalItems,
  pageSize = 15,
  onPageChange,
  className = '',
  itemLabel = 'registros',
}) => {
  if (totalItems === 0) return null;

  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safeCurrent = Math.min(Math.max(1, currentPage), totalPages);

  const startItem = (safeCurrent - 1) * pageSize + 1;
  const endItem = Math.min(safeCurrent * pageSize, totalItems);

  const pages = getPaginationItems(safeCurrent, totalPages);

  return (
    <div
      className={`flex flex-col sm:flex-row items-center justify-between gap-3 text-xs select-none ${className}`}
    >
      <div className="text-text-muted text-xs sm:text-[11px] text-center sm:text-left">
        Mostrando <span className="text-text-primary font-bold">{startItem}</span> -{' '}
        <span className="text-text-primary font-bold">{endItem}</span> de{' '}
        <span className="text-text-primary font-bold">{totalItems}</span> {itemLabel}
        {totalPages > 1 && (
          <span className="text-text-muted ml-2">
            (Pág. {safeCurrent} de {totalPages})
          </span>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center gap-1 flex-wrap justify-center">
          {/* First Page */}
          <button
            type="button"
            onClick={() => onPageChange(1)}
            disabled={safeCurrent === 1}
            aria-label="Primera página"
            title="Primera página"
            className="p-2 sm:p-1.5 rounded-lg bg-surface-100 border border-border-default text-text-secondary hover:bg-surface-hover hover:text-text-primary disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
          >
            <ChevronsLeft className="w-3.5 h-3.5" />
          </button>

          {/* Previous Page */}
          <button
            type="button"
            onClick={() => onPageChange(safeCurrent - 1)}
            disabled={safeCurrent === 1}
            aria-label="Página anterior"
            title="Página anterior"
            className="p-2 sm:p-1.5 rounded-lg bg-surface-100 border border-border-default text-text-secondary hover:bg-surface-hover hover:text-text-primary disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>

          {/* Page numbers */}
          <div className="flex items-center gap-1 mx-0.5">
            {pages.map((p, idx) => {
              if (p === '...') {
                return (
                  <span key={`ellipsis-${idx}`} className="px-1 text-text-muted text-xs">
                    ...
                  </span>
                );
              }

              const pageNum = p as number;
              const isActive = pageNum === safeCurrent;

              return (
                <button
                  key={pageNum}
                  type="button"
                  onClick={() => onPageChange(pageNum)}
                  aria-label={`Página ${pageNum}`}
                  aria-current={isActive ? 'page' : undefined}
                  className={`min-w-8 h-8 px-2 rounded-lg text-xs font-bold transition-colors cursor-pointer focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent ${
                    isActive
                      ? 'bg-accent text-ink-on-accent font-extrabold'
                      : 'bg-surface-100 text-text-secondary hover:bg-surface-hover hover:text-text-primary border border-border-default'
                  }`}
                >
                  {pageNum}
                </button>
              );
            })}
          </div>

          {/* Next Page */}
          <button
            type="button"
            onClick={() => onPageChange(safeCurrent + 1)}
            disabled={safeCurrent === totalPages}
            aria-label="Página siguiente"
            title="Página siguiente"
            className="p-2 sm:p-1.5 rounded-lg bg-surface-100 border border-border-default text-text-secondary hover:bg-surface-hover hover:text-text-primary disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>

          {/* Last Page */}
          <button
            type="button"
            onClick={() => onPageChange(totalPages)}
            disabled={safeCurrent === totalPages}
            aria-label="Última página"
            title="Última página"
            className="p-2 sm:p-1.5 rounded-lg bg-surface-100 border border-border-default text-text-secondary hover:bg-surface-hover hover:text-text-primary disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
          >
            <ChevronsRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
};
