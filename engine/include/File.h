#pragma once

#include <string>
#include <vector>

class File
{
private:
    std::string fileId;
    std::string name;
    std::string ownerPID;
    std::string dirId;    // real foreign key into FileSystem's directory table
    int sizeInBlocks;    // capacity: number of blocks currently allocated
    int sizeInBytes;     // logical length: actual bytes of content
    bool open;
    std::vector<int> allocatedBlocks;
    int createdAt;
    int lastAccessedAt;

public:
    File(const std::string& fileId,
         const std::string& name,
         const std::string& ownerPID,
         const std::string& dirId,
         int sizeInBlocks,
         const std::vector<int>& allocatedBlocks,
         int createdAt);

    std::string getFileId() const;
    std::string getName() const;
    std::string getOwnerPID() const;
    std::string getDirId() const;
    int getSizeInBlocks() const;
    int getSizeInBytes() const;
    bool isOpen() const;
    const std::vector<int>& getAllocatedBlocks() const;
    int getCreatedAt() const;
    int getLastAccessedAt() const;

    void setOpen(bool open);
    void setLastAccessedAt(int tick);
    void setAllocatedBlocks(const std::vector<int>& blocks);
    void setName(const std::string& newName);
    void setSizeInBytes(int bytes);
    void setDirId(const std::string& newDirId);
};