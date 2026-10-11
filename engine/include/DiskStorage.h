#pragma once

#include <string>
#include <vector>
#include <fstream>

class DiskStorage
{
private:
    std::string filePath;
    int totalBlocks;
    int blockSize;
    std::fstream diskFile;

    void ensureFileExists();

public:
    DiskStorage(const std::string& filePath, int totalBlocks, int blockSize);
    ~DiskStorage();

    // Reads exactly blockSize bytes from the given block.
    std::vector<char> readBlock(int blockId);

    // Writes data into the given block. If data is smaller than
    // blockSize, the remainder of the block is zero-padded.
    void writeBlock(int blockId, const std::vector<char>& data);

    int getBlockSize() const;
    int getTotalBlocks() const;
};