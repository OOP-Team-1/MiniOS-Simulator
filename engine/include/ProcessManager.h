#pragma once
#include<vector>
#include<memory>
#include <string>
#include"Process.h"


class ProcessManager
{
    private:
        std::vector<std::unique_ptr<Process>> processes;
        int nextPID;
    public:
        ProcessManager();
        Process& createProcess(std::string name,int priority,int arrivalTime,int burstTime,int memoryRequired);
        Process* getProcess(const std::string& PID);
        std::vector<Process*> getAllProcesses();
        std::vector<const Process*> getAllProcesses() const;
};