#include "../include/FirstFit.h"

int FirstFit::findBlock(
    const std::vector<MemoryBlock>& blocks,
    int size
) const
{
    for (int i = 0; i < static_cast<int>(blocks.size()); i++)
    {
        if (blocks[i].isFree() &&
            blocks[i].getSize() >= size)
        {
            return i;
        }
    }

    return -1;
}