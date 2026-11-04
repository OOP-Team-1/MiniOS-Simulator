#include "../include/Process.h"

#include <algorithm>

Process::Process(std::string PID, std::string name, int priority, int arrivalTime, int burstTime, int memoryRequired, int weight)
{
    this->PID = PID;
    this->name = name;
    this->state = ProcessState::NEW;
    this->priority = priority;
    this->arrivalTime = arrivalTime;
    this->burstTime = burstTime;
    this->remainingTime = burstTime;
    this->memoryRequired = memoryRequired;

    this->vruntime = 0.0;
    this->weight = weight > 0 ? weight : 10;
    this->firstRunTime = -1;
    this->completionTime = -1;
    this->totalCpuTime = 0;
}

std::string Process::getPID() const
{
    return this->PID;
}

std::string Process::getName() const
{
    return this->name;
}

std::string Process::getState() const
{
    switch (this->state)
    {
        case ProcessState::NEW:        return "NEW";
        case ProcessState::READY:      return "READY";
        case ProcessState::RUNNING:    return "RUNNING";
        case ProcessState::BLOCKED:    return "BLOCKED";
        case ProcessState::TERMINATED: return "TERMINATED";
        default:                       return "UNKNOWN";
    }
}

int Process::getPriority() const
{
    return this->priority;
}

int Process::getArrivalTime() const
{
    return this->arrivalTime;
}

int Process::getBurstTime() const
{
    return this->burstTime;
}

int Process::getRemainingTime() const
{
    return this->remainingTime;
}

int Process::getMemoryRequired() const
{
    return this->memoryRequired;
}

void Process::setState(ProcessState state)
{
    this->state = state;
}

void Process::execute(int timeUnits)
{
    if (timeUnits <= 0) return;
    if (this->remainingTime <= timeUnits)
    {
        this->remainingTime = 0;
        this->state = ProcessState::TERMINATED;
    }
    else
    {
        this->remainingTime -= timeUnits;
    }
}

// ── CFS / scheduling statistics ──────────────────────────────────────────────

double Process::getVruntime() const
{
    return this->vruntime;
}

int Process::getWeight() const
{
    return this->weight;
}

int Process::getFirstRunTime() const
{
    return this->firstRunTime;
}

int Process::getCompletionTime() const
{
    return this->completionTime;
}

int Process::getTotalCpuTime() const
{
    return this->totalCpuTime;
}

void Process::setVruntime(double value)
{
    this->vruntime = value;
}

void Process::addVruntime(double delta)
{
    if (delta > 0.0)
    {
        this->vruntime += delta;
    }
}

void Process::setWeight(int value)
{
    this->weight = value > 0 ? value : 10;
}

void Process::markFirstRun(int time)
{
    if (this->firstRunTime < 0)
    {
        this->firstRunTime = time;
    }
}

void Process::markCompleted(int time)
{
    if (this->completionTime < 0)
    {
        this->completionTime = time;
    }
}

void Process::addCpuTime(int timeUnits)
{
    if (timeUnits > 0)
    {
        this->totalCpuTime += timeUnits;
    }
}

void Process::resetSchedulingStats()
{
    this->vruntime = 0.0;
    this->firstRunTime = -1;
    this->completionTime = -1;
    this->totalCpuTime = 0;
}

void Process::resetForRestart()
{
    this->remainingTime = this->burstTime;
    this->state = ProcessState::NEW;
    this->resetSchedulingStats();
}

int Process::getWaitingTime() const
{
    if (this->completionTime < 0)
    {
        return 0;
    }
    return std::max(0, this->completionTime - this->arrivalTime - this->burstTime);
}

int Process::getTurnaroundTime() const
{
    if (this->completionTime < 0)
    {
        return 0;
    }
    return std::max(0, this->completionTime - this->arrivalTime);
}

int Process::getResponseTime() const
{
    if (this->firstRunTime < 0)
    {
        return 0;
    }
    return std::max(0, this->firstRunTime - this->arrivalTime);
}
