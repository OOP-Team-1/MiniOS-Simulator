#pragma once

#include "FileAllocationStrategy.h"

class ContiguousAllocation : public FileAllocationStrategy
{
public:
    std::vector<int> findBlocks(
        const std::vector<FileBlock>& blocks,
        int numBlocksNeeded
    ) const override;
};