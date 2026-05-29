import { useEffect, useState, useCallback } from 'react';
import OrderTable from '../components/OrderTable';
import OrderFilters from '../components/OrderFilters';
import useSocket from '../hooks/useSocket';
import { getOrders, exportOrders } from '../api/client';

export default function Orders() {
  const [orders, setOrders] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [filters, setFilters] = useState({ page: 1, limit: 20 });
  const [loading, setLoading] = useState(true);

  const fetchOrders = useCallback(async (f = filters) => {
    setLoading(true);
    try {
      const { data } = await getOrders(f);
      setOrders(data.data);
      setPagination(data.pagination);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchOrders(); }, [filters]);

  useSocket({
    onNewOrder: () => fetchOrders(),
    onOrderUpdated: () => fetchOrders(),
  });

  const handleFilterChange = (newFilters) => {
    const next = { ...filters, ...newFilters, page: 1 };
    setFilters(next);
  };

  const handleExport = async () => {
    try {
      const { data: blob } = await exportOrders(filters);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `orders-${Date.now()}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export error', err);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">📋 Заявки</h2>
        <button
          onClick={handleExport}
          className="px-4 py-2 text-sm bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
        >
          📥 CSV
        </button>
      </div>

      <OrderFilters filters={filters} onChange={handleFilterChange} />

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin h-10 w-10 border-4 border-accent border-t-transparent rounded-full" />
        </div>
      ) : (
        <>
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            <OrderTable orders={orders} onUpdate={() => fetchOrders()} />
          </div>

          {pagination && pagination.pages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-6">
              <button
                onClick={() => setFilters(f => ({ ...f, page: Math.max(1, f.page - 1) }))}
                disabled={filters.page <= 1}
                className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg disabled:opacity-50 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                ←
              </button>
              <span className="text-sm text-gray-500">
                {filters.page} / {pagination.pages}
              </span>
              <button
                onClick={() => setFilters(f => ({ ...f, page: Math.min(pagination.pages, f.page + 1) }))}
                disabled={filters.page >= pagination.pages}
                className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg disabled:opacity-50 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
