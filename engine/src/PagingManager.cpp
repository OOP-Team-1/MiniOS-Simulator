#include "../include/PagingManager.h"
#include <iostream>
#include <sstream>
#include <algorithm>
#include <limits>

PagingManager::PagingManager(int totalMemory, int pageSize, ReplacementPolicy policy)
{
    this->totalMemory = totalMemory;
    this->pageSize = pageSize;
    this->policy = policy;
    this->totalFrames = totalMemory / pageSize;
    this->pageFaultCount = 0;

    for (int i = 0; i < totalFrames; ++i)
    {
        frames.push_back({ i, pageSize, true, "", -1 });
    }
}

int PagingManager::findFreeFrame()
{
    for (int i = 0; i < totalFrames; ++i)
    {
        if (frames[i].isFree)
        {
            return i;
        }
    }
    return -1;
}

int PagingManager::evictVictimFrame()
{
    if (policy == ReplacementPolicy::FIFO)
    {
        if (fifoQueue.empty()) return -1;
        int victimFrame = fifoQueue.front();
        fifoQueue.pop_front();
        return victimFrame;
    }
    else // LRU
    {
        int victimFrame = -1;
        int oldestTime = std::numeric_limits<int>::max();

        for (int i = 0; i < totalFrames; ++i)
        {
            if (!frames[i].isFree)
            {
                const std::string& pid = frames[i].processPID;
                int pageNum = frames[i].pageNumber;

                auto it = pageTables.find(pid);
                if (it == pageTables.end()) continue;

                for (const auto& entry : it->second)
                {
                    if (entry.pageNumber == pageNum && entry.valid)
                    {
                        if (entry.lastAccessTime < oldestTime)
                        {
                            oldestTime = entry.lastAccessTime;
                            victimFrame = i;
                        }
                        break;
                    }
                }
            }
        }
        return victimFrame;
    }
}

bool PagingManager::allocateProcess(const std::string& processPID, int memoryRequired, int currentTime)
{
    if (memoryRequired <= 0 || pageTables.find(processPID) != pageTables.end())
    {
        return false;
    }

    int pagesNeeded = (memoryRequired + pageSize - 1) / pageSize;
    std::vector<PageTableEntry> table;
    processSizes[processPID] = memoryRequired;

    for (int p = 0; p < pagesNeeded; ++p)
    {
        int frameIndex = findFreeFrame();

        if (frameIndex != -1)
        {
            // Frame is available: assign directly
            frames[frameIndex].isFree = false;
            frames[frameIndex].processPID = processPID;
            frames[frameIndex].pageNumber = p;

            fifoQueue.push_back(frameIndex);
            table.push_back({ p, frameIndex, true, currentTime });
        }
        else
        {
            // Memory is full: page remains virtual (on secondary storage) until referenced
            table.push_back({ p, -1, false, 0 });
        }
    }

    pageTables[processPID] = std::move(table);
    return true;
}

bool PagingManager::deallocateProcess(const std::string& processPID)
{
    auto it = pageTables.find(processPID);
    if (it == pageTables.end())
    {
        return false;
    }

    // Free physical frames held by this process
    for (auto& frame : frames)
    {
        if (!frame.isFree && frame.processPID == processPID)
        {
            // Remove from FIFO tracking
            auto fIt = std::find(fifoQueue.begin(), fifoQueue.end(), frame.frameId);
            if (fIt != fifoQueue.end())
            {
                fifoQueue.erase(fIt);
            }

            frame.isFree = true;
            frame.processPID = "";
            frame.pageNumber = -1;
        }
    }

    pageTables.erase(it);
    processSizes.erase(processPID);
    return true;
}

AddressTranslationResult PagingManager::accessAddress(const std::string& processPID, int logicalAddress, int currentTime)
{
    AddressTranslationResult result;
    result.logicalAddress = logicalAddress;
    result.pageFault = false;
    result.frameNumber = -1;
    result.physicalAddress = -1;

    auto it = pageTables.find(processPID);
    if (it == pageTables.end())
    {
        result.message = "Process not found";
        return result;
    }

    if (logicalAddress < 0 || logicalAddress >= processSizes[processPID])
    {
        result.message = "Segmentation Fault: Out of logical address bounds";
        return result;
    }

    int pageNum = logicalAddress / pageSize;
    int offset = logicalAddress % pageSize;

    result.pageNumber = pageNum;
    result.offset = offset;

    auto& table = it->second;
    PageTableEntry* entry = nullptr;

    for (auto& e : table)
    {
        if (e.pageNumber == pageNum)
        {
            entry = &e;
            break;
        }
    }

    if (!entry)
    {
        result.message = "Invalid page lookup";
        return result;
    }

    // Page hit
    if (entry->valid)
    {
        entry->lastAccessTime = currentTime;
        result.pageFault = false;
        result.frameNumber = entry->frameNumber;
        result.physicalAddress = (entry->frameNumber * pageSize) + offset;
        result.message = "Translation successful (Cache Hit)";
        return result;
    }

    // Page fault: page is on disk
    pageFaultCount++;
    result.pageFault = true;

    int allocatedFrame = findFreeFrame();

    if (allocatedFrame == -1)
    {
        // Evict a page via FIFO / LRU
        allocatedFrame = evictVictimFrame();

        // guard against -1 from evictVictimFrame (no evictable frame found)
        if (allocatedFrame == -1)
        {
            result.message = "Page Fault: No frame available for eviction";
            return result;
        }

        std::string victimPID = frames[allocatedFrame].processPID;
        int victimPage = frames[allocatedFrame].pageNumber;

        // Invalidate the evicted process's page table entry
        auto victimIt = pageTables.find(victimPID);
        if (victimIt != pageTables.end())
        {
            for (auto& victimEntry : victimIt->second)
            {
                if (victimEntry.pageNumber == victimPage)
                {
                    victimEntry.valid = false;
                    victimEntry.frameNumber = -1;
                    break;
                }
            }
        }
    }

    // Bind page to physical frame
    frames[allocatedFrame].isFree = false;
    frames[allocatedFrame].processPID = processPID;
    frames[allocatedFrame].pageNumber = pageNum;

    if (policy == ReplacementPolicy::FIFO)
    {
        fifoQueue.push_back(allocatedFrame);
    }

    entry->frameNumber = allocatedFrame;
    entry->valid = true;
    entry->lastAccessTime = currentTime;

    result.frameNumber = allocatedFrame;
    result.physicalAddress = (allocatedFrame * pageSize) + offset;
    result.message = "Page Fault Handled: Page loaded into Frame " + std::to_string(allocatedFrame);

    return result;
}

int PagingManager::getPageFaultCount() const
{
    return pageFaultCount;
}

int PagingManager::getTotalFrames() const
{
    return totalFrames;
}

int PagingManager::getFreeFramesCount() const
{
    int freeCount = 0;
    for (const auto& f : frames)
    {
        if (f.isFree) freeCount++;
    }
    return freeCount;
}

const std::vector<Frame>& PagingManager::getFrames() const
{
    return frames;
}

const std::vector<PageTableEntry>* PagingManager::getPageTable(const std::string& processPID) const
{
    auto it = pageTables.find(processPID);
    if (it != pageTables.end())
    {
        return &it->second;
    }
    return nullptr;
}

std::string PagingManager::getSnapshotAsJson() const
{
    std::ostringstream ss;
    ss << "{\n";
    ss << "  \"totalMemory\": " << totalMemory << ",\n";
    ss << "  \"pageSize\": " << pageSize << ",\n";
    ss << "  \"totalFrames\": " << totalFrames << ",\n";
    ss << "  \"freeFrames\": " << getFreeFramesCount() << ",\n";
    ss << "  \"pageFaults\": " << pageFaultCount << ",\n";
    ss << "  \"policy\": \"" << (policy == ReplacementPolicy::LRU ? "LRU" : "FIFO") << "\",\n";

    // Physical Frames
    ss << "  \"frames\": [\n";
    for (size_t i = 0; i < frames.size(); ++i)
    {
        const auto& f = frames[i];
        ss << "    {\n";
        ss << "      \"frameId\": " << f.frameId << ",\n";
        ss << "      \"isFree\": " << (f.isFree ? "true" : "false") << ",\n";
        ss << "      \"processPID\": \"" << f.processPID << "\",\n";
        ss << "      \"pageNumber\": " << f.pageNumber << "\n";
        ss << "    }" << (i + 1 < frames.size() ? "," : "") << "\n";
    }
    ss << "  ],\n";

    // Process Page Tables
    ss << "  \"pageTables\": {\n";
    size_t procIndex = 0;
    for (auto it = pageTables.begin(); it != pageTables.end(); ++it, ++procIndex)
    {
        ss << "    \"" << it->first << "\": [\n";
        for (size_t p = 0; p < it->second.size(); ++p)
        {
            const auto& entry = it->second[p];
            ss << "      {\n";
            ss << "        \"pageNumber\": " << entry.pageNumber << ",\n";
            ss << "        \"frameNumber\": " << entry.frameNumber << ",\n";
            ss << "        \"valid\": " << (entry.valid ? "true" : "false") << ",\n";
            ss << "        \"lastAccessTime\": " << entry.lastAccessTime << "\n";
            ss << "      }" << (p + 1 < it->second.size() ? "," : "") << "\n";
        }
        ss << "    ]" << (procIndex + 1 < pageTables.size() ? "," : "") << "\n";
    }
    ss << "  }\n";
    ss << "}";

    return ss.str();
}

void PagingManager::displayState() const
{
    std::cout << "\n===== Physical Memory Frames (" << totalFrames << " frames, " << pageSize << " KB each) =====\n";
    for (const auto& f : frames)
    {
        std::cout << "Frame " << f.frameId << ": ";
        if (f.isFree)
        {
            std::cout << "[ FREE ]\n";
        }
        else
        {
            std::cout << "[ PID: " << f.processPID << " | Page: " << f.pageNumber << " ]\n";
        }
    }

    std::cout << "\n===== Page Tables =====\n";
    for (const auto& pair : pageTables)
    {
        std::cout << "Process " << pair.first << ":\n";
        for (const auto& entry : pair.second)
        {
            std::cout << "  Page " << entry.pageNumber << " -> "
                      << (entry.valid ? ("Frame " + std::to_string(entry.frameNumber)) : "SWAPPED OUT / DISK")
                      << " (Access Time: " << entry.lastAccessTime << ")\n";
        }
    }
    std::cout << "Total Page Faults: " << pageFaultCount << "\n";
}