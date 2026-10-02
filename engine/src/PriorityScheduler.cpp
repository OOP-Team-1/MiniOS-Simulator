#include"../include/PriorityScheduler.h"

std::string PriorityScheduler::selectNextProcess(const std::vector<Process>& processes)
{
    const Process* selectedProcess=NULL;
    for(const Process& process:processes)
    {
        if(process.getState()=="TERMINATED") continue;
        if(!selectedProcess||process.getPriority()<selectedProcess->getPriority())
        {
            selectedProcess=&process;
        }
    }
    if(!selectedProcess) return "INVALID";
    return selectedProcess->getPID();
}