#include<iostream>
#include"../include/Process.h"
#include"../include/ProcessManager.h"
#include"../include/CPU.h"
#include"../include/FCFSScheduler.h"
#include"../include/SJFScheduler.h"
#include"../include/SRTFScheduler.h"

using namespace std;

int main()
{
    ProcessManager manager;
    CPU cpu;
    Process& p1 = manager.createProcess("Chrome", 5, 3, 2);
    Process& p2 = manager.createProcess("Browser", 3, 0, 5);
    Process& p3 = manager.createProcess("VSCode", 4, 2, 8);

    
    FCFSScheduler scheduler1;
    SJFScheduler scheduler2;
    SRTFScheduler scheduler3;
    
    std::string nextProcess1 =
    scheduler1.selectNextProcess(
        const_cast<std::vector<Process>&>(
            manager.getAllProcesses()
        )
    );
    std::string nextProcess2=scheduler2.selectNextProcess(
        manager.getAllProcesses()
    );
    std::string nextProcess3=scheduler3.selectNextProcess(
        manager.getAllProcesses()
    );

    cout<<"Next process PID according to FCFS: "<<nextProcess1<<endl;
    cout<<"Next process PID according to SJF: "<<nextProcess2<<endl;
    cout<<"Next process PID according to SRTF: "<<nextProcess3<<endl;

    return 0;
}