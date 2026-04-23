import { useEffect, useState, useCallback, useRef } from 'react';

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

  // 11.3.2: Use ref to hold api — prevents callbacks from recreating when caller doesn't memoize
  const apiRef = useRef(api);
  apiRef.current = api;

  const clearMessages = useCallback(() => {
    setError(null);
    setSuccess(null);
  }, []);

  const load = useCallback(async () => {
    try {
      const res = collectionKey !== null
        ? await apiRef.current.getAll(collectionKey)
        : await apiRef.current.getAll();
      setItems(res.data);
    } catch (err) {
      console.error('[useCrudResource] Failed to load:', err);
    }
  }, [collectionKey]);

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
            ? await apiRef.current.create(collectionKey, data)
            : await apiRef.current.create(data);
        setItems((prev) => [...prev, res.data]);
        return true;
      } catch (err) {
        setError(err.response?.data?.error || 'Operation failed');
        return false;
      } finally {
        setLoading(false);
      }
    },
    [collectionKey]
  );

  const handleUpdate = useCallback(
    async (id, data) => {
      setError(null);
      setSuccess(null);
      setLoading(true);
      try {
        const res = await apiRef.current.update(id, data);
        setItems((prev) => prev.map((item) => (item[deleteKey] === id ? res.data : item)));
        return true;
      } catch (err) {
        setError(err.response?.data?.error || 'Operation failed');
        return false;
      } finally {
        setLoading(false);
      }
    },
    [deleteKey]
  );

  const handleDelete = useCallback(
    async (id) => {
      setError(null);
      setSuccess(null);
      setLoading(true);
      try {
        const deleteFn = apiRef.current.delete;
        let res;

        // Auto-detect: if delete function expects 2+ args and collectionKey exists, pass both
        if (collectionKey !== null && deleteFn.length >= 2) {
          res = await deleteFn(collectionKey, id);
        } else {
          res = await deleteFn(id);
        }

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
    [collectionKey, deleteKey, load]
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
