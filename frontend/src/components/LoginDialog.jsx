// components/LoginDialog.jsx
import { useState } from "react";
import { createPortal } from "react-dom";

/**
 * Modal login dialog rendered via a React portal directly on document.body.
 *
 * Props:
 *   title       {string}    - Dialog heading (optional)
 *   description {string}    - Subtitle / instruction text (optional)
 *   onLogin     {Function}  - async (username, password) => void — throws on failure
 *   onCancel    {Function}  - Called when the user dismisses the dialog
 */
export default function LoginDialog({ title, description, onLogin, onCancel }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Strip the domain portion if the user types an email-style username
  const extractUsername = (input) =>
    input.includes("@") ? input.split("@")[0] : input;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError("Please enter both username and password");
      return;
    }
    setError("");
    setLoading(true);
    try {
      await onLogin(extractUsername(username.trim()), password);
    } catch (loginError) {
      setError(loginError.message);
    } finally {
      setLoading(false);
    }
  };

  return createPortal(
    <div className="login-overlay">
      <div className="login-dialog">
        <h2>{title || "MQ Administrator Login"}</h2>
        <p>{description || "Please enter your IBM MQ credentials to access the dashboard."}</p>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="username">Username:</label>
            <input
              type="text"
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              required
              disabled={loading}
            />
          </div>
          <div className="form-group">
            <div className="password-label-wrapper">
              <label htmlFor="password">Password:</label>
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword(!showPassword)}
                title={showPassword ? "Hide password" : "Show password"}
                disabled={loading}
              >
                {showPassword ? "🙈 Hide" : "👁️ Show"}
              </button>
            </div>
            <input
              type={showPassword ? "text" : "password"}
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
              disabled={loading}
            />
          </div>
          {error && <div className="login-error">{error}</div>}
          <div className="login-buttons">
            <button type="button" onClick={onCancel} className="cancel-btn" disabled={loading}>
              Cancel
            </button>
            <button type="submit" className="login-btn" disabled={loading}>
              {loading ? "Logging in..." : "Login"}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
