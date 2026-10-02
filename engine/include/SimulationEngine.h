#pragma once

#include <vector>
#include <string>
#include <memory>

#include "ProcessManager.h"
#include "CPU.h"
#include "Scheduler.h"
#include "MemoryManager.h"

class SimulationEngine
{
private:
    ProcessManager processManager;
    CPU cpu;
    Scheduler* scheduler;
    MemoryManager* memoryManager;

    int currentTick;
    std::string lastExecutedPID;
    std::vector<std::string> systemLogs;

    void log(const std::string& message);
    void checkPendingProcesses();

public:
    SimulationEngine(
        MemoryManager& memManager,
        Scheduler& cpuScheduler
    );

    Process& addProcess(
        const std::string& name,
        int priority,
        int arrivalTime,
        int burstTime,
        int memoryRequired
    );

    void setScheduler(Scheduler& newScheduler);
    void setMemoryManager(MemoryManager& newMemoryManager);

    // Advances simulation by exactly one tick
    bool step();

    // Runs until all created processes reach TERMINATED
    void run();

    void reset();

    int getCurrentTick() const;
    std::string getTelemetryJson() const;
};