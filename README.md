# MiniOS Simulator 

[![C++ Standard](https://img.shields.io/badge/C%2B%2B-20-blue.svg?style=for-the-badge&logo=c%2B%2B)](https://en.cppreference.com/w/cpp/20)
[![CMake Version](https://img.shields.io/badge/CMake-3.20%2B-064F8C.svg?style=for-the-badge&logo=cmake)](https://cmake.org/)
[![Node.js](https://img.shields.io/badge/Node.js-18%2B-339933.svg?style=for-the-badge&logo=node.js)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-18.3-61DAFB.svg?style=for-the-badge&logo=react)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-5.4-646CFF.svg?style=for-the-badge&logo=vite)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.4-38B2AC.svg?style=for-the-badge&logo=tailwind-css)](https://tailwindcss.com/)
[![Socket.io](https://img.shields.io/badge/Socket.io-4.8-010101.svg?style=for-the-badge&logo=socket.io)](https://socket.io/)
[![License](https://img.shields.io/badge/License-ISC-green.svg?style=for-the-badge)](LICENSE)

An interactive, full-stack operating system simulation environment. MiniOS couples a high-performance **C++20 kernel simulation engine** with a reactive **Node.js / Socket.io IPC bridge** and a glassmorphic **React desktop GUI**.

Designed for computer science students, educators, and systems enthusiasts, MiniOS visualizes core operating system principles in real time: CPU scheduling algorithms, contiguous memory allocation, paging and virtual memory translation, hierarchical virtual file systems with binary disk block allocation, dual-mode terminal emulation, and multi-user sandboxing.

---

## 📑 Table of Contents

- [Key Features](#-key-features)
  - [1. Web Desktop Environment](#1-web-desktop-environment)
  - [2. CPU Scheduling Lab](#2-cpu-scheduling-lab)
  - [3. Memory Management & Paging](#3-memory-management--paging)
  - [4. Hierarchical Virtual File System (VFS)](#4-hierarchical-virtual-file-system-vfs)
  - [5. Dual-Mode Terminal (MINIOS Shell)](#5-dual-mode-terminal-minios-shell)
  - [6. Multi-Document Text Editor](#6-multi-document-text-editor)
  - [7. Local-First Multi-User Security](#7-local-first-multi-user-security)
- [System Architecture](#-system-architecture)
  - [Layered Architecture Overview](#layered-architecture-overview)
  - [System Component Flow](#system-component-flow)
  - [Virtual Memory Address Translation Flow](#virtual-memory-address-translation-flow)
- [OS Subsystem Specifications](#-os-subsystem-specifications)
  - [CPU Scheduling Algorithms](#cpu-scheduling-algorithms)
  - [Memory Allocation & Page Replacement](#memory-allocation--page-replacement)
  - [File System & Block Device](#file-system--block-device)
  - [Terminal Command Reference](#terminal-command-reference)
- [Project Directory Structure](#-project-directory-structure)
- [Prerequisites](#-prerequisites)
- [Installation & Quick Start](#-installation--quick-start)
  - [1. Clone the Repository](#1-clone-the-repository)
  - [2. Build the C++ Simulation Engine](#2-build-the-c-simulation-engine)
  - [3. Launch the Backend Server](#3-launch-the-backend-server)
  - [4. Launch the Frontend Desktop Client](#4-launch-the-frontend-desktop-client)
- [Testing & Automated Verification](#-testing--automated-verification)
- [API & IPC Protocol Reference](#-api--ipc-protocol-reference)
  - [REST Endpoints](#rest-endpoints)
  - [WebSocket Events](#websocket-events)
  - [Engine Stdio Protocol Commands](#engine-stdio-protocol-commands)
  - [VFS Serialization Specification (`MINIOS_VFS 1`)](#vfs-serialization-specification-minios_vfs-1)
- [Configuration & Environment Variables](#-configuration--environment-variables)
---

## ✨ Key Features

### 1. Web Desktop Environment
- **Glassmorphic Window Management**: Draggable, resizable, minimizable, and maximizable windows with dynamic z-index stacking and collision constraints.
- **System Top Bar**: Displays active application context, system clock, simulation tick counter, execution speed controls (100 ms to 2000 ms), battery/network status, and active user profile.
- **Dock & App Launcher**: Quick-launch dock featuring all 8 built-in system applications: Processes, CPU Scheduler, Terminal, Files, Text Editor, Memory & Paging, System Monitor, and Settings.
- **Customizable Appearance**: Dynamic wallpaper switching (abstract geometric, landscapes) and fine-tuned dark mode themes.

### 2. CPU Scheduling Lab
- **Real-Time Interactive Gantt Chart**: Color-coded, tick-by-tick timeline visualization of process execution across the CPU core.
- **Algorithm Comparison**: Instant switching between 6 scheduling policies — FCFS, SJF, SRTF, Priority, Round Robin, and the Completely Fair Scheduler (CFS) — with dynamic time quantum and CFS tuning parameters.
- **CFS Virtual Runtime Visualization**: Live minimum vruntime, per-process vruntime bars, weighted CPU shares, slice budget, and wake-up preemption counters streamed directly from the C++ engine.
- **Live Metrics Dashboard**: Engine-computed average Waiting Time ($T_w$), Turnaround Time ($T_{ta}$), Response Time, CPU Utilization, Context Switches, and per-process metrics.
- **Execution Controls**: Run continuous clock cycles, step forward by a single tick, pause execution, rewind the same workload to tick 0, or clear scheduling statistics.

### 3. Memory Management & Paging
- **Contiguous Allocation Visualizer**: Dynamic visual representation of RAM partitions (100 KB total default pool). Inspect allocated segments, process ownership, and free holes.
- **Dynamic Allocation Strategies**: Toggle between **First-Fit**, **Best-Fit**, and **Worst-Fit** strategies on the fly.
- **External Fragmentation Analysis & Compaction**: Real-time metrics on external fragmentation with a one-click memory compaction routine that coalesces free blocks.
- **Virtual Memory Paging Engine**:
  - Configurable page size (4 KB) across 64 physical frames (256 KB address space).
  - Page tables with valid/invalid bit states, physical frame mappings, and last-access timestamps.
  - Page replacement policies: **FIFO** (First-In, First-Out) and **LRU** (Least Recently Used).
  - Virtual address translation tester that computes logical page number, offset, physical frame, physical address, and triggers page fault resolution.

### 4. Hierarchical Virtual File System (VFS)
- **Directory Hierarchy**: True tree-structured directory system (`D0` root, `/home/<user>`, `Desktop`, `Documents`, `Downloads`, `Music`, `Pictures`, `Videos`).
- **Binary Block Device (`disk.img`)**: Real disk storage simulation with contiguous block allocation, 32 blocks $\times$ 512 bytes (expandable), and bad block/boundary detection.
- **Disk Compaction**: Defragments non-contiguous allocated blocks to free contiguous trailing disk space.
- **Three-Tier Snapshot Persistence**: In-memory C++ state is mirrored atomically to disk (`backend/data/vfs/<user>.json`) and client-side browser storage (IndexedDB).

### 5. Dual-Mode Terminal (MINIOS Shell)
- **UNIX Filesystem Command Engine**: Emulates standard shell utilities (`ls`, `cd`, `pwd`, `mkdir`, `rm`, `touch`, `cat`, `echo`, `printf`, `whoami`, `uname`, `history`, `clear`).
- **I/O Redirection**: Standard output redirection (`>` write, `>>` append) and ANSI escape sequence parsing.
- **OS Kernel Command Bridge**: Directly inspect and manage the OS kernel through the shell:
  - `ps`, `top`: Display active process control blocks.
  - `mem`, `free`: Summarize physical and virtual memory usage.
  - `spawn <name> [pri] [arr] [burst] [mem] [weight]`: Spawn a process into the kernel.
  - `kill <pid>`: Terminate an active process.
  - `step`, `run`, `pause`, `reset`: Control simulation clock cycles.

### 6. Multi-Document Text Editor
- **Tabbed Interface**: Multi-document editing with unsaved changes detection (dirty indicator `*`).
- **True Engine Persistence**: Reads from and writes to the simulated file system blocks via engine IPC commands.
- **Productivity Features**: Line numbering, cursor line/column indicators, word-wrap toggle, document text search, keyboard shortcuts (`Ctrl+S` save), and unsaved changes modal prompts.

### 7. Local-First Multi-User Security
- **Independent User Sandboxes**: Each user gets a dedicated home directory (`/home/<username>`) and an isolated virtual disk partition.
- **WebCrypto PBKDF2 Password Derivation**: Salted password hashing utilizing PBKDF2-SHA256 with 210,000 iterations and constant-time signature verification.
- **Crash Resilience**: Automatic rehydration of the last active user session upon server restart without requiring manual re-authentication.

---

## 🏗️ System Architecture

MiniOS is engineered as an end-to-end, decoupled three-tier system:
1. **Presentation Tier**: A reactive, glassmorphic desktop environment running in the browser (React 18, Vite, Tailwind CSS).
2. **Gateway & IPC Tier**: An asynchronous Node.js backend managing WebSocket multiplexing, kernel command interception, simulation clocks, and atomic durability.
3. **Kernel Engine Tier**: A compiled native C++20 core responsible for low-level process lifecycle management, CPU scheduling algorithms, contiguous memory partitioning, virtual memory paging, and binary disk block allocation.

---

### Layered Architecture Overview

```text
┌──────────────────────────────────────────────────────────────────────────────────┐
│                             PRESENTATION TIER (Browser)                          │
│  React 18 Desktop GUI • Window Manager • Process Dashboard • Scheduling Lab      │
│  Files Manager • Multi-Tab Text Editor • Terminal Sim • Memory & Paging Monitor  │
│  Auth (PBKDF2 WebCrypto) ─── Local Storage Mirror (IndexedDB)                    │
└────────────────────────────────────────┬─────────────────────────────────────────┘
                                         │ WebSockets (Socket.io) / REST API (:5000)
                                         ▼
┌──────────────────────────────────────────────────────────────────────────────────┐
│                            GATEWAY & IPC TIER (Node.js)                          │
│  Socket.io Hub ─── Kernel Command Bridge (ps, mem, spawn, kill, step, run)       │
│  Simulation Clock (100–2000ms) ─── JSON Stream Parser ─── Child Process Manager  |
│  Persistence Store ─── Atomic Disk Mirrors (`backend/data/vfs/<user>.json`)      │
└────────────────────────────────────────┬─────────────────────────────────────────┘
                                         │ Bi-Directional Line-Based Stdio (Base64)
                                         ▼
┌──────────────────────────────────────────────────────────────────────────────────┐
│                           KERNEL ENGINE TIER (C++20 Native)                      │
│  IPC Command Dispatcher (`main.cpp`)                                             │
│  ├─ Process Manager: PCB lifecycle (NEW, READY, RUNNING, BLOCKED, TERMINATED)    │
│  ├─ CPU Core & Schedulers: FCFS • SJF • SRTF • Priority • RR • CFS                  │
│  ├─ Memory Manager: First-Fit • Best-Fit • Worst-Fit • Memory Compaction         │
│  ├─ Paging Manager: 64 Frames • 4 KB Pages • FIFO & LRU Page Replacement Tables  │
│  └─ Virtual File System: Inode directory hierarchy • Contiguous block allocator  │
└────────────────────────────────────────┬─────────────────────────────────────────┘
                                         │ Low-Level Block I/O (512-Byte Sectors)
                                         ▼
┌──────────────────────────────────────────────────────────────────────────────────┐
│                           STORAGE TIER (Binary Disk Image)                       │
│  `backend/data/disk.img` (Contiguous raw sectors, bad-block guard, zero-padded)  │
└──────────────────────────────────────────────────────────────────────────────────┘
```

---

### System Component Flow

```text
┌───────────────────────────────────────────────────────────────────────────────────┐
│                           1. PRESENTATION TIER (Browser)                          │
│                                                                                   │
│   ┌──────────────────────────┐                  ┌──────────────────────────────┐  │
│   │ Desktop Window Manager   │ ───────────────► │ 8 Built-in Operating Apps    │  │
│   │ (Z-Index, Drag, Resize)  │                  │ (Terminal, Files, Sched...)  │  │
│   └────────────┬─────────────┘                  └──────────────┬───────────────┘  │
│                │                                               │                  │
│                ▼                                               ▼                  │
│   ┌──────────────────────────┐                  ┌──────────────────────────────┐  │
│   │ PBKDF2 Password Hashing  │ ───────────────► │ IndexedDB Offline Mirror     │  │
│   │ (210,000 Iterations)     │                  │ (Cached Accounts & VFS Trees)│  │
│   └──────────────────────────┘                  └──────────────────────────────┘  │
└────────────────────────────────────────┬──────────────────────────────────────────┘
                                         │  HTTP REST (/api/*) & WebSockets
                                         ▼
┌───────────────────────────────────────────────────────────────────────────────────┐
│                        2. GATEWAY & IPC TIER (Node.js Express)                    │
│                                                                                   │
│   ┌──────────────────────────┐                  ┌──────────────────────────────┐  │
│   │ Socket.io Event Gateway  │ ───────────────► │ Kernel Shell Bridge          │  │
│   │ (Connection Hub :5000)   │                  │ (ps, top, spawn, kill, mem)  │  │
│   └────────────┬─────────────┘                  └──────────────┬───────────────┘  │
│                │                                               │                  │
│                ▼                                               ▼                  │
│   ┌──────────────────────────┐                  ┌──────────────────────────────┐  │
│   │ JSON Stream Parser       │                  │ Child Process Supervisor     │  │
│   │ (Buffer & Boundary Guard)│ ◄─────────────── │ (Auto-restart, Stdio piping) │  │
│   └──────────────────────────┘                  └──────────────┬───────────────┘  │
│                                                                │                  │
│                                                                ▼                  │
│                                                 ┌──────────────────────────────┐  │
│                                                 │ Server Persistence Store     │  │
│                                                 │ (Atomic JSON: data/vfs/)     │  │
│                                                 └──────────────────────────────┘  │
└────────────────────────────────────────┬──────────────────────────────────────────┘
                                         │  Standard Input/Output (Base64 Encodings)
                                         ▼
┌───────────────────────────────────────────────────────────────────────────────────┐
│                         3. NATIVE ENGINE TIER (C++20 Core)                        │
│                                                                                   │
│   ┌───────────────────────────────────────────────────────────────────────────┐   │
│   │               IPC Command Dispatcher & Shell Loop (main.cpp)              │   │
│   └──────┬───────────────┬───────────────────┬───────────────────┬────────────┘   │
│          │               │                   │                   │                │
│          ▼               ▼                   ▼                   ▼                │
│   ┌─────────────┐ ┌─────────────┐     ┌─────────────┐     ┌─────────────┐         │
│   │ CPU Core &  │ │ Memory Mgr  │     │ Virtual     │     │ Virtual     │         │
│   │ Schedulers  │ │ (First/Best/│     │ Paging Mgr  │     │ File System │         │
│   │(FCFS, CFS..)│ │ Worst-Fit)  │     │ (FIFO, LRU) │     │ (Inodes/Dir)│         │
│   └─────────────┘ └─────────────┘     └─────────────┘     └──────┬──────┘         │
└──────────────────────────────────────────────────────────────────┼────────────────┘
                                                                   │ 512-Byte Sectors
                                                                   ▼
┌───────────────────────────────────────────────────────────────────────────────────┐
│                         4. PERSISTENT BLOCK DEVICE TIER                           │
│                                                                                   │
│   ┌───────────────────────────────────────────────────────────────────────────┐   │
│   │  Binary Disk Image (backend/data/disk.img)                                │   │
│   │  [Sector 0: Root] [Sector 1..N: Contiguous File Data Blocks]              │   │
│   └───────────────────────────────────────────────────────────────────────────┘   │
└───────────────────────────────────────────────────────────────────────────────────┘
```

---

### Virtual Memory Address Translation Flow

```text
                     ┌────────────────────────────────┐
                     │   Incoming Logical Address     │
                     │         (e.g., 0x002A)         │
                     └───────────────┬────────────────┘
                                     │
                                     ▼
                     ┌────────────────────────────────┐
                     │     Virtual Address Split      │
                     │       (Page Size: 4 KB)        │
                     └───────┬────────────────┬───────┘
                             │                │
                Page Number  │                │  Byte Offset
                             ▼                │
                     ┌────────────────┐       │
                     │   Page Table   │       │
                     │     Lookup     │       │
                     └───────┬────────┘       │
                             │                │
                             ▼                │
                   /───────────────────\      │
                  <   Is Page Valid?    >     │
                   \───────────────────/      │
                    /                 \       │
            YES    /                   \  NO  │
       (Page Hit) /                     \ (Page Fault)
                 ▼                       ▼
      ┌────────────────────┐   ┌─────────────────────────────┐
      │ Fetch Frame Number │   │ Trigger Page Fault Handler  │
      │ from Page Table    │   └──────────────┬──────────────┘
      └──────────┬─────────┘                  │
                 │                            ▼
                 │                  /───────────────────\
                 │                 < Free Frame in RAM?  >
                 │                  \───────────────────/
                 │                   /                 \
                 │           YES    /                   \  NO
                 │                 ▼                     ▼
                 │      ┌─────────────────────┐ ┌─────────────────────┐
                 │      │ Assign Free Frame   │ │ Evict Victim Frame  │
                 │      │ to Process Page     │ │ (FIFO / LRU Policy) │
                 │      └──────────┬──────────┘ └──────────┬──────────┘
                 │                 │                       │
                 │                 ▼                       ▼
                 │      ┌─────────────────────────────────────┐
                 │      │ Update Page Table (Valid = true)    │
                 │      │ Set Timestamp & Map Physical Frame  │
                 │      └──────────────────┬──────────────────┘
                 │                         │
                 └───────────────┬─────────┘
                                 │ Frame Number
                                 ▼
                     ┌────────────────────────────────┐
                     │   Physical Address Assembler   │
                     │  (Frame × PageSize) + Offset   │
                     └───────────────┬────────────────┘
                                     │
                                     ▼
                     ┌────────────────────────────────┐
                     │  Resolved Physical RAM Address │
                     │   & Dashboard Telemetry Emit   │
                     └────────────────────────────────┘
```

---

## ⚙️ OS Subsystem Specifications

### CPU Scheduling Algorithms

| Algorithm | Selection Criterion | Dynamic Configuration | Primary Metric / Characteristic |
| :--- | :--- | :--- | :--- |
| **FCFS** | Smallest Arrival Time ($T_{arr}$) | None | Eliminates starvation; vulnerable to convoy effect. |
| **SJF** | Shortest Burst Time ($T_{burst}$) | None | Minimizes average waiting time; non-preemptive. |
| **SRTF** | Shortest Remaining Time ($T_{rem}$) | None | Preempts when shorter jobs arrive; minimal latency. |
| **Priority** | Lowest Priority Number (1 = highest) | Priority levels | Strict priority ordering. |
| **Round Robin (RR)** | FCFS Ready Queue with Quantum Slice | Time Quantum ($q \ge 1$) | Fair CPU sharing; responsive for interactive loads. |
| **CFS** | Smallest Virtual Runtime ($vruntime$) | Target Latency, Min Granularity, Process Weight | Weighted fair CPU sharing; new tasks join at the current minimum vruntime. |

#### Completely Fair Scheduler (CFS) Model
- Every PCB carries `vruntime`, `weight`, `firstRunTime`, `completionTime`, and accumulated CPU time.
- Executing one tick adds `delta_vruntime = executed_ticks × base_weight / process_weight` (default `base_weight = 10`).
- The scheduler always runs the runnable process with the smallest vruntime; newly arrived processes inherit the current minimum vruntime.
- Time slices are weighted by the runnable set: `slice = target_latency × weight / total_runnable_weight`, clamped by `min_granularity` and the remaining burst.
- A newly arrived process preempts the current one when its vruntime is at least `min_granularity` below the current process's vruntime.
- The engine publishes `cfs` telemetry (runnable count, minimum vruntime, current slice/remaining budget, preemptions, last decision) plus `readyQueue`, `timeline`, `events`, and `metrics`.

### Memory Allocation & Page Replacement

#### Contiguous Memory Allocation
- **First-Fit**: Scans memory from address `0` and allocates the first contiguous free block large enough.
- **Best-Fit**: Scans all free blocks and selects the smallest hole that satisfies the request, minimizing wasted partition space.
- **Worst-Fit**: Allocates the largest available free block, leaving behind the largest possible residual hole.
- **Compaction**: Shifts all allocated partitions toward low memory addresses, coalescing all distributed free fragments into a single contiguous pool at high memory.

#### Virtual Memory Paging
- **Address Space**: 256 KB Virtual Memory, 64 Physical Frames of 4 KB each.
- **FIFO Replacement**: Evicts the oldest loaded frame utilizing a First-In, First-Out frame queue.
- **LRU Replacement**: Evicts the frame with the oldest access timestamp ($T_{access}$) upon page fault.

### File System & Block Device

- **Allocation Strategy**: Contiguous file block allocation with automatic block boundary verification.
- **Block Layout**:
  - Total Blocks: 32 (default configurable).
  - Block Size: 512 Bytes.
  - Total Disk Capacity: 16 KB default virtual partition (`data/disk.img`).
- **Structural Catalog**:
  - Inodes/Directory entries: Each folder has a unique `dirId` (`D0` root, `D1`, `D2`, etc.) and a reference to its `parentDirId`.
  - File table entries: Each file has a `fileId` (`F1`, `F2`), `dirId`, `ownerPID`, `sizeInBlocks`, and `content`.
  - Open File Table: Tracks open file descriptors, holding PID and open tick.

### Terminal Command Reference

The terminal supports both UNIX-like filesystem verbs and OS kernel verbs:

#### Filesystem & Shell Commands
| Command | Description | Syntax / Example |
| :--- | :--- | :--- |
| `ls` | List contents of current or specified directory | `ls`, `ls -a`, `ls Documents` |
| `cd` | Change current working directory | `cd ..`, `cd ~/Desktop`, `cd /home` |
| `pwd` | Print current working directory path | `pwd` |
| `mkdir` | Create one or more new directories | `mkdir my_folder` |
| `rm` | Remove files or empty/recursive directories | `rm note.txt`, `rm -r old_dir` |
| `touch` | Create an empty file or update timestamp | `touch project.txt` |
| `cat` | Display file contents | `cat project.txt` |
| `echo` | Print text or redirect into a file | `echo "Hello OS" > note.txt` |
| `printf` | Formatted output with escape characters | `printf "Line 1\nLine 2" >> log.txt` |
| `whoami` | Display active logged-in user | `whoami` |
| `uname` | Print operating system and architecture info | `uname -a` |
| `date` | Display current simulated system time | `date` |
| `history` | List command history | `history` |
| `clear` | Clear terminal scrollback buffer | `clear` |
| `help` | Display shell help catalog | `help` |

#### Kernel & Simulation Commands
| Command | Description | Syntax / Example |
| :--- | :--- | :--- |
| `ps` / `top` | Display process table with PID, priority, burst, and memory | `ps` |
| `mem` / `free` | Display total, used, free memory and external fragmentation | `mem` |
| `spawn` | Spawn a new process into the kernel | `spawn worker 2 0 6 15 10` |
| `kill` | Send a kill signal to terminate a process by PID | `kill 0P1` |
| `step` / `tick` | Advance the simulation by exactly one clock cycle | `step` |
| `run` | Start continuous auto-stepping clock | `run 500` *(interval in ms)* |
| `pause` | Pause continuous auto-stepping clock | `pause` |
| `reset` | Reset simulation state back to tick 0 | `reset` |

---

## 📁 Project Directory Structure

```text
MiniOS-Simulator/
├── backend/                        # Node.js Express & Socket.io server
│   ├── .env                        # Server configuration (PORT, FRONTEND_URL)
│   ├── package.json                # Backend dependencies and build scripts
│   ├── data/                       # Local persistent data (gitignored)
│   │   ├── active-user.json        # Last authenticated session cache
│   │   ├── disk.img                # Binary backing store for FileSystem
│   │   └── vfs/                    # Per-user VFS snapshots
│   │       └── <user>.json         # Versioned MINIOS_VFS snapshots
│   └── src/
│       ├── index.js                # Server entry point & Socket.io listener
│       ├── config/
│       │   └── paths.js            # Path resolution for engine binaries
│       ├── engine/
│       │   ├── processManager.js   # Spawns & monitors C++ child process
│       │   ├── shellBridge.js      # Intercepts kernel commands (ps, spawn, etc.)
│       │   └── streamParser.js     # Incremental JSON stream parser
│       ├── routes/
│       │   ├── healthRoutes.js     # GET /api/health
│       │   └── simulationRoutes.js # REST routes (/state, /step, /engine/*)
│       ├── sockets/
│       │   ├── simulationClock.js  # Configurable timer for auto-step
│       │   └── socketHandler.js    # Socket.io event registry
│       └── storage/
│           └── vfsStore.js         # Atomic file persistence engine
├── engine/                         # Core C++20 Simulation Engine
│   ├── CMakeLists.txt              # CMake build configuration
│   ├── include/                    # Header declarations
│   │   ├── AllocationStrategy.h    # Memory allocation strategy interface
│   │   ├── BestFit.h               # Best-Fit memory strategy
│   │   ├── CFSScheduler.h          # Completely Fair Scheduler (vruntime)
│   │   ├── CommandPrompt.h         # Terminal shell parser & command executor
│   │   ├── ContiguousAllocation.h  # File contiguous allocation strategy
│   │   ├── CPU.h                   # CPU execution unit
│   │   ├── Directory.h             # Directory inode entity
│   │   ├── DiskStorage.h           # Low-level binary block file interface
│   │   ├── FCFSScheduler.h         # First-Come First-Served scheduler
│   │   ├── File.h                  # File inode entity
│   │   ├── FileAllocationStrategy.h# File allocation interface
│   │   ├── FileBlock.h             # Physical disk block abstraction
│   │   ├── FileSystem.h            # VFS implementation & snapshot serializer
│   │   ├── FirstFit.h              # First-Fit memory strategy
│   │   ├── Kernel.h                # Kernel coordination layer
│   │   ├── MemoryBlock.h           # Contiguous memory block abstraction
│   │   ├── MemoryManager.h         # Dynamic memory partition manager
│   │   ├── PagingManager.h         # Virtual memory & page table manager
│   │   ├── PriorityScheduler.h     # Non-preemptive priority scheduler
│   │   ├── Process.h               # Process Control Block (PCB)
│   │   ├── ProcessManager.h        # Process lifecycle & table manager
│   │   ├── RoundRobinScheduler.h   # Round Robin scheduler
│   │   ├── Scheduler.h             # CPU scheduler interface
│   │   ├── SerializationUtils.h    # Base64 & JSON escape utilities
│   │   ├── SimulationEngine.h      # Master engine orchestrator & telemetry
│   │   ├── SJFScheduler.h          # Shortest Job First scheduler
│   │   ├── SRTFScheduler.h         # Shortest Remaining Time First scheduler
│   │   └── WorstFit.h              # Worst-Fit memory strategy
│   └── src/                        # C++ Implementation source files
│       ├── main.cpp                # Engine entry point & stdio IPC loop
│       └── ...                     # Subsystem implementations
├── frontend/                       # React 18 + Vite Web Application
│   ├── package.json                # Frontend dependencies
│   ├── vite.config.js              # Vite configuration
│   ├── tailwind.config.js          # Tailwind CSS styling configuration
│   ├── public/                     # Static wallpapers & background assets
│   ├── scripts/
│   │   └── verify-backend.mjs      # 11-phase automated end-to-end test suite
│   └── src/
│       ├── App.jsx                 # Desktop UI, window manager, docking system
│       ├── index.css               # Core styling & glassmorphism utilities
│       ├── main.jsx                # React root bootstrap
│       ├── components/
│       │   ├── AuthScreen.jsx      # Login & Registration authentication modal
│       │   ├── TextEditor.jsx      # Multi-tab notepad editor component
│       │   └── UnsavedChangesDialog.jsx # Dirty state confirmation dialog
│       └── lib/
│           ├── accountStore.js     # Account directory backed by IndexedDB
│           ├── auth.js             # PBKDF2 WebCrypto password derivation
│           ├── idb.js              # IndexedDB async helper library
│           ├── socket.js           # Client Socket.io connection manager
│           ├── user.js             # Username sanitization utilities
│           └── vfsStore.js         # Browser-side snapshot storage
└── README.md                       # Master Documentation
```

---

## 📋 Prerequisites

Ensure your system meets the following software requirements:

- **C++ Compiler**: GCC 11+, Clang 13+, or MSVC 2019+ with full **C++20** support.
- **Build System**: [CMake 3.20](https://cmake.org/download/) or higher.
- **Node.js**: [Node.js 18.0.0](https://nodejs.org/) LTS or higher.
- **Package Manager**: `npm` 9+ (bundled with Node.js).
- **Operating System**: Windows 10/11, macOS 11+, or Linux (Ubuntu 20.04+, Debian 11+, Fedora 36+).

---

## Installation & Quick Start

### 1. Clone the Repository
```bash
git clone https://github.com/OOP-Team-1/MiniOS-Simulator.git
cd MiniOS-Simulator
```

### 2. Build the C++ Simulation Engine

#### On Linux / macOS:
```bash
cd engine
cmake -B build -DCMAKE_BUILD_TYPE=Release
cmake --build build --config Release
cd ..
```

#### On Windows (PowerShell / Command Prompt with MSVC or MinGW):
```powershell
cd engine
cmake -B build
cmake --build build --config Release
cd ..
```
*Note: The backend will automatically attempt to compile the engine if the executable is not found during `npm start`.*

### 3. Launch the Backend Server

```bash
cd backend
npm install
npm start
```
The server will start on port `5000` (or `PORT` specified in `backend/.env`). You should see:
```text
===========================================
Backend server successfully running on port 5000
Health Check: http://localhost:5000/api/health
===========================================
```

### 4. Launch the Frontend Desktop Client

In a separate terminal window:
```bash
cd frontend
npm install
npm run dev
```

Open your browser and navigate to:
```text
http://localhost:5173
```
Create a new user account (e.g., `admin`) and password, and you are ready to explore the MiniOS desktop!

---

## Testing & Automated Verification

MiniOS includes a comprehensive end-to-end verification harness located at [`verify-backend.mjs`](frontend/scripts/verify-backend.mjs). It boots an isolated backend and native engine, drives socket transactions, and tests 10 critical phases:

```bash
npm run verify:backend --prefix frontend
```

### Test Coverage Highlights:
1. **Engine Telemetry**: Validates live JSON streaming over standard out.
2. **User Creation**: Confirms initialization of user home directories (`Desktop`, `Documents`, etc.).
3. **Shell Execution**: Validates `mkdir`, `echo > file`, `cat`, and path resolution through `CommandPrompt`.
4. **Kernel Bridge**: Verifies `spawn`, `ps`, and `mem` commands against real engine PCBs.
5. **VFS Persistence**: Confirms reloading an account hydrates existing files.
6. **Deletion Durability**: Verifies deleted default directories are not resurrected upon session reload.
7. **Text Editor Round-Trip**: Verifies `FILE_CONTENT` read and `FILE_SAVE` write operations.
8. **Atomic Server Mirroring**: Confirms files are physically saved on disk as valid `MINIOS_VFS 1` files.
9. **CFS Scheduling Engine**: Verifies weighted 1:2 CPU shares, weighted vruntime accumulation, minimum-vruntime telemetry, wake-up preemption on arrival, engine-generated timelines, run rewind, and completion metrics.
10. **Process Crash & Restart Resilience**: Kills the backend completely, restarts it, and asserts zero data loss.
11. **Zero-Login Boot Restoration**: Verifies the engine automatically restores the last active user tree.

---

## 🔌 API & IPC Protocol Reference

### REST Endpoints

| Method | Endpoint | Description | Sample Response |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/health` | Backend status check | `{"status":"UP","message":"MiniOS Simulator Backend is running."}` |
| `GET` | `/api/state` | Returns latest telemetry JSON snapshot | `{"tick":12,"cpu":{...},"processes":[...],"memory":{...}}` |
| `POST` | `/api/step` | Advances the simulation clock by 1 tick | `{"status":"OK","message":"Step command dispatched"}` |
| `POST` | `/api/engine/start` | Boots or reboots the C++ engine process | `{"status":"OK","message":"Engine started"}` |
| `POST` | `/api/engine/stop` | Terminates the running C++ engine process | `{"status":"OK","message":"Engine stopped"}` |

### WebSocket Events

#### Client to Server (`socket.emit`)
| Event Name | Payload Structure | Subsystem Target |
| :--- | :--- | :--- |
| `vfs:load` | `{ user: string, snapshot?: string }` | VFS account hydration |
| `shell:exec` | `{ command: string }` | Terminal shell or kernel bridge |
| `cmd:step` | *None* | Simulation clock |
| `cmd:set_scheduler`| `{ type: 'FCFS'\|'SJF'\|'SRTF'\|'PRIORITY'\|'RR'\|'CFS', quantum?: number, targetLatency?: number, minGranularity?: number }` | CPU Scheduler |
| `cmd:set_alloc` | `{ type: 'FirstFit'\|'BestFit'\|'WorstFit' }` | Dynamic Memory Manager |
| `cmd:set_page_policy` | `{ policy: 'FIFO'\|'LRU' }` | Paging Manager |
| `cmd:access_mem` | `{ pid: string, logicalAddress: number }` | MMU address translation |
| `cmd:add_process`| `{ name, priority, arrival, burst, memory, weight? }` | Process Manager |
| `cmd:kill_process`| `{ pid: string }` | Process Manager |
| `cmd:reset_stats` | *None* | Clears timeline/metrics/vruntime, keeps the process table |
| `cmd:restart_run` | *None* | Rewinds the current workload to tick 0 |
| `cmd:compact` | *None* | Memory Compactor |
| `cmd:disk_compact`| *None* | Disk Compactor |
| `cmd:file_save` | `{ requestId: string, fileId: string, content: string }` | File System / Text Editor |
| `cmd:file_content`| `{ fileId: string }` | File System / Text Editor |
| `timer:start` | `{ intervalMs: number }` | Auto-step clock |
| `timer:pause` | *None* | Auto-step clock |

#### Server to Client (`socket.on`)
| Event Name | Payload Description |
| :--- | :--- |
| `telemetry:update` | Full JSON state: active CPU PID, ready queues, memory blocks, page tables, disk map, and logs. |
| `shell:result` | Output, return path, updated prompt, and directory ID for terminal commands. |
| `vfs:snapshot` | Serialized `MINIOS_VFS 1` tree exported whenever the filesystem mutates. |
| `file:read_result` | Decoded file content requested by the text editor. |
| `file:save_result` | Acknowledgment of file write completion (`{ requestId, fileId, ok }`). |
| `engine:command_error` | Error message returned when a command parameters fail validation inside C++. |
| `engine:restarted` | Emitted when an engine crash is detected and the process is respawned. |

### Engine Stdio Protocol Commands

The C++ engine listens on `stdin` for commands formatted as:
```text
<COMMAND> [arg1] [arg2] ...\n
```
All multi-line strings, arbitrary file contents, and shell command strings are **Base64-encoded** before transmission to maintain newline safety:

```text
STEP                                   # Step clock 1 tick
STATE                                  # Request immediate telemetry output
ADD <name> <prio> <arr> <burst> <mem> [weight]  # Spawn process
KILL <pid>                             # Kill process
SET_SCHEDULER <type> [quantum]         # Set scheduler (FCFS, SJF, SRTF, PRIORITY, RR)
SET_SCHEDULER CFS <latency> <gran>     # Set CFS target latency and min granularity
SET_ALLOC <strategy>                   # Set memory allocator (FirstFit, BestFit, WorstFit)
SET_PAGE_POLICY <policy>               # Set page replacement (FIFO, LRU)
ACCESS_MEM <pid> <logicalAddress>      # Test address translation
DIR_CREATE <name> [parentDirId]        # Create directory
DIR_DELETE <dirId>                     # Delete directory
FILE_CREATE <pid> <name> <blocks> [d]  # Create file in directory
FILE_SAVE <reqId> <fileId> <b64data>   # Save file contents
FILE_CONTENT <fileId>                  # Read file contents for editor
FS_LOAD <user> <b64snapshot|->         # Load or initialize filesystem snapshot
SHELL <b64command>                     # Execute shell command
RESET_STATS                            # Clear timeline/metrics/vruntime (keep processes)
RESTART_RUN                            # Rewind the process table to tick 0
COMPACT                                # Compact RAM blocks
DISK_COMPACT                           # Compact disk blocks
EXIT                                   # Gracefully terminate engine
```

---

## ⚙️ Configuration & Environment Variables

### Backend Configuration (`backend/.env`)

| Variable | Type | Default | Description |
| :--- | :---: | :---: | :--- |
| `PORT` | Number | `5000` | Port for the Express server and Socket.io gateway |
| `FRONTEND_URL` | String | `http://localhost:5173` | Allowed CORS origin for WebSocket and REST requests |
| `MINIOS_DATA_DIR` | Path | `backend/data` | Optional override for the root directory of VFS and disk storage |

---
