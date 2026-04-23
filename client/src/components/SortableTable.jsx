import { useState, useMemo } from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

export function SortableTable({ 
  columns, 
  data, 
  keyField = 'id',
  onRowClick,
  emptyMessage = 'No data',
  className = '',
}) {
  const { isDark } = useTheme();
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });

  const sortedData = useMemo(() => {
    if (!sortConfig.key) return data;
    
    return [...data].sort((a, b) => {
      const aVal = a[sortConfig.key];
      const bVal = b[sortConfig.key];
      
      if (aVal === bVal) return 0;
      
      const comparison = aVal < bVal ? -1 : 1;
      return sortConfig.direction === 'asc' ? comparison : -comparison;
    });
  }, [data, sortConfig]);

  const handleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const SortIcon = ({ columnKey }) => {
    if (sortConfig.key !== columnKey) return null;
    return sortConfig.direction === 'asc' 
      ? <ChevronUp className="w-3 h-3 ml-1" />
      : <ChevronDown className="w-3 h-3 ml-1" />;
  };

  return (
    <div className={`overflow-x-auto ${className}`}>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[var(--color-border)]">
            {columns.map(col => (
              <th
                key={col.key}
                className={`text-left py-3 px-4 text-[var(--color-text-muted)] font-medium
                  ${col.sortable !== false ? 'cursor-pointer hover:text-[var(--color-text)] select-none' : ''}`}
                onClick={() => col.sortable !== false && handleSort(col.key)}
              >
                <span className="flex items-center">
                  {col.label}
                  <SortIcon columnKey={col.key} />
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sortedData.length > 0 ? (
            sortedData.map(row => (
              <tr
                key={row[keyField]}
                className={`border-b border-[var(--color-border)] hover:bg-[var(--color-bg)] transition
                  ${onRowClick ? 'cursor-pointer' : ''}`}
                onClick={() => onRowClick?.(row)}
              >
                {columns.map(col => (
                  <td key={col.key} className="py-3 px-4 text-[var(--color-text)]">
                    {col.render ? col.render(row[col.key], row) : row[col.key]}
                  </td>
                ))}
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={columns.length} className="py-8 text-center text-[var(--color-text-muted)]">
                {emptyMessage}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export function useSelection() {
  const [selected, setSelected] = useState(new Set());

  const toggle = (id) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const selectAll = (ids) => {
    setSelected(new Set(ids));
  };

  const clear = () => {
    setSelected(new Set());
  };

  const isSelected = (id) => selected.has(id);
  const count = selected.size;

  return { selected, toggle, selectAll, clear, isSelected, count };
}