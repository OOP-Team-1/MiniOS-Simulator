#include "../include/MemoryManager.h"

#include <iostream>
#include <sstream>

MemoryManager::MemoryManager(
    int totalMemory,
    AllocationStrategy& strategy
)
{
    this->totalMemory = totalMemory;
    this->strategy = &strategy;

    blocks.emplace_back(0, totalMemory);
}

bool MemoryManager::allocate(
    const std::string& processPID,
    int size
)
{
    if (size <= 0)
    {
        return false;
    }

    for (const auto& block : blocks)
    {
        if (!block.isFree() &&
            block.getProcessPID() == processPID)
        {
            return false;
        }
    }

    int blockIndex = strategy->findBlock(blocks, size);

    if (blockIndex == -1)
    {
        return false;
    }

    int originalStart = blocks[blockIndex].getStartAddress();
    int originalSize = blocks[blockIndex].getSize();

    if (originalSize == size)
    {
        blocks[blockIndex].allocate(processPID);
        return true;
    }

    blocks[blockIndex].setSize(size);
    blocks[blockIndex].allocate(processPID);

    MemoryBlock remainingBlock(
        originalStart + size,
        originalSize - size
    );

    blocks.insert(
        blocks.begin() + blockIndex + 1,
        remainingBlock
    );

    return true;
}

bool MemoryManager::deallocate(const std::string& processPID)
{
    for (auto& block : blocks)
    {
        if (!block.isFree() &&
            block.getProcessPID() == processPID)
        {
            block.deallocate();
            mergeFreeBlocks();
            return true;
        }
    }

    return false;
}

void MemoryManager::mergeFreeBlocks()
{
    if (blocks.empty())
    {
        return;
    }

    for (size_t i = 0; i + 1 < blocks.size();)
    {
        if (blocks[i].isFree() &&
            blocks[i + 1].isFree())
        {
            int mergedSize =
                blocks[i].getSize() +
                blocks[i + 1].getSize();

            blocks[i].setSize(mergedSize);
            blocks.erase(blocks.begin() + i + 1);
        }
        else
        {
            i++;
        }
    }
}

void MemoryManager::compact()
{
    std::vector<MemoryBlock> compactedBlocks;
    int currentAddress = 0;

    // Relocate all allocated blocks tightly to the beginning
    for (const auto& block : blocks)
    {
        if (!block.isFree())
        {
            MemoryBlock relocatedBlock(currentAddress, block.getSize());
            relocatedBlock.allocate(block.getProcessPID());
            compactedBlocks.push_back(relocatedBlock);
            currentAddress += block.getSize();
        }
    }

    // Place the single coalesced free block at the end
    if (currentAddress < totalMemory)
    {
        compactedBlocks.emplace_back(currentAddress, totalMemory - currentAddress);
    }

    blocks = std::move(compactedBlocks);
}

double MemoryManager::getExternalFragmentation() const
{
    int freeMem = getFreeMemory();
    if (freeMem == 0)
    {
        return 0.0;
    }

    int largestFreeBlock = 0;
    for (const auto& block : blocks)
    {
        if (block.isFree() && block.getSize() > largestFreeBlock)
        {
            largestFreeBlock = block.getSize();
        }
    }

    return (1.0 - (static_cast<double>(largestFreeBlock) / static_cast<double>(freeMem))) * 100.0;
}

MemorySnapshot MemoryManager::getSnapshot() const
{
    int freeMem = getFreeMemory();
    return {
        totalMemory,
        totalMemory - freeMem,
        freeMem,
        getExternalFragmentation(),
        blocks
    };
}

std::string MemoryManager::getSnapshotAsJson() const
{
    std::ostringstream ss;
    int freeMem = getFreeMemory();
    int usedMem = totalMemory - freeMem;

    ss << "{\n";
    ss << "  \"totalMemory\": " << totalMemory << ",\n";
    ss << "  \"usedMemory\": " << usedMem << ",\n";
    ss << "  \"freeMemory\": " << freeMem << ",\n";
    ss << "  \"externalFragmentation\": " << getExternalFragmentation() << ",\n";
    ss << "  \"blocks\": [\n";

    for (size_t i = 0; i < blocks.size(); ++i)
    {
        const auto& b = blocks[i];
        ss << "    {\n";
        ss << "      \"start\": " << b.getStartAddress() << ",\n";
        ss << "      \"end\": " << b.getEndAddress() << ",\n";
        ss << "      \"size\": " << b.getSize() << ",\n";
        ss << "      \"isFree\": " << (b.isFree() ? "true" : "false") << ",\n";
        ss << "      \"processPID\": \"" << b.getProcessPID() << "\"\n";
        ss << "    }" << (i + 1 < blocks.size() ? "," : "") << "\n";
    }

    ss << "  ]\n";
    ss << "}";
    return ss.str();
}

int MemoryManager::getTotalMemory() const
{
    return this->totalMemory;
}

int MemoryManager::getFreeMemory() const
{
    int freeMemory = 0;

    for (const auto& block : blocks)
    {
        if (block.isFree())
        {
            freeMemory += block.getSize();
        }
    }

    return freeMemory;
}

const std::vector<MemoryBlock>& MemoryManager::getBlocks() const
{
    return this->blocks;
}

void MemoryManager::displayMemory() const
{
    std::cout << "\n===== Memory State =====\n";

    for (const auto& block : blocks)
    {
        std::cout
            << "["
            << block.getStartAddress()
            << " - "
            << block.getEndAddress()
            << ")  "
            << block.getSize()
            << " MB  ";

        if (block.isFree())
        {
            std::cout << "FREE";
        }
        else
        {
            std::cout
                << "Process: "
                << block.getProcessPID();
        }

        std::cout << '\n';
    }

    std::cout << "Free Memory: "
              << getFreeMemory()
              << " MB\n";
    std::cout << "External Fragmentation: "
              << getExternalFragmentation()
              << " %\n";
}