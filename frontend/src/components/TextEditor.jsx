import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Check, FilePlus, FileText, FolderOpen, Info, Loader2, NotepadText, Plus, Save,
  SaveAll, Search, WrapText, X,
} from 'lucide-react';
import { socket, awaitSocketEvent } from '../lib/socket';
import UnsavedChangesDialog from './UnsavedChangesDialog';

const ROOT_DIR_ID = 'D0';

function filePathFor(dirId, directories) {
  const map = new Map(directories.map((d) => [d.dirId, d]));
  const segments = [];
  let curr = dirId;
  let guard = 0;
  while (curr && curr !== ROOT_DIR_ID && guard < 64) {
    const dir = map.get(curr);
    if (!dir) break;
    segments.unshift(dir.name);
    curr = dir.parentDirId;
    guard += 1;
  }
  return segments.length ? `/${segments.join('/')}` : '/';
}

export default function TextEditor({
  tabs = [],
  setTabs,
  activeTabKey = null,
  setActiveTabKey,
  files = [],
  directories = [],
  openRequest = null,
  onNotify = () => {},
}) {
  const [dialog, setDialog] = useState(null);
  const [wordWrap, setWordWrap] = useState(true);
  const [caret, setCaret] = useState({ line: 1, column: 1 });
  const [openSearch, setOpenSearch] = useState('');
  const textareaRef = useRef(null);
  const loadTimersRef = useRef(new Map());
  const pendingCreateRef = useRef(null);

  const activeTab = useMemo(() => {
    const tab = tabs.find((item) => item.key === activeTabKey) || null;
    if (!tab) return null;
    const live = files.find((file) => file.fileId === tab.fileId);
    if (live && (live.name !== tab.name || live.dirId !== tab.dirId)) {
      return { ...tab, name: live.name, dirId: live.dirId };
    }
    return tab;
  }, [files, tabs, activeTabKey]);

  const dirtyTabs = useMemo(
    () => tabs.filter((tab) => !tab.loading && tab.draft !== tab.savedContent),
    [tabs]
  );

  const tabsRef = useRef(tabs);
  useEffect(() => {
    tabsRef.current = tabs;
  }, [tabs]);

  useEffect(() => {
    if (!dirtyTabs.length) return undefined;
    const handleBeforeUnload = (event) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [dirtyTabs.length]);

  const patchTab = useCallback((key, patch) => {
    setTabs((previous) => previous.map((tab) => (tab.key === key ? { ...tab, ...patch } : tab)));
  }, [setTabs]);

  const armLoadTimeout = useCallback((key) => {
    const timers = loadTimersRef.current;
    if (timers.has(key)) clearTimeout(timers.get(key));
    timers.set(key, setTimeout(() => {
      timers.delete(key);
      setTabs((previous) => previous.map((tab) => (
        tab.key === key && tab.loading
          ? { ...tab, loading: false, error: '' }
          : tab
      )));
    }, 4000));
  }, [setTabs]);

  useEffect(() => {
    const handleRead = (result) => {
      if (!result || !result.fileId) return;
      const timers = loadTimersRef.current;
      setTabs((previous) => previous.map((tab) => {
        if (String(tab.fileId) !== String(result.fileId)) return tab;
        if (timers.has(tab.key)) {
          clearTimeout(timers.get(tab.key));
          timers.delete(tab.key);
        }
        if (result.ok) {
          if (tab.draft !== tab.savedContent && !tab.loading) {
            return { ...tab, loading: false, error: '' };
          }
          return { ...tab, draft: result.content ?? '', savedContent: result.content ?? '', loading: false, error: '' };
        }
        return { ...tab, loading: false, error: 'The engine could not read this file.' };
      }));
    };
    socket.on('file:read_result', handleRead);
    return () => socket.off('file:read_result', handleRead);
  }, [setTabs]);

  useEffect(() => () => {
    loadTimersRef.current.forEach((timer) => clearTimeout(timer));
    loadTimersRef.current.clear();
  }, []);

  useEffect(() => {
    const handleSnapshot = () => {
      const currentTabs = tabsRef.current;
      currentTabs.forEach((tab) => {
        if (tab.draft === tab.savedContent && !tab.loading && !tab.saving) {
          armLoadTimeout(tab.key);
          patchTab(tab.key, { loading: true, error: '' });
          socket.emit('cmd:file_content', { fileId: tab.fileId });
        }
      });
    };
    socket.on('vfs:snapshot', handleSnapshot);
    return () => socket.off('vfs:snapshot', handleSnapshot);
  }, [armLoadTimeout, patchTab]);

  const openFile = useCallback((file) => {
    const resolvedFileId = file?.fileId || file?.id;
    if (!resolvedFileId) return;
    const existing = tabsRef.current.find((tab) => tab.key === resolvedFileId);
    if (existing) {
      setActiveTabKey(existing.key);
      if (existing.loading || existing.error || existing.draft === existing.savedContent) {
        patchTab(existing.key, { loading: true, error: '' });
        armLoadTimeout(existing.key);
        socket.emit('cmd:file_content', { fileId: resolvedFileId });
      }
      return;
    }
    const tab = {
      key: resolvedFileId,
      fileId: resolvedFileId,
      name: file.name || 'untitled.txt',
      dirId: file.dirId || file.parentDirId || ROOT_DIR_ID,
      draft: '',
      savedContent: '',
      loading: true,
      error: '',
      saving: false,
    };
    setTabs((previous) => (
      previous.some((item) => item.key === resolvedFileId)
        ? previous.map((item) => (item.key === resolvedFileId ? { ...item, loading: true, error: '' } : item))
        : [...previous, tab]
    ));
    setActiveTabKey(tab.key);
    armLoadTimeout(tab.key);
    socket.emit('cmd:file_content', { fileId: resolvedFileId });
  }, [armLoadTimeout, patchTab, setActiveTabKey, setTabs]);

  useEffect(() => {
    if (!openRequest?.file) return undefined;
    openFile(openRequest.file);
    return undefined;
  }, [openRequest, openFile]);

  const createFileAndWait = useCallback((name, dirId) => new Promise((resolve) => {
    if (!name || !dirId) {
      resolve(null);
      return;
    }
    if (files.some((file) => file.name === name && file.dirId === dirId)) {
      resolve({ duplicate: true });
      return;
    }
    pendingCreateRef.current = { name, dirId, resolve };
    socket.emit('cmd:file_create', { ownerPID: 'USER', name, sizeInBlocks: 1, dirId });
    setTimeout(() => {
      const pending = pendingCreateRef.current;
      if (pending && pending.name === name && pending.dirId === dirId) {
        pendingCreateRef.current = null;
        resolve(null);
      }
    }, 8000);
  }), [files]);

  useEffect(() => {
    const pending = pendingCreateRef.current;
    if (!pending) return undefined;
    const match = files.find((file) => file.name === pending.name && file.dirId === pending.dirId);
    if (match) {
      pendingCreateRef.current = null;
      pending.resolve(match);
    }
    return undefined;
  }, [files]);

  const writeContent = useCallback(async (fileId, content) => {
    const requestId = `save-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const wait = awaitSocketEvent('file:save_result', (result) => result.requestId === requestId, 10000);
    socket.emit('cmd:file_save', { requestId, fileId, content });
    const result = await wait;
    return Boolean(result?.ok);
  }, []);

  const saveTab = useCallback(async (tab) => {
    if (!tab || tab.loading || tab.saving) return false;
    patchTab(tab.key, { saving: true, error: '' });
    const ok = await writeContent(tab.fileId, tab.draft);
    if (ok) {
      patchTab(tab.key, { savedContent: tab.draft, saving: false });
      onNotify(`Saved ${tab.name}.`);
      return true;
    }
    patchTab(tab.key, { saving: false, error: 'The engine rejected the save.' });
    onNotify(`Could not save ${tab.name}.`);
    return false;
  }, [onNotify, patchTab, writeContent]);

  const saveAll = useCallback(async () => {
    const pending = tabs.filter((tab) => !tab.loading && tab.draft !== tab.savedContent);
    for (const tab of pending) {
      await saveTab(tab);
    }
  }, [saveTab, tabs]);

  const closeTab = useCallback((key) => {
    setTabs((previous) => {
      const next = previous.filter((tab) => tab.key !== key);
      setActiveTabKey(next.length ? next[next.length - 1].key : null);
      return next;
    });
  }, [setActiveTabKey, setTabs]);

  useEffect(() => {
    const timers = loadTimersRef.current;
    timers.forEach((timer, key) => {
      if (!tabs.some((tab) => tab.key === key)) {
        clearTimeout(timer);
        timers.delete(key);
      }
    });
  }, [tabs]);

  const requestCloseTab = useCallback((tab) => {
    if (tab && !tab.loading && tab.draft !== tab.savedContent) {
      setDialog({ kind: 'unsaved', tabKey: tab.key });
      return;
    }
    closeTab(tab.key);
  }, [closeTab]);

  const saveTabAs = useCallback(async (tab, name, dirId) => {
    if (!tab || !name || !dirId) return false;
    const existing = files.find((file) => file.name === name && file.dirId === dirId);
    let targetFileId = existing?.fileId || null;

    if (!targetFileId) {
      const created = await createFileAndWait(name, dirId);
      if (!created || created.duplicate) {
        onNotify(created?.duplicate ? 'A file with that name already exists there.' : 'The engine could not create that file.');
        return false;
      }
      targetFileId = created.fileId;
    }

    const owner = tabsRef.current.find((item) => item.key === targetFileId);
    if (owner && owner.key !== tab.key) {
      const okOwner = await writeContent(targetFileId, tab.draft);
      if (!okOwner) {
        onNotify(`Could not save ${name}.`);
        return false;
      }
      patchTab(owner.key, { savedContent: tab.draft });
      onNotify(`Saved ${name} to ${filePathFor(dirId, directories)}.`);
      closeTab(tab.key);
      return true;
    }

    patchTab(tab.key, { saving: true, error: '' });
    const ok = await writeContent(targetFileId, tab.draft);
    if (!ok) {
      patchTab(tab.key, { saving: false, error: 'The engine rejected the save.' });
      onNotify(`Could not save ${name}.`);
      return false;
    }
    patchTab(tab.key, {
      key: targetFileId,
      fileId: targetFileId,
      name,
      dirId,
      savedContent: tab.draft,
      saving: false,
    });
    setActiveTabKey((previous) => (previous === tab.key ? targetFileId : previous));
    onNotify(`Saved ${name} to ${filePathFor(dirId, directories)}.`);
    return true;
  }, [closeTab, createFileAndWait, directories, files, onNotify, patchTab, setActiveTabKey, writeContent]);

  const createNewDocument = useCallback(async (name, dirId) => {
    const created = await createFileAndWait(name, dirId);
    if (!created || created.duplicate) {
      onNotify(created?.duplicate ? 'A file with that name already exists there.' : 'The engine could not create that file.');
      return;
    }
    openFile(created);
    onNotify(`Created ${name}.`);
  }, [createFileAndWait, onNotify, openFile]);

  const syncCaret = useCallback((element) => {
    if (!element) return;
    const upto = element.value.slice(0, element.selectionStart ?? 0);
    const lines = upto.split('\n');
    setCaret({ line: lines.length, column: lines[lines.length - 1].length + 1 });
  }, []);

  useEffect(() => {
    syncCaret(textareaRef.current);
  }, [activeTabKey, activeTab?.draft, syncCaret]);

  const handleEditorKeyDown = (event) => {
    const control = event.ctrlKey || event.metaKey;
    if (control) {
      const key = event.key.toLowerCase();
      if (key === 's') {
        event.preventDefault();
        if (event.shiftKey) saveAll();
        else if (activeTab) saveTab(activeTab);
      } else if (key === 'n') {
        event.preventDefault();
        setDialog({ kind: 'new' });
      } else if (key === 'o') {
        event.preventDefault();
        setOpenSearch('');
        setDialog({ kind: 'open' });
      } else if (key === 'w') {
        event.preventDefault();
        if (activeTab) requestCloseTab(activeTab);
      }
      return;
    }
    if (event.key === 'Tab' && activeTab) {
      event.preventDefault();
      const element = event.target;
      const start = element.selectionStart;
      const end = element.selectionEnd;
      const next = `${element.value.slice(0, start)}  ${element.value.slice(end)}`;
      patchTab(activeTab.key, { draft: next });
      requestAnimationFrame(() => {
        element.selectionStart = start + 2;
        element.selectionEnd = start + 2;
        syncCaret(element);
      });
    }
  };

  const directoryOptions = useMemo(() => directories
    .map((dir) => ({
      dirId: dir.dirId,
      label: dir.dirId === ROOT_DIR_ID ? '/ (root)' : filePathFor(dir.dirId, directories),
    }))
    .sort((a, b) => a.label.localeCompare(b.label)), [directories]);

  const openableFiles = useMemo(() => {
    const query = openSearch.trim().toLowerCase();
    return files
      .map((file) => ({ ...file, path: `${filePathFor(file.dirId, directories)}/${file.name}` }))
      .filter((file) => !query || file.path.toLowerCase().includes(query))
      .sort((a, b) => a.path.localeCompare(b.path));
  }, [directories, files, openSearch]);

  const activeExists = activeTab ? files.some((file) => file.fileId === activeTab.fileId) : false;
  const lineCount = activeTab ? activeTab.draft.split('\n').length : 0;
  const activeClean = Boolean(activeTab) && activeTab.draft === activeTab.savedContent;

  return (
    <div className="relative flex h-full min-h-0 flex-col bg-[#e8ecf2] font-sans text-slate-800">
      <div className="flex shrink-0 flex-wrap items-center gap-1.5 border-b border-slate-300/80 bg-[#f6f8fb] px-2.5 py-2">
        <EditorButton onClick={() => setDialog({ kind: 'new' })} title="New file (Ctrl+N)" label="New" icon={FilePlus} />
        <EditorButton onClick={() => { setOpenSearch(''); setDialog({ kind: 'open' }); }} title="Open file (Ctrl+O)" label="Open" icon={FolderOpen} />
        <span className="mx-1 h-5 w-px bg-slate-300" />
        <EditorButton
          onClick={() => activeTab && saveTab(activeTab)}
          disabled={!activeTab || activeTab.loading || activeTab.saving || activeClean}
          title="Save (Ctrl+S)" label={activeTab?.saving ? 'Saving…' : 'Save'} icon={Save}
        />
        <EditorButton
          onClick={() => setDialog({ kind: 'saveAs', tabKey: activeTab.key })}
          disabled={!activeTab || activeTab.loading}
          title="Save as — choose a name and location" label="Save as" icon={Save}
        />
        <EditorButton onClick={saveAll} disabled={!dirtyTabs.length} title="Save every open document (Ctrl+Shift+S)" label="Save all" icon={SaveAll} />
        <span className="mx-1 h-5 w-px bg-slate-300" />
        <EditorButton
          onClick={() => setWordWrap((wrap) => !wrap)}
          active={wordWrap}
          title="Toggle word wrap" label="Wrap" icon={WrapText}
        />
        <span className="ml-auto flex items-center gap-1.5 pr-1 text-[10px] text-slate-500">
          <NotepadText className="h-3.5 w-3.5 text-sky-600" />
          MiniOS Text Editor
        </span>
      </div>

      <div className="flex shrink-0 items-stretch gap-px overflow-x-auto border-b border-slate-300/80 bg-[#dde3ec] px-1.5 pt-1.5">
        {tabs.map((tab) => {
          const isActive = tab.key === activeTabKey;
          const dirty = !tab.loading && tab.draft !== tab.savedContent;
          return (
            <div
              key={tab.key}
              onMouseDown={() => setActiveTabKey(tab.key)}
              onAuxClick={(event) => { if (event.button === 1) { event.preventDefault(); requestCloseTab(tab); } }}
              className={`flex min-w-[120px] max-w-[220px] cursor-pointer items-center gap-1.5 rounded-t-md border border-b-0 px-2.5 py-1.5 text-[11px] transition ${
                isActive
                  ? 'border-slate-300/80 border-b-white bg-white text-slate-900'
                  : 'border-transparent bg-transparent text-slate-600 hover:bg-white/60'
              }`}
              title={`${filePathFor(tab.dirId, directories)}/${tab.name}`}
            >
              <FileText className="h-3.5 w-3.5 shrink-0 text-sky-600" />
              <span className="truncate font-medium">{tab.name}</span>
              {dirty && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" title="Unsaved changes" />}
              <button
                type="button"
                onClick={(event) => { event.stopPropagation(); requestCloseTab(tab); }}
                aria-label={`Close ${tab.name}`}
                className="ml-0.5 shrink-0 rounded p-0.5 text-slate-400 transition hover:bg-slate-200 hover:text-slate-700"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          );
        })}
        <button
          type="button"
          onClick={() => setDialog({ kind: 'new' })}
          title="New file"
          aria-label="New file"
          className="mb-1 ml-1 flex h-7 w-7 shrink-0 items-center justify-center self-center rounded-md text-slate-500 transition hover:bg-white/70 hover:text-slate-800"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
        {!tabs.length && (
          <span className="mb-1 self-center px-2 text-[11px] text-slate-500">No documents open</span>
        )}
      </div>

      {activeTab ? (
        <div className="flex min-h-0 flex-1 flex-col bg-white">
          {activeTab.loading ? (
            <div className="flex flex-1 items-center justify-center gap-2 text-xs text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading from the simulated disk…
            </div>
          ) : (
            <div className="flex min-h-0 flex-1">
              <div className="w-12 shrink-0 select-none overflow-hidden bg-[#f1f4f9] py-3 pr-2 text-right font-mono text-[13px] leading-6 text-slate-400">
                {Array.from({ length: lineCount }, (_, index) => (
                  <div key={index}>{index + 1}</div>
                ))}
              </div>
              <textarea
                ref={textareaRef}
                value={activeTab.draft}
                onChange={(event) => {
                  patchTab(activeTab.key, { draft: event.target.value });
                  syncCaret(event.target);
                }}
                onKeyDown={handleEditorKeyDown}
                onSelect={(event) => syncCaret(event.target)}
                onClick={(event) => syncCaret(event.target)}
                spellCheck={false}
                wrap={wordWrap ? 'soft' : 'off'}
                aria-label={`Contents of ${activeTab.name}`}
                className={`min-h-0 flex-1 resize-none border-0 bg-white p-3 font-mono text-[13px] leading-6 text-slate-900 outline-none placeholder:text-slate-400 ${
                  wordWrap ? 'whitespace-pre-wrap break-words' : 'overflow-x-auto whitespace-pre'
                }`}
                placeholder="This file is empty. Start typing…"
              />
            </div>
          )}
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 bg-white px-6 py-10 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-200 bg-slate-100 text-sky-600">
            <NotepadText className="h-6 w-6" strokeWidth={1.7} />
          </span>
          <div>
            <p className="text-sm font-semibold text-slate-800">No documents open</p>
            <p className="mt-1 text-[11px] text-slate-500">
              Open a text file from the Files app, or start a new one here.
            </p>
          </div>
          <div className="flex gap-2">
            <EditorButton onClick={() => setDialog({ kind: 'new' })} label="New file" icon={FilePlus} />
            <EditorButton onClick={() => { setOpenSearch(''); setDialog({ kind: 'open' }); }} label="Open file" icon={FolderOpen} />
          </div>
        </div>
      )}

      <div className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1 border-t border-slate-300/80 bg-[#f6f8fb] px-3 py-1.5 text-[10px] text-slate-500">
        <span className="flex items-center gap-1.5 font-medium text-slate-700">
          <FileText className="h-3 w-3 text-sky-600" />
          {activeTab ? activeTab.name : 'Ready'}
        </span>
        {activeTab && (
          <>
            <span className="truncate" title={filePathFor(activeTab.dirId, directories)}>
              {filePathFor(activeTab.dirId, directories)}
            </span>
            <span>Ln {caret.line}, Col {caret.column}</span>
            <span>{lineCount} lines · {activeTab.draft.length} chars</span>
            {!activeExists && <span className="text-rose-600">File no longer exists on disk</span>}
            {activeExists && (activeClean
              ? <span className="flex items-center gap-1 text-emerald-600"><Check className="h-3 w-3" />Saved</span>
              : <span className="text-amber-600">Unsaved changes</span>)}
            {activeTab.error && <span className="text-rose-600">{activeTab.error}</span>}
          </>
        )}
        {!activeTab && <span>Documents stay open while you work in other apps</span>}
      </div>

      {(dialog?.kind === 'new' || dialog?.kind === 'saveAs') && (
        <NameLocationDialog
          title={dialog.kind === 'new' ? 'New file' : 'Save as'}
          confirmLabel={dialog.kind === 'new' ? 'Create' : 'Save'}
          initialName={
            dialog.kind === 'saveAs'
              ? (tabs.find((tab) => tab.key === dialog.tabKey)?.name ?? 'untitled.txt')
              : 'untitled.txt'
          }
          initialDirId={
            dialog.kind === 'saveAs'
              ? (tabs.find((tab) => tab.key === dialog.tabKey)?.dirId ?? ROOT_DIR_ID)
              : (activeTab?.dirId ?? ROOT_DIR_ID)
          }
          directories={directoryOptions}
          onCancel={() => setDialog(null)}
          onSubmit={async (name, dirId) => {
            const current = dialog;
            setDialog(null);
            if (current.kind === 'new') {
              await createNewDocument(name, dirId);
            } else {
              const tab = tabs.find((item) => item.key === current.tabKey);
              await saveTabAs(tab, name, dirId);
            }
          }}
        />
      )}

      {dialog?.kind === 'open' && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-900/25 p-4 backdrop-blur-sm">
          <div className="flex max-h-[80%] w-full max-w-md flex-col overflow-hidden rounded-xl border border-slate-300 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                <FolderOpen className="h-4 w-4 text-sky-600" /> Open file
              </h3>
              <button type="button" onClick={() => setDialog(null)} aria-label="Close" className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="border-b border-slate-200 px-4 py-2.5">
              <div className="flex items-center gap-2 rounded-lg border border-slate-300 bg-slate-50 px-2.5 py-1.5">
                <Search className="h-3.5 w-3.5 text-slate-400" />
                <input
                  autoFocus
                  value={openSearch}
                  onChange={(event) => setOpenSearch(event.target.value)}
                  placeholder="Search files by name or location…"
                  className="min-w-0 flex-1 border-0 bg-transparent text-xs text-slate-800 outline-none placeholder:text-slate-400"
                />
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-2">
              {openableFiles.map((file) => (
                <button
                  key={file.fileId}
                  type="button"
                  onClick={() => { setDialog(null); openFile(file); }}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs text-slate-700 transition hover:bg-sky-50"
                >
                  <FileText className="h-3.5 w-3.5 shrink-0 text-sky-600" />
                  <span className="truncate font-medium">{file.name}</span>
                  <span className="ml-auto truncate text-[10px] text-slate-400">{file.path}</span>
                </button>
              ))}
              {!openableFiles.length && (
                <p className="px-3 py-8 text-center text-xs text-slate-500">No files match that search.</p>
              )}
            </div>
            <div className="flex items-center gap-2 border-t border-slate-200 px-4 py-2.5 text-[10px] text-slate-500">
              <Info className="h-3.5 w-3.5" /> {openableFiles.length} file(s) in the simulated filesystem
            </div>
          </div>
        </div>
      )}

      {dialog?.kind === 'unsaved' && (() => {
        const tab = tabs.find((item) => item.key === dialog.tabKey);
        if (!tab) return null;
        return (
          <UnsavedChangesDialog
            fileName={tab.name}
            busy={tab.saving}
            onSave={async () => {
              const ok = await saveTab(tab);
              if (ok) { setDialog(null); closeTab(tab.key); }
            }}
            onDiscard={() => { setDialog(null); closeTab(tab.key); }}
            onCancel={() => setDialog(null)}
          />
        );
      })()}
    </div>
  );
}

function EditorButton({ onClick, icon: Icon, label, title, disabled = false, active = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title || label}
      className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-[11px] font-medium transition disabled:cursor-not-allowed disabled:opacity-40 ${
        active
          ? 'border-sky-300 bg-sky-50 text-sky-700'
          : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100 hover:text-slate-900'
      }`}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}

function NameLocationDialog({ title, confirmLabel, initialName, initialDirId, directories, onCancel, onSubmit }) {
  const [name, setName] = useState(initialName);
  const [dirId, setDirId] = useState(initialDirId);
  const [busy, setBusy] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || trimmed === '.' || trimmed === '..' || trimmed.includes('/')) return;
    setBusy(true);
    try {
      await onSubmit(trimmed, dirId);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-900/25 p-4 backdrop-blur-sm">
      <form onSubmit={submit} className="w-full max-w-sm rounded-xl border border-slate-300 bg-white p-5 shadow-2xl">
        <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
        <p className="mt-1 text-[11px] text-slate-500">
          Files live in the simulated filesystem and persist for your account.
        </p>
        <label className="mt-4 block">
          <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">Name</span>
          <input
            autoFocus
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="notes.txt"
            className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-xs text-slate-800 outline-none focus:border-sky-400"
          />
        </label>
        <label className="mt-3 block">
          <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">Location</span>
          <select
            value={dirId}
            onChange={(event) => setDirId(event.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-xs text-slate-800 outline-none focus:border-sky-400"
          >
            {directories.map((option) => (
              <option key={option.dirId} value={option.dirId}>{option.label}</option>
            ))}
          </select>
        </label>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onCancel} className="rounded-lg border border-slate-300 px-3.5 py-2 text-xs text-slate-600 transition hover:bg-slate-100">
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy}
            className="flex items-center gap-1.5 rounded-lg bg-sky-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-sky-500 disabled:opacity-60"
          >
            <Save className="h-3.5 w-3.5" /> {busy ? 'Working…' : confirmLabel}
          </button>
        </div>
      </form>
    </div>
  );
}