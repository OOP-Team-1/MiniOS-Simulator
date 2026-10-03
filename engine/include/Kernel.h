#pragma once

#include"ProcessManager.h"
#include"CPU.h"
#include"Scheduler.h"

class Kernel
{
    private:
        ProcessManager processManager;
        CPU cpu;
        Scheduler *scheduler;
    public:
        Kernel(Scheduler* scheduler);
        Process& createProcess(std::string name,int priority,int arrivalTime,int burstTime,int memoryRequired);
        void run();
};