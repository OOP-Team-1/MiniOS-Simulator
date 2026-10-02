#include "../include/CPU.h"

CPU::CPU() : currentProcess(nullptr)
{
}

void CPU::execute(Process& process, int timeUnits)
{
    currentProcess = &process;
    process.setState(ProcessState::RUNNING);
    process.execute(timeUnits);
    if (process.getRemainingTime() > 0)
    {
        process.setState(ProcessState::READY);
    }
    currentProcess = nullptr;
}

Process* CPU::getCurrentProcess() const
{
    return this->currentProcess;
}

bool CPU::isIdle() const
{
    return currentProcess == nullptr;
}