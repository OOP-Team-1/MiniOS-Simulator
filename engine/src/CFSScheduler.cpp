#include "../include/CFSScheduler.h"

#include <algorithm>
#include <cmath>
#include <iomanip>
#include <limits>
#include <sstream>

#include "../include/SerializationUtils.h"

CFSScheduler::CFSScheduler(double targetLatency, double minGranularity, double baseWeight)
    : targetLatency(targetLatency > 0.0 ? targetLatency : 24.0),
      minGranularity(minGranularity > 0.0 ? minGranularity : 3.0),
      baseWeight(baseWeight > 0.0 ? baseWeight : 10.0),
      currentPID(""),
      currentSlice(0),
      remainingSlice(0),
      runnableCount(0),
      minVruntime(0.0),
      preemptionCount(0),
      lastReason("CFS ready")
{
}

void CFSScheduler::setParameters(double newTargetLatency, double newMinGranularity)
{
    if (newTargetLatency > 0.0)
    {
        targetLatency = newTargetLatency;
    }
    if (newMinGranularity > 0.0)
    {
        minGranularity = std::min(newMinGranularity, targetLatency);
    }
}

double CFSScheduler::totalWeight(const std::vector<Process*>& ready) const
{
    double total = 0.0;
    for (const Process* process : ready)
    {
        total += std::max(1, process->getWeight());
    }
    return total > 0.0 ? total : 1.0;
}

int CFSScheduler::computeSlice(const Process* process, const std::vector<Process*>& ready) const
{
    const double weightSum = totalWeight(ready);
    const double share = std::max(1, process->getWeight()) / weightSum;
    double slice = targetLatency * share;

    // A process is guaranteed at least the minimum granularity, but never more
    // time than it actually needs.
    slice = std::max(minGranularity, slice);
    slice = std::min(slice, static_cast<double>(process->getRemainingTime()));
    slice = std::max(1.0, std::floor(slice + 1e-9));

    return static_cast<int>(slice);
}

Process* CFSScheduler::pickMinVruntime(const std::vector<Process*>& ready) const
{
    Process* selected = nullptr;
    for (Process* process : ready)
    {
        if (selected == nullptr)
        {
            selected = process;
            continue;
        }

        const double candidate = process->getVruntime();
        const double best = selected->getVruntime();

        if (candidate < best - 1e-9 ||
            (std::fabs(candidate - best) <= 1e-9 &&
             (process->getArrivalTime() < selected->getArrivalTime() ||
              (process->getArrivalTime() == selected->getArrivalTime() &&
               process->getPID() < selected->getPID()))))
        {
            selected = process;
        }
    }
    return selected;
}

SchedulingDecision CFSScheduler::selectNextProcess(const std::vector<Process*>& processes)
{
    std::vector<Process*> ready;
    for (Process* process : processes)
    {
        if (process != nullptr && process->getState() == "READY")
        {
            ready.push_back(process);
        }
    }

    if (ready.empty())
    {
        currentPID.clear();
        currentSlice = 0;
        remainingSlice = 0;
        runnableCount = 0;
        minVruntime = 0.0;
        lastReason = "No READY process is available";
        return {"INVALID", -1};
    }

    // 1. Minimum virtual runtime among tasks already on the timeline.
    double knownMinimum = std::numeric_limits<double>::infinity();
    for (const Process* process : ready)
    {
        if (knownTasks.find(process->getPID()) != knownTasks.end())
        {
            knownMinimum = std::min(knownMinimum, process->getVruntime());
        }
    }
    if (!std::isfinite(knownMinimum))
    {
        knownMinimum = 0.0;
    }

    // 2. Newly-arrived processes join at the current minimum. This is the
    //    fairness rule that prevents a late arrival from monopolising the CPU
    //    (and also prevents it from being starved by the existing minimum).
    bool initializedNewTask = false;
    std::map<std::string, double> refreshedKnownTasks;
    for (Process* process : ready)
    {
        if (knownTasks.find(process->getPID()) == knownTasks.end())
        {
            process->setVruntime(knownMinimum);
            initializedNewTask = true;
        }
        refreshedKnownTasks[process->getPID()] = process->getVruntime();
    }
    knownTasks.swap(refreshedKnownTasks);

    // 3. Recompute minimum virtual runtime over the runnable set.
    double minimum = std::numeric_limits<double>::infinity();
    for (const Process* process : ready)
    {
        minimum = std::min(minimum, process->getVruntime());
    }
    minVruntime = std::isfinite(minimum) ? minimum : 0.0;
    runnableCount = static_cast<int>(ready.size());

    // 4. Locate the process that currently owns the CPU slice.
    Process* current = nullptr;
    if (!currentPID.empty())
    {
        for (Process* process : ready)
        {
            if (process->getPID() == currentPID)
            {
                current = process;
                break;
            }
        }
    }
    if (current == nullptr)
    {
        currentPID.clear();
        currentSlice = 0;
        remainingSlice = 0;
    }

    // 5. Wake-up preemption: a newly-arrived task starts at the old minimum
    //    vruntime. If that is meaningfully below the running task's vruntime,
    //    preempt the running task instead of waiting for its slice to expire.
    bool wakeupPreemption = false;
    if (current != nullptr && remainingSlice > 0 && initializedNewTask)
    {
        for (const Process* process : ready)
        {
            if (process == current)
            {
                continue;
            }
            if (process->getVruntime() + minGranularity < current->getVruntime())
            {
                wakeupPreemption = true;
                break;
            }
        }
    }

    // 6. Keep the current task while its slice has budget and no fairness
    //    wake-up requires preemption.
    if (current != nullptr && remainingSlice > 0 && !wakeupPreemption)
    {
        std::ostringstream reason;
        reason << "PID " << current->getPID() << " keeps the CPU (slice budget "
               << remainingSlice << ", vruntime "
               << std::fixed << std::setprecision(2) << current->getVruntime() << ")";
        lastReason = reason.str();
        return {currentPID, 1};
    }

    // 7. Select the runnable task with the smallest virtual runtime.
    Process* next = pickMinVruntime(ready);
    const bool preempted = current != nullptr && next != nullptr && next != current;
    const bool renewed = current != nullptr && next == current;

    if (preempted)
    {
        preemptionCount++;
    }

    currentPID = next->getPID();
    currentSlice = computeSlice(next, ready);
    remainingSlice = currentSlice;

    std::ostringstream reason;
    if (preempted)
    {
        reason << "PID " << next->getPID() << " preempts PID " << current->getPID()
               << " because its vruntime (" << std::fixed << std::setprecision(2)
               << next->getVruntime() << ") is smaller (min=" << minVruntime << ")";
    }
    else if (renewed)
    {
        reason << "PID " << next->getPID()
               << " still has the minimum vruntime (" << std::fixed << std::setprecision(2)
               << next->getVruntime() << "); new slice " << currentSlice;
    }
    else
    {
        reason << "PID " << next->getPID()
               << " selected with minimum vruntime (" << std::fixed << std::setprecision(2)
               << next->getVruntime() << "); slice " << currentSlice
               << " for " << runnableCount << " runnable task(s)";
    }
    lastReason = reason.str();

    // The simulation loop executes exactly one tick per call, so the decision
    // carries one unit. The slice length is tracked internally by the CFS
    // scheduler and reported through telemetry for the UI.
    return {currentPID, 1};
}

void CFSScheduler::onProcessExecuted(Process& process, int timeUnits)
{
    if (timeUnits <= 0)
    {
        return;
    }

    const int weight = std::max(1, process.getWeight());
    const double delta = static_cast<double>(timeUnits) * baseWeight / static_cast<double>(weight);
    process.addVruntime(delta);

    // Keep the map and the published minimum accurate *after* the executed
    // tick, so the UI never displays a value that lags one slice behind.
    knownTasks[process.getPID()] = process.getVruntime();
    if (!knownTasks.empty())
    {
        double minimum = std::numeric_limits<double>::infinity();
        for (const auto& entry : knownTasks)
        {
            minimum = std::min(minimum, entry.second);
        }
        minVruntime = std::isfinite(minimum) ? minimum : 0.0;
    }

    if (process.getPID() == currentPID && remainingSlice > 0)
    {
        remainingSlice = std::max(0, remainingSlice - timeUnits);
    }
}

void CFSScheduler::onProcessCompleted(Process& process)
{
    knownTasks.erase(process.getPID());

    if (process.getPID() == currentPID)
    {
        currentPID.clear();
        currentSlice = 0;
        remainingSlice = 0;
    }
}

void CFSScheduler::reset()
{
    currentPID.clear();
    currentSlice = 0;
    remainingSlice = 0;
    runnableCount = 0;
    minVruntime = 0.0;
    preemptionCount = 0;
    knownTasks.clear();
    lastReason = "CFS reset";
}

std::string CFSScheduler::getTelemetryJson() const
{
    std::ostringstream ss;
    ss << std::fixed << std::setprecision(2);
    ss << "{"
       << "\"algorithm\":\"CFS\","
       << "\"targetLatency\":" << targetLatency << ","
       << "\"minGranularity\":" << minGranularity << ","
       << "\"baseWeight\":" << baseWeight << ","
       << "\"runnableCount\":" << runnableCount << ","
       << "\"minVruntime\":" << minVruntime << ","
       << "\"currentPID\":\"" << minios::jsonEscape(currentPID) << "\","
       << "\"currentSlice\":" << currentSlice << ","
       << "\"sliceRemaining\":" << remainingSlice << ","
       << "\"preemptions\":" << preemptionCount << ","
       << "\"lastReason\":\"" << minios::jsonEscape(lastReason) << "\""
       << "}";
    return ss.str();
}
