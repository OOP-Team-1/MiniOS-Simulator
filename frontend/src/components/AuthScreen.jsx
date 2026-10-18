import React, { useMemo, useState } from 'react';
import { AlertTriangle, ArrowRight, Lock, Monitor, ShieldCheck, User, UserPlus, Users } from 'lucide-react';
import { accountExists, listKnownUsers, loginAccount, registerAccount } from '../lib/accountStore';
import { userKey } from '../lib/user';

// First-run / login gate. The simulator's home screen is only reachable once an
// account has been authenticated; the session itself is intentionally kept in
// React state only (see App.jsx), so a page refresh always returns here.
export default function AuthScreen({ onAuthenticated }) {
    const knownUsers = useMemo(() => listKnownUsers(), []);
    const [mode, setMode] = useState(knownUsers.length ? 'login' : 'register');
    const [username, setUsername] = useState(knownUsers[0] || '');
    const [password, setPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);

    const submit = async (event) => {
        event.preventDefault();
        setError('');

        const name = username.trim();
        if (!name) return setError('Enter a username.');
        if (!password) return setError('Enter a password.');

        setBusy(true);
        try {
            if (mode === 'register') {
                if (password !== confirm) throw new Error('The two passwords do not match.');
                if (await accountExists(name)) {
                    throw new Error('That username already exists on this device. Try logging in instead.');
                }
                const user = await registerAccount(name, password);
                await onAuthenticated(user, true);
            } else {
                const user = await loginAccount(name, password);
                if (!user) throw new Error('Incorrect username or password.');
                await onAuthenticated(user, false);
            }
        } catch (err) {
            setError(err.message || 'Something went wrong.');
            setBusy(false);
        }
    };

    const chooseUser = (user) => {
        setMode('login');
        setUsername(user);
        setPassword('');
        setConfirm('');
        setError('');
    };

    return (
        <div className="relative flex h-screen w-screen items-center justify-center overflow-hidden bg-gradient-to-br from-[#1d3b57] via-[#2f3f6b] to-[#4a3566] px-4 text-slate-200">
            <div className="pointer-events-none absolute inset-0 opacity-40" aria-hidden="true">
                <div className="absolute -right-40 -top-44 h-[34rem] w-[34rem] rounded-full border border-white/[0.06]" />
                <div className="absolute -right-20 -top-24 h-[26rem] w-[26rem] rounded-full border border-white/[0.05]" />
                <div className="absolute bottom-[-19rem] left-[20%] h-[38rem] w-[38rem] rounded-full border border-white/[0.05]" />
            </div>

            <div className="relative z-10 w-full max-w-md rounded-2xl border border-white/[0.16] bg-slate-950/[0.42] p-7 shadow-[0_30px_90px_rgba(0,0,0,0.45)] ring-1 ring-white/[0.05] backdrop-blur-2xl">
                <div className="mb-6 flex items-center gap-3">
                    <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/[0.14] bg-white/[0.08] text-sky-200">
                        <Monitor className="h-6 w-6" strokeWidth={1.7} />
                    </span>
                    <div>
                        <h1 className="text-lg font-semibold tracking-tight text-white">MINIOS</h1>
                        <p className="text-[11px] text-slate-300/80">Desktop operating-system simulator</p>
                    </div>
                </div>

                <div className="mb-5 inline-flex w-full rounded-lg border border-white/[0.1] bg-black/25 p-0.5">
                    {['login', 'register'].map((option) => (
                        <button
                            key={option}
                            type="button"
                            onClick={() => { setMode(option); setError(''); }}
                            className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition ${
                                mode === option ? 'bg-white/[0.12] text-white' : 'text-slate-400 hover:text-slate-200'
                            }`}
                        >
                            {option === 'login' ? 'Sign in' : 'Create account'}
                        </button>
                    ))}
                </div>

                {mode === 'login' && knownUsers.length > 0 && (
                    <div className="mb-5">
                        <p className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                            <Users className="h-3.5 w-3.5" /> Returning users
                        </p>
                        <div className="flex flex-wrap gap-2">
                            {knownUsers.map((user) => (
                                <button
                                    key={userKey(user)}
                                    type="button"
                                    onClick={() => chooseUser(user)}
                                    className={`rounded-lg border px-3 py-1.5 text-xs transition ${
                                        userKey(username) === userKey(user)
                                            ? 'border-sky-300/40 bg-sky-400/15 text-sky-100'
                                            : 'border-white/[0.12] bg-white/[0.05] text-slate-200 hover:bg-white/[0.1]'
                                    }`}
                                >
                                    {user}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                <form onSubmit={submit} className="space-y-4">
                    <label className="block">
                        <span className="mb-1.5 block text-[10px] font-medium uppercase tracking-[0.12em] text-slate-400">Username</span>
                        <div className="flex items-center gap-2 rounded-lg border border-white/[0.12] bg-black/30 px-3 focus-within:border-sky-300/50">
                            <User className="h-4 w-4 shrink-0 text-slate-400" />
                            <input
                                autoFocus
                                value={username}
                                onChange={(event) => setUsername(event.target.value)}
                                placeholder="e.g. student"
                                autoComplete="username"
                                className="min-w-0 flex-1 border-0 bg-transparent py-2.5 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:outline-none"
                            />
                        </div>
                    </label>

                    <label className="block">
                        <span className="mb-1.5 block text-[10px] font-medium uppercase tracking-[0.12em] text-slate-400">Password</span>
                        <div className="flex items-center gap-2 rounded-lg border border-white/[0.12] bg-black/30 px-3 focus-within:border-sky-300/50">
                            <Lock className="h-4 w-4 shrink-0 text-slate-400" />
                            <input
                                type="password"
                                value={password}
                                onChange={(event) => setPassword(event.target.value)}
                                placeholder="••••••••"
                                autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                                className="min-w-0 flex-1 border-0 bg-transparent py-2.5 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:outline-none"
                            />
                        </div>
                    </label>

                    {mode === 'register' && (
                        <label className="block">
                            <span className="mb-1.5 block text-[10px] font-medium uppercase tracking-[0.12em] text-slate-400">Confirm password</span>
                            <div className="flex items-center gap-2 rounded-lg border border-white/[0.12] bg-black/30 px-3 focus-within:border-sky-300/50">
                                <ShieldCheck className="h-4 w-4 shrink-0 text-slate-400" />
                                <input
                                    type="password"
                                    value={confirm}
                                    onChange={(event) => setConfirm(event.target.value)}
                                    placeholder="••••••••"
                                    autoComplete="new-password"
                                    className="min-w-0 flex-1 border-0 bg-transparent py-2.5 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:outline-none"
                                />
                            </div>
                        </label>
                    )}

                    {error && (
                        <p className="flex items-start gap-2 rounded-lg border border-rose-400/25 bg-rose-500/10 px-3 py-2 text-[11px] text-rose-200">
                            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                            <span>{error}</span>
                        </p>
                    )}

                    <button
                        type="submit"
                        disabled={busy}
                        className="flex w-full items-center justify-center gap-2 rounded-lg bg-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-900 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        {busy ? 'Working…' : mode === 'register' ? (<><UserPlus className="h-4 w-4" /> Create & sign in</>) : (<><ArrowRight className="h-4 w-4" /> Sign in</>)}
                    </button>
                </form>

                <p className="mt-5 text-[10px] leading-5 text-slate-400/80">
                    Accounts are stored only in this browser (IndexedDB). Passwords are salted and hashed with
                    PBKDF2-SHA256; this is a simulator, not a secure credential store, so please don't reuse a real password.
                </p>
            </div>
        </div>
    );
}
