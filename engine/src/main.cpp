#include<iostream>
#include"../include/Process.h"
#include"../include/ProcessManager.h"

using namespace std;

int main()
{
    ProcessManger manager;
    Process &p1=manager.createProcess("Chrome",5,0,10);
    Process &p2=manager.createProcess("Compiler",3,1,5);
    Process &p3=manager.createProcess("Music",7,2,8);
    for(const Process& process:manager.getAllProcesses())
    {
        cout
            << process.getPID() << " | "
            << process.getName() << " | "
            << "Priority: " << process.getPriority() << " | "
            << "Arrival: " << process.getArrivalTime() << " | "
            << "Burst: " << process.getBurstTime() << " | "
            << "Remaining: " << process.getRemainingTime()
            << endl;
    }
    Process* found=manager.getProcess("P2");
    if(found)
    {
        cout<<"Found"<<found->getName()<<endl;
    }
    return 0;
}