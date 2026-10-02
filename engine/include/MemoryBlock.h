#pragma once

#include <string>

class MemoryBlock
{
private:
    int startAddress;
    int size;
    bool free;
    std::string processPID;

public:
    MemoryBlock(int startAddress, int size);

    int getStartAddress() const;
    int getSize() const;
    int getEndAddress() const;

    bool isFree() const;
    std::string getProcessPID() const;

    void allocate(const std::string& processPID);
    void deallocate();

    void setSize(int size);
};