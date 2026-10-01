#include<iostream>
#include"../include/Process.h"
#include"../include/ProcessManager.h"
#include"../include/CPU.h"
#include"../include/FCFSScheduler.h"

using namespace std;

int main()
{
    ProcessManager manager;
    CPU cpu;
    Process& p1 = manager.createProcess("Chrome", 5, 3, 10);
    Process& p2 = manager.createProcess("Browser", 3, 0, 5);
    Process& p3 = manager.createProcess("VSCode", 4, 2, 8);

    
    FCFSScheduler scheduler;
    
    std::string nextProcess =
    scheduler.selectNextProcess(
        const_cast<std::vector<Process>&>(
            manager.getAllProcesses()
        )
    );
    
    cout<<"Next process PID : "<<nextProcess<<endl;
    return 0;
}