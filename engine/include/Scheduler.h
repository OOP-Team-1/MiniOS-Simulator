#pragma once
#include<vector>
#include"Process.h"
#include<string>

class Scheduler
{
    public:
        virtual std::string selectNextProcess(const std::vector<Process*>& processes)=0;
        virtual ~Scheduler()=default;
};