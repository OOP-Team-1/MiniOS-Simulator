#pragma once
#include<vector>
#include"Process.h"


class ProcessManager
{
    private:
        std::vector<Process> processes;
        int nextPID;
    public:
        ProcessManager();
        Process& createProcess(std::string name,int priority,int arrivalTime,int burstTime);
        Process* getProcess(const std::string& PID);
        const std::vector<Process>& getAllProcesses() const;
};