import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import apiService from '../../services/api';
import { openRealtimeSocket } from '../../services/realtime';

const statusLabels = {
  pending: 'Pending',
  in_progress: 'In Progress',
  escalated: 'Escalated',
  resolved: 'Resolved',
  closed: 'Closed',
};

const statusColors = {
  pending: 'bg-yellow-500',
  in_progress: 'bg-blue-500',
  escalated: 'bg-orange-500',
  resolved: 'bg-green-500',
  closed: 'bg-gray-500',
};

const normalizeSummary = (data) => ({
  scope: data?.scope || 'admin',
  total: data?.total || 0,
  status_counts: data?.status_counts || {},
  daily_trend: Array.isArray(data?.daily_trend) ? data.daily_trend : [],
  category_breakdown: Array.isArray(data?.category_breakdown) ? data.category_breakdown : [],
  recent_complaints: Array.isArray(data?.recent_complaints) ? data.recent_complaints : [],
});

const ComplaintAnalyticsPanel = ({
  title = 'Complaint Analytics',
  subtitle = '',
  accent = 'blue',
  analyticsScope = null,
  officerId = null,
}) => {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [connectionState, setConnectionState] = useState('connecting');
  const socketRef = useRef(null);
  const timerRef = useRef(null);

  const loadAnalytics = useCallback(async () => {
    try {
      const hasScopedRequest = Boolean(analyticsScope || officerId);
      const requestOptions = {};
      if (analyticsScope) requestOptions.scope = analyticsScope;
      if (officerId) requestOptions.officerId = officerId;

      let data;
      try {
        data = await apiService.getComplaintAnalytics(requestOptions);
      } catch (scopedError) {
        const shouldFallback = hasScopedRequest && /HTTP 400|HTTP 404/i.test(scopedError?.message || '');
        if (!shouldFallback) {
          throw scopedError;
        }
        data = await apiService.getComplaintAnalytics();
      }

      setSummary(normalizeSummary(data));
      setError('');
    } catch (err) {
      setError(err.message || 'Failed to load complaint analytics');
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, [analyticsScope, officerId]);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    loadAnalytics();

    const socket = openRealtimeSocket('/ws/analytics/', {
      onOpen: () => {
        if (mounted) setConnectionState('live');
      },
      onMessage: (event) => {
        if (!mounted) return;
        try {
          const payload = JSON.parse(event.data);
          if (payload.type?.startsWith('analytics.')) {
            loadAnalytics();
          }
        } catch {
          loadAnalytics();
        }
      },
      onClose: () => {
        if (mounted) setConnectionState('polling');
      },
      onError: () => {
        if (mounted) setConnectionState('polling');
      },
    });

    socketRef.current = socket;
    timerRef.current = setInterval(loadAnalytics, 30000);

    return () => {
      mounted = false;
      if (socket) socket.close();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [loadAnalytics]);

  const trendMax = useMemo(() => {
    if (!summary?.daily_trend?.length) return 0;
    return Math.max(...summary.daily_trend.map((item) => item.count), 1);
  }, [summary]);

  const statusEntries = Object.keys(statusLabels).map((key) => ({
    key,
    label: statusLabels[key],
    count: summary?.status_counts?.[key] || 0,
    color: statusColors[key] || 'bg-gray-500',
  }));

  if (loading && !summary) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="text-sm text-gray-500">Loading complaint analytics...</div>
      </div>
    );
  }

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <p className={`text-xs font-semibold uppercase tracking-[0.2em] ${accent === 'emerald' ? 'text-emerald-600' : 'text-blue-600'}`}>
            {summary?.scope === 'officer' ? 'Assigned Complaints' : 'Campus-wide Complaints'}
          </p>
          <h3 className="text-2xl font-bold text-gray-900">{title}</h3>
          {subtitle && <p className="mt-1 text-sm text-gray-500">{subtitle}</p>}
        </div>
        <div className={`text-sm ${connectionState === 'live' ? 'text-green-600' : 'text-amber-600'}`}>
          {connectionState === 'live' ? 'Live updates on' : 'Live updates syncing'}
        </div>
      </div>

      {error && (
        <div className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-5">
        <MetricCard label="Total" value={summary?.total || 0} accentClass={accent === 'emerald' ? 'bg-emerald-600' : 'bg-blue-600'} />
        {statusEntries.map((entry) => (
          <MetricCard key={entry.key} label={entry.label} value={entry.count} accentClass={entry.color} />
        ))}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h4 className="text-sm font-semibold uppercase tracking-wide text-gray-600">Daily Trend</h4>
            <span className="text-xs text-gray-500">Last 7 days</span>
          </div>
          <div className="flex h-48 items-end gap-2">
            {(summary?.daily_trend || []).map((item) => (
              <div key={item.date} className="flex flex-1 flex-col items-center gap-2">
                <div className="flex h-36 w-full items-end">
                  <div
                    className={`w-full rounded-t-lg ${accent === 'emerald' ? 'bg-emerald-500' : 'bg-blue-500'}`}
                    style={{ height: `${(item.count / trendMax) * 100}%`, minHeight: item.count > 0 ? '10px' : '2px' }}
                  />
                </div>
                <span className="text-[11px] text-gray-500">{item.label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h4 className="text-sm font-semibold uppercase tracking-wide text-gray-600">Category Breakdown</h4>
            <span className="text-xs text-gray-500">Top categories</span>
          </div>
          <div className="space-y-3">
            {(summary?.category_breakdown || []).length === 0 ? (
              <p className="text-sm text-gray-500">No category data yet.</p>
            ) : (
              summary.category_breakdown.map((item) => (
                <div key={item.label}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="font-medium text-gray-700">{item.label}</span>
                    <span className="text-gray-500">{item.count}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-gray-200">
                    <div
                      className={`h-full rounded-full ${accent === 'emerald' ? 'bg-emerald-500' : 'bg-blue-500'}`}
                      style={{ width: `${Math.max((item.count / Math.max(summary.total || 1, 1)) * 100, 8)}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="mt-6 rounded-xl border border-gray-200 bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <h4 className="text-sm font-semibold uppercase tracking-wide text-gray-600">Recent Complaints</h4>
          <span className="text-xs text-gray-500">Auto refreshed</span>
        </div>
        <div className="space-y-3">
          {(summary?.recent_complaints || []).length === 0 ? (
            <p className="text-sm text-gray-500">No complaints to show yet.</p>
          ) : (
            summary.recent_complaints.map((item) => (
              <div key={item.complaint_id} className="flex items-start justify-between gap-4 rounded-lg bg-gray-50 px-4 py-3">
                <div>
                  <p className="font-medium text-gray-900">{item.title}</p>
                  <p className="text-xs text-gray-500">
                    {item.category} | {new Date(item.updated_at).toLocaleString()}
                  </p>
                </div>
                <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-gray-600">
                  {statusLabels[item.status] || item.status}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  );
};

const MetricCard = ({ label, value, accentClass }) => (
  <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
    <div className="flex items-center gap-3">
      <span className={`h-3 w-3 rounded-full ${accentClass}`} />
      <div>
        <div className="text-xs uppercase tracking-wide text-gray-500">{label}</div>
        <div className="text-2xl font-bold text-gray-900">{value}</div>
      </div>
    </div>
  </div>
);

export default ComplaintAnalyticsPanel;
