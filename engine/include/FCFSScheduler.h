#pragma once
#include"Scheduler.h"

class FCFSScheduler: public Scheduler
{
    public:
        SchedulingDecision selectNextProcess(const std::vector<Process*>& processes) override;
};