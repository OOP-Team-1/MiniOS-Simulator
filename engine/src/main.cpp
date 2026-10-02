#include<iostream>
#include"../include/Process.h"
#include"../include/ProcessManager.h"
#include"../include/CPU.h"
#include"../include/FCFSScheduler.h"
#include"../include/SJFScheduler.h"
#include"../include/SRTFScheduler.h"
#include"../include/PriorityScheduler.h"
#include"../include/RoundRobinScheduler.h"

using namespace std;

int main()
{
    ProcessManager manager;
    CPU cpu;
    Process& p1 = manager.createProcess("Chrome", 5, 3, 2);
    Process& p2 = manager.createProcess("Browser", 4, 0, 5);
    Process& p3 = manager.createProcess("VSCode", 3, 2, 8);
    p1.setState(ProcessState::READY);
    p2.setState(ProcessState::READY);
    p3.setState(ProcessState::READY);

    
    FCFSScheduler scheduler1;
    SJFScheduler scheduler2;
    SRTFScheduler scheduler3;
    PriorityScheduler scheduler4;
    RoundRobinScheduler scheduler5(2);
    
    std::string nextProcess1 =
    scheduler1.selectNextProcess(
        manager.getAllProcesses()
    );
    std::string nextProcess2=scheduler2.selectNextProcess(
        manager.getAllProcesses()
    );
    std::string nextProcess3=scheduler3.selectNextProcess(
        manager.getAllProcesses()
    );
    std::string nextProcess4=scheduler4.selectNextProcess(
        manager.getAllProcesses()
    );
    std::string nextProcess5=scheduler5.selectNextProcess(
        manager.getAllProcesses()
    );
    std::string nextProcess6=scheduler5.selectNextProcess(
        manager.getAllProcesses()
    );
    std::string nextProcess7=scheduler5.selectNextProcess(
        manager.getAllProcesses()
    );

    cout<<"Next process PID according to FCFS: "<<nextProcess1<<endl;
    cout<<"Next process PID according to SJF: "<<nextProcess2<<endl;
    cout<<"Next process PID according to SRTF: "<<nextProcess3<<endl;
    cout<<"Next process PID according to Priority: "<<nextProcess4<<endl;
    cout<<"Next process PID according to RR: "<<nextProcess5<<endl;
    cout<<"Next process PID according to RR: "<<nextProcess6<<endl;
    cout<<"Next process PID according to RR: "<<nextProcess7<<endl;

    return 0;
}