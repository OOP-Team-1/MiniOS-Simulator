#include "../include/FileSystem.h"
#include "../include/SerializationUtils.h"

#include <sstream>
#include <algorithm>
#include <cmath>
#include <stdexcept>

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

bool FileSystem::saveFile(const std::string& fileId, const std::string& content, int currentTick)
{
    File* file = findFile(fileId);
    if (!file) return false;

    // The desktop editor is not a simulated process, so it must not deadlock
    // against a stale open-table entry left behind by a PID that no longer
    // holds the file. Drop every entry for this file and clear the open flag.
    openFileTable.erase(
        std::remove_if(openFileTable.begin(), openFileTable.end(),
            [&](const OpenFileEntry& e) { return e.fileId == fileId; }),
        openFileTable.end()
    );
    file->setOpen(false);

    // Act as the file's own owner (falling back to USER for legacy entries
    // restored from a snapshot without an owner).
    const std::string owner = file->getOwnerPID().empty() ? "USER" : file->getOwnerPID();

    if (!openFile(fileId, owner, currentTick)) return false;

    bool ok = writeFile(fileId, owner, content, currentTick);

    closeFile(fileId, owner);
    return ok;
}

std::string FileSystem::readFileForEditor(const std::string& fileId, int currentTick, bool& ok)
{
    ok = false;

    File* file = findFile(fileId);
    if (!file) return "";

    // Tolerate stale open-table entries, exactly like saveFile().
    openFileTable.erase(
        std::remove_if(openFileTable.begin(), openFileTable.end(),
            [&](const OpenFileEntry& e) { return e.fileId == fileId; }),
        openFileTable.end()
    );
    file->setOpen(false);

    const std::string owner = file->getOwnerPID().empty() ? "USER" : file->getOwnerPID();

    if (!openFile(fileId, owner, currentTick)) return "";

    std::string content = readFile(fileId, owner, currentTick, ok);

    closeFile(fileId, owner);
    return content;
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
        ss << "\"name\":\"" << minios::jsonEscape(d->getName()) << "\",";
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
        ss << "\"name\":\"" << minios::jsonEscape(f->getName()) << "\",";
        ss << "\"ownerPID\":\"" << minios::jsonEscape(f->getOwnerPID()) << "\",";
        ss << "\"dirId\":\"" << f->getDirId() << "\",";
        ss << "\"sizeInBlocks\":" << f->getAllocatedBlocks().size() << ",";
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
        ss << "\"pid\":\"" << minios::jsonEscape(e.pid) << "\",";
        ss << "\"openedAtTick\":" << e.openedAtTick;
        ss << "}";
        if (i + 1 < openFileTable.size()) ss << ",";
    }
    ss << "]}";

    return ss.str();
}

// ============================================================
// PERSISTENCE — TEXT SNAPSHOTS
// ============================================================
//
// The virtual filesystem lives in RAM (plus raw bytes in engine/data/disk.img),
// so an engine restart would otherwise lose every directory/file entry. The
// format below is a complete, self-describing dump that the Node backend mirrors
// into persistent storage and feeds back through restoreFromSerialized():
//
//   MINIOS_VFS 1
//   D <dirId> <parentDirId|-> <createdAt> <nameBase64>
//   F <fileId> <dirId> <createdAt> <ownerPIDBase64> <nameBase64> <contentBase64|->
//
// Base64 keeps names and contents on a single line, so '\n' inside a text file
// can never be mistaken for a record separator.

std::string FileSystem::serialize() const
{
    std::ostringstream ss;
    ss << "MINIOS_VFS 1\n";

    for (const auto& d : directories)
    {
        ss << "D " << d->getDirId() << " "
           << (d->getParentDirId().empty() ? "-" : d->getParentDirId()) << " "
           << d->getCreatedAt() << " "
           << minios::base64Encode(d->getName()) << "\n";
    }

    for (const auto& f : files)
    {
        // Read the stored bytes straight back off the simulated disk.
        std::string content;
        for (int blockId : f->getAllocatedBlocks())
        {
            std::vector<char> raw = disk->readBlock(blockId);
            content.append(raw.data(), raw.size());
        }
        if (static_cast<int>(content.size()) > f->getSizeInBytes())
        {
            content.resize(static_cast<std::size_t>(f->getSizeInBytes()));
        }

        ss << "F " << f->getFileId() << " "
           << f->getDirId() << " "
           << f->getCreatedAt() << " "
           << minios::base64Encode(f->getOwnerPID()) << " "
           << minios::base64Encode(f->getName()) << " "
           << (content.empty() ? "-" : minios::base64Encode(content)) << "\n";
    }

    return ss.str();
}

bool FileSystem::restoreFromSerialized(const std::string& snapshot, std::string& error)
{
    error.clear();

    // ---- Phase 1: parse everything before touching live state, so a malformed
    // ---- payload can never leave the filesystem half-destroyed.
    struct DirRecord
    {
        std::string id;
        std::string parentId;
        std::string name;
        int createdAt{ 0 };
    };

    struct FileRecord
    {
        std::string id;
        std::string dirId;
        std::string ownerPID;
        std::string name;
        std::string content;
        int createdAt{ 0 };
    };

    std::vector<DirRecord> dirRecords;
    std::vector<FileRecord> fileRecords;

    std::istringstream input(snapshot);
    std::string line;
    bool headerSeen = false;
    int lineNumber = 0;

    while (std::getline(input, line))
    {
        lineNumber++;

        if (!line.empty() && line.back() == '\r') line.pop_back();
        if (line.empty()) continue;

        std::istringstream reader(line);
        std::string kind;
        reader >> kind;

        if (!headerSeen)
        {
            if (kind != "MINIOS_VFS")
            {
                error = "not a MiniOS filesystem snapshot";
                return false;
            }

            std::string version;
            reader >> version;
            if (version != "1")
            {
                error = "unsupported snapshot version: " + version;
                return false;
            }

            headerSeen = true;
            continue;
        }

        if (kind == "D")
        {
            DirRecord record;
            std::string parent;
            std::string nameB64;

            if (!(reader >> record.id >> parent >> record.createdAt >> nameB64))
            {
                error = "malformed directory record on line " + std::to_string(lineNumber);
                return false;
            }

            record.parentId = (parent == "-") ? "" : parent;
            record.name = minios::base64Decode(nameB64);
            dirRecords.push_back(record);
        }
        else if (kind == "F")
        {
            FileRecord record;
            std::string ownerB64;
            std::string nameB64;
            std::string contentB64;

            if (!(reader >> record.id >> record.dirId >> record.createdAt >> ownerB64 >> nameB64 >> contentB64))
            {
                error = "malformed file record on line " + std::to_string(lineNumber);
                return false;
            }

            record.ownerPID = minios::base64Decode(ownerB64);
            record.name = minios::base64Decode(nameB64);
            record.content = (contentB64 == "-") ? "" : minios::base64Decode(contentB64);
            fileRecords.push_back(record);
        }
        else
        {
            error = "unknown record type '" + kind + "' on line " + std::to_string(lineNumber);
            return false;
        }
    }

    if (!headerSeen)
    {
        error = "empty snapshot";
        return false;
    }

    // ---- Phase 2: rebuild. reset() keeps only the permanent root (D0).
    reset();

    const auto bumpCounter = [](const std::string& id, char prefix, int& counter)
    {
        if (id.size() < 2 || id[0] != prefix) return;
        try
        {
            int value = std::stoi(id.substr(1));
            if (value >= counter) counter = value + 1;
        }
        catch (...) { /* ids that aren't <prefix><number> simply don't advance the counter */ }
    };

    // The root directory is already present after reset(); its serialized "D0"
    // row is intentionally skipped. Creation order guarantees parents exist
    // before their children (FileSystem::createDirectory enforces that).
    for (const auto& record : dirRecords)
    {
        if (record.id.empty())
        {
            error = "directory record with empty id";
            return false;
        }

        if (record.id == ROOT_DIR_ID) continue;
        if (findDirectory(record.id))
        {
            error = "duplicate directory id " + record.id;
            return false;
        }

        if (record.parentId.empty())
        {
            error = "directory " + record.id + " has no parent";
            return false;
        }

        if (!findDirectory(record.parentId))
        {
            error = "directory " + record.id + " references missing parent " + record.parentId;
            return false;
        }

        directories.push_back(
            std::make_unique<Directory>(record.id, record.name, record.parentId, record.createdAt)
        );

        bumpCounter(record.id, 'D', nextDirId);
    }

    for (const auto& record : fileRecords)
    {
        if (record.id.empty())
        {
            error = "file record with empty id";
            return false;
        }

        if (findFile(record.id))
        {
            error = "duplicate file id " + record.id;
            return false;
        }

        std::string targetDirId = record.dirId.empty() ? ROOT_DIR_ID : record.dirId;
        if (!findDirectory(targetDirId))
        {
            error = "file " + record.id + " references missing directory " + targetDirId;
            return false;
        }

        int blocksNeeded = static_cast<int>(
            (record.content.size() + static_cast<std::size_t>(blockSize) - 1) / static_cast<std::size_t>(blockSize)
        );
        if (blocksNeeded <= 0) blocksNeeded = 1;

        std::vector<int> chosen = strategy->findBlocks(blocks, blocksNeeded);
        if (static_cast<int>(chosen.size()) < blocksNeeded)
        {
            error = "disk too small to restore file '" + record.name + "'";
            return false;
        }

        std::size_t blockIndex = 0;

        for (int blockId : chosen)
        {
            blocks[blockId].allocate(record.id);

            std::size_t offset = static_cast<std::size_t>(blockIndex) * static_cast<std::size_t>(blockSize);
            blockIndex++;

            std::size_t remaining = record.content.size() > offset ? record.content.size() - offset : 0;
            std::size_t chunkLength = remaining < static_cast<std::size_t>(blockSize)
                ? remaining
                : static_cast<std::size_t>(blockSize);

            std::vector<char> chunk(record.content.begin() + offset, record.content.begin() + offset + chunkLength);
            disk->writeBlock(blockId, chunk);
        }

        auto file = std::make_unique<File>(
            record.id,
            record.name,
            record.ownerPID.empty() ? "USER" : record.ownerPID,
            targetDirId,
            blocksNeeded,
            chosen,
            record.createdAt
        );
        file->setSizeInBytes(static_cast<int>(record.content.size()));
        files.push_back(std::move(file));

        bumpCounter(record.id, 'F', nextFileId);
    }

    return true;
}
