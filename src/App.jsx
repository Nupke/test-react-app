import { useState } from 'react';
import './App.css';
import LoginPage from './LoginPage';
import DashboardPage from './DashboardPage';
import UpgraderPage from './UpgraderPage';

const weatherFeatures = [
  {
    icon: '🌡️',
    title: 'Real-Time Forecasts',
    description:
      'Get accurate, up-to-the-minute weather data for any location worldwide.',
  },
  {
    icon: '📍',
    title: 'Location-Based',
    description:
      'Automatic detection of your location for instant local weather updates.',
  },
  {
    icon: '🔔',
    title: 'Severe Weather Alerts',
    description:
      'Stay safe with timely notifications for storms, heat waves, and more.',
  },
  {
    icon: '📊',
    title: '7-Day Forecast',
    description: 'Plan your week ahead with detailed daily and hourly forecasts.',
  },
];

function App() {
  const [page, setPage] = useState('home');
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loggedInUser, setLoggedInUser] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (email) {
      setSubmitted(true);
    }
  };

  const handleLogin = (userEmail) => {
    setLoggedInUser(userEmail);
    setPage('dashboard');
  };

  const handleLogout = () => {
    setLoggedInUser('');
    setPage('home');
  };

  if (page === 'upgrader' && loggedInUser) {
    return (
      <UpgraderPage
        user={loggedInUser}
        onBack={() => setPage('dashboard')}
        steamApiKey=""
      />
    );
  }

  if (page === 'dashboard' && loggedInUser) {
    return (
      <DashboardPage
        user={loggedInUser}
        onLogout={handleLogout}
        onNavigate={setPage}
      />
    );
  }

  if (page === 'login') {
    return <LoginPage onBack={() => setPage('home')} onLogin={handleLogin} />;
  }

  return (
    <div className="app">
      <header className="hero">
        <nav className="nav-bar">
          <p className="hero-badge">Weather App</p>
          <button className="nav-login-btn" onClick={() => setPage('login')}>
            Sign In
          </button>
        </nav>
        <h1 className="hero-title">
          Your Personal
          <br />
          Weather Companion
        </h1>
        <p className="hero-subtitle">
          Accurate forecasts, severe weather alerts, and hyperlocal data — all in
          one beautiful app.
        </p>
        {!submitted ? (
          <form className="signup-form" onSubmit={handleSubmit}>
            <input
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              aria-label="Email address"
            />
            <button type="submit">Get Early Access</button>
          </form>
        ) : (
          <p className="success-message" role="status">
            Thanks! We'll notify you at <strong>{email}</strong> when we launch.
          </p>
        )}
      </header>

      <section className="features" aria-label="Features">
        <h2 className="features-heading">Why Choose Our Weather App?</h2>
        <div className="features-grid">
          {weatherFeatures.map((feature) => (
            <div key={feature.title} className="feature-card">
              <span className="feature-icon" aria-hidden="true">
                {feature.icon}
              </span>
              <h3>{feature.title}</h3>
              <p>{feature.description}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="footer">
        <p>&copy; 2026 Weather App. All rights reserved.</p>
      </footer>
    </div>
  );
}

export default App;
