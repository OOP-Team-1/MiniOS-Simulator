#include"../include/ProcessManager.h";
#include<vector>
using namespace std;

ProcessManger::ProcessManger()
{
    this->nextPID=1;
}

Process& ProcessManger::createProcess(std::string name,int priority,int arrivalTime,int burstTime)
{
    string PID="P"+to_string(nextPID++);
    this->processes.emplace_back(
        PID,
        name,
        priority,
        arrivalTime,
        burstTime
    );
    return this->processes.back();
}

Process* ProcessManger::getProcess(const std::string& PID)
{
    for(Process& process:processes)
    {
        if(process.getPID()==PID) return &process;
    }
    return NULL;
}

const vector<Process>& ProcessManger::getAllProcesses() const
{
    return processes;
}