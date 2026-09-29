#include"../include/CPU.h"

CPU::CPU()
{
    this->currentProcess=NULL;
}

void CPU::execute(Process& process,int timeUnits)
{
    currentProcess=&process;
    process.setState(ProcessState::RUNNING);
    process.execute(timeUnits);
    if(process.getRemainingTime()>0)
    {
        process.setState(ProcessState::READY);
    }
    currentProcess=NULL;
}

Process* CPU::getCurrentProcess() const
{
    return this->currentProcess;
}

bool CPU::isIdle() const
{
    return currentProcess==NULL;
}