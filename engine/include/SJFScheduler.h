#pragma once
#include<vector>
#include"Scheduler.h"

class SJFScheduler:public Scheduler
{
    public:
        SchedulingDecision selectNextProcess(const std::vector<Process*>& processes) override;
};