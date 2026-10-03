#include"../include/Kernel.h"

Kernel::Kernel(Scheduler* scheduler)
{
    this->scheduler=scheduler;
}

Process& Kernel::createProcess(std::string name,int priority,int arrivalTime,int burstTime,int memoryRequired)
{
    return processManager.createProcess(
        name,
        priority,
        arrivalTime,
        burstTime,
        memoryRequired
    );
}

void Kernel::run()
{
    scheduler->reset();
    while(true)
    {
        std::vector<Process*> processes=processManager.getAllProcesses();
        bool allTerminated=true;
        for(Process* process:processes)
        {
            if(process->getState()!="TERMINATED")
            {
                allTerminated=false;
                break;
            }
        }
        if(allTerminated) break;
        SchedulingDecision decision=scheduler->selectNextProcess(processes);
        if(decision.PID=="INVALID") break;
        Process* process=processManager.getProcess(decision.PID);
        if(!process) break;
        cpu.execute(*process,decision.timeUnits);
    }
}