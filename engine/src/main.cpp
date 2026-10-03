#include <iostream>
#include <string>
#include <sstream>

#include "../include/FirstFit.h"
#include "../include/RoundRobinScheduler.h"
#include "../include/MemoryManager.h"
#include "../include/ContiguousAllocation.h"
#include "../include/FileSystem.h"
#include "../include/SimulationEngine.h"

int main()
{
    std::ios_base::sync_with_stdio(false);
    std::cin.tie(nullptr);

    // Memory: 100 MB, First Fit
    FirstFit memStrategy;
    MemoryManager memManager(100, memStrategy);

    // Disk: 64 blocks × 4 KB = 256 KB simulated disk, Contiguous allocation
    ContiguousAllocation fileStrategy;
    FileSystem fileSystem(64, 4, fileStrategy);

    // Scheduler: Round Robin, quantum = 2
    RoundRobinScheduler rrScheduler(2);

    SimulationEngine engine(memManager, fileSystem, rrScheduler);

    // Demo processes
    engine.addProcess("WebBrowser",  2, 0, 6, 30);
    engine.addProcess("CodeEditor",  1, 0, 4, 25);
    engine.addProcess("AudioEngine", 3, 1, 3, 20);

    std::cout << engine.getTelemetryJson() << "\n";
    std::cout.flush();

    std::string line;
    while (std::getline(std::cin, line))
    {
        if (line.empty()) continue;

        std::istringstream iss(line);
        std::string command;
        iss >> command;

        if (command == "STEP")
        {
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
                std::cerr << "[Engine Error] Usage: ADD <name> <priority> <arrival> <burst> <memory>\n";
                std::cerr.flush();
            }
        }
        else if (command == "FILE_CREATE")
        {
            // Usage: FILE_CREATE <ownerPID> <name> <sizeInBlocks> [dirPath]
            std::string ownerPID, name, dirPath;
            int sizeInBlocks;
            if (iss >> ownerPID >> name >> sizeInBlocks)
            {
                if (!(iss >> dirPath)) dirPath = "/";
                engine.createFile(ownerPID, name, sizeInBlocks, dirPath);
                std::cout << engine.getTelemetryJson() << "\n";
                std::cout.flush();
            }
            else
            {
                std::cerr << "[Engine Error] Usage: FILE_CREATE <ownerPID> <name> <sizeInBlocks> [dirPath]\n";
                std::cerr.flush();
            }
        }
        else if (command == "FILE_DELETE")
        {
            // Usage: FILE_DELETE <fileId>
            std::string fileId;
            if (iss >> fileId)
            {
                engine.deleteFile(fileId);
                std::cout << engine.getTelemetryJson() << "\n";
                std::cout.flush();
            }
            else
            {
                std::cerr << "[Engine Error] Usage: FILE_DELETE <fileId>\n";
                std::cerr.flush();
            }
        }
        else if (command == "FILE_OPEN")
        {
            // Usage: FILE_OPEN <fileId> <byPID>
            std::string fileId, byPID;
            if (iss >> fileId >> byPID)
            {
                engine.openFile(fileId, byPID);
                std::cout << engine.getTelemetryJson() << "\n";
                std::cout.flush();
            }
            else
            {
                std::cerr << "[Engine Error] Usage: FILE_OPEN <fileId> <byPID>\n";
                std::cerr.flush();
            }
        }
        else if (command == "FILE_CLOSE")
        {
            // Usage: FILE_CLOSE <fileId> <byPID>
            std::string fileId, byPID;
            if (iss >> fileId >> byPID)
            {
                engine.closeFile(fileId, byPID);
                std::cout << engine.getTelemetryJson() << "\n";
                std::cout.flush();
            }
            else
            {
                std::cerr << "[Engine Error] Usage: FILE_CLOSE <fileId> <byPID>\n";
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