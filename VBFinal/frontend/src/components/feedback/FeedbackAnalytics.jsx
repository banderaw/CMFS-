import React, { useState, useEffect, useCallback } from 'react';

const FeedbackAnalytics = ({ templateId }) => {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchAnalytics = useCallback(async () => {
    try {
      const response = await fetch(`/api/feedback/templates/${templateId}/analytics/`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      setAnalytics(data);
    } catch (error) {
      console.error('Error fetching analytics:', error);
      setAnalytics(null);
    } finally {
      setLoading(false);
    }
  }, [templateId]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  if (loading) return <div className="text-center py-10 text-lg text-gray-600">Loading analytics...</div>;
  if (!analytics) return <div className="text-center py-10 text-lg text-red-600">Failed to load analytics</div>;

  return (
    <div className="max-w-6xl mx-auto p-5">
      <div className="flex justify-between items-center mb-8 p-5 bg-white rounded-lg shadow-sm">
        <h2 className="text-2xl font-bold text-gray-800 m-0">Feedback Analytics</h2>
        <div className="text-center">
          <span className="block text-4xl font-bold text-blue-500">{analytics?.total_responses || 0}</span>
          <span className="text-sm text-gray-600">Total Responses</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 mb-8">
        {analytics?.field_analytics && Object.entries(analytics.field_analytics).map(([fieldName, data]) => (
          <div key={fieldName} className="bg-white p-5 rounded-lg shadow-sm">
            <h3 className="text-base font-semibold text-gray-800 mb-4">{fieldName}</h3>
            <FieldAnalytics data={data} />
          </div>
        ))}
      </div>

      {analytics.response_trend && analytics.response_trend.length > 0 && (
        <div className="bg-white p-5 rounded-lg shadow-sm">
          <h3 className="text-lg font-semibold text-gray-800 mb-5">Response Trend (Last 30 Days)</h3>
          <div className="flex items-end gap-2 h-48 p-3 overflow-x-auto">
            {analytics.response_trend.map((item, index) => (
              <div key={index} className="flex flex-col items-center min-w-16">
                <div
                  className="w-5 bg-blue-500 rounded-t mb-2 min-h-1"
                  style={{
                    height: `${(item.count / Math.max(...analytics.response_trend.map(t => t.count))) * 100}%`
                  }}
                />
                <span className="text-xs text-gray-600 text-center mb-1">{new Date(item.day).toLocaleDateString()}</span>
                <span className="text-xs font-semibold text-gray-800">{item.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const FieldAnalytics = ({ data }) => {
  switch (data.type) {
    case 'rating':
      return (
        <div className="text-center">
          <div className="mb-3">
            <span className="block text-3xl font-bold text-yellow-500 mb-1">{data.average}</span>
            <div className="text-xl">
              {[1, 2, 3, 4, 5].map(star => (
                <span
                  key={star}
                  className={star <= Math.round(data.average) ? 'opacity-100' : 'opacity-30'}
                >
                  ⭐
                </span>
              ))}
            </div>
          </div>
          <p className="text-gray-600">{data.count} responses</p>
        </div>
      );

    case 'choice':
      return (
        <div className="flex flex-col gap-3">
          {data.choices.map((choice, index) => (
            <div key={index} className="flex items-center gap-3">
              <span className="flex-none w-32 text-sm text-gray-800">{choice.choice_value}</span>
              <div className="flex-1 relative h-6 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full transition-all duration-300"
                  style={{
                    width: `${(choice.count / Math.max(...data.choices.map(c => c.count))) * 100}%`
                  }}
                />
                <span className="absolute right-2 top-1/2 transform -translate-y-1/2 text-xs font-semibold text-gray-800">
                  {choice.count}
                </span>
              </div>
            </div>
          ))}
        </div>
      );

    case 'number':
      return (
        <div className="text-center">
          <div className="mb-2">
            <span className="block text-3xl font-bold text-green-500 mb-1">{data.average}</span>
            <span className="text-sm text-gray-600">Average</span>
          </div>
          <p className="text-gray-600">{data.count} responses</p>
        </div>
      );

    default:
      return (
        <div className="text-center text-gray-600">
          <p>{data.count} responses</p>
        </div>
      );
  }
};

export default FeedbackAnalytics;
