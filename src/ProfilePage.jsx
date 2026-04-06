import { useState } from 'react';
import './ProfilePage.css';

function ProfilePage({ onBack }) {
  const [name, setName] = useState('Jane Doe');
  const [email, setEmail] = useState('jane.doe@example.com');
  const [notifications, setNotifications] = useState(true);
  const [darkMode, setDarkMode] = useState(false);
  const [unit, setUnit] = useState('celsius');
  const [saved, setSaved] = useState(false);

  const handleSave = (e) => {
    e.preventDefault();
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="profile-page">
      <div className="profile-card">
        <div className="profile-header">
          <div className="profile-avatar" aria-label="User avatar">
            {name
              .split(' ')
              .map((n) => n[0])
              .join('')
              .toUpperCase()}
          </div>
          <h1 className="profile-name">{name}</h1>
          <p className="profile-email">{email}</p>
        </div>

        <form className="profile-form" onSubmit={handleSave}>
          <h2 className="profile-section-title">Personal Info</h2>

          <div className="form-group">
            <label htmlFor="profile-name">Name</label>
            <input
              id="profile-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="profile-email">Email</label>
            <input
              id="profile-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <h2 className="profile-section-title">Account Settings</h2>

          <div className="profile-toggle-group">
            <div className="profile-toggle-row">
              <span>Email Notifications</span>
              <button
                type="button"
                role="switch"
                aria-checked={notifications}
                className={`toggle-btn ${notifications ? 'toggle-on' : ''}`}
                onClick={() => setNotifications(!notifications)}
              >
                <span className="toggle-knob" />
              </button>
            </div>

            <div className="profile-toggle-row">
              <span>Dark Mode</span>
              <button
                type="button"
                role="switch"
                aria-checked={darkMode}
                className={`toggle-btn ${darkMode ? 'toggle-on' : ''}`}
                onClick={() => setDarkMode(!darkMode)}
              >
                <span className="toggle-knob" />
              </button>
            </div>

            <div className="profile-toggle-row">
              <span>Temperature Unit</span>
              <select
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                className="profile-select"
                aria-label="Temperature unit"
              >
                <option value="celsius">Celsius</option>
                <option value="fahrenheit">Fahrenheit</option>
              </select>
            </div>
          </div>

          <button type="submit" className="profile-save-btn">
            Save Changes
          </button>

          {saved && (
            <p className="profile-saved-msg" role="status">
              Settings saved successfully!
            </p>
          )}
        </form>

        {onBack && (
          <button type="button" className="profile-back-btn" onClick={onBack}>
            Back to Home
          </button>
        )}
      </div>
    </div>
  );
}

export default ProfilePage;
