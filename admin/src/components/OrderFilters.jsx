import { useState } from 'react';

const statuses = [
  { value: '', label: 'Все статусы' },
  { value: 'new', label: '🆕 Новые' },
  { value: 'in_progress', label: '🔄 В работе' },
  { value: 'completed', label: '✅ Завершённые' },
  { value: 'cancelled', label: '❌ Отменённые' },
];

export default function OrderFilters({ filters, onChange }) {
  const [local, setLocal] = useState(filters);

  const handleChange = (key, value) => {
    const next = { ...local, [key]: value };
    setLocal(next);
    onChange(next);
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      <div>
        <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Поиск</label>
        <input
          type="text"
          placeholder="Имя, телефон или ID..."
          value={local.search || ''}
          onChange={(e) => handleChange('search', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-accent focus:border-transparent outline-none"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Статус</label>
        <select
          value={local.status || ''}
          onChange={(e) => handleChange('status', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-accent focus:border-transparent outline-none"
        >
          {statuses.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">От</label>
        <input
          type="date"
          value={local.from || ''}
          onChange={(e) => handleChange('from', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-accent focus:border-transparent outline-none"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">До</label>
        <input
          type="date"
          value={local.to || ''}
          onChange={(e) => handleChange('to', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-accent focus:border-transparent outline-none"
        />
      </div>
    </div>
  );
}
