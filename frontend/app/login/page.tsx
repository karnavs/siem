'use client';

import { useState, FormEvent } from 'react';
import { Radar, ShieldCheck, Activity } from 'lucide-react';
import { useAuth, isApiError } from '@/lib/auth';
import { Button } from '@/components/ui/Button';

export default function LoginPage() {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const { login, register } = useAuth();

  const [email, setEmail] = useState('admin@sentrygrid.io');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [organizationName, setOrganizationName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      if (mode === 'login') {
        await login(email, password);
      } else {
        await register({ email, password, name, organizationName });
      }
    } catch (err) {
      setError(isApiError(err) ? err.message : 'Something went wrong. Try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen">
      {/* Left: brand panel */}
      <div className="hidden w-[42%] flex-col justify-between border-r border-base-border bg-base-panel p-10 lg:flex">
        <div className="flex items-center gap-2">
          <Radar className="h-6 w-6 text-signal-amber" />
          <span className="font-display text-lg font-bold text-ink">SentryGrid</span>
        </div>

        <div>
          <h1 className="font-display text-3xl font-bold leading-tight text-ink">
            Detection, triage, and response —<br />
            <span className="text-signal-amber">one console.</span>
          </h1>
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-ink-muted">
            SentryGrid correlates raw security events into MITRE ATT&CK-mapped
            alerts and hands each one to an AI analyst for a first-pass
            summary and remediation steps — so your team triages signal, not noise.
          </p>

          <div className="mt-8 space-y-3">
            {[
              { icon: ShieldCheck, text: 'Rule-based detection engine mapped to MITRE ATT&CK' },
              { icon: Activity, text: 'AI-assisted alert triage with confidence scoring' },
            ].map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-start gap-3 text-sm text-ink-muted">
                <Icon className="mt-0.5 h-4 w-4 shrink-0 text-signal-cyan" />
                {text}
              </div>
            ))}
          </div>
        </div>

        <p className="font-mono text-[11px] text-ink-faint">v1.0.0 · ap-south-1</p>
      </div>

      {/* Right: form */}
      <div className="flex flex-1 items-center justify-center bg-base p-6">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex gap-1 rounded-lg border border-base-border bg-base-panel p-1">
            {(['login', 'register'] as const).map((m) => (
              <button
                key={m}
                onClick={() => {
                  setMode(m);
                  setError(null);
                }}
                className={`flex-1 rounded-md py-2 text-sm font-medium transition-colors ${
                  mode === m ? 'bg-signal-amber text-base' : 'text-ink-muted hover:text-ink'
                }`}
              >
                {m === 'login' ? 'Sign in' : 'Create account'}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'register' && (
              <>
                <Field label="Full name" value={name} onChange={setName} placeholder="Avery Admin" required />
                <Field
                  label="Organization"
                  value={organizationName}
                  onChange={setOrganizationName}
                  placeholder="Acme Corp"
                  required
                />
              </>
            )}
            <Field label="Email" type="email" value={email} onChange={setEmail} placeholder="you@company.com" required />
            <Field
              label="Password"
              type="password"
              value={password}
              onChange={setPassword}
              placeholder="••••••••"
              required
            />

            {error && (
              <p className="rounded-lg border border-severity-critical/30 bg-severity-critical/10 px-3 py-2 text-sm text-severity-critical">
                {error}
              </p>
            )}

            <Button type="submit" disabled={submitting} className="w-full">
              {submitting ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}
            </Button>
          </form>

          {mode === 'login' && (
            <div className="mt-6 rounded-lg border border-base-border bg-base-panel p-4 text-xs text-ink-muted">
              <p className="mb-1.5 font-medium text-ink">Demo credentials</p>
              <p className="font-mono">admin@sentrygrid.io / Password123!</p>
              <p className="font-mono">analyst@sentrygrid.io / Password123!</p>
              <p className="font-mono">viewer@sentrygrid.io / Password123!</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-ink-muted">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        className="w-full rounded-lg border border-base-border bg-base-panel px-3 py-2.5 text-sm text-ink placeholder:text-ink-faint focus:border-signal-amber focus:outline-none"
      />
    </label>
  );
}
