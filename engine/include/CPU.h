#pragma once
#include"Process.h"

class CPU
{
    private:
        Process* currentProcess;
    public:
        CPU();
        void execute(Process& process,int timeUnits);
        Process* getCurrentProcess() const;
        bool isIdle() const;
};