#include "../include/MemoryBlock.h"

MemoryBlock::MemoryBlock(int startAddress, int size)
{
    this->startAddress = startAddress;
    this->size = size;
    this->free = true;
    this->processPID = "";
}

int MemoryBlock::getStartAddress() const
{
    return this->startAddress;
}

int MemoryBlock::getSize() const
{
    return this->size;
}

int MemoryBlock::getEndAddress() const
{
    return this->startAddress + this->size;
}

bool MemoryBlock::isFree() const
{
    return this->free;
}

std::string MemoryBlock::getProcessPID() const
{
    return this->processPID;
}

void MemoryBlock::allocate(const std::string& processPID)
{
    this->free = false;
    this->processPID = processPID;
}

void MemoryBlock::deallocate()
{
    this->free = true;
    this->processPID = "";
}

void MemoryBlock::setSize(int size)
{
    this->size = size;
}