#pragma once

#include <vector>
#include <string>
#include <memory>
#include <deque>

#include "ProcessManager.h"
#include "CPU.h"
#include "Scheduler.h"
#include "MemoryManager.h"
#include "FileSystem.h"

class SimulationEngine
{
private:
    ProcessManager processManager;
    CPU cpu;
    Scheduler* scheduler;
    MemoryManager* memoryManager;
    FileSystem* fileSystem;

    int currentTick;
    std::string lastExecutedPID;
    std::deque<std::string> systemLogs;

    std::string schedulerName;
    int schedulerQuantum;
    std::string allocName;

    void log(const std::string& message);
    void checkPendingProcesses();

public:
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
        int memoryRequired
    );

    // File operations — called by main.cpp command handler
    std::string createFile(const std::string& ownerPID,
                           const std::string& name,
                           int sizeInBlocks,
                           const std::string& dirPath = "/");

    bool deleteFile(const std::string& fileId);
    bool openFile(const std::string& fileId, const std::string& byPID);
    bool closeFile(const std::string& fileId, const std::string& byPID);

    void setScheduler(Scheduler& newScheduler);
    void setMemoryManager(MemoryManager& newMemoryManager);

    // Advances simulation by exactly one tick
    bool step();

    // Runs until all created processes reach TERMINATED
    void run();

    void reset();

    void compactDisk();

    bool renameFile(const std::string& fileId, const std::string& newName);

    void setCurrentSchedulerName(const std::string& name, int quantum);
    void setCurrentAllocName(const std::string& name);
    
    int getCurrentTick() const;
    std::string getTelemetryJson() const;
};