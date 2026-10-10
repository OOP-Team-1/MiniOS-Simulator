// ============================================================
// MINI OS SIMULATOR — ENGINE ENTRY POINT
//
// This binary is spawned as a long-lived child process by the
// Node.js backend (see backend/src/engine/processManager.js).
// It reads newline-terminated commands from stdin, mutates
// simulation state via SimulationEngine, and writes one JSON
// line per command to stdout:
//
//   - Most commands: the full telemetry snapshot (SimulationEngine::getTelemetryJson())
//   - FILE_READ:      a one-shot {"type":"READ_RESULT",...} line instead
//
// This file intentionally contains no interactive/test code —
// see git history for the previous manual test harness.
// ============================================================

#include <iostream>
#include <sstream>
#include <string>
#include <vector>
#include <memory>

#include "../include/SimulationEngine.h"
#include "../include/MemoryManager.h"
#include "../include/FileSystem.h"

#include "../include/FirstFit.h"
#include "../include/BestFit.h"
#include "../include/WorstFit.h"
#include "../include/ContiguousAllocation.h"

#include "../include/FCFSScheduler.h"
#include "../include/SJFScheduler.h"
#include "../include/SRTFScheduler.h"
#include "../include/PriorityScheduler.h"
#include "../include/RoundRobinScheduler.h"

using namespace std;

// ============================================================
// BASE64 (for FILE_WRITE / FILE_APPEND payloads and READ_RESULT content)
// ============================================================

static const std::string BASE64_CHARS =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
    "abcdefghijklmnopqrstuvwxyz"
    "0123456789+/";

static std::string base64Encode(const std::string& input)
{
    std::string out;
    int val = 0, valb = -6;

    for (unsigned char c : input)
    {
        val = (val << 8) + c;
        valb += 8;
        while (valb >= 0)
        {
            out.push_back(BASE64_CHARS[(val >> valb) & 0x3F]);
            valb -= 6;
        }
    }

    if (valb > -6)
    {
        out.push_back(BASE64_CHARS[((val << 8) >> (valb + 8)) & 0x3F]);
    }

    while (out.size() % 4)
    {
        out.push_back('=');
    }

    return out;
}

static std::string base64Decode(const std::string& input)
{
    std::vector<int> table(256, -1);
    for (int i = 0; i < 64; i++)
    {
        table[static_cast<unsigned char>(BASE64_CHARS[i])] = i;
    }

    std::string out;
    int val = 0, valb = -8;

    for (unsigned char c : input)
    {
        if (table[c] == -1) break; // stop at padding '=' or invalid char
        val = (val << 6) + table[c];
        valb += 6;
        if (valb >= 0)
        {
            out.push_back(static_cast<char>((val >> valb) & 0xFF));
            valb -= 8;
        }
    }

    return out;
}

static std::string jsonEscape(const std::string& s)
{
    std::string out;
    out.reserve(s.size());
    for (char c : s)
    {
        switch (c)
        {
            case '"':  out += "\\\""; break;
            case '\\': out += "\\\\"; break;
            case '\n': out += "\\n";  break;
            case '\r': out += "\\r";  break;
            case '\t': out += "\\t";  break;
            default:   out += c;      break;
        }
    }
    return out;
}

// ============================================================
// COMMAND TOKENIZER
// ============================================================

static std::vector<std::string> tokenize(const std::string& line)
{
    std::vector<std::string> tokens;
    std::istringstream iss(line);
    std::string tok;
    while (iss >> tok)
    {
        tokens.push_back(tok);
    }
    return tokens;
}

// ============================================================
// MAIN
// ============================================================

int main()
{
    // ------------------------------------------------------
    // Concrete strategy instances. We keep one of each alive
    // for the whole process lifetime and just repoint which
    // one is active via setStrategy()/setScheduler().
    // ------------------------------------------------------

    FirstFit firstFit;
    BestFit bestFit;
    WorstFit worstFit;
    ContiguousAllocation fileStrategy;

    FCFSScheduler fcfs;
    SJFScheduler sjf;
    SRTFScheduler srtf;
    PriorityScheduler priority;
    RoundRobinScheduler roundRobin(2); // default quantum = 2

    // ------------------------------------------------------
    // Core managers — fixed configuration at startup.
    // (100 MB RAM, FirstFit; 32 blocks x 4 KB disk, Contiguous)
    // ------------------------------------------------------

    MemoryManager memoryManager(100, firstFit);
    FileSystem fileSystem(32, 4, fileStrategy, "data/disk.img");

    SimulationEngine engine(memoryManager, fileSystem, roundRobin);
    engine.setCurrentSchedulerName("RR", 2);
    engine.setCurrentAllocName("FirstFit");

    // ------------------------------------------------------
    // COMMAND LOOP
    // ------------------------------------------------------

    std::string line;

    while (std::getline(std::cin, line))
    {
        if (line.empty()) continue;

        std::vector<std::string> tok = tokenize(line);
        if (tok.empty()) continue;

        const std::string& cmd = tok[0];
        bool emitTelemetry = true; // most commands fall through to a telemetry print

        try
        {
            if (cmd == "EXIT")
            {
                break;
            }
            else if (cmd == "STEP")
            {
                engine.step();
            }
            else if (cmd == "STATE")
            {
                // no-op mutation — just fall through and print current telemetry
            }
            else if (cmd == "RESET")
            {
                engine.reset();
            }
            else if (cmd == "COMPACT")
            {
                memoryManager.compact();
            }
            else if (cmd == "DISK_COMPACT")
            {
                engine.compactDisk();
            }
            else if (cmd == "ADD" && tok.size() >= 6)
            {
                // ADD <name> <priority> <arrival> <burst> <memory>
                engine.addProcess(
                    tok[1],
                    std::stoi(tok[2]),
                    std::stoi(tok[3]),
                    std::stoi(tok[4]),
                    std::stoi(tok[5])
                );
            }
            else if (cmd == "SET_SCHEDULER" && tok.size() >= 2)
            {
                // SET_SCHEDULER <FCFS|SJF|SRTF|PRIORITY|RR> [quantum]
                const std::string& type = tok[1];

                if (type == "FCFS")
                {
                    engine.setScheduler(fcfs);
                    engine.setCurrentSchedulerName("FCFS", 0);
                }
                else if (type == "SJF")
                {
                    engine.setScheduler(sjf);
                    engine.setCurrentSchedulerName("SJF", 0);
                }
                else if (type == "SRTF")
                {
                    engine.setScheduler(srtf);
                    engine.setCurrentSchedulerName("SRTF", 0);
                }
                else if (type == "PRIORITY")
                {
                    engine.setScheduler(priority);
                    engine.setCurrentSchedulerName("PRIORITY", 0);
                }
                else if (type == "RR")
                {
                    int quantum = (tok.size() >= 3) ? std::stoi(tok[2]) : 2;
                    roundRobin = RoundRobinScheduler(quantum);
                    engine.setScheduler(roundRobin);
                    engine.setCurrentSchedulerName("RR", quantum);
                }
            }
            else if (cmd == "SET_ALLOC" && tok.size() >= 2)
            {
                // SET_ALLOC <FirstFit|BestFit|WorstFit>
                const std::string& type = tok[1];

                if (type == "FirstFit")
                {
                    memoryManager.setStrategy(firstFit);
                    engine.setCurrentAllocName("FirstFit");
                }
                else if (type == "BestFit")
                {
                    memoryManager.setStrategy(bestFit);
                    engine.setCurrentAllocName("BestFit");
                }
                else if (type == "WorstFit")
                {
                    memoryManager.setStrategy(worstFit);
                    engine.setCurrentAllocName("WorstFit");
                }
            }
            else if (cmd == "FILE_CREATE" && tok.size() >= 4)
            {
                // FILE_CREATE <ownerPID> <name> <sizeInBlocks> [dirPath]
                std::string dirPath = (tok.size() >= 5) ? tok[4] : "/";
                engine.createFile(tok[1], tok[2], std::stoi(tok[3]), dirPath);
            }
            else if (cmd == "FILE_DELETE" && tok.size() >= 2)
            {
                engine.deleteFile(tok[1]);
            }
            else if (cmd == "FILE_OPEN" && tok.size() >= 3)
            {
                engine.openFile(tok[1], tok[2]);
            }
            else if (cmd == "FILE_CLOSE" && tok.size() >= 3)
            {
                engine.closeFile(tok[1], tok[2]);
            }
            else if (cmd == "FILE_RENAME" && tok.size() >= 3)
            {
                engine.renameFile(tok[1], tok[2]);
            }
            else if (cmd == "FILE_READ" && tok.size() >= 3)
            {
                // FILE_READ <fileId> <byPID>
                // Emits a dedicated READ_RESULT line instead of telemetry.
                bool ok = false;
                std::string content = engine.readFile(tok[1], tok[2], ok);

                std::ostringstream ss;
                ss << "{\"type\":\"READ_RESULT\","
                   << "\"fileId\":\"" << jsonEscape(tok[1]) << "\","
                   << "\"pid\":\"" << jsonEscape(tok[2]) << "\","
                   << "\"ok\":" << (ok ? "true" : "false") << ",";

                if (ok)
                {
                    ss << "\"content\":\"" << base64Encode(content) << "\"";
                }
                else
                {
                    ss << "\"content\":null";
                }

                ss << "}";

                std::cout << ss.str() << std::endl;
                emitTelemetry = false;
            }
            else if (cmd == "FILE_WRITE" && tok.size() >= 3)
            {
                // FILE_WRITE <fileId> <byPID> <base64Content>
                std::string content = (tok.size() >= 4) ? base64Decode(tok[3]) : "";
                engine.writeFile(tok[1], tok[2], content);
            }
            else if (cmd == "FILE_APPEND" && tok.size() >= 4)
            {
                // FILE_APPEND <fileId> <byPID> <base64Content>
                std::string content = base64Decode(tok[3]);
                engine.appendFile(tok[1], tok[2], content);
            }
            else
            {
                // Unknown or malformed command — ignore, still emit telemetry
                // so the frontend's state doesn't silently go stale.
            }
        }
        catch (const std::exception& e)
        {
            // Never let a bad command kill the engine process — report via
            // stdout as a structured error line, then keep the loop alive.
            std::ostringstream ss;
            ss << "{\"type\":\"ERROR\",\"message\":\"" << jsonEscape(e.what()) << "\"}";
            std::cout << ss.str() << std::endl;
            emitTelemetry = false;
        }

        if (emitTelemetry)
        {
            std::cout << engine.getTelemetryJson() << std::endl;
        }
    }

    return 0;
}