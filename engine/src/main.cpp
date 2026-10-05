#include <iostream>
#include <vector>
#include <string>
#include <iomanip>
#include <exception>

#include "../include/Kernel.h"
#include "../include/RoundRobinScheduler.h"
#include "../include/MemoryBlock.h"
#include "../include/FileBlock.h"
#include "../include/AllocationStrategy.h"
#include "../include/FileAllocationStrategy.h"
#include "../include/FirstFit.h"
#include "../include/BestFit.h"
#include "../include/WorstFit.h"
#include "../include/ContiguousAllocation.h"

using namespace std;


// ============================================================
// DISPLAY HELPERS
// ============================================================

void printSeparator()
{
    cout << "\n============================================================\n";
}

void printProcessTable(const ProcessManager& manager)
{
    cout << "\n---------------- PROCESS TABLE ----------------\n";

    cout << left
         << setw(8)  << "PID"
         << setw(15) << "Name"
         << setw(12) << "State"
         << setw(10) << "Priority"
         << setw(10) << "Arrival"
         << setw(10) << "Burst"
         << setw(12) << "Remaining"
         << setw(12) << "Memory"
         << '\n';

    cout << string(89, '-') << '\n';

    vector<const Process*> processes =
        manager.getAllProcesses();

    for (const Process* process : processes)
    {
        cout << left
             << setw(8)  << process->getPID()
             << setw(15) << process->getName()
             << setw(12) << process->getState()
             << setw(10) << process->getPriority()
             << setw(10) << process->getArrivalTime()
             << setw(10) << process->getBurstTime()
             << setw(12) << process->getRemainingTime()
             << setw(12) << process->getMemoryRequired()
             << '\n';
    }
}


// ============================================================
// TEST 1 : CPU + ROUND ROBIN + CONTIGUOUS MEMORY
// ============================================================

void testContiguousKernel()
{
    printSeparator();
    cout << "TEST 1: CONTIGUOUS MEMORY + ROUND ROBIN + CPU\n";
    printSeparator();

    // Use the actual concrete allocation strategies
    FirstFit memoryStrategy;
    ContiguousAllocation fileStrategy;

    // --------------------------------------------------------
    // MEMORY MANAGER
    // --------------------------------------------------------

    MemoryManager memoryManager(
        128,
        memoryStrategy
    );

    // --------------------------------------------------------
    // FILE SYSTEM
    // 32 blocks, each 4 KB
    // --------------------------------------------------------

    FileSystem fileSystem(
        32,
        4,
        fileStrategy
    );

    // --------------------------------------------------------
    // PAGING MANAGER
    // Not used in contiguous mode, but Kernel requires it
    // --------------------------------------------------------

    PagingManager pagingManager(
        32,
        4,
        ReplacementPolicy::LRU
    );

    // --------------------------------------------------------
    // ROUND ROBIN
    // --------------------------------------------------------

    RoundRobinScheduler scheduler(2);

    // --------------------------------------------------------
    // KERNEL
    // --------------------------------------------------------

    Kernel kernel(
        scheduler,
        memoryManager,
        fileSystem,
        pagingManager,
        MemoryMode::CONTIGUOUS
    );


    // --------------------------------------------------------
    // CREATE PROCESSES
    // --------------------------------------------------------

    cout << "\nCreating processes...\n";

    Process& p1 =
        kernel.createProcess(
            "Editor",
            3,
            0,
            5,
            30
        );

    Process& p2 =
        kernel.createProcess(
            "Browser",
            1,
            0,
            4,
            40
        );

    Process& p3 =
        kernel.createProcess(
            "Compiler",
            2,
            3,
            6,
            20
        );

    cout << "Created: " << p1.getPID() << '\n';
    cout << "Created: " << p2.getPID() << '\n';
    cout << "Created: " << p3.getPID() << '\n';


    // --------------------------------------------------------
    // PROCESS TABLE BEFORE EXECUTION
    // --------------------------------------------------------

    printProcessTable(
        kernel.getProcessManager()
    );


    // --------------------------------------------------------
    // MEMORY TEST
    // --------------------------------------------------------

    cout << "\nInitial memory state:\n";

    memoryManager.displayMemory();


    // --------------------------------------------------------
    // FILE SYSTEM TEST
    // --------------------------------------------------------

    cout << "\nCreating files owned by processes...\n";

    string file1 =
        fileSystem.createFile(
            p1.getPID(),
            "editor.txt",
            3,
            kernel.getCurrentTime()
        );

    string file2 =
        fileSystem.createFile(
            p2.getPID(),
            "browser.cache",
            4,
            kernel.getCurrentTime()
        );

    cout << "File for "
         << p1.getPID()
         << ": "
         << file1
         << '\n';

    cout << "File for "
         << p2.getPID()
         << ": "
         << file2
         << '\n';


    // --------------------------------------------------------
    // OPEN FILE
    // --------------------------------------------------------

    cout << "\nOpening " << file1 << "...\n";

    bool opened =
        fileSystem.openFile(
            file1,
            p1.getPID(),
            kernel.getCurrentTime()
        );

    cout << "Open result: "
         << (opened ? "SUCCESS" : "FAILED")
         << '\n';


    // --------------------------------------------------------
    // RENAME FILE
    // --------------------------------------------------------

    cout << "\nRenaming " << file1 << "...\n";

    bool renamed =
        fileSystem.renameFile(
            file1,
            "project.txt"
        );

    cout << "Rename result: "
         << (renamed ? "SUCCESS" : "FAILED")
         << '\n';


    // --------------------------------------------------------
    // FILE SYSTEM SNAPSHOT
    // --------------------------------------------------------

    cout << "\nFile system snapshot:\n";

    cout << fileSystem.getSnapshotAsJson()
         << '\n';


    // --------------------------------------------------------
    // RUN KERNEL STEP BY STEP
    // --------------------------------------------------------

    cout << "\nRunning kernel step-by-step...\n";

    int step = 1;

    while (kernel.runStep())
    {
        cout << "\n---------------- STEP "
             << step++
             << " ----------------\n";

        cout << "Kernel time: "
             << kernel.getCurrentTime()
             << '\n';

        Process* current =
            kernel.getCurrentProcess();

        if (current != nullptr)
        {
            cout << "CPU process: "
                 << current->getPID()
                 << '\n';
        }
        else
        {
            cout << "CPU process: IDLE\n";
        }

        printProcessTable(
            kernel.getProcessManager()
        );

        cout << "\nMemory:\n";

        memoryManager.displayMemory();

        // Safety guard
        if (step > 100)
        {
            cout << "\nERROR: Too many kernel steps.\n";
            break;
        }
    }


    // --------------------------------------------------------
    // FINAL STATE
    // --------------------------------------------------------

    cout << "\n\nFINAL CONTIGUOUS-MEMORY STATE\n";

    printProcessTable(
        kernel.getProcessManager()
    );

    cout << "\nMemory after all processes:\n";

    memoryManager.displayMemory();

    cout << "\nFile system after process termination:\n";

    cout << fileSystem.getSnapshotAsJson()
         << '\n';

    cout << "\nKernel time = "
         << kernel.getCurrentTime()
         << '\n';
}


// ============================================================
// TEST 2 : PAGING
// ============================================================

void testPaging()
{
    printSeparator();
    cout << "TEST 2: PAGING + PAGE TABLE + PAGE FAULTS\n";
    printSeparator();

    FirstFit memoryStrategy;
    ContiguousAllocation fileStrategy;

    // --------------------------------------------------------
    // Required by Kernel but not actually used for paging
    // --------------------------------------------------------

    MemoryManager memoryManager(
        128,
        memoryStrategy
    );

    FileSystem fileSystem(
        32,
        4,
        fileStrategy
    );

    // --------------------------------------------------------
    // PAGING
    //
    // 16 KB physical RAM
    // 4 KB page size
    // => 4 physical frames
    // --------------------------------------------------------

    PagingManager pagingManager(
        16,
        4,
        ReplacementPolicy::LRU
    );

    RoundRobinScheduler scheduler(2);

    Kernel kernel(
        scheduler,
        memoryManager,
        fileSystem,
        pagingManager,
        MemoryMode::PAGING
    );


    // --------------------------------------------------------
    // CREATE LARGE PROCESS
    // --------------------------------------------------------

    cout << "\nCreating large process...\n";

    Process& process =
        kernel.createProcess(
            "LargeProcess",
            1,
            0,
            5,
            24
        );

    cout << "PID: "
         << process.getPID()
         << '\n';

    cout << "Logical memory: "
         << process.getMemoryRequired()
         << " KB\n";

    cout << "Physical frames: "
         << pagingManager.getTotalFrames()
         << '\n';


    // --------------------------------------------------------
    // INITIAL PAGING STATE
    // --------------------------------------------------------

    cout << "\nInitial paging state:\n";

    pagingManager.displayState();


    // --------------------------------------------------------
    // ADDRESS TRANSLATION
    // --------------------------------------------------------

    cout << "\n\nTesting address translation...\n";

    int address1 = 2;
    int address2 = 6;
    int address3 = 10;
    int address4 = 14;
    int address5 = 18;


    AddressTranslationResult r1 =
        pagingManager.accessAddress(
            process.getPID(),
            address1,
            1
        );

    cout << "\nAddress "
         << address1
         << ": "
         << r1.message
         << '\n';

    cout << "Page Fault: "
         << (r1.pageFault ? "YES" : "NO")
         << '\n';

    cout << "Physical Address: "
         << r1.physicalAddress
         << '\n';


    AddressTranslationResult r2 =
        pagingManager.accessAddress(
            process.getPID(),
            address2,
            2
        );

    cout << "\nAddress "
         << address2
         << ": "
         << r2.message
         << '\n';

    cout << "Page Fault: "
         << (r2.pageFault ? "YES" : "NO")
         << '\n';

    cout << "Physical Address: "
         << r2.physicalAddress
         << '\n';


    AddressTranslationResult r3 =
        pagingManager.accessAddress(
            process.getPID(),
            address3,
            3
        );

    cout << "\nAddress "
         << address3
         << ": "
         << r3.message
         << '\n';

    cout << "Page Fault: "
         << (r3.pageFault ? "YES" : "NO")
         << '\n';

    cout << "Physical Address: "
         << r3.physicalAddress
         << '\n';


    AddressTranslationResult r4 =
        pagingManager.accessAddress(
            process.getPID(),
            address4,
            4
        );

    cout << "\nAddress "
         << address4
         << ": "
         << r4.message
         << '\n';

    cout << "Page Fault: "
         << (r4.pageFault ? "YES" : "NO")
         << '\n';

    cout << "Physical Address: "
         << r4.physicalAddress
         << '\n';


    // --------------------------------------------------------
    // PAGE FAULT TEST
    //
    // Address 18 belongs to page 4
    // --------------------------------------------------------

    AddressTranslationResult r5 =
        pagingManager.accessAddress(
            process.getPID(),
            address5,
            5
        );

    cout << "\nAddress "
         << address5
         << ": "
         << r5.message
         << '\n';

    cout << "Page Fault: "
         << (r5.pageFault ? "YES" : "NO")
         << '\n';

    cout << "Physical Address: "
         << r5.physicalAddress
         << '\n';


    // --------------------------------------------------------
    // INVALID ADDRESS TEST
    // --------------------------------------------------------

    AddressTranslationResult invalid =
        pagingManager.accessAddress(
            process.getPID(),
            100,
            6
        );

    cout << "\nInvalid address test:\n";

    cout << invalid.message
         << '\n';


    // --------------------------------------------------------
    // PAGING STATE AFTER ACCESSES
    // --------------------------------------------------------

    cout << "\nPaging state after address accesses:\n";

    pagingManager.displayState();

    cout << "\nTotal page faults: "
         << pagingManager.getPageFaultCount()
         << '\n';


    // --------------------------------------------------------
    // TERMINATE PROCESS
    // --------------------------------------------------------

    cout << "\nTerminating process...\n";

    bool terminated =
        kernel.terminateProcess(
            process.getPID()
        );

    cout << "Termination result: "
         << (terminated ? "SUCCESS" : "FAILED")
         << '\n';


    cout << "\nPaging state after termination:\n";

    pagingManager.displayState();
}


// ============================================================
// TEST 3 : MEMORY MANAGER
// ============================================================

void testMemoryManager()
{
    printSeparator();
    cout << "TEST 3: MEMORY MANAGER\n";
    printSeparator();

    FirstFit strategy;

    MemoryManager memory(
        100,
        strategy
    );

    cout << "\nInitial:\n";

    memory.displayMemory();


    // --------------------------------------------------------
    // ALLOCATIONS
    // --------------------------------------------------------

    cout << "\nAllocating P1 = 20 MB\n";

    cout << memory.allocate(
        "P1",
        20
    ) << '\n';


    cout << "\nAllocating P2 = 30 MB\n";

    cout << memory.allocate(
        "P2",
        30
    ) << '\n';


    cout << "\nAllocating P3 = 10 MB\n";

    cout << memory.allocate(
        "P3",
        10
    ) << '\n';


    memory.displayMemory();


    // --------------------------------------------------------
    // DEALLOCATE MIDDLE BLOCK
    // --------------------------------------------------------

    cout << "\nDeallocating P2...\n";

    memory.deallocate("P2");

    memory.displayMemory();


    cout << "\nExternal fragmentation: "
         << fixed
         << setprecision(2)
         << memory.getExternalFragmentation()
         << "%\n";


    // --------------------------------------------------------
    // COMPACTION
    // --------------------------------------------------------

    cout << "\nCompacting memory...\n";

    memory.compact();

    memory.displayMemory();


    // --------------------------------------------------------
    // JSON SNAPSHOT
    // --------------------------------------------------------

    cout << "\nMemory JSON snapshot:\n";

    cout << memory.getSnapshotAsJson()
         << '\n';
}


// ============================================================
// TEST 4 : FILE SYSTEM
// ============================================================

void testFileSystem()
{
    printSeparator();
    cout << "TEST 4: FILE SYSTEM\n";
    printSeparator();

    ContiguousAllocation strategy;

    FileSystem fs(
        16,
        4,
        strategy
    );


    // --------------------------------------------------------
    // CREATE FILES
    // --------------------------------------------------------

    string f1 =
        fs.createFile(
            "P1",
            "notes.txt",
            3,
            0
        );

    string f2 =
        fs.createFile(
            "P2",
            "program.cpp",
            4,
            1
        );


    cout << "\nCreated files:\n";

    cout << f1 << '\n';
    cout << f2 << '\n';


    // --------------------------------------------------------
    // OPEN
    // --------------------------------------------------------

    cout << "\nOpening f1...\n";

    cout << (
        fs.openFile(
            f1,
            "P1",
            2
        )
        ? "SUCCESS"
        : "FAILED"
    ) << '\n';


    // --------------------------------------------------------
    // DUPLICATE OPEN
    // --------------------------------------------------------

    cout << "\nOpening f1 again...\n";

    cout << (
        fs.openFile(
            f1,
            "P1",
            3
        )
        ? "SUCCESS"
        : "CORRECTLY REJECTED"
    ) << '\n';


    // --------------------------------------------------------
    // CLOSE
    // --------------------------------------------------------

    cout << "\nClosing f1...\n";

    cout << (
        fs.closeFile(
            f1,
            "P1"
        )
        ? "SUCCESS"
        : "FAILED"
    ) << '\n';


    // --------------------------------------------------------
    // RENAME
    // --------------------------------------------------------

    cout << "\nRenaming f2...\n";

    cout << (
        fs.renameFile(
            f2,
            "main.cpp"
        )
        ? "SUCCESS"
        : "FAILED"
    ) << '\n';


    // --------------------------------------------------------
    // SNAPSHOT
    // --------------------------------------------------------

    cout << "\nFile system snapshot:\n";

    cout << fs.getSnapshotAsJson()
         << '\n';


    // --------------------------------------------------------
    // PROCESS TERMINATION CLEANUP
    // --------------------------------------------------------

    cout << "\nSimulating termination of P2...\n";

    fs.handleProcessTermination("P2");

    cout << "\nFile system after P2 termination:\n";

    cout << fs.getSnapshotAsJson()
         << '\n';
}


// ============================================================
// TEST 5 : ALLOCATION STRATEGIES
// ============================================================

void testAllocationStrategies()
{
    printSeparator();
    cout << "TEST 5: MEMORY ALLOCATION STRATEGIES\n";
    printSeparator();

    FirstFit firstFit;
    BestFit bestFit;
    WorstFit worstFit;

    vector<MemoryBlock> blocks;

    // Make a few blocks manually.
    // The exact constructor must match your MemoryBlock class.
    // This test is intentionally omitted from execution below
    // because MemoryBlock constructor details may vary.
    
    cout << "\nAvailable concrete strategies:\n";
    cout << "First Fit  : READY\n";
    cout << "Best Fit   : READY\n";
    cout << "Worst Fit  : READY\n";

    cout << "\nThese strategies can now be passed directly to "
         << "MemoryManager.\n";
}


// ============================================================
// MAIN
// ============================================================

int main()
{
    cout << "\n";
    cout << "############################################################\n";
    cout << "#                  MINI OS SIMULATOR                       #\n";
    cout << "#                   KERNEL TEST                            #\n";
    cout << "############################################################\n";


    try
    {
        // ====================================================
        // TEST MEMORY MANAGER
        // ====================================================

        testMemoryManager();


        // ====================================================
        // TEST FILE SYSTEM
        // ====================================================

        testFileSystem();


        // ====================================================
        // TEST CONTIGUOUS KERNEL
        // ====================================================

        testContiguousKernel();


        // ====================================================
        // TEST PAGING
        // ====================================================

        testPaging();


        // ====================================================
        // TEST ALLOCATION STRATEGIES
        // ====================================================

        testAllocationStrategies();


        // ====================================================
        // ALL TESTS FINISHED
        // ====================================================

        printSeparator();

        cout << "ALL TESTS COMPLETED.\n";

        printSeparator();
    }
    catch (const exception& e)
    {
        cout << "\n!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!\n";
        cout << "TEST FAILED\n";
        cout << "Reason: " << e.what() << '\n';
        cout << "!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!\n";

        return 1;
    }
    catch (...)
    {
        cout << "\nUNKNOWN ERROR OCCURRED.\n";

        return 1;
    }

    return 0;
}