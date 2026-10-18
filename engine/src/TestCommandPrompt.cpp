#include <iostream>
#include "../include/CommandPrompt.h"
#include "../include/FileSystem.h"
#include "../include/ContiguousAllocation.h"

int main() {
    ContiguousAllocation alloc;
    FileSystem fs(1024, 4, alloc, "engine/data/test_cli_disk.img");
    CommandPrompt cp("guru-arya-krishna", "guru-arya-krishna-Inspiron-14-5445", &fs);

    // Directly start interactive command prompt
    cp.run();

    return 0;
}
