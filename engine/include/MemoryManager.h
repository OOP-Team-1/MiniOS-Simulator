#pragma once

#include <vector>
#include <string>

#include "MemoryBlock.h"
#include "AllocationStrategy.h"

struct MemorySnapshot
{
    int totalMemory;
    int usedMemory;
    int freeMemory;
    double externalFragmentation;
    std::vector<MemoryBlock> blocks;
};

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

    // Dynamic and Real-Time Dashboard Operations
    void compact();
    void reset();
    double getExternalFragmentation() const;
    MemorySnapshot getSnapshot() const;
    std::string getSnapshotAsJson() const;

    void displayMemory() const;

    int getTotalMemory() const;
    int getFreeMemory() const;

    void setStrategy(AllocationStrategy& newStrategy);

    const std::vector<MemoryBlock>& getBlocks() const;
};