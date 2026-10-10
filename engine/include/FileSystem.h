#pragma once

#include <vector>
#include <string>
#include <memory>
#include <unordered_map>

#include "FileBlock.h"
#include "File.h"
#include "FileAllocationStrategy.h"
#include "DiskStorage.h"

struct OpenFileEntry
{
    std::string fileId;
    std::string pid;
    int openedAtTick;
};

class FileSystem
{
private:
    std::vector<FileBlock> blocks;
    std::vector<std::unique_ptr<File>> files;
    std::vector<OpenFileEntry> openFileTable;

    int totalBlocks;
    int blockSize;          // KB per block (also bytes-per-block for disk I/O)
    int nextFileId;
    FileAllocationStrategy* strategy;

    std::unique_ptr<DiskStorage> disk;

    // Helper: find a File* by fileId
    File* findFile(const std::string& fileId);

    // Helper: is this PID currently holding fileId open?
    bool isOpenedBy(const std::string& fileId, const std::string& pid) const;

    // Helper: free a list of block IDs back to the free pool
    void freeBlocks(const std::vector<int>& blockIds);

public:
    FileSystem(int totalBlocks, int blockSize, FileAllocationStrategy& strategy, const std::string& diskImagePath = "engine/data/disk.img");

    // Core file operations
    // Returns the new fileId on success, empty string on failure
    std::string createFile(const std::string& ownerPID,
                           const std::string& name,
                           int sizeInBlocks,
                           int currentTick,
                           const std::string& dirPath = "/");

    bool deleteFile(const std::string& fileId);
    bool openFile(const std::string& fileId, const std::string& byPID, int currentTick);
    bool closeFile(const std::string& fileId, const std::string& byPID);

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