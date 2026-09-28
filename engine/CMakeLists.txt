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
)