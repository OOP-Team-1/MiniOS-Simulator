#include"../include/SRTFScheduler.h"

std::string SRTFScheduler::selectNextProcess(const std::vector<Process*>& processes)
{
    const Process* selectedProcess=NULL;
    for(const Process* process:processes)
    {
        if(process->getState()!="READY") continue;
        if(!selectedProcess||process->getRemainingTime()<selectedProcess->getRemainingTime())
        {
            selectedProcess=process;
        }
    }
    if(!selectedProcess) return "INVALID";
    return selectedProcess->getPID();
}