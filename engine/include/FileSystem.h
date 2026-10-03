#pragma once

#include <vector>
#include <string>
#include <memory>
#include <unordered_map>

#include "FileBlock.h"
#include "File.h"
#include "FileAllocationStrategy.h"

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
    int blockSize;          // KB per block
    int nextFileId;
    FileAllocationStrategy* strategy;

    // Helper: find a File* by fileId
    File* findFile(const std::string& fileId);

public:
    FileSystem(int totalBlocks, int blockSize, FileAllocationStrategy& strategy);

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