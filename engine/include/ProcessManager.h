#pragma once
#include<vector>
#include"Process.h"


class ProcessManger
{
    private:
        std::vector<Process> processes;
        int nextPID;
    public:
        ProcessManger();
        Process& createProcess(std::string name,int priority,int arrivalTime,int burstTime);
        Process* getProcess(const std::string& PID);
        const std::vector<Process>& getAllProcesses() const;
};