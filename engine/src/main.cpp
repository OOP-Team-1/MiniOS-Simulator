#include <iostream>
#include <string>
#include <sstream>
#include "../include/FirstFit.h"
#include "../include/RoundRobinScheduler.h"
#include "../include/SimulationEngine.h"

int main()
{
    // Fast I/O for pipe streaming
    std::ios_base::sync_with_stdio(false);
    std::cin.tie(nullptr);

    // Initial setup: 100 MB RAM, Round Robin quantum = 2
    FirstFit memStrategy;
    MemoryManager memManager(100, memStrategy);
    RoundRobinScheduler rrScheduler(2);
    SimulationEngine engine(memManager, rrScheduler);

    // Preload standard demo processes
    engine.addProcess("WebBrowser", 2, 0, 6, 30);
    engine.addProcess("CodeEditor", 1, 0, 4, 25);
    engine.addProcess("AudioEngine", 3, 1, 3, 20);

    std::string line;
    while (std::getline(std::cin, line))
    {
        if (line.empty()) continue;

        std::istringstream iss(line);
        std::string command;
        iss >> command;

        if (command == "STEP")
        {
            // Fix Bug 3: always emit telemetry, even when step() returns false
            // (all-terminated state). The UI needs to know it's done.
            engine.step();
            std::cout << engine.getTelemetryJson() << "\n";
            std::cout.flush();
        }
        else if (command == "STATE")
        {
            std::cout << engine.getTelemetryJson() << "\n";
            std::cout.flush();
        }
        else if (command == "COMPACT")
        {
            memManager.compact();
            std::cout << engine.getTelemetryJson() << "\n";
            std::cout.flush();
        }
        else if (command == "RESET")
        {
            engine.reset();
            std::cout << engine.getTelemetryJson() << "\n";
            std::cout.flush();
        }
        else if (command == "ADD")
        {
            std::string name;
            int priority, arrivalTime, burstTime, memoryRequired;
            if (iss >> name >> priority >> arrivalTime >> burstTime >> memoryRequired)
            {
                engine.addProcess(name, priority, arrivalTime, burstTime, memoryRequired);
                std::cout << engine.getTelemetryJson() << "\n";
                std::cout.flush();
            }
            else
            {
                std::cerr << "[Engine Error] Invalid ADD syntax. Usage: ADD <name> <priority> <arrival> <burst> <memory>\n";
                std::cerr.flush();
            }
        }
        else if (command == "EXIT")
        {
            break;
        }
        else
        {
            std::cerr << "[Engine Error] Unknown command: " << command << "\n";
            std::cerr.flush();
        }
    }

    return 0;
}