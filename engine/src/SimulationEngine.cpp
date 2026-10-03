#include "../include/SimulationEngine.h"

#include <iostream>
#include <sstream>

SimulationEngine::SimulationEngine(
    MemoryManager& memManager,
    FileSystem& fs,
    Scheduler& cpuScheduler
) : scheduler(&cpuScheduler),
    memoryManager(&memManager),
    fileSystem(&fs),
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

// ── File operation wrappers ───────────────────────────────────────────────────

std::string SimulationEngine::createFile(const std::string& ownerPID,
                                         const std::string& name,
                                         int sizeInBlocks,
                                         const std::string& dirPath)
{
    std::string fileId = fileSystem->createFile(ownerPID, name, sizeInBlocks, currentTick, dirPath);

    if (!fileId.empty())
        log("File created: " + fileId + " (\"" + name + "\") by " + ownerPID +
            " | " + std::to_string(sizeInBlocks) + " blocks at " + dirPath);
    else
        log("File creation FAILED for \"" + name + "\" by " + ownerPID +
            " (disk full or fragmented)");

    return fileId;
}

bool SimulationEngine::deleteFile(const std::string& fileId)
{
    bool ok = fileSystem->deleteFile(fileId);
    if (ok)
        log("File deleted: " + fileId);
    else
        log("File delete FAILED: " + fileId + " not found");
    return ok;
}

bool SimulationEngine::openFile(const std::string& fileId, const std::string& byPID)
{
    bool ok = fileSystem->openFile(fileId, byPID, currentTick);
    if (ok)
        log("File opened: " + fileId + " by " + byPID);
    else
        log("File open FAILED: " + fileId + " (not found or already open)");
    return ok;
}

bool SimulationEngine::closeFile(const std::string& fileId, const std::string& byPID)
{
    bool ok = fileSystem->closeFile(fileId, byPID);
    if (ok)
        log("File closed: " + fileId + " by " + byPID);
    else
        log("File close FAILED: " + fileId + " (not found or not open by " + byPID + ")");
    return ok;
}

// ── Scheduler / MemoryManager setters ────────────────────────────────────────

void SimulationEngine::setScheduler(Scheduler& newScheduler)
{
    this->scheduler = &newScheduler;
}

void SimulationEngine::setMemoryManager(MemoryManager& newMemoryManager)
{
    this->memoryManager = &newMemoryManager;
}

// ── Admission control ─────────────────────────────────────────────────────────

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
                    log("Process " + process->getPID() + " (" + process->getName() +
                        ") allocated " + std::to_string(process->getMemoryRequired()) +
                        " MB memory -> READY");
                }
                else if (process->getState() == "NEW")
                {
                    process->setState(ProcessState::BLOCKED);
                    log("Memory allocation FAILED for " + process->getPID() +
                        " (" + std::to_string(process->getMemoryRequired()) +
                        " MB required) -> BLOCKED");
                }
            }
        }
    }
}

// ── Core step ────────────────────────────────────────────────────────────────

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
        lastExecutedPID = "IDLE";
        return false;
    }

    // 1. Admission control
    checkPendingProcesses();

    // 2. Schedule
    std::string nextPID = scheduler->selectNextProcess(processManager.getAllProcesses()).PID;

    if (nextPID != "INVALID")
    {
        Process* processToRun = processManager.getProcess(nextPID);
        lastExecutedPID = nextPID;

        log("CPU running process " + nextPID + " (Remaining: " +
            std::to_string(processToRun->getRemainingTime()) + ")");

        cpu.execute(*processToRun, 1);

        // 3. On termination: free memory AND file system resources
        if (processToRun->getState() == "TERMINATED")
        {
            log("Process " + nextPID + " completed -> freeing memory and files");
            memoryManager->deallocate(nextPID);
            fileSystem->handleProcessTermination(nextPID);

            // Re-check blocked processes now that memory may have freed up
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
    while (step()) {}
}

void SimulationEngine::reset()
{
    currentTick = 0;
    lastExecutedPID = "NONE";
    systemLogs.clear();
    processManager.clear();
    memoryManager->reset();
    fileSystem->reset();
    scheduler->reset();
    log("Simulation reset to initial state");
}

int SimulationEngine::getCurrentTick() const
{
    return this->currentTick;
}

// ── JSON helpers ──────────────────────────────────────────────────────────────

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

// ── Telemetry ─────────────────────────────────────────────────────────────────

std::string SimulationEngine::getTelemetryJson() const
{
    std::ostringstream ss;

    // isIdle is true whenever there is no running process
    bool isIdle = (lastExecutedPID == "IDLE" || lastExecutedPID == "NONE");

    ss << "{\"tick\":" << currentTick << ",";

    // CPU
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

    // Memory
    ss << "\"memory\":" << memoryManager->getSnapshotAsJson() << ",";

    // File System
    ss << "\"filesystem\":" << fileSystem->getSnapshotAsJson() << ",";

    // Logs
    ss << "\"logs\":[";
    for (size_t i = 0; i < systemLogs.size(); ++i)
    {
        ss << "\"" << jsonEscape(systemLogs[i]) << "\"";
        if (i + 1 < systemLogs.size()) ss << ",";
    }
    ss << "]}";

    return ss.str();
}