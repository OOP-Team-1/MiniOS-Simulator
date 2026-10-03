#include"../include/FCFSScheduler.h"

SchedulingDecision FCFSScheduler::selectNextProcess(const std::vector<Process*>& processes)
{
    const Process* selectedProcess=NULL;
    for(const Process* process:processes)
    {
        if(process->getState()!="READY") continue;
        if(selectedProcess==NULL||process->getArrivalTime()<selectedProcess->getArrivalTime())
        {
            selectedProcess=process;
        }
    }
    if(!selectedProcess) return {"INVALID",-1};
    return {selectedProcess->getPID(),selectedProcess->getRemainingTime()};
}