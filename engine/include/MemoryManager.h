#pragma once

#include <vector>
#include <string>
#include "MemoryBlock.h"

class MemoryManager
{
private:
    std::vector<MemoryBlock> blocks;
    int totalMemory;

    void mergeFreeBlocks();

public:
    MemoryManager(int totalMemory);

    bool allocate(const std::string& processPID, int size);
    bool deallocate(const std::string& processPID);

    void displayMemory() const;

    int getTotalMemory() const;
    int getFreeMemory() const;
};