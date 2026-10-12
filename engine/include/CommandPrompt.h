#pragma once

#include <string>
#include <vector>
#include <utility>

class FileSystem; // Forward declare the user's FileSystem

class CommandPrompt {
private:
    struct FileEntry {
        std::string name;
        std::string fileId;
        std::string ownerPID;
    };

    std::string username;
    std::string hostname;
    std::string currentPathString;
    std::vector<std::string> commandHistory;
    FileSystem* fs;

    std::vector<std::string> splitCommand(const std::string& cmd);

    // Helpers to interact with the flat file system using its JSON snapshot
    std::string extractJsonValue(const std::string& json, const std::string& key, size_t startPos);
    std::vector<std::string> getSubdirectories(const std::string& path);
    std::vector<std::pair<std::string, std::string>> getFilesInPath(const std::string& path);
    std::vector<FileEntry> getFileEntriesInPath(const std::string& path);

    // File Content I/O helpers using FileSystem read, write, and append
    bool readFileContent(const std::string& fileId, const std::string& ownerPID, std::string& outContent);
    bool writeFileContent(const std::string& fileId, const std::string& ownerPID, const std::string& content);
    bool appendFileContent(const std::string& fileId, const std::string& ownerPID, const std::string& content);

    // Recursive helper for cd with backtracking
    bool changeDirectoryRecursive(const std::vector<std::string>& pathParts, size_t index, const std::string& target, std::string& errorMsg);

    // Command Handlers returning output strings for frontend linking
    std::string executeWhoami();
    std::string executeLs(const std::vector<std::string>& args);
    std::string executeCd(const std::vector<std::string>& args);
    std::string executeEcho(const std::string& fullCmd);
    std::string executeMkdir(const std::vector<std::string>& args);
    std::string executeRm(const std::vector<std::string>& args);
    std::string executePwd();
    std::string executeClear();
    std::string executeTouch(const std::vector<std::string>& args);
    std::string executeCat(const std::vector<std::string>& args);
    std::string executeHistory();
    std::string executeDate();
    std::string executeUname(const std::vector<std::string>& args);
    std::string executeHelp();

public:
    CommandPrompt(const std::string& user, const std::string& host, FileSystem* fileSystem);
    ~CommandPrompt();

    // Frontend linking interface
    std::string executeCommand(const std::string& cmd);
    std::string getPrompt() const;
    void printPrompt();
    std::string getCurrentPath() const;
    std::string getUsername() const;
    std::string getHostname() const;
    const std::vector<std::string>& getCommandHistory() const;

    // Used by Kernel for commands handled outside the basic file-system shell.
    void recordExternalCommand(const std::string& command)
    {
        if (!command.empty()) {
            commandHistory.push_back(command);
        }
    }

    void run();
};
