#include "../include/SimulationEngine.h"

#include <iostream>
#include <sstream>

SimulationEngine::SimulationEngine(
    MemoryManager& memManager,
    Scheduler& cpuScheduler
) : scheduler(&cpuScheduler),
    memoryManager(&memManager),
    currentTick(0),
    lastExecutedPID("NONE")
{
}

void SimulationEngine::log(const std::string& message)
{
    std::string entry = "[Tick " + std::to_string(currentTick) + "] " + message;
    systemLogs.push_back(entry);
}

Process& SimulationEngine::addProcess(
    const std::string& name,
    int priority,
    int arrivalTime,
    int burstTime,
    int memoryRequired
)
{
    return processManager.createProcess(
        name,
        priority,
        arrivalTime,
        burstTime,
        memoryRequired
    );
}

void SimulationEngine::setScheduler(Scheduler& newScheduler)
{
    this->scheduler = &newScheduler;
}

void SimulationEngine::setMemoryManager(MemoryManager& newMemoryManager)
{
    this->memoryManager = &newMemoryManager;
}

void SimulationEngine::checkPendingProcesses()
{
    for (auto* process : processManager.getAllProcesses())
    {
        // Check processes that arrived but lack RAM or haven't been admitted
        if (process->getArrivalTime() <= currentTick)
        {
            if (process->getState() == "NEW" || process->getState() == "BLOCKED")
            {
                bool allocated = memoryManager->allocate(
                    process->getPID(),
                    process->getMemoryRequired()
                );

                if (allocated)
                {
                    process->setState(ProcessState::READY);
                    log("Process " + process->getPID() + " (" + process->getName() + ") allocated " +
                        std::to_string(process->getMemoryRequired()) + " MB memory -> Moved to READY");
                }
                else if (process->getState() == "NEW")
                {
                    process->setState(ProcessState::BLOCKED);
                    log("Memory allocation failed for " + process->getPID() +
                        " (" + std::to_string(process->getMemoryRequired()) + " MB required) -> Moved to BLOCKED");
                }
            }
        }
    }
}

bool SimulationEngine::step()
{
    // Check termination condition
    auto allProcesses = processManager.getAllProcesses();
    bool allTerminated = true;

    for (const auto* p : allProcesses)
    {
        if (p->getState() != "TERMINATED")
        {
            allTerminated = false;
            break;
        }
    }

    if (allTerminated && !allProcesses.empty())
    {
        return false;
    }

    // 1. Admission Control: Try allocating memory for arrived NEW/BLOCKED processes
    checkPendingProcesses();

    // 2. Schedule: Ask CPU scheduler for next READY process
    std::string nextPID = scheduler->selectNextProcess(processManager.getAllProcesses());

    if (nextPID != "INVALID")
    {
        Process* processToRun = processManager.getProcess(nextPID);
        lastExecutedPID = nextPID;

        log("CPU running process " + nextPID + " (Remaining: " +
            std::to_string(processToRun->getRemainingTime()) + ")");

        // 3. Execute for 1 tick
        cpu.execute(*processToRun, 1);

        // 4. Memory deallocation on termination
        if (processToRun->getState() == "TERMINATED")
        {
            log("Process " + nextPID + " completed execution -> Freeing memory");
            memoryManager->deallocate(nextPID);

            // Wake up and re-test any BLOCKED processes waiting for freed space
            checkPendingProcesses();
        }
    }
    else
    {
        lastExecutedPID = "IDLE";
        log("CPU is idle (No READY processes)");
    }

    currentTick++;
    return true;
}

void SimulationEngine::run()
{
    while (step())
    {
        // Loop runs until all processes terminate
    }
}

int SimulationEngine::getCurrentTick() const
{
    return this->currentTick;
}

std::string SimulationEngine::getTelemetryJson() const
{
    std::ostringstream ss;

    ss << "{\n";
    ss << "  \"tick\": " << currentTick << ",\n";
    ss << "  \"cpu\": {\n";
    ss << "    \"activePID\": \"" << lastExecutedPID << "\",\n";
    ss << "    \"isIdle\": " << (lastExecutedPID == "IDLE" ? "true" : "false") << "\n";
    ss << "  },\n";

    // Processes array
    ss << "  \"processes\": [\n";
    auto procs = processManager.getAllProcesses();
    for (size_t i = 0; i < procs.size(); ++i)
    {
        const auto* p = procs[i];
        ss << "    {\n";
        ss << "      \"pid\": \"" << p->getPID() << "\",\n";
        ss << "      \"name\": \"" << p->getName() << "\",\n";
        ss << "      \"state\": \"" << p->getState() << "\",\n";
        ss << "      \"priority\": " << p->getPriority() << ",\n";
        ss << "      \"arrivalTime\": " << p->getArrivalTime() << ",\n";
        ss << "      \"burstTime\": " << p->getBurstTime() << ",\n";
        ss << "      \"remainingTime\": " << p->getRemainingTime() << ",\n";
        ss << "      \"memoryRequired\": " << p->getMemoryRequired() << "\n";
        ss << "    }" << (i + 1 < procs.size() ? "," : "") << "\n";
    }
    ss << "  ],\n";

    // Nested Memory Telemetry
    ss << "  \"memory\": " << memoryManager->getSnapshotAsJson() << ",\n";

    // Recent system logs
    ss << "  \"logs\": [\n";
    for (size_t i = 0; i < systemLogs.size(); ++i)
    {
        ss << "    \"" << systemLogs[i] << "\"" << (i + 1 < systemLogs.size() ? "," : "") << "\n";
    }
    ss << "  ]\n";
    ss << "}";

    return ss.str();
}