#include <iostream>
#include "../include/FirstFit.h"
#include "../include/RoundRobinScheduler.h"
#include "../include/SimulationEngine.h"

using namespace std;

int main()
{
    // 1. Initialize Memory (60 MB total) and CPU Scheduler (Round Robin, quantum = 2)
    FirstFit memStrategy;
    MemoryManager memManager(60, memStrategy);
    RoundRobinScheduler rrScheduler(2);

    SimulationEngine engine(memManager, rrScheduler);

    // 2. Queue simulated processes: (name, priority, arrivalTime, burstTime, memoryRequired)
    // Total memory is 60 MB. P1 (30 MB) and P2 (20 MB) consume 50 MB.
    // P3 (25 MB) arrives at tick 1, but cannot fit (only 10 MB free) -> will be BLOCKED
    engine.addProcess("WebBrowser", 2, 0, 4, 30); // P1: 30 MB, 4 ticks
    engine.addProcess("AudioPlayer", 1, 0, 3, 20); // P2: 20 MB, 3 ticks
    engine.addProcess("CodeEditor", 3, 1, 3, 25);  // P3: 25 MB, 3 ticks (Waits for RAM)

    cout << "========================================================\n";
    cout << "       MiniOS SIMULATION: PROCESS & MEMORY INTEGRATION  \n";
    cout << "========================================================\n\n";

    // 3. Step through the discrete clock ticks
    int maxTicks = 12;
    for (int t = 0; t < maxTicks; ++t)
    {
        cout << "\n>>> Advancing Simulation (Tick " << engine.getCurrentTick() << ") <<<\n";
        bool hasMoreWork = engine.step();

        memManager.displayMemory();

        if (!hasMoreWork)
        {
            cout << "\nAll processes have terminated successfully!\n";
            break;
        }
    }

    // 4. Output complete JSON telemetry packet representing final state
    cout << "\n========================================================\n";
    cout << "       REAL-TIME JSON TELEMETRY (SENT TO DASHBOARD)    \n";
    cout << "========================================================\n";
    cout << engine.getTelemetryJson() << endl;

    return 0;
}