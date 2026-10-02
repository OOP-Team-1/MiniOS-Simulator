#pragma once

#include "AllocationStrategy.h"

class FirstFit : public AllocationStrategy
{
public:
    int findBlock(
        const std::vector<MemoryBlock>& blocks,
        int size
    ) const override;
};