#pragma once

#include <vector>
#include <string>
#include <memory>
#include <unordered_map>

#include "FileBlock.h"
#include "File.h"
#include "Directory.h"
#include "FileAllocationStrategy.h"
#include "DiskStorage.h"

struct OpenFileEntry
{
    std::string fileId;
    std::string pid;
    int openedAtTick;
};

// Lightweight read-only views handed back by the listing helpers below, so callers (like CommandPrompt) never need to touch File/Directory
// internals or re-parse getSnapshotAsJson() to answer "what's in here?".
struct DirectoryInfo
{
    std::string dirId;
    std::string name;
    std::string parentDirId;
};

struct FileInfo
{
    std::string fileId;
    std::string name;
    std::string ownerPID;
};

class FileSystem
{
private:
    std::vector<FileBlock> blocks;
    std::vector<std::unique_ptr<File>> files;
    std::vector<std::unique_ptr<Directory>> directories;
    std::vector<OpenFileEntry> openFileTable;

    int totalBlocks;
    int blockSize;          // KB per block (also bytes-per-block for disk I/O)
    int nextFileId;
    int nextDirId;
    FileAllocationStrategy* strategy;

    std::unique_ptr<DiskStorage> disk;

    static const std::string ROOT_DIR_ID;

    // Helper: find a File* by fileId
    File* findFile(const std::string& fileId);

    // Helper: find a Directory* by dirId
    Directory* findDirectory(const std::string& dirId);
    const Directory* findDirectory(const std::string& dirId) const;

    // Helper: is this PID currently holding fileId open?
    bool isOpenedBy(const std::string& fileId, const std::string& pid) const;

    // Helper: free a list of block IDs back to the free pool
    void freeBlocks(const std::vector<int>& blockIds);

    // Helper: true if `candidateId` is `ancestorId` or a descendant of it.
    // Used to block a directory from being moved into its own subtree.
    bool isSameOrDescendant(const std::string& candidateId, const std::string& ancestorId) const;

public:
    FileSystem(int totalBlocks, int blockSize, FileAllocationStrategy& strategy, const std::string& diskImagePath = "engine/data/disk.img");

    // ── Directory operations ────────────────────────────────────────────
    // Every FileSystem starts with one root directory, dirId == "D0",
    // parentDirId == "" (empty = no parent). It can never be deleted or renamed away.
    static std::string getRootDirId();

    std::string createDirectory(const std::string& name,
                                 const std::string& parentDirId,
                                 int currentTick);

    // Deletes a directory. Fails (returns false) if the directory doesn't exist, is the root, or is not empty (contains files or subdirectories).
    bool deleteDirectory(const std::string& dirId);

    bool renameDirectory(const std::string& dirId, const std::string& newName);

    // Moves a directory under a new parent. Fails if either id doesn't exist, the target is the root, the new parent doesn't exist, or the
    // move would make a directory its own ancestor/descendant (a cycle).
    bool moveDirectory(const std::string& dirId, const std::string& newParentDirId);

    bool directoryExists(const std::string& dirId) const;

    // Direct structural lookups — the API CommandPrompt (or any other caller) should use instead of re-parsing getSnapshotAsJson().
    DirectoryInfo getDirectoryInfo(const std::string& dirId) const; // dirId empty on failure
    std::vector<DirectoryInfo> getChildDirectories(const std::string& parentDirId) const;
    std::vector<FileInfo> getChildFiles(const std::string& dirId) const;

    // Finds a subdirectory of parentDirId by name; returns "" if none.
    std::string findChildDirectoryIdByName(const std::string& parentDirId, const std::string& name) const;
    // Finds a file directly inside dirId by name; fileId is "" if none.
    FileInfo findChildFileByName(const std::string& dirId, const std::string& name) const;

    // Core file operations
    // Returns the new fileId on success, empty string on failure
    std::string createFile(const std::string& ownerPID,
                           const std::string& name,
                           int sizeInBlocks,
                           int currentTick,
                           const std::string& dirId = "");

    bool deleteFile(const std::string& fileId);
    bool openFile(const std::string& fileId, const std::string& byPID, int currentTick);
    bool closeFile(const std::string& fileId, const std::string& byPID);

    // Moves a file into a different directory. Fails if the file or the target directory doesn't exist.
    bool moveFile(const std::string& fileId, const std::string& newDirId);

    // Content I/O — all require the file to be open AND held open by byPID
    // readFile: returns file content; sets ok=false on failure (not found, not open, wrong owner)
    std::string readFile(const std::string& fileId, const std::string& byPID, int currentTick, bool& ok);

    // writeFile: overwrites file content from offset 0 (truncates/grows as needed)
    bool writeFile(const std::string& fileId, const std::string& byPID, const std::string& content, int currentTick);

    // appendFile: adds content to the end of the existing file content
    bool appendFile(const std::string& fileId, const std::string& byPID, const std::string& content, int currentTick);

    // Called on process termination — closes and deletes all files owned by this PID
    void handleProcessTermination(const std::string& pid);

    // Stats
    int getTotalBlocks() const;
    int getFreeBlockCount() const;
    int getUsedBlockCount() const;

    void reset();
    void compact();
    bool renameFile(const std::string& fileId, const std::string& newName);

    std::string getSnapshotAsJson() const;
};