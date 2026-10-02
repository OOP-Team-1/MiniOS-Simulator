#pragma once
#include"Scheduler.h"

class FCFSScheduler: public Scheduler
{
    public:
        std::string selectNextProcess(const std::vector<Process*>& processes) override;
};