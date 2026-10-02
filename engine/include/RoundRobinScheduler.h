#pragma once
#include"Scheduler.h"

class RoundRobinScheduler:public Scheduler
{
    private:
        int timeQuantum;
        int currentIndex;
    public:
        RoundRobinScheduler(int timeQuantum);
        std::string selectNextProcess(const std::vector<Process*>& processes) override;
};