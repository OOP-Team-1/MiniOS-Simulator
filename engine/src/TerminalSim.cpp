#include "../include/CommandPrompt.h"
#include "../include/FileSystem.h"
#include "../include/ContiguousAllocation.h"

int main() {
    // Set up the required FileSystem and Allocation Strategy
    ContiguousAllocation alloc;
    
    // Instantiate FileSystem with total blocks, block size, and allocation strategy
    FileSystem fs(1024, 4, alloc);

    // Pass the FileSystem into the terminal
    CommandPrompt cp("guru-arya-krishna", "guru-arya-krishna-Inspiron-14-5445", &fs);
    cp.run();
    
    return 0;
}
