#pragma once

#include <string>
#include <vector>

#include "ProcessManager.h"
#include "CPU.h"
#include "Scheduler.h"
#include "MemoryManager.h"
#include "FileSystem.h"
#include "PagingManager.h"

enum class MemoryMode
{
    CONTIGUOUS,
    PAGING
};

class Kernel
{
private:
    ProcessManager processManager;
    CPU cpu;

    Scheduler& scheduler;

    MemoryManager& memoryManager;
    FileSystem& fileSystem;
    PagingManager& pagingManager;

    MemoryMode memoryMode;

    int currentTime;
    bool running;

private:
    void updateArrivals();

    bool hasReadyProcess() const;

    bool hasFutureProcess() const;

    int getNextArrivalTime() const;

    bool allocateProcessMemory(Process& process);

    void releaseProcessResources(Process& process);

    std::vector<Process*> getReadyProcesses() const;

public:
    Kernel(
        Scheduler& scheduler,
        MemoryManager& memoryManager,
        FileSystem& fileSystem,
        PagingManager& pagingManager,
        MemoryMode memoryMode = MemoryMode::CONTIGUOUS
    );

    // Process management
    Process& createProcess(
        const std::string& name,
        int priority,
        int arrivalTime,
        int burstTime,
        int memoryRequired
    );

    bool terminateProcess(const std::string& PID);

    // CPU / scheduling
    bool runStep();

    void run();

    // Memory mode
    bool setMemoryMode(MemoryMode mode);

    MemoryMode getMemoryMode() const;

    // Kernel state
    int getCurrentTime() const;

    bool isRunning() const;

    Process* getCurrentProcess();

    const Process* getCurrentProcess() const;

    // Access to process table
    ProcessManager& getProcessManager();

    const ProcessManager& getProcessManager() const;
};