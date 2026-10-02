#include "../include/MemoryManager.h"

#include <iostream>

MemoryManager::MemoryManager(int totalMemory)
{
    this->totalMemory = totalMemory;

    blocks.emplace_back(0, totalMemory);
}

bool MemoryManager::allocate(const std::string& processPID, int size)
{
    if (size <= 0)
    {
        return false;
    }

    // A process should not already own memory.
    for (const auto& block : blocks)
    {
        if (!block.isFree() &&
            block.getProcessPID() == processPID)
        {
            return false;
        }
    }

    // For now, use the first suitable free block.
    // The strategy abstraction will replace this later.
    for (size_t i = 0; i < blocks.size(); i++)
    {
        if (!blocks[i].isFree())
        {
            continue;
        }

        if (blocks[i].getSize() < size)
        {
            continue;
        }

        int originalStart = blocks[i].getStartAddress();
        int originalSize = blocks[i].getSize();

        // Exact fit.
        if (originalSize == size)
        {
            blocks[i].allocate(processPID);
            return true;
        }

        // Split the free block.
        blocks[i].setSize(size);
        blocks[i].allocate(processPID);

        MemoryBlock remainingBlock(
            originalStart + size,
            originalSize - size
        );

        blocks.insert(
            blocks.begin() + i + 1,
            remainingBlock
        );

        return true;
    }

    return false;
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
}