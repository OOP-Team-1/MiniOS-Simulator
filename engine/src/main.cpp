
// MiniOS Kernel + CommandPrompt Integration Test Harness
// C++17

#include "../include/Kernel.h"
#include "../include/FCFSScheduler.h"
#include "../include/FirstFit.h"
#include "../include/AllocationStrategy.h"
#include "../include/ContiguousAllocation.h"
#include "../include/FileSystem.h"
#include "../include/MemoryManager.h"
#include "../include/PagingManager.h"

#include <iostream>
#include <memory>
#include <stdexcept>
#include <string>

namespace
{
    // ========================================================
    // SYSTEM CONFIGURATION
    // ========================================================

    constexpr int TOTAL_MEMORY_MB = 128;

    constexpr int TOTAL_DISK_BLOCKS = 32;
    constexpr int DISK_BLOCK_SIZE = 4;

    constexpr int PHYSICAL_MEMORY_KB = 16;
    constexpr int PAGE_SIZE_KB = 4;

    // ========================================================
    // INITIALIZE THE KERNEL'S DEPENDENCIES
    // ========================================================

    struct MiniOSDependencies
    {
        /*
         * Declaration order matters.
         *
         * Members are destroyed in reverse declaration order.
         * Therefore, the managers are destroyed before their
         * allocation strategies, which they reference.
         */

        FirstFit memoryStrategy;
        MemoryManager memoryManager;

        ContiguousAllocation fileStrategy;
        FileSystem fileSystem;

        PagingManager pagingManager;
        FCFSScheduler scheduler;

        MiniOSDependencies()
            : memoryStrategy(),
              memoryManager(TOTAL_MEMORY_MB, memoryStrategy),
              fileStrategy(),
              fileSystem(
                  TOTAL_DISK_BLOCKS,
                  DISK_BLOCK_SIZE,
                  fileStrategy,
                  "data/disk.img"
              ),
              pagingManager(
                  PHYSICAL_MEMORY_KB,
                  PAGE_SIZE_KB,
                  ReplacementPolicy::LRU
              ),
              scheduler()
        {
        }
    };
}

// ============================================================
// MAIN
// ============================================================

int main()
{
    try
    {
        // ----------------------------------------------------
        // 1. Initialize OS components and their dependencies
        // ----------------------------------------------------

        MiniOSDependencies dependencies;

        // ----------------------------------------------------
        // 2. Create the Kernel
        // ----------------------------------------------------

        Kernel kernel(
            dependencies.scheduler,
            dependencies.memoryManager,
            dependencies.fileSystem,
            dependencies.pagingManager,
            MemoryMode::CONTIGUOUS,
            "nitw",
            "minios"
        );

        // ----------------------------------------------------
        // 3. Start the terminal integration test
        // ----------------------------------------------------

        std::cout
            << "============================================\n"
            << "       MiniOS Kernel Integration Test\n"
            << "============================================\n\n";

        std::cout
            << "MiniOS Kernel initialized successfully.\n"
            << "Memory mode: CONTIGUOUS\n\n";

        std::cout
            << "Type 'help' to see available commands.\n"
            << "Special test commands: step, run, exit\n\n";

        std::cout
            << "Examples:\n"
            << "  spawn Editor 2 0 5 20\n"
            << "  spawn Browser 1 0 4 30\n"
            << "  ps\n"
            << "  top\n"
            << "  step\n"
            << "  run\n\n";

        // ----------------------------------------------------
        // 4. Read commands and route them through the Kernel
        // ----------------------------------------------------

        std::string command;

        while (true)
        {
            // The terminal is accessed through the Kernel.
            std::cout << kernel.getCommandPrompt().getPrompt();

            if (!std::getline(std::cin, command))
            {
                break;
            }

            if (command.empty())
            {
                continue;
            }

            // ------------------------------------------------
            // EXIT
            // ------------------------------------------------

            if (command == "exit")
            {
                (void)kernel.executeTerminalCommand(command);
                break;
            }

            // ------------------------------------------------
            // STEP: execute one scheduling step
            // ------------------------------------------------

            if (command == "step")
            {
                kernel.getCommandPrompt().recordExternalCommand(command);

                try
                {
                    if (kernel.runStep())
                    {
                        std::cout
                            << "Executed one scheduling step.\n"
                            << "Simulated time: "
                            << kernel.getCurrentTime()
                            << " time unit(s).\n";
                    }
                    else
                    {
                        std::cout
                            << "No runnable processes remain.\n"
                            << "Simulated time: "
                            << kernel.getCurrentTime()
                            << " time unit(s).\n";
                    }
                }
                catch (const std::exception& error)
                {
                    std::cout << "step: " << error.what() << '\n';
                }

                continue;
            }

            // ------------------------------------------------
            // RUN: execute scheduling until no further progress
            // ------------------------------------------------

            if (command == "run")
            {
                kernel.getCommandPrompt().recordExternalCommand(command);

                try
                {
                    kernel.run();

                    std::cout
                        << "Simulation finished.\n"
                        << "Simulated time: "
                        << kernel.getCurrentTime()
                        << " time unit(s).\n";
                }
                catch (const std::exception& error)
                {
                    std::cout << "run: " << error.what() << '\n';
                }

                continue;
            }

            // ------------------------------------------------
            // ALL OTHER COMMANDS GO THROUGH THE KERNEL
            // ------------------------------------------------

            try
            {
                const std::string output =
                    kernel.executeTerminalCommand(command);

                if (!output.empty())
                {
                    std::cout << output;

                    if (output.back() != '\n' &&
                        output != "\033[2J\033[1;1H")
                    {
                        std::cout << '\n';
                    }
                }
            }
            catch (const std::exception& error)
            {
                std::cout << "minios: "
                          << error.what()
                          << '\n';
            }
        }

        // ----------------------------------------------------
        // 5. End the test session
        // ----------------------------------------------------

        std::cout << "\nMiniOS test session ended.\n";

        return 0;
    }
    catch (const std::exception& error)
    {
        std::cerr
            << "\nFailed to initialize MiniOS:\n"
            << error.what()
            << '\n';

        return 1;
    }
}
