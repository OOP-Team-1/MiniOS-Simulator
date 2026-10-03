#include <iostream>

#include "../include/Kernel.h"
#include "../include/FCFSScheduler.h"
#include "../include/SJFScheduler.h"
#include "../include/SRTFScheduler.h"
#include "../include/RoundRobinScheduler.h"
#include "../include/PriorityScheduler.h"

void testFCFS()
{
    std::cout << "\n========== FCFS ==========\n";

    FCFSScheduler scheduler;
    Kernel kernel(&scheduler);

    kernel.createProcess("P1", 1, 0, 5, 100);
    kernel.createProcess("P2", 2, 0, 3, 200);
    kernel.createProcess("P3", 1, 0, 7, 150);

    kernel.run();

    std::cout << "FCFS completed.\n";
}

void testSJF()
{
    std::cout << "\n========== SJF ==========\n";

    SJFScheduler scheduler;
    Kernel kernel(&scheduler);

    kernel.createProcess("P1", 1, 0, 8, 100);
    kernel.createProcess("P2", 2, 0, 3, 200);
    kernel.createProcess("P3", 1, 0, 5, 150);

    kernel.run();

    std::cout << "SJF completed.\n";
}

void testSRTF()
{
    std::cout << "\n========== SRTF ==========\n";

    SRTFScheduler scheduler;
    Kernel kernel(&scheduler);

    kernel.createProcess("P1", 1, 0, 8, 100);
    kernel.createProcess("P2", 2, 0, 3, 200);
    kernel.createProcess("P3", 1, 0, 5, 150);

    kernel.run();

    std::cout << "SRTF completed.\n";
}

void testRoundRobin()
{
    std::cout << "\n====== ROUND ROBIN ======\n";

    RoundRobinScheduler scheduler(3);
    Kernel kernel(&scheduler);

    kernel.createProcess("P1", 1, 0, 8, 100);
    kernel.createProcess("P2", 2, 0, 5, 200);
    kernel.createProcess("P3", 1, 0, 6, 150);

    kernel.run();

    std::cout << "Round Robin completed.\n";
}

void testPriority()
{
    std::cout << "\n======= PRIORITY =======\n";

    PriorityScheduler scheduler;
    Kernel kernel(&scheduler);

    kernel.createProcess("P1", 3, 0, 5, 100);
    kernel.createProcess("P2", 1, 0, 3, 200);
    kernel.createProcess("P3", 2, 0, 7, 150);

    kernel.run();

    std::cout << "Priority completed.\n";
}

int main()
{
    std::cout << "====================================\n";
    std::cout << "       MINI OS KERNEL TEST\n";
    std::cout << "====================================\n";

    testFCFS();
    testSJF();
    testSRTF();
    testRoundRobin();
    testPriority();

    std::cout << "\n====================================\n";
    std::cout << "       ALL TESTS COMPLETED\n";
    std::cout << "====================================\n";

    return 0;
}