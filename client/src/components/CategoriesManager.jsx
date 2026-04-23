import { useState, useMemo, useEffect, useCallback } from 'react';
import { categoriesAPI, criteriaAPI } from '../api';
import { useCrudResource } from '../hooks/useCrudResource';
import { Plus, Trash2, ChevronDown, ChevronRight, AlertCircle, CheckCircle2 } from 'lucide-react';
import ConfirmDialog from './ConfirmDialog';

/** Maximum acceptable total weight (1.0 = 100%). */
const MAX_WEIGHT = 1;
/** Float comparison tolerance. */
const WEIGHT_TOLERANCE = 0.001;

export default function CategoriesManager({ eventId }) {
  const [confirmDelete, setConfirmDelete] = useState(null);
  const { items: categories, loading: catLoading, error: catError, handleCreate: createCategory, handleDelete: deleteCategory } = useCrudResource(
    categoriesAPI,
    { collectionKey: eventId }
  );

  const [expandedId, setExpandedId] = useState(null);
  const [newCategoryName, setNewCategoryName] = useState('');

  const handleAddCategory = async (e) => {
    e.preventDefault();
    if (!newCategoryName.trim()) return;

    const ok = await createCategory({
      name: newCategoryName.trim(),
      display_order: categories.length + 1,
    });
    if (ok) setNewCategoryName('');
  };

  const handleDeleteCategory = async (id, name) => {
    setConfirmDelete({
      title: 'Delete Category',
      message: `Delete "${name}"? All criteria will also be removed. This cannot be undone.`,
      confirmLabel: 'Delete',
      variant: 'danger',
      onConfirm: async () => {
        setConfirmDelete(null);
        await deleteCategory(id);
      },
      onCancel: () => setConfirmDelete(null),
    });
  };

  const toggleExpand = (id) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  return (
    <div className="bg-[var(--color-bg-subtle)] rounded-xl shadow-sm border border-[var(--color-border)] p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-[var(--color-text)]">Categories & Criteria</h2>
      </div>

      {/* Add Category Form */}
      <form onSubmit={handleAddCategory} className="flex gap-3 mb-6">
        <input
          type="text"
          value={newCategoryName}
          onChange={(e) => setNewCategoryName(e.target.value)}
          placeholder="Category name (e.g., Evening Gown)"
          className="flex-1 px-4 py-2.5 border border-[var(--color-border)] rounded-lg focus:ring-2 focus:ring-[var(--color-cta)] focus:border-[var(--color-cta)] outline-none bg-[var(--color-bg)] text-[var(--color-text)]"
        />
        <button
          type="submit"
          disabled={catLoading}
          className="flex items-center gap-2 px-5 py-2.5 bg-[var(--color-primary)] hover:opacity-90 disabled:opacity-50 text-white font-medium rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Category
        </button>
      </form>

      {catError && (
        <div className="text-sm text-[var(--color-error)] bg-[var(--color-error)]/10 px-4 py-2 rounded-lg mb-4">
          {catError}
        </div>
      )}

      {/* Category List */}
      {categories.length > 0 ? (
        <div className="space-y-3">
          {categories.map((category) => (
            <CategoryCard
              key={category.id}
              category={category}
              expanded={expandedId === category.id}
              onToggle={() => toggleExpand(category.id)}
              onDelete={() => handleDeleteCategory(category.id, category.name)}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-8 text-[var(--color-text-muted)]">
          No categories added yet. Add your first category above.
        </div>
      )}
      <ConfirmDialog {...confirmDelete} />
    </div>
  );
}

/**
 * Individual category card with collapsible criteria section.
 */
function CategoryCard({ category, expanded, onToggle, onDelete }) {
  return (
    <div className="border border-[var(--color-border)] rounded-lg overflow-hidden">
      {/* Category Header */}
      <div className="flex items-center justify-between bg-[var(--color-bg-subtle)] px-4 py-3">
        <button
          onClick={onToggle}
          className="flex items-center gap-2 text-left font-medium text-[var(--color-text)] hover:text-[var(--color-cta)] transition-colors"
        >
          {expanded ? (
            <ChevronDown className="w-4 h-4" />
          ) : (
            <ChevronRight className="w-4 h-4" />
          )}
          {category.name}
        </button>
        <button
          onClick={onDelete}
          className="text-red-500 hover:text-red-400 transition-colors p-1"
          title="Delete category"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* Criteria Section */}
      {expanded && (
        <div className="p-4 border-t border-[var(--color-border)]">
          <CriteriaList categoryId={category.id} />
        </div>
      )}
    </div>
  );
}

/**
 * Criteria list with add/delete for a single category.
 * Enforces that total weight must equal exactly 100% (1.0) before allowing new criteria.
 */
function CriteriaList({ categoryId }) {
  const [criteria, setCriteria] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [newCriterion, setNewCriterion] = useState({
    name: '',
    weight: '',
    min_score: 0,
    max_score: 10,
  });

  const totalWeight = useMemo(
    () => criteria.reduce((sum, c) => sum + c.weight, 0),
    [criteria]
  );

  const weightPercent = (totalWeight * 100).toFixed(1);
  const isComplete = Math.abs(totalWeight - MAX_WEIGHT) < WEIGHT_TOLERANCE;
  const isOver = totalWeight > MAX_WEIGHT + WEIGHT_TOLERANCE;
  const remainingWeight = Math.max(0, MAX_WEIGHT - totalWeight);

  useEffect(() => {
    const loadCriteria = async () => {
      try {
        const res = await criteriaAPI.getAll(categoryId);
        setCriteria(res.data);
      } catch (err) {
        console.error('Failed to load criteria:', err);
      } finally {
        setLoading(false);
      }
    };
    loadCriteria();
  }, [categoryId]);

  const handleAddCriterion = useCallback(
    async (e) => {
      e.preventDefault();
      setError(null);

      const weight = parseFloat(newCriterion.weight);
      if (isNaN(weight) || weight <= 0 || weight > 1) {
        setError('Weight must be between 0 and 1 (e.g., 0.40 for 40%)');
        return;
      }
      if (!newCriterion.name.trim()) {
        setError('Criterion name is required');
        return;
      }

      // Weight validation: prevent adding if it would exceed 100%
      if (totalWeight + weight > MAX_WEIGHT + WEIGHT_TOLERANCE) {
        setError(
          `Adding this criterion would exceed 100% total weight. Current: ${weightPercent}%, available: ${(remainingWeight * 100).toFixed(1)}%`
        );
        return;
      }

      try {
        const res = await criteriaAPI.create(categoryId, {
          name: newCriterion.name.trim(),
          weight,
          min_score: newCriterion.min_score,
          max_score: newCriterion.max_score,
          display_order: criteria.length + 1,
        });
        setCriteria((prev) => [...prev, res.data]);
        setNewCriterion({ name: '', weight: '', min_score: 0, max_score: 10 });
      } catch (err) {
        setError(err.response?.data?.error || 'Failed to add criterion');
      }
    },
    [newCriterion, totalWeight, weightPercent, remainingWeight, categoryId, criteria.length]
  );

  const handleDeleteCriterion = useCallback(
    async (id) => {
      try {
        await criteriaAPI.delete(id);
        setCriteria((prev) => prev.filter((c) => c.id !== id));
      } catch (err) {
        setError(err.response?.data?.error || 'Failed to delete criterion');
      }
    },
    [categoryId]
  );

  if (loading) return <div className="text-[var(--color-text-muted)] text-sm">Loading criteria...</div>;

  return (
    <div>
      {/* Weight Validation Banner */}
      <div
        className={`flex items-center justify-between mb-4 px-4 py-3 rounded-lg text-sm ${
          isComplete
            ? 'bg-green-500/10 text-green-500 border border-green-500/20'
            : isOver
            ? 'bg-red-500/10 text-red-500 border border-red-500/20'
            : 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
        }`}
      >
        <div className="flex items-center gap-2">
          {isComplete ? (
            <CheckCircle2 className="w-4 h-4" />
          ) : (
            <AlertCircle className="w-4 h-4" />
          )}
          <span className="font-medium">
            {isComplete
              ? 'Weights sum to exactly 100% — valid'
              : isOver
              ? `Total weight ${weightPercent}% exceeds 100%`
              : `${weightPercent}% of 100% — ${(remainingWeight * 100).toFixed(1)}% remaining`}
          </span>
        </div>
      </div>

      {/* Criteria Table */}
      {criteria.length > 0 && (
        <div className="overflow-x-auto mb-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)]">
                <th className="text-left py-2 px-3 text-[var(--color-text-muted)] font-medium">#</th>
                <th className="text-left py-2 px-3 text-[var(--color-text-muted)] font-medium">Criterion</th>
                <th className="text-left py-2 px-3 text-[var(--color-text-muted)] font-medium">Weight</th>
                <th className="text-left py-2 px-3 text-[var(--color-text-muted)] font-medium">Range</th>
                <th className="text-right py-2 px-3 text-[var(--color-text-muted)] font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {criteria.map((c, idx) => (
                <tr key={c.id} className="border-b border-[var(--color-border)] hover:bg-[var(--color-bg)] transition">
                  <td className="py-2 px-3 text-[var(--color-text-muted)] text-xs">{idx + 1}</td>
                  <td className="py-2 px-3 text-[var(--color-text)] font-medium">{c.name}</td>
                  <td className="py-2 px-3 text-[var(--color-text)]">{(c.weight * 100).toFixed(1)}%</td>
                  <td className="py-2 px-3 text-[var(--color-text-muted)]">
                    {c.min_score} – {c.max_score}
                  </td>
                  <td className="py-2 px-3 text-right">
                    <button
                      onClick={() => handleDeleteCriterion(c.id)}
                      className="text-red-500 hover:text-red-400 transition-colors"
                      title="Delete criterion"
                    >
                      <Trash2 className="w-4 h-4 inline" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Criterion Form */}
      <form onSubmit={handleAddCriterion} className="grid grid-cols-1 sm:grid-cols-5 gap-3 mb-3">
        <input
          type="text"
          value={newCriterion.name}
          onChange={(e) => setNewCriterion((prev) => ({ ...prev, name: e.target.value }))}
          placeholder="Criterion name"
          className="sm:col-span-2 px-3 py-2 border border-[var(--color-border)] rounded-lg focus:ring-2 focus:ring-[var(--color-cta)] focus:border-[var(--color-cta)] outline-none text-sm bg-[var(--color-bg)] text-[var(--color-text)]"
          disabled={isComplete}
        />
        <input
          type="number"
          step="0.01"
          min="0"
          max="1"
          value={newCriterion.weight}
          onChange={(e) => setNewCriterion((prev) => ({ ...prev, weight: e.target.value }))}
          placeholder="Weight (0-1)"
          className="px-3 py-2 border border-[var(--color-border)] rounded-lg focus:ring-2 focus:ring-[var(--color-cta)] focus:border-[var(--color-cta)] outline-none text-sm bg-[var(--color-bg)] text-[var(--color-text)]"
          disabled={isComplete}
        />
        <div className="flex gap-2">
          <input
            type="number"
            step="0.1"
            value={newCriterion.min_score}
            onChange={(e) => setNewCriterion((prev) => ({ ...prev, min_score: parseFloat(e.target.value) || 0 }))}
            placeholder="Min"
            className="w-full px-3 py-2 border border-[var(--color-border)] rounded-lg focus:ring-2 focus:ring-[var(--color-cta)] focus:border-[var(--color-cta)] outline-none text-sm bg-[var(--color-bg)] text-[var(--color-text)]"
            disabled={isComplete}
          />
          <input
            type="number"
            step="0.1"
            value={newCriterion.max_score}
            onChange={(e) => setNewCriterion((prev) => ({ ...prev, max_score: parseFloat(e.target.value) || 10 }))}
            placeholder="Max"
            className="w-full px-3 py-2 border border-[var(--color-border)] rounded-lg focus:ring-2 focus:ring-[var(--color-cta)] focus:border-[var(--color-cta)] outline-none text-sm bg-[var(--color-bg)] text-[var(--color-text)]"
            disabled={isComplete}
          />
        </div>
        <button
          type="submit"
          disabled={isComplete}
          className="flex items-center justify-center gap-1 px-3 py-2 bg-[var(--color-primary)] hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-all active:scale-95"
        >
          <Plus className="w-3.5 h-3.5" />
          Add
        </button>
      </form>

      {isComplete && (
        <div className="text-xs text-green-500 mb-3 text-center">
          Weight total is 100%. No more criteria can be added.
        </div>
      )}

      {error && (
        <div className="text-sm text-red-500 bg-red-500/10 px-3 py-2 rounded-lg">
          {error}
        </div>
      )}

      {criteria.length === 0 && (
        <div className="text-center py-4 text-[var(--color-text-muted)] text-sm">
          No criteria added. Add your first criterion above.
        </div>
      )}
    </div>
  );
}
