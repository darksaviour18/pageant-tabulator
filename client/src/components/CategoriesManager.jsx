import { useState, useMemo } from 'react';
import { categoriesAPI, criteriaAPI } from '../api';
import { useCrudResource } from '../hooks/useCrudResource';
import { Plus, Trash2, ChevronDown, ChevronRight } from 'lucide-react';

export default function CategoriesManager({ eventId }) {
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
    if (!confirm(`Delete category "${name}"? All criteria will also be removed.`)) return;
    await deleteCategory(id);
  };

  const toggleExpand = (id) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-slate-900">Categories & Criteria</h2>
      </div>

      {/* Add Category Form */}
      <form onSubmit={handleAddCategory} className="flex gap-3 mb-6">
        <input
          type="text"
          value={newCategoryName}
          onChange={(e) => setNewCategoryName(e.target.value)}
          placeholder="Category name (e.g., Evening Gown)"
          className="flex-1 px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none"
        />
        <button
          type="submit"
          disabled={catLoading}
          className="flex items-center gap-2 px-5 py-2.5 bg-amber-500 hover:bg-amber-600 disabled:bg-amber-300 text-white font-medium rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Category
        </button>
      </form>

      {catError && (
        <div className="text-sm text-red-600 bg-red-50 px-4 py-2 rounded-lg mb-4">
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
        <div className="text-center py-8 text-slate-400">
          No categories added yet. Add your first category above.
        </div>
      )}
    </div>
  );
}

/**
 * Individual category card with collapsible criteria section.
 */
function CategoryCard({ category, expanded, onToggle, onDelete }) {
  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden">
      {/* Category Header */}
      <div className="flex items-center justify-between bg-slate-50 px-4 py-3">
        <button
          onClick={onToggle}
          className="flex items-center gap-2 text-left font-medium text-slate-900 hover:text-amber-600 transition-colors"
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
          className="text-red-500 hover:text-red-700 transition-colors p-1"
          title="Delete category"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* Criteria Section */}
      {expanded && (
        <div className="p-4 border-t border-slate-200">
          <CriteriaList categoryId={category.id} />
        </div>
      )}
    </div>
  );
}

/**
 * Criteria list with add/edit/delete for a single category.
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
  const isOver = totalWeight > 1;

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

  useState(() => {
    loadCriteria();
  });

  const handleAddCriterion = async (e) => {
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
  };

  const handleDeleteCriterion = async (id) => {
    try {
      await criteriaAPI.delete(id);
      setCriteria((prev) => prev.filter((c) => c.id !== id));
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete criterion');
    }
  };

  if (loading) return <div className="text-slate-400 text-sm">Loading criteria...</div>;

  return (
    <div>
      {/* Weight Summary */}
      <div className={`flex items-center justify-between mb-4 text-sm ${isOver ? 'text-red-600' : 'text-slate-600'}`}>
        <span>Total weight</span>
        <span className={`font-semibold ${isOver ? 'text-red-600' : totalWeight === 1 ? 'text-green-600' : 'text-amber-600'}`}>
          {weightPercent}% {totalWeight === 1 ? '✓' : isOver ? '(over 100%)' : ''}
        </span>
      </div>

      {/* Criteria Table */}
      {criteria.length > 0 && (
        <div className="overflow-x-auto mb-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="text-left py-2 px-3 text-slate-500 font-medium">Criterion</th>
                <th className="text-left py-2 px-3 text-slate-500 font-medium">Weight</th>
                <th className="text-left py-2 px-3 text-slate-500 font-medium">Range</th>
                <th className="text-right py-2 px-3 text-slate-500 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {criteria.map((c) => (
                <tr key={c.id} className="border-b border-slate-100 hover:bg-slate-50 transition">
                  <td className="py-2 px-3 text-slate-900 font-medium">{c.name}</td>
                  <td className="py-2 px-3 text-slate-700">{(c.weight * 100).toFixed(1)}%</td>
                  <td className="py-2 px-3 text-slate-500">
                    {c.min_score} – {c.max_score}
                  </td>
                  <td className="py-2 px-3 text-right">
                    <button
                      onClick={() => handleDeleteCriterion(c.id)}
                      className="text-red-500 hover:text-red-700 transition-colors"
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
          className="sm:col-span-2 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none text-sm"
        />
        <input
          type="number"
          step="0.01"
          min="0"
          max="1"
          value={newCriterion.weight}
          onChange={(e) => setNewCriterion((prev) => ({ ...prev, weight: e.target.value }))}
          placeholder="Weight (0-1)"
          className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none text-sm"
        />
        <div className="flex gap-2">
          <input
            type="number"
            step="0.1"
            value={newCriterion.min_score}
            onChange={(e) => setNewCriterion((prev) => ({ ...prev, min_score: parseFloat(e.target.value) || 0 }))}
            placeholder="Min"
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none text-sm"
          />
          <input
            type="number"
            step="0.1"
            value={newCriterion.max_score}
            onChange={(e) => setNewCriterion((prev) => ({ ...prev, max_score: parseFloat(e.target.value) || 10 }))}
            placeholder="Max"
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none text-sm"
          />
        </div>
        <button
          type="submit"
          className="flex items-center justify-center gap-1 px-3 py-2 bg-slate-800 hover:bg-slate-900 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          Add
        </button>
      </form>

      {error && (
        <div className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">
          {error}
        </div>
      )}

      {criteria.length === 0 && (
        <div className="text-center py-4 text-slate-400 text-sm">
          No criteria added. Add your first criterion above.
        </div>
      )}
    </div>
  );
}
