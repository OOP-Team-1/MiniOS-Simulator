#include<iostream>
#include"../include/Process.h"
#include"../include/ProcessManager.h"
#include"../include/CPU.h"

using namespace std;

int main()
{
    ProcessManager manager;
    CPU cpu;
    Process p1=manager.createProcess("Chrome",5,0,10);
    cout<<"Before execution: "<<endl;
    std::cout << "State: "
              << (p1.getState())
              << '\n';
    cpu.execute(p1, 3);

    std::cout << "\nAfter executing 3 units:\n";
    std::cout << "Remaining: "
              << p1.getRemainingTime()
              << '\n';

    std::cout << "State: "
              << (p1.getState())
              << '\n';

    cpu.execute(p1, 7);

    std::cout << "\nAfter executing 7 more units:\n";
    std::cout << "Remaining: "
              << p1.getRemainingTime()
              << '\n';

    std::cout << "State: "
              << (p1.getState())
              << '\n';

    return 0;
}