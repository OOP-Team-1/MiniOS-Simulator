#include"../include/SJFScheduler.h"

std::string SJFScheduler::selectNextProcess(const std::vector<Process*>& processes)
{
    const Process* selectedProcess=NULL;
    for(const Process* process:processes)
    {
        if(process->getState()!="READY") continue;
        if(!selectedProcess||process->getBurstTime()<selectedProcess->getBurstTime())
        {
            selectedProcess=process;
        }
    }
    if(!selectedProcess) return "INVALID";
    return selectedProcess->getPID();
}