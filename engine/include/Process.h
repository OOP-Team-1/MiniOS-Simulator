#pragma once
#include<string>

enum class ProcessState
{
    NEW,
    READY,
    RUNNING,
    BLOCKED,
    TERMINATED
};

class Process
{
    private:
        std::string PID;
        std::string name;
        ProcessState state;
        int priority;
        int arrivalTime;
        int burstTime;
        int remainingTime;
    public:
        Process(std::string PID,std::string name,int priority,int arrivalTime,int burstTime);
        std::string getPID();
        std::string getName();
        std::string getState();
        int getPriority();
        int getArrivalTime();
        int getBurstTime();
        int getRemainingTime();
};