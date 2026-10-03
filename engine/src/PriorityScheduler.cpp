#include"../include/PriorityScheduler.h"

SchedulingDecision PriorityScheduler::selectNextProcess(const std::vector<Process*>& processes)
{
    const Process* selectedProcess=NULL;
    for(const Process* process:processes)
    {
        if(process->getState()!="READY") continue;
        if(!selectedProcess||process->getPriority()<selectedProcess->getPriority())
        {
            selectedProcess=process;
        }
    }
    if(!selectedProcess) return {"INVALID",-1};
    return {selectedProcess->getPID(),selectedProcess->getRemainingTime()};
}