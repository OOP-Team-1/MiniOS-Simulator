#include "../include/FileSystem.h"

#include <sstream>
#include <algorithm>
#include <cmath>

const std::string FileSystem::ROOT_DIR_ID = "D0";

FileSystem::FileSystem(int totalBlocks, int blockSize, FileAllocationStrategy& strategy, const std::string& diskImagePath)
{
    this->totalBlocks = totalBlocks;
    this->blockSize = blockSize;
    this->strategy = &strategy;
    this->nextFileId = 1;
    this->nextDirId = 1; // D0 is reserved for root, real counter starts at 1

    for (int i = 0; i < totalBlocks; i++)
    {
        blocks.emplace_back(i);
    }

    // Root directory always exists, has no parent (parentDirId == "").
    directories.push_back(std::make_unique<Directory>(ROOT_DIR_ID, "/", "", 0));

    this->disk = std::make_unique<DiskStorage>(diskImagePath, totalBlocks, blockSize);
}

std::string FileSystem::getRootDirId()
{
    return ROOT_DIR_ID;
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

Directory* FileSystem::findDirectory(const std::string& dirId)
{
    for (auto& d : directories)
    {
        if (d->getDirId() == dirId)
            return d.get();
    }
    return nullptr;
}

const Directory* FileSystem::findDirectory(const std::string& dirId) const
{
    for (const auto& d : directories)
    {
        if (d->getDirId() == dirId)
            return d.get();
    }
    return nullptr;
}

bool FileSystem::isOpenedBy(const std::string& fileId, const std::string& pid) const
{
    for (const auto& e : openFileTable)
    {
        if (e.fileId == fileId && e.pid == pid)
            return true;
    }
    return false;
}

void FileSystem::freeBlocks(const std::vector<int>& blockIds)
{
    for (int blockId : blockIds)
    {
        blocks[blockId].deallocate();
    }
}

bool FileSystem::isSameOrDescendant(const std::string& candidateId, const std::string& ancestorId) const
{
    // Walks candidateId's ancestor chain up to the root, looking for ancestorId.
    std::string current = candidateId;
    int guard = 0; // safety against an accidental cycle already in the tree

    while (!current.empty() && guard < static_cast<int>(directories.size()) + 1)
    {
        if (current == ancestorId) return true;

        const Directory* d = findDirectory(current);
        if (!d) break;

        current = d->getParentDirId();
        guard++;
    }

    return false;
}

// ============================================================
// DIRECTORY OPERATIONS
// ============================================================

std::string FileSystem::createDirectory(const std::string& name,
                                         const std::string& parentDirId,
                                         int currentTick)
{
    if (name.empty()) return "";

    Directory* parent = findDirectory(parentDirId);
    if (!parent) return ""; // parent must exist

    // Reject duplicate sibling names (both subdirectories and files share one namespace per folder, like a real filesystem).
    for (const auto& d : directories)
    {
        if (d->getParentDirId() == parentDirId && d->getName() == name)
            return "";
    }
    for (const auto& f : files)
    {
        if (f->getDirId() == parentDirId && f->getName() == name)
            return "";
    }

    std::string dirId = "D" + std::to_string(nextDirId++);
    directories.push_back(std::make_unique<Directory>(dirId, name, parentDirId, currentTick));
    return dirId;
}

bool FileSystem::deleteDirectory(const std::string& dirId)
{
    if (dirId == ROOT_DIR_ID) return false; // root is permanent

    Directory* dir = findDirectory(dirId);
    if (!dir) return false;

    // Must be empty: no files directly inside, no subdirectories.
    for (const auto& f : files)
    {
        if (f->getDirId() == dirId) return false;
    }
    for (const auto& d : directories)
    {
        if (d->getParentDirId() == dirId) return false;
    }

    directories.erase(
        std::remove_if(directories.begin(), directories.end(),
            [&](const std::unique_ptr<Directory>& d) { return d->getDirId() == dirId; }),
        directories.end()
    );

    return true;
}

bool FileSystem::renameDirectory(const std::string& dirId, const std::string& newName)
{
    if (newName.empty()) return false;
    if (dirId == ROOT_DIR_ID) return false; // root name is fixed

    Directory* dir = findDirectory(dirId);
    if (!dir) return false;

    // Reject a rename that collides with an existing sibling.
    for (const auto& d : directories)
    {
        if (d->getDirId() != dirId &&
            d->getParentDirId() == dir->getParentDirId() &&
            d->getName() == newName)
            return false;
    }
    for (const auto& f : files)
    {
        if (f->getDirId() == dir->getParentDirId() && f->getName() == newName)
            return false;
    }

    dir->setName(newName);
    return true;
}

bool FileSystem::moveDirectory(const std::string& dirId, const std::string& newParentDirId)
{
    if (dirId == ROOT_DIR_ID) return false; // root can't be moved

    Directory* dir = findDirectory(dirId);
    if (!dir) return false;

    Directory* newParent = findDirectory(newParentDirId);
    if (!newParent) return false;

    if (dirId == newParentDirId) return false;

    // Prevent cycles: newParentDirId can't be dirId itself or any descendant of it.
    if (isSameOrDescendant(newParentDirId, dirId)) return false;

    // Reject a move that collides with an existing sibling under the new parent.
    for (const auto& d : directories)
    {
        if (d->getDirId() != dirId &&
            d->getParentDirId() == newParentDirId &&
            d->getName() == dir->getName())
            return false;
    }
    for (const auto& f : files)
    {
        if (f->getDirId() == newParentDirId && f->getName() == dir->getName())
            return false;
    }

    dir->setParentDirId(newParentDirId);
    return true;
}

bool FileSystem::directoryExists(const std::string& dirId) const
{
    return findDirectory(dirId) != nullptr;
}

DirectoryInfo FileSystem::getDirectoryInfo(const std::string& dirId) const
{
    const Directory* d = findDirectory(dirId);
    if (!d) return DirectoryInfo{ "", "", "" };
    return DirectoryInfo{ d->getDirId(), d->getName(), d->getParentDirId() };
}

std::vector<DirectoryInfo> FileSystem::getChildDirectories(const std::string& parentDirId) const
{
    std::vector<DirectoryInfo> result;
    for (const auto& d : directories)
    {
        if (d->getParentDirId() == parentDirId)
        {
            result.push_back(DirectoryInfo{ d->getDirId(), d->getName(), d->getParentDirId() });
        }
    }
    return result;
}

std::vector<FileInfo> FileSystem::getChildFiles(const std::string& dirId) const
{
    std::vector<FileInfo> result;
    for (const auto& f : files)
    {
        if (f->getDirId() == dirId)
        {
            result.push_back(FileInfo{ f->getFileId(), f->getName(), f->getOwnerPID() });
        }
    }
    return result;
}

std::string FileSystem::findChildDirectoryIdByName(const std::string& parentDirId, const std::string& name) const
{
    for (const auto& d : directories)
    {
        if (d->getParentDirId() == parentDirId && d->getName() == name)
            return d->getDirId();
    }
    return "";
}

FileInfo FileSystem::findChildFileByName(const std::string& dirId, const std::string& name) const
{
    for (const auto& f : files)
    {
        if (f->getDirId() == dirId && f->getName() == name)
            return FileInfo{ f->getFileId(), f->getName(), f->getOwnerPID() };
    }
    return FileInfo{ "", "", "" };
}

// ============================================================
// FILE OPERATIONS
// ============================================================

std::string FileSystem::createFile(const std::string& ownerPID,
                                   const std::string& name,
                                   int sizeInBlocks,
                                   int currentTick,
                                   const std::string& dirId)
{
    if (sizeInBlocks <= 0) return "";

    // Default to root if caller didn't specify a directory.
    std::string targetDirId = dirId.empty() ? ROOT_DIR_ID : dirId;

    if (!directoryExists(targetDirId)) return ""; // target directory must exist

    // Reject duplicate sibling names (matches a subdirectory of the same name too).
    for (const auto& f : files)
    {
        if (f->getDirId() == targetDirId && f->getName() == name)
            return "";
    }
    for (const auto& d : directories)
    {
        if (d->getParentDirId() == targetDirId && d->getName() == name)
            return "";
    }

    std::vector<int> chosen = strategy->findBlocks(blocks, sizeInBlocks);
    if (chosen.empty()) return "";   // Disk full or fragmented

    std::string fileId = "F" + std::to_string(nextFileId++);

    // Mark each chosen block as allocated
    for (int blockId : chosen)
    {
        blocks[blockId].allocate(fileId);
        std::vector<char> zeros(blockSize, 0);
        disk->writeBlock(blockId, zeros);
    }

    files.push_back(std::make_unique<File>(
        fileId, name, ownerPID, targetDirId, sizeInBlocks, chosen, currentTick
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

    // Wipe underlying disk blocks with zeros
    for (int blockId : file->getAllocatedBlocks())
    {
        std::vector<char> zeros(blockSize, 0);
        disk->writeBlock(blockId, zeros);
    }

    freeBlocks(file->getAllocatedBlocks());

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
    
    if (file->getOwnerPID() != byPID) return false;

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

bool FileSystem::moveFile(const std::string& fileId, const std::string& newDirId)
{
    File* file = findFile(fileId);
    if (!file) return false;

    if (!directoryExists(newDirId)) return false;

    // Reject a move that collides with an existing name in the destination.
    for (const auto& f : files)
    {
        if (f->getFileId() != fileId &&
            f->getDirId() == newDirId &&
            f->getName() == file->getName())
            return false;
    }
    for (const auto& d : directories)
    {
        if (d->getParentDirId() == newDirId && d->getName() == file->getName())
            return false;
    }

    file->setDirId(newDirId);
    return true;
}

bool FileSystem::renameFile(const std::string& fileId, const std::string& newName)
{
    if (newName.empty()) return false;
    File* file = findFile(fileId);
    if (!file) return false;

    // Reject a rename that collides with an existing sibling.
    for (const auto& f : files)
    {
        if (f->getFileId() != fileId &&
            f->getDirId() == file->getDirId() &&
            f->getName() == newName)
            return false;
    }
    for (const auto& d : directories)
    {
        if (d->getParentDirId() == file->getDirId() && d->getName() == newName)
            return false;
    }

    file->setName(newName);
    return true;
}

// ============================================================
// CONTENT I/O
// ============================================================

std::string FileSystem::readFile(const std::string& fileId, const std::string& byPID, int currentTick, bool& ok)
{
    ok = false;

    File* file = findFile(fileId);
    if (!file) return "";
    if (!file->isOpen()) return "";
    if (!isOpenedBy(fileId, byPID)) return "";

    const std::vector<int>& blockIds = file->getAllocatedBlocks();

    std::string content;
    content.reserve(static_cast<std::size_t>(file->getSizeInBytes()));

    for (int blockId : blockIds)
    {
        std::vector<char> raw = disk->readBlock(blockId);
        content.append(raw.data(), raw.size());
    }

    // Trim to the logical length — last block is generally only
    // partially used, and raw block data beyond that is padding/garbage.
    if (static_cast<int>(content.size()) > file->getSizeInBytes())
    {
        content.resize(static_cast<std::size_t>(file->getSizeInBytes()));
    }

    file->setLastAccessedAt(currentTick);
    ok = true;
    return content;
}

bool FileSystem::writeFile(const std::string& fileId, const std::string& byPID, const std::string& content, int currentTick)
{
    File* file = findFile(fileId);
    if (!file) return false;
    if (!file->isOpen()) return false;
    if (!isOpenedBy(fileId, byPID)) return false;

    int blocksNeeded = static_cast<int>(
        std::ceil(static_cast<double>(content.size()) / blockSize)
    );
    if (blocksNeeded == 0) blocksNeeded = 1;

    const std::vector<int>& currentBlocks = file->getAllocatedBlocks();
    int currentCount = static_cast<int>(currentBlocks.size());

    std::vector<int> finalBlocks;

    if (blocksNeeded <= currentCount)
    {
        // Shrinking or keeping the same size: keep the first blocksNeeded blocks
        finalBlocks.assign(currentBlocks.begin(), currentBlocks.begin() + blocksNeeded);
        std::vector<int> toFree(currentBlocks.begin() + blocksNeeded, currentBlocks.end());
        freeBlocks(toFree);
    }
    else
    {
        int extraNeeded = blocksNeeded - currentCount;
        int lastBlock = currentBlocks.back();

        // 1. Check if we can expand in-place (adjacent blocks are free)
        bool canExpandInPlace = true;
        if (lastBlock + extraNeeded >= totalBlocks)
        {
            canExpandInPlace = false;
        }
        else
        {
            for (int i = 1; i <= extraNeeded; i++)
            {
                if (!blocks[lastBlock + i].isFree())
                {
                    canExpandInPlace = false;
                    break;
                }
            }
        }

        if (canExpandInPlace)
        {
            finalBlocks = currentBlocks;
            for (int i = 1; i <= extraNeeded; i++)
            {
                int bId = lastBlock + i;
                blocks[bId].allocate(fileId);
                finalBlocks.push_back(bId);
            }
        }
        else
        {
            // 2. In-place failed: relocate the entire file to a new contiguous run
            // Temporarily release old blocks so they count as free space for findBlocks
            freeBlocks(currentBlocks);

            std::vector<int> candidateBlocks = strategy->findBlocks(blocks, blocksNeeded);

            if (static_cast<int>(candidateBlocks.size()) < blocksNeeded)
            {
                // Not enough contiguous space: roll back and keep original blocks intact
                for (int bId : currentBlocks)
                {
                    blocks[bId].allocate(fileId);
                }
                return false;
            }

            // Allocate the new contiguous block region
            for (int bId : candidateBlocks)
            {
                blocks[bId].allocate(fileId);
            }
            finalBlocks = candidateBlocks;
        }
    }

    // Write content across finalBlocks, blockSize bytes at a time
    std::size_t offset = 0;
    for (int blockId : finalBlocks)
    {
        std::size_t remaining = content.size() - offset;
        std::size_t chunkLen = remaining < static_cast<std::size_t>(blockSize)
            ? remaining
            : static_cast<std::size_t>(blockSize);

        std::vector<char> chunk(content.begin() + offset, content.begin() + offset + chunkLen);
        disk->writeBlock(blockId, chunk);

        offset += chunkLen;
    }

    file->setAllocatedBlocks(finalBlocks);
    file->setSizeInBytes(static_cast<int>(content.size()));
    file->setLastAccessedAt(currentTick);

    return true;
}

bool FileSystem::appendFile(const std::string& fileId, const std::string& byPID, const std::string& content, int currentTick)
{
    File* file = findFile(fileId);
    if (!file) return false;
    if (!file->isOpen()) return false;
    if (!isOpenedBy(fileId, byPID)) return false;
    if (content.empty()) return true; // nothing to do, trivially succeeds

    bool readOk = false;
    std::string existing = readFile(fileId, byPID, currentTick, readOk);
    if (!readOk) return false;

    std::string combined = existing + content;

    // Delegate to writeFile, which already handles growth/shrink/allocation.
    return writeFile(fileId, byPID, combined, currentTick);
}

// ============================================================
// PROCESS / SYSTEM
// ============================================================

void FileSystem::handleProcessTermination(const std::string& pid)
{
    std::vector<std::string> toClose;
    for (const auto& entry : openFileTable) {
        if (entry.pid == pid) toClose.push_back(entry.fileId);
    }
    for (const auto& fileId : toClose) {
        closeFile(fileId, pid);
    }

    // Collect fileIds owned by this process
    std::vector<std::string> toDelete;
    for (const auto& f : files){
        if (f->getOwnerPID() == pid)
            toDelete.push_back(f->getFileId());
    }

    for (const std::string& fileId : toDelete){
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

    // Drop every directory except the permanent root, and reset the counter.
    directories.erase(
        std::remove_if(directories.begin(), directories.end(),
            [&](const std::unique_ptr<Directory>& d) { return d->getDirId() != ROOT_DIR_ID; }),
        directories.end()
    );
    nextDirId = 1;

    for (auto& b : blocks)
    {
        b.deallocate();
    }
    // Note: disk.img is NOT zeroed here — freed/reset blocks simply become unreferenced; their old bytes persist until overwritten by a future allocation, same as a real disk.
}

void FileSystem::compact()
{
    // Structure to stage all file data safely in RAM before writing anything
    struct FileDataBackup {
        File* file;
        std::vector<std::vector<char>> blockPayloads;
    };

    std::vector<FileDataBackup> stagedBackups;
    stagedBackups.reserve(files.size());

    // PHASE 1: Read all files into memory first
    for (auto& f : files)
    {
        FileDataBackup backup;
        backup.file = f.get();
        for (int blockId : f->getAllocatedBlocks())
        {
            backup.blockPayloads.push_back(disk->readBlock(blockId));
        }
        stagedBackups.push_back(std::move(backup));
    }

    // Deallocate all disk blocks completely
    for (auto& b : blocks)
    {
        b.deallocate();
    }

    // PHASE 2: Reassign sequentially from block 0 and write back
    int nextBlock = 0;
    for (auto& staged : stagedBackups)
    {
        int count = static_cast<int>(staged.blockPayloads.size());
        std::vector<int> newBlocks;
        newBlocks.reserve(count);

        for (int i = 0; i < count; i++)
        {
            int targetBlock = nextBlock + i;
            newBlocks.push_back(targetBlock);
            blocks[targetBlock].allocate(staged.file->getFileId());
            disk->writeBlock(targetBlock, staged.blockPayloads[i]);
        }

        staged.file->setAllocatedBlocks(newBlocks);
        nextBlock += count;
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

    // Directories — flat list, each with its real parentDirId.
    // Every folder is a real row here, including empty ones, so the frontend can rebuild an accurate tree with zero guesswork.
    ss << "\"directories\":[";
    for (size_t i = 0; i < directories.size(); i++)
    {
        const auto& d = directories[i];
        ss << "{";
        ss << "\"dirId\":\"" << d->getDirId() << "\",";
        ss << "\"name\":\"" << d->getName() << "\",";
        ss << "\"parentDirId\":\"" << d->getParentDirId() << "\",";
        ss << "\"createdAt\":" << d->getCreatedAt();
        ss << "}";
        if (i + 1 < directories.size()) ss << ",";
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
        ss << "\"dirId\":\"" << f->getDirId() << "\",";
        ss << "\"sizeInBlocks\":" << f->getSizeInBlocks() << ",";
        ss << "\"sizeInBytes\":" << f->getSizeInBytes() << ",";
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