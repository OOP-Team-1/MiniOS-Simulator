#include"../include/Process.h"

Process::Process(std::string PID,std::string name,int priority,int arrivalTime,int burstTime)
{
    this->PID=PID;
    this->name=name;
    this->state=ProcessState::NEW;
    this->priority=priority;
    this->arrivalTime=arrivalTime;
    this->burstTime=burstTime;
    this->remainingTime=burstTime;
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
    switch(this->state)
    {
        case ProcessState::NEW: return "NEW"; break;
        case ProcessState::READY: return "READY"; break;
        case ProcessState::RUNNING: return "RUNNING"; break;
        case ProcessState::BLOCKED: return "BLOCKED"; break;
        case ProcessState::TERMINATED: return "TERMINATED"; break;
    }
    return "UNKNOWN";
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

void Process::setState(ProcessState state)
{
    this->state=state;
}

void Process::execute(int timeUnits)
{
    if(timeUnits<=0) return;
    if(this->remainingTime<=timeUnits)
    {
        this->remainingTime=0;
        this->state=ProcessState::TERMINATED;
    }
    else
    {
        this->remainingTime-=timeUnits;
    }
}