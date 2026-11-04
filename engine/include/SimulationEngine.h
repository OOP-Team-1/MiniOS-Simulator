#pragma once

#include <vector>
#include <string>
#include <memory>
#include <deque>
#include <map>

#include "ProcessManager.h"
#include "CPU.h"
#include "Scheduler.h"
#include "MemoryManager.h"
#include "PagingManager.h"
#include "FileSystem.h"

// One contiguous burst of CPU execution by a single process. Consecutive
// one-tick steps for the same PID are merged so the frontend receives a real
// Gantt chart instead of one slice per tick.
struct ExecutionSlice
{
    std::string pid;
    std::string name;
    int start;
    int end;
    int duration;
};

// A scheduling event produced by the engine. Events are the source of truth
// for the UI's "scheduling decisions" log; the frontend never derives them
// from a JavaScript simulation.
struct SimulationEvent
{
    long long seq;
    int tick;
    std::string type;
    std::string pid;
    std::string message;
};

class SimulationEngine
{
private:
    ProcessManager processManager;
    CPU cpu;
    Scheduler* scheduler;
    MemoryManager* memoryManager;
    PagingManager* pagingManager;
    FileSystem* fileSystem;

    int currentTick;
    std::string lastExecutedPID;
    std::deque<std::string> systemLogs;

    std::string schedulerName;
    int schedulerQuantum;
    std::string allocName;

    // Scheduling telemetry (shared by all algorithms where applicable)
    std::vector<ExecutionSlice> timeline;
    std::vector<SimulationEvent> tickEvents;
    std::vector<std::string> lastReadyQueue;
    std::map<std::string, std::string> lastProcessStates;
    std::string lastDispatchPID;
    long long eventSequence;
    int contextSwitches;
    int busyTicks;
    int idleTicks;
    std::string lastDispatchReason;

    void log(const std::string& message);
    void checkPendingProcesses();

    void recordEvent(const std::string& type, const std::string& pid, const std::string& message);
    void recordStateChanges();
    void recordReadyQueueChange();
    void resetSchedulingTelemetry();

    std::string metricsJson() const;
    std::string timelineJson() const;
    std::string eventsJson() const;
    std::string readyQueueJson() const;

public:
    SimulationEngine(
        MemoryManager& memManager,
        PagingManager& pagingManager,
        FileSystem& fileSystem,
        Scheduler& cpuScheduler
    );

    SimulationEngine(
        MemoryManager& memManager,
        FileSystem& fileSystem,
        Scheduler& cpuScheduler
    );

    Process& addProcess(
        const std::string& name,
        int priority,
        int arrivalTime,
        int burstTime,
        int memoryRequired,
        int weight = 10
    );

    // Directory operations — called by main.cpp command handler
    std::string createDirectory(const std::string& name, const std::string& parentDirId);
    bool deleteDirectory(const std::string& dirId);
    bool renameDirectory(const std::string& dirId, const std::string& newName);
    bool moveDirectory(const std::string& dirId, const std::string& newParentDirId);

    // File operations — called by main.cpp command handler
    std::string createFile(const std::string& ownerPID,
                           const std::string& name,
                           int sizeInBlocks,
                           const std::string& dirId = "");

    bool deleteFile(const std::string& fileId);
    bool openFile(const std::string& fileId, const std::string& byPID);
    bool closeFile(const std::string& fileId, const std::string& byPID);
    bool moveFile(const std::string& fileId, const std::string& newDirId);

    // Content I/O
    // ok is set to false if the read failed (not found / not open / wrong owner)
    std::string readFile(const std::string& fileId, const std::string& byPID, bool& ok);
    bool writeFile(const std::string& fileId, const std::string& byPID, const std::string& content);
    bool appendFile(const std::string& fileId, const std::string& byPID, const std::string& content);

    void setScheduler(Scheduler& newScheduler);
    void setMemoryManager(MemoryManager& newMemoryManager);
    void setPagingManager(PagingManager& newPagingManager);
    AddressTranslationResult accessMemory(const std::string& pid, int logicalAddress);

    // Advances simulation by exactly one tick
    bool step();

    // Runs until all created processes reach TERMINATED
    void run();

    void reset();

    // Clears timeline/metrics/vruntime without deleting the process table.
    // Used when the user starts a fresh scheduling run.
    void resetStatistics();

    // Rewinds the whole simulation to tick 0 while keeping the process table.
    // Every process gets its full burst back and is re-admitted through the
    // normal arrival/memory path, so the same workload can be compared across
    // scheduling algorithms.
    void restartRun();

    bool killProcess(const std::string& pid);

    // Terminates the process (if needed), releases its resources, and removes
    // its PCB from the process table.
    bool removeProcess(const std::string& pid);

    void compactDisk();
    void compactMemory();

    bool renameFile(const std::string& fileId, const std::string& newName);

    void setCurrentSchedulerName(const std::string& name, int quantum);
    void setCurrentAllocName(const std::string& name);

    int getCurrentTick() const;
    std::string getTelemetryJson() const;
};
