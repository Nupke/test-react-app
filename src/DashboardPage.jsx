import './DashboardPage.css';

const stats = [
  { label: 'Total Views', value: '12,453', change: '+12%', positive: true },
  { label: 'Active Users', value: '3,721', change: '+8%', positive: true },
  { label: 'Alerts Sent', value: '842', change: '-3%', positive: false },
  { label: 'Uptime', value: '99.9%', change: '+0.1%', positive: true },
];

const recentActions = [
  {
    id: 1,
    action: 'New weather alert created',
    location: 'New York, NY',
    time: '2 minutes ago',
  },
  {
    id: 2,
    action: 'Forecast updated',
    location: 'San Francisco, CA',
    time: '15 minutes ago',
  },
  {
    id: 3,
    action: 'User report submitted',
    location: 'Chicago, IL',
    time: '1 hour ago',
  },
  {
    id: 4,
    action: 'Alert threshold changed',
    location: 'Miami, FL',
    time: '3 hours ago',
  },
  {
    id: 5,
    action: 'New location added',
    location: 'Seattle, WA',
    time: '5 hours ago',
  },
];

function DashboardPage({ user, onLogout }) {
  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <div className="dashboard-header-left">
          <h1 className="dashboard-title">Dashboard</h1>
          <p className="dashboard-welcome">Welcome back, {user}</p>
        </div>
        <button className="dashboard-logout-btn" onClick={onLogout}>
          Sign Out
        </button>
      </header>

      <section className="stats-grid" aria-label="Statistics">
        {stats.map((stat) => (
          <div key={stat.label} className="stat-card">
            <p className="stat-label">{stat.label}</p>
            <p className="stat-value">{stat.value}</p>
            <p className={`stat-change ${stat.positive ? 'positive' : 'negative'}`}>
              {stat.change}
            </p>
          </div>
        ))}
      </section>

      <section className="recent-actions" aria-label="Recent actions">
        <h2 className="section-heading">Recent Actions</h2>
        <div className="actions-list">
          {recentActions.map((item) => (
            <div key={item.id} className="action-item">
              <div className="action-info">
                <p className="action-text">{item.action}</p>
                <p className="action-location">{item.location}</p>
              </div>
              <p className="action-time">{item.time}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

export default DashboardPage;
