#pragma once
#include"Scheduler.h"

class SRTFScheduler:public Scheduler
{
    public:
        std::string selectNextProcess(const std::vector<Process>& processes) override;
};