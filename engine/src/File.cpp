#include "../include/File.h"

File::File(const std::string& fileId,
           const std::string& name,
           const std::string& ownerPID,
           const std::string& dirId,
           int sizeInBlocks,
           const std::vector<int>& allocatedBlocks,
           int createdAt)
{
    this->fileId = fileId;
    this->name = name;
    this->ownerPID = ownerPID;
    this->dirId = dirId;
    this->sizeInBlocks = sizeInBlocks;
    this->sizeInBytes = 0; // new file starts with no content written yet
    this->allocatedBlocks = allocatedBlocks;
    this->open = false;
    this->createdAt = createdAt;
    this->lastAccessedAt = createdAt;
}

std::string File::getFileId() const { return this->fileId; }
std::string File::getName() const { return this->name; }
std::string File::getOwnerPID() const { return this->ownerPID; }
std::string File::getDirId() const { return this->dirId; }
int File::getSizeInBlocks() const { return this->sizeInBlocks; }
int File::getSizeInBytes() const { return this->sizeInBytes; }
bool File::isOpen() const { return this->open; }
const std::vector<int>& File::getAllocatedBlocks() const { return this->allocatedBlocks; }
int File::getCreatedAt() const { return this->createdAt; }
int File::getLastAccessedAt() const { return this->lastAccessedAt; }

void File::setOpen(bool open) { this->open = open; }
void File::setLastAccessedAt(int tick) { this->lastAccessedAt = tick; }
void File::setAllocatedBlocks(const std::vector<int>& newBlocks)
{
    this->allocatedBlocks = newBlocks;
    this->sizeInBlocks = static_cast<int>(newBlocks.size());
}
void File::setName(const std::string& newName)
{
    this->name = newName;
}
void File::setSizeInBytes(int bytes)
{
    this->sizeInBytes = bytes;
}
void File::setDirId(const std::string& newDirId)
{
    this->dirId = newDirId;
}