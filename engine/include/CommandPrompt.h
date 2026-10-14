#pragma once

#include <string>
#include <vector>
#include <utility>

class FileSystem; // Forward declare the user's FileSystem

class CommandPrompt {
private:
    std::string username;
    std::string hostname;

    // Real structural position — a Directory id, not a path string.
    // Starts at the user's home directory (a real subdirectory of root).
    std::string currentDirId;
    std::string homeDirId;

    std::vector<std::string> commandHistory;
    FileSystem* fs;

    std::vector<std::string> splitCommand(const std::string& cmd);

    // Resolves a path typed by the user (absolute "/x/y", home-relative "~/x", or relative "x/y", including "." and "..") starting from currentDirId. Returns "" if any component along the way doesn't exist as a directory. 
    //parentOfLast/lastComponent let callers like mkdir/touch split "a/b/newName" into an existing parent dir and a name to create there.
    std::string resolveDirPath(const std::string& path) const;
    bool resolvePathToParentAndName(const std::string& path,
                                     std::string& outParentDirId,
                                     std::string& outName) const;

    // Builds the "~/a/b" display string for a given dirId by walking parentDirId pointers up to the root — used only for the prompt,
    // pwd, and error messages. Never used for lookups.
    std::string buildDisplayPath(const std::string& dirId) const;

    // File Content I/O helpers using FileSystem read, write, and append
    bool readFileContent(const std::string& fileId, const std::string& ownerPID, std::string& outContent);
    bool writeFileContent(const std::string& fileId, const std::string& ownerPID, const std::string& content);
    bool appendFileContent(const std::string& fileId, const std::string& ownerPID, const std::string& content);

    // Command Handlers returning output strings for frontend linking
    std::string executeWhoami();
    std::string executeLs(const std::vector<std::string>& args);
    std::string executeCd(const std::vector<std::string>& args);
    std::string executeEcho(const std::string& fullCmd);
    std::string executePrintf(const std::string& fullCmd);
    std::string executeRead(const std::vector<std::string>& args);
    std::string executeWrite(const std::string& fullCmd);
    std::string executeAppend(const std::string& fullCmd);
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

    // Helpers for parsing and escape sequences
    static std::string stripQuotes(const std::string& str);
    static std::string processEscapes(const std::string& str);
    bool parseRedirection(const std::string& input, std::string& baseCmd, std::string& targetFile, bool& isAppend);
    bool writeToFileOrPath(const std::string& target, const std::string& content, bool isAppend);

public:
    CommandPrompt(const std::string& user, const std::string& host, FileSystem* fileSystem);
    ~CommandPrompt();

    // Frontend linking interface
    std::string executeCommand(const std::string& cmd);
    std::string getPrompt() const;
    void printPrompt();
    std::string getCurrentPath() const;     // display path, e.g. "~/Documents"
    std::string getCurrentDirId() const;    // real dirId, e.g. "D4"
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
