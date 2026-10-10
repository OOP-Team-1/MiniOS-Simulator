#include "../include/DiskStorage.h"

#include <filesystem>
#include <stdexcept>

DiskStorage::DiskStorage(const std::string& filePath, int totalBlocks, int blockSize)
{
    this->filePath = filePath;
    this->totalBlocks = totalBlocks;
    this->blockSize = blockSize;

    ensureFileExists();

    diskFile.open(filePath, std::ios::in | std::ios::out | std::ios::binary);
    if (!diskFile.is_open())
    {
        throw std::runtime_error("DiskStorage: failed to open backing file: " + filePath);
    }
}

DiskStorage::~DiskStorage()
{
    if (diskFile.is_open())
    {
        diskFile.flush();
        diskFile.close();
    }
}

void DiskStorage::ensureFileExists()
{
    namespace fs = std::filesystem;

    fs::path p(filePath);
    if (p.has_parent_path())
    {
        fs::create_directories(p.parent_path());
    }

    std::uintmax_t requiredSize =
        static_cast<std::uintmax_t>(totalBlocks) * static_cast<std::uintmax_t>(blockSize);

    bool exists = fs::exists(p);
    std::uintmax_t currentSize = exists ? fs::file_size(p) : 0;

    if (!exists || currentSize < requiredSize)
    {
        // Create (or extend) the file to the required size.
        // Opening with "out | binary" on a non-existing file creates it.
        std::ofstream out(filePath, std::ios::out | std::ios::binary | std::ios::app);
        if (!out.is_open())
        {
            throw std::runtime_error("DiskStorage: failed to create backing file: " + filePath);
        }

        std::uintmax_t bytesToAdd = requiredSize - currentSize;
        if (bytesToAdd > 0)
        {
            const std::size_t chunkSize = 4096;
            std::vector<char> zeros(chunkSize, 0);

            std::uintmax_t remaining = bytesToAdd;
            while (remaining > 0)
            {
                std::size_t writeNow =
                    static_cast<std::size_t>(remaining < chunkSize ? remaining : chunkSize);
                out.write(zeros.data(), static_cast<std::streamsize>(writeNow));
                remaining -= writeNow;
            }
        }

        out.close();
    }
}

std::vector<char> DiskStorage::readBlock(int blockId)
{
    if (blockId < 0 || blockId >= totalBlocks)
    {
        throw std::out_of_range("DiskStorage::readBlock: blockId out of range");
    }

    std::vector<char> buffer(blockSize, 0);

    std::streamoff offset = static_cast<std::streamoff>(blockId) * blockSize;

    diskFile.clear(); // reset any eof/fail flags from previous ops
    diskFile.seekg(offset, std::ios::beg);
    diskFile.read(buffer.data(), blockSize);

    // If read partially failed (e.g. truncated file), the unread portion of buffer remains zero-initialized, which is fine.

    return buffer;
}

void DiskStorage::writeBlock(int blockId, const std::vector<char>& data)
{
    if (blockId < 0 || blockId >= totalBlocks)
    {
        throw std::out_of_range("DiskStorage::writeBlock: blockId out of range");
    }

    std::vector<char> buffer(blockSize, 0);

    std::size_t bytesToCopy = data.size() < static_cast<std::size_t>(blockSize)
        ? data.size()
        : static_cast<std::size_t>(blockSize);

    for (std::size_t i = 0; i < bytesToCopy; i++)
    {
        buffer[i] = data[i];
    }

    std::streamoff offset = static_cast<std::streamoff>(blockId) * blockSize;

    diskFile.clear();
    diskFile.seekp(offset, std::ios::beg);
    diskFile.write(buffer.data(), blockSize);
    diskFile.flush();
}

int DiskStorage::getBlockSize() const { return this->blockSize; }
int DiskStorage::getTotalBlocks() const { return this->totalBlocks; }