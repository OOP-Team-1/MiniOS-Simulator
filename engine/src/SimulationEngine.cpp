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

    // the most recent 100 log entries to prevent unbounded growth
    while (systemLogs.size() > 100)
    {
        systemLogs.pop_front();
    }
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
        // mark CPU idle so telemetry shows the correct state
        lastExecutedPID = "IDLE";
        return false;
    }

    // 1. Admission Control: Try allocating memory for arrived NEW/BLOCKED processes
    checkPendingProcesses();

    // 2. Schedule: Ask CPU scheduler for next READY process
    std::string nextPID = scheduler->selectNextProcess(processManager.getAllProcesses()).PID;

    if (nextPID != "INVALID")
    {
        Process* processToRun = processManager.getProcess(nextPID);
        lastExecutedPID = nextPID;

        log("CPU running process " + nextPID + " (Remaining: " +
            std::to_string(processToRun->getRemainingTime()) + ")");

        // Execute for 1 tick
        cpu.execute(*processToRun, 1);

        // Memory deallocation on termination
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

void SimulationEngine::reset()
{
    currentTick = 0;
    lastExecutedPID = "NONE";
    systemLogs.clear();
    processManager.clear();
    memoryManager->reset();
    scheduler->reset(); // reset scheduler state (e.g. RR currentIndex)
    log("Simulation reset to initial state");
}

int SimulationEngine::getCurrentTick() const
{
    return this->currentTick;
}

// Helper: escape a string for JSON
static std::string jsonEscape(const std::string& s)
{
    std::string out;
    out.reserve(s.size());
    for (char c : s)
    {
        switch (c)
        {
            case '"':  out += "\\\""; break;
            case '\\': out += "\\\\"; break;
            case '\n': out += "\\n";  break;
            case '\r': out += "\\r";  break;
            case '\t': out += "\\t";  break;
            default:   out += c;      break;
        }
    }
    return out;
}

std::string SimulationEngine::getTelemetryJson() const
{
    std::ostringstream ss;

    // isIdle is true whenever there is no running process
    bool isIdle = (lastExecutedPID == "IDLE" || lastExecutedPID == "NONE");

    ss << "{\"tick\":" << currentTick << ",";
    ss << "\"cpu\":{\"activePID\":\"" << jsonEscape(lastExecutedPID) << "\",\"isIdle\":" << (isIdle ? "true" : "false") << "},";

    // Processes array
    ss << "\"processes\":[";
    auto procs = processManager.getAllProcesses();
    for (size_t i = 0; i < procs.size(); ++i)
    {
        const auto* p = procs[i];
        ss << "{\"pid\":\"" << jsonEscape(p->getPID()) << "\","
           << "\"name\":\"" << jsonEscape(p->getName()) << "\","
           << "\"state\":\"" << jsonEscape(p->getState()) << "\","
           << "\"priority\":" << p->getPriority() << ","
           << "\"arrivalTime\":" << p->getArrivalTime() << ","
           << "\"burstTime\":" << p->getBurstTime() << ","
           << "\"remainingTime\":" << p->getRemainingTime() << ","
           << "\"memoryRequired\":" << p->getMemoryRequired() << "}";
        if (i + 1 < procs.size()) ss << ",";
    }
    ss << "],";

    // Nested Memory Telemetry (already compact)
    ss << "\"memory\":" << memoryManager->getSnapshotAsJson() << ",";

    // Recent system logs
    ss << "\"logs\":[";
    for (size_t i = 0; i < systemLogs.size(); ++i)
    {
        ss << "\"" << jsonEscape(systemLogs[i]) << "\"";
        if (i + 1 < systemLogs.size()) ss << ",";
    }
    ss << "]}";

    return ss.str();
}