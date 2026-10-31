#include "../include/SimulationEngine.h"

#include <iostream>
#include <sstream>

SimulationEngine::SimulationEngine(
    MemoryManager& memManager,
    PagingManager& pagManager,
    FileSystem& fs,
    Scheduler& cpuScheduler
) : scheduler(&cpuScheduler),
    memoryManager(&memManager),
    pagingManager(&pagManager),
    fileSystem(&fs),
    currentTick(0),
    lastExecutedPID("NONE"),
    schedulerName("RR"),
    schedulerQuantum(2),
    allocName("FirstFit")
{
}

SimulationEngine::SimulationEngine(
    MemoryManager& memManager,
    FileSystem& fs,
    Scheduler& cpuScheduler
) : scheduler(&cpuScheduler),
    memoryManager(&memManager),
    pagingManager(nullptr),
    fileSystem(&fs),
    currentTick(0),
    lastExecutedPID("NONE"),
    schedulerName("RR"),
    schedulerQuantum(2),
    allocName("FirstFit")
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
    Process& proc = processManager.createProcess(
        name,
        priority,
        arrivalTime,
        burstTime,
        memoryRequired
    );
    checkPendingProcesses();
    return proc;
}

// ── Directory operation wrappers ────────────────────────────────────────────

std::string SimulationEngine::createDirectory(const std::string& name, const std::string& parentDirId)
{
    std::string targetParent = parentDirId.empty() ? FileSystem::getRootDirId() : parentDirId;
    std::string dirId = fileSystem->createDirectory(name, targetParent, currentTick);

    if (!dirId.empty())
        log("Directory created: " + dirId + " (\"" + name + "\") under " + targetParent);
    else
        log("Directory creation FAILED for \"" + name + "\" under " + targetParent +
            " (parent missing or name already in use)");

    return dirId;
}

bool SimulationEngine::deleteDirectory(const std::string& dirId)
{
    bool ok = fileSystem->deleteDirectory(dirId);
    if (ok)
        log("Directory deleted: " + dirId);
    else
        log("Directory delete FAILED: " + dirId + " (not found, root, or not empty)");
    return ok;
}

bool SimulationEngine::renameDirectory(const std::string& dirId, const std::string& newName)
{
    bool ok = fileSystem->renameDirectory(dirId, newName);
    if (ok)
        log("Directory renamed: " + dirId + " -> \"" + newName + "\"");
    else
        log("Directory rename FAILED: " + dirId + " (not found, root, empty name, or name collision)");
    return ok;
}

bool SimulationEngine::moveDirectory(const std::string& dirId, const std::string& newParentDirId)
{
    bool ok = fileSystem->moveDirectory(dirId, newParentDirId);
    if (ok)
        log("Directory moved: " + dirId + " -> under " + newParentDirId);
    else
        log("Directory move FAILED: " + dirId + " -> " + newParentDirId +
            " (not found, root, cycle, or name collision)");
    return ok;
}

// ── File operation wrappers ───────────────────────────────────────────────────

std::string SimulationEngine::createFile(const std::string& ownerPID,
                                         const std::string& name,
                                         int sizeInBlocks,
                                         const std::string& dirId)
{
    std::string targetDirId = dirId.empty() ? FileSystem::getRootDirId() : dirId;
    std::string fileId = fileSystem->createFile(ownerPID, name, sizeInBlocks, currentTick, targetDirId);

    if (!fileId.empty())
        log("File created: " + fileId + " (\"" + name + "\") by " + ownerPID +
            " | " + std::to_string(sizeInBlocks) + " blocks in " + targetDirId);
    else
        log("File creation FAILED for \"" + name + "\" by " + ownerPID +
            " (disk full/fragmented, directory missing, or name already in use)");

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

bool SimulationEngine::moveFile(const std::string& fileId, const std::string& newDirId)
{
    bool ok = fileSystem->moveFile(fileId, newDirId);
    if (ok)
        log("File moved: " + fileId + " -> " + newDirId);
    else
        log("File move FAILED: " + fileId + " -> " + newDirId +
            " (file or directory not found, or name collision)");
    return ok;
}

// ── Content I/O wrappers ───────────────────────────────────────────────────

std::string SimulationEngine::readFile(const std::string& fileId, const std::string& byPID, bool& ok)
{
    std::string content = fileSystem->readFile(fileId, byPID, currentTick, ok);

    if (ok)
        log("File read: " + fileId + " by " + byPID +
            " (" + std::to_string(content.size()) + " bytes)");
    else
        log("File read FAILED: " + fileId + " by " + byPID +
            " (not found, not open, or not held open by this PID)");

    return content;
}

bool SimulationEngine::writeFile(const std::string& fileId, const std::string& byPID, const std::string& content)
{
    bool ok = fileSystem->writeFile(fileId, byPID, content, currentTick);

    if (ok)
        log("File written: " + fileId + " by " + byPID +
            " (" + std::to_string(content.size()) + " bytes)");
    else
        log("File write FAILED: " + fileId + " by " + byPID +
            " (not found, not open, not held open by this PID, or disk full)");

    return ok;
}

bool SimulationEngine::appendFile(const std::string& fileId, const std::string& byPID, const std::string& content)
{
    bool ok = fileSystem->appendFile(fileId, byPID, content, currentTick);

    if (ok)
        log("File appended: " + fileId + " by " + byPID +
            " (+" + std::to_string(content.size()) + " bytes)");
    else
        log("File append FAILED: " + fileId + " by " + byPID +
            " (not found, not open, not held open by this PID, or disk full)");

    return ok;
}

void SimulationEngine::compactDisk()
{
    fileSystem->compact();
    log("Disk compacted — all files relocated to contiguous blocks");
}

void SimulationEngine::compactMemory()
{
    memoryManager->compact();
    log("RAM compacted — all active processes relocated contiguously to low memory");
    checkPendingProcesses();
}

bool SimulationEngine::renameFile(const std::string& fileId, const std::string& newName)
{
    bool ok = fileSystem->renameFile(fileId, newName);
    if (ok)
        log("File renamed: " + fileId + " -> \"" + newName + "\"");
    else
        log("File rename FAILED: " + fileId + " (not found, empty name, or name collision)");
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

void SimulationEngine::setPagingManager(PagingManager& newPagingManager)
{
    this->pagingManager = &newPagingManager;
}

AddressTranslationResult SimulationEngine::accessMemory(const std::string& pid, int logicalAddress)
{
    if (!pagingManager) return {};
    auto res = pagingManager->accessAddress(pid, logicalAddress, currentTick);
    log("Memory access for " + pid + " @ addr " + std::to_string(logicalAddress) + ": " + res.message);
    return res;
}

void SimulationEngine::setCurrentSchedulerName(const std::string& name, int quantum)
{
    schedulerName    = name;
    schedulerQuantum = quantum;
    log("Scheduler switched to " + name +
        (quantum > 0 ? " (quantum=" + std::to_string(quantum) + ")" : ""));
}

void SimulationEngine::setCurrentAllocName(const std::string& name)
{
    allocName = name;
    log("Memory allocation strategy switched to " + name);
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
                    if (pagingManager)
                    {
                        pagingManager->allocateProcess(
                            process->getPID(),
                            process->getMemoryRequired(),
                            currentTick
                        );
                    }
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

        if (pagingManager && processToRun->getMemoryRequired() > 0)
        {
            int executedUnits = processToRun->getBurstTime() - processToRun->getRemainingTime();
            int memReq = processToRun->getMemoryRequired();
            int logicalAddr = (executedUnits * 4) % memReq;
            auto trans = pagingManager->accessAddress(nextPID, logicalAddr, currentTick);
            if (trans.pageFault)
            {
                log("Page fault for " + nextPID + " at logical addr " + std::to_string(logicalAddr) +
                    " -> loaded into frame " + std::to_string(trans.frameNumber));
            }
        }

        // 3. On termination: free memory AND file system resources
        if (processToRun->getState() == "TERMINATED")
        {
            log("Process " + nextPID + " completed -> freeing memory and files");
            memoryManager->deallocate(nextPID);
            if (pagingManager)
            {
                pagingManager->deallocateProcess(nextPID);
            }
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
    if (pagingManager)
    {
        pagingManager->reset();
    }
    fileSystem->reset();
    scheduler->reset();
    log("Simulation reset to initial state");
}

bool SimulationEngine::killProcess(const std::string& pid)
{
    Process* p = processManager.getProcess(pid);
    if (!p) return false;
    p->setState(ProcessState::TERMINATED);
    memoryManager->deallocate(pid);
    if (pagingManager)
    {
        pagingManager->deallocateProcess(pid);
    }
    fileSystem->handleProcessTermination(pid);
    log("Process " + pid + " terminated");
    checkPendingProcesses();
    return true;
}

bool SimulationEngine::removeProcess(const std::string& pid)
{
    Process* p = processManager.getProcess(pid);
    if (!p) return false;

    // A live process still owns memory/paging/files; release those first.
    // Already-terminated processes were cleaned up when they finished.
    if (p->getState() != "TERMINATED")
    {
        killProcess(pid);
    }

    if (lastExecutedPID == pid)
    {
        lastExecutedPID = "NONE";
    }

    bool removed = processManager.removeProcess(pid);
    if (removed)
    {
        log("Process " + pid + " removed from the process table");
        checkPendingProcesses();
    }
    return removed;
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

    // Active config (scheduler + alloc strategy)
    ss << "\"config\":{"
       << "\"scheduler\":\"" << jsonEscape(schedulerName) << "\","
       << "\"quantum\":" << schedulerQuantum << ","
       << "\"allocStrategy\":\"" << jsonEscape(allocName) << "\"},";

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

    // Paging
    if (pagingManager)
    {
        ss << "\"paging\":" << pagingManager->getSnapshotAsJson() << ",";
    }

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