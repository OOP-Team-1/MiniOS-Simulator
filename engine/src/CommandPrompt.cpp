#include "../include/CommandPrompt.h"
#include "../include/FileSystem.h"

#include <iostream>
#include <sstream>
#include <algorithm>
#include <ctime>

// ============================================================
// CONSTRUCTOR & INITIAL DIRECTORY SETUP
// ============================================================

CommandPrompt::CommandPrompt(const std::string& user, const std::string& host, FileSystem* fileSystem)
    : username(user), hostname(host), fs(fileSystem)
{
    std::string rootId = fs->getRootDirId();

    // 1. Ensure /home exists under root (D0)
    std::string homeParentId = fs->findChildDirectoryIdByName(rootId, "home");
    if (homeParentId.empty()) {
        homeParentId = fs->createDirectory("home", rootId, 0);
    }

    // 2. Ensure /home/<username> exists
    homeDirId = fs->findChildDirectoryIdByName(homeParentId, username);
    if (homeDirId.empty()) {
        homeDirId = fs->createDirectory(username, homeParentId, 0);
    }

    // Fall back to root if home creation failed
    if (homeDirId.empty()) {
        homeDirId = rootId;
    }

    currentDirId = homeDirId;

    // 3. Populate default standard user directories under ~/
    std::vector<std::string> defaultDirs = {
        "Desktop", "Documents", "Downloads", "Music", "Pictures", 
        "Public", "Templates", "Videos", "linux-lab", "snap"
    };

    for (const auto& dir : defaultDirs) {
        if (fs->findChildDirectoryIdByName(homeDirId, dir).empty()) {
            fs->createDirectory(dir, homeDirId, 0);
        }
    }

    // 4. Ensure ~/linux-lab/notes exists
    std::string linuxLabId = fs->findChildDirectoryIdByName(homeDirId, "linux-lab");
    if (!linuxLabId.empty()) {
        if (fs->findChildDirectoryIdByName(linuxLabId, "notes").empty()) {
            fs->createDirectory("notes", linuxLabId, 0);
        }
    }

    // 5. Populate initial demo files in ~/Downloads
    std::string downloadsId = fs->findChildDirectoryIdByName(homeDirId, "Downloads");
    if (!downloadsId.empty()) {
        if (fs->findChildFileByName(downloadsId, "Computer Organization and Architecture.pdf").fileId.empty()) {
            std::string f1 = fs->createFile("SYSTEM", "Computer Organization and Architecture.pdf", 1, 0, downloadsId);
            if (!f1.empty()) writeFileContent(f1, "SYSTEM", "%PDF-1.4\n1 0 obj\n<< /Title (COA Notes) >>\nendobj\n");
        }

        if (fs->findChildFileByName(downloadsId, "code_1.140.0-1790759618_amd64.deb").fileId.empty()) {
            std::string f2 = fs->createFile("SYSTEM", "code_1.140.0-1790759618_amd64.deb", 1, 0, downloadsId);
            if (!f2.empty()) writeFileContent(f2, "SYSTEM", "!<arch>\ndebian-binary   1580000000  0     0     100644  4         `\n2.0\n");
        }

        if (fs->findChildFileByName(downloadsId, "java-swing-concepts.pdf").fileId.empty()) {
            std::string f3 = fs->createFile("SYSTEM", "java-swing-concepts.pdf", 1, 0, downloadsId);
            if (!f3.empty()) writeFileContent(f3, "SYSTEM", "Java Swing Concepts:\n- JFrame\n- JPanel\n- JButton\n");
        }
    }
}

CommandPrompt::~CommandPrompt() {}

// ============================================================
// PATH RESOLUTION & NAVIGATION HELPERS
// ============================================================

std::string CommandPrompt::resolveDirPath(const std::string& path) const
{
    if (path.empty()) {
        return currentDirId;
    }

    std::string clean = stripQuotes(path);
    if (clean.empty()) return currentDirId;

    std::string curr;
    size_t startIdx = 0;

    // Absolute path
    if (clean[0] == '/') {
        curr = fs->getRootDirId();
        startIdx = 1;
    }
    // Home-relative path
    else if (clean[0] == '~') {
        curr = homeDirId;
        startIdx = 1;
        if (clean.size() > 1 && clean[1] == '/') {
            startIdx = 2;
        }
    }
    // Relative path
    else {
        curr = currentDirId;
        startIdx = 0;
    }

    std::string token;
    std::stringstream ss(clean.substr(startIdx));

    while (std::getline(ss, token, '/')) {
        if (token.empty() || token == ".") {
            continue;
        }

        if (token == "..") {
            DirectoryInfo info = fs->getDirectoryInfo(curr);
            if (!info.parentDirId.empty()) {
                curr = info.parentDirId;
            }
            // If parentDirId is empty, we are at root ("D0"); stay at root.
            continue;
        }

        std::string nextId = fs->findChildDirectoryIdByName(curr, token);
        if (nextId.empty()) {
            return ""; // Directory component not found
        }
        curr = nextId;
    }

    return curr;
}

bool CommandPrompt::resolvePathToParentAndName(const std::string& path,
                                              std::string& outParentDirId,
                                              std::string& outName) const
{
    std::string clean = stripQuotes(path);
    if (clean.empty()) return false;

    // Strip trailing slashes while length > 1
    while (clean.size() > 1 && clean.back() == '/') {
        clean.pop_back();
    }

    size_t lastSlash = clean.find_last_of('/');

    // Case 1: No slash, parent is currentDirId
    if (lastSlash == std::string::npos) {
        outParentDirId = currentDirId;
        outName = clean;
        return !outName.empty() && outName != "." && outName != "..";
    }

    // Case 2: Root-level file or folder, e.g. "/foo"
    if (lastSlash == 0) {
        outParentDirId = fs->getRootDirId();
        outName = clean.substr(1);
        return !outName.empty() && outName != "." && outName != "..";
    }

    // Case 3: Nested path, e.g. "a/b/c" or "~/docs/notes.txt"
    std::string parentPath = clean.substr(0, lastSlash);
    outName = clean.substr(lastSlash + 1);

    if (outName.empty() || outName == "." || outName == "..") {
        return false;
    }

    std::string parentId = resolveDirPath(parentPath);
    if (parentId.empty()) {
        return false;
    }

    outParentDirId = parentId;
    return true;
}

std::string CommandPrompt::buildDisplayPath(const std::string& dirId) const
{
    if (dirId.empty()) return "?";
    if (dirId == homeDirId) return "~";
    if (dirId == fs->getRootDirId()) return "/";

    std::vector<std::string> chain;
    std::string curr = dirId;

    while (!curr.empty()) {
        chain.push_back(curr);
        if (curr == fs->getRootDirId()) break;
        DirectoryInfo info = fs->getDirectoryInfo(curr);
        if (info.dirId.empty()) break;
        curr = info.parentDirId;
    }

    // Check if homeDirId is an ancestor
    auto homeIt = std::find(chain.begin(), chain.end(), homeDirId);
    if (homeIt != chain.end()) {
        int homeIdx = static_cast<int>(std::distance(chain.begin(), homeIt));
        std::string display = "~";
        for (int i = homeIdx - 1; i >= 0; --i) {
            display += "/" + fs->getDirectoryInfo(chain[i]).name;
        }
        return display;
    }

    // Otherwise, build absolute display path from root
    std::string display = "";
    for (int i = static_cast<int>(chain.size()) - 2; i >= 0; --i) {
        display += "/" + fs->getDirectoryInfo(chain[i]).name;
    }

    return display.empty() ? "/" : display;
}

// ============================================================
// FILE I/O HELPERS
// ============================================================

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
    if (!ok) ok = fs->writeFile(fileId, "USER", content, 0) || fs->writeFile(fileId, "SYSTEM", content, 0);

    fs->closeFile(fileId, ownerPID);
    fs->closeFile(fileId, "USER");
    fs->closeFile(fileId, "SYSTEM");
    return ok;
}

bool CommandPrompt::appendFileContent(const std::string& fileId, const std::string& ownerPID, const std::string& content)
{
    fs->closeFile(fileId, ownerPID);
    fs->closeFile(fileId, "USER");
    fs->closeFile(fileId, "SYSTEM");

    bool opened = fs->openFile(fileId, ownerPID, 0);
    if (!opened) {
        opened = fs->openFile(fileId, "USER", 0) || fs->openFile(fileId, "SYSTEM", 0);
    }

    bool ok = fs->appendFile(fileId, ownerPID, content, 0);
    if (!ok) ok = fs->appendFile(fileId, "USER", content, 0) || fs->appendFile(fileId, "SYSTEM", content, 0);

    fs->closeFile(fileId, ownerPID);
    fs->closeFile(fileId, "USER");
    fs->closeFile(fileId, "SYSTEM");
    return ok;
}

bool CommandPrompt::writeToFileOrPath(const std::string& target, const std::string& content, bool isAppend)
{
    std::string parentDirId, name;
    if (!resolvePathToParentAndName(target, parentDirId, name)) {
        return false;
    }

    // Fail if a directory already shares this name
    if (!fs->findChildDirectoryIdByName(parentDirId, name).empty()) {
        return false;
    }

    FileInfo fi = fs->findChildFileByName(parentDirId, name);
    std::string fileId = fi.fileId;
    std::string ownerPID = fi.ownerPID.empty() ? "USER" : fi.ownerPID;

    if (fileId.empty()) {
        fileId = fs->createFile("USER", name, 1, 0, parentDirId);
        ownerPID = "USER";
    }

    if (fileId.empty()) return false;

    if (isAppend) {
        return appendFileContent(fileId, ownerPID, content);
    } else {
        return writeFileContent(fileId, ownerPID, content);
    }
}

// ============================================================
// ESCAPES & PARSING UTILITIES
// ============================================================

std::string CommandPrompt::stripQuotes(const std::string& str)
{
    if (str.length() >= 2) {
        if ((str.front() == '"' && str.back() == '"') || (str.front() == '\'' && str.back() == '\'')) {
            return str.substr(1, str.length() - 2);
        }
    }
    return str;
}

std::string CommandPrompt::processEscapes(const std::string& str)
{
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

bool CommandPrompt::parseRedirection(const std::string& input, std::string& baseCmd, std::string& targetFile, bool& isAppend)
{
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
    targetFile = (s != std::string::npos && e != std::string::npos) ? rawFile.substr(s, e - s + 1) : "";
    targetFile = stripQuotes(targetFile);

    size_t be = baseCmd.find_last_not_of(" \t\r\n");
    if (be != std::string::npos) {
        baseCmd = baseCmd.substr(0, be + 1);
    }

    return true;
}

std::vector<std::string> CommandPrompt::splitCommand(const std::string& cmd)
{
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

// ============================================================
// COMMAND HANDLERS
// ============================================================

std::string CommandPrompt::executeWhoami() {
    return username + "\n";
}

std::string CommandPrompt::executePwd() {
    if (currentDirId == fs->getRootDirId()) {
        return "/\n";
    }

    std::vector<std::string> names;
    std::string curr = currentDirId;
    while (!curr.empty() && curr != fs->getRootDirId()) {
        DirectoryInfo info = fs->getDirectoryInfo(curr);
        if (info.dirId.empty()) break;
        names.push_back(info.name);
        curr = info.parentDirId;
    }

    std::string full;
    for (int i = static_cast<int>(names.size()) - 1; i >= 0; --i) {
        full += "/" + names[i];
    }
    return (full.empty() ? "/" : full) + "\n";
}

std::string CommandPrompt::executeClear() {
    return "\033[2J\033[1;1H";
}

std::string CommandPrompt::executeLs(const std::vector<std::string>& args) {
    std::string targetDirId = currentDirId;

    for (size_t i = 1; i < args.size(); ++i) {
        if (args[i].rfind("-", 0) != 0) {
            std::string pathArg = stripQuotes(args[i]);
            std::string resolved = resolveDirPath(pathArg);
            if (resolved.empty()) {
                std::string parentId, name;
                if (resolvePathToParentAndName(pathArg, parentId, name)) {
                    FileInfo fi = fs->findChildFileByName(parentId, name);
                    if (!fi.fileId.empty()) {
                        return pathArg + "\n";
                    }
                }
                return "ls: cannot access '" + pathArg + "': No such file or directory\n";
            }
            targetDirId = resolved;
            break;
        }
    }

    std::ostringstream out;
    std::string blue = "\033[1;34m";
    std::string reset = "\033[0m";
    std::string red = "\033[1;31m";

    auto dirs = fs->getChildDirectories(targetDirId);
    std::sort(dirs.begin(), dirs.end(), [](const DirectoryInfo& a, const DirectoryInfo& b) {
        return a.name < b.name;
    });

    for (const auto& dir : dirs) {
        out << blue << dir.name << reset << "  ";
    }

    auto files = fs->getChildFiles(targetDirId);
    std::sort(files.begin(), files.end(), [](const FileInfo& a, const FileInfo& b) {
        return a.name < b.name;
    });

    for (const auto& f : files) {
        if (f.name.find(".deb") != std::string::npos) {
            out << red << f.name << reset << "  ";
        } else if (f.name.find(" ") != std::string::npos) {
            out << "'" << f.name << "'  ";
        } else {
            out << f.name << "  ";
        }
    }

    if (!dirs.empty() || !files.empty()) {
        out << "\n";
    }
    return out.str();
}

std::string CommandPrompt::executeCd(const std::vector<std::string>& args) {
    if (args.size() < 2 || args[1] == "~") {
        currentDirId = homeDirId;
        return "";
    }

    std::string target = stripQuotes(args[1]);
    if (target.empty()) {
        currentDirId = homeDirId;
        return "";
    }

    std::string resolved = resolveDirPath(target);
    if (!resolved.empty()) {
        currentDirId = resolved;
        return "";
    }

    // Check if path resolved to a regular file instead of a directory
    std::string parentId, name;
    if (resolvePathToParentAndName(target, parentId, name)) {
        FileInfo fi = fs->findChildFileByName(parentId, name);
        if (!fi.fileId.empty()) {
            return "bash: cd: " + target + ": Not a directory\n";
        }
    }

    return "bash: cd: " + target + ": No such file or directory\n";
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

std::string CommandPrompt::executeCat(const std::vector<std::string>& args)
{
    if (args.size() < 2) return "";
    std::ostringstream out;

    for (size_t i = 1; i < args.size(); ++i) {
        std::string target = stripQuotes(args[i]);
        if (target.empty()) continue;

        std::string parentDirId, name;
        if (!resolvePathToParentAndName(target, parentDirId, name)) {
            out << "cat: '" << target << "': No such file or directory\n";
            continue;
        }

        if (!fs->findChildDirectoryIdByName(parentDirId, name).empty()) {
            out << "cat: " << target << ": Is a directory\n";
            continue;
        }

        FileInfo fi = fs->findChildFileByName(parentDirId, name);
        if (fi.fileId.empty()) {
            out << "cat: '" << target << "': No such file or directory\n";
            continue;
        }

        std::string content;
        bool ok = readFileContent(fi.fileId, fi.ownerPID, content);
        if (ok) {
            out << content;
        } else {
            out << "[File System Emulator] Binary file or content not readable by OS.\n";
        }
    }
    return out.str();
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

    std::string errorMsg = "";
    for (size_t i = 1; i < args.size(); ++i) {
        if (args[i].rfind("-", 0) == 0) continue;
        std::string target = stripQuotes(args[i]);
        if (target.empty()) continue;

        std::string parentDirId, name;
        if (!resolvePathToParentAndName(target, parentDirId, name)) {
            errorMsg += "mkdir: cannot create directory '" + target + "': No such file or directory\n";
            continue;
        }

        std::string newId = fs->createDirectory(name, parentDirId, 0);
        if (newId.empty()) {
            if (!fs->findChildDirectoryIdByName(parentDirId, name).empty() ||
                !fs->findChildFileByName(parentDirId, name).fileId.empty()) {
                errorMsg += "mkdir: cannot create directory '" + target + "': File exists\n";
            } else {
                errorMsg += "mkdir: cannot create directory '" + target + "': Failed to create\n";
            }
        }
    }
    return errorMsg;
}

std::string CommandPrompt::executeRm(const std::vector<std::string>& args)
{
    if (args.size() < 2) {
        return "rm: missing operand\n";
    }

    bool isRecursive = false;
    std::vector<std::string> targets;

    for (size_t i = 1; i < args.size(); ++i) {
        if (args[i] == "-r" || args[i] == "-rf" || args[i] == "-fr" || args[i] == "-R") {
            isRecursive = true;
        } else {
            targets.push_back(stripQuotes(args[i]));
        }
    }

    if (targets.empty()) {
        return "rm: missing operand\n";
    }

    std::string errorMsg = "";

    // Recursive directory cleanup lambda
    auto deleteDirRecursive = [this](auto& self, const std::string& dId) -> void {
        auto childFiles = fs->getChildFiles(dId);
        for (const auto& cf : childFiles) {
            fs->deleteFile(cf.fileId);
        }
        auto childDirs = fs->getChildDirectories(dId);
        for (const auto& cd : childDirs) {
            self(self, cd.dirId);
        }
        fs->deleteDirectory(dId);
    };

    for (const auto& target : targets) {
        std::string parentDirId, name;
        if (!resolvePathToParentAndName(target, parentDirId, name)) {
            errorMsg += "rm: cannot remove '" + target + "': No such file or directory\n";
            continue;
        }

        // 1. Check if target is a file
        FileInfo fi = fs->findChildFileByName(parentDirId, name);
        if (!fi.fileId.empty()) {
            fs->deleteFile(fi.fileId);
            continue;
        }

        // 2. Check if target is a directory
        std::string dId = fs->findChildDirectoryIdByName(parentDirId, name);
        if (!dId.empty()) {
            if (dId == fs->getRootDirId()) {
                errorMsg += "rm: cannot remove root directory '/'\n";
                continue;
            }
            if (dId == currentDirId) {
                errorMsg += "rm: cannot remove current working directory\n";
                continue;
            }
            if (!isRecursive) {
                errorMsg += "rm: cannot remove '" + target + "': Is a directory\n";
                continue;
            }
            deleteDirRecursive(deleteDirRecursive, dId);
            continue;
        }

        errorMsg += "rm: cannot remove '" + target + "': No such file or directory\n";
    }

    return errorMsg;
}

std::string CommandPrompt::executeTouch(const std::vector<std::string>& args)
{
    if (args.size() < 2) {
        return "touch: missing file operand\n";
    }

    for (size_t i = 1; i < args.size(); ++i) {
        if (args[i].rfind("-", 0) == 0) continue;
        std::string target = stripQuotes(args[i]);
        if (target.empty()) continue;

        std::string parentDirId, name;
        if (!resolvePathToParentAndName(target, parentDirId, name)) {
            return "touch: cannot touch '" + target + "': No such file or directory\n";
        }

        FileInfo fi = fs->findChildFileByName(parentDirId, name);
        if (!fi.fileId.empty()) {
            if (fs->openFile(fi.fileId, fi.ownerPID, 0)) {
                fs->closeFile(fi.fileId, fi.ownerPID);
            }
        } else {
            if (!fs->findChildDirectoryIdByName(parentDirId, name).empty()) {
                continue; // Directory already exists with this name
            }
            std::string fileId = fs->createFile("USER", name, 1, 0, parentDirId);
            if (!fileId.empty()) {
                writeFileContent(fileId, "USER", "");
            }
        }
    }
    return "";
}

std::string CommandPrompt::executeHistory() {
    std::ostringstream out;
    for (size_t i = 0; i < commandHistory.size(); ++i) {
        out << "  " << (i + 1) << "  " << commandHistory[i] << "\n";
    }
    return out.str();
}

std::string CommandPrompt::executeDate() {
    time_t now = time(nullptr);
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

// ============================================================
// TOP-LEVEL EXECUTION & TERMINAL INTERFACE
// ============================================================

std::string CommandPrompt::executeCommand(const std::string& input) {
    if (input.empty()) return "";
    commandHistory.push_back(input);

    if (input.find(";") != std::string::npos) {
        return "bash: syntax error near unexpected token `;'\n";
    }

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

std::string CommandPrompt::getPrompt() const
{
    std::string green = "\033[1;32m";
    std::string blue = "\033[1;34m";
    std::string reset = "\033[0m";
    return green + username + "@" + hostname + reset + ":"
         + blue + getCurrentPath() + reset + "$ ";
}

void CommandPrompt::printPrompt()
{
    std::cout << getPrompt();
}

std::string CommandPrompt::getCurrentPath() const
{
    return buildDisplayPath(currentDirId);
}

std::string CommandPrompt::getCurrentDirId() const
{
    return currentDirId;
}

std::string CommandPrompt::getUsername() const
{
    return username;
}

std::string CommandPrompt::getHostname() const
{
    return hostname;
}

const std::vector<std::string>& CommandPrompt::getCommandHistory() const
{
    return commandHistory;
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