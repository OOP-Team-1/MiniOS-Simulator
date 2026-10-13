#include "../include/CommandPrompt.h"
#include "../include/FileSystem.h"
#include <sstream>
#include <iostream>
#include <algorithm>
#include <ctime>

CommandPrompt::CommandPrompt(const std::string& user, const std::string& host, FileSystem* fileSystem) 
    : username(user), hostname(host), currentPathString("~"), fs(fileSystem) {
    
    // Create initial directory structure for the simulation using the actual FileSystem
    std::vector<std::string> defaultDirs = {
        "Desktop", "Documents", "Downloads", "Music", "Pictures", 
        "Public", "Templates", "Videos", "linux-lab", "snap"
    };

    for (const auto& dir : defaultDirs) {
        fs->createFile("SYSTEM", ".dir_marker", 1, 0, "~/" + dir);
    }
    // Ensure ~/linux-lab/notes directory exists for CLI usage
    fs->createFile("SYSTEM", ".dir_marker", 1, 0, "~/linux-lab/notes");

    std::string f1 = fs->createFile("SYSTEM", "Computer Organization and Architecture.pdf", 1, 0, "~/Downloads");
    std::string f2 = fs->createFile("SYSTEM", "code_1.140.0-1790759618_amd64.deb", 1, 0, "~/Downloads");
    std::string f3 = fs->createFile("SYSTEM", "java-swing-concepts.pdf", 1, 0, "~/Downloads");

    if (!f1.empty()) writeFileContent(f1, "SYSTEM", "%PDF-1.4\n1 0 obj\n<< /Title (COA Notes) >>\nendobj\n");
    if (!f2.empty()) writeFileContent(f2, "SYSTEM", "!<arch>\ndebian-binary   1580000000  0     0     100644  4         `\n2.0\n");
    if (!f3.empty()) writeFileContent(f3, "SYSTEM", "Java Swing Concepts:\n- JFrame\n- JPanel\n- JButton\n");
}

CommandPrompt::~CommandPrompt() {}

std::string CommandPrompt::extractJsonValue(const std::string& json, const std::string& key, size_t startPos) {
    std::string searchKey = "\"" + key + "\":\"";
    size_t pos = json.find(searchKey, startPos);
    if (pos == std::string::npos) return "";
    pos += searchKey.length();
    size_t endPos = json.find("\"", pos);
    return json.substr(pos, endPos - pos);
}

std::vector<CommandPrompt::FileEntry> CommandPrompt::getFileEntriesInPath(const std::string& path) {
    std::vector<FileEntry> result;
    std::string json = fs->getSnapshotAsJson();
    
    size_t filesArrayPos = json.find("\"files\":[");
    if (filesArrayPos == std::string::npos) return result;

    size_t pos = filesArrayPos;
    while (true) {
        pos = json.find("{\"fileId\":", pos);
        if (pos == std::string::npos) break;
        
        std::string fileId = extractJsonValue(json, "fileId", pos);
        std::string name = extractJsonValue(json, "name", pos);
        std::string ownerPID = extractJsonValue(json, "ownerPID", pos);
        std::string dirPath = extractJsonValue(json, "dirPath", pos);
        
        if (dirPath == path && name != ".dir_marker") {
            result.push_back({name, fileId, ownerPID.empty() ? "USER" : ownerPID});
        }
        pos += 10;
    }
    return result;
}

std::vector<std::pair<std::string, std::string>> CommandPrompt::getFilesInPath(const std::string& path) {
    std::vector<std::pair<std::string, std::string>> result;
    auto entries = getFileEntriesInPath(path);
    for (const auto& e : entries) {
        result.push_back({e.name, e.fileId});
    }
    return result;
}

std::vector<std::string> CommandPrompt::getSubdirectories(const std::string& path) {
    std::vector<std::string> dirs;
    std::string json = fs->getSnapshotAsJson();
    
    size_t filesArrayPos = json.find("\"files\":[");
    if (filesArrayPos == std::string::npos) return dirs;

    size_t pos = filesArrayPos;
    while (true) {
        pos = json.find("{\"fileId\":", pos);
        if (pos == std::string::npos) break;
        
        std::string dirPath = extractJsonValue(json, "dirPath", pos);
        
        std::string prefix = path;
        if (prefix.back() != '/') prefix += "/";
        
        if (dirPath.find(prefix) == 0 && dirPath.length() > prefix.length()) {
            std::string remaining = dirPath.substr(prefix.length());
            size_t slashPos = remaining.find("/");
            std::string subDir = (slashPos == std::string::npos) ? remaining : remaining.substr(0, slashPos);
            
            if (std::find(dirs.begin(), dirs.end(), subDir) == dirs.end()) {
                dirs.push_back(subDir);
            }
        }
        pos += 10;
    }
    return dirs;
}

std::string CommandPrompt::stripQuotes(const std::string& str) {
    if (str.length() >= 2) {
        if ((str.front() == '"' && str.back() == '"') || (str.front() == '\'' && str.back() == '\'')) {
            return str.substr(1, str.length() - 2);
        }
    }
    return str;
}

std::string CommandPrompt::processEscapes(const std::string& str) {
    std::string result;
    result.reserve(str.size());
    for (size_t i = 0; i < str.size(); ++i) {
        if (str[i] == '\\' && i + 1 < str.size()) {
            switch (str[i + 1]) {
                case 'n': result += '\n'; ++i; break;
                case 't': result += '\t'; ++i; break;
                case 'r': result += '\r'; ++i; break;
                case '\\': result += '\\'; ++i; break;
                case '"': result += '"'; ++i; break;
                case '\'': result += '\''; ++i; break;
                default:
                    result += str[i];
                    break;
            }
        } else {
            result += str[i];
        }
    }
    return result;
}

bool CommandPrompt::parseRedirection(const std::string& input, std::string& baseCmd, std::string& targetFile, bool& isAppend) {
    bool inDoubleQuotes = false;
    bool inSingleQuotes = false;
    bool escaped = false;
    size_t redirectPos = std::string::npos;
    isAppend = false;

    for (size_t i = 0; i < input.size(); ++i) {
        char c = input[i];
        if (escaped) {
            escaped = false;
        } else if (c == '\\') {
            escaped = true;
        } else if (c == '"' && !inSingleQuotes) {
            inDoubleQuotes = !inDoubleQuotes;
        } else if (c == '\'' && !inDoubleQuotes) {
            inSingleQuotes = !inSingleQuotes;
        } else if (!inDoubleQuotes && !inSingleQuotes) {
            if (c == '>') {
                redirectPos = i;
                if (i + 1 < input.size() && input[i + 1] == '>') {
                    isAppend = true;
                }
                break;
            }
        }
    }

    if (redirectPos == std::string::npos) {
        return false;
    }

    baseCmd = input.substr(0, redirectPos);
    size_t fileStart = redirectPos + (isAppend ? 2 : 1);
    std::string rawFile = input.substr(fileStart);
    
    size_t s = rawFile.find_first_not_of(" \t\r\n");
    size_t e = rawFile.find_last_not_of(" \t\r\n");
    if (s != std::string::npos && e != std::string::npos) {
        targetFile = rawFile.substr(s, e - s + 1);
    } else {
        targetFile = "";
    }
    targetFile = stripQuotes(targetFile);

    size_t be = baseCmd.find_last_not_of(" \t\r\n");
    if (be != std::string::npos) {
        baseCmd = baseCmd.substr(0, be + 1);
    }

    return true;
}

bool CommandPrompt::writeToFileOrPath(const std::string& target, const std::string& content, bool isAppend) {
    std::string filename = stripQuotes(target);
    std::string targetDir = currentPathString;
    
    size_t lastSlash = filename.find_last_of('/');
    if (lastSlash != std::string::npos) {
        std::string dirPart = filename.substr(0, lastSlash);
        filename = filename.substr(lastSlash + 1);
        if (dirPart == "~") targetDir = "~";
        else if (dirPart.find("~") == 0) targetDir = dirPart;
        else if (targetDir == "~") targetDir = "~/" + dirPart;
        else targetDir = targetDir + "/" + dirPart;
    }

    std::string fileId = "";
    std::string ownerPID = "USER";
    auto entries = getFileEntriesInPath(targetDir);
    for (const auto& e : entries) {
        if (e.name == filename) {
            fileId = e.fileId;
            ownerPID = e.ownerPID;
            break;
        }
    }

    if (fileId.empty()) {
        fileId = fs->createFile("USER", filename, 1, 0, targetDir);
        ownerPID = "USER";
    }

    if (fileId.empty()) return false;

    if (isAppend) {
        return appendFileContent(fileId, ownerPID, content);
    } else {
        return writeFileContent(fileId, ownerPID, content);
    }
}

bool CommandPrompt::readFileContent(const std::string& fileId, const std::string& ownerPID, std::string& outContent) {
    fs->closeFile(fileId, ownerPID);
    fs->closeFile(fileId, "USER");
    fs->closeFile(fileId, "SYSTEM");

    bool opened = fs->openFile(fileId, ownerPID, 0);
    if (!opened) {
        opened = fs->openFile(fileId, "USER", 0) || fs->openFile(fileId, "SYSTEM", 0);
    }
    bool ok = false;
    outContent = fs->readFile(fileId, ownerPID, 0, ok);
    if (!ok) {
        outContent = fs->readFile(fileId, "USER", 0, ok);
    }
    if (!ok) {
        outContent = fs->readFile(fileId, "SYSTEM", 0, ok);
    }
    fs->closeFile(fileId, ownerPID);
    fs->closeFile(fileId, "USER");
    fs->closeFile(fileId, "SYSTEM");
    return ok;
}

bool CommandPrompt::writeFileContent(const std::string& fileId, const std::string& ownerPID, const std::string& content) {
    fs->closeFile(fileId, ownerPID);
    fs->closeFile(fileId, "USER");
    fs->closeFile(fileId, "SYSTEM");

    bool opened = fs->openFile(fileId, ownerPID, 0);
    if (!opened) {
        opened = fs->openFile(fileId, "USER", 0) || fs->openFile(fileId, "SYSTEM", 0);
    }
    bool ok = fs->writeFile(fileId, ownerPID, content, 0);
    if (!ok) {
        ok = fs->writeFile(fileId, "USER", content, 0) || fs->writeFile(fileId, "SYSTEM", content, 0);
    }
    fs->closeFile(fileId, ownerPID);
    fs->closeFile(fileId, "USER");
    fs->closeFile(fileId, "SYSTEM");
    return ok;
}

bool CommandPrompt::appendFileContent(const std::string& fileId, const std::string& ownerPID, const std::string& content) {
    fs->closeFile(fileId, ownerPID);
    fs->closeFile(fileId, "USER");
    fs->closeFile(fileId, "SYSTEM");

    bool opened = fs->openFile(fileId, ownerPID, 0);
    if (!opened) {
        opened = fs->openFile(fileId, "USER", 0) || fs->openFile(fileId, "SYSTEM", 0);
    }
    bool ok = fs->appendFile(fileId, ownerPID, content, 0);
    if (!ok) {
        ok = fs->appendFile(fileId, "USER", content, 0) || fs->appendFile(fileId, "SYSTEM", content, 0);
    }
    fs->closeFile(fileId, ownerPID);
    fs->closeFile(fileId, "USER");
    fs->closeFile(fileId, "SYSTEM");
    return ok;
}

std::string CommandPrompt::getPrompt() const {
    std::string green = "\033[1;32m";
    std::string blue = "\033[1;34m";
    std::string reset = "\033[0m";
    return green + username + "@" + hostname + reset + ":" 
         + blue + currentPathString + reset + "$ ";
}

void CommandPrompt::printPrompt() {
    std::cout << getPrompt();
}

std::string CommandPrompt::getCurrentPath() const {
    return currentPathString;
}

std::string CommandPrompt::getUsername() const {
    return username;
}

std::string CommandPrompt::getHostname() const {
    return hostname;
}

const std::vector<std::string>& CommandPrompt::getCommandHistory() const {
    return commandHistory;
}

std::vector<std::string> CommandPrompt::splitCommand(const std::string& cmd) {
    std::vector<std::string> tokens;
    std::string current;
    bool inDoubleQuotes = false;
    bool inSingleQuotes = false;

    for (size_t i = 0; i < cmd.size(); ++i) {
        char c = cmd[i];
        if (c == '\\' && i + 1 < cmd.size() && (cmd[i + 1] == '"' || cmd[i + 1] == '\'' || cmd[i + 1] == '\\')) {
            current += cmd[i + 1];
            ++i;
        } else if (c == '"' && !inSingleQuotes) {
            inDoubleQuotes = !inDoubleQuotes;
        } else if (c == '\'' && !inDoubleQuotes) {
            inSingleQuotes = !inSingleQuotes;
        } else if (std::isspace(static_cast<unsigned char>(c)) && !inDoubleQuotes && !inSingleQuotes) {
            if (!current.empty()) {
                tokens.push_back(current);
                current.clear();
            }
        } else {
            current += c;
        }
    }
    if (!current.empty()) {
        tokens.push_back(current);
    }
    return tokens;
}

std::string CommandPrompt::executeWhoami() { 
    return username + "\n"; 
}

std::string CommandPrompt::executePwd() {
    std::string absolutePath = currentPathString;
    if (absolutePath.find("~") == 0) {
        absolutePath.replace(0, 1, "/home/" + username);
    }
    return absolutePath + "\n";
}

std::string CommandPrompt::executeClear() { 
    return "\033[2J\033[1;1H"; 
}

std::string CommandPrompt::executeLs(const std::vector<std::string>& args) {
    (void)args;
    std::string blue = "\033[1;34m";
    std::string reset = "\033[0m";
    std::string red = "\033[1;31m";

    std::ostringstream out;
    auto dirs = getSubdirectories(currentPathString);
    for (const auto& dir : dirs) {
        out << blue << dir << reset << "  ";
    }

    auto files = getFilesInPath(currentPathString);
    for (const auto& f : files) {
        std::string file = f.first;
        if (file.find(".deb") != std::string::npos) {
            out << red << file << reset << "  ";
        } else if (file.find(" ") != std::string::npos) {
            out << "'" << file << "'  ";
        } else {
            out << file << "  ";
        }
    }
    out << "\n";
    return out.str();
}

bool CommandPrompt::changeDirectoryRecursive(const std::vector<std::string>& pathParts, size_t index, const std::string& target, std::string& errorMsg) {
    // Base case: all path segments processed successfully
    if (index >= pathParts.size()) {
        return true;
    }

    std::string p = pathParts[index];
    std::string savedPath = currentPathString;

    if (p == ".") {
        // Stay in current directory, advance to next segment
        if (changeDirectoryRecursive(pathParts, index + 1, target, errorMsg)) {
            return true;
        }
        currentPathString = savedPath;
        return false;
    } else if (p == "..") {
        if (currentPathString != "~") {
            size_t lastSlash = currentPathString.find_last_of('/');
            if (lastSlash != std::string::npos && lastSlash != 0) {
                currentPathString = currentPathString.substr(0, lastSlash);
            } else {
                currentPathString = "~";
            }
        }
        if (changeDirectoryRecursive(pathParts, index + 1, target, errorMsg)) {
            return true;
        }
        // Backtrack
        currentPathString = savedPath;
        return false;
    } else {
        auto dirs = getSubdirectories(currentPathString);
        if (std::find(dirs.begin(), dirs.end(), p) != dirs.end()) {
            if (currentPathString == "~") {
                currentPathString = "~/" + p;
            } else {
                currentPathString = currentPathString + "/" + p;
            }

            // Recurse to next segment
            if (changeDirectoryRecursive(pathParts, index + 1, target, errorMsg)) {
                return true;
            }

            // Backtrack if any deeper directory was not found
            currentPathString = savedPath;
            return false;
        } else {
            // Check if it exists as a regular file
            auto files = getFilesInPath(currentPathString);
            bool isFile = false;
            for (const auto& f : files) {
                if (f.first == p) {
                    isFile = true;
                    break;
                }
            }

            if (isFile) {
                errorMsg = "bash: cd: " + target + ": Not a directory\n";
            } else {
                errorMsg = "bash: cd: " + target + ": No such file or directory\n";
            }

            return false;
        }
    }
}

std::string CommandPrompt::executeCd(const std::vector<std::string>& args) {
    if (args.size() < 2 || args[1] == "~") {
        currentPathString = "~";
        return "";
    }

    std::string target = args[1];
    std::vector<std::string> pathParts;
    std::stringstream ss(target);
    std::string part;
    while (std::getline(ss, part, '/')) {
        if (!part.empty()) {
            pathParts.push_back(part);
        }
    }

    std::string originalPath = currentPathString;

    if (target[0] == '/') {
        currentPathString = "~"; // Treat root as ~ in this mock
    } else if (target[0] == '~') {
        currentPathString = "~";
        if (!pathParts.empty() && pathParts[0] == "~") {
            pathParts.erase(pathParts.begin());
        }
    }

    std::string errorMsg = "";
    bool success = changeDirectoryRecursive(pathParts, 0, target, errorMsg);
    if (!success) {
        // Backtrack to the directory from where the user called it
        currentPathString = originalPath;
        return errorMsg;
    }

    return "";
}

std::string CommandPrompt::executeEcho(const std::string& fullCmd) {
    std::string baseCmd, targetFile;
    bool isAppend = false;
    if (parseRedirection(fullCmd, baseCmd, targetFile, isAppend)) {
        std::string output = executeEcho(baseCmd);
        writeToFileOrPath(targetFile, output, isAppend);
        return "";
    }

    std::vector<std::string> args = splitCommand(fullCmd);
    if (args.size() <= 1) return "\n";

    bool interpretEscapes = false;
    bool noTrailingNewline = false;
    size_t startIdx = 1;

    while (startIdx < args.size() && args[startIdx].rfind("-", 0) == 0 && args[startIdx].size() > 1) {
        if (args[startIdx] == "-e") interpretEscapes = true;
        else if (args[startIdx] == "-n") noTrailingNewline = true;
        else if (args[startIdx] == "-en" || args[startIdx] == "-ne") {
            interpretEscapes = true;
            noTrailingNewline = true;
        } else break;
        startIdx++;
    }

    std::ostringstream out;
    for (size_t i = startIdx; i < args.size(); ++i) {
        std::string text = stripQuotes(args[i]);
        if (interpretEscapes) {
            text = processEscapes(text);
        }
        out << text << (i + 1 < args.size() ? " " : "");
    }
    if (!noTrailingNewline) {
        out << "\n";
    }
    return out.str();
}

std::string CommandPrompt::executePrintf(const std::string& fullCmd) {
    std::string baseCmd, targetFile;
    bool isAppend = false;
    if (parseRedirection(fullCmd, baseCmd, targetFile, isAppend)) {
        std::string output = executePrintf(baseCmd);
        writeToFileOrPath(targetFile, output, isAppend);
        return "";
    }

    std::vector<std::string> args = splitCommand(fullCmd);
    if (args.size() <= 1) return "";

    std::string format = stripQuotes(args[1]);
    std::string processed = processEscapes(format);

    if (args.size() > 2) {
        size_t argIdx = 2;
        std::string result;
        for (size_t i = 0; i < processed.size(); ++i) {
            if (processed[i] == '%' && i + 1 < processed.size() && (processed[i + 1] == 's' || processed[i + 1] == 'd')) {
                if (argIdx < args.size()) {
                    result += stripQuotes(args[argIdx++]);
                }
                i++;
            } else {
                result += processed[i];
            }
        }
        return result;
    }

    return processed;
}

std::string CommandPrompt::executeRead(const std::vector<std::string>& args) {
    if (args.size() < 2) return "read: missing file operand\n";
    return executeCat(args);
}

std::string CommandPrompt::executeWrite(const std::string& fullCmd) {
    std::vector<std::string> args = splitCommand(fullCmd);
    if (args.size() < 2) {
        return "write: missing file operand\nUsage: write <filename> <content>\n";
    }
    std::string target = args[1];
    std::string content = "";
    if (args.size() >= 3) {
        size_t pos = fullCmd.find(target);
        if (pos != std::string::npos) {
            pos += target.length();
            content = fullCmd.substr(pos);
            size_t s = content.find_first_not_of(" \t");
            if (s != std::string::npos) content = content.substr(s);
            content = stripQuotes(content);
            content = processEscapes(content);
        }
    }
    bool ok = writeToFileOrPath(target, content, false);
    if (!ok) {
        return "write: failed to write to " + target + "\n";
    }
    return "";
}

std::string CommandPrompt::executeAppend(const std::string& fullCmd) {
    std::vector<std::string> args = splitCommand(fullCmd);
    if (args.size() < 2) {
        return "append: missing file operand\nUsage: append <filename> <content>\n";
    }
    std::string target = args[1];
    std::string content = "";
    if (args.size() >= 3) {
        size_t pos = fullCmd.find(target);
        if (pos != std::string::npos) {
            pos += target.length();
            content = fullCmd.substr(pos);
            size_t s = content.find_first_not_of(" \t");
            if (s != std::string::npos) content = content.substr(s);
            content = stripQuotes(content);
            content = processEscapes(content);
        }
    }
    bool ok = writeToFileOrPath(target, content, true);
    if (!ok) {
        return "append: failed to append to " + target + "\n";
    }
    return "";
}

std::string CommandPrompt::executeMkdir(const std::vector<std::string>& args) {
    if (args.size() < 2) { 
        return "mkdir: missing operand\n"; 
    }
    std::string dirName = stripQuotes(args[1]);
    std::string newDirPath = (currentPathString == "~") ? currentPathString + "/" + dirName : currentPathString + "/" + dirName;
    fs->createFile("USER", ".dir_marker", 1, 0, newDirPath);
    return "";
}

std::string CommandPrompt::executeRm(const std::vector<std::string>& args) {
    if (args.size() < 2) { 
        return "rm: missing operand\n"; 
    }
    std::string target = stripQuotes(args[1]);
    bool isRecursive = (target == "-r" || target == "-rf");
    if (isRecursive) {
        if (args.size() < 3) { 
            return "rm: missing operand\n"; 
        }
        target = stripQuotes(args[2]);
    }

    auto entries = getFileEntriesInPath(currentPathString);
    for (const auto& e : entries) {
        if (e.name == target) {
            fs->deleteFile(e.fileId);
            return "";
        }
    }

    auto dirs = getSubdirectories(currentPathString);
    if (std::find(dirs.begin(), dirs.end(), target) != dirs.end()) {
        if (!isRecursive) {
            return "rm: cannot remove '" + target + "': Is a directory\n";
        } else {
            std::string targetDirPath = (currentPathString == "~") ? currentPathString + "/" + target : currentPathString + "/" + target;
            std::string json = fs->getSnapshotAsJson();
            size_t pos = 0;
            std::vector<std::string> toDelete;
            while (true) {
                pos = json.find("{\"fileId\":", pos);
                if (pos == std::string::npos) break;
                std::string fileId = extractJsonValue(json, "fileId", pos);
                std::string dirPath = extractJsonValue(json, "dirPath", pos);
                if (dirPath.find(targetDirPath) == 0) toDelete.push_back(fileId);
                pos += 10;
            }
            for (const auto& id : toDelete) fs->deleteFile(id);
            return "";
        }
    }

    return "rm: cannot remove '" + target + "': No such file or directory\n";
}

std::string CommandPrompt::executeTouch(const std::vector<std::string>& args) {
    if (args.size() < 2) { 
        return "touch: missing file operand\n"; 
    }
    auto entries = getFileEntriesInPath(currentPathString);
    for (size_t i = 1; i < args.size(); ++i) {
        std::string filename = stripQuotes(args[i]);
        bool exists = false;
        for (const auto& e : entries) {
            if (e.name == filename) {
                exists = true;
                if (fs->openFile(e.fileId, e.ownerPID, 0)) {
                    fs->closeFile(e.fileId, e.ownerPID);
                }
                break;
            }
        }
        if (!exists) {
            std::string fileId = fs->createFile("USER", filename, 1, 0, currentPathString);
            if (!fileId.empty()) {
                writeFileContent(fileId, "USER", "");
            }
        }
    }
    return "";
}

std::string CommandPrompt::executeCat(const std::vector<std::string>& args) {
    if (args.size() < 2) return "";
    std::ostringstream out;
    
    for (size_t i = 1; i < args.size(); ++i) {
        std::string target = stripQuotes(args[i]);
        std::string targetDir = currentPathString;
        std::string filename = target;
        
        size_t lastSlash = target.find_last_of('/');
        if (lastSlash != std::string::npos) {
            std::string dirPart = target.substr(0, lastSlash);
            filename = target.substr(lastSlash + 1);
            if (dirPart == "~") targetDir = "~";
            else if (dirPart.find("~") == 0) targetDir = dirPart;
            else if (targetDir == "~") targetDir = "~/" + dirPart;
            else targetDir = targetDir + "/" + dirPart;
        }

        auto entries = getFileEntriesInPath(targetDir);
        bool found = false;
        for (const auto& e : entries) {
            if (e.name == filename) {
                found = true;
                std::string content;
                bool ok = readFileContent(e.fileId, e.ownerPID, content);
                if (ok) {
                    out << content;
                } else {
                    out << "[File System Emulator] Binary file or content not readable by OS.\n";
                }
                break;
            }
        }
        
        if (!found) {
            auto dirs = getSubdirectories(targetDir);
            if (std::find(dirs.begin(), dirs.end(), filename) != dirs.end()) {
                out << "cat: " << target << ": Is a directory\n";
            } else {
                out << "cat: '" << target << "': No such file or directory\n";
            }
        }
    }
    return out.str();
}

std::string CommandPrompt::executeHistory() {
    std::ostringstream out;
    for (size_t i = 0; i < commandHistory.size(); ++i) {
        out << "  " << (i + 1) << "  " << commandHistory[i] << "\n";
    }
    return out.str();
}

std::string CommandPrompt::executeDate() {
    time_t now = time(0);
    char* dt = ctime(&now);
    return dt ? std::string(dt) : "\n";
}

std::string CommandPrompt::executeUname(const std::vector<std::string>& args) {
    bool all = (args.size() > 1 && (args[1] == "-a" || args[1] == "--all"));
    if (all) {
        return "Linux " + hostname + " 5.15.0-generic #1 SMP x86_64 x86_64 GNU/Linux\n";
    } else {
        return "Linux\n";
    }
}

std::string CommandPrompt::executeHelp() {
    std::ostringstream out;
    out << "MiniOS Command Prompt - Supported Commands:\n"
        << "  whoami   - Print the current user\n"
        << "  pwd      - Print working directory\n"
        << "  ls       - List directory contents\n"
        << "  cd       - Change directory\n"
        << "  mkdir    - Create a directory\n"
        << "  rm       - Remove files or directories (use -r for recursive)\n"
        << "  touch    - Create an empty file\n"
        << "  cat      - Read a file\n"
        << "  echo     - Write/print text (supports -e, -n, and > / >> redirection)\n"
        << "  printf   - Formatted print with escapes (supports > / >> redirection)\n"
        << "  read     - Read file content (alias to cat)\n"
        << "  write    - Directly overwrite file content: write <file> <content>\n"
        << "  append   - Directly append file content: append <file> <content>\n"
        << "  history  - View command history\n"
        << "  date     - Show system date and time\n"
        << "  uname    - Print system information\n"
        << "  clear    - Clear the terminal screen\n"
        << "  help     - Show this help message\n"
        << "  exit     - Close the terminal\n";
    return out.str();
}

std::string CommandPrompt::executeCommand(const std::string& input) {
    if (input.empty()) return "";
    commandHistory.push_back(input);
    if (input.find(";") != std::string::npos) { 
        return "bash: syntax error near unexpected token `;'\n"; 
    }

    // Check for general redirection > or >> outside quotes
    std::string baseCmd, targetFile;
    bool isAppend = false;
    if (parseRedirection(input, baseCmd, targetFile, isAppend)) {
        if (targetFile.empty()) {
            return "bash: syntax error near unexpected token `newline'\n";
        }
        std::string output = executeCommand(baseCmd);
        bool ok = writeToFileOrPath(targetFile, output, isAppend);
        if (!ok) {
            return "bash: " + targetFile + ": Permission denied or disk full\n";
        }
        return "";
    }
    
    std::vector<std::string> args = splitCommand(input);
    if (args.empty()) return "";
    std::string cmd = args[0];

    if (cmd == "exit") return "";
    else if (cmd == "whoami") return executeWhoami();
    else if (cmd == "ls") return executeLs(args);
    else if (cmd == "cd") return executeCd(args);
    else if (cmd == "echo") return executeEcho(input);
    else if (cmd == "printf") return executePrintf(input);
    else if (cmd == "read") return executeRead(args);
    else if (cmd == "write") return executeWrite(input);
    else if (cmd == "append") return executeAppend(input);
    else if (cmd == "mkdir") return executeMkdir(args);
    else if (cmd == "rm") return executeRm(args);
    else if (cmd == "pwd") return executePwd();
    else if (cmd == "clear") return executeClear();
    else if (cmd == "touch") return executeTouch(args);
    else if (cmd == "cat") return executeCat(args);
    else if (cmd == "history") return executeHistory();
    else if (cmd == "date") return executeDate();
    else if (cmd == "uname") return executeUname(args);
    else if (cmd == "help") return executeHelp();
    else return cmd + ": command not found\n";
}

void CommandPrompt::run() {
    std::string input;
    while (true) {
        printPrompt();
        if (!std::getline(std::cin, input)) break;
        if (input.empty()) continue;
        
        std::vector<std::string> args = splitCommand(input);
        if (!args.empty() && args[0] == "exit") {
            commandHistory.push_back(input);
            break;
        }

        std::string output = executeCommand(input);
        if (!output.empty()) {
            std::cout << output;
        }
    }
}
