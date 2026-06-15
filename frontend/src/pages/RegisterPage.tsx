import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function RegisterPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await register(email, password, name);
      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--color-surface-0)' }}>
      <div className="w-full max-w-sm p-8 rounded-xl" style={{ background: 'var(--color-surface-1)', border: '1px solid var(--color-border)' }}>
        <div className="mb-8 text-center">
          <h1 className="text-xl font-semibold" style={{ color: 'var(--color-text)' }}>Create Account</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>Get started with DeepResearch</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="px-3 py-2 rounded text-sm" style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }}>{error}</div>
          )}
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-muted)' }}>Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 rounded-lg text-sm outline-none transition-colors"
              style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
              onFocus={(e) => e.currentTarget.style.borderColor = 'var(--color-accent)'}
              onBlur={(e) => e.currentTarget.style.borderColor = 'var(--color-border)'}
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-muted)' }}>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 rounded-lg text-sm outline-none transition-colors"
              style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
              onFocus={(e) => e.currentTarget.style.borderColor = 'var(--color-accent)'}
              onBlur={(e) => e.currentTarget.style.borderColor = 'var(--color-border)'}
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-muted)' }}>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 rounded-lg text-sm outline-none transition-colors"
              style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
              onFocus={(e) => e.currentTarget.style.borderColor = 'var(--color-accent)'}
              onBlur={(e) => e.currentTarget.style.borderColor = 'var(--color-border)'}
              required
              minLength={8}
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-lg text-sm font-medium transition-colors"
            style={{ background: 'var(--color-accent)', color: '#fff', opacity: loading ? 0.5 : 1 }}
          >
            {loading ? 'Creating account...' : 'Create Account'}
          </button>
        </form>
        <p className="mt-6 text-center text-xs" style={{ color: 'var(--color-text-muted)' }}>
          Already have an account?{' '}
          <Link to="/login" style={{ color: 'var(--color-accent)' }} className="hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
