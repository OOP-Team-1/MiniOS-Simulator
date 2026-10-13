#include "../include/Kernel.h"

#include <algorithm>
#include <iomanip>
#include <sstream>
#include <stdexcept>

Kernel::Kernel(
    Scheduler& scheduler,
    MemoryManager& memoryManager,
    FileSystem& fileSystem,
    PagingManager& pagingManager,
    MemoryMode memoryMode,
    const std::string& terminalUser,
    const std::string& terminalHost
)
    : scheduler(scheduler),
      memoryManager(memoryManager),
      fileSystem(fileSystem),
      pagingManager(pagingManager),
      memoryMode(memoryMode),
      currentTime(0),
      running(false),
      terminalUsername(terminalUser),
      terminalHostname(terminalHost),
      commandPrompt(nullptr)
{
}


// ============================================================
// COMMAND PROMPT / TERMINAL INTEGRATION
// ============================================================

CommandPrompt& Kernel::getCommandPrompt()
{
    if (!commandPrompt)
    {
        commandPrompt.reset(
            new CommandPrompt(terminalUsername, terminalHostname, &fileSystem)
        );
    }

    return *commandPrompt;
}

std::string Kernel::executeTerminalCommand(const std::string& command)
{
    std::istringstream commandStream(command);
    std::vector<std::string> args;
    std::string token;

    while (commandStream >> token)
    {
        args.push_back(token);
    }

    if (args.empty())
    {
        return "";
    }

    const std::string& commandName = args[0];

    // Keep the basic shell help, then document commands handled by Kernel.
    if (commandName == "help")
    {
        std::string output = getCommandPrompt().executeCommand(command);
        output += "\nKernel process commands:\n";
        output += "  ps                         List processes\n";
        output += "  top                        Show simulated time and processes\n";
        output += "  spawn <name> <priority> <arrival> <burst> <memory>\n";
        output += "                             Create a process\n";
        output += "  kill <PID>                 Terminate a process\n";
        output += "  time / uptime              Show simulated system time\n";
        return output;
    }

    const bool isKernelCommand =
        commandName == "ps" ||
        commandName == "top" ||
        commandName == "spawn" ||
        commandName == "kill" ||
        commandName == "time" ||
        commandName == "uptime";

    if (!isKernelCommand)
    {
        // File and shell commands are executed by CommandPrompt, which uses
        // the very same FileSystem instance owned by this Kernel.
        return getCommandPrompt().executeCommand(command);
    }

    getCommandPrompt().recordExternalCommand(command);

    const auto processTable = [this]() -> std::string
    {
        std::vector<Process*> processes = processManager.getAllProcesses();
        if (processes.empty())
        {
            return "No processes.\n";
        }

        std::ostringstream out;
        out << std::left
            << std::setw(16) << "PID"
            << std::setw(16) << "STATE"
            << std::setw(12) << "ARRIVAL"
            << std::setw(14) << "REMAINING"
            << "MEMORY\n";
        out << std::string(70, '-') << '\n';

        for (const Process* process : processes)
        {
            if (process == nullptr)
            {
                continue;
            }

            out << std::left
                << std::setw(16) << process->getPID()
                << std::setw(16) << process->getState()
                << std::setw(12) << process->getArrivalTime()
                << std::setw(14) << process->getRemainingTime()
                << process->getMemoryRequired()
                << '\n';
        }

        return out.str();
    };

    if (commandName == "ps")
    {
        return processTable();
    }

    if (commandName == "top")
    {
        std::ostringstream out;
        out << "MiniOS simulated time: " << currentTime << "\n";
        out << processTable();
        return out.str();
    }

    if (commandName == "time" || commandName == "uptime")
    {
        return "Simulated time: " + std::to_string(currentTime) + " time unit(s)\n";
    }

    if (commandName == "spawn")
    {
        if (args.size() != 6)
        {
            return "Usage: spawn <name> <priority> <arrival> <burst> <memory>\n";
        }

        const auto parseInteger = [](const std::string& text, int& value) -> bool
        {
            std::istringstream valueStream(text);
            char extraCharacter;

            if (!(valueStream >> value))
            {
                return false;
            }

            return !(valueStream >> extraCharacter);
        };

        int priority = 0;
        int arrivalTime = 0;
        int burstTime = 0;
        int memoryRequired = 0;

        if (!parseInteger(args[2], priority) ||
            !parseInteger(args[3], arrivalTime) ||
            !parseInteger(args[4], burstTime) ||
            !parseInteger(args[5], memoryRequired))
        {
            return "spawn: priority, arrival, burst, and memory must be integers\n";
        }

        try
        {
            Process& process = createProcess(
                args[1], priority, arrivalTime, burstTime, memoryRequired
            );
            return "Created process with PID " + process.getPID() + "\n";
        }
        catch (const std::exception& error)
        {
            return std::string("spawn: ") + error.what() + "\n";
        }
    }

    if (commandName == "kill")
    {
        if (args.size() != 2)
        {
            return "Usage: kill <PID>\n";
        }

        if (!terminateProcess(args[1]))
        {
            return "kill: process not found: " + args[1] + "\n";
        }

        return "Terminated process " + args[1] + "\n";
    }

    return "";
}


// ============================================================
// PROCESS CREATION
// ============================================================

Process& Kernel::createProcess(
    const std::string& name,
    int priority,
    int arrivalTime,
    int burstTime,
    int memoryRequired
)
{
    // Basic validation
    if (name.empty())
    {
        throw std::invalid_argument(
            "Process name cannot be empty"
        );
    }

    if (arrivalTime < 0)
    {
        throw std::invalid_argument(
            "Arrival time cannot be negative"
        );
    }

    if (burstTime <= 0)
    {
        throw std::invalid_argument(
            "Burst time must be greater than zero"
        );
    }

    if (memoryRequired <= 0)
    {
        throw std::invalid_argument(
            "Memory required must be greater than zero"
        );
    }

    // ProcessManager generates the PID
    Process& process =
        processManager.createProcess(
            name,
            priority,
            arrivalTime,
            burstTime,
            memoryRequired
        );

    // Allocate memory according to the selected memory model
    bool allocated = allocateProcessMemory(process);

    if (!allocated)
    {
        /*
         * The process could not obtain the required memory.
         * Since ProcessManager currently has no removeProcess()
         * operation, we preserve the process record and mark it
         * TERMINATED rather than leaving a permanently NEW process.
         */
        process.setState(ProcessState::TERMINATED);

        throw std::runtime_error(
            "Unable to allocate memory for process " +
            process.getPID()
        );
    }

    /*
     * NEW -> READY happens when the process has arrived.
     *
     * We consider memory allocation to be part of process
     * admission, while arrivalTime controls when it becomes
     * eligible for CPU scheduling.
     */
    if (arrivalTime <= currentTime)
    {
        process.setState(ProcessState::READY);
    }

    return process;
}


// ============================================================
// MEMORY ALLOCATION
// ============================================================

bool Kernel::allocateProcessMemory(Process& process)
{
    if (memoryMode == MemoryMode::CONTIGUOUS)
    {
        return memoryManager.allocate(
            process.getPID(),
            process.getMemoryRequired()
        );
    }

    return pagingManager.allocateProcess(
        process.getPID(),
        process.getMemoryRequired(),
        currentTime
    );
}


// ============================================================
// ARRIVAL MANAGEMENT
// ============================================================

void Kernel::updateArrivals()
{
    std::vector<Process*> processes =
        processManager.getAllProcesses();

    for (Process* process : processes)
    {
        if (process == nullptr)
        {
            continue;
        }

        if (process->getState() == "NEW" &&
            process->getArrivalTime() <= currentTime)
        {
            process->setState(ProcessState::READY);
        }
    }
}


// ============================================================
// READY PROCESS LIST
// ============================================================

std::vector<Process*> Kernel::getReadyProcesses() const
{
    std::vector<Process*> readyProcesses;

    std::vector<const Process*> processes =
        processManager.getAllProcesses();

    for (const Process* process : processes)
    {
        if (process == nullptr)
        {
            continue;
        }

        if (process->getState() == "READY")
        {
            /*
             * Scheduler expects Process*.
             *
             * We know these objects are actually managed by
             * ProcessManager and still alive, so removing const
             * here is safe for this internal scheduling view.
             */
            readyProcesses.push_back(
                const_cast<Process*>(process)
            );
        }
    }

    return readyProcesses;
}


// ============================================================
// READY CHECK
// ============================================================

bool Kernel::hasReadyProcess() const
{
    std::vector<const Process*> processes =
        processManager.getAllProcesses();

    for (const Process* process : processes)
    {
        if (process != nullptr &&
            process->getState() == "READY")
        {
            return true;
        }
    }

    return false;
}


// ============================================================
// FUTURE PROCESS CHECK
// ============================================================

bool Kernel::hasFutureProcess() const
{
    std::vector<const Process*> processes =
        processManager.getAllProcesses();

    for (const Process* process : processes)
    {
        if (process != nullptr &&
            process->getState() == "NEW" &&
            process->getArrivalTime() > currentTime)
        {
            return true;
        }
    }

    return false;
}


// ============================================================
// NEXT ARRIVAL TIME
// ============================================================

int Kernel::getNextArrivalTime() const
{
    int nextArrival = -1;

    std::vector<const Process*> processes =
        processManager.getAllProcesses();

    for (const Process* process : processes)
    {
        if (process == nullptr)
        {
            continue;
        }

        if (process->getState() == "NEW" &&
            process->getArrivalTime() > currentTime)
        {
            if (nextArrival == -1 ||
                process->getArrivalTime() < nextArrival)
            {
                nextArrival = process->getArrivalTime();
            }
        }
    }

    return nextArrival;
}


// ============================================================
// PROCESS TERMINATION
// ============================================================

bool Kernel::terminateProcess(const std::string& PID)
{
    Process* process =
        processManager.getProcess(PID);

    if (process == nullptr)
    {
        return false;
    }

    if (process->getState() == "TERMINATED")
    {
        /*
         * Resources should already have been released.
         * Calling this again is harmless.
         */
        releaseProcessResources(*process);
        return true;
    }

    process->setState(ProcessState::TERMINATED);

    releaseProcessResources(*process);

    return true;
}


// ============================================================
// RESOURCE CLEANUP
// ============================================================

void Kernel::releaseProcessResources(Process& process)
{
    const std::string PID = process.getPID();

    /*
     * Release memory using the same memory model with which
     * the process was admitted.
     */
    if (memoryMode == MemoryMode::CONTIGUOUS)
    {
        memoryManager.deallocate(PID);
    }
    else
    {
        pagingManager.deallocateProcess(PID);
    }

    /*
     * The file system knows which files belong to this PID.
     * On process termination, all such files are closed/deleted.
     */
    fileSystem.handleProcessTermination(PID);
}


// ============================================================
// ONE SCHEDULING STEP
// ============================================================

bool Kernel::runStep()
{
    /*
     * First make processes whose arrival time has been reached
     * eligible for scheduling.
     */
    updateArrivals();

    /*
     * No READY process currently exists.
     *
     * If there is a future process, advance simulated time
     * directly to its arrival rather than wasting CPU cycles.
     */
    if (!hasReadyProcess())
    {
        if (hasFutureProcess())
        {
            int nextArrival = getNextArrivalTime();

            if (nextArrival != -1)
            {
                currentTime = nextArrival;
                updateArrivals();
            }
        }
    }

    /*
     * After advancing time, there may still be no runnable
     * process. This happens, for example, if every remaining
     * process is BLOCKED.
     */
    if (!hasReadyProcess())
    {
        return false;
    }

    /*
     * Only READY processes are given to the scheduler.
     *
     * Therefore the scheduler cannot accidentally select:
     * NEW, RUNNING, BLOCKED, or TERMINATED processes.
     */
    std::vector<Process*> readyProcesses =
        getReadyProcesses();

    SchedulingDecision decision =
        scheduler.selectNextProcess(readyProcesses);

    if (decision.PID.empty())
    {
        throw std::runtime_error(
            "Scheduler returned an empty PID"
        );
    }

    if (decision.timeUnits <= 0)
    {
        throw std::runtime_error(
            "Scheduler returned invalid execution time"
        );
    }

    Process* selectedProcess =
        processManager.getProcess(decision.PID);

    if (selectedProcess == nullptr)
    {
        throw std::runtime_error(
            "Scheduler selected a non-existent process: " +
            decision.PID
        );
    }

    if (selectedProcess->getState() != "READY")
    {
        throw std::runtime_error(
            "Scheduler selected a process that is not READY: " +
            decision.PID
        );
    }

    /*
     * Never execute more time than the process actually has left.
     */
    int executionTime =
        std::min(
            decision.timeUnits,
            selectedProcess->getRemainingTime()
        );

    /*
     * CPU changes:
     *
     * READY -> RUNNING
     * execution
     * RUNNING -> READY
     *
     * or
     *
     * RUNNING -> TERMINATED
     *
     * CPU already implements these transitions.
     */
    cpu.execute(
        *selectedProcess,
        executionTime
    );

    /*
     * Advance simulated system time.
     */
    currentTime += executionTime;

    /*
     * If the process completed, release all resources.
     */
    if (selectedProcess->getState() == "TERMINATED")
    {
        releaseProcessResources(
            *selectedProcess
        );
    }

    /*
     * A process may arrive exactly at the new time.
     */
    updateArrivals();

    return true;
}


// ============================================================
// RUN UNTIL SYSTEM CAN NO LONGER PROGRESS
// ============================================================

void Kernel::run()
{
    if (running)
    {
        throw std::runtime_error(
            "Kernel is already running"
        );
    }

    running = true;

    /*
     * A new complete scheduling run starts from the scheduler's
     * initial state. For example, Round Robin can reset its
     * internal index.
     */
    scheduler.reset();

    try
    {
        while (runStep())
        {
            /*
             * runStep() performs exactly one scheduling decision
             * and one CPU execution period.
             */
        }
    }
    catch (...)
    {
        running = false;
        throw;
    }

    running = false;
}


// ============================================================
// MEMORY MODE
// ============================================================

bool Kernel::setMemoryMode(MemoryMode mode)
{
    if (mode == memoryMode)
    {
        return true;
    }

    /*
     * Changing memory models while processes are alive would
     * make the existing allocations ambiguous.
     */
    std::vector<Process*> processes =
        processManager.getAllProcesses();

    for (const Process* process : processes)
    {
        if (process != nullptr &&
            process->getState() != "TERMINATED")
        {
            return false;
        }
    }

    memoryMode = mode;

    return true;
}

MemoryMode Kernel::getMemoryMode() const
{
    return memoryMode;
}


// ============================================================
// KERNEL STATE
// ============================================================

int Kernel::getCurrentTime() const
{
    return currentTime;
}

bool Kernel::isRunning() const
{
    return running;
}


// ============================================================
// CURRENT CPU PROCESS
// ============================================================

Process* Kernel::getCurrentProcess()
{
    return cpu.getCurrentProcess();
}

const Process* Kernel::getCurrentProcess() const
{
    return cpu.getCurrentProcess();
}


// ============================================================
// PROCESS MANAGER ACCESS
// ============================================================

ProcessManager& Kernel::getProcessManager()
{
    return processManager;
}

const ProcessManager& Kernel::getProcessManager() const
{
    return processManager;
}