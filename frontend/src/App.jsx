import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  ArrowUp,
  Battery,
  Check,
  ChevronDown,
  Clock3,
  Cpu,
  FileText,
  Folder,
  FolderPlus,
  FolderOpen,
  HardDrive,
  LayoutGrid,
  FilePlus,
  Maximize2,
  Minimize2,
  Monitor,
  Moon,
  Plus,
  Power,
  Play,
  Search,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Terminal,
  Trash2,
  Wifi,
  X,
  Zap,
} from 'lucide-react';

const INITIAL_APPS = [
  { id: 'process-manager', title: 'Processes', subtitle: 'Process manager', icon: Cpu },
  { id: 'scheduler', title: 'Scheduler', subtitle: 'CPU scheduling lab', icon: Activity },
  { id: 'terminal', title: 'Terminal', subtitle: 'MINIOS shell', icon: Terminal },
  { id: 'file-manager', title: 'Files', subtitle: 'Virtual file system', icon: FolderOpen },
  { id: 'memory', title: 'Memory', subtitle: 'Memory and paging', icon: HardDrive },
  { id: 'system-monitor', title: 'System Monitor', subtitle: 'System telemetry', icon: Monitor },
  { id: 'settings', title: 'Settings', subtitle: 'Appearance and system', icon: Settings },
];

const INITIAL_WINDOWS = [
  { id: 'process-manager', title: 'Processes', isOpen: true, isMinimized: false, isMaximized: false, zIndex: 10, x: 118, y: 86, w: 900, h: 560 },
  { id: 'scheduler', title: 'CPU Scheduling Lab', isOpen: false, isMinimized: false, isMaximized: false, zIndex: 5, x: 160, y: 104, w: 900, h: 570 },
  { id: 'terminal', title: 'Terminal', isOpen: false, isMinimized: false, isMaximized: false, zIndex: 4, x: 185, y: 120, w: 760, h: 480 },
  { id: 'file-manager', title: 'Files', isOpen: false, isMinimized: false, isMaximized: false, zIndex: 3, x: 145, y: 96, w: 860, h: 540 },
  { id: 'memory', title: 'Memory and Paging', isOpen: false, isMinimized: false, isMaximized: false, zIndex: 2, x: 165, y: 105, w: 860, h: 550 },
  { id: 'system-monitor', title: 'System Monitor', isOpen: false, isMinimized: false, isMaximized: false, zIndex: 1, x: 190, y: 125, w: 820, h: 520 },
  { id: 'settings', title: 'Settings', isOpen: false, isMinimized: false, isMaximized: false, zIndex: 0, x: 205, y: 130, w: 760, h: 500 },
];

const INITIAL_PROCESSES = [
  { pid: 1, name: 'init_daemon', state: 'RUNNING', priority: 0, arrival: 0, burst: 15, remaining: 12 },
  { pid: 2, name: 'kernel_sched', state: 'READY', priority: 1, arrival: 2, burst: 8, remaining: 8 },
  { pid: 3, name: 'vfs_worker', state: 'BLOCKED', priority: 2, arrival: 4, burst: 10, remaining: 5 },
  { pid: 4, name: 'memory_mgr', state: 'READY', priority: 1, arrival: 5, burst: 6, remaining: 6 },
  { pid: 5, name: 'gui_compositor', state: 'READY', priority: 1, arrival: 6, burst: 12, remaining: 9 },
];

const FILE_ROOT = '/home/student/projects';
const INITIAL_FILES = [
  { name: 'desktop', type: 'dir', size: '—', modified: '2026-10-10', parent: FILE_ROOT },
  { name: 'documents', type: 'dir', size: '—', modified: '2026-10-10', parent: FILE_ROOT },
  { name: 'kernel.cpp', type: 'file', size: '14.2 KB', modified: '2026-10-09', parent: FILE_ROOT, content: '// MINIOS kernel entry point\nint main() {\n    // Simulated kernel startup\n    return 0;\n}\n' },
  { name: 'scheduler.h', type: 'file', size: '4.8 KB', modified: '2026-10-08', parent: FILE_ROOT, content: '// CPU scheduling interface\n#pragma once\n\nclass Scheduler {\npublic:\n    virtual ~Scheduler() = default;\n};\n' },
  { name: 'process_mgr.cpp', type: 'file', size: '9.1 KB', modified: '2026-10-07', parent: FILE_ROOT, content: '// Process manager implementation\n// This virtual file is part of the MINIOS demo workspace.\n' },
  { name: 'README.md', type: 'file', size: '1.2 KB', modified: '2026-10-06', parent: FILE_ROOT, content: '# MINIOS\n\nA desktop operating-system simulator built as a CSE project.\n' },
  { name: 'welcome.txt', type: 'file', size: '0.1 KB', modified: '2026-10-10', parent: `${FILE_ROOT}/documents`, content: 'Welcome to the MINIOS virtual file system.\n' },
  { name: 'desktop-notes.txt', type: 'file', size: '0.1 KB', modified: '2026-10-10', parent: `${FILE_ROOT}/desktop`, content: 'Files created here remain inside the Desktop folder in this simulation.\n' },
];

const getFileKey = (file) => `${file.parent}/${file.name}`;

const APP_TONES = {
  'process-manager': 'text-sky-300 bg-sky-400/10 border-sky-300/20',
  scheduler: 'text-emerald-300 bg-emerald-400/10 border-emerald-300/20',
  terminal: 'text-violet-300 bg-violet-400/10 border-violet-300/20',
  'file-manager': 'text-amber-300 bg-amber-400/10 border-amber-300/20',
  memory: 'text-blue-300 bg-blue-400/10 border-blue-300/20',
  'system-monitor': 'text-rose-300 bg-rose-400/10 border-rose-300/20',
  settings: 'text-zinc-300 bg-zinc-400/10 border-zinc-300/20',
};

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

function runSchedulingSimulation(processes, algorithm, quantum) {
  const jobs = processes
    .filter((p) => p.state !== 'BLOCKED')
    .map((p) => ({ ...p, remaining: Math.max(1, Number(p.burst) || 1), start: null, completion: null, waiting: 0 }))
    .sort((a, b) => a.arrival - b.arrival || a.pid - b.pid);

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
      while (pending.length && pending[0].arrival <= time) queue.push(pending.shift());
      if (!queue.length) {
        time = pending[0].arrival;
        continue;
      }
      const job = queue.shift();
      if (job.start === null) job.start = time;
      const slice = Math.min(q, job.remaining);
      addSlice(job, slice);
      while (pending.length && pending[0].arrival <= time) queue.push(pending.shift());
      if (job.remaining > 0) queue.push(job);
      else {
        job.completion = time;
        completed.push(job);
      }
    }
  } else {
    const pending = [...jobs];
    while (pending.length) {
      const available = pending.filter((p) => p.arrival <= time);
      if (!available.length) {
        time = pending[0].arrival;
        continue;
      }
      let selected;
      if (algorithm === 'SJF') {
        selected = available.sort((a, b) => a.burst - b.burst || a.arrival - b.arrival || a.pid - b.pid)[0];
      } else if (algorithm === 'PRIO') {
        selected = available.sort((a, b) => a.priority - b.priority || a.arrival - b.arrival || a.pid - b.pid)[0];
      } else {
        selected = available.sort((a, b) => a.arrival - b.arrival || a.pid - b.pid)[0];
      }
      if (selected.start === null) selected.start = time;
      addSlice(selected, selected.remaining);
      selected.completion = time;
      completed.push(selected);
      pending.splice(pending.findIndex((p) => p.pid === selected.pid), 1);
    }
  }

  const waitingTotal = completed.reduce((sum, p) => sum + Math.max(0, p.completion - p.arrival - p.burst), 0);
  const turnaroundTotal = completed.reduce((sum, p) => sum + (p.completion - p.arrival), 0);
  return {
    timeline,
    averageWaiting: (waitingTotal / completed.length).toFixed(1),
    averageTurnaround: (turnaroundTotal / completed.length).toFixed(1),
  };
}

export default function App() {
  const [theme, setTheme] = useState('ocean');
  const [wallpaperImage, setWallpaperImage] = useState('');
  const [wallpaperName, setWallpaperName] = useState('');
  const [iconSize, setIconSize] = useState('md');
  const [dockPosition, setDockPosition] = useState('left');
  const [pinnedApps, setPinnedApps] = useState(() => INITIAL_APPS.filter((app) => app.id !== 'settings').map((app) => app.id));
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
  const [processes, setProcesses] = useState(INITIAL_PROCESSES);
  const [newProcName, setNewProcName] = useState('');
  const [newProcBurst, setNewProcBurst] = useState('10');
  const [newProcPriority, setNewProcPriority] = useState('1');
  const [schedAlgo, setSchedAlgo] = useState('RR');
  const [timeQuantum, setTimeQuantum] = useState(3);
  const [ganttTimeline, setGanttTimeline] = useState([
    { pid: 1, name: 'init_daemon', start: 0, end: 3, duration: 3 },
    { pid: 2, name: 'kernel_sched', start: 3, end: 6, duration: 3 },
    { pid: 4, name: 'memory_mgr', start: 6, end: 9, duration: 3 },
  ]);
  const [schedulerMetrics, setSchedulerMetrics] = useState({ averageWaiting: '—', averageTurnaround: '—' });
  const [schedulerLog, setSchedulerLog] = useState([
    '[kernel] Scheduler module ready.',
    '[dispatch] Round Robin selected. Quantum: 3 time units.',
    '[info] Run a simulation to generate a new execution trace.',
  ]);
  const [termInput, setTermInput] = useState('');
  const [termHistory, setTermHistory] = useState([
    'MINIOS shell 2.4.0',
    'A small command shell for the operating-system simulator.',
    'Type help to see supported commands.',
    '',
  ]);
  const [currentPath, setCurrentPath] = useState(FILE_ROOT);
  const [files, setFiles] = useState(INITIAL_FILES);
  const [newItemType, setNewItemType] = useState(null);
  const [newItemName, setNewItemName] = useState('');
  const [contextMenu, setContextMenu] = useState(null);
  const [contextNewOpen, setContextNewOpen] = useState(false);
  const [selectedFileKeys, setSelectedFileKeys] = useState([]);
  const [fileClipboard, setFileClipboard] = useState(null);
  const [selectionBox, setSelectionBox] = useState(null);
  const [filePreview, setFilePreview] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [toast, setToast] = useState('');
  const overviewSearchRef = useRef(null);
  const terminalEndRef = useRef(null);
  const fileListRef = useRef(null);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const handleGlobalShortcut = (event) => {
      if (event.key === 'Escape') {
        setAppLauncherOpen(false);
        setQuickSettingsOpen(false);
        setContextMenu(null);
        setDockContextMenu(null);
        setDockTooltip(null);
        setSelectionBox(null);
        setNewItemType(null);
        setFilePreview(null);
        return;
      }

      // Avoid stealing everyday shortcuts such as Windows + Shift + S.
      const target = event.target;
      const editingText = target instanceof HTMLElement && (
        target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
      );
      if (editingText) return;

      // MINIOS overview uses its own shortcuts; it does not bind the Windows/Super key.
      const overviewKey = event.key === 'F9'
        || (event.altKey && event.key === 'F1')
        || (event.ctrlKey && event.shiftKey && event.code === 'Space');
      if (overviewKey) {
        event.preventDefault();
        setAppLauncherOpen((open) => !open);
        setQuickSettingsOpen(false);
        setContextMenu(null);
        setSearchQuery('');
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

  // File selection uses a desktop-style rubber-band rectangle. Row intersections
  // update the selection while the mouse is dragged over the virtual file list.
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
          // Windows may be dragged right to the top edge; mouse-up there maximizes it.
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

  const activeProcesses = processes.filter((p) => p.state !== 'BLOCKED').length;
  const normalizedSearch = searchQuery.trim().toLowerCase();
  const filteredApps = useMemo(
    () => INITIAL_APPS.filter((app) => `${app.title} ${app.subtitle}`.toLowerCase().includes(normalizedSearch)),
    [normalizedSearch],
  );
  const filteredWindows = useMemo(
    () => windows.filter((win) => win.isOpen && win.title.toLowerCase().includes(normalizedSearch)),
    [windows, normalizedSearch],
  );
  const visibleFiles = useMemo(
    () => files.filter((file) => file.parent === currentPath).sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name) : a.type === 'dir' ? -1 : 1)),
    [files, currentPath],
  );
  // The dock contains pinned apps plus apps that are currently running.
  const dockApps = useMemo(() => INITIAL_APPS.filter((app) => app.id !== 'settings' && (
    pinnedApps.includes(app.id) || windows.some((win) => win.id === app.id && win.isOpen)
  )), [pinnedApps, windows]);
  const currentFolderLabel = currentPath === FILE_ROOT ? 'projects' : currentPath.split('/').pop();
  const isAtFileRoot = currentPath === FILE_ROOT;

  const openWindow = (id) => {
    const nextZ = topZ + 1;
    setTopZ(nextZ);
    setWindows((previous) => previous.map((win) => win.id === id
      ? { ...win, isOpen: true, isMinimized: false, zIndex: nextZ }
      : win));
    setActiveWindow(id);
    setAppLauncherOpen(false);
    setQuickSettingsOpen(false);
    setContextMenu(null);
    setDockContextMenu(null);
    setDockTooltip(null);
  };

  const toggleOverview = () => {
    setAppLauncherOpen((open) => !open);
    setQuickSettingsOpen(false);
    setContextMenu(null);
    setDockContextMenu(null);
    setDockTooltip(null);
    setSearchQuery('');
  };

  const goUpDirectory = () => {
    if (currentPath === FILE_ROOT) return;
    const parent = currentPath.slice(0, currentPath.lastIndexOf('/'));
    setCurrentPath(parent.length < FILE_ROOT.length ? FILE_ROOT : parent);
    setSelectedFileKeys([]);
  };

  const openFileEntry = (file) => {
    setContextMenu(null);
    setSelectedFileKeys([getFileKey(file)]);
    if (file.type === 'dir') {
      setCurrentPath(`${currentPath}/${file.name}`);
      setSelectedFileKeys([]);
      return;
    }
    setFilePreview({ ...file, draft: file.content || '' });
  };

  const openFileContextMenu = (event, entry = null) => {
    event.preventDefault();
    event.stopPropagation();
    let targetKeys = selectedFileKeys;
    if (entry) {
      const key = getFileKey(entry);
      if (!selectedFileKeys.includes(key)) targetKeys = [key];
      setSelectedFileKeys(targetKeys);
    }
    setContextMenu({ x: event.clientX, y: event.clientY, selectedKeys: [...targetKeys] });
    setContextNewOpen(false);
    setDockContextMenu(null);
  };

  const beginFileSelection = (event) => {
    if (event.button !== 0) return;
    if (event.target.closest('button, input, textarea')) return;
    const startedOnFileRow = Boolean(event.target.closest('[data-file-key]'));
    setContextMenu(null);
    setDockContextMenu(null);
    if (!startedOnFileRow) setSelectedFileKeys([]);
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
  };

  const openDockContextMenu = (event, appId) => {
    if (!appId || appId === 'settings') return;
    event.preventDefault();
    event.stopPropagation();
    setDockContextMenu({ x: event.clientX, y: event.clientY, appId });
    setContextMenu(null);
    setQuickSettingsOpen(false);
  };

  const togglePinnedApp = (appId) => {
    const isPinned = pinnedApps.includes(appId);
    setPinnedApps((previous) => isPinned ? previous.filter((id) => id !== appId) : [...previous, appId]);
    setDockContextMenu(null);
    setToast(isPinned ? 'App unpinned. A running app stays in the dock until it closes.' : 'App pinned to the dock.');
  };

  const showDockTooltip = (event, title) => {
    const rect = event.currentTarget.getBoundingClientRect();
    if (dockPosition === 'bottom') {
      setDockTooltip({ title, x: rect.left + rect.width / 2, y: rect.top - 8, placement: 'top' });
    } else if (dockPosition === 'right') {
      setDockTooltip({ title, x: rect.left - 8, y: rect.top + rect.height / 2, placement: 'left' });
    } else {
      setDockTooltip({ title, x: rect.right + 8, y: rect.top + rect.height / 2, placement: 'right' });
    }
  };

  const beginCreateItem = (type) => {
    setContextMenu(null);
    setContextNewOpen(false);
    setNewItemType(type);
    setNewItemName('');
  };

  const buildClipboardBundles = (keys) => {
    const roots = files.filter((file) => keys.includes(getFileKey(file)));
    return roots.map((root) => {
      const sourcePath = `${root.parent}/${root.name}`;
      const records = files.filter((file) => getFileKey(file) === getFileKey(root)
        || file.parent === sourcePath
        || file.parent.startsWith(`${sourcePath}/`));
      return {
        root: { ...root },
        sourcePath,
        sourceParent: root.parent,
        records: records.map((file) => ({ ...file })),
      };
    });
  };

  const copyOrCutSelectedFiles = (operation) => {
    const keys = contextMenu?.selectedKeys || selectedFileKeys;
    const bundles = buildClipboardBundles(keys);
    if (!bundles.length) return;
    setFileClipboard({ operation, bundles });
    setContextMenu(null);
    setToast(`${operation === 'copy' ? 'Copied' : 'Cut'} ${bundles.length} item${bundles.length === 1 ? '' : 's'}.`);
  };

  const uniquePastedName = (originalName, parentPath, occupiedNames, isCopy) => {
    if (!occupiedNames.has(originalName.toLowerCase())) return originalName;
    let base = originalName;
    let extension = '';
    if (base.lastIndexOf('.') > 0 && base.lastIndexOf('.') < base.length - 1) {
      extension = base.slice(base.lastIndexOf('.'));
      base = base.slice(0, base.lastIndexOf('.'));
    }
    let counter = 1;
    let candidate;
    do {
      counter += 1;
      candidate = isCopy
        ? `${base} - Copy${counter > 2 ? ` (${counter - 1})` : ''}${extension}`
        : `${base} (${counter})${extension}`;
    } while (occupiedNames.has(candidate.toLowerCase()));
    return candidate;
  };

  const pasteFiles = () => {
    if (!fileClipboard?.bundles?.length) return;
    const { operation, bundles } = fileClipboard;
    if (bundles.some((bundle) => bundle.root.type === 'dir' && (currentPath === bundle.sourcePath || currentPath.startsWith(`${bundle.sourcePath}/`)))) {
      setContextMenu(null);
      setToast('A folder cannot be pasted into itself or one of its subfolders.');
      return;
    }
    if (operation === 'cut' && bundles.every((bundle) => bundle.sourceParent === currentPath)) {
      setContextMenu(null);
      setToast('Those items are already in this folder.');
      return;
    }

    let nextFiles = [...files];
    const occupiedNames = new Set(files.filter((file) => file.parent === currentPath).map((file) => file.name.toLowerCase()));
    const newlyPasted = [];
    for (const bundle of bundles) {
      const root = operation === 'cut'
        ? nextFiles.find((file) => getFileKey(file) === getFileKey(bundle.root))
        : bundle.root;
      if (!root) continue;
      const sourcePath = `${root.parent}/${root.name}`;
      const records = operation === 'cut'
        ? nextFiles.filter((file) => getFileKey(file) === getFileKey(root) || file.parent === sourcePath || file.parent.startsWith(`${sourcePath}/`))
        : bundle.records;
      const destinationName = uniquePastedName(root.name, currentPath, occupiedNames, operation === 'copy');
      occupiedNames.add(destinationName.toLowerCase());
      const destinationPath = `${currentPath}/${destinationName}`;
      const rootKey = getFileKey(root);

      const mapped = records.map((record) => {
        if (getFileKey(record) === rootKey) {
          return { ...record, name: destinationName, parent: currentPath, modified: new Date().toISOString().slice(0, 10) };
        }
        const suffix = record.parent.startsWith(sourcePath) ? record.parent.slice(sourcePath.length) : '';
        return { ...record, parent: `${destinationPath}${suffix}`, modified: new Date().toISOString().slice(0, 10) };
      });
      newlyPasted.push(...mapped);
    }

    if (operation === 'cut') {
      nextFiles = nextFiles.filter((file) => {
        for (const bundle of bundles) {
          const sourcePath = bundle.sourcePath;
          if (getFileKey(file) === `${bundle.sourceParent}/${bundle.root.name}` || file.parent === sourcePath || file.parent.startsWith(`${sourcePath}/`)) return false;
        }
        return true;
      });
      setFileClipboard(null);
    }
    setFiles([...nextFiles, ...newlyPasted]);
    setSelectedFileKeys(newlyPasted.filter((file) => file.parent === currentPath).map(getFileKey));
    setContextMenu(null);
    setToast(`${operation === 'copy' ? 'Pasted copy of' : 'Moved'} ${newlyPasted.filter((file) => file.parent === currentPath).length} item(s).`);
  };

  const deleteSelectedFiles = () => {
    const keys = contextMenu?.selectedKeys || selectedFileKeys;
    const roots = files.filter((file) => keys.includes(getFileKey(file)));
    if (!roots.length) return;
    setFiles((previous) => previous.filter((file) => !roots.some((root) => {
      const rootPath = `${root.parent}/${root.name}`;
      return getFileKey(file) === getFileKey(root) || file.parent === rootPath || file.parent.startsWith(`${rootPath}/`);
    })));
    setSelectedFileKeys([]);
    setContextMenu(null);
    setToast(`Deleted ${roots.length} selected item${roots.length === 1 ? '' : 's'}.`);
  };

  const handleWallpaperUpload = (event) => {
    const imageFile = event.target.files?.[0];
    if (!imageFile) return;
    if (!imageFile.type.startsWith('image/')) {
      setToast('Please choose an image file.');
      event.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setWallpaperImage(String(reader.result || ''));
      setWallpaperName(imageFile.name);
      setToast('Wallpaper updated.');
    };
    reader.onerror = () => setToast('Unable to load that image. Please try another file.');
    reader.readAsDataURL(imageFile);
    event.target.value = '';
  };

  const focusWindow = (id) => {
    const nextZ = topZ + 1;
    setTopZ(nextZ);
    setWindows((previous) => previous.map((win) => win.id === id
      ? { ...win, zIndex: nextZ, isMinimized: false }
      : win));
    setActiveWindow(id);
    setContextMenu(null);
    setDockContextMenu(null);
    setDockTooltip(null);
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
    setDraggingWin(id);
    setQuickSettingsOpen(false);
    setDockTooltip(null);
    setDragOffset({ x: event.clientX - win.x, y: event.clientY - win.y });
    focusWindow(id);
  };

  const addProcess = (event) => {
    event.preventDefault();
    const name = newProcName.trim();
    const burst = Number.parseInt(newProcBurst, 10);
    const priority = Number.parseInt(newProcPriority, 10);
    if (!name) return setToast('Enter a process name first.');
    if (!Number.isFinite(burst) || burst < 1) return setToast('Burst time must be at least 1.');
    const pid = processes.length ? Math.max(...processes.map((p) => p.pid)) + 1 : 1;
    const process = { pid, name, state: 'READY', priority: Number.isFinite(priority) ? priority : 1, arrival: 0, burst, remaining: burst };
    setProcesses((previous) => [...previous, process]);
    setSchedulerLog((previous) => [`[process] PID ${pid} (${name}) created.`, ...previous].slice(0, 12));
    setNewProcName('');
    setToast(`Created process ${name} (PID ${pid}).`);
  };

  const terminateProcess = (pid) => {
    const process = processes.find((item) => item.pid === pid);
    setProcesses((previous) => previous.filter((item) => item.pid !== pid));
    setSchedulerLog((previous) => [`[process] PID ${pid}${process ? ` (${process.name})` : ''} terminated.`, ...previous].slice(0, 12));
    setToast(`Process ${pid} terminated.`);
  };

  const runSchedulerSimulation = () => {
    const result = runSchedulingSimulation(processes, schedAlgo, timeQuantum);
    setGanttTimeline(result.timeline);
    setSchedulerMetrics({ averageWaiting: result.averageWaiting, averageTurnaround: result.averageTurnaround });
    const label = { FCFS: 'FCFS', SJF: 'Shortest Job First', RR: `Round Robin (q=${Math.max(1, timeQuantum)})`, PRIO: 'Priority' }[schedAlgo];
    setSchedulerLog((previous) => [
      `[scheduler] Completed ${label} simulation for ${result.timeline.length} CPU slices.`,
      `[metrics] Average waiting: ${result.averageWaiting}; average turnaround: ${result.averageTurnaround}.`,
      ...previous,
    ].slice(0, 12));
    setToast('Scheduling simulation complete.');
  };

  const handleTerminalSubmit = (event) => {
    event.preventDefault();
    const command = termInput.trim();
    if (!command) return;
    const args = command.split(/\s+/);
    let output = `$ ${command}`;
    switch (args[0]) {
      case 'help':
        output += '\nCommands: help, clear, ps, ls, cd <folder|..>, mkdir <name>, touch <name>, top, mem, uname, date, pwd, spawn <name> <burst>, kill <pid>';
        break;
      case 'clear':
        setTermHistory(['MINIOS shell 2.4.0', '']);
        setTermInput('');
        return;
      case 'ps':
        output += '\nPID  STATE      PRI  BURST  REMAIN  NAME\n' + processes.map((p) => `${String(p.pid).padEnd(4)} ${p.state.padEnd(10)} ${String(p.priority).padEnd(4)} ${String(`${p.burst}u`).padEnd(6)} ${String(`${p.remaining}u`).padEnd(6)} ${p.name}`).join('\n');
        break;
      case 'ls':
        output += '\n' + files.filter((file) => file.parent === currentPath).map((file) => `${file.type === 'dir' ? 'd' : '-'}  ${file.name}`).join('\n');
        break;
      case 'top':
        output += `\nSimulated CPU activity: ${Math.min(96, 12 + activeProcesses * 11)}%\nRunnable processes: ${activeProcesses}\nTelemetry values are simulated, not host-machine measurements.`;
        break;
      case 'mem':
        output += '\nSimulated physical memory: 4096 MB\nAllocated: 1842 MB\nPage size: 4 KB\nPage faults: 2';
        break;
      case 'uname':
        output += '\nMINIOS 2.4.0 nitw-cse x86_64-simulated';
        break;
      case 'date':
        output += `\n${currentTime.toString()}`;
        break;
      case 'pwd':
        output += `\n${currentPath}`;
        break;
      case 'cd': {
        const destination = args[1];
        if (!destination) {
          output += `\n${currentPath}`;
          break;
        }
        if (destination === '..') {
          const parent = currentPath.slice(0, currentPath.lastIndexOf('/'));
          setCurrentPath(parent.length < FILE_ROOT.length ? FILE_ROOT : parent);
          output += `\nChanged directory.`;
          break;
        }
        const target = files.find((file) => file.parent === currentPath && file.type === 'dir' && file.name === destination);
        if (target) {
          setCurrentPath(`${currentPath}/${target.name}`);
          output += `\nChanged directory to ${destination}.`;
        } else output += `\ncd: no such directory: ${destination}`;
        break;
      }
      case 'mkdir':
      case 'touch': {
        const name = args[1];
        if (!name) {
          output += `\nUsage: ${args[0]} <name>`;
          break;
        }
        if (files.some((file) => file.parent === currentPath && file.name === name)) {
          output += `\nAn item named ${name} already exists.`;
          break;
        }
        const type = args[0] === 'mkdir' ? 'dir' : 'file';
        setFiles((previous) => [...previous, { name, type, size: type === 'dir' ? '—' : '0.0 KB', modified: new Date().toISOString().slice(0, 10), parent: currentPath, content: '' }]);
        output += `\nCreated ${type === 'dir' ? 'folder' : 'file'} ${name}.`;
        break;
      }
      case 'spawn': {
        const name = args[1] || 'task_node';
        const burst = Number.parseInt(args[2], 10) || 8;
        if (burst < 1) {
          output += '\nBurst time must be at least 1.';
          break;
        }
        const pid = processes.length ? Math.max(...processes.map((p) => p.pid)) + 1 : 1;
        setProcesses((previous) => [...previous, { pid, name, state: 'READY', priority: 1, arrival: 0, burst, remaining: burst }]);
        output += `\nCreated process PID ${pid} (${name}), burst ${burst}.`;
        break;
      }
      case 'kill': {
        const pid = Number.parseInt(args[1], 10);
        if (Number.isFinite(pid) && processes.some((p) => p.pid === pid)) {
          setProcesses((previous) => previous.filter((p) => p.pid !== pid));
          output += `\nProcess ${pid} terminated.`;
        } else output += '\nUsage: kill <existing-pid>';
        break;
      }
      default:
        output += `\n${args[0]}: command not found. Type 'help' for commands.`;
    }
    setTermHistory((previous) => [...previous, output, '']);
    setTermInput('');
  };

  const createFileSystemItem = (event) => {
    event.preventDefault();
    const name = newItemName.trim();
    if (!name || !newItemType) return;
    if (name === '.' || name === '..' || name.includes('/')) return setToast('Use a simple name without slashes.');
    if (files.some((file) => file.parent === currentPath && file.name.toLowerCase() === name.toLowerCase())) {
      return setToast('An item with that name already exists in this folder.');
    }
    const type = newItemType;
    setFiles((previous) => [...previous, {
      name,
      type,
      size: type === 'dir' ? '—' : '0.0 KB',
      modified: new Date().toISOString().slice(0, 10),
      parent: currentPath,
      content: '',
    }]);
    setNewItemName('');
    setNewItemType(null);
    setToast(`Created ${type === 'dir' ? 'folder' : 'file'} ${name}.`);
  };

  const saveFilePreview = () => {
    if (!filePreview) return;
    const draft = filePreview.draft || '';
    setFiles((previous) => previous.map((file) => file.parent === filePreview.parent && file.name === filePreview.name
      ? { ...file, content: draft, size: `${Math.max(0.1, draft.length / 1024).toFixed(1)} KB`, modified: new Date().toISOString().slice(0, 10) }
      : file));
    setFilePreview(null);
    setToast(`Saved ${filePreview.name}.`);
  };

  const deleteFile = (entry) => {
    if (!entry) return;
    const targetPath = `${entry.parent}/${entry.name}`;
    setFiles((previous) => previous.filter((file) => {
      if (file.parent === entry.parent && file.name === entry.name) return false;
      return !(file.parent === targetPath || file.parent.startsWith(`${targetPath}/`));
    }));
    setSelectedFileKeys((previous) => previous.filter((key) => key !== getFileKey(entry) && !key.startsWith(`${targetPath}/`)));
    setToast(`Deleted ${entry.name}${entry.type === 'dir' ? ' and its contents' : ''}.`);
  };

  useEffect(() => {
    const handleFileShortcuts = (event) => {
      if (activeWindow !== 'file-manager') return;
      const target = event.target;
      const editingText = target instanceof HTMLElement && (
        target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
      );
      if (editingText) return;
      if (!(event.ctrlKey || event.metaKey)) return;
      const key = event.key.toLowerCase();
      if (key === 'c' && selectedFileKeys.length) {
        event.preventDefault();
        copyOrCutSelectedFiles('copy');
      } else if (key === 'x' && selectedFileKeys.length) {
        event.preventDefault();
        copyOrCutSelectedFiles('cut');
      } else if (key === 'v' && fileClipboard) {
        event.preventDefault();
        pasteFiles();
      }
    };
    window.addEventListener('keydown', handleFileShortcuts);
    return () => window.removeEventListener('keydown', handleFileShortcuts);
  }, [activeWindow, selectedFileKeys, fileClipboard, contextMenu, files, currentPath]);

  const themeClass = theme === 'aurora'
    ? 'from-[#17605e] via-[#245274] to-[#483d78]'
    : theme === 'sunset'
      ? 'from-[#874b5b] via-[#59436f] to-[#2b5272]'
      : 'from-[#24506d] via-[#354777] to-[#533d70]';
  const dockIconSize = iconSize === 'sm' ? 'h-10 w-10' : iconSize === 'lg' ? 'h-14 w-14' : 'h-12 w-12';
  const dockGlyphSize = iconSize === 'sm' ? 'h-4 w-4' : iconSize === 'lg' ? 'h-6 w-6' : 'h-5 w-5';
  const dockBadgeSize = iconSize === 'sm' ? 'h-7 w-7' : iconSize === 'lg' ? 'h-10 w-10' : 'h-9 w-9';
  const isBottomDock = dockPosition === 'bottom';
  const dockPositionClass = dockPosition === 'left'
    ? 'left-3 top-1/2 h-fit max-h-[calc(100vh-24px)] w-[72px] -translate-y-1/2 flex-col py-3'
    : dockPosition === 'right'
      ? 'right-3 top-1/2 h-fit max-h-[calc(100vh-24px)] w-[72px] -translate-y-1/2 flex-col py-3'
      : 'bottom-3 left-1/2 h-[96px] max-w-[calc(100vw-24px)] -translate-x-1/2 flex-row px-3 py-2';
  const dockAppsClass = isBottomDock
    ? 'flex h-full min-w-0 flex-1 flex-row items-center gap-2 overflow-x-auto overflow-y-hidden px-1 py-2'
    : 'flex w-full min-h-0 max-h-[calc(100vh-190px)] flex-none flex-col items-center gap-2 overflow-x-hidden overflow-y-auto px-2 py-2';
  const dockIconPx = iconSize === 'sm' ? 40 : iconSize === 'lg' ? 56 : 48;
  const estimatedDockWidth = dockApps.length * (dockIconPx + 8) + dockIconPx * 2 + 98;
  const dockInlineStyle = isBottomDock ? { width: `min(calc(100vw - 24px), ${estimatedDockWidth}px)` } : undefined;
  const fileSelectionBounds = fileListRef.current?.getBoundingClientRect();
  const fileSelectionStyle = selectionBox && fileSelectionBounds ? {
    left: Math.min(selectionBox.startX, selectionBox.currentX) - fileSelectionBounds.left,
    top: Math.min(selectionBox.startY, selectionBox.currentY) - fileSelectionBounds.top,
    width: Math.abs(selectionBox.currentX - selectionBox.startX),
    height: Math.abs(selectionBox.currentY - selectionBox.startY),
  } : null;
  const activeMaximizedWindow = windows.some((win) => win.isOpen && !win.isMinimized && win.isMaximized && win.id === activeWindow);

  return (
    <div className={`relative h-screen w-screen select-none overflow-hidden bg-gradient-to-br ${themeClass} font-sans text-slate-200`} style={wallpaperImage ? { backgroundImage: `linear-gradient(rgba(7, 10, 18, .38), rgba(7, 10, 18, .52)), url("${wallpaperImage}")`, backgroundSize: 'cover', backgroundPosition: 'center', backgroundRepeat: 'no-repeat' } : undefined}>
      {/* Desktop wallpaper: deliberately restrained, without animated status ornaments. */}
      <div className={`pointer-events-none absolute inset-0 opacity-30 ${wallpaperImage ? 'hidden' : ''}`} aria-hidden="true">
        <div className="absolute -right-40 -top-44 h-[34rem] w-[34rem] rounded-full border border-white/[0.045]" />
        <div className="absolute -right-20 -top-24 h-[26rem] w-[26rem] rounded-full border border-white/[0.035]" />
        <div className="absolute bottom-[-19rem] left-[28%] h-[38rem] w-[38rem] rounded-full border border-white/[0.04]" />
      </div>

      {/* Compact glass clock pill, inspired by a Dynamic Island. There is no full-width header. */}
      {!draggingWin && !activeMaximizedWindow && <button
        onClick={() => { setQuickSettingsOpen((open) => !open); setAppLauncherOpen(false); setDockContextMenu(null); setContextMenu(null); }}
        aria-label="Open system menu"
        className="absolute left-1/2 top-3 z-[90] flex -translate-x-1/2 items-center gap-3 rounded-full border border-white/[0.22] bg-slate-950/[0.42] px-4 py-2 text-slate-100 shadow-[0_10px_40px_rgba(0,0,0,0.24)] ring-1 ring-white/[0.04] backdrop-blur-2xl transition hover:bg-slate-950/[0.58]"
      >
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-300/90 shadow-[0_0_8px_rgba(110,231,183,0.28)]" />
        <span className="text-[10px] font-medium text-slate-300">{currentTime.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}</span>
        <span className="h-3 w-px bg-white/[0.16]" />
        <span className="text-xs font-semibold tabular-nums text-white">{currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
        <ChevronDown className={`h-3 w-3 text-slate-300/80 transition-transform ${quickSettingsOpen ? 'rotate-180' : ''}`} />
      </button>}

      {/* Adaptive glass dock. In horizontal mode, Settings and Overview sit at opposite ends. */}
      <aside style={dockInlineStyle} className={`absolute z-[80] flex items-center rounded-[22px] border border-white/[0.2] bg-gradient-to-br from-white/[0.19] via-white/[0.085] to-slate-950/[0.28] shadow-[0_24px_70px_rgba(0,0,0,0.3)] ring-1 ring-black/20 backdrop-blur-2xl ${dockPositionClass}`}>
        <button
          onClick={() => openWindow('settings')}
          aria-label="Settings"
          onContextMenu={(event) => { event.preventDefault(); event.stopPropagation(); }}
          onMouseEnter={(event) => showDockTooltip(event, 'Settings')}
          onMouseLeave={() => setDockTooltip(null)}
          className={`${dockIconSize} ${isBottomDock ? 'mr-1' : 'mb-3'} flex shrink-0 items-center justify-center rounded-xl border border-white/[0.13] bg-white/[0.075] text-slate-100 shadow-sm transition duration-200 ease-out hover:-translate-y-1 hover:scale-105 hover:bg-white/[0.15] hover:shadow-lg`}
        >
          <span className={`${dockBadgeSize} flex items-center justify-center rounded-lg border border-black/70 bg-slate-950/65 shadow-inner`}>
            <Settings className={dockGlyphSize} strokeWidth={1.8} />
          </span>
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
                onClick={() => {
                  if (win?.isOpen && !win?.isMinimized && activeWindow === app.id) {
                    toggleMinimize(app.id, { stopPropagation() {} });
                  } else openWindow(app.id);
                }}
                aria-label={app.title}
                onContextMenu={(event) => openDockContextMenu(event, app.id)}
                onMouseEnter={(event) => showDockTooltip(event, app.title)}
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
        <button
          onClick={toggleOverview}
          aria-label="Open overview"
          onContextMenu={(event) => { event.preventDefault(); event.stopPropagation(); }}
          onMouseEnter={(event) => showDockTooltip(event, 'Applications overview')}
          onMouseLeave={() => setDockTooltip(null)}
          className={`${dockIconSize} ${isBottomDock ? 'ml-1' : 'mt-0'} flex shrink-0 items-center justify-center rounded-xl border border-white/[0.16] bg-slate-950/45 text-slate-100 shadow-md transition duration-200 ease-out hover:-translate-y-1 hover:scale-105 hover:bg-slate-950/60 hover:shadow-lg`}
        >
          <span className={`${dockBadgeSize} flex items-center justify-center rounded-lg border border-black/70 bg-slate-950/70 shadow-inner`}>
            <LayoutGrid className={dockGlyphSize} strokeWidth={1.8} />
          </span>
        </button>
      </aside>

      {/* Empty desktop hit area: intentionally no distracting center prompt or icon. */}
      <main
        className={`absolute bottom-0 top-0 ${dockPosition === 'left' ? 'left-[90px] right-4' : dockPosition === 'right' ? 'left-4 right-[90px]' : 'left-4 right-4'}`}
        onMouseDown={() => { setAppLauncherOpen(false); setQuickSettingsOpen(false); setContextMenu(null); setDockContextMenu(null); setDockTooltip(null); }}
      />

      {/* App windows */}
      {!appLauncherOpen && windows.map((win) => {
        if (!win.isOpen || win.isMinimized) return null;
        const app = INITIAL_APPS.find((item) => item.id === win.id);
        const Icon = app?.icon || Monitor;
        const isSideDock = dockPosition === 'left' || dockPosition === 'right';
        const availableWidth = Math.max(320, window.innerWidth - (isSideDock ? 120 : 24));
        const windowWidth = Math.min(win.w, availableWidth);
        const leftBoundary = dockPosition === 'left' ? 88 : 12;
        const rightBoundary = dockPosition === 'right' ? 88 : 12;
        const windowLeft = dockPosition === 'left'
          ? Math.max(leftBoundary, Math.min(win.x, window.innerWidth - windowWidth - 12))
          : dockPosition === 'right'
            ? Math.max(12, Math.min(win.x, window.innerWidth - windowWidth - rightBoundary))
            : Math.max(12, Math.min(win.x, window.innerWidth - windowWidth - 12));
        const windowTop = Math.max(0, Math.min(win.y, window.innerHeight - 300));
        const availableHeight = Math.max(260, window.innerHeight - windowTop - (dockPosition === 'bottom' ? 98 : 12));
        const maxStyle = win.isMaximized
          ? { top: 0, left: dockPosition === 'left' ? 84 : 8, right: dockPosition === 'right' ? 84 : 8, bottom: dockPosition === 'bottom' ? 112 : 0 }
          : { top: windowTop, left: windowLeft, width: windowWidth, height: Math.min(win.h, availableHeight) };

        return (
          <section
            key={win.id}
            onMouseDown={() => focusWindow(win.id)}
            style={{ ...maxStyle, zIndex: win.zIndex, maxWidth: win.isMaximized ? 'none' : (isSideDock ? 'calc(100vw - 110px)' : 'calc(100vw - 24px)'), maxHeight: win.isMaximized ? 'none' : (dockPosition === 'bottom' ? 'calc(100vh - 125px)' : 'calc(100vh - 24px)') }}
            className={`absolute flex min-h-[280px] min-w-[320px] flex-col overflow-hidden rounded-xl border bg-[#171a1f]/[0.97] shadow-[0_24px_80px_rgba(0,0,0,0.48)] backdrop-blur-2xl ${activeWindow === win.id ? 'border-white/[0.16]' : 'border-white/[0.09]'}`}
          >
            <div
              onMouseDown={(event) => startDragging(win.id, event)}
              onDoubleClick={(event) => {
                if (!event.target.closest('button')) toggleMaximize(win.id, event);
              }}
              title="Double-click to maximize or restore"
              className="flex h-11 shrink-0 cursor-grab items-center justify-between border-b border-white/[0.07] bg-[#1d2026] px-3.5 active:cursor-grabbing"
            >
              <div className="flex min-w-0 items-center gap-2.5">
                <Icon className={`h-4 w-4 shrink-0 ${APP_TONES[win.id]?.split(' ')[0] || 'text-slate-300'}`} strokeWidth={1.8} />
                <span className="truncate text-xs font-semibold text-slate-200">{win.title}</span>
                {win.id === 'terminal' && <span className="rounded border border-white/[0.08] px-1.5 py-0.5 text-[9px] text-slate-500">bash-like</span>}
              </div>
              <div className="ml-3 flex shrink-0 items-center gap-1">
                <button onClick={(event) => toggleMinimize(win.id, event)} title="Minimize" className="rounded-md p-1.5 text-slate-500 transition hover:bg-white/[0.08] hover:text-slate-200"><Minimize2 className="h-3.5 w-3.5" /></button>
                <button onClick={(event) => toggleMaximize(win.id, event)} title={win.isMaximized ? 'Restore' : 'Maximize'} className="rounded-md p-1.5 text-slate-500 transition hover:bg-white/[0.08] hover:text-slate-200"><Maximize2 className="h-3.5 w-3.5" /></button>
                <button onClick={(event) => closeWindow(win.id, event)} title="Close" className="ml-1 rounded-md p-1.5 text-slate-500 transition hover:bg-rose-500/15 hover:text-rose-300"><X className="h-3.5 w-3.5" /></button>
              </div>
            </div>

            <div className={`min-h-0 flex-1 ${win.id === 'terminal' ? 'overflow-hidden p-3' : 'overflow-auto p-5'}`}>
              {win.id === 'process-manager' && (
                <div>
                  <SectionHeading
                    eyebrow="Kernel / Process table"
                    title="Process manager"
                    description="Inspect process states and create or terminate simulated processes."
                    icon={Cpu}
                    action={<span className="rounded-md border border-white/[0.08] bg-white/[0.035] px-2.5 py-1.5 text-[11px] text-slate-400"><span className="font-semibold text-slate-200">{processes.length}</span> processes</span>}
                  />
                  <div className="overflow-x-auto rounded-xl border border-white/[0.08]">
                    <table className="w-full min-w-[690px] text-left text-xs">
                      <thead className="bg-white/[0.035] text-[10px] uppercase tracking-[0.11em] text-slate-500">
                        <tr>{['PID', 'Process', 'State', 'Priority', 'Burst', 'Remaining', ''].map((heading) => <th key={heading} className="px-3.5 py-3 font-medium">{heading}</th>)}</tr>
                      </thead>
                      <tbody className="divide-y divide-white/[0.055]">
                        {processes.map((process) => (
                          <tr key={process.pid} className="transition hover:bg-white/[0.025]">
                            <td className="px-3.5 py-3 font-mono text-slate-400">{String(process.pid).padStart(3, '0')}</td>
                            <td className="px-3.5 py-3 font-medium text-slate-200">{process.name}</td>
                            <td className="px-3.5 py-3"><span className={`rounded-md border px-2 py-1 text-[10px] font-medium ${process.state === 'RUNNING' ? 'border-emerald-400/20 bg-emerald-400/[0.08] text-emerald-300' : process.state === 'READY' ? 'border-amber-300/20 bg-amber-300/[0.07] text-amber-200' : 'border-slate-400/15 bg-slate-400/[0.06] text-slate-400'}`}>{process.state}</span></td>
                            <td className="px-3.5 py-3 font-mono text-slate-400">{process.priority}</td>
                            <td className="px-3.5 py-3 font-mono text-slate-400">{process.burst}u</td>
                            <td className="px-3.5 py-3 font-mono text-slate-300">{process.remaining}u</td>
                            <td className="px-3.5 py-3 text-right"><button onClick={() => terminateProcess(process.pid)} title={`Terminate ${process.name}`} className="rounded-md border border-white/[0.07] p-1.5 text-slate-500 transition hover:border-rose-400/20 hover:bg-rose-400/[0.08] hover:text-rose-300"><Trash2 className="h-3.5 w-3.5" /></button></td>
                          </tr>
                        ))}
                        {!processes.length && <tr><td colSpan="7" className="px-4 py-10 text-center text-slate-500">No active processes. Create one below.</td></tr>}
                      </tbody>
                    </table>
                  </div>
                  <form onSubmit={addProcess} className="mt-5 rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
                    <div className="mb-3 flex items-center gap-2"><Plus className="h-4 w-4 text-slate-400" /><h3 className="text-xs font-semibold text-slate-200">Create process</h3></div>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_110px_110px_auto]">
                      <label className="block"><span className="mb-1.5 block text-[10px] text-slate-500">Process name</span><input value={newProcName} onChange={(e) => setNewProcName(e.target.value)} placeholder="e.g. matrix_multiply" className="field w-full" /></label>
                      <label className="block"><span className="mb-1.5 block text-[10px] text-slate-500">Burst (units)</span><input type="number" min="1" value={newProcBurst} onChange={(e) => setNewProcBurst(e.target.value)} className="field w-full" /></label>
                      <label className="block"><span className="mb-1.5 block text-[10px] text-slate-500">Priority</span><input type="number" min="0" value={newProcPriority} onChange={(e) => setNewProcPriority(e.target.value)} className="field w-full" /></label>
                      <button type="submit" className="self-end rounded-lg bg-slate-100 px-4 py-2.5 text-xs font-semibold text-slate-900 transition hover:bg-white"><Plus className="mr-1 inline h-3.5 w-3.5" />Create</button>
                    </div>
                  </form>
                </div>
              )}

              {win.id === 'scheduler' && (
                <div>
                  <SectionHeading eyebrow="Kernel / CPU" title="Scheduling laboratory" description="Compare scheduling policies using the active simulated processes." icon={Activity} />
                  <div className="mb-5 flex flex-wrap items-end gap-3 rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
                    <label className="min-w-[220px] flex-1"><span className="mb-1.5 block text-[10px] text-slate-500">Scheduling algorithm</span><select value={schedAlgo} onChange={(e) => setSchedAlgo(e.target.value)} className="field w-full"><option value="FCFS">First Come, First Served (FCFS)</option><option value="SJF">Shortest Job First (SJF)</option><option value="RR">Round Robin (RR)</option><option value="PRIO">Priority (lower number first)</option></select></label>
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
                  <div className="min-h-0 flex-1 overflow-y-auto p-4 leading-relaxed text-emerald-100/90">
                    {termHistory.map((line, index) => <pre key={index} className="whitespace-pre-wrap break-words font-mono">{line || ' '}</pre>)}
                    <form onSubmit={handleTerminalSubmit} className="flex items-baseline gap-2 font-mono leading-relaxed">
                      <span className="shrink-0 text-sky-300">student@minios:{currentPath.startsWith('/home/student') ? currentPath.replace('/home/student', '~') : currentPath}$</span>
                      <input autoComplete="off" spellCheck={false} value={termInput} onChange={(e) => setTermInput(e.target.value)} aria-label="Terminal command" className="min-w-0 flex-1 border-0 bg-transparent p-0 font-mono text-[11px] text-slate-100 outline-none ring-0 focus:border-0 focus:outline-none focus:ring-0" placeholder="" />
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
                    <button onClick={goUpDirectory} disabled={isAtFileRoot} className="rounded-md p-1.5 text-slate-300 transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-30" title="Go to parent folder"><ArrowUp className="h-3.5 w-3.5" /></button>
                    <Folder className="h-4 w-4 text-amber-200" />
                    <span className="text-[11px] text-slate-400">Location</span>
                    <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-slate-200">{currentPath}</span>
                    <button onClick={() => setCurrentPath(FILE_ROOT)} className="rounded-md px-2 py-1 text-[10px] text-slate-400 transition hover:bg-white/[0.07] hover:text-slate-100" title="Return to project root">Home</button>
                  </div>
                  <div ref={fileListRef} className="relative min-h-[250px] overflow-x-auto rounded-xl border border-white/[0.09] bg-black/[0.08]" onMouseDown={beginFileSelection} onContextMenu={(event) => openFileContextMenu(event)}>
                    <table className="w-full min-w-[620px] text-left text-xs">
                      <thead className="bg-white/[0.055] text-[10px] uppercase tracking-[0.1em] text-slate-400"><tr>{['Name', 'Kind', 'Size', 'Modified', ''].map((item) => <th key={item} className="px-3.5 py-3 font-medium">{item}</th>)}</tr></thead>
                      <tbody className="divide-y divide-white/[0.055]">
                        {visibleFiles.map((file) => {
                          const key = getFileKey(file);
                          const isSelected = selectedFileKeys.includes(key);
                          return <tr key={key} data-file-key={key} onClick={(event) => handleFileRowClick(event, file)} onDoubleClick={() => openFileEntry(file)} onContextMenu={(event) => openFileContextMenu(event, file)} className={`cursor-default transition ${isSelected ? 'bg-sky-300/[0.16] outline outline-1 -outline-offset-1 outline-sky-200/35' : 'hover:bg-white/[0.055]'}`}>
                            <td className="px-3.5 py-3"><span className="flex items-center gap-2.5">{file.type === 'dir' ? <Folder className="h-4 w-4 text-amber-200" /> : <FileText className="h-4 w-4 text-slate-300" />}<span className="font-medium text-slate-100">{file.name}</span></span></td>
                            <td className="px-3.5 py-3 text-slate-400">{file.type === 'dir' ? 'Folder' : 'File'}</td>
                            <td className="px-3.5 py-3 font-mono text-slate-400">{file.size}</td>
                            <td className="px-3.5 py-3 font-mono text-slate-400">{file.modified}</td>
                            <td className="px-3.5 py-3 text-right"><button onClick={(event) => { event.stopPropagation(); deleteFile(file); }} title={`Delete ${file.name}`} className="rounded-md p-1.5 text-slate-500 transition hover:bg-rose-400/[0.1] hover:text-rose-300"><Trash2 className="h-3.5 w-3.5" /></button></td>
                          </tr>;
                        })}
                        {!visibleFiles.length && <tr><td colSpan="5" className="py-12 text-center text-slate-500"><FolderOpen className="mx-auto mb-2 h-6 w-6 text-slate-600" />This folder is empty.<p className="mt-1 text-[10px]">Right-click and choose New to add a file or folder.</p></td></tr>}
                      </tbody>
                    </table>
                    {fileSelectionStyle && <div aria-hidden="true" className="pointer-events-none absolute z-20 border border-sky-200/70 bg-sky-300/15" style={fileSelectionStyle} />}
                  </div>
                </div>
              )}

              {win.id === 'memory' && (
                <div>
                  <SectionHeading eyebrow="Kernel / Memory" title="Memory and paging" description="Illustrative memory figures for the simulator, not your computer's actual RAM usage." icon={HardDrive} action={<span className="rounded-md border border-white/[0.08] px-2.5 py-1.5 text-[10px] text-slate-400">Page size <b className="ml-1 text-slate-200">4 KB</b></span>} />
                  <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3"><StatCard label="Physical memory" value="4,096 MB" helper="Simulated capacity" icon={HardDrive} /><StatCard label="Allocated" value="1,842 MB" helper="Sample data" icon={Activity} /><StatCard label="Page faults" value="2" helper="Sample run" icon={Zap} /></div>
                  <div className="rounded-xl border border-white/[0.08] bg-[#101317] p-4"><div className="mb-4 flex items-center justify-between"><h3 className="text-xs font-semibold text-slate-300">Physical frame map</h3><div className="flex items-center gap-3 text-[10px] text-slate-500"><span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-sm bg-sky-300/70" />Allocated</span><span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-sm bg-slate-700" />Free</span></div></div><div className="grid grid-cols-8 gap-2 sm:grid-cols-16">{Array.from({ length: 64 }).map((_, index) => <div key={index} title={`Frame ${index}: ${index < 29 ? 'allocated' : 'free'}`} className={`flex aspect-square items-center justify-center rounded-md border text-[10px] font-mono ${index < 29 ? 'border-sky-300/20 bg-sky-300/[0.12] text-sky-200/80' : 'border-white/[0.035] bg-white/[0.025] text-slate-600'}`}>{index}</div>)}</div></div>
                </div>
              )}

              {win.id === 'system-monitor' && (
                <div>
                  <SectionHeading eyebrow="System / Telemetry" title="System monitor" description="Values below are generated by this OS simulation; they do not measure the host computer." icon={Monitor} action={<span className="rounded-md border border-white/[0.08] px-2.5 py-1.5 text-[10px] text-slate-500">Demo telemetry</span>} />
                  <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3"><StatCard label="Runnable processes" value={activeProcesses} helper="READY or RUNNING" icon={Cpu} /><StatCard label="Process table" value={processes.length} helper="Including blocked tasks" icon={Activity} /><StatCard label="System state" value="Stable" helper="No simulated alerts" icon={ShieldCheck} /></div>
                  <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4"><h3 className="mb-4 text-xs font-semibold text-slate-300">Process distribution</h3>{['RUNNING', 'READY', 'BLOCKED'].map((state) => { const count = processes.filter((p) => p.state === state).length; const pct = processes.length ? (count / processes.length) * 100 : 0; return <div key={state} className="mb-4 last:mb-0"><div className="mb-2 flex justify-between text-[11px]"><span className="text-slate-400">{state}</span><span className="font-mono text-slate-300">{count}</span></div><div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]"><div style={{ width: `${pct}%` }} className={`h-full rounded-full ${state === 'RUNNING' ? 'bg-emerald-300/70' : state === 'READY' ? 'bg-amber-200/70' : 'bg-slate-500/70'}`} /></div></div>; })}</div>
                </div>
              )}

              {win.id === 'settings' && (
                <div>
                  <SectionHeading eyebrow="Personalization" title="Settings" description="Adjust the desktop's appearance and application dock." icon={Settings} />
                  <div className="space-y-4">
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
                      <p className="mt-3 text-[10px] leading-5 text-slate-500">Images apply to this browser session and are not uploaded to a server.</p>
                    </section>
                    <section className="flex items-center justify-between gap-4 rounded-xl border border-white/[0.08] bg-white/[0.02] p-4"><div><h3 className="text-xs font-semibold text-slate-200">About MINIOS</h3><p className="mt-1 text-[11px] text-slate-500">Desktop operating-system simulator · NIT Warangal CSE project</p></div><span className="rounded-md border border-white/[0.08] px-2.5 py-1.5 font-mono text-[10px] text-slate-400">v2.4.0</span></section>
                  </div>
                </div>
              )}
            </div>
          </section>
        );
      })}

      {/* Full-screen overview: hides windows, provides search, and lets the user switch between open windows. */}
      {appLauncherOpen && (
        <div className="absolute inset-0 z-[100] overflow-y-auto bg-[#111827]/62 backdrop-blur-2xl" onMouseDown={(event) => { if (event.target === event.currentTarget) setAppLauncherOpen(false); }}>
          <div className="mx-auto flex min-h-full w-full max-w-6xl flex-col px-6 pb-10 pt-7 sm:px-10">
            <div className="mb-6 flex items-start justify-between gap-4">
              <div><p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-sky-200/80">MINIOS overview</p><h2 className="mt-1 text-xl font-semibold tracking-tight text-white">What would you like to open?</h2><p className="mt-1 text-xs text-slate-300/75">Search applications or jump back to an open window.</p></div>
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
              {filteredApps.length ? <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">{filteredApps.map((app) => <button key={app.id} onClick={() => openWindow(app.id)} onContextMenu={(event) => { if (app.id !== 'settings') openDockContextMenu(event, app.id); else event.preventDefault(); }} className="group flex items-center gap-3 rounded-xl border border-white/[0.09] bg-white/[0.045] p-3 text-left backdrop-blur-lg transition duration-200 hover:-translate-y-0.5 hover:border-white/[0.17] hover:bg-white/[0.095]">
                <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border ${APP_TONES[app.id]} transition duration-200 group-hover:scale-105`}><AppIcon app={app} size="md" /></span><span className="min-w-0 flex-1"><span className="block truncate text-xs font-semibold text-slate-100">{app.title}</span><span className="mt-1 block truncate text-[10px] text-slate-400">{app.subtitle}</span></span><ChevronDown className="h-3.5 w-3.5 -rotate-90 text-slate-500 transition group-hover:translate-x-0.5 group-hover:text-slate-200" />
              </button>)}</div> : <p className="rounded-xl border border-dashed border-white/[0.15] px-4 py-7 text-center text-xs text-slate-400">No applications found.</p>}
            </section>
            <div className="mt-auto pt-8 text-center text-[10px] text-slate-400/80">Shortcut: F9, Alt + F1, or Ctrl + Shift + Space · Escape to return to desktop</div>
          </div>
        </div>
      )}

      {/* Right-click menu for files: create, copy, cut, paste, delete, or refresh. */}
      {contextMenu && (
        <div className="fixed z-[115] w-52 overflow-visible rounded-xl border border-white/[0.15] bg-[#242a34]/95 p-1.5 shadow-[0_18px_60px_rgba(0,0,0,0.45)] backdrop-blur-2xl" style={{ left: Math.max(8, Math.min(contextMenu.x, window.innerWidth - 220)), top: Math.max(8, Math.min(contextMenu.y, window.innerHeight - 310)) }} onMouseDown={(event) => event.stopPropagation()} onClick={(event) => event.stopPropagation()}>
          <button onClick={() => setContextNewOpen((open) => !open)} className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-xs text-slate-100 transition hover:bg-white/[0.09]"><span><Plus className="mr-2 inline h-3.5 w-3.5" />New</span><ChevronDown className={`h-3.5 w-3.5 -rotate-90 transition ${contextNewOpen ? 'rotate-0' : ''}`} /></button>
          {contextNewOpen && <div className="mb-1 ml-2 border-l border-white/[0.12] pl-2"><button onClick={() => beginCreateItem('dir')} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs text-slate-200 transition hover:bg-white/[0.09]"><FolderPlus className="h-3.5 w-3.5 text-amber-200" />Folder</button><button onClick={() => beginCreateItem('file')} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs text-slate-200 transition hover:bg-white/[0.09]"><FilePlus className="h-3.5 w-3.5 text-sky-200" />File</button></div>}
          {contextMenu.selectedKeys?.length > 0 && <>
            <div className="my-1 h-px bg-white/[0.09]" />
            <button onClick={() => copyOrCutSelectedFiles('copy')} className="w-full rounded-lg px-3 py-2 text-left text-xs text-slate-200 transition hover:bg-white/[0.09]">Copy <span className="float-right text-[10px] text-slate-500">Ctrl+C</span></button>
            <button onClick={() => copyOrCutSelectedFiles('cut')} className="w-full rounded-lg px-3 py-2 text-left text-xs text-slate-200 transition hover:bg-white/[0.09]">Cut <span className="float-right text-[10px] text-slate-500">Ctrl+X</span></button>
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

      {/* Dock context menu. Settings and the overview/app-opener button intentionally have no context menu. */}
      {dockContextMenu && (() => {
        const pinned = pinnedApps.includes(dockContextMenu.appId);
        const app = INITIAL_APPS.find((item) => item.id === dockContextMenu.appId);
        return <div className="fixed z-[118] w-48 rounded-xl border border-white/[0.15] bg-[#242a34]/95 p-1.5 shadow-[0_18px_60px_rgba(0,0,0,0.45)] backdrop-blur-2xl" style={{ left: Math.max(8, Math.min(dockContextMenu.x, window.innerWidth - 205)), top: Math.max(8, Math.min(dockContextMenu.y, window.innerHeight - 120)) }} onMouseDown={(event) => event.stopPropagation()} onClick={(event) => event.stopPropagation()}>
          <div className="px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">{app?.title || 'Application'}</div>
          <button onClick={() => togglePinnedApp(dockContextMenu.appId)} className="w-full rounded-lg px-3 py-2.5 text-left text-xs text-slate-100 transition hover:bg-white/[0.09]">{pinned ? 'Unpin from dock' : 'Pin to dock'}</button>
          {!pinned && windows.some((win) => win.id === dockContextMenu.appId && win.isOpen) && <button onClick={() => { setWindows((previous) => previous.map((win) => win.id === dockContextMenu.appId ? { ...win, isOpen: false, isMinimized: false } : win)); setDockContextMenu(null); setToast('Application window closed.'); }} className="w-full rounded-lg px-3 py-2 text-left text-xs text-slate-300 transition hover:bg-white/[0.09]">Close window</button>}
        </div>;
      })()}

      {/* Tooltips are fixed-position so scrolling docks never clip them. */}
      {dockTooltip && !dockContextMenu && !contextMenu && <div className="pointer-events-none fixed z-[130] whitespace-nowrap rounded-md border border-white/15 bg-[#11151d]/95 px-2.5 py-1.5 text-[11px] text-white shadow-xl backdrop-blur-xl" style={{ left: dockTooltip.x, top: dockTooltip.y, transform: dockTooltip.placement === 'top' ? 'translate(-50%, -100%)' : dockTooltip.placement === 'left' ? 'translate(-100%, -50%)' : 'translateY(-50%)' }}>{dockTooltip.title}</div>}

      {/* Create a new virtual file or folder. */}
      {newItemType && (
        <div className="absolute inset-0 z-[125] flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm">
          <form onSubmit={createFileSystemItem} className="w-full max-w-sm rounded-2xl border border-white/[0.16] bg-[#202630]/95 p-5 shadow-[0_24px_80px_rgba(0,0,0,0.5)] backdrop-blur-2xl">
            <div className="mb-4 flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/[0.1] bg-white/[0.07]">{newItemType === 'dir' ? <FolderPlus className="h-5 w-5 text-amber-200" /> : <FilePlus className="h-5 w-5 text-sky-200" />}</span><div><h3 className="text-sm font-semibold text-white">Create {newItemType === 'dir' ? 'folder' : 'file'}</h3><p className="mt-1 text-[10px] text-slate-400">Inside {currentFolderLabel}</p></div></div>
            <label className="mb-4 block"><span className="mb-1.5 block text-[10px] text-slate-400">Name</span><input autoFocus value={newItemName} onChange={(event) => setNewItemName(event.target.value)} placeholder={newItemType === 'dir' ? 'e.g. assignments' : 'e.g. notes.txt'} className="field w-full" /></label>
            <div className="flex justify-end gap-2"><button type="button" onClick={() => setNewItemType(null)} className="rounded-lg border border-white/[0.1] px-3.5 py-2 text-xs text-slate-300 transition hover:bg-white/[0.06]">Cancel</button><button type="submit" className="rounded-lg bg-slate-100 px-4 py-2 text-xs font-semibold text-slate-900 transition hover:bg-white">Create</button></div>
          </form>
        </div>
      )}

      {/* Simple editor for virtual files opened by double-clicking them. */}
      {filePreview && (
        <div className="absolute inset-0 z-[126] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="flex max-h-[82vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-white/[0.16] bg-[#1b2028]/[0.98] shadow-[0_24px_80px_rgba(0,0,0,0.5)]">
            <div className="flex items-center justify-between border-b border-white/[0.09] px-4 py-3"><div className="flex min-w-0 items-center gap-2.5"><FileText className="h-4 w-4 shrink-0 text-sky-200" /><div className="min-w-0"><p className="truncate text-xs font-semibold text-slate-100">{filePreview.name}</p><p className="mt-0.5 truncate text-[10px] text-slate-500">{filePreview.parent}/{filePreview.name} · virtual file</p></div></div><button onClick={() => setFilePreview(null)} aria-label="Close file" className="rounded-md p-1.5 text-slate-400 transition hover:bg-white/[0.08] hover:text-white"><X className="h-4 w-4" /></button></div>
            <textarea value={filePreview.draft} onChange={(event) => setFilePreview((previous) => ({ ...previous, draft: event.target.value }))} spellCheck={false} className="min-h-[280px] flex-1 resize-y bg-[#0d1117] p-4 font-mono text-xs leading-relaxed text-slate-200 outline-none placeholder:text-slate-600" placeholder="This file is empty. Start typing…" />
            <div className="flex items-center justify-between gap-3 border-t border-white/[0.08] px-4 py-3"><span className="text-[10px] text-slate-500">Changes are stored in the browser simulation only.</span><div className="flex gap-2"><button onClick={() => setFilePreview(null)} className="rounded-lg border border-white/[0.1] px-3.5 py-2 text-xs text-slate-300 hover:bg-white/[0.06]">Cancel</button><button onClick={saveFilePreview} className="rounded-lg bg-slate-100 px-4 py-2 text-xs font-semibold text-slate-900 hover:bg-white">Save changes</button></div></div>
          </div>
        </div>
      )}

      {/* Quick system menu */}
      {quickSettingsOpen && (
        <div className="absolute left-1/2 top-[58px] z-[115] w-72 -translate-x-1/2 rounded-xl border border-white/[0.16] bg-slate-950/[0.78] p-4 shadow-[0_18px_60px_rgba(0,0,0,0.4)] backdrop-blur-2xl">
          <div className="mb-3 flex items-center justify-between"><div><p className="text-sm font-semibold text-slate-100">System</p><p className="mt-1 text-[11px] text-slate-500">MINIOS controls and shortcuts</p></div><Clock3 className="h-4 w-4 text-slate-500" /></div>
          <div className="grid grid-cols-2 gap-2"><div className="rounded-lg border border-white/[0.07] bg-white/[0.035] p-3"><Wifi className="mb-2 h-4 w-4 text-slate-300" /><p className="text-xs text-slate-200">Network</p><p className="mt-1 text-[10px] text-slate-500">Connected · simulated</p></div><div className="rounded-lg border border-white/[0.07] bg-white/[0.035] p-3"><Battery className="mb-2 h-4 w-4 text-slate-300" /><p className="text-xs text-slate-200">Power</p><p className="mt-1 text-[10px] text-slate-500">Normal · simulated</p></div></div>
          <button onClick={() => openWindow('settings')} className="mt-3 flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-xs text-slate-200 transition hover:bg-white/[0.08]"><Settings className="h-4 w-4 text-slate-300" />Open Settings</button>
          <button onClick={() => { setWindows((previous) => previous.map((win) => win.isOpen ? { ...win, isMinimized: true } : win)); setActiveWindow('desktop'); setQuickSettingsOpen(false); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-xs text-slate-200 transition hover:bg-white/[0.08]"><Power className="h-4 w-4 text-slate-300" />Show desktop</button>
        </div>
      )}

      {toast && <div className="absolute bottom-5 left-1/2 z-[120] -translate-x-1/2 rounded-lg border border-white/[0.1] bg-[#283243]/90 px-4 py-2.5 text-xs text-slate-100 shadow-xl backdrop-blur-2xl">{toast}</div>}

      <style>{`
        .field { border: 1px solid rgba(255,255,255,.13); border-radius: 9px; background: rgba(5,7,10,.48); padding: 9px 11px; color: #f1f5f9; font-size: 11px; outline: none; transition: border-color .15s, background .15s; }
        .field::placeholder { color: #64748b; }
        .field:focus { border-color: rgba(186,230,253,.55); background: rgba(5,7,10,.66); }
        .field option { background: #171a1f; color: #e2e8f0; }
        * { scrollbar-width: thin; scrollbar-color: rgba(203,213,225,.30) transparent; }
        button { -webkit-tap-highlight-color: transparent; }
      `}</style>
    </div>
  );
}
