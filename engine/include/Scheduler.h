#pragma once
#include<vector>
#include"Process.h"
#include<string>

struct SchedulingDecision
{
    std::string PID;
    int timeUnits;
};

class Scheduler
{
    public:
        virtual SchedulingDecision selectNextProcess(const std::vector<Process*>& processes)=0;
        virtual void reset() {}
        virtual ~Scheduler()=default;
};