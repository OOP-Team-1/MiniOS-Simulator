#include "../include/File.h"

File::File(const std::string& fileId,
           const std::string& name,
           const std::string& ownerPID,
           const std::string& dirPath,
           int sizeInBlocks,
           const std::vector<int>& allocatedBlocks,
           int createdAt)
{
    this->fileId = fileId;
    this->name = name;
    this->ownerPID = ownerPID;
    this->dirPath = dirPath;
    this->sizeInBlocks = sizeInBlocks;
    this->allocatedBlocks = allocatedBlocks;
    this->open = false;
    this->createdAt = createdAt;
    this->lastAccessedAt = createdAt;
}

std::string File::getFileId() const { return this->fileId; }
std::string File::getName() const { return this->name; }
std::string File::getOwnerPID() const { return this->ownerPID; }
std::string File::getDirPath() const { return this->dirPath; }
int File::getSizeInBlocks() const { return this->sizeInBlocks; }
bool File::isOpen() const { return this->open; }
const std::vector<int>& File::getAllocatedBlocks() const { return this->allocatedBlocks; }
int File::getCreatedAt() const { return this->createdAt; }
int File::getLastAccessedAt() const { return this->lastAccessedAt; }

void File::setOpen(bool open) { this->open = open; }
void File::setLastAccessedAt(int tick) { this->lastAccessedAt = tick; }