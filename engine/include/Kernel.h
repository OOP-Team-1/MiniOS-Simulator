#pragma once

#include <memory>
#include <string>
#include <vector>

#include "ProcessManager.h"
#include "CPU.h"
#include "Scheduler.h"
#include "MemoryManager.h"
#include "FileSystem.h"
#include "PagingManager.h"
#include "CommandPrompt.h"

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

    // The terminal is created only when first used, so constructing the
    // Kernel alone does not populate the file system with demo terminal files.
    std::string terminalUsername;
    std::string terminalHostname;
    std::unique_ptr<CommandPrompt> commandPrompt;

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
        MemoryMode memoryMode = MemoryMode::CONTIGUOUS,
        const std::string& terminalUser = "nitw",
        const std::string& terminalHost = "minios"
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

    // Kernel-integrated terminal. Route terminal input through this method
    // so process commands (ps, spawn, kill, top, time) reach the Kernel.
    std::string executeTerminalCommand(const std::string& command);

    // Provides access to terminal metadata (prompt, path, username, history).
    // The terminal instance is initialized on first access.
    CommandPrompt& getCommandPrompt();

    // Kernel state
    int getCurrentTime() const;

    bool isRunning() const;

    Process* getCurrentProcess();

    const Process* getCurrentProcess() const;

    // Access to process table
    ProcessManager& getProcessManager();

    const ProcessManager& getProcessManager() const;
};
