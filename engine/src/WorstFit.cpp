#include "../include/WorstFit.h"

int WorstFit::findBlock(
    const std::vector<MemoryBlock>& blocks,
    int size
) const
{
    int worstIndex = -1;
    int largestSuitableSize = 0;

    for (int i = 0; i < static_cast<int>(blocks.size()); i++)
    {
        if (!blocks[i].isFree() ||
            blocks[i].getSize() < size)
        {
            continue;
        }

        if (worstIndex == -1 ||
            blocks[i].getSize() > largestSuitableSize)
        {
            worstIndex = i;
            largestSuitableSize = blocks[i].getSize();
        }
    }

    return worstIndex;
}