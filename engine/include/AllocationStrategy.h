#pragma once

#include <vector>
#include "MemoryBlock.h"

class AllocationStrategy
{
public:
    virtual ~AllocationStrategy() = default;

    virtual int findBlock(
        const std::vector<MemoryBlock>& blocks,
        int size
    ) const = 0;
};