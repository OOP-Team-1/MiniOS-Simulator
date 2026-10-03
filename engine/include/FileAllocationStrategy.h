#pragma once

#include <vector>
#include <string>
#include "FileBlock.h"

class FileAllocationStrategy
{
public:
    virtual ~FileAllocationStrategy() = default;

    // Returns a list of block IDs to allocate for a file of the given size.
    // Returns an empty vector if allocation is not possible.
    virtual std::vector<int> findBlocks(
        const std::vector<FileBlock>& blocks,
        int numBlocksNeeded
    ) const = 0;
};