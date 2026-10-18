import { io } from 'socket.io-client';

// Single shared socket.io connection for the whole app. Both the desktop
// (App.jsx) and the file editor talk to the backend through it, so the real
// C++ engine remains the one source of truth for command results.
const BACKEND_URL = import.meta.env?.VITE_BACKEND_URL || 'http://localhost:5000';

export const socket = io(BACKEND_URL, { autoConnect: true });

// Resolves with the first payload for `event` that satisfies `predicate`.
// Used for request/response flows (editor save, file read) where the engine
// answers with a one-shot result event that carries a correlation id.
export function awaitSocketEvent(event, predicate = () => true, timeoutMs = 10000) {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            socket.off(event, handler);
            reject(new Error(`Timed out waiting for "${event}"`));
        }, timeoutMs);

        function handler(payload) {
            if (!predicate(payload)) return;
            clearTimeout(timer);
            socket.off(event, handler);
            resolve(payload);
        }

        socket.on(event, handler);
    });
}
