import { useState } from 'react';
import { updateOrder } from '../api/client';

const statusStyles = {
  new: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  in_progress: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  completed: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  cancelled: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
};

const statusLabels = {
  new: 'Новая',
  in_progress: 'В работе',
  completed: 'Завершена',
  cancelled: 'Отменена',
};

export default function OrderTable({ orders, onUpdate }) {
  const [editingId, setEditingId] = useState(null);
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(null);

  const handleStatusChange = async (orderId, newStatus) => {
    setLoading(orderId);
    try {
      await updateOrder(orderId, { status: newStatus });
      if (onUpdate) onUpdate();
    } catch (err) {
      console.error('Update failed', err);
    } finally {
      setLoading(null);
    }
  };

  const handleCommentSave = async (orderId) => {
    try {
      await updateOrder(orderId, { managerComment: comment });
      setEditingId(null);
      if (onUpdate) onUpdate();
    } catch (err) {
      console.error('Comment save failed', err);
    }
  };

  if (!orders?.length) {
    return (
      <div className="text-center py-12 text-gray-500 dark:text-gray-400">
        Заявок нет
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 dark:border-gray-700">
            <th className="text-left py-3 px-2 font-medium text-gray-500 dark:text-gray-400">ID</th>
            <th className="text-left py-3 px-2 font-medium text-gray-500 dark:text-gray-400">Клиент</th>
            <th className="text-left py-3 px-2 font-medium text-gray-500 dark:text-gray-400 hidden md:table-cell">Тип</th>
            <th className="text-left py-3 px-2 font-medium text-gray-500 dark:text-gray-400 hidden lg:table-cell">Бюджет</th>
            <th className="text-left py-3 px-2 font-medium text-gray-500 dark:text-gray-400">Статус</th>
            <th className="text-left py-3 px-2 font-medium text-gray-500 dark:text-gray-400 hidden sm:table-cell">Дата</th>
            <th className="text-left py-3 px-2 font-medium text-gray-500 dark:text-gray-400">Действия</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((order) => (
            <tr key={order.orderId} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
              <td className="py-3 px-2 font-mono text-xs text-gray-500">#{order.orderId}</td>
              <td className="py-3 px-2">
                <div className="font-medium text-gray-900 dark:text-white">{order.name}</div>
                <div className="text-xs text-gray-500">{order.phone}</div>
                {order.email && <div className="text-xs text-gray-400">{order.email}</div>}
              </td>
              <td className="py-3 px-2 text-gray-600 dark:text-gray-300 hidden md:table-cell">{order.kitchenType || '—'}</td>
              <td className="py-3 px-2 text-gray-600 dark:text-gray-300 hidden lg:table-cell">{order.budget || '—'}</td>
              <td className="py-3 px-2">
                <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${statusStyles[order.status]}`}>
                  {statusLabels[order.status]}
                </span>
              </td>
              <td className="py-3 px-2 text-xs text-gray-500 hidden sm:table-cell">
                {new Date(order.createdAt).toLocaleDateString('ru-RU')}
              </td>
              <td className="py-3 px-2">
                <div className="flex gap-1 flex-wrap">
                  {order.status === 'new' && (
                    <button
                      onClick={() => handleStatusChange(order.orderId, 'in_progress')}
                      disabled={loading === order.orderId}
                      className="px-2 py-1 text-xs bg-accent text-white rounded hover:bg-accent-dark disabled:opacity-50 transition-colors"
                    >
                      Взять
                    </button>
                  )}
                  {order.status === 'in_progress' && (
                    <>
                      <button
                        onClick={() => handleStatusChange(order.orderId, 'completed')}
                        disabled={loading === order.orderId}
                        className="px-2 py-1 text-xs bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50 transition-colors"
                      >
                        ✅
                      </button>
                      <button
                        onClick={() => handleStatusChange(order.orderId, 'cancelled')}
                        disabled={loading === order.orderId}
                        className="px-2 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600 disabled:opacity-50 transition-colors"
                      >
                        ❌
                      </button>
                    </>
                  )}

                  {editingId === order.orderId ? (
                    <div className="flex gap-1">
                      <input
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                        className="w-24 px-1 py-0.5 text-xs border rounded"
                        placeholder="Комментарий..."
                        autoFocus
                      />
                      <button onClick={() => handleCommentSave(order.orderId)} className="px-1 py-0.5 text-xs bg-accent text-white rounded">💾</button>
                    </div>
                  ) : (
                    <button
                      onClick={() => { setEditingId(order.orderId); setComment(order.managerComment || ''); }}
                      className="px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                      title={order.managerComment || 'Добавить комментарий'}
                    >
                      💬
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
