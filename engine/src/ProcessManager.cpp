#include "../include/ProcessManager.h"

ProcessManager::ProcessManager() : nextPID(1) {}

Process& ProcessManager::createProcess(std::string name, int priority, int arrivalTime, int burstTime, int memoryRequired)
{
    std::string PID = "P" + std::to_string(nextPID++);
    processes.push_back(std::make_unique<Process>(PID, name, priority, arrivalTime, burstTime, memoryRequired));
    
    return *processes.back();
}

Process* ProcessManager::getProcess(const std::string& PID)
{
    for (auto& process : processes)
    {
        if (process->getPID() == PID) return process.get();
    }
    return nullptr;
}

std::vector<Process*> ProcessManager::getAllProcesses()
{
    std::vector<Process*> list;
    list.reserve(processes.size());
    for (auto& p : processes) {
        list.push_back(p.get());
    }
    return list;
}

std::vector<const Process*> ProcessManager::getAllProcesses() const
{
    std::vector<const Process*> list;
    list.reserve(processes.size());
    for (const auto& p : processes) {
        list.push_back(p.get());
    }
    return list;
}