#include "../include/FileBlock.h"

FileBlock::FileBlock(int blockId)
{
    this->blockId = blockId;
    this->free = true;
    this->ownerFileId = "";
}

int FileBlock::getBlockId() const
{
    return this->blockId;
}

bool FileBlock::isFree() const
{
    return this->free;
}

std::string FileBlock::getOwnerFileId() const
{
    return this->ownerFileId;
}

void FileBlock::allocate(const std::string& fileId)
{
    this->free = false;
    this->ownerFileId = fileId;
}

void FileBlock::deallocate()
{
    this->free = true;
    this->ownerFileId = "";
}