import { useEffect, useState } from 'react';
import { getStats } from '../api/client';

export default function StatsCards() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = async () => {
    try {
      const { data } = await getStats();
      setStats(data.data);
    } catch (err) {
      console.error('Stats fetch error', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchStats(); }, []);

  if (loading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700 animate-pulse">
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-20 mb-2" />
            <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-16" />
          </div>
        ))}
      </div>
    );
  }

  if (!stats) return null;

  const cards = [
    { label: 'Всего заявок', value: stats.total, color: 'text-blue-600 dark:text-blue-400' },
    { label: 'За сегодня', value: stats.today, color: 'text-green-600 dark:text-green-400' },
    { label: 'В работе', value: stats.byStatus.in_progress, color: 'text-yellow-600 dark:text-yellow-400' },
    { label: 'Новые', value: stats.byStatus.new, color: 'text-red-600 dark:text-red-400' },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {cards.map((card) => (
        <div key={card.label} className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700">
          <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">{card.label}</div>
          <div className={`text-3xl font-bold ${card.color}`}>{card.value}</div>
        </div>
      ))}
    </div>
  );
}
