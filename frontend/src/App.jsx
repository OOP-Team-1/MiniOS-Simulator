import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity, ArrowUp, Battery, Check, ChevronDown, ChevronRight, Clock3, Cpu, FileText,
  Folder, FolderPlus, FolderOpen, HardDrive, LayoutGrid, FilePlus, LogOut, Maximize2,
  Minimize2, Monitor, Moon, NotepadText, Pause, Pencil, Plus, Power, Play, RotateCcw, Search, Settings, ShieldCheck,
  SlidersHorizontal, Terminal, Trash2, Wifi, X, Zap,
} from 'lucide-react';
import { socket } from './lib/socket';
import { normalizeUser } from './lib/user';
import AuthScreen from './components/AuthScreen';
import TextEditor from './components/TextEditor';
import { loadBrowserSnapshotRecord, saveBrowserSnapshot } from './lib/vfsStore';

const ANSI_PATTERN = /\u001b\[[0-9;]*[A-Za-z]/g;
const stripAnsi = (text) => String(text ?? '').replace(ANSI_PATTERN, '');

const INITIAL_APPS = [
  { id: 'process-manager', title: 'Processes', subtitle: 'Process manager', icon: Cpu },
  { id: 'scheduler', title: 'Scheduler', subtitle: 'CPU scheduling lab', icon: Activity },
  { id: 'terminal', title: 'Terminal', subtitle: 'MINIOS shell', icon: Terminal },
  { id: 'file-manager', title: 'Files', subtitle: 'Virtual file system', icon: FolderOpen },
  { id: 'text-editor', title: 'Text Editor', subtitle: 'Notepad for .txt files', icon: NotepadText },
  { id: 'memory', title: 'Memory', subtitle: 'Memory and paging', icon: HardDrive },
  { id: 'system-monitor', title: 'System Monitor', subtitle: 'System telemetry', icon: Monitor },
  { id: 'settings', title: 'Settings', subtitle: 'Appearance and system', icon: Settings },
];

const INITIAL_WINDOWS = [
  { id: 'process-manager', title: 'Processes', isOpen: true, isMinimized: false, isMaximized: false, zIndex: 10, x: 118, y: 86, w: 900, h: 560 },
  { id: 'scheduler', title: 'CPU Scheduling Lab', isOpen: false, isMinimized: false, isMaximized: false, zIndex: 5, x: 160, y: 104, w: 900, h: 570 },
  { id: 'terminal', title: 'Terminal', isOpen: false, isMinimized: false, isMaximized: false, zIndex: 4, x: 185, y: 120, w: 760, h: 480 },
  { id: 'file-manager', title: 'Files', isOpen: false, isMinimized: false, isMaximized: false, zIndex: 3, x: 145, y: 96, w: 860, h: 540 },
  { id: 'text-editor', title: 'Text Editor', isOpen: false, isMinimized: false, isMaximized: false, zIndex: 9, x: 165, y: 92, w: 880, h: 560 },
  { id: 'memory', title: 'Memory and Paging', isOpen: false, isMinimized: false, isMaximized: false, zIndex: 2, x: 165, y: 105, w: 860, h: 550 },
  { id: 'system-monitor', title: 'System Monitor', isOpen: false, isMinimized: false, isMaximized: false, zIndex: 1, x: 190, y: 125, w: 820, h: 520 },
  { id: 'settings', title: 'Settings', isOpen: false, isMinimized: false, isMaximized: false, zIndex: 0, x: 205, y: 130, w: 760, h: 500 },
];

const DEFAULT_PINNED_APPS = INITIAL_APPS.filter((app) => app.id !== 'settings').map((app) => app.id);
const PINNED_STORAGE_KEY = 'minios:pinnedApps';

const getFileKey = (file) => file.id;

let editorRequestSeq = 0;

function getDisplayPath(dirId, directories) {
  if (!dirId || dirId === 'D0') return '/';
  const map = new Map(directories.map((d) => [d.dirId, d]));
  const segments = [];
  let curr = dirId;
  let guard = 0;
  while (curr && curr !== 'D0' && guard < directories.length + 1) {
    const d = map.get(curr);
    if (!d) break;
    segments.unshift(d.name);
    curr = d.parentDirId;
    guard++;
  }
  return '/' + segments.join('/');
}

const APP_TONES = {
  'process-manager': 'text-sky-300 bg-sky-400/10 border-sky-300/20',
  scheduler: 'text-emerald-300 bg-emerald-400/10 border-emerald-300/20',
  terminal: 'text-violet-300 bg-violet-400/10 border-violet-300/20',
  'file-manager': 'text-amber-300 bg-amber-400/10 border-amber-300/20',
  'text-editor': 'text-orange-300 bg-orange-400/10 border-orange-300/20',
  memory: 'text-blue-300 bg-blue-400/10 border-blue-300/20',
  'system-monitor': 'text-rose-300 bg-rose-400/10 border-rose-300/20',
  settings: 'text-zinc-300 bg-zinc-400/10 border-zinc-300/20',
};

const PROC_PALETTE = [
  { bg: 'bg-sky-400/[0.18]', border: 'border-sky-400/40', text: 'text-sky-200', dot: 'bg-sky-400' },
  { bg: 'bg-emerald-400/[0.18]', border: 'border-emerald-400/40', text: 'text-emerald-200', dot: 'bg-emerald-400' },
  { bg: 'bg-violet-400/[0.18]', border: 'border-violet-400/40', text: 'text-violet-200', dot: 'bg-violet-400' },
  { bg: 'bg-amber-400/[0.18]', border: 'border-amber-400/40', text: 'text-amber-200', dot: 'bg-amber-400' },
  { bg: 'bg-rose-400/[0.18]', border: 'border-rose-400/40', text: 'text-rose-200', dot: 'bg-rose-400' },
  { bg: 'bg-teal-400/[0.18]', border: 'border-teal-400/40', text: 'text-teal-200', dot: 'bg-teal-400' },
  { bg: 'bg-fuchsia-400/[0.18]', border: 'border-fuchsia-400/40', text: 'text-fuchsia-200', dot: 'bg-fuchsia-400' },
];

function getProcColor(pid) {
  if (!pid) return { bg: 'border-white/[0.04] bg-white/[0.02]', border: 'border-white/[0.04]', text: 'text-slate-600', dot: 'bg-slate-700' };
  let hash = 0;
  for (let i = 0; i < pid.length; i++) hash = (hash << 5) - hash + pid.charCodeAt(i);
  return PROC_PALETTE[Math.abs(hash) % PROC_PALETTE.length];
}

function runSchedulingSimulation(processes, algorithm, quantum) {
  const jobs = processes
    .map((p) => ({ ...p, remaining: Math.max(1, Number(p.burst) || 1), start: null, completion: null, waiting: 0 }))
    .sort((a, b) => (a.arrival || 0) - (b.arrival || 0) || String(a.pid).localeCompare(String(b.pid)));

  if (!jobs.length) return { timeline: [], averageWaiting: 0, averageTurnaround: 0 };

  const timeline = [];
  let time = 0;
  const completed = [];
  const addSlice = (job, duration) => {
    if (duration <= 0) return;
    const start = time;
    time += duration;
    job.remaining -= duration;
    timeline.push({ pid: job.pid, name: job.name, start, end: time, duration });
  };

  if (algorithm === 'RR') {
    const pending = [...jobs];
    const queue = [];
    const q = Math.max(1, Number(quantum) || 1);
    while (pending.length || queue.length) {
      while (pending.length && (pending[0].arrival || 0) <= time) queue.push(pending.shift());
      if (!queue.length) {
        time = pending[0].arrival || time + 1;
        continue;
      }
      const job = queue.shift();
      if (job.start === null) job.start = time;
      const slice = Math.min(q, job.remaining);
      addSlice(job, slice);
      while (pending.length && (pending[0].arrival || 0) <= time) queue.push(pending.shift());
      if (job.remaining > 0) queue.push(job);
      else {
        job.completion = time;
        completed.push(job);
      }
    }
  } else {
    const pending = [...jobs];
    while (pending.length) {
      const available = pending.filter((p) => (p.arrival || 0) <= time);
      if (!available.length) {
        time = pending[0].arrival || time + 1;
        continue;
      }
      let selected;
      if (algorithm === 'SJF') {
        selected = available.sort((a, b) => a.burst - b.burst || (a.arrival || 0) - (b.arrival || 0))[0];
      } else if (algorithm === 'PRIORITY') {
        selected = available.sort((a, b) => a.priority - b.priority || (a.arrival || 0) - (b.arrival || 0))[0];
      } else {
        selected = available.sort((a, b) => (a.arrival || 0) - (b.arrival || 0))[0];
      }
      if (selected.start === null) selected.start = time;
      addSlice(selected, selected.remaining);
      selected.completion = time;
      completed.push(selected);
      pending.splice(pending.findIndex((p) => p.pid === selected.pid), 1);
    }
  }

  const waitingTotal = completed.reduce((sum, p) => sum + Math.max(0, p.completion - (p.arrival || 0) - p.burst), 0);
  const turnaroundTotal = completed.reduce((sum, p) => sum + (p.completion - (p.arrival || 0)), 0);
  return {
    timeline,
    averageWaiting: (waitingTotal / completed.length).toFixed(1),
    averageTurnaround: (turnaroundTotal / completed.length).toFixed(1),
  };
}

function AppIcon({ app, size = 'md' }) {
  const Icon = app.icon;
  const dimensions = size === 'sm' ? 'h-4 w-4' : size === 'lg' ? 'h-6 w-6' : 'h-5 w-5';
  return <Icon className={dimensions} strokeWidth={1.8} />;
}

function SectionHeading({ eyebrow, title, description, icon: Icon, action }) {
  return (
    <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 rounded-xl border border-white/10 bg-white/[0.045] p-2.5 text-slate-300">
          <Icon className="h-5 w-5" strokeWidth={1.8} />
        </div>
        <div>
          {eyebrow && <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">{eyebrow}</p>}
          <h2 className="text-base font-semibold tracking-tight text-slate-100">{title}</h2>
          {description && <p className="mt-1 text-xs leading-5 text-slate-400">{description}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}

function StatCard({ label, value, helper, icon: Icon }) {
  return (
    <div className="rounded-xl border border-white/[0.08] bg-white/[0.025] p-4">
      <div className="flex items-center justify-between text-slate-400">
        <span className="text-xs">{label}</span>
        <Icon className="h-4 w-4" strokeWidth={1.8} />
      </div>
      <div className="mt-3 text-2xl font-semibold tracking-tight text-slate-100">{value}</div>
      {helper && <div className="mt-1 text-[11px] text-slate-500">{helper}</div>}
    </div>
  );
}

export default function App() {
  const [theme, setTheme] = useState('ocean');
  const [wallpaperImage, setWallpaperImage] = useState('/wallpaper.jpg');
  const [wallpaperName, setWallpaperName] = useState('pexels-hakantahmaz-6015200.jpg');
  const [iconSize, setIconSize] = useState('md');
  const [dockPosition, setDockPosition] = useState('left');
  const [pinnedApps, setPinnedApps] = useState(() => {
    try {
      const saved = localStorage.getItem(PINNED_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // ignore storage errors
    }
    return DEFAULT_PINNED_APPS;
  });
  const [dockContextMenu, setDockContextMenu] = useState(null);
  const [dockTooltip, setDockTooltip] = useState(null);
  const [windows, setWindows] = useState(INITIAL_WINDOWS);
  const [activeWindow, setActiveWindow] = useState('process-manager');
  const [topZ, setTopZ] = useState(20);
  const [appLauncherOpen, setAppLauncherOpen] = useState(false);
  const [quickSettingsOpen, setQuickSettingsOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [draggingWin, setDraggingWin] = useState(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [logoError, setLogoError] = useState(false);

  const [processes, setProcesses] = useState([]);
  const [ganttTimeline, setGanttTimeline] = useState([]);
  const [schedulerMetrics, setSchedulerMetrics] = useState({ averageWaiting: '—', averageTurnaround: '—' });
  const [schedulerLog, setSchedulerLog] = useState(['[system] Listening for C++ Engine telemetry...']);

  const [newProcName, setNewProcName] = useState('');
  const [newProcBurst, setNewProcBurst] = useState('10');
  const [newProcPriority, setNewProcPriority] = useState('1');
  const [newProcMemory, setNewProcMemory] = useState('10');
  const [newProcArrival, setNewProcArrival] = useState('0');
  const [currentTick, setCurrentTick] = useState(0);
  const [isClockRunning, setIsClockRunning] = useState(false);

  const [schedAlgo, setSchedAlgo] = useState('RR');
  const [timeQuantum, setTimeQuantum] = useState(3);

  const [termInput, setTermInput] = useState('');
  const [termHistory, setTermHistory] = useState(['MINIOS shell 2.4.0', 'Type help to see supported commands.', '']);
  const [fsDirectories, setFsDirectories] = useState([
    { dirId: 'D0', name: '/', parentDirId: '', createdAt: 0 }
  ]);
  const [fsFiles, setFsFiles] = useState([]);
  const [currentDirId, setCurrentDirId] = useState('D0');
  const [memoryStats, setMemoryStats] = useState(null);
  const [pagingStats, setPagingStats] = useState(null);
  const [memoryTab, setMemoryTab] = useState('paging');
  const [selectedPagingPID, setSelectedPagingPID] = useState('ALL');
  const [testLogicalAddr, setTestLogicalAddr] = useState('0');
  const [activeAllocStrategy, setActiveAllocStrategy] = useState('FirstFit');
  const [diskStats, setDiskStats] = useState(null);
  const [newItemType, setNewItemType] = useState(null);
  const [newItemName, setNewItemName] = useState('');
  const [contextMenu, setContextMenu] = useState(null);
  const [contextNewOpen, setContextNewOpen] = useState(false);
  const [selectedFileKeys, setSelectedFileKeys] = useState([]);
  const [fileClipboard, setFileClipboard] = useState(null);
  const [selectionBox, setSelectionBox] = useState(null);

  const [editorTabs, setEditorTabs] = useState([]);
  const [activeEditorTab, setActiveEditorTab] = useState(null);
  const [editorOpenRequest, setEditorOpenRequest] = useState(null);
  const [renameTarget, setRenameTarget] = useState(null);
  const [renameName, setRenameName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [toast, setToast] = useState('');

  const [session, setSession] = useState(null);
  const [shellPrompt, setShellPrompt] = useState('');
  const sessionRef = useRef(null);
  const deletedPidsRef = useRef(new Set());

  const overviewSearchRef = useRef(null);
  const terminalEndRef = useRef(null);
  const terminalInputRef = useRef(null);
  const fileListRef = useRef(null);
  const pendingHomeRef = useRef(null);

  useEffect(() => {
    try {
      localStorage.setItem(PINNED_STORAGE_KEY, JSON.stringify(pinnedApps));
    } catch {
      // ignore storage errors
    }
  }, [pinnedApps]);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    socket.on('telemetry:update', (data) => {
      if (data && data.processes) {
        const translatedProcesses = data.processes
          .map((p) => {
            const pid = p.pid ?? p.id ?? p.processId ?? '?';
            const rawState = String(p.state ?? p.status ?? 'READY').toUpperCase();
            const rawRemaining = p.remaining ?? p.remainingTime ?? p.remaining_time ?? 0;
            return {
              ...p,
              pid,
              name: p.name ?? p.process_name ?? 'Unknown',
              state: rawState,
              priority: p.priority ?? 1,
              burst: p.burst ?? p.burstTime ?? p.burst_time ?? p.total_time ?? '?',
              remaining: rawState === 'TERMINATED' ? 0 : rawRemaining,
            };
          })
          .filter((p) => !deletedPidsRef.current.has(p.pid));

        setProcesses(translatedProcesses);

        if (typeof data.tick === 'number') {
          setCurrentTick(data.tick);
        }

        const allDone = translatedProcesses.length > 0 && translatedProcesses.every((p) => p.state === 'TERMINATED');
        if (allDone) {
          socket.emit('timer:pause');
          setIsClockRunning(false);
        }

        if (data.timeline && data.timeline.length > 0) setGanttTimeline(data.timeline);
        if (data.metrics && data.metrics.averageWaiting) {
          setSchedulerMetrics({
            averageWaiting: data.metrics.averageWaiting,
            averageTurnaround: data.metrics.averageTurnaround,
          });
        }
      }
      if (data.config && data.config.allocStrategy) {
        setActiveAllocStrategy(data.config.allocStrategy);
      }
      if (data.memory) {
        setMemoryStats(data.memory);
      }
      if (data.paging) {
        setPagingStats(data.paging);
      }

      if (data.filesystem) {
        setDiskStats(data.filesystem);
        const dirs = data.filesystem.directories || [];
        const files = data.filesystem.files || [];
        setFsDirectories(dirs);
        setFsFiles(files);

        if (pendingHomeRef.current) {
          const homeName = pendingHomeRef.current;
          const homeDir = dirs.find((d) => d.name === homeName);
          if (homeDir) {
            pendingHomeRef.current = null;
            setSelectedFileKeys([]);
            setCurrentDirId(homeDir.dirId);
            socket.emit('cmd:set_cwd', { dirId: homeDir.dirId });
          }
        }

        setCurrentDirId((prevDirId) => (dirs.some((d) => d.dirId === prevDirId) ? prevDirId : 'D0'));
      }
    });

    socket.on('engine:restarted', (data) => {
      deletedPidsRef.current.clear();
      setToast(data.message);
      setProcesses([]);
      setGanttTimeline([]);
    });

    socket.on('engine:command_error', (data) => {
      setToast(`Engine Error: ${data.message}`);
    });

    return () => {
      socket.off('telemetry:update');
      socket.off('engine:restarted');
      socket.off('engine:command_error');
    };
  }, []);

  useEffect(() => {
    socket.on('vfs:snapshot', (data) => {
      if (data && data.user && typeof data.snapshot === 'string' && data.snapshot) {
        saveBrowserSnapshot(data.user, data.snapshot);
      }
    });

    const handleConnect = () => {
      const current = sessionRef.current;
      if (!current) return;
      pendingHomeRef.current = normalizeUser(current.user);
      loadBrowserSnapshotRecord(current.user)
        .then((record) => {
          socket.emit('vfs:load', {
            user: current.user,
            snapshot: record?.snapshot ?? null,
            snapshotUpdatedAt: record?.updatedAt ?? null,
          });
        })
        .catch(() => {
          socket.emit('vfs:load', { user: current.user, snapshot: null, snapshotUpdatedAt: null });
        });
    };
    socket.on('connect', handleConnect);

    socket.on('shell:result', (data) => {
      if (!data) return;
      const rawOutput = String(data.output ?? '');
      const trimmedCmd = (data.command || '').trim().toLowerCase();

      if (trimmedCmd === 'clear' || trimmedCmd === 'cls' || rawOutput.includes('\u001b[2J')) {
        setTermHistory(['MINIOS shell 2.4.0', '']);
      } else {
        const cleaned = stripAnsi(rawOutput).replace(/\n+$/, '');
        setTermHistory((previous) => (cleaned ? [...previous, cleaned, ''] : [...previous, '']));
      }

      if (data.cwdId) setCurrentDirId(data.cwdId);
      if (data.prompt) setShellPrompt(stripAnsi(data.prompt).replace(/\s+$/, ' '));
    });

    socket.on('cwd:result', (data) => {
      if (data && data.cwdId) setCurrentDirId(data.cwdId);
    });

    return () => {
      socket.off('vfs:snapshot');
      socket.off('connect', handleConnect);
      socket.off('shell:result');
      socket.off('cwd:result');
    };
  }, []);

  useEffect(() => {
    const handleGlobalShortcut = (event) => {
      if (event.key === 'Escape') {
        setAppLauncherOpen(false); setQuickSettingsOpen(false); setContextMenu(null);
        setDockContextMenu(null); setDockTooltip(null); setSelectionBox(null);
        setNewItemType(null);
        return;
      }
      const target = event.target;
      const editingText = target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));
      if (editingText) return;

      const overviewKey = event.key === 'F9' || (event.altKey && event.key === 'F1') || (event.ctrlKey && event.shiftKey && event.code === 'Space');
      if (overviewKey) {
        event.preventDefault();
        setAppLauncherOpen((open) => !open); setQuickSettingsOpen(false); setContextMenu(null); setSearchQuery('');
      }
    };
    window.addEventListener('keydown', handleGlobalShortcut);
    return () => window.removeEventListener('keydown', handleGlobalShortcut);
  }, []);

  useEffect(() => {
    if (!appLauncherOpen) return undefined;
    const timer = setTimeout(() => overviewSearchRef.current?.focus(), 60);
    return () => clearTimeout(timer);
  }, [appLauncherOpen]);

  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [termHistory]);

  useEffect(() => {
    if (!selectionBox) return undefined;
    const handleSelectionMove = (event) => {
      const nextBox = { ...selectionBox, currentX: event.clientX, currentY: event.clientY };
      setSelectionBox(nextBox);
      const left = Math.min(nextBox.startX, nextBox.currentX);
      const right = Math.max(nextBox.startX, nextBox.currentX);
      const top = Math.min(nextBox.startY, nextBox.currentY);
      const bottom = Math.max(nextBox.startY, nextBox.currentY);
      const rows = fileListRef.current?.querySelectorAll('[data-file-key]') || [];
      const matches = [];
      rows.forEach((row) => {
        const rect = row.getBoundingClientRect();
        if (rect.right >= left && rect.left <= right && rect.bottom >= top && rect.top <= bottom) {
          if (row.dataset.fileKey) matches.push(row.dataset.fileKey);
        }
      });
      setSelectedFileKeys(matches);
    };
    const handleSelectionEnd = () => setSelectionBox(null);
    window.addEventListener('mousemove', handleSelectionMove);
    window.addEventListener('mouseup', handleSelectionEnd);
    return () => {
      window.removeEventListener('mousemove', handleSelectionMove);
      window.removeEventListener('mouseup', handleSelectionEnd);
    };
  }, [selectionBox]);

  useEffect(() => {
    if (!draggingWin) return undefined;
    const handleMouseMove = (event) => {
      setWindows((previous) => previous.map((win) => {
        if (win.id !== draggingWin) return win;
        const minX = dockPosition === 'left' ? 88 : 8;
        const rightReserve = dockPosition === 'right' ? 88 : 8;
        const maxX = Math.max(minX, window.innerWidth - 220 - rightReserve);
        const maxY = Math.max(0, window.innerHeight - 100);
        return {
          ...win,
          x: Math.max(minX, Math.min(maxX, event.clientX - dragOffset.x)),
          y: Math.max(0, Math.min(maxY, event.clientY - dragOffset.y)),
        };
      }));
    };
    const handleMouseUp = (event) => {
      const releasedWindowId = draggingWin;
      setDraggingWin(null);
      setDockTooltip(null);
      if (releasedWindowId && event.clientY <= 12) {
        setWindows((previous) => previous.map((win) => win.id === releasedWindowId ? { ...win, isMaximized: true } : win));
      }
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [draggingWin, dragOffset, dockPosition]);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(() => setToast(''), 2400);
    return () => clearTimeout(timer);
  }, [toast]);

  const nonTerminatedProcesses = useMemo(
    () => processes.filter((p) => p.state !== 'TERMINATED'),
    [processes]
  );
  const terminatedProcesses = useMemo(
    () => processes.filter((p) => p.state === 'TERMINATED'),
    [processes]
  );
  const activeProcesses = processes.filter((p) => p.state === 'READY' || p.state === 'RUNNING').length;
  const normalizedSearch = searchQuery.trim().toLowerCase();
  const filteredApps = useMemo(() => INITIAL_APPS.filter((app) => `${app.title} ${app.subtitle}`.toLowerCase().includes(normalizedSearch)), [normalizedSearch]);
  const filteredWindows = useMemo(() => windows.filter((win) => win.isOpen && win.title.toLowerCase().includes(normalizedSearch)), [windows, normalizedSearch]);

  const visibleFiles = useMemo(() => {
    const childDirs = fsDirectories
      .filter((d) => d.parentDirId === currentDirId)
      .map((d) => ({
        id: d.dirId,
        dirId: d.dirId,
        name: d.name,
        type: 'dir',
        size: '—',
        modified: d.createdAt ? `Tick ${d.createdAt}` : 'Init',
        parentDirId: d.parentDirId,
        raw: d,
      }));

    const childFiles = fsFiles
      .filter((f) => f.dirId === currentDirId)
      .map((f) => ({
        id: f.fileId,
        fileId: f.fileId,
        dirId: f.dirId,
        name: f.name,
        type: 'file',
        size: `${f.sizeInBytes || 0} B (${f.sizeInBlocks} blk)`,
        modified: f.lastAccessedAt ? `Tick ${f.lastAccessedAt}` : 'Tick 0',
        parentDirId: f.dirId,
        ownerPID: f.ownerPID,
        raw: f,
      }));

    return [...childDirs, ...childFiles].sort((a, b) =>
      a.type === b.type ? a.name.localeCompare(b.name) : a.type === 'dir' ? -1 : 1
    );
  }, [fsDirectories, fsFiles, currentDirId]);

  const currentPathDisplay = useMemo(() => getDisplayPath(currentDirId, fsDirectories), [currentDirId, fsDirectories]);
  const currentFolderObj = fsDirectories.find((d) => d.dirId === currentDirId);
  const currentFolderLabel = currentFolderObj ? currentFolderObj.name : 'root';
  const isAtFileRoot = currentDirId === 'D0';

  const promptText = shellPrompt || `${session?.user ?? 'user'}@minios:${currentPathDisplay}$ `;

  const breadcrumbTrail = useMemo(() => {
    const map = new Map(fsDirectories.map((d) => [d.dirId, d]));
    const trail = [];
    let curr = currentDirId;
    let guard = 0;
    while (curr && guard < fsDirectories.length + 1) {
      const dir = map.get(curr);
      if (!dir) break;
      trail.unshift({ id: dir.dirId, name: dir.dirId === 'D0' ? 'root' : dir.name });
      if (!dir.parentDirId) break;
      curr = dir.parentDirId;
      guard++;
    }
    return trail.length ? trail : [{ id: 'D0', name: 'root' }];
  }, [currentDirId, fsDirectories]);

  const dockApps = useMemo(() => INITIAL_APPS.filter((app) => app.id !== 'settings' && pinnedApps.includes(app.id)), [pinnedApps]);

  const openWindow = (id) => {
    const nextZ = topZ + 1;
    setTopZ(nextZ);
    setWindows((previous) => previous.map((win) => win.id === id ? { ...win, isOpen: true, isMinimized: false, zIndex: nextZ } : win));
    setActiveWindow(id);
    setAppLauncherOpen(false); setQuickSettingsOpen(false); setContextMenu(null); setDockContextMenu(null); setDockTooltip(null);
  };
  const focusWindow = (id) => {
    const nextZ = topZ + 1;
    setTopZ(nextZ);
    setWindows((previous) => previous.map((win) => win.id === id ? { ...win, zIndex: nextZ, isMinimized: false } : win));
    setActiveWindow(id);
    setContextMenu(null); setDockContextMenu(null); setDockTooltip(null);
  };
  const closeWindow = (id, event) => {
    event.stopPropagation();
    setWindows((previous) => previous.map((win) => win.id === id ? { ...win, isOpen: false } : win));
    if (activeWindow === id) setActiveWindow('desktop');
  };
  const toggleMinimize = (id, event) => {
    event.stopPropagation();
    setWindows((previous) => previous.map((win) => win.id === id ? { ...win, isMinimized: !win.isMinimized } : win));
  };
  const toggleMaximize = (id, event) => {
    event.stopPropagation();
    setWindows((previous) => previous.map((win) => win.id === id ? { ...win, isMaximized: !win.isMaximized } : win));
  };
  const startDragging = (id, event) => {
    if (event.target.closest('button')) return;
    const win = windows.find((item) => item.id === id);
    if (!win || win.isMaximized) return;
    setDraggingWin(id); setQuickSettingsOpen(false); setDockTooltip(null);
    setDragOffset({ x: event.clientX - win.x, y: event.clientY - win.y });
    focusWindow(id);
  };
  const toggleOverview = () => {
    setAppLauncherOpen((open) => !open); setQuickSettingsOpen(false); setContextMenu(null); setDockContextMenu(null); setDockTooltip(null); setSearchQuery('');
  };

  const stepSimulation = () => {
    socket.emit('cmd:step');
    setToast('Stepped simulation clock by 1 tick.');
  };

  const toggleClock = () => {
    if (isClockRunning) {
      socket.emit('timer:pause');
      setIsClockRunning(false);
      setToast('Simulation clock paused.');
    } else {
      socket.emit('timer:start', { intervalMs: 1000 });
      setIsClockRunning(true);
      setToast('Simulation clock running (1 tick/sec).');
    }
  };

  const resetSimulation = () => {
    deletedPidsRef.current.clear();
    socket.emit('cmd:reset');
    setIsClockRunning(false);
    setToast('Simulation reset to Tick 0.');
  };

  const addProcess = (event) => {
    event.preventDefault();
    const name = newProcName.trim();
    const burst = Number.parseInt(newProcBurst, 10);
    const priority = Number.parseInt(newProcPriority, 10);
    const memory = Number.parseInt(newProcMemory, 10);
    const arrival = Number.parseInt(newProcArrival, 10);

    if (!name) return setToast('Enter a process name first.');
    if (!Number.isFinite(burst) || burst < 1) return setToast('Burst time must be at least 1.');
    if (!Number.isFinite(memory) || memory < 1) return setToast('Memory must be at least 1 MB.');

    socket.emit('cmd:add_process', {
      name,
      burst,
      priority: Number.isFinite(priority) ? priority : 1,
      arrival: Number.isFinite(arrival) ? arrival : 0,
      memory,
    });

    setNewProcName('');
    if (!isClockRunning) {
      setToast(`Created "${name}". Click "Step (1 Tick)" or "Run Clock" to start simulation!`);
    } else {
      setToast(`Created "${name}" — running in simulation.`);
    }
  };

  const killProcess = (pid) => {
    socket.emit('cmd:kill_process', { pid });
    setProcesses((previous) =>
      previous.map((proc) => (proc.pid === pid ? { ...proc, state: 'TERMINATED', remaining: 0 } : proc))
    );
    setToast(`Terminated process ${pid}.`);
  };

  const removeProcess = (pid) => {
    deletedPidsRef.current.add(pid);
    socket.emit('cmd:kill_process', { pid });
    socket.emit('cmd:remove_process', { pid });
    setProcesses((previous) => previous.filter((process) => process.pid !== pid));
    setToast(`Deleted process ${pid}.`);
  };

  const clearTerminatedProcesses = () => {
    const toRemove = processes.filter((p) => p.state === 'TERMINATED');
    if (!toRemove.length) return;
    toRemove.forEach((p) => {
      deletedPidsRef.current.add(p.pid);
      socket.emit('cmd:remove_process', { pid: p.pid });
    });
    setProcesses((previous) => previous.filter((p) => p.state !== 'TERMINATED'));
    setToast(`Cleared ${toRemove.length} terminated process(es).`);
  };

  const setPagePolicy = (policy) => {
    socket.emit('cmd:set_page_policy', { policy });
    setToast(`Page replacement policy set to ${policy}.`);
  };

  const setAllocStrategy = (type) => {
    socket.emit('cmd:set_alloc', { type });
    setActiveAllocStrategy(type);
    setToast(`Memory allocation strategy switched to ${type}.`);
  };

  const compactMemory = () => {
    socket.emit('cmd:compact');
    setToast('Triggered contiguous memory compaction.');
  };

  const testAccessMemory = (pid, addr) => {
    if (!pid || pid === 'ALL') return setToast('Select a valid process.');
    socket.emit('cmd:access_mem', { pid, logicalAddress: Number(addr) || 0 });
    setToast(`Accessed address 0x${addr} for process ${pid}.`);
  };

  const runSchedulerSimulation = () => {
    const activeProcs = processes.filter((p) => p.state !== 'TERMINATED');
    const simResults = runSchedulingSimulation(activeProcs, schedAlgo, timeQuantum);

    setGanttTimeline(simResults.timeline);
    setSchedulerMetrics({
      averageWaiting: simResults.averageWaiting,
      averageTurnaround: simResults.averageTurnaround,
    });

    socket.emit('cmd:set_scheduler', { type: schedAlgo, quantum: timeQuantum });
    socket.emit('timer:start', { intervalMs: 1000 });
    setIsClockRunning(true);

    setSchedulerLog((prev) => [`[dispatch] Selected ${schedAlgo}. Auto-stepping started.`, ...prev].slice(0, 12));
    setToast('Simulation completed visuals & backend clock started...');
  };

  const navigateToDir = (dirId) => {
    setCurrentDirId(dirId);
    setSelectedFileKeys([]);
    socket.emit('cmd:set_cwd', { dirId });
  };

  const goUpDirectory = () => {
    if (currentDirId === 'D0') return;
    const currentFolder = fsDirectories.find((d) => d.dirId === currentDirId);
    if (currentFolder && currentFolder.parentDirId) {
      navigateToDir(currentFolder.parentDirId);
    } else {
      navigateToDir('D0');
    }
  };

  const openFileInEditor = (file) => {
    if (!file || file.type !== 'file') return;
    setContextMenu(null);
    setSelectedFileKeys([getFileKey(file)]);
    editorRequestSeq += 1;
    setEditorOpenRequest({ file, requestId: editorRequestSeq });
    openWindow('text-editor');
  };

  const openFileEntry = (file) => {
    if (!file) return;
    setContextMenu(null);
    setSelectedFileKeys([getFileKey(file)]);
    if (file.type === 'dir') {
      navigateToDir(file.id);
      return;
    }
    openFileInEditor(file);
  };

  const openFileContextMenu = (event, entry = null) => {
    event.preventDefault(); event.stopPropagation();
    let targetKeys = selectedFileKeys;
    if (entry) {
      const key = getFileKey(entry);
      if (!selectedFileKeys.includes(key)) targetKeys = [key];
      setSelectedFileKeys(targetKeys);
    }
    setContextMenu({ x: event.clientX, y: event.clientY, selectedKeys: [...targetKeys] });
    setContextNewOpen(false); setDockContextMenu(null);
  };

  const beginFileSelection = (event) => {
    if (event.button !== 0) return;
    if (event.target.closest('button, input, textarea')) return;
    const startedOnFileRow = Boolean(event.target.closest('[data-file-key]'));
    setContextMenu(null); setDockContextMenu(null);
    if (startedOnFileRow) return;
    setSelectedFileKeys([]);
    setSelectionBox({ startX: event.clientX, startY: event.clientY, currentX: event.clientX, currentY: event.clientY });
  };

  const handleFileRowClick = (event, file) => {
    const key = getFileKey(file);
    if (event.ctrlKey || event.metaKey) {
      setSelectedFileKeys((previous) => previous.includes(key) ? previous.filter((item) => item !== key) : [...previous, key]);
      return;
    }
    if (event.shiftKey && selectedFileKeys.length) {
      const anchorIndex = visibleFiles.findIndex((item) => getFileKey(item) === selectedFileKeys[selectedFileKeys.length - 1]);
      const targetIndex = visibleFiles.findIndex((item) => getFileKey(item) === key);
      if (anchorIndex >= 0 && targetIndex >= 0) {
        const [start, end] = [anchorIndex, targetIndex].sort((a, b) => a - b);
        setSelectedFileKeys(visibleFiles.slice(start, end + 1).map(getFileKey));
        return;
      }
    }
    setSelectedFileKeys([key]);
    openFileEntry(file);
  };

  const openDockContextMenu = (event, appId) => {
    if (!appId || appId === 'settings') return;
    event.preventDefault();
    event.stopPropagation();
    setDockTooltip(null);
    setContextMenu(null);
    setQuickSettingsOpen(false);
    setDockContextMenu({ x: event.clientX, y: event.clientY, appId });
  };

  const togglePinnedApp = (appId) => {
    if (!appId || appId === 'settings') return;
    setPinnedApps((previous) => {
      const isCurrentlyPinned = previous.includes(appId);
      const next = isCurrentlyPinned
        ? previous.filter((id) => id !== appId)
        : [...previous, appId];
      setToast(isCurrentlyPinned ? 'App unpinned from dock.' : 'App pinned to dock.');
      return next;
    });
    setDockContextMenu(null);
    setDockTooltip(null);
  };

  const showDockTooltip = (event, title) => {
    if (dockContextMenu) return;
    const rect = event.currentTarget.getBoundingClientRect();
    if (dockPosition === 'bottom') setDockTooltip({ title, x: rect.left + rect.width / 2, y: rect.top - 8, placement: 'top' });
    else if (dockPosition === 'right') setDockTooltip({ title, x: rect.left - 8, y: rect.top + rect.height / 2, placement: 'left' });
    else setDockTooltip({ title, x: rect.right + 8, y: rect.top + rect.height / 2, placement: 'right' });
  };

  const beginCreateItem = (type) => {
    setContextMenu(null); setContextNewOpen(false); setNewItemType(type); setNewItemName('');
  };

  const copyOrCutSelectedFiles = (operation) => {
    const keys = contextMenu?.selectedKeys || selectedFileKeys;
    const items = visibleFiles.filter((item) => keys.includes(item.id));
    if (!items.length) return;
    setFileClipboard({ operation, items, sourceDirId: currentDirId });
    setContextMenu(null);
    setToast(`${operation === 'copy' ? 'Copied' : 'Cut'} ${items.length} item(s).`);
  };

  const pasteFiles = () => {
    if (!fileClipboard?.items?.length) return;
    const { operation, items, sourceDirId } = fileClipboard;

    if (operation === 'cut') {
      if (sourceDirId === currentDirId) {
        setContextMenu(null);
        return setToast('Items are already in this folder.');
      }
      items.forEach((item) => {
        if (item.type === 'dir') {
          socket.emit('cmd:dir_move', { dirId: item.id, newParentDirId: currentDirId });
        } else {
          socket.emit('cmd:file_move', { fileId: item.id, newDirId: currentDirId });
        }
      });
      setFileClipboard(null);
      setContextMenu(null);
      setToast(`Moved ${items.length} item(s).`);
    } else {
      items.forEach((item) => {
        if (item.type === 'file') {
          socket.emit('cmd:file_create', { ownerPID: 'USER', name: `copy_${item.name}`, sizeInBlocks: 1, dirId: currentDirId });
        } else {
          socket.emit('cmd:dir_create', { name: `copy_${item.name}`, parentDirId: currentDirId });
        }
      });
      setContextMenu(null);
      setToast(`Copied ${items.length} item(s).`);
    }
  };

  const deleteItemRecursive = (item) => {
    if (!item) return;
    if (item.type === 'file') {
      socket.emit('cmd:file_delete', { fileId: item.id });
    } else {
      const deleteSubtree = (dirId) => {
        fsFiles.filter((f) => f.dirId === dirId).forEach((cf) => socket.emit('cmd:file_delete', { fileId: cf.fileId }));
        fsDirectories.filter((d) => d.parentDirId === dirId).forEach((cd) => deleteSubtree(cd.dirId));
        socket.emit('cmd:dir_delete', { dirId });
      };
      deleteSubtree(item.id);
    }
  };

  const deleteSelectedFiles = () => {
    const keys = contextMenu?.selectedKeys || selectedFileKeys;
    const itemsToDelete = visibleFiles.filter((item) => keys.includes(item.id));
    if (!itemsToDelete.length) return;
    itemsToDelete.forEach((item) => deleteItemRecursive(item));
    setSelectedFileKeys([]);
    setContextMenu(null);
    setToast(`Deleted ${itemsToDelete.length} item(s).`);
  };

  const handleWallpaperUpload = (event) => {
    const imageFile = event.target.files?.[0];
    if (!imageFile) return;
    if (!imageFile.type.startsWith('image/')) return setToast('Please choose an image file.');
    const reader = new FileReader();
    reader.onload = () => { setWallpaperImage(String(reader.result || '')); setWallpaperName(imageFile.name); setToast('Wallpaper updated.'); };
    reader.onerror = () => setToast('Unable to load that image.');
    reader.readAsDataURL(imageFile);
    event.target.value = '';
  };

  const runTerminalCommand = (command) => {
    const line = String(command ?? '').trim();
    if (!line) return;
    setTermHistory((previous) => [...previous, `${promptText}${line}`]);
    socket.emit('shell:exec', { command: line });
  };

  const handleTerminalSubmit = (event) => {
    event.preventDefault();
    if (!termInput.trim()) return;
    runTerminalCommand(termInput);
    setTermInput('');
  };

  // Locks the terminal input cursor to the end of the text so the left side cannot be edited
  const keepTerminalCursorAtEnd = (element) => {
    if (!element) return;
    const len = element.value.length;
    if (element.selectionStart !== len || element.selectionEnd !== len) {
      element.setSelectionRange(len, len);
    }
  };

  const createFileSystemItem = (event) => {
    event.preventDefault();
    const name = newItemName.trim();
    if (!name || !newItemType) return;
    if (name === '.' || name === '..' || name.includes('/')) return setToast('Use a simple name without slashes.');
    if (visibleFiles.some((f) => f.name.toLowerCase() === name.toLowerCase())) {
      return setToast('An item with that name already exists in this directory.');
    }

    if (newItemType === 'dir') {
      socket.emit('cmd:dir_create', { name, parentDirId: currentDirId });
      setToast(`Created folder "${name}".`);
    } else {
      socket.emit('cmd:file_create', { ownerPID: 'USER', name, sizeInBlocks: 1, dirId: currentDirId });
      setToast(`Created file "${name}".`);
    }
    setNewItemName('');
    setNewItemType(null);
  };

  const beginRename = (entry) => {
    if (!entry) return;
    setContextMenu(null);
    setRenameTarget(entry);
    setRenameName(entry.name);
  };

  const submitRename = (event) => {
    event.preventDefault();
    if (!renameTarget) return;
    const nextName = renameName.trim();
    if (!nextName || nextName === renameTarget.name) {
      setRenameTarget(null);
      return;
    }
    if (nextName === '.' || nextName === '..' || nextName.includes('/')) {
      return setToast('Use a simple name without slashes.');
    }
    if (renameTarget.type === 'dir') {
      socket.emit('cmd:dir_rename', { dirId: renameTarget.id, newName: nextName });
    } else {
      socket.emit('cmd:file_rename', { fileId: renameTarget.id, newName: nextName });
    }
    setToast(`Renamed to "${nextName}".`);
    setRenameTarget(null);
  };

  const handleAuthenticated = async (username, isNew) => {
    let snapshot = null;
    let snapshotUpdatedAt = null;
    if (!isNew) {
      try {
        const record = await loadBrowserSnapshotRecord(username);
        snapshot = record?.snapshot ?? null;
        snapshotUpdatedAt = record?.updatedAt ?? null;
      } catch {
        snapshot = null;
        snapshotUpdatedAt = null;
      }
    }
    pendingHomeRef.current = normalizeUser(username);
    socket.emit('vfs:load', { user: username, snapshot, snapshotUpdatedAt });
    setCurrentDirId('D0');
    setSelectedFileKeys([]);
    setShellPrompt('');
    setTermHistory(['MINIOS shell 2.4.0', `Signed in as ${username}.`, '']);
    setSession({ user: username });
    sessionRef.current = { user: username };
  };

  const handleLogout = () => {
    pendingHomeRef.current = null;
    setSession(null);
    sessionRef.current = null;
    setEditorTabs([]);
    setActiveEditorTab(null);
    setEditorOpenRequest(null);
    setRenameTarget(null);
    setShellPrompt('');
    setCurrentDirId('D0');
    setSelectedFileKeys([]);
    setTermHistory(['MINIOS shell 2.4.0', 'Type help to see supported commands.', '']);
    setWindows(INITIAL_WINDOWS);
    setActiveWindow('process-manager');
    socket.emit('timer:pause');
    setIsClockRunning(false);
  };

  useEffect(() => {
    const handleFileShortcuts = (event) => {
      if (activeWindow !== 'file-manager') return;
      const target = event.target;
      const editingText = target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));
      if (editingText) return;

      if (event.key === 'Backspace' && !isAtFileRoot) {
        event.preventDefault();
        goUpDirectory();
        return;
      }

      if (event.key === 'F2' && selectedFileKeys.length === 1) {
        event.preventDefault();
        beginRename(visibleFiles.find((item) => item.id === selectedFileKeys[0]));
        return;
      }

      if (event.key === 'Enter' && selectedFileKeys.length === 1) {
        event.preventDefault();
        openFileEntry(visibleFiles.find((item) => item.id === selectedFileKeys[0]));
        return;
      }

      if (!(event.ctrlKey || event.metaKey)) return;
      const key = event.key.toLowerCase();
      if (key === 'c' && selectedFileKeys.length) { event.preventDefault(); copyOrCutSelectedFiles('copy'); }
      else if (key === 'x' && selectedFileKeys.length) { event.preventDefault(); copyOrCutSelectedFiles('cut'); }
      else if (key === 'v' && fileClipboard) { event.preventDefault(); pasteFiles(); }
    };
    window.addEventListener('keydown', handleFileShortcuts);
    return () => window.removeEventListener('keydown', handleFileShortcuts);
  }, [activeWindow, selectedFileKeys, fileClipboard, contextMenu, visibleFiles, currentDirId, isAtFileRoot]);

  const themeClass = theme === 'aurora' ? 'from-[#17605e] via-[#245274] to-[#483d78]' : theme === 'sunset' ? 'from-[#874b5b] via-[#59436f] to-[#2b5272]' : 'from-[#24506d] via-[#354777] to-[#533d70]';
  const dockIconSize = iconSize === 'sm' ? 'h-10 w-10' : iconSize === 'lg' ? 'h-14 w-14' : 'h-12 w-12';
  const dockGlyphSize = iconSize === 'sm' ? 'h-4 w-4' : iconSize === 'lg' ? 'h-6 w-6' : 'h-5 w-5';
  const dockBadgeSize = iconSize === 'sm' ? 'h-7 w-7' : iconSize === 'lg' ? 'h-10 w-10' : 'h-9 w-9';
  const isBottomDock = dockPosition === 'bottom';
  const dockPositionClass = dockPosition === 'left' ? 'left-3 top-1/2 h-fit max-h-[calc(100vh-24px)] w-[72px] -translate-y-1/2 flex-col py-3' : dockPosition === 'right' ? 'right-3 top-1/2 h-fit max-h-[calc(100vh-24px)] w-[72px] -translate-y-1/2 flex-col py-3' : 'bottom-3 left-1/2 h-[96px] max-w-[calc(100vw-24px)] -translate-x-1/2 flex-row px-3 py-2';
  const dockAppsClass = isBottomDock ? 'flex h-full min-w-0 flex-1 flex-row items-center gap-2 overflow-x-auto overflow-y-hidden px-1 py-2' : 'flex w-full min-h-0 max-h-[calc(100vh-190px)] flex-none flex-col items-center gap-2 overflow-x-hidden overflow-y-auto px-2 py-2';
  const dockIconPx = iconSize === 'sm' ? 40 : iconSize === 'lg' ? 56 : 48;
  const estimatedDockWidth = dockApps.length * (dockIconPx + 8) + dockIconPx * 2 + 98;
  const dockInlineStyle = isBottomDock ? { width: `min(calc(100vw - 24px), ${estimatedDockWidth}px)` } : undefined;
  const fileSelectionBounds = fileListRef.current?.getBoundingClientRect();
  const fileSelectionStyle = selectionBox && fileSelectionBounds ? { left: Math.min(selectionBox.startX, selectionBox.currentX) - fileSelectionBounds.left, top: Math.min(selectionBox.startY, selectionBox.currentY) - fileSelectionBounds.top, width: Math.abs(selectionBox.currentX - selectionBox.startX), height: Math.abs(selectionBox.currentY - selectionBox.startY) } : null;
  const activeMaximizedWindow = windows.some((win) => win.isOpen && !win.isMinimized && win.isMaximized && win.id === activeWindow);

  if (!session) {
    return <AuthScreen onAuthenticated={handleAuthenticated} />;
  }

  return (
    <div className={`relative h-screen w-screen select-none overflow-hidden bg-gradient-to-br ${themeClass} font-sans text-slate-200`} style={wallpaperImage ? { backgroundImage: `linear-gradient(rgba(7, 10, 18, .38), rgba(7, 10, 18, .52)), url("${wallpaperImage}")`, backgroundSize: 'cover', backgroundPosition: 'center', backgroundRepeat: 'no-repeat' } : undefined}>

      <div className={`pointer-events-none absolute inset-0 opacity-30 ${wallpaperImage ? 'hidden' : ''}`} aria-hidden="true">
        <div className="absolute -right-40 -top-44 h-[34rem] w-[34rem] rounded-full border border-white/[0.045]" />
        <div className="absolute -right-20 -top-24 h-[26rem] w-[26rem] rounded-full border border-white/[0.035]" />
        <div className="absolute bottom-[-19rem] left-[28%] h-[38rem] w-[38rem] rounded-full border border-white/[0.04]" />
      </div>

      {!draggingWin && !activeMaximizedWindow && (
        <button
          onClick={() => { setQuickSettingsOpen((open) => !open); setAppLauncherOpen(false); setDockContextMenu(null); setContextMenu(null); }}
          aria-label="Open system menu"
          className="absolute left-1/2 top-3 z-[190] flex -translate-x-1/2 items-center gap-3 rounded-full border border-white/[0.22] bg-slate-950/[0.42] px-4 py-1.5 text-slate-100 shadow-[0_10px_40px_rgba(0,0,0,0.24)] ring-1 ring-white/[0.04] backdrop-blur-2xl transition hover:bg-slate-950/[0.58]"
        >
          {!logoError ? (
            <img src="/logo.png" alt="MiniOS" className="h-4 w-4 rounded-sm object-contain" onError={() => setLogoError(true)} />
          ) : (
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-300/90 shadow-[0_0_8px_rgba(110,231,183,0.28)]" />
          )}
          <span className="h-3 w-px bg-white/[0.16]" />
          <span className="text-[10px] font-medium text-slate-300">{currentTime.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}</span>
          <span className="h-3 w-px bg-white/[0.16]" />
          <span className="text-xs font-semibold tabular-nums text-white">{currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          <ChevronDown className={`h-3 w-3 text-slate-300/80 transition-transform ${quickSettingsOpen ? 'rotate-180' : ''}`} />
        </button>
      )}

      {!draggingWin && !activeMaximizedWindow && (
        <div className="absolute right-3 top-3 z-[190] flex items-center gap-2 rounded-full border border-white/[0.22] bg-slate-950/[0.42] py-1 pl-1 pr-1.5 text-slate-100 shadow-[0_10px_40px_rgba(0,0,0,0.24)] ring-1 ring-white/[0.04] backdrop-blur-2xl">
          <span className="flex h-6 w-6 items-center justify-center rounded-full border border-white/[0.16] bg-white/[0.1] text-[10px] font-semibold uppercase text-slate-100">{session.user.slice(0, 1)}</span>
          <span className="max-w-[140px] truncate text-xs font-medium text-slate-200">{session.user}</span>
          <button onClick={handleLogout} title="Sign out" aria-label="Sign out" className="rounded-full p-1.5 text-slate-400 transition hover:bg-rose-500/15 hover:text-rose-200"><LogOut className="h-3.5 w-3.5" /></button>
        </div>
      )}

      <aside style={dockInlineStyle} className={`absolute z-[80] flex items-center rounded-[22px] border border-white/[0.2] bg-gradient-to-br from-white/[0.19] via-white/[0.085] to-slate-950/[0.28] shadow-[0_24px_70px_rgba(0,0,0,0.3)] ring-1 ring-black/20 backdrop-blur-2xl ${dockPositionClass}`}>
        <button onClick={() => openWindow('settings')} aria-label="Settings" onContextMenu={(event) => { event.preventDefault(); event.stopPropagation(); }} onMouseEnter={(event) => showDockTooltip(event, 'Settings')} onMouseLeave={() => setDockTooltip(null)} className={`${dockIconSize} ${isBottomDock ? 'mr-1' : 'mb-3'} flex shrink-0 items-center justify-center rounded-xl border border-white/[0.13] bg-white/[0.075] text-slate-100 shadow-sm transition duration-200 ease-out hover:-translate-y-1 hover:scale-105 hover:bg-white/[0.15] hover:shadow-lg`}>
          <span className={`${dockBadgeSize} flex items-center justify-center rounded-lg border border-black/70 bg-slate-950/65 shadow-inner`}><Settings className={dockGlyphSize} strokeWidth={1.8} /></span>
        </button>
        <div className={isBottomDock ? 'mx-2 h-8 w-px shrink-0 bg-white/20' : 'mb-3 h-px w-8 shrink-0 bg-white/20'} />
        <div className={dockAppsClass}>
          {dockApps.map((app) => {
            const win = windows.find((item) => item.id === app.id);
            const isSelected = activeWindow === app.id && win?.isOpen && !win?.isMinimized;
            const isOpen = win?.isOpen;
            return (
              <button
                key={app.id}
                type="button"
                onClick={() => {
                  if (win?.isOpen && !win?.isMinimized && activeWindow === app.id) {
                    toggleMinimize(app.id, { stopPropagation() { } });
                  } else {
                    openWindow(app.id);
                  }
                }}
                aria-label={app.title}
                onContextMenu={(event) => openDockContextMenu(event, app.id)}
                onMouseEnter={(event) => showDockTooltip(event, `${app.title} (Right-click to unpin)`)}
                onMouseLeave={() => setDockTooltip(null)}
                className={`group relative flex ${dockIconSize} shrink-0 items-center justify-center rounded-xl border transition duration-200 ease-out hover:-translate-y-1 hover:scale-105 ${isSelected ? 'border-white/[0.23] bg-white/[0.17] shadow-lg' : 'border-transparent hover:border-white/[0.14] hover:bg-white/[0.11]'}`}
              >
                <span className={`${dockBadgeSize} flex items-center justify-center rounded-lg border border-black/75 bg-slate-950/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_4px_10px_rgba(0,0,0,0.22)] ${APP_TONES[app.id].split(' ')[0]}`}>
                  <AppIcon app={app} size={iconSize} />
                </span>
                {isOpen && <span className={`absolute ${isBottomDock ? '-bottom-[5px] left-1/2 h-[3px] w-4 -translate-x-1/2' : '-left-[5px] h-4 w-[3px]'} rounded-full ${isSelected ? 'bg-white' : 'bg-slate-300/75'}`} />}
              </button>
            );
          })}
        </div>
        <div className={isBottomDock ? 'mx-2 h-8 w-px shrink-0 bg-white/20' : 'mb-2 mt-3 h-px w-8 shrink-0 bg-white/20'} />
        <button onClick={toggleOverview} aria-label="Open overview" onContextMenu={(event) => { event.preventDefault(); event.stopPropagation(); }} onMouseEnter={(event) => showDockTooltip(event, 'Applications overview')} onMouseLeave={() => setDockTooltip(null)} className={`${dockIconSize} ${isBottomDock ? 'ml-1' : 'mt-0'} flex shrink-0 items-center justify-center rounded-xl border border-white/[0.16] bg-slate-950/45 text-slate-100 shadow-md transition duration-200 ease-out hover:-translate-y-1 hover:scale-105 hover:bg-slate-950/60 hover:shadow-lg`}>
          <span className={`${dockBadgeSize} flex items-center justify-center overflow-hidden rounded-lg border border-black/70 bg-slate-950/70 shadow-inner`}>
            {!logoError ? (
              <img src="/logo.png" alt="MiniOS" className="h-full w-full object-cover" onError={() => setLogoError(true)} />
            ) : (
              <LayoutGrid className={dockGlyphSize} strokeWidth={1.8} />
            )}
          </span>
        </button>
      </aside>

      <main className={`absolute bottom-0 top-0 ${dockPosition === 'left' ? 'left-[90px] right-4' : dockPosition === 'right' ? 'left-4 right-[90px]' : 'left-4 right-4'}`} onMouseDown={() => { setAppLauncherOpen(false); setQuickSettingsOpen(false); setContextMenu(null); setDockContextMenu(null); setDockTooltip(null); }} />

      {!appLauncherOpen && windows.map((win) => {
        if (!win.isOpen || win.isMinimized) return null;
        const app = INITIAL_APPS.find((item) => item.id === win.id);
        const Icon = app?.icon || Monitor;
        const isSideDock = dockPosition === 'left' || dockPosition === 'right';
        const availableWidth = Math.max(320, window.innerWidth - (isSideDock ? 120 : 24));
        const windowWidth = Math.min(win.w, availableWidth);
        const leftBoundary = dockPosition === 'left' ? 88 : 12;
        const rightBoundary = dockPosition === 'right' ? 88 : 12;
        const windowLeft = dockPosition === 'left' ? Math.max(leftBoundary, Math.min(win.x, window.innerWidth - windowWidth - 12)) : dockPosition === 'right' ? Math.max(12, Math.min(win.x, window.innerWidth - windowWidth - rightBoundary)) : Math.max(12, Math.min(win.x, window.innerWidth - windowWidth - 12));
        const windowTop = Math.max(0, Math.min(win.y, window.innerHeight - 300));
        const availableHeight = Math.max(260, window.innerHeight - windowTop - (dockPosition === 'bottom' ? 98 : 12));
        const maxStyle = win.isMaximized ? { top: 0, left: dockPosition === 'left' ? 84 : 8, right: dockPosition === 'right' ? 84 : 8, bottom: dockPosition === 'bottom' ? 112 : 0 } : { top: windowTop, left: windowLeft, width: windowWidth, height: Math.min(win.h, availableHeight) };

        return (
          <section key={win.id} onMouseDown={() => focusWindow(win.id)} style={{ ...maxStyle, zIndex: win.zIndex, maxWidth: win.isMaximized ? 'none' : (isSideDock ? 'calc(100vw - 110px)' : 'calc(100vw - 24px)'), maxHeight: win.isMaximized ? 'none' : (dockPosition === 'bottom' ? 'calc(100vh - 125px)' : 'calc(100vh - 24px)') }} className={`absolute flex min-h-[280px] min-w-[320px] flex-col overflow-hidden rounded-xl border bg-[#171a1f]/[0.97] shadow-[0_24px_80px_rgba(0,0,0,0.48)] backdrop-blur-2xl ${activeWindow === win.id ? 'border-white/[0.16]' : 'border-white/[0.09]'}`}>
            <div onMouseDown={(event) => startDragging(win.id, event)} onDoubleClick={(event) => { if (!event.target.closest('button')) toggleMaximize(win.id, event); }} title="Double-click to maximize or restore" className="flex h-11 shrink-0 cursor-grab items-center justify-between border-b border-white/[0.07] bg-[#1d2026] px-3.5 active:cursor-grabbing">
              <div className="flex min-w-0 items-center gap-2.5">
                <Icon className={`h-4 w-4 shrink-0 ${APP_TONES[win.id]?.split(' ')[0] || 'text-slate-300'}`} strokeWidth={1.8} />
                <span className="truncate text-xs font-semibold text-slate-200">{win.title}</span>
                {win.id === 'terminal' && <span className="rounded border border-white/[0.08] px-1.5 py-0.5 text-[9px] text-slate-500">bash-like</span>}
                {win.id === 'text-editor' && editorTabs.length > 0 && <span className="rounded border border-white/[0.08] px-1.5 py-0.5 text-[9px] text-slate-500">{editorTabs.length} tab{editorTabs.length === 1 ? '' : 's'}</span>}
              </div>
              <div className="ml-3 flex shrink-0 items-center gap-1">
                <button onClick={(event) => toggleMinimize(win.id, event)} title="Minimize" className="rounded-md p-1.5 text-slate-500 transition hover:bg-white/[0.08] hover:text-slate-200"><Minimize2 className="h-3.5 w-3.5" /></button>
                <button onClick={(event) => toggleMaximize(win.id, event)} title={win.isMaximized ? 'Restore' : 'Maximize'} className="rounded-md p-1.5 text-slate-500 transition hover:bg-white/[0.08] hover:text-slate-200"><Maximize2 className="h-3.5 w-3.5" /></button>
                <button onClick={(event) => closeWindow(win.id, event)} title="Close" className="ml-1 rounded-md p-1.5 text-slate-500 transition hover:bg-rose-500/15 hover:text-rose-300"><X className="h-3.5 w-3.5" /></button>
              </div>
            </div>

            <div className={`min-h-0 flex-1 ${win.id === 'terminal' ? 'overflow-hidden p-3' : win.id === 'text-editor' ? 'overflow-hidden p-0' : 'overflow-auto p-5'}`}>
              {win.id === 'process-manager' && (
                <div>
                  <SectionHeading
                    eyebrow="Kernel / Process table"
                    title="Process manager"
                    description="Inspect active and terminated processes, advance simulation clock, and manage process lifecycle."
                    icon={Cpu}
                    action={
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-black/40 px-3 py-1.5 text-xs font-mono">
                          <Clock3 className="h-3.5 w-3.5 text-sky-400" />
                          <span className="text-slate-400">Tick</span>
                          <span className="font-bold text-sky-300">{currentTick}</span>
                          <span className={`ml-1.5 inline-block h-2 w-2 rounded-full ${isClockRunning ? 'animate-pulse bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]' : 'bg-slate-500'}`} />
                          <span className="text-[10px] text-slate-400">{isClockRunning ? 'Running' : 'Paused'}</span>
                        </div>
                        {(() => {
                          const runningProc = processes.find((p) => p.state === 'RUNNING');
                          if (runningProc) {
                            return <span className="rounded-md border border-emerald-400/30 bg-emerald-500/10 px-2.5 py-1.5 text-[11px] text-emerald-300"><span className="text-emerald-400">CPU:</span> {runningProc.name} ({runningProc.pid})</span>;
                          }
                          const readyProcs = processes.filter((p) => p.state === 'READY');
                          if (readyProcs.length) {
                            return <span className="rounded-md border border-amber-400/30 bg-amber-500/10 px-2.5 py-1.5 text-[11px] text-amber-300"><span className="text-amber-400">Next:</span> {readyProcs[0].name} ({readyProcs[0].pid})</span>;
                          }
                          return <span className="rounded-md border border-white/[0.08] bg-white/[0.03] px-2.5 py-1.5 text-[11px] text-slate-500">CPU: Idle</span>;
                        })()}
                        <button
                          onClick={stepSimulation}
                          title="Advance simulation clock by 1 tick"
                          className="flex items-center gap-1 rounded-lg border border-sky-400/30 bg-sky-500/10 px-2.5 py-1.5 text-xs font-medium text-sky-300 transition hover:bg-sky-500/20 active:scale-95"
                        >
                          <Play className="h-3 w-3" /> Step (1 Tick)
                        </button>
                        <button
                          onClick={toggleClock}
                          title={isClockRunning ? 'Pause clock' : 'Start continuous 1-tick/sec simulation'}
                          className={`flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition active:scale-95 ${isClockRunning
                              ? 'border-amber-400/30 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20'
                              : 'border-emerald-400/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20'
                            }`}
                        >
                          {isClockRunning ? <><Pause className="h-3 w-3" /> Pause Clock</> : <><Play className="h-3 w-3" /> Run Clock</>}
                        </button>
                        <button
                          onClick={resetSimulation}
                          title="Reset simulation back to Tick 0"
                          className="flex items-center gap-1 rounded-lg border border-white/[0.08] bg-white/[0.03] px-2.5 py-1.5 text-xs text-slate-400 transition hover:bg-white/[0.08] hover:text-slate-200"
                        >
                          <RotateCcw className="h-3 w-3" /> Reset
                        </button>
                      </div>
                    }
                  />

                  <div className="mb-2 flex items-center justify-between">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                      Active Processes ({nonTerminatedProcesses.length})
                    </h3>
                  </div>
                  <div className="overflow-x-auto rounded-xl border border-white/[0.08]">
                    <table className="w-full min-w-[690px] text-left text-xs">
                      <thead className="bg-white/[0.035] text-[10px] uppercase tracking-[0.11em] text-slate-500">
                        <tr>{['PID', 'Process', 'State', 'Priority', 'Burst', 'Remaining', 'Actions'].map((heading) => <th key={heading} className={`px-3.5 py-3 font-medium ${heading === 'Actions' ? 'text-right' : ''}`}>{heading}</th>)}</tr>
                      </thead>
                      <tbody className="divide-y divide-white/[0.055]">
                        {nonTerminatedProcesses.map((process) => (
                          <tr key={process.pid} className="transition hover:bg-white/[0.025]">
                            <td className="px-3.5 py-3 font-mono text-slate-400">{String(process.pid).padStart(3, '0')}</td>
                            <td className="px-3.5 py-3 font-medium text-slate-200">{process.name}</td>
                            <td className="px-3.5 py-3">
                              <span className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[10px] font-medium ${process.state === 'RUNNING'
                                  ? 'border-emerald-400/20 bg-emerald-400/[0.08] text-emerald-300'
                                  : process.state === 'READY'
                                    ? 'border-amber-300/20 bg-amber-300/[0.07] text-amber-200'
                                    : process.state === 'NEW'
                                      ? 'border-sky-400/30 bg-sky-400/[0.1] text-sky-300'
                                      : 'border-rose-400/30 bg-rose-400/[0.1] text-rose-300'
                                }`}>
                                {process.state}
                                {process.state === 'NEW' && <span className="font-mono text-[9px] text-slate-400">arr:{process.arrivalTime ?? 0}</span>}
                              </span>
                            </td>
                            <td className="px-3.5 py-3 font-mono text-slate-400">{process.priority}</td>
                            <td className="px-3.5 py-3 font-mono text-slate-400">{process.burst}u</td>
                            <td className="px-3.5 py-3 font-mono text-slate-300">{process.remaining}u</td>
                            <td className="px-3.5 py-3 text-right">
                              <div className="inline-flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => killProcess(process.pid)}
                                  title={`Terminate ${process.name} (move to Terminated list)`}
                                  className="rounded-md border border-amber-400/25 bg-amber-400/10 px-2 py-1 text-[10px] font-medium text-amber-200 transition hover:bg-amber-400/20"
                                >
                                  Terminate
                                </button>
                                <button
                                  type="button"
                                  onClick={() => removeProcess(process.pid)}
                                  title={`Delete ${process.name} from process table`}
                                  className="rounded-md border border-white/[0.07] p-1.5 text-slate-400 transition hover:border-rose-400/30 hover:bg-rose-400/[0.12] hover:text-rose-300"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                        {!nonTerminatedProcesses.length && (
                          <tr><td colSpan="7" className="px-4 py-8 text-center text-slate-500">No active processes. Create one below.</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  <div className="mt-5">
                    <div className="mb-2 flex items-center justify-between">
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                        Terminated Processes ({terminatedProcesses.length})
                      </h3>
                      {terminatedProcesses.length > 0 && (
                        <button
                          type="button"
                          onClick={clearTerminatedProcesses}
                          className="flex items-center gap-1 rounded-md border border-rose-400/25 bg-rose-500/10 px-2.5 py-1 text-[10px] font-medium text-rose-200 transition hover:bg-rose-500/20"
                        >
                          <Trash2 className="h-3 w-3" /> Clear All Terminated
                        </button>
                      )}
                    </div>
                    <div className="overflow-x-auto rounded-xl border border-white/[0.08] bg-black/20">
                      <table className="w-full min-w-[690px] text-left text-xs">
                        <thead className="bg-white/[0.025] text-[10px] uppercase tracking-[0.11em] text-slate-500">
                          <tr>{['PID', 'Process', 'State', 'Priority', 'Burst', 'Remaining', 'Delete'].map((heading) => <th key={heading} className={`px-3.5 py-2.5 font-medium ${heading === 'Delete' ? 'text-right' : ''}`}>{heading}</th>)}</tr>
                        </thead>
                        <tbody className="divide-y divide-white/[0.045]">
                          {terminatedProcesses.map((process) => (
                            <tr key={process.pid} className="transition hover:bg-white/[0.02]">
                              <td className="px-3.5 py-2.5 font-mono text-slate-500">{String(process.pid).padStart(3, '0')}</td>
                              <td className="px-3.5 py-2.5 font-medium text-slate-400 line-through">{process.name}</td>
                              <td className="px-3.5 py-2.5">
                                <span className="inline-flex items-center rounded-md border border-slate-400/20 bg-slate-400/[0.08] px-2 py-0.5 text-[10px] font-medium text-slate-400">
                                  TERMINATED
                                </span>
                              </td>
                              <td className="px-3.5 py-2.5 font-mono text-slate-500">{process.priority}</td>
                              <td className="px-3.5 py-2.5 font-mono text-slate-500">{process.burst}u</td>
                              <td className="px-3.5 py-2.5 font-mono text-slate-500">0u</td>
                              <td className="px-3.5 py-2.5 text-right">
                                <button
                                  type="button"
                                  onClick={() => removeProcess(process.pid)}
                                  title={`Delete ${process.name}`}
                                  className="inline-flex items-center gap-1 rounded-md border border-rose-400/25 bg-rose-500/10 px-2 py-1 text-[10px] font-medium text-rose-200 transition hover:bg-rose-500/20"
                                >
                                  <Trash2 className="h-3 w-3" /> Delete
                                </button>
                              </td>
                            </tr>
                          ))}
                          {!terminatedProcesses.length && (
                            <tr><td colSpan="7" className="px-4 py-6 text-center text-slate-500">No terminated processes yet.</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <form onSubmit={addProcess} className="mt-5 rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Plus className="h-4 w-4 text-slate-400" />
                        <h3 className="text-xs font-semibold text-slate-200">Create process</h3>
                      </div>
                      <span className="text-[10px] text-slate-500">
                        Arrival 0 admits immediately once simulation steps (Current Tick: {currentTick})
                      </span>
                    </div>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_85px_85px_85px_85px_auto_auto]">
                      <label className="block"><span className="mb-1.5 block text-[10px] text-slate-500">Name</span><input value={newProcName} onChange={(e) => setNewProcName(e.target.value)} placeholder="e.g. worker_job" className="field w-full" /></label>
                      <label className="block"><span className="mb-1.5 block text-[10px] text-slate-500">Burst (u)</span><input type="number" min="1" value={newProcBurst} onChange={(e) => setNewProcBurst(e.target.value)} className="field w-full" /></label>
                      <label className="block"><span className="mb-1.5 block text-[10px] text-slate-500">RAM (MB)</span><input type="number" min="1" value={newProcMemory} onChange={(e) => setNewProcMemory(e.target.value)} className="field w-full" /></label>
                      <label className="block"><span className="mb-1.5 block text-[10px] text-slate-500">Priority</span><input type="number" min="0" value={newProcPriority} onChange={(e) => setNewProcPriority(e.target.value)} className="field w-full" /></label>
                      <label className="block"><span className="mb-1.5 block text-[10px] text-slate-500">Arrival</span><input type="number" min="0" value={newProcArrival} onChange={(e) => setNewProcArrival(e.target.value)} className="field w-full" /></label>
                      <button type="submit" className="self-end rounded-lg bg-slate-100 px-3.5 py-2.5 text-xs font-semibold text-slate-900 transition hover:bg-white"><Plus className="mr-1 inline h-3.5 w-3.5" />Create</button>
                      <button
                        type="button"
                        onClick={(e) => {
                          addProcess(e);
                          setTimeout(() => socket.emit('cmd:step'), 150);
                        }}
                        title="Create process and advance clock by 1 tick immediately"
                        className="self-end rounded-lg border border-sky-400/30 bg-sky-500/20 px-3.5 py-2.5 text-xs font-semibold text-sky-200 transition hover:bg-sky-500/30"
                      >
                        <Play className="mr-1 inline h-3.5 w-3.5" />Create & Step
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {win.id === 'scheduler' && (
                <div>
                  <SectionHeading eyebrow="Kernel / CPU" title="Scheduling laboratory" description="Compare scheduling policies using the active simulated processes." icon={Activity} action={(() => {
                    const runningProc = processes.find((p) => p.state === 'RUNNING');
                    if (runningProc) {
                      return <span className="rounded-md border border-emerald-400/30 bg-emerald-500/10 px-2.5 py-1.5 text-[11px] text-emerald-300"><span className="text-emerald-400">Current CPU:</span> {runningProc.name} ({runningProc.pid})</span>;
                    }
                    const readyProcs = processes.filter((p) => p.state === 'READY');
                    if (readyProcs.length) {
                      return <span className="rounded-md border border-amber-400/30 bg-amber-500/10 px-2.5 py-1.5 text-[11px] text-amber-300"><span className="text-amber-400">Next CPU:</span> {readyProcs[0].name} ({readyProcs[0].pid})</span>;
                    }
                    return <span className="rounded-md border border-white/[0.08] bg-white/[0.03] px-2.5 py-1.5 text-[11px] text-slate-500">CPU: Idle</span>;
                  })()} />
                  <div className="mb-5 flex flex-wrap items-end gap-3 rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
                    <label className="min-w-[220px] flex-1"><span className="mb-1.5 block text-[10px] text-slate-500">Scheduling algorithm</span><select value={schedAlgo} onChange={(e) => setSchedAlgo(e.target.value)} className="field w-full"><option value="FCFS">First Come, First Served (FCFS)</option><option value="SJF">Shortest Job First (SJF)</option><option value="RR">Round Robin (RR)</option><option value="PRIORITY">Priority (lower number first)</option></select></label>
                    {schedAlgo === 'RR' && <label className="w-28"><span className="mb-1.5 block text-[10px] text-slate-500">Time quantum</span><input type="number" min="1" value={timeQuantum} onChange={(e) => setTimeQuantum(Number(e.target.value))} className="field w-full" /></label>}
                    <button onClick={runSchedulerSimulation} className="rounded-lg bg-emerald-500 px-4 py-2.5 text-xs font-semibold text-[#08120d] transition hover:bg-emerald-400"><Play className="mr-1.5 inline h-3.5 w-3.5" />Run simulation</button>
                  </div>
                  <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <StatCard label="Average waiting time" value={schedulerMetrics.averageWaiting} helper="Time units · last simulation" icon={Clock3} />
                    <StatCard label="Average turnaround" value={schedulerMetrics.averageTurnaround} helper="Time units · last simulation" icon={Activity} />
                  </div>
                  <div className="rounded-xl border border-white/[0.08] bg-[#101317] p-4">
                    <div className="mb-4 flex items-center justify-between"><h3 className="text-xs font-semibold text-slate-300">Execution timeline</h3><span className="text-[10px] text-slate-500">{ganttTimeline.length} CPU slices</span></div>
                    {ganttTimeline.length ? <div className="overflow-x-auto pb-2"><div className="flex min-w-max items-stretch gap-1.5">
                      {ganttTimeline.map((slice, index) => <div key={`${slice.pid}-${slice.start}-${index}`} style={{ width: Math.max(92, Math.min(180, slice.duration * 25 + 55)) }} className="overflow-hidden rounded-lg border border-emerald-300/20 bg-emerald-400/[0.07]">
                        <div className="border-b border-white/[0.06] px-3 py-2 text-[10px] text-slate-400">{slice.start} – {slice.end}</div><div className="px-3 py-3"><div className="truncate text-xs font-semibold text-emerald-200">{slice.name}</div><div className="mt-1 text-[10px] text-slate-500">PID {slice.pid} · {slice.duration}u</div></div>
                      </div>)}
                    </div></div> : <p className="py-8 text-center text-xs text-slate-500">No runnable processes to schedule.</p>}
                  </div>
                  <div className="mt-5 rounded-xl border border-white/[0.08] bg-[#101317] p-4 font-mono">
                    <div className="mb-3 flex items-center gap-2 text-[10px] uppercase tracking-[0.12em] text-slate-500"><Terminal className="h-3.5 w-3.5" />Scheduler log</div>
                    <div className="space-y-2">{schedulerLog.map((line, index) => <p key={`${index}-${line}`} className="break-words text-[11px] leading-relaxed text-emerald-200/80"><span className="mr-2 text-slate-600">›</span>{line}</p>)}</div>
                  </div>
                </div>
              )}

              {win.id === 'terminal' && (
                <div className="flex h-full min-h-[280px] flex-col overflow-hidden rounded-lg border border-white/[0.09] bg-[#0a0d10]/95 font-mono text-[11px] shadow-inner">
                  <div className="flex shrink-0 items-center justify-between border-b border-white/[0.055] px-4 py-2.5"><div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-emerald-400/80" /><span className="text-[10px] text-slate-400">minios@kernel</span></div><span className="text-[10px] text-slate-600">MINIOS shell · simulated</span></div>
                  <div
                    className="min-h-0 flex-1 overflow-y-auto p-4 leading-relaxed text-emerald-100/90"
                    onClick={() => {
                      const el = terminalInputRef.current;
                      if (el) {
                        el.focus();
                        keepTerminalCursorAtEnd(el);
                      }
                    }}
                  >
                    {termHistory.map((line, index) => <pre key={index} className="whitespace-pre-wrap break-words font-mono">{line || ' '}</pre>)}
                    <form onSubmit={handleTerminalSubmit} className="flex items-baseline gap-2 font-mono leading-relaxed">
                      <span className="shrink-0 whitespace-pre text-sky-300">{promptText}</span>
                      <input
                        ref={terminalInputRef}
                        autoComplete="off"
                        spellCheck={false}
                        value={termInput}
                        onChange={(e) => {
                          setTermInput(e.target.value);
                          requestAnimationFrame(() => keepTerminalCursorAtEnd(e.target));
                        }}
                        onKeyDown={(e) => {
                          if (['ArrowLeft', 'Home', 'PageUp'].includes(e.key)) {
                            e.preventDefault();
                            keepTerminalCursorAtEnd(e.currentTarget);
                          }
                        }}
                        onClick={(e) => keepTerminalCursorAtEnd(e.currentTarget)}
                        onMouseUp={(e) => keepTerminalCursorAtEnd(e.currentTarget)}
                        onSelect={(e) => keepTerminalCursorAtEnd(e.currentTarget)}
                        aria-label="Terminal command"
                        className="min-w-0 flex-1 border-0 bg-transparent p-0 font-mono text-[11px] text-slate-100 outline-none ring-0 focus:border-0 focus:outline-none focus:ring-0"
                        placeholder=""
                      />
                    </form>
                    <div ref={terminalEndRef} />
                  </div>
                </div>
              )}

              {win.id === 'file-manager' && (
                <div onContextMenu={openFileContextMenu}>
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2"><FolderOpen className="h-4 w-4 text-amber-200" /><h2 className="text-sm font-semibold text-slate-100">Files</h2><span className="rounded-md border border-white/[0.08] bg-white/[0.035] px-2 py-1 text-[10px] text-slate-400">{visibleFiles.length} items</span>{selectedFileKeys.length > 0 && <span className="text-[10px] text-sky-200">{selectedFileKeys.length} selected</span>}</div>
                    <div className="flex items-center gap-2"><button onClick={() => beginCreateItem('file')} className="rounded-md border border-white/[0.1] bg-white/[0.055] px-2.5 py-1.5 text-[10px] text-slate-200 transition hover:bg-white/[0.1]"><FilePlus className="mr-1 inline h-3.5 w-3.5" />New file</button><button onClick={() => beginCreateItem('dir')} className="rounded-md border border-white/[0.1] bg-white/[0.055] px-2.5 py-1.5 text-[10px] text-slate-200 transition hover:bg-white/[0.1]"><FolderPlus className="mr-1 inline h-3.5 w-3.5" />New folder</button></div>
                  </div>
                  <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-white/[0.09] bg-white/[0.045] px-3 py-2.5 backdrop-blur-xl">
                    <button
                      type="button"
                      onClick={goUpDirectory}
                      disabled={isAtFileRoot}
                      className="flex items-center gap-1 rounded-md border border-white/[0.1] bg-white/[0.05] px-2 py-1 text-[11px] font-medium text-slate-200 transition hover:bg-white/[0.12] disabled:cursor-not-allowed disabled:opacity-30"
                      title="Go back to parent folder (Backspace)"
                    >
                      <ArrowUp className="h-3.5 w-3.5" /> Back
                    </button>
                    <Folder className="h-4 w-4 shrink-0 text-amber-200" />
                    <span className="text-[11px] text-slate-400">Location</span>
                    <div className="flex min-w-0 flex-1 items-center gap-0.5 overflow-hidden font-mono text-[11px]">
                      {breadcrumbTrail.map((node, index) => (
                        <span key={node.id} className="flex min-w-0 items-center gap-0.5">
                          {index > 0 && <ChevronRight className="h-3 w-3 shrink-0 text-slate-500" />}
                          <button type="button" onClick={() => navigateToDir(node.id)} title={node.name} className={`truncate rounded px-1.5 py-0.5 transition hover:bg-white/[0.09] ${index === breadcrumbTrail.length - 1 ? 'text-slate-100' : 'text-slate-400 hover:text-slate-100'}`}>{node.name}</button>
                        </span>
                      ))}
                    </div>
                    <button onClick={() => navigateToDir('D0')} className="rounded-md px-2 py-1 text-[10px] text-slate-400 transition hover:bg-white/[0.07] hover:text-slate-100" title="Return to root directory">Root (/)</button>
                  </div>
                  <div ref={fileListRef} className="relative min-h-[250px] overflow-x-auto rounded-xl border border-white/[0.09] bg-black/[0.08]" onMouseDown={beginFileSelection} onContextMenu={(event) => openFileContextMenu(event)}>
                    <table className="w-full min-w-[620px] text-left text-xs">
                      <thead className="bg-white/[0.055] text-[10px] uppercase tracking-[0.1em] text-slate-400"><tr>{['Name', 'Kind', 'Size', 'Modified', ''].map((item) => <th key={item} className="px-3.5 py-3 font-medium">{item}</th>)}</tr></thead>
                      <tbody className="divide-y divide-white/[0.055]">
                        {!isAtFileRoot && (
                          <tr
                            onClick={goUpDirectory}
                            className="cursor-pointer transition hover:bg-white/[0.055]"
                            title="Go back to parent directory"
                          >
                            <td className="px-3.5 py-2.5">
                              <span className="flex items-center gap-2.5 text-slate-300">
                                <ArrowUp className="h-4 w-4 text-amber-200" />
                                <span className="font-mono font-semibold">.. (Parent Directory)</span>
                              </span>
                            </td>
                            <td className="px-3.5 py-2.5 text-slate-500">Folder</td>
                            <td className="px-3.5 py-2.5 font-mono text-slate-500">—</td>
                            <td className="px-3.5 py-2.5 font-mono text-slate-500">—</td>
                            <td className="px-3.5 py-2.5" />
                          </tr>
                        )}
                        {visibleFiles.map((file) => {
                          const key = getFileKey(file);
                          const isSelected = selectedFileKeys.includes(key);
                          return (
                            <tr
                              key={key}
                              data-file-key={key}
                              onClick={(event) => handleFileRowClick(event, file)}
                              onDoubleClick={() => openFileEntry(file)}
                              onContextMenu={(event) => openFileContextMenu(event, file)}
                              className={`cursor-pointer transition ${isSelected ? 'bg-sky-300/[0.16] outline outline-1 -outline-offset-1 outline-sky-200/35' : 'hover:bg-white/[0.055]'}`}
                            >
                              <td className="px-3.5 py-3">
                                <span className="flex items-center gap-2.5">
                                  {file.type === 'dir' ? <Folder className="h-4 w-4 text-amber-200" /> : <FileText className="h-4 w-4 text-sky-300" />}
                                  <span className="font-medium text-slate-100 hover:underline">{file.name}</span>
                                </span>
                              </td>
                              <td className="px-3.5 py-3 text-slate-400">{file.type === 'dir' ? 'Folder' : 'File'}</td>
                              <td className="px-3.5 py-3 font-mono text-slate-400">{file.size}</td>
                              <td className="px-3.5 py-3 font-mono text-slate-400">{file.modified}</td>
                              <td className="px-3.5 py-3 text-right">
                                <button
                                  type="button"
                                  onClick={(event) => { event.stopPropagation(); deleteItemRecursive(file); setToast(`Deleted ${file.name}`); }}
                                  title={`Delete ${file.name}`}
                                  className="rounded-md p-1.5 text-slate-500 transition hover:bg-rose-400/[0.1] hover:text-rose-300"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                        {!visibleFiles.length && <tr><td colSpan="5" className="py-12 text-center text-slate-500"><FolderOpen className="mx-auto mb-2 h-6 w-6 text-slate-600" />This folder is empty.<p className="mt-1 text-[10px]">Right-click and choose New to add a file or folder.</p></td></tr>}
                      </tbody>
                    </table>
                    {fileSelectionStyle && <div aria-hidden="true" className="pointer-events-none absolute z-20 border border-sky-200/70 bg-sky-300/15" style={fileSelectionStyle} />}
                  </div>
                </div>
              )}

              {win.id === 'text-editor' && (
                <TextEditor
                  tabs={editorTabs}
                  setTabs={setEditorTabs}
                  activeTabKey={activeEditorTab}
                  setActiveTabKey={setActiveEditorTab}
                  files={fsFiles}
                  directories={fsDirectories}
                  openRequest={editorOpenRequest}
                  onNotify={(message) => setToast(message)}
                />
              )}

              {win.id === 'memory' && (
                <div>
                  <SectionHeading
                    eyebrow="Kernel / Memory & Paging Subsystem"
                    title="Memory management & Paging"
                    description="Real-time telemetry stream directly from the C++ MiniOS kernel engine."
                    icon={HardDrive}
                    action={
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-md border border-white/[0.08] px-2.5 py-1.5 text-[10px] text-slate-400">
                          Page size <b className="ml-1 text-slate-200">{pagingStats?.pageSize || 4} KB</b>
                        </span>
                        <div className="inline-flex rounded-lg border border-white/[0.08] bg-black/30 p-0.5">
                          <button
                            type="button"
                            onClick={() => setMemoryTab('paging')}
                            className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition ${memoryTab === 'paging' ? 'bg-sky-500/20 text-sky-200 border border-sky-400/30' : 'text-slate-400 hover:text-slate-200'
                              }`}
                          >
                            Paging & Frames
                          </button>
                          <button
                            type="button"
                            onClick={() => setMemoryTab('partitions')}
                            className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition ${memoryTab === 'partitions' ? 'bg-sky-500/20 text-sky-200 border border-sky-400/30' : 'text-slate-400 hover:text-slate-200'
                              }`}
                          >
                            Contiguous Partitions
                          </button>
                        </div>
                      </div>
                    }
                  />

                  {memoryTab === 'paging' ? (
                    <>
                      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-4">
                        <StatCard label="Total Frames" value={pagingStats?.totalFrames || 64} helper={`${pagingStats?.totalMemory || 256} KB physical space`} icon={HardDrive} />
                        <StatCard label="Allocated Frames" value={`${pagingStats?.usedFrames ?? ((pagingStats?.totalFrames || 64) - (pagingStats?.freeFrames || 64))} / ${pagingStats?.totalFrames || 64}`} helper={`${pagingStats?.freeFrames ?? 64} frames available`} icon={Activity} />
                        <StatCard label="Page Faults" value={pagingStats?.pageFaults ?? 0} helper="Demand paging misses" icon={Zap} />
                        <div className="flex flex-col justify-between rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] text-slate-400">Page Policy</span>
                            <SlidersHorizontal className="h-4 w-4 text-sky-400" />
                          </div>
                          <div className="mt-2 flex items-center gap-1.5">
                            <button type="button" onClick={() => setPagePolicy('LRU')} className={`flex-1 rounded-md py-1 text-center font-mono text-xs font-semibold transition ${(pagingStats?.policy || 'LRU') === 'LRU' ? 'bg-sky-400/20 text-sky-200 border border-sky-400/40' : 'bg-white/[0.04] text-slate-400 hover:bg-white/[0.08]'}`}>LRU</button>
                            <button type="button" onClick={() => setPagePolicy('FIFO')} className={`flex-1 rounded-md py-1 text-center font-mono text-xs font-semibold transition ${(pagingStats?.policy || 'LRU') === 'FIFO' ? 'bg-sky-400/20 text-sky-200 border border-sky-400/40' : 'bg-white/[0.04] text-slate-400 hover:bg-white/[0.08]'}`}>FIFO</button>
                          </div>
                          <span className="mt-1 text-[10px] text-slate-500">Replacement algorithm</span>
                        </div>
                      </div>

                      <div className="mb-5 rounded-xl border border-white/[0.08] bg-[#101317] p-4">
                        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <h3 className="text-xs font-semibold text-slate-200">Physical Frame Allocation Map</h3>
                            <p className="text-[10px] text-slate-500">64 physical frames (4 KB each). Click an allocated frame to filter its process.</p>
                          </div>
                          <div className="flex flex-wrap items-center gap-3 text-[10px] text-slate-400">
                            <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-sm bg-sky-400" />Allocated</span>
                            <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-sm bg-slate-700" />Free</span>
                            {selectedPagingPID !== 'ALL' && (
                              <button type="button" onClick={() => setSelectedPagingPID('ALL')} className="rounded bg-white/[0.08] px-2 py-0.5 text-slate-300 hover:bg-white/[0.15]">Clear Filter</button>
                            )}
                          </div>
                        </div>

                        <div className="grid grid-cols-8 gap-1.5 sm:grid-cols-16">
                          {(pagingStats?.frames && pagingStats.frames.length > 0
                            ? pagingStats.frames
                            : Array.from({ length: 64 }).map((_, index) => ({ frameId: index, isFree: true, processPID: '', pageNumber: -1 }))
                          ).map((frame) => {
                            const isAlloc = !frame.isFree;
                            const isSelectedProc = selectedPagingPID !== 'ALL' && frame.processPID === selectedPagingPID;
                            const color = getProcColor(frame.processPID);

                            return (
                              <button
                                key={frame.frameId}
                                type="button"
                                onClick={() => { if (frame.processPID) setSelectedPagingPID(frame.processPID); }}
                                title={isAlloc ? `Frame #${frame.frameId}: Process ${frame.processPID} (Page ${frame.pageNumber})` : `Frame #${frame.frameId}: Free`}
                                className={`group relative flex aspect-square flex-col items-center justify-center rounded-md border text-[10px] font-mono transition duration-150 ${isAlloc
                                    ? isSelectedProc
                                      ? 'border-sky-300 bg-sky-400/30 text-white ring-2 ring-sky-300/50 shadow-[0_0_12px_rgba(56,189,248,0.3)]'
                                      : `${color.border} ${color.bg} ${color.text} hover:scale-105`
                                    : 'border-white/[0.04] bg-white/[0.02] text-slate-600 hover:border-white/[0.1]'
                                  }`}
                              >
                                <span className="text-[9px] font-semibold">{frame.frameId}</span>
                                {isAlloc && <span className="mt-0.5 scale-90 truncate font-mono text-[8px] font-bold tracking-tighter opacity-90">{frame.processPID}</span>}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                        <div className="rounded-xl border border-white/[0.08] bg-[#101317] p-4 lg:col-span-2">
                          <div className="mb-3 flex items-center justify-between">
                            <div>
                              <h3 className="text-xs font-semibold text-slate-200">Process Page Tables</h3>
                              <p className="text-[10px] text-slate-500">Virtual page to physical frame translations</p>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] text-slate-400">Filter:</span>
                              <select value={selectedPagingPID} onChange={(e) => setSelectedPagingPID(e.target.value)} className="rounded border border-white/[0.1] bg-white/[0.04] px-2 py-1 text-[11px] text-slate-200 outline-none">
                                <option value="ALL">All Processes</option>
                                {pagingStats?.pageTables && Object.keys(pagingStats.pageTables).map((pid) => (
                                  <option key={pid} value={pid}>Process {pid}</option>
                                ))}
                              </select>
                            </div>
                          </div>

                          <div className="max-h-[260px] overflow-y-auto">
                            {pagingStats?.pageTables && Object.keys(pagingStats.pageTables).length > 0 ? (
                              Object.entries(pagingStats.pageTables)
                                .filter(([pid]) => selectedPagingPID === 'ALL' || pid === selectedPagingPID)
                                .map(([pid, entries]) => {
                                  const color = getProcColor(pid);
                                  return (
                                    <div key={pid} className="mb-3 rounded-lg border border-white/[0.06] bg-white/[0.015] p-3 last:mb-0">
                                      <div className="mb-2 flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                          <span className={`h-2 w-2 rounded-full ${color.dot}`} />
                                          <span className="font-mono text-xs font-semibold text-slate-200">Process {pid}</span>
                                          <span className="text-[10px] text-slate-500">({entries.length} virtual pages)</span>
                                        </div>
                                        <span className="text-[10px] text-slate-400">
                                          {entries.filter((e) => e.valid).length} in RAM · {entries.filter((e) => !e.valid).length} swapped
                                        </span>
                                      </div>
                                      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4 md:grid-cols-6">
                                        {entries.map((entry) => (
                                          <div key={entry.pageNumber} className={`rounded-md border p-1.5 text-center font-mono text-[10px] ${entry.valid ? 'border-emerald-400/25 bg-emerald-400/[0.08] text-emerald-200' : 'border-rose-400/20 bg-rose-400/[0.05] text-rose-300'}`}>
                                            <div className="text-[9px] text-slate-400">Page {entry.pageNumber}</div>
                                            <div className="font-semibold">{entry.valid ? `Frame ${entry.frameNumber}` : 'Swapped'}</div>
                                            <div className="text-[8px] text-slate-500">t={entry.lastAccessTime}</div>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  );
                                })
                            ) : (
                              <div className="py-8 text-center text-xs text-slate-500">
                                No active processes allocated in virtual memory. Spawn a process in Process Manager to view its page table.
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex flex-col justify-between rounded-xl border border-white/[0.08] bg-[#101317] p-4">
                          <div>
                            <div className="mb-2 flex items-center gap-2">
                              <Zap className="h-4 w-4 text-amber-300" />
                              <h3 className="text-xs font-semibold text-slate-200">Translate Logical Address</h3>
                            </div>
                            <p className="mb-4 text-[11px] leading-relaxed text-slate-400">
                              Simulate an MMU memory reference. Active pages register cache hits; missing pages trigger demand page faults and LRU/FIFO eviction.
                            </p>

                            <div className="space-y-3">
                              <label className="block">
                                <span className="mb-1 block text-[10px] text-slate-400">Target Process</span>
                                <select
                                  value={selectedPagingPID === 'ALL' ? (Object.keys(pagingStats?.pageTables || {})[0] || '') : selectedPagingPID}
                                  onChange={(e) => setSelectedPagingPID(e.target.value)}
                                  className="field w-full text-xs"
                                >
                                  {pagingStats?.pageTables && Object.keys(pagingStats.pageTables).length > 0 ? (
                                    Object.keys(pagingStats.pageTables).map((pid) => (
                                      <option key={pid} value={pid}>Process {pid}</option>
                                    ))
                                  ) : (
                                    <option value="">No active process</option>
                                  )}
                                </select>
                              </label>

                              <label className="block">
                                <span className="mb-1 block text-[10px] text-slate-400">Logical Address (offset)</span>
                                <input type="number" min="0" value={testLogicalAddr} onChange={(e) => setTestLogicalAddr(e.target.value)} className="field w-full text-xs" placeholder="e.g. 0, 4, 8" />
                              </label>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              const pid = selectedPagingPID === 'ALL' ? Object.keys(pagingStats?.pageTables || {})[0] : selectedPagingPID;
                              testAccessMemory(pid, testLogicalAddr);
                            }}
                            disabled={!pagingStats?.pageTables || Object.keys(pagingStats.pageTables).length === 0}
                            className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-lg bg-sky-500 py-2 text-xs font-semibold text-slate-950 transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            <Play className="h-3.5 w-3.5" />
                            Reference Address
                          </button>
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-4">
                        <StatCard label="Physical RAM" value={`${memoryStats?.totalMemory || 100} MB`} helper="Simulated capacity" icon={HardDrive} />
                        <StatCard label="Allocated Space" value={`${memoryStats?.usedMemory || 0} MB`} helper={`${memoryStats?.freeMemory || 100} MB free`} icon={Activity} />
                        <StatCard label="External Fragmentation" value={`${Number(memoryStats?.externalFragmentation || 0).toFixed(1)}%`} helper="Scattered free space" icon={SlidersHorizontal} />
                        <div className="flex flex-col justify-between rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] text-slate-400">Partition Allocator</span>
                            <SlidersHorizontal className="h-4 w-4 text-emerald-400" />
                          </div>
                          <div className="mt-2 flex items-center gap-1">
                            {['FirstFit', 'BestFit', 'WorstFit'].map((strat) => (
                              <button
                                key={strat}
                                type="button"
                                onClick={() => setAllocStrategy(strat)}
                                className={`flex-1 rounded py-1 text-center font-mono text-[10px] font-semibold transition ${activeAllocStrategy === strat
                                    ? 'bg-emerald-400/20 text-emerald-200 border border-emerald-400/40'
                                    : 'bg-white/[0.04] text-slate-400 hover:bg-white/[0.08]'
                                  }`}
                              >
                                {strat.replace('Fit', '')}
                              </button>
                            ))}
                          </div>
                          <span className="mt-1 text-[10px] text-slate-500">Current: {activeAllocStrategy}</span>
                        </div>
                      </div>

                      <div className="mb-5 rounded-xl border border-white/[0.08] bg-[#101317] p-4">
                        <div className="mb-3 flex items-center justify-between">
                          <div>
                            <h3 className="text-xs font-semibold text-slate-200">Continuous Memory Address Space (0 – {memoryStats?.totalMemory || 100} MB)</h3>
                            <p className="text-[10px] text-slate-500">Partition layout with real-time process block placement</p>
                          </div>
                          <button type="button" onClick={compactMemory} className="flex items-center gap-1.5 rounded-lg border border-emerald-400/30 bg-emerald-400/10 px-3 py-1.5 text-xs font-medium text-emerald-200 transition hover:bg-emerald-400/20">
                            <Minimize2 className="h-3.5 w-3.5" />
                            Compact RAM (Defragment)
                          </button>
                        </div>

                        <div className="mb-4 flex h-10 w-full overflow-hidden rounded-lg border border-white/[0.1] bg-black/40">
                          {memoryStats?.blocks && memoryStats.blocks.length > 0 ? (
                            memoryStats.blocks.map((block, idx) => {
                              const pct = Math.max(2, (block.size / (memoryStats.totalMemory || 100)) * 100);
                              const color = getProcColor(block.processPID);
                              return (
                                <div
                                  key={idx}
                                  style={{ width: `${pct}%` }}
                                  title={block.isFree ? `Free Block: ${block.size} MB (${block.start} - ${block.end})` : `Process ${block.processPID}: ${block.size} MB (${block.start} - ${block.end})`}
                                  className={`relative flex h-full items-center justify-center border-r border-black/50 text-[10px] font-mono font-medium transition ${block.isFree ? 'bg-slate-800/40 text-slate-500' : `${color.bg} ${color.text} font-semibold`
                                    }`}
                                >
                                  <span className="truncate px-1">{block.isFree ? `Free ${block.size}M` : `${block.processPID} (${block.size}M)`}</span>
                                </div>
                              );
                            })
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-xs text-slate-500">Free Memory (100 MB)</div>
                          )}
                        </div>

                        <div className="overflow-x-auto">
                          <table className="w-full text-left font-mono text-[11px]">
                            <thead className="border-b border-white/[0.08] text-[10px] uppercase text-slate-500">
                              <tr>
                                <th className="pb-2">Block #</th>
                                <th className="pb-2">Range</th>
                                <th className="pb-2">Size</th>
                                <th className="pb-2">Owner PID</th>
                                <th className="pb-2 text-right">Status</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-white/[0.04]">
                              {memoryStats?.blocks && memoryStats.blocks.length > 0 ? (
                                memoryStats.blocks.map((block, idx) => (
                                  <tr key={idx} className="hover:bg-white/[0.02]">
                                    <td className="py-2 text-slate-400">Block {idx}</td>
                                    <td className="py-2 text-slate-300">0x{block.start} – 0x{block.end}</td>
                                    <td className="py-2 text-slate-200">{block.size} MB</td>
                                    <td className="py-2">{block.processPID || '—'}</td>
                                    <td className="py-2 text-right">
                                      <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${block.isFree ? 'bg-slate-700/40 text-slate-400' : 'bg-emerald-400/15 text-emerald-300 border border-emerald-400/30'}`}>
                                        {block.isFree ? 'FREE' : 'OCCUPIED'}
                                      </span>
                                    </td>
                                  </tr>
                                ))
                              ) : (
                                <tr><td colSpan="5" className="py-4 text-center text-slate-500">No partition data available.</td></tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}

              {win.id === 'system-monitor' && (
                <div>
                  <SectionHeading eyebrow="System / Telemetry" title="System monitor" description="Values below are generated by this OS simulation; they do not measure the host computer." icon={Monitor} action={<span className="rounded-md border border-white/[0.08] px-2.5 py-1.5 text-[10px] text-slate-500">Demo telemetry</span>} />
                  <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3"><StatCard label="Runnable processes" value={activeProcesses} helper="READY or RUNNING" icon={Cpu} /><StatCard label="Process table" value={processes.length} helper="All states, including terminated" icon={Activity} /><StatCard label="System state" value="Stable" helper="No simulated alerts" icon={ShieldCheck} /></div>
                  <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4"><h3 className="mb-4 text-xs font-semibold text-slate-300">Process distribution</h3>{['RUNNING', 'READY', 'NEW', 'BLOCKED', 'TERMINATED'].map((state) => { const count = processes.filter((p) => p.state === state).length; const pct = processes.length ? (count / processes.length) * 100 : 0; return <div key={state} className="mb-4 last:mb-0"><div className="mb-2 flex justify-between text-[11px]"><span className="text-slate-400">{state}</span><span className="font-mono text-slate-300">{count}</span></div><div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]"><div style={{ width: `${pct}%` }} className={`h-full rounded-full ${state === 'RUNNING' ? 'bg-emerald-300/70' : state === 'READY' ? 'bg-amber-200/70' : state === 'NEW' ? 'bg-sky-300/70' : state === 'BLOCKED' ? 'bg-rose-300/60' : 'bg-slate-500/70'}`} /></div></div>; })}</div>
                </div>
              )}

              {win.id === 'settings' && (
                <div>
                  <SectionHeading eyebrow="Personalization" title="Settings" description="Adjust the desktop's appearance and application dock." icon={Settings} />
                  <div className="space-y-4">
                    <section className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
                      <div className="mb-4 flex items-start gap-3"><div className="rounded-lg border border-white/[0.08] bg-white/[0.04] p-2 text-slate-300"><LayoutGrid className="h-4 w-4" /></div><div><h3 className="text-xs font-semibold text-slate-200">Pinned dock applications</h3><p className="mt-1 text-[11px] leading-5 text-slate-500">Pin or unpin apps from your desktop dock (or right-click any dock icon).</p></div></div>
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        {INITIAL_APPS.filter((a) => a.id !== 'settings').map((app) => {
                          const isPinned = pinnedApps.includes(app.id);
                          return (
                            <div key={app.id} className="flex items-center justify-between rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2">
                              <div className="flex items-center gap-2.5">
                                <span className={`flex h-7 w-7 items-center justify-center rounded-md border ${APP_TONES[app.id]}`}><AppIcon app={app} size="sm" /></span>
                                <span className="text-xs font-medium text-slate-200">{app.title}</span>
                              </div>
                              <button
                                type="button"
                                onClick={() => togglePinnedApp(app.id)}
                                className={`rounded-md border px-2.5 py-1 text-[10px] font-medium transition ${isPinned
                                    ? 'border-rose-400/30 bg-rose-500/10 text-rose-200 hover:bg-rose-500/20'
                                    : 'border-emerald-400/30 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/20'
                                  }`}
                              >
                                {isPinned ? 'Unpin from dock' : 'Pin to dock'}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </section>
                    <section className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
                      <div className="mb-4 flex items-start gap-3"><div className="rounded-lg border border-white/[0.08] bg-white/[0.04] p-2 text-slate-300"><SlidersHorizontal className="h-4 w-4" /></div><div><h3 className="text-xs font-semibold text-slate-200">Dock icon size</h3><p className="mt-1 text-[11px] leading-5 text-slate-500">Change the size of app icons in the desktop dock.</p></div></div>
                      <div className="grid grid-cols-3 gap-2">{[{ id: 'sm', label: 'Compact', detail: 'Small icons' }, { id: 'md', label: 'Standard', detail: 'Default size' }, { id: 'lg', label: 'Large', detail: 'Larger icons' }].map((option) => <button key={option.id} onClick={() => setIconSize(option.id)} className={`rounded-lg border p-3 text-left transition ${iconSize === option.id ? 'border-slate-300/30 bg-white/[0.075]' : 'border-white/[0.07] bg-transparent hover:bg-white/[0.035]'}`}><span className="mb-3 flex h-8 items-center gap-1.5">{[0, 1, 2].map((n) => <span key={n} className={`block rounded-md border border-white/[0.08] bg-slate-300/10 ${option.id === 'sm' ? 'h-5 w-5' : option.id === 'lg' ? 'h-7 w-7' : 'h-6 w-6'}`} />)}</span><span className="block text-xs font-medium text-slate-200">{option.label}</span><span className="mt-1 block text-[10px] text-slate-500">{option.detail}</span>{iconSize === option.id && <Check className="mt-2 h-3.5 w-3.5 text-emerald-300" />}</button>)}</div>
                    </section>
                    <section className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
                      <div className="mb-4 flex items-start gap-3"><div className="rounded-lg border border-white/[0.08] bg-white/[0.04] p-2 text-slate-300"><LayoutGrid className="h-4 w-4" /></div><div><h3 className="text-xs font-semibold text-slate-200">Dock position</h3><p className="mt-1 text-[11px] leading-5 text-slate-500">Choose where the MINIOS dock sits on your desktop.</p></div></div>
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">{[{ id: 'left', label: 'Left', description: 'Vertical dock on the left' }, { id: 'right', label: 'Right', description: 'Vertical dock on the right' }, { id: 'bottom', label: 'Bottom', description: 'Horizontal dock along the bottom' }].map((option) => <button key={option.id} onClick={() => setDockPosition(option.id)} className={`flex items-center gap-3 rounded-lg border p-3 text-left transition ${dockPosition === option.id ? 'border-sky-200/30 bg-white/[0.075]' : 'border-white/[0.07] hover:bg-white/[0.035]'}`}><span className="relative h-10 w-14 shrink-0 rounded-md border border-white/[0.14] bg-slate-950/45"><i className={`absolute block rounded-sm bg-sky-200/90 shadow-[0_0_6px_rgba(186,230,253,.2)] ${option.id === 'left' ? 'bottom-1 left-1 top-1 w-1.5' : option.id === 'right' ? 'bottom-1 right-1 top-1 w-1.5' : 'bottom-1 left-1 right-1 h-1.5'}`} /></span><span className="min-w-0 flex-1"><span className="block text-xs font-medium text-slate-200">{option.label}</span><span className="mt-1 block text-[10px] text-slate-500">{option.description}</span></span>{dockPosition === option.id && <Check className="h-3.5 w-3.5 shrink-0 text-emerald-300" />}</button>)}</div>
                    </section>
                    <section className="rounded-xl border border-white/[0.09] bg-white/[0.035] p-4 backdrop-blur-xl">
                      <div className="mb-3 flex items-start gap-3"><div className="rounded-lg border border-white/[0.1] bg-white/[0.06] p-2 text-slate-200"><Moon className="h-4 w-4" /></div><div><h3 className="text-xs font-semibold text-slate-100">Desktop colors</h3><p className="mt-1 text-[11px] text-slate-400">Choose a richer color palette for the desktop background.</p></div></div>
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">{[{ id: 'ocean', label: 'Ocean', preview: 'from-[#24506d] via-[#354777] to-[#533d70]' }, { id: 'aurora', label: 'Aurora', preview: 'from-[#17605e] via-[#245274] to-[#483d78]' }, { id: 'sunset', label: 'Sunset', preview: 'from-[#874b5b] via-[#59436f] to-[#2b5272]' }].map((option) => <button key={option.id} onClick={() => { setTheme(option.id); setWallpaperImage(''); setWallpaperName(''); }} className={`flex items-center gap-3 rounded-lg border p-2.5 text-left transition ${theme === option.id && !wallpaperImage ? 'border-white/30 bg-white/[0.09]' : 'border-white/[0.08] hover:bg-white/[0.06]'}`}><span className={`h-9 w-11 rounded-md border border-white/15 bg-gradient-to-br ${option.preview}`} /><span className="flex-1 text-xs text-slate-100">{option.label}</span>{theme === option.id && !wallpaperImage && <Check className="h-3.5 w-3.5 text-emerald-200" />}</button>)}</div>
                    </section>
                    <section className="rounded-xl border border-white/[0.09] bg-white/[0.035] p-4 backdrop-blur-xl">
                      <div className="mb-3 flex items-start gap-3"><div className="rounded-lg border border-white/[0.1] bg-white/[0.06] p-2 text-slate-200"><Monitor className="h-4 w-4" /></div><div><h3 className="text-xs font-semibold text-slate-100">Wallpaper image</h3><p className="mt-1 text-[11px] leading-5 text-slate-400">Choose an image from your laptop to use as your MINIOS desktop wallpaper.</p></div></div>
                      <div className="flex flex-wrap items-center gap-3">
                        <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-white/[0.12] bg-white/[0.08] px-3.5 py-2.5 text-xs font-medium text-slate-100 transition hover:bg-white/[0.14]"><Plus className="h-3.5 w-3.5" />Choose image<input type="file" accept="image/*" className="hidden" onChange={handleWallpaperUpload} /></label>
                        {wallpaperImage && <button onClick={() => { setWallpaperImage(''); setWallpaperName(''); setToast('Wallpaper reset to the selected color palette.'); }} className="rounded-lg border border-white/[0.1] px-3 py-2.5 text-xs text-slate-300 transition hover:bg-white/[0.06]">Reset wallpaper</button>}
                        <span className="max-w-full truncate text-[11px] text-slate-400">{wallpaperName || 'No custom image selected'}</span>
                      </div>
                    </section>
                    <section className="flex items-center justify-between gap-4 rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
                      <div className="flex items-center gap-3">
                        {!logoError && <img src="/logo.png" alt="MiniOS" className="h-8 w-8 rounded-lg object-cover" onError={() => setLogoError(true)} />}
                        <div>
                          <h3 className="text-xs font-semibold text-slate-200">About MINIOS</h3>
                          <p className="mt-1 text-[11px] text-slate-500">Desktop operating-system simulator</p>
                        </div>
                      </div>
                      <span className="rounded-md border border-white/[0.08] px-2.5 py-1.5 font-mono text-[10px] text-slate-400">v1.0.0</span>
                    </section>
                  </div>
                </div>
              )}
            </div>
          </section>
        );
      })}

      {appLauncherOpen && (
        <div className="absolute inset-0 z-[210] overflow-y-auto bg-[#111827]/62 backdrop-blur-2xl" onMouseDown={(event) => { if (event.target === event.currentTarget) setAppLauncherOpen(false); }}>
          <div className="mx-auto flex min-h-full w-full max-w-6xl flex-col px-6 pb-10 pt-7 sm:px-10">
            <div className="mb-6 flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                {!logoError && <img src="/logo.png" alt="MiniOS" className="h-10 w-10 rounded-xl object-cover shadow-md" onError={() => setLogoError(true)} />}
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-sky-200/80">MINIOS overview</p>
                  <h2 className="mt-1 text-xl font-semibold tracking-tight text-white">What would you like to open?</h2>
                  <p className="mt-1 text-xs text-slate-300/75">Search applications or jump back to an open window.</p>
                </div>
              </div>
              <button onClick={() => setAppLauncherOpen(false)} aria-label="Close overview" title="Close overview (Esc)" className="rounded-lg border border-white/[0.14] bg-white/[0.07] p-2 text-slate-200 transition hover:bg-white/[0.13]"><X className="h-4 w-4" /></button>
            </div>
            <div className="mx-auto w-full max-w-2xl">
              <div className="flex items-center gap-3 rounded-2xl border border-white/[0.2] bg-white/[0.13] px-4 py-3.5 shadow-[0_18px_60px_rgba(0,0,0,0.18)] ring-1 ring-white/[0.04] backdrop-blur-2xl">
                <Search className="h-5 w-5 shrink-0 text-sky-100" /><input ref={overviewSearchRef} value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search apps and open windows…" className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-slate-300/70" aria-label="Search applications and open windows" /><kbd className="hidden rounded-md border border-white/[0.14] bg-black/[0.12] px-2 py-1 text-[10px] text-slate-300 sm:inline">ESC</kbd>
              </div>
            </div>

            <section className="mt-9">
              <div className="mb-4 flex items-center justify-between"><h3 className="text-xs font-semibold uppercase tracking-[0.13em] text-slate-200">Open windows</h3><span className="text-[10px] text-slate-400">{filteredWindows.length} open</span></div>
              {filteredWindows.length ? <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">{filteredWindows.map((win) => {
                const app = INITIAL_APPS.find((item) => item.id === win.id);
                const Icon = app?.icon || Monitor;
                return <button key={win.id} onClick={() => openWindow(win.id)} className="group rounded-xl border border-white/[0.12] bg-white/[0.07] p-4 text-left shadow-lg backdrop-blur-xl transition duration-200 hover:-translate-y-1 hover:border-white/[0.24] hover:bg-white/[0.12]">
                  <div className="mb-4 flex items-center justify-between"><span className={`flex h-10 w-10 items-center justify-center rounded-xl border ${APP_TONES[win.id]}`}><Icon className="h-5 w-5" strokeWidth={1.7} /></span><span className="rounded-md border border-white/[0.1] bg-black/[0.12] px-2 py-1 text-[9px] text-slate-300">{win.isMinimized ? 'Minimized' : 'Running'}</span></div>
                  <p className="truncate text-sm font-semibold text-white">{win.title}</p><p className="mt-1 text-[11px] text-slate-300/70">Click to switch to this window</p>
                </button>;
              })}</div> : <div className="rounded-xl border border-dashed border-white/[0.15] bg-white/[0.025] px-4 py-7 text-center text-xs text-slate-400">No open windows match this search.</div>}
            </section>

            <section className="mt-9">
              <div className="mb-4 flex items-center justify-between"><h3 className="text-xs font-semibold uppercase tracking-[0.13em] text-slate-200">Applications</h3><span className="text-[10px] text-slate-400">{filteredApps.length} available</span></div>
              {filteredApps.length ? <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">{filteredApps.map((app) => {
                const isPinned = pinnedApps.includes(app.id);
                return (
                  <div key={app.id} onContextMenu={(event) => { if (app.id !== 'settings') openDockContextMenu(event, app.id); else event.preventDefault(); }} className="group flex items-center gap-3 rounded-xl border border-white/[0.09] bg-white/[0.045] p-3 text-left backdrop-blur-lg transition duration-200 hover:border-white/[0.17] hover:bg-white/[0.095]">
                    <button type="button" onClick={() => openWindow(app.id)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                      <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border ${APP_TONES[app.id]} transition duration-200 group-hover:scale-105`}><AppIcon app={app} size="md" /></span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-xs font-semibold text-slate-100">{app.title}</span>
                        <span className="mt-1 block truncate text-[10px] text-slate-400">{app.subtitle}</span>
                      </span>
                    </button>
                    {app.id !== 'settings' && (
                      <button
                        type="button"
                        onClick={(event) => { event.stopPropagation(); togglePinnedApp(app.id); }}
                        className={`shrink-0 rounded-md border px-2 py-1 text-[10px] font-medium transition ${isPinned
                            ? 'border-white/[0.14] bg-white/[0.06] text-slate-300 hover:border-rose-400/30 hover:bg-rose-500/15 hover:text-rose-200'
                            : 'border-sky-400/30 bg-sky-500/15 text-sky-200 hover:bg-sky-500/25'
                          }`}
                      >
                        {isPinned ? 'Unpin' : 'Pin'}
                      </button>
                    )}
                  </div>
                );
              })}</div> : <p className="rounded-xl border border-dashed border-white/[0.15] px-4 py-7 text-center text-xs text-slate-400">No applications found.</p>}
            </section>
          </div>
        </div>
      )}

      {contextMenu && (
        <div className="fixed z-[300] w-52 overflow-visible rounded-xl border border-white/[0.15] bg-[#242a34]/95 p-1.5 shadow-[0_18px_60px_rgba(0,0,0,0.45)] backdrop-blur-2xl" style={{ left: Math.max(8, Math.min(contextMenu.x, window.innerWidth - 220)), top: Math.max(8, Math.min(contextMenu.y, window.innerHeight - 310)) }} onMouseDown={(event) => event.stopPropagation()} onClick={(event) => event.stopPropagation()}>
          <button onClick={() => setContextNewOpen((open) => !open)} className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-xs text-slate-100 transition hover:bg-white/[0.09]"><span><Plus className="mr-2 inline h-3.5 w-3.5" />New</span><ChevronDown className={`h-3.5 w-3.5 -rotate-90 transition ${contextNewOpen ? 'rotate-0' : ''}`} /></button>
          {contextNewOpen && <div className="mb-1 ml-2 border-l border-white/[0.12] pl-2"><button onClick={() => beginCreateItem('dir')} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs text-slate-200 transition hover:bg-white/[0.09]"><FolderPlus className="h-3.5 w-3.5 text-amber-200" />Folder</button><button onClick={() => beginCreateItem('file')} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs text-slate-200 transition hover:bg-white/[0.09]"><FilePlus className="h-3.5 w-3.5 text-sky-200" />File</button></div>}
          {contextMenu.selectedKeys?.length > 0 && <>
            <div className="my-1 h-px bg-white/[0.09]" />
            <button onClick={() => copyOrCutSelectedFiles('copy')} className="w-full rounded-lg px-3 py-2 text-left text-xs text-slate-200 transition hover:bg-white/[0.09]">Copy <span className="float-right text-[10px] text-slate-500">Ctrl+C</span></button>
            <button onClick={() => copyOrCutSelectedFiles('cut')} className="w-full rounded-lg px-3 py-2 text-left text-xs text-slate-200 transition hover:bg-white/[0.09]">Cut <span className="float-right text-[10px] text-slate-500">Ctrl+X</span></button>
            {contextMenu.selectedKeys.length === 1 && (() => {
              const entry = visibleFiles.find((item) => item.id === contextMenu.selectedKeys[0]);
              if (!entry) return null;
              return <>
                <button onClick={() => { setContextMenu(null); openFileEntry(entry); }} className="w-full rounded-lg px-3 py-2 text-left text-xs text-slate-200 transition hover:bg-white/[0.09]">{entry.type === 'dir' ? 'Open folder' : 'Open in Text Editor'}</button>
                <button onClick={() => beginRename(entry)} className="w-full rounded-lg px-3 py-2 text-left text-xs text-slate-200 transition hover:bg-white/[0.09]">Rename <span className="float-right text-[10px] text-slate-500">F2</span></button>
              </>;
            })()}
            <button onClick={deleteSelectedFiles} className="w-full rounded-lg px-3 py-2 text-left text-xs text-rose-200 transition hover:bg-rose-400/[0.1]">Delete selected</button>
          </>}
          {fileClipboard && <>
            <div className="my-1 h-px bg-white/[0.09]" />
            <button onClick={pasteFiles} className="w-full rounded-lg px-3 py-2 text-left text-xs text-sky-100 transition hover:bg-sky-400/[0.1]">Paste <span className="float-right text-[10px] text-slate-500">Ctrl+V</span></button>
          </>}
          <div className="my-1 h-px bg-white/[0.09]" />
          <button onClick={() => { setContextMenu(null); setToast('Folder refreshed.'); }} className="w-full rounded-lg px-3 py-2 text-left text-xs text-slate-300 transition hover:bg-white/[0.09]">Refresh</button>
        </div>
      )}

      {dockContextMenu && (() => {
        const pinned = pinnedApps.includes(dockContextMenu.appId);
        const app = INITIAL_APPS.find((item) => item.id === dockContextMenu.appId);
        const isOpen = windows.some((win) => win.id === dockContextMenu.appId && win.isOpen);
        return (
          <div
            className="fixed z-[300] w-48 rounded-xl border border-white/[0.15] bg-[#242a34]/95 p-1.5 shadow-[0_18px_60px_rgba(0,0,0,0.45)] backdrop-blur-2xl"
            style={{ left: Math.max(8, Math.min(dockContextMenu.x, window.innerWidth - 205)), top: Math.max(8, Math.min(dockContextMenu.y, window.innerHeight - 140)) }}
            onMouseDown={(event) => event.stopPropagation()}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">{app?.title || 'Application'}</div>
            <button
              type="button"
              onClick={() => togglePinnedApp(dockContextMenu.appId)}
              className="w-full rounded-lg px-3 py-2.5 text-left text-xs text-slate-100 transition hover:bg-white/[0.09]"
            >
              {pinned ? 'Unpin from dock' : 'Pin to dock'}
            </button>
            {isOpen && (
              <button
                type="button"
                onClick={() => {
                  setWindows((previous) => previous.map((win) => win.id === dockContextMenu.appId ? { ...win, isOpen: false, isMinimized: false } : win));
                  setDockContextMenu(null);
                  setToast('Application window closed.');
                }}
                className="w-full rounded-lg px-3 py-2 text-left text-xs text-rose-200 transition hover:bg-rose-500/15"
              >
                Close window
              </button>
            )}
          </div>
        );
      })()}

      {dockTooltip && !dockContextMenu && !contextMenu && <div className="pointer-events-none fixed z-[200] whitespace-nowrap rounded-md border border-white/15 bg-[#11151d]/95 px-2.5 py-1.5 text-[11px] text-white shadow-xl backdrop-blur-xl" style={{ left: dockTooltip.x, top: dockTooltip.y, transform: dockTooltip.placement === 'top' ? 'translate(-50%, -100%)' : dockTooltip.placement === 'left' ? 'translate(-100%, -50%)' : 'translateY(-50%)' }}>{dockTooltip.title}</div>}

      {newItemType && (
        <div className="absolute inset-0 z-[200] flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm">
          <form onSubmit={createFileSystemItem} className="w-full max-w-sm rounded-2xl border border-white/[0.16] bg-[#202630]/95 p-5 shadow-[0_24px_80px_rgba(0,0,0,0.5)] backdrop-blur-2xl">
            <div className="mb-4 flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/[0.1] bg-white/[0.07]">{newItemType === 'dir' ? <FolderPlus className="h-5 w-5 text-amber-200" /> : <FilePlus className="h-5 w-5 text-sky-200" />}</span><div><h3 className="text-sm font-semibold text-white">Create {newItemType === 'dir' ? 'folder' : 'file'}</h3><p className="mt-1 text-[10px] text-slate-400">Inside {currentFolderLabel}</p></div></div>
            <label className="mb-4 block"><span className="mb-1.5 block text-[10px] text-slate-400">Name</span><input autoFocus value={newItemName} onChange={(event) => setNewItemName(event.target.value)} placeholder={newItemType === 'dir' ? 'e.g. assignments' : 'e.g. notes.txt'} className="field w-full" /></label>
            <div className="flex justify-end gap-2"><button type="button" onClick={() => setNewItemType(null)} className="rounded-lg border border-white/[0.1] px-3.5 py-2 text-xs text-slate-300 transition hover:bg-white/[0.06]">Cancel</button><button type="submit" className="rounded-lg bg-slate-100 px-4 py-2 text-xs font-semibold text-slate-900 transition hover:bg-white">Create</button></div>
          </form>
        </div>
      )}

      {renameTarget && (
        <div className="absolute inset-0 z-[200] flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm">
          <form onSubmit={submitRename} className="w-full max-w-sm rounded-2xl border border-white/[0.16] bg-[#202630]/95 p-5 shadow-[0_24px_80px_rgba(0,0,0,0.5)] backdrop-blur-2xl">
            <div className="mb-4 flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/[0.1] bg-white/[0.07]"><Pencil className="h-5 w-5 text-sky-200" /></span><div className="min-w-0"><h3 className="text-sm font-semibold text-white">Rename {renameTarget.type === 'dir' ? 'folder' : 'file'}</h3><p className="mt-1 truncate text-[10px] text-slate-400">{renameTarget.name}</p></div></div>
            <label className="mb-4 block"><span className="mb-1.5 block text-[10px] text-slate-400">New name</span><input autoFocus value={renameName} onChange={(event) => setRenameName(event.target.value)} className="field w-full" /></label>
            <div className="flex justify-end gap-2"><button type="button" onClick={() => setRenameTarget(null)} className="rounded-lg border border-white/[0.1] px-3.5 py-2 text-xs text-slate-300 transition hover:bg-white/[0.06]">Cancel</button><button type="submit" className="rounded-lg bg-slate-100 px-4 py-2 text-xs font-semibold text-slate-900 transition hover:bg-white">Rename</button></div>
          </form>
        </div>
      )}

      {quickSettingsOpen && (
        <div className="absolute left-1/2 top-[58px] z-[200] w-72 -translate-x-1/2 rounded-xl border border-white/[0.16] bg-slate-950/[0.88] p-4 shadow-[0_24px_80px_rgba(0,0,0,0.6)] backdrop-blur-2xl">
          <div className="mb-3 flex items-center justify-between"><div><p className="text-sm font-semibold text-slate-100">System</p><p className="mt-1 text-[11px] text-slate-500">MINIOS controls and shortcuts</p></div><Clock3 className="h-4 w-4 text-slate-500" /></div>
          <div className="grid grid-cols-2 gap-2"><div className="rounded-lg border border-white/[0.07] bg-white/[0.035] p-3"><Wifi className="mb-2 h-4 w-4 text-slate-300" /><p className="text-xs text-slate-200">Network</p><p className="mt-1 text-[10px] text-slate-500">Connected · simulated</p></div><div className="rounded-lg border border-white/[0.07] bg-white/[0.035] p-3"><Battery className="mb-2 h-4 w-4 text-slate-300" /><p className="text-xs text-slate-200">Power</p><p className="mt-1 text-[10px] text-slate-500">Normal · simulated</p></div></div>
          <button onClick={() => { setQuickSettingsOpen(false); openWindow('settings'); }} className="mt-3 flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-xs text-slate-200 transition hover:bg-white/[0.08]"><Settings className="h-4 w-4 text-slate-300" />Open Settings</button>
          <button onClick={() => { setWindows((previous) => previous.map((win) => win.isOpen ? { ...win, isMinimized: true } : win)); setActiveWindow('desktop'); setQuickSettingsOpen(false); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-xs text-slate-200 transition hover:bg-white/[0.08]"><Power className="h-4 w-4 text-slate-300" />Show desktop</button>
          <button onClick={() => { setQuickSettingsOpen(false); handleLogout(); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-xs text-rose-200 transition hover:bg-rose-500/[0.12]"><LogOut className="h-4 w-4 text-rose-300" />Sign out</button>
        </div>
      )}

      {toast && <div className="absolute bottom-5 left-1/2 z-[200] -translate-x-1/2 rounded-lg border border-white/[0.1] bg-[#283243]/90 px-4 py-2.5 text-xs text-slate-100 shadow-xl backdrop-blur-2xl">{toast}</div>}

    </div>
  );
}