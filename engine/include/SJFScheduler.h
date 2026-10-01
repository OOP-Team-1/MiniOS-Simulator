#pragma once
#include<vector>
#include"Scheduler.h"

class SJFScheduler:public Scheduler
{
    public:
        std::string selectNextProcess(const std::vector<Process>& processes) override;
};