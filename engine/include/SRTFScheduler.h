#pragma once
#include"Scheduler.h"

class SRTFScheduler:public Scheduler
{
    public:
        SchedulingDecision selectNextProcess(const std::vector<Process*>& processes) override;
};