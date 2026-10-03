#pragma once

#include <string>

class FileBlock
{
private:
    int blockId;
    bool free;
    std::string ownerFileId;

public:
    FileBlock(int blockId);

    int getBlockId() const;
    bool isFree() const;
    std::string getOwnerFileId() const;

    void allocate(const std::string& fileId);
    void deallocate();
};