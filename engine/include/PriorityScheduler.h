#pragma once
#include"Scheduler.h"

class PriorityScheduler:public Scheduler
{
    public:
        std::string selectNextProcess(const std::vector<Process*>& processes) override;
};