#include "../include/FileSystem.h"

#include <sstream>
#include <algorithm>

FileSystem::FileSystem(int totalBlocks, int blockSize, FileAllocationStrategy& strategy)
{
    this->totalBlocks = totalBlocks;
    this->blockSize = blockSize;
    this->strategy = &strategy;
    this->nextFileId = 1;

    for (int i = 0; i < totalBlocks; i++)
    {
        blocks.emplace_back(i);
    }
}

File* FileSystem::findFile(const std::string& fileId)
{
    for (auto& f : files)
    {
        if (f->getFileId() == fileId)
            return f.get();
    }
    return nullptr;
}

std::string FileSystem::createFile(const std::string& ownerPID,
                                   const std::string& name,
                                   int sizeInBlocks,
                                   int currentTick,
                                   const std::string& dirPath)
{
    if (sizeInBlocks <= 0) return "";

    std::vector<int> chosen = strategy->findBlocks(blocks, sizeInBlocks);
    if (chosen.empty()) return "";   // Disk full or fragmented

    std::string fileId = "F" + std::to_string(nextFileId++);

    // Mark each chosen block as allocated
    for (int blockId : chosen)
    {
        blocks[blockId].allocate(fileId);
    }

    files.push_back(std::make_unique<File>(
        fileId, name, ownerPID, dirPath, sizeInBlocks, chosen, currentTick
    ));

    return fileId;
}

bool FileSystem::deleteFile(const std::string& fileId)
{
    File* file = findFile(fileId);
    if (!file) return false;

    // Close the file in the open file table first
    openFileTable.erase(
        std::remove_if(openFileTable.begin(), openFileTable.end(),
            [&](const OpenFileEntry& e) { return e.fileId == fileId; }),
        openFileTable.end()
    );

    // Free all its disk blocks
    for (int blockId : file->getAllocatedBlocks())
    {
        blocks[blockId].deallocate();
    }

    // Remove the file entry
    files.erase(
        std::remove_if(files.begin(), files.end(),
            [&](const std::unique_ptr<File>& f) { return f->getFileId() == fileId; }),
        files.end()
    );

    return true;
}

bool FileSystem::openFile(const std::string& fileId, const std::string& byPID, int currentTick)
{
    File* file = findFile(fileId);
    if (!file) return false;
    if (file->isOpen()) return false;  // Already open

    file->setOpen(true);
    file->setLastAccessedAt(currentTick);
    openFileTable.push_back({ fileId, byPID, currentTick });
    return true;
}

bool FileSystem::closeFile(const std::string& fileId, const std::string& byPID)
{
    File* file = findFile(fileId);
    if (!file) return false;

    auto it = std::find_if(openFileTable.begin(), openFileTable.end(),
        [&](const OpenFileEntry& e) {
            return e.fileId == fileId && e.pid == byPID;
        });

    if (it == openFileTable.end()) return false;

    openFileTable.erase(it);
    file->setOpen(false);
    return true;
}

bool FileSystem::renameFile(const std::string& fileId, const std::string& newName)
{
    if (newName.empty()) return false;
    File* file = findFile(fileId);
    if (!file) return false;
    file->setName(newName);
    return true;
}

void FileSystem::handleProcessTermination(const std::string& pid)
{
    // Collect fileIds owned by this process
    std::vector<std::string> toDelete;
    for (const auto& f : files)
    {
        if (f->getOwnerPID() == pid)
            toDelete.push_back(f->getFileId());
    }

    for (const std::string& fileId : toDelete)
    {
        deleteFile(fileId);
    }
}

int FileSystem::getTotalBlocks() const { return this->totalBlocks; }

int FileSystem::getFreeBlockCount() const
{
    int count = 0;
    for (const auto& b : blocks)
    {
        if (b.isFree()) count++;
    }
    return count;
}

int FileSystem::getUsedBlockCount() const
{
    return totalBlocks - getFreeBlockCount();
}

void FileSystem::reset()
{
    files.clear();
    openFileTable.clear();
    nextFileId = 1;
    for (auto& b : blocks)
    {
        b.deallocate();
    }
}

void FileSystem::compact()
{
    // Collect all allocated files in their current order and reassign them to contiguous blocks starting from 0
    int nextBlock = 0;

    for (auto& f : files)
    {
        const std::vector<int>& oldBlocks = f->getAllocatedBlocks();
        int size = static_cast<int>(oldBlocks.size());

        // Build the new block list
        std::vector<int> newBlocks;
        for (int i = 0; i < size; i++)
        {
            newBlocks.push_back(nextBlock + i);
        }

        // Free old blocks
        for (int blockId : oldBlocks)
        {
            blocks[blockId].deallocate();
        }

        // Allocate new contiguous blocks
        for (int blockId : newBlocks)
        {
            blocks[blockId].allocate(f->getFileId());
        }

        // Update the file's allocation record
        f->setAllocatedBlocks(newBlocks);

        nextBlock += size;
    }
}

std::string FileSystem::getSnapshotAsJson() const
{
    std::ostringstream ss;

    ss << "{";
    ss << "\"totalBlocks\":" << totalBlocks << ",";
    ss << "\"blockSize\":" << blockSize << ",";
    ss << "\"freeBlocks\":" << getFreeBlockCount() << ",";
    ss << "\"usedBlocks\":" << getUsedBlockCount() << ",";

    // Disk block map — compact array: 0 = free, fileId string = occupied
    ss << "\"blockMap\":[";
    for (int i = 0; i < totalBlocks; i++)
    {
        if (blocks[i].isFree())
            ss << "\"FREE\"";
        else
            ss << "\"" << blocks[i].getOwnerFileId() << "\"";
        if (i + 1 < totalBlocks) ss << ",";
    }
    ss << "],";

    // Files
    ss << "\"files\":[";
    for (size_t i = 0; i < files.size(); i++)
    {
        const auto& f = files[i];
        ss << "{";
        ss << "\"fileId\":\"" << f->getFileId() << "\",";
        ss << "\"name\":\"" << f->getName() << "\",";
        ss << "\"ownerPID\":\"" << f->getOwnerPID() << "\",";
        ss << "\"dirPath\":\"" << f->getDirPath() << "\",";
        ss << "\"sizeInBlocks\":" << f->getSizeInBlocks() << ",";
        ss << "\"isOpen\":" << (f->isOpen() ? "true" : "false") << ",";
        ss << "\"createdAt\":" << f->getCreatedAt() << ",";
        ss << "\"lastAccessedAt\":" << f->getLastAccessedAt() << ",";
        ss << "\"allocatedBlocks\":[";
        const auto& ab = f->getAllocatedBlocks();
        for (size_t j = 0; j < ab.size(); j++)
        {
            ss << ab[j];
            if (j + 1 < ab.size()) ss << ",";
        }
        ss << "]}";
        if (i + 1 < files.size()) ss << ",";
    }
    ss << "],";

    // Open File Table
    ss << "\"openFileTable\":[";
    for (size_t i = 0; i < openFileTable.size(); i++)
    {
        const auto& e = openFileTable[i];
        ss << "{";
        ss << "\"fileId\":\"" << e.fileId << "\",";
        ss << "\"pid\":\"" << e.pid << "\",";
        ss << "\"openedAtTick\":" << e.openedAtTick;
        ss << "}";
        if (i + 1 < openFileTable.size()) ss << ",";
    }
    ss << "]}";

    return ss.str();
}