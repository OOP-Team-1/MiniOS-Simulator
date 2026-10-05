#include "../include/RoundRobinScheduler.h"

RoundRobinScheduler::RoundRobinScheduler(int timeQuantum)
    : timeQuantum(timeQuantum),
      currentIndex(0),
      remainingQuantum(0),
      currentPID("")
{
}

//Proper quantum-aware Round Robin
// selectNextProcess is called once per tick by SimulationEngine::step().
// We maintain: which PID is currently "in its slice" and how many ticks remain.
// - If the current process still has ticks left in its quantum AND is still READY, keep it.
// - Otherwise, move to the next READY process and give it a fresh quantum.
SchedulingDecision RoundRobinScheduler::selectNextProcess(const std::vector<Process*>& processes)
{
    if (processes.empty()) return {"INVALID",-1};

    int n = static_cast<int>(processes.size());

    // If there's a current PID still in its quantum slice, check if it can continue
    if (!currentPID.empty() && remainingQuantum > 0)
    {
        // Find it in the list
        for (int i = 0; i < n; i++)
        {
            if (processes[i]->getPID() == currentPID &&
                processes[i]->getState() == "READY")
            {
                remainingQuantum--;
                return {currentPID,timeQuantum};
            }
        }
        // Current process is gone / no longer READY — fall through to pick next
    }

    // Pick the next READY process in round-robin order
    for (int i = 0; i < n; i++)
    {
        int ind = (currentIndex + i) % n;
        if (processes[ind]->getState() != "READY") continue;

        currentIndex = (ind + 1) % n;
        currentPID = processes[ind]->getPID();
        remainingQuantum = timeQuantum - 1; // this tick counts as the first
        return {currentPID,timeQuantum};
    }

    // No READY process found
    currentPID = "";
    remainingQuantum = 0;
    return {"INVALID",-1};
}

//reset scheduler state after SimulationEngine::reset()
void RoundRobinScheduler::reset()
{
    currentIndex = 0;
    remainingQuantum = 0;
    currentPID = "";
}