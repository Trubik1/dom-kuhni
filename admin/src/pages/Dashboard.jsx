import { useEffect, useState } from 'react';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, ArcElement, Title, Tooltip, Legend } from 'chart.js';
import { Bar, Doughnut } from 'react-chartjs-2';
import StatsCards from '../components/StatsCards';
import useSocket from '../hooks/useSocket';
import { getStats, getAnalytics } from '../api/client';

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Title, Tooltip, Legend);

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchAll = async () => {
    try {
      const [s, a] = await Promise.all([getStats(), getAnalytics()]);
      setStats(s.data.data);
      setAnalytics(a.data.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, []);

  useSocket({
    onNewOrder: fetchAll,
    onOrderUpdated: fetchAll,
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin h-10 w-10 border-4 border-accent border-t-transparent rounded-full" />
      </div>
    );
  }

  const statusChart = stats ? {
    labels: ['Новые', 'В работе', 'Завершённые', 'Отменённые'],
    datasets: [{
      data: [stats.byStatus.new, stats.byStatus.in_progress, stats.byStatus.completed, stats.byStatus.cancelled],
      backgroundColor: ['#3B82F6', '#EAB308', '#22C55E', '#EF4444'],
    }],
  } : null;

  const dailyChart = stats ? {
    labels: stats.daily.map(d => d.date.slice(5)),
    datasets: [{
      label: 'Заявки по дням',
      data: stats.daily.map(d => d.count),
      backgroundColor: '#c9a96e',
      borderRadius: 4,
    }],
  } : null;

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">📊 Дашборд</h2>

      <StatsCards />

      {/* Пульс посещаемости */}
      {analytics && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700">
            <div className="text-2xl font-bold text-gray-900 dark:text-white">{analytics.today}</div>
            <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">👁 Сегодня</div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700">
            <div className="text-2xl font-bold text-gray-900 dark:text-white">{analytics.week}</div>
            <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">📅 За неделю</div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700">
            <div className="text-2xl font-bold text-gray-900 dark:text-white">{analytics.total}</div>
            <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">📊 Всего</div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700">
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">{analytics.activeNow}</div>
            <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">🔥 Сейчас на сайте</div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Заявки по дням (30 дней)</h3>
          {dailyChart && <Bar data={dailyChart} options={{ responsive: true, plugins: { legend: { display: false } } }} />}
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Распределение по статусам</h3>
          {statusChart && <Doughnut data={statusChart} options={{ responsive: true, plugins: { legend: { position: 'bottom' } } }} />}
        </div>
      </div>

      {analytics?.topPages?.length > 0 && (
        <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-4">📄 Популярные страницы</h3>
            <div className="space-y-2">
              {analytics.topPages.map((p, i) => (
                <div key={p.page} className="flex items-center justify-between py-1.5">
                  <span className="text-sm text-gray-600 dark:text-gray-300">
                    <span className="text-gray-400 mr-2">{i + 1}.</span>
                    {p.page}
                  </span>
                  <span className="text-sm font-bold text-gray-900 dark:text-white">{p.count} 👁</span>
                </div>
              ))}
            </div>
          </div>

          {analytics.referrers?.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-4">🔗 Источники трафика</h3>
              <div className="space-y-2">
                {analytics.referrers.map((r) => (
                  <div key={r.source} className="flex items-center justify-between py-1.5">
                    <span className="text-sm text-gray-600 dark:text-gray-300">{r.source}</span>
                    <span className="text-sm font-bold text-gray-900 dark:text-white">{r.count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {stats?.byType?.length > 0 && (
        <div className="mt-6 bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Типы кухонь</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {stats.byType.map((t) => (
              <div key={t.type} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <span className="text-sm text-gray-600 dark:text-gray-300">{t.type}</span>
                <span className="text-sm font-bold text-gray-900 dark:text-white">{t.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
