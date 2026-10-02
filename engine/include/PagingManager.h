#pragma once

#include <vector>
#include <string>
#include <unordered_map>
#include <deque>

enum class ReplacementPolicy
{
    FIFO,
    LRU
};

struct PageTableEntry
{
    int pageNumber;
    int frameNumber;     // -1 if page is not currently in physical RAM
    bool valid;          // true if present in RAM, false if swapped to disk
    int lastAccessTime;  // Timestamp for LRU replacement
};

struct Frame
{
    int frameId;
    int size;
    bool isFree;
    std::string processPID;
    int pageNumber;
};

struct AddressTranslationResult
{
    bool pageFault;
    int logicalAddress;
    int pageNumber;
    int offset;
    int frameNumber;
    int physicalAddress;
    std::string message;
};

class PagingManager
{
private:
    int totalMemory;
    int pageSize;
    int totalFrames;
    ReplacementPolicy policy;
    int pageFaultCount;

    std::vector<Frame> frames;
    // Map of processPID -> vector of PageTableEntries
    std::unordered_map<std::string, std::vector<PageTableEntry>> pageTables;
    // Map of processPID -> total allocated logical size
    std::unordered_map<std::string, int> processSizes;

    // FIFO queue of frame IDs for eviction
    std::deque<int> fifoQueue;

    int findFreeFrame();
    int evictVictimFrame();

public:
    PagingManager(int totalMemory, int pageSize, ReplacementPolicy policy = ReplacementPolicy::LRU);

    bool allocateProcess(const std::string& processPID, int memoryRequired, int currentTime = 0);
    bool deallocateProcess(const std::string& processPID);

    AddressTranslationResult accessAddress(const std::string& processPID, int logicalAddress, int currentTime);

    int getPageFaultCount() const;
    int getTotalFrames() const;
    int getFreeFramesCount() const;
    const std::vector<Frame>& getFrames() const;
    const std::vector<PageTableEntry>* getPageTable(const std::string& processPID) const;

    std::string getSnapshotAsJson() const;
    void displayState() const;
};