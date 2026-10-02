#pragma once

#include "AllocationStrategy.h"

class BestFit : public AllocationStrategy
{
public:
    int findBlock(
        const std::vector<MemoryBlock>& blocks,
        int size
    ) const override;
};