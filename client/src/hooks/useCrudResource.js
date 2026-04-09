import { useEffect, useState, useCallback } from 'react';

/**
 * Reusable hook for CRUD resource management.
 *
 * @param {object} api - Object with { getAll, create, update, delete } methods
 * @param {object} options
 * @param {number|string|null} options.collectionKey - Key to pass to getAll (e.g., eventId)
 * @param {string} options.deleteKey - Key name for delete operations (default: 'id')
 * @returns {{
 *   items: Array,
 *   loading: boolean,
 *   error: string|null,
 *   success: string|null,
 *   clearMessages: () => void,
 *   refresh: () => Promise<void>,
 *   handleCreate: (data: object) => Promise<boolean>,
 *   handleUpdate: (id: string|number, data: object) => Promise<boolean>,
 *   handleDelete: (id: string|number) => Promise<boolean>,
 * }}
 */
export function useCrudResource(api, { collectionKey = null, deleteKey = 'id' } = {}) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const clearMessages = useCallback(() => {
    setError(null);
    setSuccess(null);
  }, []);

  const load = useCallback(async () => {
    try {
      const res = collectionKey !== null ? await api.getAll(collectionKey) : await api.getAll();
      setItems(res.data);
    } catch (err) {
      console.error('[useCrudResource] Failed to load:', err);
    }
  }, [api, collectionKey]);

  useEffect(() => {
    load();
  }, [load]);

  const handleCreate = useCallback(
    async (data) => {
      setError(null);
      setSuccess(null);
      setLoading(true);
      try {
        const res =
          collectionKey !== null
            ? await api.create(collectionKey, data)
            : await api.create(data);
        setItems((prev) => [...prev, res.data]);
        return true;
      } catch (err) {
        setError(err.response?.data?.error || 'Operation failed');
        return false;
      } finally {
        setLoading(false);
      }
    },
    [api, collectionKey]
  );

  const handleUpdate = useCallback(
    async (id, data) => {
      setError(null);
      setSuccess(null);
      setLoading(true);
      try {
        const res = await api.update(id, data);
        setItems((prev) => prev.map((item) => (item[deleteKey] === id ? res.data : item)));
        return true;
      } catch (err) {
        setError(err.response?.data?.error || 'Operation failed');
        return false;
      } finally {
        setLoading(false);
      }
    },
    [api, deleteKey]
  );

  const handleDelete = useCallback(
    async (id) => {
      setError(null);
      setSuccess(null);
      setLoading(true);
      try {
        const res =
          collectionKey !== null
            ? await api.delete(collectionKey, id)
            : await api.delete(id);
        if (res?.status === 204 || res?.status === 200) {
          setItems((prev) => prev.filter((item) => item[deleteKey] !== id));
        } else {
          await load();
        }
        return true;
      } catch (err) {
        setError(err.response?.data?.error || 'Operation failed');
        return false;
      } finally {
        setLoading(false);
      }
    },
    [api, collectionKey, deleteKey, load]
  );

  return {
    items,
    loading,
    error,
    success,
    clearMessages,
    refresh: load,
    handleCreate,
    handleUpdate,
    handleDelete,
  };
}
