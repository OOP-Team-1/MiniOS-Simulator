#include <iostream>
#include "../include/Process.h"
#include "../include/ProcessManager.h"
#include "../include/CPU.h"
#include "../include/FCFSScheduler.h"
#include "../include/SJFScheduler.h"
#include "../include/SRTFScheduler.h"
#include "../include/PriorityScheduler.h"
#include "../include/RoundRobinScheduler.h"

using namespace std;

int main()
{
    ProcessManager manager;
    CPU cpu;

    // Passing: (name, priority, arrivalTime, burstTime, memoryRequired)
    Process& p1 = manager.createProcess("Chrome", 5, 3, 2, 20);
    Process& p2 = manager.createProcess("Browser", 4, 0, 5, 15);
    Process& p3 = manager.createProcess("VSCode", 3, 2, 8, 30);

    p1.setState(ProcessState::READY);
    p2.setState(ProcessState::READY);
    p3.setState(ProcessState::READY);

    cout << "=== Created Processes ===" << endl;
    for (const auto* p : manager.getAllProcesses()) {
        cout << "PID: " << p->getPID() 
             << " | Name: " << p->getName() 
             << " | Memory: " << p->getMemoryRequired() << " MB"
             << " | State: " << p->getState() << endl;
    }

    FCFSScheduler scheduler1;
    SJFScheduler scheduler2;
    SRTFScheduler scheduler3;
    PriorityScheduler scheduler4;
    RoundRobinScheduler scheduler5(2);
    
    std::string nextProcess1 = scheduler1.selectNextProcess(manager.getAllProcesses());
    std::string nextProcess2 = scheduler2.selectNextProcess(manager.getAllProcesses());
    std::string nextProcess3 = scheduler3.selectNextProcess(manager.getAllProcesses());
    std::string nextProcess4 = scheduler4.selectNextProcess(manager.getAllProcesses());
    std::string nextProcess5 = scheduler5.selectNextProcess(manager.getAllProcesses());

    cout << "\n=== Scheduling Tests ===" << endl;
    cout << "Next process PID according to FCFS: " << nextProcess1 << endl;
    cout << "Next process PID according to SJF: " << nextProcess2 << endl;
    cout << "Next process PID according to SRTF: " << nextProcess3 << endl;
    cout << "Next process PID according to Priority: " << nextProcess4 << endl;
    cout << "Next process PID according to RR: " << nextProcess5 << endl;

    return 0;
}