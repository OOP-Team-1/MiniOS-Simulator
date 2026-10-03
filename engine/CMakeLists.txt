cmake_minimum_required(VERSION 3.20)

project(MiniOS_Simulator CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

include_directories(../include)

add_executable(main
    ../src/main.cpp
    
    ../src/Process.cpp
    ../src/ProcessManager.cpp
    ../src/CPU.cpp

    ../src/FCFSScheduler.cpp
    ../src/SJFScheduler.cpp
    ../src/SRTFScheduler.cpp
    ../src/PriorityScheduler.cpp
    ../src/RoundRobinScheduler.cpp

    ../src/Kernel.cpp

    ../src/MemoryBlock.cpp
    ../src/MemoryManager.cpp
    ../src/FirstFit.cpp
    ../src/BestFit.cpp
    ../src/WorstFit.cpp

    ../src/PagingManager.cpp
    ../src/SimulationEngine.cpp
)