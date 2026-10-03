#include <iostream>
#include <string>
#include <sstream>

#include "../include/FirstFit.h"
#include "../include/BestFit.h"
#include "../include/WorstFit.h"
#include "../include/RoundRobinScheduler.h"
#include "../include/FCFSScheduler.h"
#include "../include/SJFScheduler.h"
#include "../include/SRTFScheduler.h"
#include "../include/PriorityScheduler.h"
#include "../include/MemoryManager.h"
#include "../include/ContiguousAllocation.h"
#include "../include/FileSystem.h"
#include "../include/SimulationEngine.h"

int main()
{
    std::ios_base::sync_with_stdio(false);
    std::cin.tie(nullptr);

    // ── Memory allocation strategies (all pre-constructed) ───────────────────
    FirstFit  firstFit;
    BestFit   bestFit;
    WorstFit  worstFit;

    // Start with FirstFit
    MemoryManager memManager(100, firstFit);

    // ── Disk ──────────────────────────────────────────────────────────────────
    ContiguousAllocation fileStrategy;
    FileSystem fileSystem(64, 4, fileStrategy);

    // ── CPU Schedulers (all pre-constructed) ──────────────────────────────────
    FCFSScheduler     fcfs;
    SJFScheduler      sjf;
    SRTFScheduler     srtf;
    PriorityScheduler priority;
    RoundRobinScheduler rr(2);   // default quantum = 2

    // Start with Round Robin
    SimulationEngine engine(memManager, fileSystem, rr);

    // Track current config for telemetry
    std::string currentScheduler = "RR";
    int         currentQuantum   = 2;
    std::string currentAlloc     = "FirstFit";

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
        else if (command == "DISK_COMPACT")
        {
            engine.compactDisk();
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
            int p, a, b, m;
            if (iss >> name >> p >> a >> b >> m)
            {
                engine.addProcess(name, p, a, b, m);
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
        else if (command == "FILE_RENAME")
        {
            std::string fileId, newName;
            if (iss >> fileId >> newName)
            {
                engine.renameFile(fileId, newName);
                std::cout << engine.getTelemetryJson() << "\n";
                std::cout.flush();
            }
            else
            {
                std::cerr << "[Engine Error] Usage: FILE_RENAME <fileId> <newName>\n";
                std::cerr.flush();
            }
        }
        else if (command == "SET_SCHEDULER")
        {
            // Usage: SET_SCHEDULER <FCFS|SJF|SRTF|PRIORITY|RR> [quantum]
            std::string type;
            if (iss >> type)
            {
                if (type == "RR")
                {
                    int quantum = 2;
                    iss >> quantum;
                    if (quantum < 1) quantum = 1;
                    rr = RoundRobinScheduler(quantum);
                    engine.setScheduler(rr);
                    currentScheduler = "RR";
                    currentQuantum   = quantum;
                }
                else if (type == "FCFS")
                {
                    engine.setScheduler(fcfs);
                    currentScheduler = "FCFS";
                    currentQuantum   = 0;
                }
                else if (type == "SJF")
                {
                    engine.setScheduler(sjf);
                    currentScheduler = "SJF";
                    currentQuantum   = 0;
                }
                else if (type == "SRTF")
                {
                    engine.setScheduler(srtf);
                    currentScheduler = "SRTF";
                    currentQuantum   = 0;
                }
                else if (type == "PRIORITY")
                {
                    engine.setScheduler(priority);
                    currentScheduler = "PRIORITY";
                    currentQuantum   = 0;
                }
                else
                {
                    std::cerr << "[Engine Error] Unknown scheduler: " << type << "\n";
                    std::cerr.flush();
                    continue;
                }

                engine.setCurrentSchedulerName(currentScheduler, currentQuantum);
                std::cout << engine.getTelemetryJson() << "\n";
                std::cout.flush();
            }
            else
            {
                std::cerr << "[Engine Error] Usage: SET_SCHEDULER <FCFS|SJF|SRTF|PRIORITY|RR> [quantum]\n";
                std::cerr.flush();
            }
        }
        else if (command == "SET_ALLOC")
        {
            // Usage: SET_ALLOC <FirstFit|BestFit|WorstFit>
            std::string type;
            if (iss >> type)
            {
                if (type == "FirstFit")
                {
                    memManager.setStrategy(firstFit);
                    currentAlloc = "FirstFit";
                }
                else if (type == "BestFit")
                {
                    memManager.setStrategy(bestFit);
                    currentAlloc = "BestFit";
                }
                else if (type == "WorstFit")
                {
                    memManager.setStrategy(worstFit);
                    currentAlloc = "WorstFit";
                }
                else
                {
                    std::cerr << "[Engine Error] Unknown strategy: " << type << "\n";
                    std::cerr.flush();
                    continue;
                }

                engine.setCurrentAllocName(currentAlloc);
                std::cout << engine.getTelemetryJson() << "\n";
                std::cout.flush();
            }
            else
            {
                std::cerr << "[Engine Error] Usage: SET_ALLOC <FirstFit|BestFit|WorstFit>\n";
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