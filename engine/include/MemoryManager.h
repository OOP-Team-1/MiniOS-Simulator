#pragma once

#include <vector>
#include <string>

#include "MemoryBlock.h"
#include "AllocationStrategy.h"

class MemoryManager
{
private:
    std::vector<MemoryBlock> blocks;
    int totalMemory;
    AllocationStrategy* strategy;

    void mergeFreeBlocks();

public:
    MemoryManager(
        int totalMemory,
        AllocationStrategy& strategy
    );

    bool allocate(
        const std::string& processPID,
        int size
    );

    bool deallocate(
        const std::string& processPID
    );

    void displayMemory() const;

    int getTotalMemory() const;
    int getFreeMemory() const;
};