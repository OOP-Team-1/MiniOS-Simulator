// ============================================================
// MINI OS SIMULATOR — ENGINE ENTRY POINT
// ============================================================

#include <iostream>
#include <sstream>
#include <string>
#include <vector>
#include <memory>
#include <map>

#include "../include/SimulationEngine.h"
#include "../include/MemoryManager.h"
#include "../include/PagingManager.h"
#include "../include/FileSystem.h"
#include "../include/CommandPrompt.h"

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

#include "../include/SerializationUtils.h"

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
    ios_base::sync_with_stdio(false);

    // Strategy instances
    FirstFit firstFit;
    BestFit bestFit;
    WorstFit worstFit;
    ContiguousAllocation fileStrategy;

    FCFSScheduler fcfs;
    SJFScheduler sjf;
    SRTFScheduler srtf;
    PriorityScheduler priority;
    RoundRobinScheduler roundRobin(2);

    // Core managers
    MemoryManager memoryManager(100, firstFit);
    PagingManager pagingManager(256, 4, ReplacementPolicy::LRU);
    FileSystem fileSystem(32, 512, fileStrategy, "data/disk.img");

    SimulationEngine engine(memoryManager, pagingManager, fileSystem, roundRobin);
    engine.setCurrentSchedulerName("RR", 2);
    engine.setCurrentAllocName("FirstFit");

    // Shell/command prompt management per user
    std::map<std::string, std::unique_ptr<CommandPrompt> > shells;
    std::string currentUser = "";

    auto getShellForUser = [&](const std::string& user) -> CommandPrompt* {
        if (user.empty()) return nullptr;
        std::map<std::string, std::unique_ptr<CommandPrompt> >::iterator it = shells.find(user);
        if (it == shells.end()) {
            // Create the shell and point it at the user's home directory.
            std::unique_ptr<CommandPrompt> shell(new CommandPrompt(user, "minios", &fileSystem));
            shell->attachHome();
            // Self-heal only a *completely empty* home (the remains of a wiped
            // filesystem). A home that still holds anything is left alone, so a
            // folder the user deliberately pruned never reappears on reload.
            shell->ensureUsableHomeContents();
            it = shells.insert(std::make_pair(user, std::move(shell))).first;
        }
        return it->second.get();
    };

    std::string line;
    while (std::getline(std::cin, line))
    {
        if (line.empty()) continue;
        // Remove carriage return if present
        if (!line.empty() && line.back() == '\r') line.pop_back();
        if (line.empty()) continue;

        std::vector<std::string> tok = tokenize(line);
        if (tok.empty()) continue;

        const std::string& cmd = tok[0];
        bool emitTelemetry = true;

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
                // just emit telemetry
            }
            else if (cmd == "RESET")
            {
                engine.reset();
            }
            else if (cmd == "COMPACT")
            {
                engine.compactMemory();
            }
            else if (cmd == "DISK_COMPACT")
            {
                engine.compactDisk();
            }
            else if (cmd == "ADD" && tok.size() >= 6)
            {
                engine.addProcess(tok[1], std::stoi(tok[2]), std::stoi(tok[3]), std::stoi(tok[4]), std::stoi(tok[5]));
            }
            else if (cmd == "KILL" && tok.size() >= 2)
            {
                engine.killProcess(tok[1]);
            }
            else if (cmd == "SET_SCHEDULER" && tok.size() >= 2)
            {
                const std::string& type = tok[1];
                if (type == "FCFS") { engine.setScheduler(fcfs); engine.setCurrentSchedulerName("FCFS", 0); }
                else if (type == "SJF") { engine.setScheduler(sjf); engine.setCurrentSchedulerName("SJF", 0); }
                else if (type == "SRTF") { engine.setScheduler(srtf); engine.setCurrentSchedulerName("SRTF", 0); }
                else if (type == "PRIORITY") { engine.setScheduler(priority); engine.setCurrentSchedulerName("PRIORITY", 0); }
                else if (type == "RR") { int quantum = (tok.size() >= 3) ? std::stoi(tok[2]) : 2; roundRobin = RoundRobinScheduler(quantum); engine.setScheduler(roundRobin); engine.setCurrentSchedulerName("RR", quantum); }
            }
            else if (cmd == "SET_ALLOC" && tok.size() >= 2)
            {
                const std::string& type = tok[1];
                if (type == "FirstFit") { memoryManager.setStrategy(firstFit); engine.setCurrentAllocName("FirstFit"); }
                else if (type == "BestFit") { memoryManager.setStrategy(bestFit); engine.setCurrentAllocName("BestFit"); }
                else if (type == "WorstFit") { memoryManager.setStrategy(worstFit); engine.setCurrentAllocName("WorstFit"); }
            }
            else if (cmd == "SET_PAGE_POLICY" && tok.size() >= 2)
            {
                const std::string& pol = tok[1];
                if (pol == "FIFO") pagingManager.setPolicy(ReplacementPolicy::FIFO);
                else if (pol == "LRU") pagingManager.setPolicy(ReplacementPolicy::LRU);
            }
            else if (cmd == "ACCESS_MEM" && tok.size() >= 3)
            {
                engine.accessMemory(tok[1], std::stoi(tok[2]));
            }
            // Directory/File ops
            else if (cmd == "DIR_CREATE" && tok.size() >= 2)
            {
                std::string parentDirId = (tok.size() >= 3) ? tok[2] : "";
                engine.createDirectory(tok[1], parentDirId);
            }
            else if (cmd == "DIR_DELETE" && tok.size() >= 2) { engine.deleteDirectory(tok[1]); }
            else if (cmd == "DIR_RENAME" && tok.size() >= 3) { engine.renameDirectory(tok[1], tok[2]); }
            else if (cmd == "DIR_MOVE" && tok.size() >= 3) { engine.moveDirectory(tok[1], tok[2]); }
            else if (cmd == "FILE_CREATE" && tok.size() >= 4)
            {
                std::string dirId = (tok.size() >= 5) ? tok[4] : "";
                engine.createFile(tok[1], tok[2], std::stoi(tok[3]), dirId);
            }
            else if (cmd == "FILE_DELETE" && tok.size() >= 2) { engine.deleteFile(tok[1]); }
            else if (cmd == "FILE_OPEN" && tok.size() >= 3) { engine.openFile(tok[1], tok[2]); }
            else if (cmd == "FILE_CLOSE" && tok.size() >= 3) { engine.closeFile(tok[1], tok[2]); }
            else if (cmd == "FILE_RENAME" && tok.size() >= 3) { engine.renameFile(tok[1], tok[2]); }
            else if (cmd == "FILE_MOVE" && tok.size() >= 3) { engine.moveFile(tok[1], tok[2]); }
            else if (cmd == "FILE_READ" && tok.size() >= 3)
            {
                bool ok = false;
                std::string content = engine.readFile(tok[1], tok[2], ok);
                std::ostringstream ss;
                ss << "{\"type\":\"READ_RESULT\","
                   << "\"fileId\":\"" << minios::jsonEscape(tok[1]) << "\","
                   << "\"pid\":\"" << minios::jsonEscape(tok[2]) << "\","
                   << "\"ok\":" << (ok ? "true" : "false") << ",";
                if (ok) ss << "\"content\":\"" << minios::base64Encode(content) << "\"";
                else ss << "\"content\":null";
                ss << "}";
                std::cout << ss.str() << std::endl;
                emitTelemetry = false;
            }
            else if (cmd == "FILE_WRITE" && tok.size() >= 4)
            {
                std::string content = minios::base64Decode(tok[3]);
                engine.writeFile(tok[1], tok[2], content);
            }
            else if (cmd == "FILE_APPEND" && tok.size() >= 4)
            {
                std::string content = minios::base64Decode(tok[3]);
                engine.appendFile(tok[1], tok[2], content);
            }
            // Editor commands
            else if (cmd == "FILE_CONTENT" && tok.size() >= 2)
            {
                std::string fileId = tok[1];
                bool ok = false;
                std::string content = fileSystem.readFileForEditor(fileId, 0, ok);
                std::ostringstream ss;
                ss << "{\"type\":\"READ_RESULT\","
                   << "\"fileId\":\"" << minios::jsonEscape(fileId) << "\","
                   << "\"pid\":\"EDITOR\","
                   << "\"ok\":" << (ok ? "true" : "false") << ",";
                if (ok) ss << "\"content\":\"" << minios::base64Encode(content) << "\"";
                else ss << "\"content\":null";
                ss << "}";
                std::cout << ss.str() << std::endl;
                emitTelemetry = false;
            }
            else if (cmd == "FILE_SAVE" && tok.size() >= 4)
            {
                std::string requestId = tok[1];
                std::string fileId = tok[2];
                std::string content = minios::base64Decode(tok[3]);
                bool ok = fileSystem.saveFile(fileId, content, 0);
                std::ostringstream ss;
                ss << "{\"type\":\"FILE_SAVE_RESULT\","
                   << "\"requestId\":\"" << minios::jsonEscape(requestId) << "\","
                   << "\"fileId\":\"" << minios::jsonEscape(fileId) << "\","
                   << "\"ok\":" << (ok ? "true" : "false") << "}";
                std::cout << ss.str() << std::endl;
                // Emit filesystem snapshot so the backend/UI can refresh file metadata (sizes, etc.)
                std::string userForExport = currentUser.empty() ? "user" : currentUser;
                std::string snapOutSave = fileSystem.serialize();
                std::ostringstream ss2;
                ss2 << "{\"type\":\"FS_EXPORT\",\"user\":\"" << minios::jsonEscape(userForExport) << "\",\"snapshot\":\"" << minios::base64Encode(snapOutSave) << "\"}";
                std::cout << ss2.str() << std::endl;
                emitTelemetry = false;
            }
            // FS load/save
            else if (cmd == "FS_LOAD" && tok.size() >= 3)
            {
                std::string user = tok[1];
                std::string payload = tok[2];
                currentUser = user;
                if (payload == "-")
                {
                    // Brand-new user: start from a clean filesystem and seed the
                    // standard home folders exactly once.
                    fileSystem.reset();
                    CommandPrompt* sh = getShellForUser(user);
                    if (sh) {
                        sh->attachHome();
                        sh->initializeDefaultDirectories();
                    }
                }
                else
                {
                    std::string snap = minios::base64Decode(payload);
                    std::string err;
                    if (fileSystem.restoreFromSerialized(snap, err))
                    {
                        CommandPrompt* sh = getShellForUser(user);
                        if (sh) {
                            sh->attachHome();
                            sh->ensureUsableHomeContents();
                        }
                    }
                    else
                    {
                        // Try to init defaults on failure
                        fileSystem.reset();
                        CommandPrompt* sh = getShellForUser(user);
                        if (sh) { sh->attachHome(); sh->initializeDefaultDirectories(); }
                    }
                }
                // Export snapshot
                std::string snapOut = fileSystem.serialize();
                std::ostringstream ss;
                ss << "{\"type\":\"FS_EXPORT\",\"user\":\"" << minios::jsonEscape(user) << "\",\"snapshot\":\"" << minios::base64Encode(snapOut) << "\"}";
                std::cout << ss.str() << std::endl;
                emitTelemetry = false;
            }
            // Shell commands
            else if (cmd == "SHELL" && tok.size() >= 2)
            {
                // second token is base64 command
                std::string b64 = tok[1];
                std::string shellCmd = minios::base64Decode(b64);
                std::string user = currentUser.empty() ? "user" : currentUser;
                CommandPrompt* sh = getShellForUser(user);
                std::string out = "";
                std::string cwdId = "";
                std::string cwdDisp = "";
                std::string prompt = "";
                if (sh) {
                    out = sh->executeCommand(shellCmd);
                    cwdId = sh->getCurrentDirId();
                    cwdDisp = sh->getCurrentPath();
                    prompt = sh->getPrompt();
                    // For 'clear', we pass through special handling
                }
                std::ostringstream ss;
                ss << "{\"type\":\"SHELL_RESULT\","
                   << "\"command\":\"" << minios::jsonEscape(shellCmd) << "\","
                   << "\"output\":\"" << minios::base64Encode(out) << "\","
                   << "\"cwdId\":\"" << minios::jsonEscape(cwdId) << "\","
                   << "\"cwd\":\"" << minios::jsonEscape(cwdDisp) << "\","
                   << "\"prompt\":\"" << minios::base64Encode(prompt) << "\"}";
                std::cout << ss.str() << std::endl;
                // After shell command that might change FS, export
                std::string snapOut2 = fileSystem.serialize();
                std::ostringstream ss2;
                ss2 << "{\"type\":\"FS_EXPORT\",\"user\":\"" << minios::jsonEscape(user) << "\",\"snapshot\":\"" << minios::base64Encode(snapOut2) << "\"}";
                std::cout << ss2.str() << std::endl;
                emitTelemetry = false;
            }
            else if (cmd == "CWD" && tok.size() >= 2)
            {
                std::string dirId = tok[1];
                std::string user = currentUser.empty() ? "user" : currentUser;
                CommandPrompt* sh = getShellForUser(user);
                if (sh) {
                    sh->setCurrentDirId(dirId);
                }
                std::ostringstream ss;
                ss << "{\"type\":\"CWD_RESULT\",\"cwdId\":\"" << minios::jsonEscape(dirId) << "\"}";
                std::cout << ss.str() << std::endl;
                emitTelemetry = false;
            }
            else
            {
                // Unknown command
            }
        }
        catch (const std::exception& e)
        {
            std::ostringstream ss;
            ss << "{\"type\":\"ERROR\",\"message\":\"" << minios::jsonEscape(e.what()) << "\"}";
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
