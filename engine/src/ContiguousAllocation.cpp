#include "../include/ContiguousAllocation.h"

std::vector<int> ContiguousAllocation::findBlocks(
    const std::vector<FileBlock>& blocks,
    int numBlocksNeeded
) const
{
    int n = static_cast<int>(blocks.size());

    // Scan for a contiguous run of free blocks long enough to fit the file
    for (int i = 0; i <= n - numBlocksNeeded; i++)
    {
        bool fits = true;
        for (int j = i; j < i + numBlocksNeeded; j++)
        {
            if (!blocks[j].isFree())
            {
                fits = false;
                // Jump past the occupied block — no point retrying within this run
                i = j;
                break;
            }
        }

        if (fits)
        {
            std::vector<int> result;
            for (int j = i; j < i + numBlocksNeeded; j++)
            {
                result.push_back(blocks[j].getBlockId());
            }
            return result;
        }
    }

    // No contiguous run found
    return {};
}