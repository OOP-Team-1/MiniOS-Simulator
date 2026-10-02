#include"../include/RoundRobinScheduler.h"

RoundRobinScheduler::RoundRobinScheduler(int timeQuantum)
{
    this->timeQuantum=timeQuantum;
    this->currentIndex=0;
}

std::string RoundRobinScheduler::selectNextProcess(const std::vector<Process*>& processes)
{
    if(processes.empty()) return "INVALID";
    int n=processes.size();
    for(int i=0;i<n;i++)
    {
        int ind=(currentIndex+i)%n;
        if(processes[ind]->getState()!="READY") continue;
        currentIndex=(ind+1)%n;
        return processes[ind]->getPID();
    }
    return "INVALID";
}