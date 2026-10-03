#pragma once

#include <string>
#include <vector>

class File
{
private:
    std::string fileId;
    std::string name;
    std::string ownerPID;
    std::string dirPath;
    int sizeInBlocks;
    bool open;
    std::vector<int> allocatedBlocks;
    int createdAt;
    int lastAccessedAt;

public:
    File(const std::string& fileId,
         const std::string& name,
         const std::string& ownerPID,
         const std::string& dirPath,
         int sizeInBlocks,
         const std::vector<int>& allocatedBlocks,
         int createdAt);

    std::string getFileId() const;
    std::string getName() const;
    std::string getOwnerPID() const;
    std::string getDirPath() const;
    int getSizeInBlocks() const;
    bool isOpen() const;
    const std::vector<int>& getAllocatedBlocks() const;
    int getCreatedAt() const;
    int getLastAccessedAt() const;

    void setOpen(bool open);
    void setLastAccessedAt(int tick);
};