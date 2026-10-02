#include "../include/BestFit.h"

int BestFit::findBlock(
    const std::vector<MemoryBlock>& blocks,
    int size
) const
{
    int bestIndex = -1;
    int smallestSuitableSize = 0;

    for (int i = 0; i < static_cast<int>(blocks.size()); i++)
    {
        if (!blocks[i].isFree() ||
            blocks[i].getSize() < size)
        {
            continue;
        }

        if (bestIndex == -1 ||
            blocks[i].getSize() < smallestSuitableSize)
        {
            bestIndex = i;
            smallestSuitableSize = blocks[i].getSize();
        }
    }

    return bestIndex;
}