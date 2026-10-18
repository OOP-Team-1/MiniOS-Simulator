import React from 'react';
import { AlertTriangle } from 'lucide-react';

// Shown only when the editor has unsaved changes and the user tries to close it.
// Deliberately three explicit choices so nothing is lost by accident.
export default function UnsavedChangesDialog({ fileName, busy, onSave, onDiscard, onCancel }) {
    return (
        <div className="absolute inset-0 z-[130] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm">
            <div className="w-full max-w-sm rounded-2xl border border-white/[0.16] bg-[#202630]/97 p-5 shadow-[0_24px_80px_rgba(0,0,0,0.5)] backdrop-blur-2xl">
                <div className="mb-3 flex items-start gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-amber-300/25 bg-amber-400/10 text-amber-200">
                        <AlertTriangle className="h-5 w-5" strokeWidth={1.8} />
                    </span>
                    <div className="min-w-0">
                        <h3 className="text-sm font-semibold text-white">Save changes?</h3>
                        <p className="mt-1 text-[11px] leading-5 text-slate-400">
                            <span className="font-medium text-slate-200">{fileName}</span> has unsaved changes. Saving writes
                            them to the simulated filesystem; discarding cannot be undone.
                        </p>
                    </div>
                </div>

                <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                    <button
                        type="button"
                        onClick={onCancel}
                        disabled={busy}
                        className="rounded-lg border border-white/[0.12] px-3.5 py-2 text-xs text-slate-300 transition hover:bg-white/[0.06] disabled:opacity-60"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={onDiscard}
                        disabled={busy}
                        className="rounded-lg border border-rose-400/30 bg-rose-500/10 px-3.5 py-2 text-xs font-medium text-rose-200 transition hover:bg-rose-500/20 disabled:opacity-60"
                    >
                        Don't save
                    </button>
                    <button
                        type="button"
                        onClick={onSave}
                        disabled={busy}
                        className="rounded-lg bg-slate-100 px-4 py-2 text-xs font-semibold text-slate-900 transition hover:bg-white disabled:opacity-60"
                    >
                        {busy ? 'Saving…' : 'Save'}
                    </button>
                </div>
            </div>
        </div>
    );
}
