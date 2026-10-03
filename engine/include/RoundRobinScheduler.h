#pragma once
#include "Scheduler.h"

class RoundRobinScheduler : public Scheduler
{
private:
    int timeQuantum;
    int currentIndex;
    int remainingQuantum;   // ticks remaining for current process's slice
    std::string currentPID; // PID currently holding the CPU slice

public:
    RoundRobinScheduler(int timeQuantum);
    SchedulingDecision selectNextProcess(const std::vector<Process*>& processes) override;
    void reset() override; //reset index and quantum state
};