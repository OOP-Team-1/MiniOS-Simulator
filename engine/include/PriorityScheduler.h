#pragma once
#include"Scheduler.h"

class PriorityScheduler:public Scheduler
{
    public:
        SchedulingDecision selectNextProcess(const std::vector<Process*>& processes) override;
};